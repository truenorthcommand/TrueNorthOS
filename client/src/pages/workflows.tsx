import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Zap, Trash2, Edit, Clock, CheckCircle, AlertCircle, Bell, UserCheck, FileText, Loader2, X, TestTube, Play, ChevronDown, ChevronRight, Shield, ArrowUpCircle, Ban, Eye } from "lucide-react";
import { format } from "date-fns";

const NAVY = "#0F2B4C";

type WorkflowRule = {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConditions: Record<string, any>;
  actions: Array<{ type: string; config: Record<string, any> }>;
  isActive: boolean;
  priority: number;
  createdAt: string;
};

type WorkflowExecution = {
  id: string;
  ruleId: string;
  ruleName: string;
  status: string;
  executedAt: string;
  completedAt: string | null;
};

type ExecutionLog = {
  id: string;
  executionId: string;
  stepIndex: number;
  actionType: string;
  input: Record<string, any>;
  output: Record<string, any>;
  status: string;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
};

type Condition = {
  id: string;
  type: string;
  operator: string;
  field: string;
  value: string;
};

type ActionConfig = {
  type: string;
  config: Record<string, string>;
};

const triggerTypes = [
  { value: "job_created", label: "Job Created", icon: Zap },
  { value: "job_status_changed", label: "Job Status Changed", icon: Zap },
  { value: "job_completed", label: "Job Completed", icon: CheckCircle },
  { value: "invoice_created", label: "Invoice Created", icon: FileText },
  { value: "invoice_overdue", label: "Invoice Overdue", icon: AlertCircle },
  { value: "quote_created", label: "Quote Created", icon: FileText },
  { value: "quote_accepted", label: "Quote Accepted", icon: CheckCircle },
  { value: "payment_received", label: "Payment Received", icon: CheckCircle },
  { value: "client_created", label: "Client Created", icon: UserCheck },
];

const conditionTypes = [
  { value: "job_status", label: "Job Status", description: "Check the current status of the job" },
  { value: "time_elapsed", label: "Time Elapsed", description: "Hours since job was created" },
  { value: "field_missing", label: "Field Missing", description: "Check if a required field is empty" },
  { value: "priority", label: "Priority / Urgency", description: "Check the job's urgency level" },
  { value: "field_value", label: "Field Value", description: "Check any field's value" },
];

const operatorLabels: Record<string, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  greater_than: "greater than",
  less_than: "less than",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const operatorsForType: Record<string, string[]> = {
  job_status: ["equals", "not_equals", "contains"],
  time_elapsed: ["greater_than", "less_than", "equals"],
  field_missing: ["is_empty"],
  priority: ["equals", "not_equals"],
  field_value: ["equals", "not_equals", "contains", "greater_than", "less_than", "is_empty", "is_not_empty"],
};

const jobStatuses = ["Draft", "Scheduled", "In Progress", "Completed", "Invoiced", "Cancelled"];
const urgencyLevels = ["normal", "urgent", "emergency"];
const jobFields = [
  { value: "description", label: "Description" },
  { value: "worksCompleted", label: "Works Completed" },
  { value: "assignedToId", label: "Assigned Engineer" },
  { value: "photos", label: "Photos" },
  { value: "signatures", label: "Signatures" },
  { value: "address", label: "Address" },
  { value: "postcode", label: "Postcode" },
  { value: "contactName", label: "Contact Name" },
  { value: "contactPhone", label: "Contact Phone" },
  { value: "contactEmail", label: "Contact Email" },
  { value: "materials", label: "Materials" },
  { value: "notes", label: "Notes" },
];

const actionTypes = [
  { value: "SendNotification", label: "Send Notification", icon: Bell, description: "Send a notification to admins or a specific user" },
  { value: "NotifyUser", label: "Notify Specific User", icon: UserCheck, description: "Send a targeted alert to a user or all admins" },
  { value: "EscalateJob", label: "Escalate Job", icon: ArrowUpCircle, description: "Reassign job and mark as urgent" },
  { value: "BlockCompletion", label: "Block Completion", icon: Ban, description: "Prevent the job from being closed" },
  { value: "CreateTask", label: "Create Task", icon: FileText, description: "Create an exception/task for follow-up" },
  { value: "BlockJobClosure", label: "Block Job Closure", icon: Shield, description: "Add exception blocking job closure" },
  { value: "UpdateEntityField", label: "Update Field", icon: Edit, description: "Update a field on a job, invoice, or quote" },
  { value: "CallWebhook", label: "Call Webhook", icon: Zap, description: "Send data to an external URL" },
];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function WorkflowsPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
  const [activeTab, setActiveTab] = useState("rules");
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<Record<string, ExecutionLog[]>>({});

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTriggerType, setFormTriggerType] = useState("");
  const [formConditions, setFormConditions] = useState<Condition[]>([]);
  const [formActions, setFormActions] = useState<ActionConfig[]>([]);
  const [formPriority, setFormPriority] = useState(0);

  const [testJobId, setTestJobId] = useState("");
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rulesRes, execRes] = await Promise.all([
        fetch("/api/workflows/rules", { credentials: "include" }),
        fetch("/api/workflows/executions?limit=20", { credentials: "include" }),
      ]);

      if (rulesRes.ok) setRules(await rulesRes.json());
      if (execRes.ok) setExecutions(await execRes.json());
    } catch (error) {
      console.error("Failed to fetch workflow data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingRule(null);
    setFormName("");
    setFormDescription("");
    setFormTriggerType("");
    setFormConditions([]);
    setFormActions([]);
    setFormPriority(0);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: WorkflowRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormDescription(rule.description || "");
    setFormTriggerType(rule.triggerType);
    setFormPriority(rule.priority);

    const conditions: Condition[] = Object.entries(rule.triggerConditions || {}).map(([key, cond]: [string, any]) => ({
      id: generateId(),
      type: cond.type || "field_value",
      operator: cond.operator || "equals",
      field: cond.field || key,
      value: cond.value !== undefined ? String(cond.value) : "",
    }));
    setFormConditions(conditions);

    const actions: ActionConfig[] = (rule.actions || []).map((a: any) => ({
      type: a.type,
      config: Object.fromEntries(Object.entries(a.config || {}).map(([k, v]) => [k, String(v)])),
    }));
    setFormActions(actions.length > 0 ? actions : []);

    setIsDialogOpen(true);
  };

  const addCondition = () => {
    setFormConditions([...formConditions, {
      id: generateId(),
      type: "job_status",
      operator: "equals",
      field: "status",
      value: "",
    }]);
  };

  const removeCondition = (id: string) => {
    setFormConditions(formConditions.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setFormConditions(formConditions.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addAction = () => {
    setFormActions([...formActions, { type: "SendNotification", config: {} }]);
  };

  const removeAction = (index: number) => {
    setFormActions(formActions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, updates: Partial<ActionConfig>) => {
    setFormActions(formActions.map((a, i) => i === index ? { ...a, ...updates } : a));
  };

  const updateActionConfig = (index: number, key: string, value: string) => {
    setFormActions(formActions.map((a, i) => i === index ? { ...a, config: { ...a.config, [key]: value } } : a));
  };

  const handleSaveRule = async () => {
    if (!formName || !formTriggerType || formActions.length === 0) {
      toast({ title: "Missing Fields", description: "Name, trigger, and at least one action are required.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const triggerConditions: Record<string, any> = {};
      formConditions.forEach((cond, i) => {
        triggerConditions[`cond_${i}`] = {
          type: cond.type,
          operator: cond.operator,
          field: cond.field,
          value: cond.value,
        };
      });

      const payload = {
        name: formName,
        description: formDescription || null,
        triggerType: formTriggerType,
        triggerConditions,
        actions: formActions.map(a => ({ type: a.type, config: a.config })),
        isActive: editingRule ? editingRule.isActive : true,
        priority: formPriority,
      };

      const res = await fetch(
        editingRule ? `/api/workflows/rules/${editingRule.id}` : "/api/workflows/rules",
        {
          method: editingRule ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        toast({ title: editingRule ? "Rule Updated" : "Rule Created", description: `"${formName}" has been ${editingRule ? "updated" : "created"}.` });
        setIsDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save workflow rule.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRule = async (rule: WorkflowRule) => {
    try {
      const res = await fetch(`/api/workflows/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...rule, isActive: !rule.isActive }),
      });

      if (res.ok) {
        toast({ title: rule.isActive ? "Rule Disabled" : "Rule Enabled", description: `"${rule.name}" ${rule.isActive ? "disabled" : "enabled"}.` });
        fetchData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to toggle rule.", variant: "destructive" });
    }
  };

  const handleDeleteRule = async (rule: WorkflowRule) => {
    if (!confirm(`Delete "${rule.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/workflows/rules/${rule.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: "Rule Deleted", description: `"${rule.name}" removed.` });
        fetchData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete rule.", variant: "destructive" });
    }
  };

  const handleTestRule = async () => {
    if (!testingRuleId || !testJobId) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`/api/workflows/rules/${testingRuleId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ jobId: testJobId }),
      });

      if (res.ok) {
        setTestResult(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Test Failed", description: data.error || "Could not test rule.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to test rule.", variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTriggerRule = async (ruleId: string, jobId: string) => {
    try {
      const res = await fetch(`/api/workflows/rules/${ruleId}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ jobId }),
      });

      if (res.ok) {
        toast({ title: "Rule Triggered", description: "The rule has been queued for execution." });
        setTimeout(fetchData, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Error", description: data.error || "Failed to trigger rule.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to trigger rule.", variant: "destructive" });
    }
  };

  const loadExecutionLogs = async (executionId: string) => {
    if (executionLogs[executionId]) {
      setExpandedExecution(expandedExecution === executionId ? null : executionId);
      return;
    }

    try {
      const res = await fetch(`/api/workflows/executions/${executionId}/logs`, { credentials: "include" });
      if (res.ok) {
        const logs = await res.json();
        setExecutionLogs(prev => ({ ...prev, [executionId]: logs }));
        setExpandedExecution(executionId);
      }
    } catch (error) {
      console.error("Failed to load logs:", error);
    }
  };

  const getTriggerLabel = (t: string) => triggerTypes.find(x => x.value === t)?.label || t;
  const getTriggerIcon = (t: string) => triggerTypes.find(x => x.value === t)?.icon || Zap;
  const getActionLabel = (t: string) => actionTypes.find(x => x.value === t)?.label || t;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: NAVY }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: NAVY }} data-testid="text-page-title">Workflow Automation</h1>
          <p className="text-muted-foreground mt-1">Create rules to automate tasks when events occur</p>
        </div>
        <Button onClick={openCreateDialog} style={{ backgroundColor: NAVY }} data-testid="button-create-rule">
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rules" data-testid="tab-rules">Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="executions" data-testid="tab-executions">Execution Log ({executions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4 mt-4">
          {rules.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium text-muted-foreground">No automation rules yet</p>
                <p className="text-sm text-muted-foreground mb-4">Create your first rule to start automating tasks.</p>
                <Button onClick={openCreateDialog} style={{ backgroundColor: NAVY }} data-testid="button-create-first-rule">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const TriggerIcon = getTriggerIcon(rule.triggerType);
                const condCount = Object.keys(rule.triggerConditions || {}).length;
                const actionCount = (rule.actions || []).length;

                return (
                  <Card key={rule.id} className={`transition-all ${rule.isActive ? "border-[#0F2B4C]/20" : "border-gray-200 opacity-70"}`} data-testid={`rule-card-${rule.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg mt-0.5 ${rule.isActive ? "bg-[#0F2B4C]/10" : "bg-gray-100"}`}>
                            <TriggerIcon className={`h-5 w-5 ${rule.isActive ? "text-[#0F2B4C]" : "text-gray-400"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className={`font-semibold ${rule.isActive ? "" : "text-gray-500"}`} style={{ color: rule.isActive ? NAVY : undefined }}>
                                {rule.name}
                              </h4>
                              {!rule.isActive && <Badge variant="secondary">Disabled</Badge>}
                              {rule.priority > 0 && <Badge variant="outline">Priority {rule.priority}</Badge>}
                            </div>
                            {rule.description && (
                              <p className="text-sm text-muted-foreground mt-0.5">{rule.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3" /> {getTriggerLabel(rule.triggerType)}
                              </span>
                              <span>{condCount} condition{condCount !== 1 ? "s" : ""}</span>
                              <span>{actionCount} action{actionCount !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {(rule.actions || []).map((action, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {getActionLabel(action.type)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTestingRuleId(rule.id);
                              setTestJobId("");
                              setTestResult(null);
                              setIsTestDialogOpen(true);
                            }}
                            title="Test rule against a job"
                            data-testid={`button-test-rule-${rule.id}`}
                          >
                            <TestTube className="h-4 w-4" />
                          </Button>
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={() => handleToggleRule(rule)}
                            data-testid={`switch-rule-${rule.id}`}
                          />
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)} data-testid={`button-edit-rule-${rule.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRule(rule)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            data-testid={`button-delete-rule-${rule.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="executions" className="space-y-3 mt-4">
          {executions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No executions recorded yet.</p>
                <p className="text-sm text-muted-foreground">Executions will appear here when rules are triggered.</p>
              </CardContent>
            </Card>
          ) : (
            executions.map((exec) => (
              <Card key={exec.id} data-testid={`execution-${exec.id}`}>
                <CardContent className="p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => loadExecutionLogs(exec.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-full ${
                        exec.status === "completed" ? "bg-green-100" :
                        exec.status === "failed" ? "bg-red-100" : "bg-amber-100"
                      }`}>
                        {exec.status === "completed" ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : exec.status === "failed" ? (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: NAVY }}>{exec.ruleName || "Unknown Rule"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(exec.executedAt), "d MMM yyyy, HH:mm:ss")}
                          {exec.completedAt && ` (${Math.round((new Date(exec.completedAt).getTime() - new Date(exec.executedAt).getTime()))}ms)`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={exec.status === "completed" ? "default" : exec.status === "failed" ? "destructive" : "secondary"}>
                        {exec.status}
                      </Badge>
                      {expandedExecution === exec.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {expandedExecution === exec.id && executionLogs[exec.id] && (
                    <div className="mt-4 border-t pt-4 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Execution Steps</p>
                      {executionLogs[exec.id].length === 0 ? (
                        <p className="text-sm text-muted-foreground">No step logs recorded.</p>
                      ) : (
                        executionLogs[exec.id].map((log) => (
                          <div key={log.id} className={`flex items-start gap-3 p-2 rounded text-sm ${
                            log.status === "success" ? "bg-green-50" : log.status === "failed" ? "bg-red-50" : "bg-gray-50"
                          }`}>
                            <span className="text-xs font-mono text-muted-foreground w-6 text-right shrink-0">#{log.stepIndex + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{getActionLabel(log.actionType)}</span>
                                {log.durationMs != null && <span className="text-xs text-muted-foreground">{log.durationMs}ms</span>}
                                <Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs">{log.status}</Badge>
                              </div>
                              {log.errorMessage && (
                                <p className="text-xs text-red-600 mt-1">{log.errorMessage}</p>
                              )}
                              {log.output && log.status === "success" && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {JSON.stringify(log.output).slice(0, 120)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: NAVY }}>
              {editingRule ? "Edit Workflow Rule" : "Create Workflow Rule"}
            </DialogTitle>
            <DialogDescription>
              Define trigger events, conditions to match, and actions to execute.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Basic Info */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rule-name">Rule Name *</Label>
                <Input id="rule-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Escalate unassigned urgent jobs" data-testid="input-rule-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-desc">Description</Label>
                <Textarea id="rule-desc" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="What does this rule do?" data-testid="input-rule-description" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Trigger Event *</Label>
                  <Select value={formTriggerType} onValueChange={setFormTriggerType}>
                    <SelectTrigger data-testid="select-trigger">
                      <SelectValue placeholder="When this happens..." />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Input type="number" min={0} max={100} value={formPriority} onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)} placeholder="0" data-testid="input-priority" />
                </div>
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold" style={{ color: NAVY }}>Conditions</Label>
                  <p className="text-xs text-muted-foreground">All conditions must match for the rule to fire</p>
                </div>
                <Button variant="outline" size="sm" onClick={addCondition} data-testid="button-add-condition">
                  <Plus className="h-3 w-3 mr-1" /> Add Condition
                </Button>
              </div>

              {formConditions.length === 0 ? (
                <div className="text-center py-4 border border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">No conditions — rule fires on every trigger event</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {formConditions.map((cond, idx) => (
                    <div key={cond.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg" data-testid={`condition-${idx}`}>
                      <div className="grid gap-2 flex-1" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                        <Select value={cond.type} onValueChange={(v) => {
                          const ops = operatorsForType[v] || ["equals"];
                          updateCondition(cond.id, { type: v, operator: ops[0], value: "", field: v === "field_missing" || v === "field_value" ? "description" : "status" });
                        }}>
                          <SelectTrigger className="text-xs" data-testid={`condition-type-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {conditionTypes.map((ct) => (
                              <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={cond.operator} onValueChange={(v) => updateCondition(cond.id, { operator: v })}>
                          <SelectTrigger className="text-xs" data-testid={`condition-operator-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(operatorsForType[cond.type] || ["equals"]).map((op) => (
                              <SelectItem key={op} value={op}>{operatorLabels[op]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {cond.type === "job_status" ? (
                          <Select value={cond.value} onValueChange={(v) => updateCondition(cond.id, { value: v })}>
                            <SelectTrigger className="text-xs" data-testid={`condition-value-${idx}`}>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {jobStatuses.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : cond.type === "priority" ? (
                          <Select value={cond.value} onValueChange={(v) => updateCondition(cond.id, { value: v })}>
                            <SelectTrigger className="text-xs" data-testid={`condition-value-${idx}`}>
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                            <SelectContent>
                              {urgencyLevels.map((u) => (
                                <SelectItem key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : cond.type === "field_missing" || cond.type === "field_value" ? (
                          <Select value={cond.value || cond.field} onValueChange={(v) => updateCondition(cond.id, { value: v, field: v })}>
                            <SelectTrigger className="text-xs" data-testid={`condition-value-${idx}`}>
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                              {jobFields.map((f) => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : cond.type === "time_elapsed" ? (
                          <Input
                            type="number"
                            placeholder="Hours"
                            className="text-xs"
                            value={cond.value}
                            onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                            data-testid={`condition-value-${idx}`}
                          />
                        ) : (
                          <Input
                            placeholder="Value"
                            className="text-xs"
                            value={cond.value}
                            onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                            data-testid={`condition-value-${idx}`}
                          />
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-red-400 hover:text-red-600" onClick={() => removeCondition(cond.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold" style={{ color: NAVY }}>Actions *</Label>
                  <p className="text-xs text-muted-foreground">What happens when conditions are met</p>
                </div>
                <Button variant="outline" size="sm" onClick={addAction} data-testid="button-add-action">
                  <Plus className="h-3 w-3 mr-1" /> Add Action
                </Button>
              </div>

              {formActions.length === 0 ? (
                <div className="text-center py-4 border border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">Add at least one action</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formActions.map((action, idx) => (
                    <div key={idx} className="p-3 border rounded-lg space-y-2" data-testid={`action-${idx}`}>
                      <div className="flex items-center justify-between">
                        <Select value={action.type} onValueChange={(v) => updateAction(idx, { type: v, config: {} })}>
                          <SelectTrigger className="w-[250px]" data-testid={`action-type-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {actionTypes.map((at) => (
                              <SelectItem key={at.value} value={at.value}>
                                <div className="flex items-center gap-2">
                                  <at.icon className="h-4 w-4" />
                                  {at.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600" onClick={() => removeAction(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {actionTypes.find(a => a.value === action.type)?.description}
                      </p>

                      {/* Action-specific config */}
                      {(action.type === "SendNotification" || action.type === "NotifyUser") && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Recipient</Label>
                              <Select value={action.config.recipientType || action.config.userId || "admins"} onValueChange={(v) => {
                                if (action.type === "NotifyUser") {
                                  updateActionConfig(idx, "userId", v);
                                } else {
                                  updateActionConfig(idx, "recipientType", v);
                                }
                              }}>
                                <SelectTrigger className="text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admins">All Admins</SelectItem>
                                  <SelectItem value="user">Specific User (enter ID)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Urgent?</Label>
                              <Select value={action.config.urgent || "false"} onValueChange={(v) => updateActionConfig(idx, "urgent", v)}>
                                <SelectTrigger className="text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="false">Normal</SelectItem>
                                  <SelectItem value="true">Urgent</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Message</Label>
                            <Textarea
                              className="text-xs"
                              rows={2}
                              value={action.config.message || ""}
                              onChange={(e) => updateActionConfig(idx, "message", e.target.value)}
                              placeholder="Use {{jobNo}}, {{customerName}}, {{status}} for dynamic values"
                            />
                          </div>
                        </div>
                      )}

                      {action.type === "EscalateJob" && (
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Escalate To (User ID or leave blank for admins)</Label>
                            <Input
                              className="text-xs"
                              value={action.config.escalateTo || ""}
                              onChange={(e) => updateActionConfig(idx, "escalateTo", e.target.value)}
                              placeholder="Leave blank to notify admins only"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Reason</Label>
                            <Textarea
                              className="text-xs"
                              rows={2}
                              value={action.config.reason || ""}
                              onChange={(e) => updateActionConfig(idx, "reason", e.target.value)}
                              placeholder="e.g., Job {{jobNo}} has been open for too long"
                            />
                          </div>
                        </div>
                      )}

                      {(action.type === "BlockCompletion" || action.type === "BlockJobClosure") && (
                        <div>
                          <Label className="text-xs">Reason for blocking</Label>
                          <Textarea
                            className="text-xs"
                            rows={2}
                            value={action.config.reason || ""}
                            onChange={(e) => updateActionConfig(idx, "reason", e.target.value)}
                            placeholder="e.g., Missing photos or signatures required"
                          />
                        </div>
                      )}

                      {action.type === "CreateTask" && (
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Task Title</Label>
                            <Input className="text-xs" value={action.config.title || ""} onChange={(e) => updateActionConfig(idx, "title", e.target.value)} placeholder="e.g., Follow up on {{jobNo}}" />
                          </div>
                          <div>
                            <Label className="text-xs">Task Description</Label>
                            <Textarea className="text-xs" rows={2} value={action.config.description || ""} onChange={(e) => updateActionConfig(idx, "description", e.target.value)} placeholder="Details..." />
                          </div>
                        </div>
                      )}

                      {action.type === "UpdateEntityField" && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Entity</Label>
                            <Select value={action.config.entityType || "job"} onValueChange={(v) => updateActionConfig(idx, "entityType", v)}>
                              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="job">Job</SelectItem>
                                <SelectItem value="invoice">Invoice</SelectItem>
                                <SelectItem value="quote">Quote</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Field</Label>
                            <Input className="text-xs" value={action.config.field || ""} onChange={(e) => updateActionConfig(idx, "field", e.target.value)} placeholder="e.g., status" />
                          </div>
                          <div>
                            <Label className="text-xs">Value</Label>
                            <Input className="text-xs" value={action.config.value || ""} onChange={(e) => updateActionConfig(idx, "value", e.target.value)} placeholder="New value" />
                          </div>
                        </div>
                      )}

                      {action.type === "CallWebhook" && (
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">URL</Label>
                            <Input className="text-xs" value={action.config.url || ""} onChange={(e) => updateActionConfig(idx, "url", e.target.value)} placeholder="https://..." />
                          </div>
                          <div>
                            <Label className="text-xs">Method</Label>
                            <Select value={action.config.method || "POST"} onValueChange={(v) => updateActionConfig(idx, "method", v)}>
                              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="POST">POST</SelectItem>
                                <SelectItem value="PUT">PUT</SelectItem>
                                <SelectItem value="GET">GET</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRule} disabled={isSaving} style={{ backgroundColor: NAVY }} data-testid="button-save-rule">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Rule Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={(open) => { setIsTestDialogOpen(open); if (!open) { setTestResult(null); setTestJobId(""); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle style={{ color: NAVY }}>
              <div className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Test Rule Against Job
              </div>
            </DialogTitle>
            <DialogDescription>
              Enter a Job ID to test whether this rule's conditions would match. No actions will be executed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Job ID</Label>
              <Input
                value={testJobId}
                onChange={(e) => setTestJobId(e.target.value)}
                placeholder="Paste a job ID here"
                data-testid="input-test-job-id"
              />
            </div>

            {testResult && (
              <div className="space-y-3">
                <div className={`flex items-center gap-2 p-3 rounded-lg ${testResult.matches ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} border`}>
                  {testResult.matches ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">
                    {testResult.matches ? "All conditions matched — rule would fire" : "Conditions did not match — rule would not fire"}
                  </span>
                </div>

                {testResult.conditionResults && testResult.conditionResults.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Condition Results</p>
                    {testResult.conditionResults.map((cr: any, i: number) => (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded text-sm ${cr.result ? "bg-green-50" : "bg-red-50"}`}>
                        {cr.result ? <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{cr.type}</span>
                          <span className="text-muted-foreground"> ({cr.field})</span>
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          <span>Actual: <code className="bg-gray-100 px-1 rounded">{String(cr.actual ?? "empty")}</code></span>
                          {cr.expected !== undefined && <span className="ml-2">Expected: <code className="bg-gray-100 px-1 rounded">{String(cr.expected)}</code></span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {testResult.matches && testJobId && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (testingRuleId && testJobId) {
                        handleTriggerRule(testingRuleId, testJobId);
                        setIsTestDialogOpen(false);
                      }
                    }}
                    data-testid="button-trigger-rule"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Trigger Rule (Execute Actions)
                  </Button>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>Close</Button>
            <Button onClick={handleTestRule} disabled={isTesting || !testJobId} style={{ backgroundColor: NAVY }} data-testid="button-run-test">
              {isTesting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Test Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
