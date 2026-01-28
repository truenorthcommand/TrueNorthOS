import { db } from "./db";
import { storage } from "./storage";
import { emitEvent, createException } from "./events";
import { notifyUser, notifyAdmins } from "./notifications";
import type { DomainEvent, WorkflowRule, WorkflowExecution, WorkflowLog } from "@shared/schema";
import { workflowExecutions, workflowLogs, jobs, invoices, quotes, domainEvents } from "@shared/schema";
import { eq } from "drizzle-orm";

interface TriggerCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";
  value?: any;
}

interface WorkflowAction {
  type: ActionType;
  config: Record<string, any>;
}

type ActionType = 
  | "CreateTask"
  | "SendNotification"
  | "UpdateEntityField"
  | "CreateInvoiceDraft"
  | "CreateJobFromQuote"
  | "BlockJobClosure"
  | "CallWebhook"
  | "EmitEvent";

interface ActionContext {
  event: DomainEvent;
  execution: WorkflowExecution;
  rule: WorkflowRule;
  payload: Record<string, any>;
}

export async function processWorkflowForEvent(eventId: string, eventType: string): Promise<void> {
  const rules = await storage.getWorkflowRulesByTrigger(eventType);
  
  if (rules.length === 0) {
    console.log(`[Workflow] No active rules for trigger: ${eventType}`);
    return;
  }

  const [event] = await db.select()
    .from(domainEvents)
    .where(eq(domainEvents.id, eventId));

  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  for (const rule of rules) {
    try {
      await executeWorkflow(rule, event as DomainEvent);
    } catch (error: any) {
      console.error(`[Workflow] Rule ${rule.id} failed for event ${eventId}:`, error);
      await createException({
        type: "workflow_failed",
        severity: "error",
        title: `Workflow "${rule.name}" failed`,
        message: error.message || String(error),
        context: { ruleId: rule.id, eventId, eventType },
        entityType: "workflow",
        entityId: rule.id,
      });
    }
  }
}

async function executeWorkflow(rule: WorkflowRule, event: DomainEvent): Promise<void> {
  console.log(`[Workflow] Executing rule: ${rule.name} (${rule.id})`);

  const conditions = (rule.triggerConditions || {}) as Record<string, TriggerCondition>;
  const payload = (event.payload || {}) as Record<string, any>;

  if (!evaluateConditions(conditions, payload)) {
    console.log(`[Workflow] Conditions not met for rule: ${rule.name}`);
    return;
  }

  const execution = await storage.createWorkflowExecution({
    ruleId: rule.id,
    triggeredById: event.causedById || undefined,
    triggerData: event.payload as Record<string, any>,
    status: "running",
  });

  const actions = (rule.actions || []) as WorkflowAction[];
  let stepIndex = 0;
  let allSucceeded = true;

  const context: ActionContext = {
    event,
    execution,
    rule,
    payload,
  };

  for (const action of actions) {
    const startTime = Date.now();
    const log = await storage.createWorkflowLog({
      executionId: execution.id,
      stepIndex,
      actionType: action.type,
      input: action.config,
      status: "pending",
    });

    try {
      const output = await executeAction(action.type, action.config, context);
      
      await storage.updateWorkflowLog(log.id, {
        status: "success",
        output,
        durationMs: Date.now() - startTime,
      });
    } catch (error: any) {
      allSucceeded = false;
      
      await storage.updateWorkflowLog(log.id, {
        status: "failed",
        errorMessage: error.message || String(error),
        durationMs: Date.now() - startTime,
      });

      console.error(`[Workflow] Action ${action.type} failed:`, error);
      break;
    }

    stepIndex++;
  }

  await storage.updateWorkflowExecution(execution.id, {
    status: allSucceeded ? "completed" : "failed",
    completedAt: new Date(),
  });

  console.log(`[Workflow] Execution ${execution.id} ${allSucceeded ? "completed" : "failed"}`);
}

function evaluateConditions(conditions: Record<string, TriggerCondition>, payload: Record<string, any>): boolean {
  for (const [key, condition] of Object.entries(conditions)) {
    const value = getNestedValue(payload, condition.field);
    
    switch (condition.operator) {
      case "equals":
        if (value !== condition.value) return false;
        break;
      case "not_equals":
        if (value === condition.value) return false;
        break;
      case "contains":
        if (!String(value).includes(String(condition.value))) return false;
        break;
      case "greater_than":
        if (!(Number(value) > Number(condition.value))) return false;
        break;
      case "less_than":
        if (!(Number(value) < Number(condition.value))) return false;
        break;
      case "is_empty":
        if (value !== null && value !== undefined && value !== "") return false;
        break;
      case "is_not_empty":
        if (value === null || value === undefined || value === "") return false;
        break;
    }
  }
  return true;
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

async function executeAction(
  type: ActionType,
  config: Record<string, any>,
  context: ActionContext
): Promise<Record<string, any>> {
  switch (type) {
    case "CreateTask":
      return await actionCreateTask(config, context);
    case "SendNotification":
      return await actionSendNotification(config, context);
    case "UpdateEntityField":
      return await actionUpdateEntityField(config, context);
    case "CreateInvoiceDraft":
      return await actionCreateInvoiceDraft(config, context);
    case "CreateJobFromQuote":
      return await actionCreateJobFromQuote(config, context);
    case "BlockJobClosure":
      return await actionBlockJobClosure(config, context);
    case "CallWebhook":
      return await actionCallWebhook(config, context);
    case "EmitEvent":
      return await actionEmitEvent(config, context);
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

async function actionCreateTask(config: Record<string, any>, context: ActionContext): Promise<Record<string, any>> {
  const { title, description, assigneeId, jobId, priority } = config;
  
  const resolvedTitle = resolveTemplate(title || "New Task", context.payload);
  const resolvedDescription = resolveTemplate(description || "", context.payload);
  const resolvedJobId = jobId ? resolveTemplate(jobId, context.payload) : context.payload.jobId;
  const resolvedAssigneeId = assigneeId ? resolveTemplate(assigneeId, context.payload) : context.payload.assignedTo;
  
  const exception = await createException({
    type: "task_created",
    severity: "info",
    title: resolvedTitle,
    message: resolvedDescription,
    context: { 
      assigneeId: resolvedAssigneeId, 
      priority, 
      workflowExecutionId: context.execution.id 
    },
    entityType: resolvedJobId ? "job" : undefined,
    entityId: resolvedJobId,
  });
  
  console.log(`[Workflow Action] CreateTask: ${resolvedTitle} -> Exception ${exception.id}`);
  
  if (resolvedAssigneeId) {
    await notifyUser(resolvedAssigneeId, {
      type: "task_assigned",
      title: "New Task Assigned",
      message: resolvedTitle,
      timestamp: new Date().toISOString(),
      jobId: resolvedJobId,
    });
  }
  
  return { 
    success: true, 
    taskTitle: resolvedTitle,
    exceptionId: exception.id,
    jobId: resolvedJobId,
  };
}

async function actionSendNotification(config: Record<string, any>, context: ActionContext): Promise<Record<string, any>> {
  const { recipientType, recipientId, message, channel } = config;
  
  const resolvedMessage = resolveTemplate(message || "", context.payload);
  
  if (recipientType === "admins") {
    await notifyAdmins({
      type: "workflow_notification",
      title: "Workflow Notification",
      message: resolvedMessage,
      timestamp: new Date().toISOString(),
    });
    return { success: true, recipients: "admins", message: resolvedMessage };
  }
  
  if (recipientType === "user" && recipientId) {
    const userId = resolveTemplate(recipientId, context.payload);
    await notifyUser(userId, {
      type: "workflow_notification",
      title: "Workflow Notification",
      message: resolvedMessage,
      timestamp: new Date().toISOString(),
    });
    return { success: true, recipients: userId, message: resolvedMessage };
  }
  
  console.log(`[Workflow Action] SendNotification: ${resolvedMessage}`);
  return { success: true, message: resolvedMessage };
}

async function actionUpdateEntityField(config: Record<string, any>, context: ActionContext): Promise<Record<string, any>> {
  const { entityType, entityId, field, value } = config;
  
  const resolvedEntityId = resolveTemplate(entityId, context.payload);
  const resolvedValue = resolveTemplate(String(value), context.payload);
  
  console.log(`[Workflow Action] UpdateEntityField: ${entityType}.${field} = ${resolvedValue}`);
  
  switch (entityType) {
    case "job":
      await storage.updateJob(resolvedEntityId, { [field]: resolvedValue });
      break;
    case "invoice":
      await storage.updateInvoice(resolvedEntityId, { [field]: resolvedValue });
      break;
    case "quote":
      await storage.updateQuote(resolvedEntityId, { [field]: resolvedValue });
      break;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
  
  return { success: true, entityType, entityId: resolvedEntityId, field, value: resolvedValue };
}

async function actionCreateInvoiceDraft(config: Record<string, any>, context: ActionContext): Promise<Record<string, any>> {
  const { jobId, clientId, amount, description } = config;
  
  const resolvedJobId = resolveTemplate(jobId, context.payload);
  const resolvedClientId = resolveTemplate(clientId, context.payload);
  const resolvedAmount = parseFloat(resolveTemplate(String(amount || 0), context.payload));
  const resolvedDescription = resolveTemplate(description || "", context.payload);
  
  const job = resolvedJobId ? await storage.getJob(resolvedJobId) : null;
  const client = resolvedClientId ? await storage.getClient(resolvedClientId) : null;
  
  const invoiceNo = await storage.getNextInvoiceNumber();
  const invoice = await storage.createInvoice({
    invoiceNo,
    customerId: resolvedClientId || undefined,
    customerName: client?.name || job?.customerName || "Customer",
    jobId: resolvedJobId || undefined,
    subtotal: resolvedAmount,
    total: resolvedAmount,
    notes: resolvedDescription || `Invoice for ${job?.jobNo || "job"}`,
    status: "Draft",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    vatRate: 20,
  });
  
  console.log(`[Workflow Action] CreateInvoiceDraft: Invoice #${invoice.id} created`);
  
  return { success: true, invoiceId: invoice.id };
}

async function actionCreateJobFromQuote(config: Record<string, any>, context: ActionContext): Promise<Record<string, any>> {
  const { quoteId } = config;
  
  const resolvedQuoteId = resolveTemplate(quoteId, context.payload);
  const quote = await storage.getQuote(resolvedQuoteId);
  
  if (!quote) {
    throw new Error(`Quote not found: ${resolvedQuoteId}`);
  }
  
  const jobNo = `JOB-${Date.now().toString(36).toUpperCase()}`;
  
  const job = await storage.createJob({
    jobNo,
    customerName: quote.customerName,
    description: quote.description || "Job from quote",
    status: "Scheduled",
  });
  
  await storage.updateQuote(resolvedQuoteId, { status: "Accepted" });
  
  console.log(`[Workflow Action] CreateJobFromQuote: Job ${job.jobNo} created from quote ${resolvedQuoteId}`);
  
  return { success: true, jobId: job.id, jobNo: job.jobNo };
}

async function actionBlockJobClosure(config: Record<string, any>, context: ActionContext): Promise<Record<string, any>> {
  const { jobId, reason } = config;
  
  const resolvedJobId = resolveTemplate(jobId, context.payload);
  const resolvedReason = resolveTemplate(reason || "Blocked by workflow", context.payload);
  
  await createException({
    type: "job_blocked",
    severity: "warning",
    title: `Job closure blocked`,
    message: resolvedReason,
    entityType: "job",
    entityId: resolvedJobId,
    context: { workflowExecutionId: context.execution.id },
  });
  
  console.log(`[Workflow Action] BlockJobClosure: Job ${resolvedJobId} blocked - ${resolvedReason}`);
  
  return { success: true, jobId: resolvedJobId, reason: resolvedReason };
}

async function actionCallWebhook(config: Record<string, any>, context: ActionContext): Promise<Record<string, any>> {
  const { url, method = "POST", headers = {}, body } = config;
  
  const resolvedUrl = resolveTemplate(url, context.payload);
  const resolvedBody = body ? JSON.parse(resolveTemplate(JSON.stringify(body), context.payload)) : context.payload;
  
  const response = await fetch(resolvedUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: method !== "GET" ? JSON.stringify(resolvedBody) : undefined,
  });
  
  const responseBody = await response.text();
  
  console.log(`[Workflow Action] CallWebhook: ${method} ${resolvedUrl} -> ${response.status}`);
  
  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}: ${responseBody}`);
  }
  
  return { success: true, status: response.status, response: responseBody.slice(0, 1000) };
}

async function actionEmitEvent(config: Record<string, any>, context: ActionContext): Promise<Record<string, any>> {
  const { eventType, payload } = config;
  
  const resolvedPayload = payload ? JSON.parse(resolveTemplate(JSON.stringify(payload), context.payload)) : {};
  
  const event = await emitEvent(eventType, resolvedPayload, {
    causedById: context.event.causedById || undefined,
    correlationId: context.event.correlationId || undefined,
  });
  
  console.log(`[Workflow Action] EmitEvent: ${eventType} -> ${event.id}`);
  
  return { success: true, eventId: event.id, eventType };
}

function resolveTemplate(template: string, payload: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(payload, path.trim());
    return value !== undefined ? String(value) : match;
  });
}
