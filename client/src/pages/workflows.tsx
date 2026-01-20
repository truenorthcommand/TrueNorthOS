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
import { useToast } from "@/hooks/use-toast";
import { Plus, Zap, Play, Pause, Trash2, Edit, Clock, CheckCircle, AlertCircle, Mail, MessageSquare, Bell, UserCheck, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";

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

const actionTypes = [
  { value: "send_email", label: "Send Email", icon: Mail },
  { value: "send_sms", label: "Send SMS", icon: MessageSquare },
  { value: "notify_admin", label: "Notify Admin", icon: Bell },
  { value: "create_task", label: "Create Task", icon: FileText },
  { value: "assign_user", label: "Assign User", icon: UserCheck },
];

export default function WorkflowsPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    triggerType: "",
    actionType: "",
    actionConfig: {} as Record<string, string>,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rulesRes, execRes] = await Promise.all([
        fetch("/api/workflows/rules"),
        fetch("/api/workflows/executions?limit=10"),
      ]);

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData);
      }

      if (execRes.ok) {
        const execData = await execRes.json();
        setExecutions(execData);
      }
    } catch (error) {
      console.error("Failed to fetch workflow data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRule = async () => {
    if (!formData.name || !formData.triggerType || !formData.actionType) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        triggerType: formData.triggerType,
        triggerConditions: {},
        actions: [{ type: formData.actionType, config: formData.actionConfig }],
        isActive: true,
        priority: 0,
      };

      const res = await fetch(editingRule ? `/api/workflows/rules/${editingRule.id}` : "/api/workflows/rules", {
        method: editingRule ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: editingRule ? "Rule Updated" : "Rule Created",
          description: `Workflow rule "${formData.name}" has been ${editingRule ? "updated" : "created"}.`,
        });
        setIsDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        throw new Error("Failed to save rule");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save workflow rule. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRule = async (rule: WorkflowRule) => {
    try {
      const res = await fetch(`/api/workflows/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rule, isActive: !rule.isActive }),
      });

      if (res.ok) {
        toast({
          title: rule.isActive ? "Rule Disabled" : "Rule Enabled",
          description: `"${rule.name}" has been ${rule.isActive ? "disabled" : "enabled"}.`,
        });
        fetchData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update rule status.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRule = async (rule: WorkflowRule) => {
    if (!confirm(`Are you sure you want to delete "${rule.name}"?`)) return;

    try {
      const res = await fetch(`/api/workflows/rules/${rule.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Rule Deleted",
          description: `"${rule.name}" has been deleted.`,
        });
        fetchData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete rule.",
        variant: "destructive",
      });
    }
  };

  const handleEditRule = (rule: WorkflowRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      triggerType: rule.triggerType,
      actionType: rule.actions[0]?.type || "",
      actionConfig: rule.actions[0]?.config || {},
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRule(null);
    setFormData({
      name: "",
      description: "",
      triggerType: "",
      actionType: "",
      actionConfig: {},
    });
  };

  const getTriggerIcon = (triggerType: string) => {
    const trigger = triggerTypes.find(t => t.value === triggerType);
    return trigger?.icon || Zap;
  };

  const getTriggerLabel = (triggerType: string) => {
    const trigger = triggerTypes.find(t => t.value === triggerType);
    return trigger?.label || triggerType;
  };

  const getActionLabel = (actionType: string) => {
    const action = actionTypes.find(a => a.value === actionType);
    return action?.label || actionType;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F2B4C]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F2B4C]" data-testid="text-page-title">Workflow Automation</h1>
          <p className="text-muted-foreground mt-1">Automate tasks and notifications based on events</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90" data-testid="button-create-rule">
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-[#0F2B4C]">
                {editingRule ? "Edit Workflow Rule" : "Create Workflow Rule"}
              </DialogTitle>
              <DialogDescription>
                Define when this automation should trigger and what action to take.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Notify admin on job completion"
                  data-testid="input-rule-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description of what this rule does"
                  data-testid="input-rule-description"
                />
              </div>

              <div className="space-y-2">
                <Label>When this happens... *</Label>
                <Select
                  value={formData.triggerType}
                  onValueChange={(value) => setFormData({ ...formData, triggerType: value })}
                >
                  <SelectTrigger data-testid="select-trigger">
                    <SelectValue placeholder="Select a trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerTypes.map((trigger) => (
                      <SelectItem key={trigger.value} value={trigger.value}>
                        <div className="flex items-center gap-2">
                          <trigger.icon className="h-4 w-4" />
                          {trigger.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Then do this... *</Label>
                <Select
                  value={formData.actionType}
                  onValueChange={(value) => setFormData({ ...formData, actionType: value })}
                >
                  <SelectTrigger data-testid="select-action">
                    <SelectValue placeholder="Select an action" />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypes.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        <div className="flex items-center gap-2">
                          <action.icon className="h-4 w-4" />
                          {action.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.actionType === "send_email" && (
                <div className="space-y-2">
                  <Label htmlFor="emailSubject">Email Subject</Label>
                  <Input
                    id="emailSubject"
                    value={formData.actionConfig.subject || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      actionConfig: { ...formData.actionConfig, subject: e.target.value }
                    })}
                    placeholder="Email subject line"
                    data-testid="input-email-subject"
                  />
                </div>
              )}

              {formData.actionType === "notify_admin" && (
                <div className="space-y-2">
                  <Label htmlFor="notifyMessage">Notification Message</Label>
                  <Textarea
                    id="notifyMessage"
                    value={formData.actionConfig.message || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      actionConfig: { ...formData.actionConfig, message: e.target.value }
                    })}
                    placeholder="Message to show in notification"
                    data-testid="input-notify-message"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveRule} 
                disabled={isSaving}
                className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90"
                data-testid="button-save-rule"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingRule ? "Update Rule" : "Create Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-[#0F2B4C]/20">
            <CardHeader>
              <CardTitle className="text-[#0F2B4C]">Automation Rules</CardTitle>
              <CardDescription>
                {rules.length} rule{rules.length !== 1 ? "s" : ""} configured
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No automation rules yet.</p>
                  <p className="text-sm">Create your first rule to automate tasks.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => {
                    const TriggerIcon = getTriggerIcon(rule.triggerType);
                    return (
                      <div
                        key={rule.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          rule.isActive ? "bg-white border-[#0F2B4C]/20" : "bg-gray-50 border-gray-200"
                        }`}
                        data-testid={`rule-${rule.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${rule.isActive ? "bg-[#0F2B4C]/10" : "bg-gray-200"}`}>
                            <TriggerIcon className={`h-5 w-5 ${rule.isActive ? "text-[#0F2B4C]" : "text-gray-400"}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className={`font-medium ${rule.isActive ? "text-[#0F2B4C]" : "text-gray-500"}`}>
                                {rule.name}
                              </h4>
                              {!rule.isActive && (
                                <Badge variant="secondary">Disabled</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              When: {getTriggerLabel(rule.triggerType)} → {getActionLabel(rule.actions[0]?.type || "")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={() => handleToggleRule(rule)}
                            data-testid={`switch-rule-${rule.id}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditRule(rule)}
                            data-testid={`button-edit-rule-${rule.id}`}
                          >
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
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-[#0F2B4C]/20">
            <CardHeader>
              <CardTitle className="text-[#0F2B4C] text-lg">Recent Executions</CardTitle>
              <CardDescription>Latest workflow activity</CardDescription>
            </CardHeader>
            <CardContent>
              {executions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No executions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {executions.map((exec) => (
                    <div key={exec.id} className="flex items-start gap-3 text-sm">
                      <div className={`p-1 rounded-full mt-0.5 ${
                        exec.status === "completed" ? "bg-green-100" : 
                        exec.status === "failed" ? "bg-red-100" : "bg-amber-100"
                      }`}>
                        {exec.status === "completed" ? (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        ) : exec.status === "failed" ? (
                          <AlertCircle className="h-3 w-3 text-red-600" />
                        ) : (
                          <Clock className="h-3 w-3 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#0F2B4C] truncate">{exec.ruleName}</p>
                        <p className="text-muted-foreground text-xs">
                          {format(new Date(exec.executedAt), "d MMM, HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#0F2B4C]/20 bg-[#0F2B4C]/5">
            <CardContent className="pt-6">
              <h4 className="font-semibold text-[#0F2B4C] mb-2">Pro Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Use "Invoice Overdue" trigger to send automatic payment reminders</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Notify admins when high-value jobs are completed</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Send welcome emails automatically when clients are created</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
