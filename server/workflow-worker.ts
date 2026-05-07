import { pool } from "./db";

/**
 * Workflow Worker - Polls the event outbox and executes matching workflows.
 * Runs server-side, independent of browser or Agent Zero.
 */

let workerInterval: NodeJS.Timeout | null = null;
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 30000, 120000]; // 5s, 30s, 2min

export function startWorkflowWorker() {
  if (workerInterval) return;
  console.log('[WorkflowWorker] Starting - polling every 5s');
  workerInterval = setInterval(processOutbox, POLL_INTERVAL_MS);
  // Also start cron checker
  setInterval(checkCronTriggers, 60000); // Every minute
  setInterval(checkDateTriggers, 60000); // Every minute
}

export function stopWorkflowWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[WorkflowWorker] Stopped');
  }
}

async function processOutbox() {
  try {
    // Fetch unprocessed events (batch of 10)
    const events = await pool.query(
      `SELECT * FROM workflow_events WHERE processed = false ORDER BY created_at ASC LIMIT 10`
    );

    for (const event of events.rows) {
      try {
        await processEvent(event);
        // Mark as processed
        await pool.query(
          `UPDATE workflow_events SET processed = true, processed_at = now() WHERE id = $1`,
          [event.id]
        );
      } catch (error: any) {
        console.error(`[WorkflowWorker] Error processing event ${event.id}:`, error.message);
        // Mark as processed to avoid infinite loop (error is logged)
        await pool.query(
          `UPDATE workflow_events SET processed = true, processed_at = now() WHERE id = $1`,
          [event.id]
        );
      }
    }
  } catch (error: any) {
    // Silent fail - will retry next poll
    if (!error.message?.includes('does not exist')) {
      console.error('[WorkflowWorker] Poll error:', error.message);
    }
  }
}

async function processEvent(event: any) {
  // Handle replay events
  if (event.event_type === 'replay.run') {
    const payload = event.payload;
    await executeRun(payload.run_id);
    return;
  }

  // Find matching published workflows
  const workflows = await pool.query(
    `SELECT w.*, wv.definition 
     FROM workflows w
     JOIN workflow_versions wv ON w.current_version_id = wv.id
     WHERE w.enabled = true AND wv.status = 'published'
     AND w.module = $1`,
    [event.module]
  );

  for (const workflow of workflows.rows) {
    const definition = workflow.definition;
    
    // Check if trigger matches
    if (!matchesTrigger(definition.trigger, event)) continue;

    // Idempotency check
    const idempotencyKey = resolveIdempotencyKey(definition.settings?.idempotency_key, event);
    if (idempotencyKey) {
      const existing = await pool.query(
        `SELECT id FROM workflow_runs WHERE idempotency_key = $1 AND status IN ('completed', 'running')`,
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        console.log(`[WorkflowWorker] Skipping duplicate: ${idempotencyKey}`);
        continue;
      }
    }

    // Evaluate conditions
    const data = event.payload?.data || event.payload || {};
    if (!evaluateConditions(definition.conditions, data)) {
      console.log(`[WorkflowWorker] Conditions not met for ${workflow.name}`);
      continue;
    }

    // Create run record
    const run = await pool.query(
      `INSERT INTO workflow_runs (workflow_id, version_id, trigger_event, status, idempotency_key, started_at)
       VALUES ($1, $2, $3, 'running', $4, now()) RETURNING *`,
      [workflow.id, workflow.current_version_id, JSON.stringify(event), idempotencyKey]
    );

    // Execute actions
    await executeActions(run.rows[0].id, definition.actions, data, definition.settings);
  }
}

async function executeRun(runId: string) {
  const runResult = await pool.query(
    `SELECT wr.*, wv.definition FROM workflow_runs wr
     JOIN workflow_versions wv ON wr.version_id = wv.id
     WHERE wr.id = $1`,
    [runId]
  );
  if (runResult.rows.length === 0) return;

  const run = runResult.rows[0];
  const definition = run.definition;
  const data = run.trigger_event?.payload?.data || {};

  await pool.query(`UPDATE workflow_runs SET status = 'running', started_at = now() WHERE id = $1`, [runId]);
  await executeActions(runId, definition.actions, data, definition.settings);
}

async function executeActions(runId: string, actions: any[], data: any, settings: any) {
  const timeout = (settings?.timeout_seconds || 120) * 1000;
  const startTime = Date.now();

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    
    // Check timeout
    if (Date.now() - startTime > timeout) {
      await pool.query(
        `UPDATE workflow_runs SET status = 'failed', error = 'Timeout exceeded', completed_at = now() WHERE id = $1`,
        [runId]
      );
      return;
    }

    // Handle wait_delay
    if (action.type === 'wait_delay') {
      const delayMs = (action.params?.delay_minutes || 0) * 60000 + (action.params?.delay_hours || 0) * 3600000;
      if (delayMs > 0) {
        // Schedule continuation
        await pool.query(
          `INSERT INTO workflow_events (event_type, module, record_id, payload, created_at)
           VALUES ('replay.run', 'workflows', $1, $2, now() + interval '${Math.floor(delayMs / 1000)} seconds')`,
          [runId, JSON.stringify({ run_id: runId, resume_from: i + 1 })]
        );
        // Log the wait step
        await logStep(runId, action, i, 'completed', action.params, { scheduled_continuation: true }, null);
        return; // Exit - will be resumed later
      }
    }

    const stepStart = Date.now();
    const resolvedParams = resolveTemplateVars(action.params || {}, data);

    try {
      const output = await executeAction(action.type, resolvedParams, data);
      await logStep(runId, action, i, 'completed', resolvedParams, output, null, Date.now() - stepStart);
    } catch (error: any) {
      await logStep(runId, action, i, 'failed', resolvedParams, null, error.message, Date.now() - stepStart);
      
      // Stop execution on failure
      await pool.query(
        `UPDATE workflow_runs SET status = 'failed', error = $2, completed_at = now() WHERE id = $1`,
        [runId, `Action ${action.id} failed: ${error.message}`]
      );
      return;
    }
  }

  // All actions completed
  await pool.query(
    `UPDATE workflow_runs SET status = 'completed', completed_at = now() WHERE id = $1`,
    [runId]
  );
}

async function executeAction(type: string, params: any, data: any): Promise<any> {
  switch (type) {
    case 'create_record':
      return await actionCreateRecord(params);
    case 'update_record':
      return await actionUpdateRecord(params);
    case 'assign_owner':
      return await actionAssignOwner(params);
    case 'create_task':
      return await actionCreateTask(params);
    case 'send_internal_notification':
      return await actionSendNotification(params);
    case 'send_email':
      return await actionSendEmail(params);
    case 'add_note':
      return await actionAddNote(params);
    case 'send_webhook':
      return await actionSendWebhook(params);
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

// === ACTION EXECUTORS ===

async function actionCreateRecord(params: any): Promise<any> {
  // Generic record creation - route to appropriate table based on module
  const { module, ...fields } = params;
  const table = getTableForModule(module);
  if (!table) throw new Error(`Unknown module: ${module}`);
  
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  
  const result = await pool.query(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    values
  );
  return { created_id: result.rows[0]?.id };
}

async function actionUpdateRecord(params: any): Promise<any> {
  const { module, record_id, ...fields } = params;
  const table = getTableForModule(module);
  if (!table) throw new Error(`Unknown module: ${module}`);
  
  const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
  await pool.query(
    `UPDATE ${table} SET ${sets} WHERE id = $1`,
    [record_id, ...Object.values(fields)]
  );
  return { updated: true, record_id };
}

async function actionAssignOwner(params: any): Promise<any> {
  const { module, record_id, owner_id } = params;
  const table = getTableForModule(module);
  if (!table) throw new Error(`Unknown module: ${module}`);
  
  await pool.query(
    `UPDATE ${table} SET assigned_to = $2 WHERE id = $1`,
    [record_id, owner_id]
  );
  return { assigned: true, owner_id };
}

async function actionCreateTask(params: any): Promise<any> {
  const { title, due_in_hours, assign_to, priority } = params;
  // Create as a job/task record
  const dueDate = new Date(Date.now() + (due_in_hours || 24) * 3600000);
  const result = await pool.query(
    `INSERT INTO jobs (nickname, description, assigned_to, priority, scheduled_date, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'Ready', now()) RETURNING id`,
    [title, title, assign_to, priority || 'medium', dueDate.toISOString()]
  );
  return { task_id: result.rows[0]?.id, due_date: dueDate.toISOString() };
}

async function actionSendNotification(params: any): Promise<any> {
  const { user_id, title, message } = params;
  // Store notification (could integrate with push later)
  console.log(`[Workflow Notification] To: ${user_id}, Title: ${title}, Message: ${message}`);
  return { sent: true, user_id, title };
}

async function actionSendEmail(params: any): Promise<any> {
  const { to, subject, body } = params;
  // Queue email (pluggable adapter - currently logs)
  console.log(`[Workflow Email] To: ${to}, Subject: ${subject}`);
  return { queued: true, to, subject };
}

async function actionAddNote(params: any): Promise<any> {
  const { module, record_id, content } = params;
  // Add as a job action/note
  console.log(`[Workflow Note] Module: ${module}, Record: ${record_id}, Content: ${content}`);
  return { added: true, content };
}

async function actionSendWebhook(params: any): Promise<any> {
  const { url, method, headers, body } = params;
  const response = await fetch(url, {
    method: method || 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body || {})
  });
  return { status: response.status, ok: response.ok };
}

// === CRON & DATE TRIGGERS ===

async function checkCronTriggers() {
  try {
    const workflows = await pool.query(
      `SELECT w.*, wv.definition FROM workflows w
       JOIN workflow_versions wv ON w.current_version_id = wv.id
       WHERE w.enabled = true AND wv.status = 'published'`
    );

    const now = new Date();
    for (const wf of workflows.rows) {
      const trigger = wf.definition?.trigger;
      if (trigger?.type !== 'schedule.cron') continue;
      
      if (matchesCron(trigger.cron, now)) {
        await pool.query(
          `INSERT INTO workflow_events (event_type, module, record_id, payload)
           VALUES ('schedule.cron', $1, $2, $3)`,
          [wf.module, wf.id, JSON.stringify({ workflow_id: wf.id, scheduled_at: now.toISOString() })]
        );
      }
    }
  } catch (error: any) {
    // Silent - tables may not exist yet
  }
}

async function checkDateTriggers() {
  try {
    const workflows = await pool.query(
      `SELECT w.*, wv.definition FROM workflows w
       JOIN workflow_versions wv ON w.current_version_id = wv.id
       WHERE w.enabled = true AND wv.status = 'published'`
    );

    for (const wf of workflows.rows) {
      const trigger = wf.definition?.trigger;
      if (trigger?.type !== 'date.reached') continue;
      // Check records where the date field has passed
      const table = getTableForModule(wf.module);
      if (!table || !trigger.field) continue;
      
      const records = await pool.query(
        `SELECT id FROM ${table} WHERE ${trigger.field} <= now() AND ${trigger.field} > now() - interval '2 minutes'`
      );
      
      for (const record of records.rows) {
        await pool.query(
          `INSERT INTO workflow_events (event_type, module, record_id, payload)
           VALUES ('date.reached', $1, $2, $3)`,
          [wf.module, record.id, JSON.stringify({ workflow_id: wf.id, record_id: record.id })]
        );
      }
    }
  } catch (error: any) {
    // Silent
  }
}

// === HELPER FUNCTIONS ===

function matchesTrigger(trigger: any, event: any): boolean {
  if (!trigger) return false;
  
  // Manual run - match by workflow ID in payload
  if (trigger.type === 'manual.run' && event.event_type === 'manual.run') return true;
  
  // Direct type match
  if (trigger.type === event.event_type) {
    // For status.changed, check field/from/to
    if (trigger.type === 'status.changed') {
      const payload = event.payload || {};
      if (trigger.field && payload.field !== trigger.field) return false;
      if (trigger.from && payload.from !== trigger.from) return false;
      if (trigger.to && payload.to !== trigger.to) return false;
    }
    return true;
  }
  
  return false;
}

function evaluateConditions(conditions: any, data: any): boolean {
  if (!conditions || !conditions.rules || conditions.rules.length === 0) return true;
  
  const op = conditions.op || 'and';
  const results = conditions.rules.map((rule: any) => evaluateSingleCondition(rule, data));
  
  if (op === 'and') return results.every((r: boolean) => r);
  if (op === 'or') return results.some((r: boolean) => r);
  return true;
}

function evaluateSingleCondition(rule: any, data: any): boolean {
  const value = data[rule.field];
  switch (rule.type) {
    case 'equals': return value === rule.value;
    case 'not_equals': return value !== rule.value;
    case 'is_empty': return !value || value === '';
    case 'is_not_empty': return !!value && value !== '';
    case 'changed_to': return value === rule.value;
    case 'changed_from': return data._previous?.[rule.field] === rule.value;
    case 'before_date': return new Date(value) < new Date(rule.value);
    case 'after_date': return new Date(value) > new Date(rule.value);
    case 'record_age_gt': return data._age_minutes > (rule.value || 0);
    case 'record_age_lt': return data._age_minutes < (rule.value || 0);
    default: return true;
  }
}

function resolveTemplateVars(params: any, data: any): any {
  if (!params) return params;
  const resolved: any = {};
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === 'string') {
      resolved[key] = val.replace(/\{\{record\.(\w+)\}\}/g, (_, field) => data[field] || '');
    } else if (typeof val === 'object' && val !== null) {
      resolved[key] = resolveTemplateVars(val, data);
    } else {
      resolved[key] = val;
    }
  }
  return resolved;
}

function resolveIdempotencyKey(template: string | undefined, event: any): string | null {
  if (!template) return null;
  const data = event.payload?.data || event.payload || {};
  return template.replace(/\{\{record\.(\w+)\}\}/g, (_, field) => data[field] || 'unknown');
}

async function logStep(runId: string, action: any, order: number, status: string, input: any, output: any, error: string | null, durationMs?: number) {
  await pool.query(
    `INSERT INTO workflow_step_logs (run_id, action_id, action_type, step_order, status, input, output, error, duration_ms, started_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - interval '${durationMs || 0} milliseconds', now())`,
    [runId, action.id, action.type, order, status, JSON.stringify(input), JSON.stringify(output), error, durationMs || 0]
  );
}

function matchesCron(cron: string, now: Date): boolean {
  if (!cron) return false;
  // Simple cron matching: minute hour day month weekday
  const parts = cron.split(' ');
  if (parts.length < 5) return false;
  
  const [min, hour, day, month, weekday] = parts;
  if (min !== '*' && parseInt(min) !== now.getMinutes()) return false;
  if (hour !== '*' && parseInt(hour) !== now.getHours()) return false;
  if (day !== '*' && parseInt(day) !== now.getDate()) return false;
  if (month !== '*' && parseInt(month) !== (now.getMonth() + 1)) return false;
  if (weekday !== '*' && parseInt(weekday) !== now.getDay()) return false;
  return true;
}

function getTableForModule(module: string): string | null {
  const mapping: Record<string, string> = {
    jobs: 'jobs',
    quotes: 'quotes',
    invoices: 'invoices',
    clients: 'clients',
    properties: 'properties',
    expenses: 'expenses',
    timesheets: 'timesheets',
    fleet: 'vehicles',
    users: 'users'
  };
  return mapping[module] || null;
}
