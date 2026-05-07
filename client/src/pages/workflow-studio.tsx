import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Zap, Plus, Trash2, Play, Pause, AlertCircle, CheckCircle2, Clock, ArrowRight, X, Loader2, Activity, RotateCcw } from "lucide-react";

// Trigger options with human-readable labels
const TRIGGER_OPTIONS = [
  { value: 'record.created', label: 'When a record is created', icon: '📝' },
  { value: 'record.updated', label: 'When a record is updated', icon: '✏️' },
  { value: 'status.changed', label: 'When status changes', icon: '🔄' },
  { value: 'date.reached', label: 'When a date is reached', icon: '📅' },
  { value: 'schedule.cron', label: 'On a schedule', icon: '⏰' },
  { value: 'manual.run', label: 'When I trigger it manually', icon: '👆' },
];

// Module options
const MODULE_OPTIONS = [
  { value: 'jobs', label: 'Jobs' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'clients', label: 'Clients' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'timesheets', label: 'Timesheets' },
  { value: 'fleet', label: 'Fleet' },
  { value: 'general', label: 'General' },
];

// Action options with human-readable labels
const ACTION_OPTIONS = [
  { value: 'send_internal_notification', label: 'Send a notification', icon: '🔔' },
  { value: 'send_email', label: 'Send an email', icon: '📧' },
  { value: 'create_task', label: 'Create a task', icon: '✅' },
  { value: 'update_record', label: 'Update a record', icon: '📝' },
  { value: 'create_record', label: 'Create a record', icon: '➕' },
  { value: 'assign_owner', label: 'Assign to someone', icon: '👤' },
  { value: 'add_note', label: 'Add a note', icon: '📋' },
  { value: 'send_webhook', label: 'Send webhook', icon: '🌐' },
];

// Status change options
const STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Ready', label: 'Ready' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Complete', label: 'Complete' },
  { value: 'Signed Off', label: 'Signed Off' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Overdue', label: 'Overdue' },
];

export default function WorkflowStudio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    module: 'jobs',
    triggerType: '',
    statusTo: '',
    actionType: '',
    actionDetail: '',
  });

  // Access control
  if (!user?.superAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Access denied</div>;
  }

  // Fetch workflows
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['/api/workflows'],
    queryFn: async () => {
      const res = await fetch('/api/workflows', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Toggle workflow enabled/disabled
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
    },
  });

  // Delete workflow
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({ title: 'Rule deleted' });
    },
  });

  // Create workflow
  const createMutation = useMutation({
    mutationFn: async () => {
      const key = newRule.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const trigger: any = { type: newRule.triggerType };
      if (newRule.triggerType === 'status.changed') {
        trigger.field = 'status';
        trigger.to = newRule.statusTo;
      }

      const actions: any[] = [{
        id: `act_${Date.now()}`,
        type: newRule.actionType,
        params: getActionParams(newRule.actionType, newRule.actionDetail),
      }];

      const definition = {
        trigger,
        conditions: { op: 'and', rules: [] },
        actions,
        settings: {
          retry_policy: 'standard',
          idempotency_key: `${key}:{{record.id}}:v1`,
          timeout_seconds: 120,
          dry_run_supported: true,
        },
      };

      // Create the workflow
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          key,
          name: newRule.name,
          description: `${getTriggerLabel(newRule.triggerType)} → ${getActionLabel(newRule.actionType)}`,
          module: newRule.module,
          definition,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create');
      }
      const workflow = await res.json();

      // Auto-validate
      await fetch(`/api/workflows/${workflow.id}/validate`, {
        method: 'POST',
        credentials: 'include',
      });

      // Auto-publish
      await fetch(`/api/workflows/${workflow.id}/publish`, {
        method: 'POST',
        credentials: 'include',
      });

      return workflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({ title: 'Rule created & activated! ✅' });
      setShowCreate(false);
      setNewRule({ name: '', module: 'jobs', triggerType: '', statusTo: '', actionType: '', actionDetail: '' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Manual run
  const runMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/workflows/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data: {} }),
      });
      if (!res.ok) throw new Error('Failed to run');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Rule triggered! ⚡' });
    },
  });

  function getActionParams(actionType: string, detail: string): any {
    switch (actionType) {
      case 'send_internal_notification':
        return { user_id: '{{record.owner_id}}', title: detail || 'Automation alert', message: detail || 'A workflow rule was triggered.' };
      case 'send_email':
        return { to: '{{record.email}}', subject: detail || 'Notification', body: detail || 'An automated notification.' };
      case 'create_task':
        return { title: detail || 'Follow up', due_in_hours: 24, assign_to: '{{record.owner_id}}', priority: 'medium' };
      case 'update_record':
        return { field: 'status', value: detail || 'Updated' };
      case 'create_record':
        return { module: 'tasks', title: detail || 'New record' };
      case 'assign_owner':
        return { owner_id: detail || '{{record.owner_id}}' };
      case 'add_note':
        return { content: detail || 'Automated note added by workflow.' };
      case 'send_webhook':
        return { url: detail || 'https://example.com/webhook', method: 'POST' };
      default:
        return {};
    }
  }

  function getTriggerLabel(type: string): string {
    return TRIGGER_OPTIONS.find(t => t.value === type)?.label || type;
  }

  function getActionLabel(type: string): string {
    return ACTION_OPTIONS.find(a => a.value === type)?.label || type;
  }

  function getTriggerIcon(type: string): string {
    return TRIGGER_OPTIONS.find(t => t.value === type)?.icon || '⚡';
  }

  function getActionIcon(type: string): string {
    return ACTION_OPTIONS.find(a => a.value === type)?.icon || '▶️';
  }

  const getStatusColor = (wf: any) => {
    if (!wf.enabled) return 'bg-gray-100 border-gray-200';
    if (wf.failed_runs > 0) return 'bg-red-50 border-red-200';
    return 'bg-white border-green-200';
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="w-7 h-7 text-amber-500" />
            Automation Rules
          </h1>
          <p className="text-muted-foreground mt-1">Simple IF → THEN rules that run automatically</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-amber-500 hover:bg-amber-600">
          <Plus className="w-4 h-4 mr-2" />
          New Rule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-700">{workflows.filter((w: any) => w.enabled).length}</p>
              <p className="text-xs text-green-600">Active Rules</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Pause className="w-8 h-8 text-gray-500" />
            <div>
              <p className="text-2xl font-bold text-gray-700">{workflows.filter((w: any) => !w.enabled).length}</p>
              <p className="text-xs text-gray-500">Paused</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-700">{workflows.reduce((sum: number, w: any) => sum + (Number(w.total_runs) || 0), 0)}</p>
              <p className="text-xs text-blue-600">Total Runs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Rule Panel */}
      {showCreate && (
        <Card className="border-2 border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Rule
              </span>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
            <CardDescription>Set up a simple automation in 3 steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Step 1: Name & Module */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-amber-800">1. Name this rule</Label>
              <Input
                placeholder="e.g. Notify when job is complete"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Module</Label>
                  <Select value={newRule.module} onValueChange={(v) => setNewRule({ ...newRule, module: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODULE_OPTIONS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Step 2: Trigger */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-amber-800">2. WHEN does this trigger?</Label>
              <Select value={newRule.triggerType} onValueChange={(v) => setNewRule({ ...newRule, triggerType: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a trigger..." /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newRule.triggerType === 'status.changed' && (
                <div>
                  <Label className="text-xs text-muted-foreground">Changes to which status?</Label>
                  <Select value={newRule.statusTo} onValueChange={(v) => setNewRule({ ...newRule, statusTo: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick status..." /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Step 3: Action */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-amber-800">3. THEN what should happen?</Label>
              <Select value={newRule.actionType} onValueChange={(v) => setNewRule({ ...newRule, actionType: v })}>
                <SelectTrigger><SelectValue placeholder="Pick an action..." /></SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.icon} {a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newRule.actionType && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {newRule.actionType === 'send_internal_notification' && 'Notification message'}
                    {newRule.actionType === 'send_email' && 'Email subject'}
                    {newRule.actionType === 'create_task' && 'Task title'}
                    {newRule.actionType === 'update_record' && 'New value'}
                    {newRule.actionType === 'add_note' && 'Note content'}
                    {newRule.actionType === 'send_webhook' && 'Webhook URL'}
                    {!['send_internal_notification', 'send_email', 'create_task', 'update_record', 'add_note', 'send_webhook'].includes(newRule.actionType) && 'Details'}
                  </Label>
                  <Input
                    placeholder="Enter details..."
                    value={newRule.actionDetail}
                    onChange={(e) => setNewRule({ ...newRule, actionDetail: e.target.value })}
                  />
                </div>
              )}
            </div>

            {/* Create Button */}
            <div className="flex gap-3 pt-3 border-t">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newRule.name || !newRule.triggerType || !newRule.actionType || createMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 flex-1"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Create & Activate Rule
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : workflows.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-12 text-center">
            <Zap className="w-12 h-12 text-amber-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No automation rules yet</h3>
            <p className="text-muted-foreground mb-4">Create your first rule to start automating tasks</p>
            <Button onClick={() => setShowCreate(true)} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf: any) => {
            const version = wf.version_status;
            const triggerType = wf.current_version_id ? 'published' : 'draft';
            
            // Try to get trigger/action info from description or name
            const description = wf.description || '';

            return (
              <Card key={wf.id} className={`transition-all ${getStatusColor(wf)} ${!wf.enabled ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-base">{wf.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {wf.module}
                        </Badge>
                        {wf.enabled ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500 text-xs">Paused</Badge>
                        )}
                        {Number(wf.failed_runs) > 0 && (
                          <Badge className="bg-red-100 text-red-700 text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {wf.failed_runs} failed
                          </Badge>
                        )}
                      </div>
                      {description && (
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                          <ArrowRight className="w-3 h-3" />
                          {description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {wf.total_runs > 0 && (
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {wf.total_runs} runs
                          </span>
                        )}
                        {wf.last_run_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last: {new Date(wf.last_run_at).toLocaleDateString()}
                          </span>
                        )}
                        {wf.current_version_number && (
                          <span>v{wf.current_version_number}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Manual Run */}
                      {wf.enabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => runMutation.mutate(wf.id)}
                          title="Run now"
                        >
                          <Play className="w-4 h-4 text-green-600" />
                        </Button>
                      )}

                      {/* Toggle ON/OFF */}
                      <Switch
                        checked={wf.enabled}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: wf.id, enabled: checked })}
                      />

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete rule "${wf.name}"?`)) {
                            deleteMutation.mutate(wf.id);
                          }
                        }}
                        title="Delete rule"
                      >
                        <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer Note */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-700 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            <strong>Need complex automations?</strong> Ask Agent Zero to build advanced workflows for you — multi-step sequences, conditional logic, integrations, and more.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
