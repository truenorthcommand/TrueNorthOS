import { Router, Request, Response } from "express";
import { pool } from "./db";

const router = Router();

// === ACCESS CONTROL ===
// Only super_admin with id=1 can access workflow studio
function requireSuperAdmin(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user || user.role !== 'super_admin') {
    return res.status(404).json({ message: 'Not found' });
  }
  next();
}

router.use(requireSuperAdmin);

// === WORKFLOW CRUD ===

// List all workflows
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT w.*, 
        wv.version_number as current_version_number,
        wv.status as version_status,
        (SELECT COUNT(*) FROM workflow_runs wr WHERE wr.workflow_id = w.id) as total_runs,
        (SELECT COUNT(*) FROM workflow_runs wr WHERE wr.workflow_id = w.id AND wr.status = 'failed') as failed_runs,
        (SELECT MAX(wr.created_at) FROM workflow_runs wr WHERE wr.workflow_id = w.id) as last_run_at
      FROM workflows w
      LEFT JOIN workflow_versions wv ON w.current_version_id = wv.id
      ORDER BY w.updated_at DESC
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get single workflow with current version
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const wfResult = await pool.query('SELECT * FROM workflows WHERE id = $1', [id]);
    if (wfResult.rows.length === 0) {
      return res.status(404).json({ message: 'Workflow not found' });
    }
    const workflow = wfResult.rows[0];

    // Get all versions
    const versionsResult = await pool.query(
      'SELECT * FROM workflow_versions WHERE workflow_id = $1 ORDER BY version_number DESC',
      [id]
    );

    // Get current draft or latest version
    const draftResult = await pool.query(
      `SELECT * FROM workflow_versions WHERE workflow_id = $1 AND status = 'draft' ORDER BY version_number DESC LIMIT 1`,
      [id]
    );

    res.json({
      ...workflow,
      versions: versionsResult.rows,
      draft: draftResult.rows[0] || null,
      published: versionsResult.rows.find((v: any) => v.status === 'published') || null
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create new workflow
router.post('/', async (req: Request, res: Response) => {
  try {
    const { key, name, description, module, definition } = req.body;
    if (!key || !name) {
      return res.status(400).json({ message: 'key and name are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create workflow
      const wfResult = await client.query(
        `INSERT INTO workflows (key, name, description, module) VALUES ($1, $2, $3, $4) RETURNING *`,
        [key, name, description || '', module || 'general']
      );
      const workflow = wfResult.rows[0];

      // Create initial draft version
      const defaultDefinition = definition || {
        trigger: { type: 'manual.run' },
        conditions: { op: 'and', rules: [] },
        actions: [],
        settings: {
          retry_policy: 'standard',
          idempotency_key: `${key}:{{record.id}}:v1`,
          timeout_seconds: 120,
          dry_run_supported: true
        }
      };

      const versionResult = await client.query(
        `INSERT INTO workflow_versions (workflow_id, version_number, definition, status, created_by)
         VALUES ($1, 1, $2, 'draft', $3) RETURNING *`,
        [workflow.id, JSON.stringify(defaultDefinition), 'super-admin']
      );

      await client.query('COMMIT');
      res.json({ ...workflow, draft: versionResult.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Workflow with this key already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update workflow metadata
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, module, enabled } = req.body;
    const result = await pool.query(
      `UPDATE workflows SET 
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        module = COALESCE($4, module),
        enabled = COALESCE($5, enabled),
        updated_at = now()
      WHERE id = $1 RETURNING *`,
      [id, name, description, module, enabled]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Workflow not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Delete workflow
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM workflows WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// === VERSION MANAGEMENT ===

// Save draft version
router.put('/:id/draft', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { definition } = req.body;

    // Check if draft exists
    const existing = await pool.query(
      `SELECT * FROM workflow_versions WHERE workflow_id = $1 AND status = 'draft' ORDER BY version_number DESC LIMIT 1`,
      [id]
    );

    if (existing.rows.length > 0) {
      // Update existing draft
      const result = await pool.query(
        `UPDATE workflow_versions SET definition = $2 WHERE id = $1 RETURNING *`,
        [existing.rows[0].id, JSON.stringify(definition)]
      );
      res.json(result.rows[0]);
    } else {
      // Create new draft version
      const maxVersion = await pool.query(
        'SELECT MAX(version_number) as max_v FROM workflow_versions WHERE workflow_id = $1',
        [id]
      );
      const nextVersion = (maxVersion.rows[0]?.max_v || 0) + 1;
      const result = await pool.query(
        `INSERT INTO workflow_versions (workflow_id, version_number, definition, status, created_by)
         VALUES ($1, $2, $3, 'draft', 'super-admin') RETURNING *`,
        [id, nextVersion, JSON.stringify(definition)]
      );
      res.json(result.rows[0]);
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// === VALIDATION ===

router.post('/:id/validate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const draftResult = await pool.query(
      `SELECT * FROM workflow_versions WHERE workflow_id = $1 AND status = 'draft' ORDER BY version_number DESC LIMIT 1`,
      [id]
    );
    if (draftResult.rows.length === 0) {
      return res.status(400).json({ message: 'No draft version to validate' });
    }

    const definition = draftResult.rows[0].definition;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate trigger
    const validTriggers = ['record.created', 'record.updated', 'status.changed', 'date.reached', 'schedule.cron', 'manual.run', 'webhook.received'];
    if (!definition.trigger || !validTriggers.includes(definition.trigger.type)) {
      errors.push(`Invalid or missing trigger type. Must be one of: ${validTriggers.join(', ')}`);
    }

    // Validate conditions
    const validConditions = ['equals', 'not_equals', 'changed_to', 'changed_from', 'before_date', 'after_date', 'is_empty', 'is_not_empty', 'record_age_gt', 'record_age_lt', 'and', 'or'];
    if (definition.conditions && definition.conditions.rules) {
      for (const rule of definition.conditions.rules) {
        if (!validConditions.includes(rule.type)) {
          errors.push(`Invalid condition type: ${rule.type}`);
        }
      }
    }

    // Validate actions
    const validActions = ['create_record', 'update_record', 'assign_owner', 'create_task', 'send_internal_notification', 'send_email', 'add_note', 'wait_delay', 'send_webhook'];
    if (!definition.actions || definition.actions.length === 0) {
      errors.push('At least one action is required');
    } else {
      for (const action of definition.actions) {
        if (!validActions.includes(action.type)) {
          errors.push(`Invalid action type: ${action.type}`);
        }
        if (!action.id) {
          errors.push(`Action missing id: ${action.type}`);
        }
      }
    }

    // Validate settings
    if (!definition.settings) {
      warnings.push('No settings defined, defaults will be used');
    } else {
      if (definition.settings.timeout_seconds && definition.settings.timeout_seconds > 300) {
        warnings.push('Timeout exceeds 5 minutes, consider reducing');
      }
    }

    // Update status if valid
    if (errors.length === 0) {
      await pool.query(
        `UPDATE workflow_versions SET status = 'validated' WHERE id = $1`,
        [draftResult.rows[0].id]
      );
    }

    res.json({
      valid: errors.length === 0,
      errors,
      warnings,
      version_id: draftResult.rows[0].id
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// === DRY RUN / TEST ===

router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sample_data } = req.body;

    // Get latest validated or draft version
    const versionResult = await pool.query(
      `SELECT * FROM workflow_versions WHERE workflow_id = $1 AND status IN ('validated', 'draft') ORDER BY version_number DESC LIMIT 1`,
      [id]
    );
    if (versionResult.rows.length === 0) {
      return res.status(400).json({ message: 'No testable version found' });
    }

    const version = versionResult.rows[0];
    const definition = version.definition;
    const results: any[] = [];

    // Simulate condition evaluation
    let conditionsMet = true;
    if (definition.conditions && definition.conditions.rules) {
      for (const rule of definition.conditions.rules) {
        const evaluation = evaluateCondition(rule, sample_data || {});
        results.push({
          step: 'condition',
          type: rule.type,
          field: rule.field,
          result: evaluation.met,
          reason: evaluation.reason
        });
        if (!evaluation.met) conditionsMet = false;
      }
    }

    // Simulate actions
    if (conditionsMet) {
      for (let i = 0; i < definition.actions.length; i++) {
        const action = definition.actions[i];
        const resolved = resolveTemplateVars(action.params, sample_data || {});
        results.push({
          step: 'action',
          order: i + 1,
          id: action.id,
          type: action.type,
          params: resolved,
          would_execute: true,
          description: describeAction(action, resolved)
        });
      }
    } else {
      results.push({
        step: 'skipped',
        reason: 'Conditions not met - workflow would not execute'
      });
    }

    // Create dry-run log entry
    await pool.query(
      `INSERT INTO workflow_runs (workflow_id, version_id, trigger_event, status, is_dry_run, started_at, completed_at)
       VALUES ($1, $2, $3, 'completed', true, now(), now())`,
      [id, version.id, JSON.stringify({ type: 'manual.test', data: sample_data })]
    );

    // Update version status to testing if validated
    if (version.status === 'validated') {
      await pool.query(
        `UPDATE workflow_versions SET status = 'testing' WHERE id = $1`,
        [version.id]
      );
    }

    res.json({
      success: true,
      conditions_met: conditionsMet,
      steps: results,
      version_id: version.id,
      version_number: version.version_number
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// === PUBLISH ===

router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get latest non-published version
    const versionResult = await pool.query(
      `SELECT * FROM workflow_versions WHERE workflow_id = $1 AND status IN ('validated', 'testing') ORDER BY version_number DESC LIMIT 1`,
      [id]
    );
    if (versionResult.rows.length === 0) {
      return res.status(400).json({ message: 'No validated/tested version to publish. Run validation first.' });
    }

    const version = versionResult.rows[0];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Archive old published version
      await client.query(
        `UPDATE workflow_versions SET status = 'archived' WHERE workflow_id = $1 AND status = 'published'`,
        [id]
      );

      // Publish this version
      await client.query(
        `UPDATE workflow_versions SET status = 'published' WHERE id = $1`,
        [version.id]
      );

      // Update workflow pointer + enable
      await client.query(
        `UPDATE workflows SET current_version_id = $2, enabled = true, updated_at = now() WHERE id = $1`,
        [id, version.id]
      );

      await client.query('COMMIT');
      res.json({ success: true, version_id: version.id, version_number: version.version_number });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// === ROLLBACK ===

router.post('/:id/rollback', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { target_version_id } = req.body;

    // Get target version
    const targetResult = await pool.query(
      'SELECT * FROM workflow_versions WHERE id = $1 AND workflow_id = $2',
      [target_version_id, id]
    );
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Target version not found' });
    }

    const target = targetResult.rows[0];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get next version number
      const maxVersion = await client.query(
        'SELECT MAX(version_number) as max_v FROM workflow_versions WHERE workflow_id = $1',
        [id]
      );
      const nextVersion = (maxVersion.rows[0]?.max_v || 0) + 1;

      // Archive current published
      await client.query(
        `UPDATE workflow_versions SET status = 'archived' WHERE workflow_id = $1 AND status = 'published'`,
        [id]
      );

      // Create new version from target definition
      const newVersion = await client.query(
        `INSERT INTO workflow_versions (workflow_id, version_number, definition, status, created_by)
         VALUES ($1, $2, $3, 'published', 'super-admin') RETURNING *`,
        [id, nextVersion, JSON.stringify(target.definition)]
      );

      // Update workflow pointer
      await client.query(
        `UPDATE workflows SET current_version_id = $2, updated_at = now() WHERE id = $1`,
        [id, newVersion.rows[0].id]
      );

      await client.query('COMMIT');
      res.json({ success: true, new_version: newVersion.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// === RUN LOGS ===

router.get('/:id/runs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50', offset = '0' } = req.query;
    const result = await pool.query(
      `SELECT wr.*, wv.version_number 
       FROM workflow_runs wr
       JOIN workflow_versions wv ON wr.version_id = wv.id
       WHERE wr.workflow_id = $1
       ORDER BY wr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, Number(limit), Number(offset)]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get single run with step logs
router.get('/:id/runs/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const runResult = await pool.query(
      `SELECT wr.*, wv.version_number, wv.definition
       FROM workflow_runs wr
       JOIN workflow_versions wv ON wr.version_id = wv.id
       WHERE wr.id = $1`,
      [runId]
    );
    if (runResult.rows.length === 0) {
      return res.status(404).json({ message: 'Run not found' });
    }

    const stepsResult = await pool.query(
      'SELECT * FROM workflow_step_logs WHERE run_id = $1 ORDER BY step_order ASC',
      [runId]
    );

    res.json({
      ...runResult.rows[0],
      steps: stepsResult.rows
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Replay a failed run
router.post('/:id/runs/:runId/replay', async (req: Request, res: Response) => {
  try {
    const { id, runId } = req.params;
    const runResult = await pool.query(
      `SELECT * FROM workflow_runs WHERE id = $1 AND workflow_id = $2 AND status = 'failed'`,
      [runId, id]
    );
    if (runResult.rows.length === 0) {
      return res.status(400).json({ message: 'Can only replay failed runs' });
    }

    const oldRun = runResult.rows[0];

    // Create new run with same trigger event
    const newRun = await pool.query(
      `INSERT INTO workflow_runs (workflow_id, version_id, trigger_event, status, context, started_at)
       VALUES ($1, $2, $3, 'pending', $4, now()) RETURNING *`,
      [id, oldRun.version_id, JSON.stringify(oldRun.trigger_event), JSON.stringify({ replayed_from: runId })]
    );

    // Queue for execution via outbox
    await pool.query(
      `INSERT INTO workflow_events (event_type, module, record_id, payload)
       VALUES ('replay.run', 'workflows', $1, $2)`,
      [newRun.rows[0].id, JSON.stringify({ run_id: newRun.rows[0].id, workflow_id: id })]
    );

    res.json({ success: true, new_run: newRun.rows[0] });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// === MANUAL RUN ===

router.post('/:id/run', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data } = req.body;

    // Get published version
    const wfResult = await pool.query(
      'SELECT * FROM workflows WHERE id = $1 AND enabled = true', [id]
    );
    if (wfResult.rows.length === 0) {
      return res.status(400).json({ message: 'Workflow not found or not enabled' });
    }

    const workflow = wfResult.rows[0];
    if (!workflow.current_version_id) {
      return res.status(400).json({ message: 'No published version' });
    }

    // Queue execution
    await pool.query(
      `INSERT INTO workflow_events (event_type, module, record_id, payload)
       VALUES ('manual.run', $1, $2, $3)`,
      [workflow.module, id, JSON.stringify({ workflow_id: id, data: data || {} })]
    );

    res.json({ success: true, message: 'Workflow queued for execution' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// === HELPER FUNCTIONS ===

function evaluateCondition(rule: any, data: any): { met: boolean; reason: string } {
  const value = data[rule.field];
  switch (rule.type) {
    case 'equals':
      return { met: value === rule.value, reason: `${rule.field} = ${value} (expected: ${rule.value})` };
    case 'not_equals':
      return { met: value !== rule.value, reason: `${rule.field} = ${value} (should not be: ${rule.value})` };
    case 'is_empty':
      return { met: !value || value === '', reason: `${rule.field} is ${value ? 'not empty' : 'empty'}` };
    case 'is_not_empty':
      return { met: !!value && value !== '', reason: `${rule.field} is ${value ? 'not empty' : 'empty'}` };
    case 'changed_to':
      return { met: value === rule.value, reason: `${rule.field} is now ${value}` };
    case 'changed_from':
      return { met: data._previous && data._previous[rule.field] === rule.value, reason: `Previous ${rule.field} was ${data._previous?.[rule.field]}` };
    default:
      return { met: true, reason: `Condition type ${rule.type} assumed true in dry-run` };
  }
}

function resolveTemplateVars(params: any, data: any): any {
  if (!params) return params;
  const resolved: any = {};
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === 'string') {
      resolved[key] = val.replace(/\{\{record\.(\w+)\}\}/g, (_, field) => data[field] || `[${field}]`);
    } else {
      resolved[key] = val;
    }
  }
  return resolved;
}

function describeAction(action: any, params: any): string {
  switch (action.type) {
    case 'create_task': return `Create task: "${params.title}" assigned to ${params.assign_to}`;
    case 'send_internal_notification': return `Notify user ${params.user_id}: "${params.title}"`;
    case 'send_email': return `Send email to ${params.to}: "${params.subject}"`;
    case 'update_record': return `Update record field ${params.field} = ${params.value}`;
    case 'create_record': return `Create new ${params.module} record`;
    case 'assign_owner': return `Assign owner to ${params.owner_id}`;
    case 'add_note': return `Add note: "${params.content}"`;
    case 'wait_delay': return `Wait ${params.delay_minutes || params.delay_hours} ${params.delay_hours ? 'hours' : 'minutes'}`;
    case 'send_webhook': return `POST to ${params.url}`;
    default: return `Execute ${action.type}`;
  }
}

export default router;
