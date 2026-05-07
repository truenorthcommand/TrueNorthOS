import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import ReactFlow, { Node, Edge, Controls, Background, addEdge, Connection, useNodesState, useEdgesState, MarkerType, Panel } from 'reactflow';
import 'reactflow/dist/style.css';
import { ArrowLeft, Save, CheckCircle, Play, Rocket, RotateCcw, History, Code, Layout, FileText, AlertTriangle, XCircle, Zap } from 'lucide-react';

const TRIGGER_TYPES = [
  { value: 'record.created', label: 'Record Created' },
  { value: 'record.updated', label: 'Record Updated' },
  { value: 'status.changed', label: 'Status Changed' },
  { value: 'date.reached', label: 'Date Reached' },
  { value: 'schedule.cron', label: 'Scheduled (Cron)' },
  { value: 'manual.run', label: 'Manual Run' },
  { value: 'webhook.received', label: 'Webhook Received' },
];

const CONDITION_TYPES = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'changed_to', label: 'Changed To' },
  { value: 'changed_from', label: 'Changed From' },
  { value: 'before_date', label: 'Before Date' },
  { value: 'after_date', label: 'After Date' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
  { value: 'record_age_gt', label: 'Record Age Greater Than' },
  { value: 'record_age_lt', label: 'Record Age Less Than' },
];

const ACTION_TYPES = [
  { value: 'create_record', label: 'Create Record', icon: '📝' },
  { value: 'update_record', label: 'Update Record', icon: '✏️' },
  { value: 'assign_owner', label: 'Assign Owner', icon: '👤' },
  { value: 'create_task', label: 'Create Task', icon: '📋' },
  { value: 'send_internal_notification', label: 'Send Notification', icon: '🔔' },
  { value: 'send_email', label: 'Send Email', icon: '📧' },
  { value: 'add_note', label: 'Add Note', icon: '📝' },
  { value: 'wait_delay', label: 'Wait / Delay', icon: '⏱️' },
  { value: 'send_webhook', label: 'Send Webhook', icon: '🌐' },
];

const MODULES = ['general', 'jobs', 'quotes', 'invoices', 'clients', 'expenses', 'timesheets', 'fleet'];

export default function WorkflowEditor() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'visual' | 'form' | 'json' | 'runs'>('visual');
  const [definition, setDefinition] = useState<any>(null);
  const [jsonText, setJsonText] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testData, setTestData] = useState('{}');
  const [showTestPanel, setShowTestPanel] = useState(false);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const { data: workflow, isLoading } = useQuery({
    queryKey: ['/api/workflows', id],
    queryFn: async () => {
      const res = await fetch(`/api/workflows/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const { data: runs = [] } = useQuery({
    queryKey: ['/api/workflows', id, 'runs'],
    queryFn: async () => {
      const res = await fetch(`/api/workflows/${id}/runs`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Initialize definition from workflow data
  useEffect(() => {
    if (workflow && !definition) {
      const def = workflow.draft?.definition || workflow.published?.definition || {
        trigger: { type: 'manual.run' },
        conditions: { op: 'and', rules: [] },
        actions: [],
        settings: { retry_policy: 'standard', timeout_seconds: 120, dry_run_supported: true }
      };
      setDefinition(def);
      setJsonText(JSON.stringify(def, null, 2));
      buildNodesFromDefinition(def);
    }
  }, [workflow]);

  // Build React Flow nodes from definition
  const buildNodesFromDefinition = useCallback((def: any) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    let y = 0;

    // Trigger node
    newNodes.push({
      id: 'trigger',
      type: 'default',
      position: { x: 250, y },
      data: { label: `🟢 TRIGGER\n${def.trigger?.type || 'Not set'}` },
      style: { background: '#d1fae5', border: '2px solid #10b981', borderRadius: '12px', padding: '12px', width: 200, textAlign: 'center' as const }
    });
    y += 120;

    // Conditions node
    if (def.conditions?.rules?.length > 0) {
      newNodes.push({
        id: 'conditions',
        type: 'default',
        position: { x: 250, y },
        data: { label: `◇ CONDITIONS\n${def.conditions.op?.toUpperCase()}: ${def.conditions.rules.length} rules` },
        style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '12px', padding: '12px', width: 200, textAlign: 'center' as const }
      });
      newEdges.push({ id: 'e-trigger-cond', source: 'trigger', target: 'conditions', markerEnd: { type: MarkerType.ArrowClosed } });
      y += 120;
    }

    // Action nodes
    const prevNode = def.conditions?.rules?.length > 0 ? 'conditions' : 'trigger';
    (def.actions || []).forEach((action: any, i: number) => {
      const nodeId = `action-${i}`;
      const actionType = ACTION_TYPES.find(a => a.value === action.type);
      newNodes.push({
        id: nodeId,
        type: 'default',
        position: { x: 250, y },
        data: { label: `${actionType?.icon || '□'} ${actionType?.label || action.type}\n${action.id || ''}` },
        style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '12px', padding: '12px', width: 200, textAlign: 'center' as const }
      });
      newEdges.push({
        id: `e-${i === 0 ? prevNode : `action-${i - 1}`}-${nodeId}`,
        source: i === 0 ? prevNode : `action-${i - 1}`,
        target: nodeId,
        markerEnd: { type: MarkerType.ArrowClosed }
      });
      y += 100;
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  // Sync definition changes
  const updateDefinition = (newDef: any) => {
    setDefinition(newDef);
    setJsonText(JSON.stringify(newDef, null, 2));
    buildNodesFromDefinition(newDef);
  };

  // Save draft
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workflows/${id}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ definition })
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/workflows', id] })
  });

  // Validate
  const validateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workflows/${id}/validate`, {
        method: 'POST',
        credentials: 'include'
      });
      return res.json();
    },
    onSuccess: (data) => {
      setValidationResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', id] });
    }
  });

  // Test
  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workflows/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sample_data: JSON.parse(testData) })
      });
      return res.json();
    },
    onSuccess: (data) => setTestResult(data)
  });

  // Publish
  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workflows/${id}/publish`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/workflows', id] })
  });

  // Rollback
  const rollbackMutation = useMutation({
    mutationFn: async (targetVersionId: string) => {
      const res = await fetch(`/api/workflows/${id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ target_version_id: targetVersionId })
      });
      if (!res.ok) throw new Error('Rollback failed');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/workflows', id] })
  });

  if (isLoading) return <div className="p-6 text-center">Loading...</div>;
  if (!workflow) return <div className="p-6 text-center">Workflow not found</div>;

  const currentStatus = workflow.draft?.status || workflow.published?.status || 'No version';

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app/system/workflows')} className="p-1.5 hover:bg-gray-100 rounded">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-bold text-[#0F2B4C]">{workflow.name}</h1>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">{workflow.key}</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{workflow.module}</span>
              <span className={`px-2 py-0.5 rounded-full ${
                currentStatus === 'published' ? 'bg-green-100 text-green-800' :
                currentStatus === 'validated' ? 'bg-blue-100 text-blue-800' :
                currentStatus === 'testing' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-600'
              }`}>{currentStatus}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => saveMutation.mutate()} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
            <Save className="h-4 w-4" /> Save
          </button>
          <button onClick={() => validateMutation.mutate()} className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm">
            <CheckCircle className="h-4 w-4" /> Validate
          </button>
          <button onClick={() => setShowTestPanel(!showTestPanel)} className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-sm">
            <Play className="h-4 w-4" /> Test
          </button>
          <button
            onClick={() => publishMutation.mutate()}
            disabled={currentStatus !== 'validated' && currentStatus !== 'testing'}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            <Rocket className="h-4 w-4" /> Publish
          </button>
        </div>
      </div>

      {/* Validation feedback */}
      {validationResult && (
        <div className={`px-4 py-2 flex items-center gap-2 text-sm ${validationResult.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {validationResult.valid ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {validationResult.valid ? 'Validation passed!' : `${validationResult.errors.length} error(s): ${validationResult.errors[0]}`}
          {validationResult.warnings?.length > 0 && (
            <span className="ml-2 text-yellow-600"><AlertTriangle className="h-3 w-3 inline" /> {validationResult.warnings.length} warning(s)</span>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-white border-b px-4 flex">
        {[
          { id: 'visual', label: 'Visual Editor', icon: Layout },
          { id: 'form', label: 'Form Editor', icon: FileText },
          { id: 'json', label: 'Raw JSON', icon: Code },
          { id: 'runs', label: `Run Logs (${runs.length})`, icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-[#E8A54B] text-[#0F2B4C] font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Main editor area */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'visual' && (
            <div className="h-full">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => setSelectedNode(node.id)}
                fitView
              >
                <Controls />
                <Background />
                <Panel position="top-left">
                  <div className="bg-white rounded-lg shadow p-3 text-xs space-y-1">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-200 border border-green-500" /> Trigger</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-yellow-200 border border-yellow-500" /> Conditions</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-200 border border-blue-500" /> Actions</div>
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          )}

          {activeTab === 'form' && definition && (
            <div className="p-6 max-w-3xl mx-auto space-y-6">
              {/* Trigger */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium text-green-700 mb-3">🟢 Trigger</h3>
                <select
                  className="w-full px-3 py-2 border rounded-lg mb-2"
                  value={definition.trigger?.type || ''}
                  onChange={e => updateDefinition({ ...definition, trigger: { ...definition.trigger, type: e.target.value } })}
                >
                  {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {definition.trigger?.type === 'status.changed' && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <input className="px-3 py-2 border rounded" placeholder="Field (e.g., status)" value={definition.trigger.field || ''}
                      onChange={e => updateDefinition({ ...definition, trigger: { ...definition.trigger, field: e.target.value } })} />
                    <input className="px-3 py-2 border rounded" placeholder="From value" value={definition.trigger.from || ''}
                      onChange={e => updateDefinition({ ...definition, trigger: { ...definition.trigger, from: e.target.value } })} />
                    <input className="px-3 py-2 border rounded" placeholder="To value" value={definition.trigger.to || ''}
                      onChange={e => updateDefinition({ ...definition, trigger: { ...definition.trigger, to: e.target.value } })} />
                  </div>
                )}
                {definition.trigger?.type === 'schedule.cron' && (
                  <input className="w-full px-3 py-2 border rounded mt-2" placeholder="Cron expression: * * * * *" value={definition.trigger.cron || ''}
                    onChange={e => updateDefinition({ ...definition, trigger: { ...definition.trigger, cron: e.target.value } })} />
                )}
              </div>

              {/* Conditions */}
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-yellow-700">◇ Conditions</h3>
                  <select className="text-sm border rounded px-2 py-1" value={definition.conditions?.op || 'and'}
                    onChange={e => updateDefinition({ ...definition, conditions: { ...definition.conditions, op: e.target.value } })}>
                    <option value="and">AND (all must match)</option>
                    <option value="or">OR (any must match)</option>
                  </select>
                </div>
                {(definition.conditions?.rules || []).map((rule: any, i: number) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select className="px-2 py-1 border rounded text-sm" value={rule.type}
                      onChange={e => {
                        const rules = [...definition.conditions.rules];
                        rules[i] = { ...rules[i], type: e.target.value };
                        updateDefinition({ ...definition, conditions: { ...definition.conditions, rules } });
                      }}>
                      {CONDITION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <input className="px-2 py-1 border rounded text-sm flex-1" placeholder="Field" value={rule.field || ''}
                      onChange={e => {
                        const rules = [...definition.conditions.rules];
                        rules[i] = { ...rules[i], field: e.target.value };
                        updateDefinition({ ...definition, conditions: { ...definition.conditions, rules } });
                      }} />
                    <input className="px-2 py-1 border rounded text-sm flex-1" placeholder="Value" value={rule.value || ''}
                      onChange={e => {
                        const rules = [...definition.conditions.rules];
                        rules[i] = { ...rules[i], value: e.target.value };
                        updateDefinition({ ...definition, conditions: { ...definition.conditions, rules } });
                      }} />
                    <button className="text-red-500 text-sm" onClick={() => {
                      const rules = definition.conditions.rules.filter((_: any, idx: number) => idx !== i);
                      updateDefinition({ ...definition, conditions: { ...definition.conditions, rules } });
                    }}>✕</button>
                  </div>
                ))}
                <button className="text-sm text-blue-600 hover:underline" onClick={() => {
                  const rules = [...(definition.conditions?.rules || []), { type: 'equals', field: '', value: '' }];
                  updateDefinition({ ...definition, conditions: { ...definition.conditions, op: definition.conditions?.op || 'and', rules } });
                }}>+ Add Condition</button>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium text-blue-700 mb-3">□ Actions</h3>
                {(definition.actions || []).map((action: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">#{i + 1}</span>
                        <select className="px-2 py-1 border rounded text-sm" value={action.type}
                          onChange={e => {
                            const actions = [...definition.actions];
                            actions[i] = { ...actions[i], type: e.target.value };
                            updateDefinition({ ...definition, actions });
                          }}>
                          {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.icon} {a.label}</option>)}
                        </select>
                      </div>
                      <button className="text-red-500 text-sm" onClick={() => {
                        const actions = definition.actions.filter((_: any, idx: number) => idx !== i);
                        updateDefinition({ ...definition, actions });
                      }}>Remove</button>
                    </div>
                    <input className="w-full px-2 py-1 border rounded text-sm mb-2" placeholder="Action ID (e.g., act_notify)" value={action.id || ''}
                      onChange={e => {
                        const actions = [...definition.actions];
                        actions[i] = { ...actions[i], id: e.target.value };
                        updateDefinition({ ...definition, actions });
                      }} />
                    <textarea className="w-full px-2 py-1 border rounded text-sm font-mono" rows={3}
                      placeholder='Params (JSON): {"title": "{{record.name}}"}'
                      value={JSON.stringify(action.params || {}, null, 2)}
                      onChange={e => {
                        try {
                          const actions = [...definition.actions];
                          actions[i] = { ...actions[i], params: JSON.parse(e.target.value) };
                          updateDefinition({ ...definition, actions });
                        } catch {}
                      }} />
                  </div>
                ))}
                <button className="text-sm text-blue-600 hover:underline" onClick={() => {
                  const actions = [...(definition.actions || []), { id: `act_${Date.now()}`, type: 'send_internal_notification', params: {} }];
                  updateDefinition({ ...definition, actions });
                }}>+ Add Action</button>
              </div>

              {/* Settings */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium text-gray-700 mb-3">⚙️ Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Retry Policy</label>
                    <select className="w-full px-3 py-2 border rounded" value={definition.settings?.retry_policy || 'standard'}
                      onChange={e => updateDefinition({ ...definition, settings: { ...definition.settings, retry_policy: e.target.value } })}>
                      <option value="standard">Standard (3 retries)</option>
                      <option value="none">No retries</option>
                      <option value="aggressive">Aggressive (5 retries)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Timeout (seconds)</label>
                    <input type="number" className="w-full px-3 py-2 border rounded" value={definition.settings?.timeout_seconds || 120}
                      onChange={e => updateDefinition({ ...definition, settings: { ...definition.settings, timeout_seconds: Number(e.target.value) } })} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm text-gray-500">Idempotency Key Template</label>
                    <input className="w-full px-3 py-2 border rounded font-mono text-sm" value={definition.settings?.idempotency_key || ''}
                      placeholder="{{record.id}}:action-name:v1"
                      onChange={e => updateDefinition({ ...definition, settings: { ...definition.settings, idempotency_key: e.target.value } })} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="p-6">
              <textarea
                className="w-full h-[calc(100vh-250px)] font-mono text-sm p-4 border rounded-lg"
                value={jsonText}
                onChange={e => {
                  setJsonText(e.target.value);
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setDefinition(parsed);
                    buildNodesFromDefinition(parsed);
                  } catch {}
                }}
              />
            </div>
          )}

          {activeTab === 'runs' && (
            <div className="p-6 max-w-4xl mx-auto">
              <h3 className="font-bold text-lg mb-4">Execution History</h3>
              {runs.length === 0 ? (
                <p className="text-gray-500">No runs yet. Publish and trigger the workflow to see execution logs.</p>
              ) : (
                <div className="space-y-2">
                  {runs.map((run: any) => (
                    <div key={run.id} className="bg-white border rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          run.status === 'completed' ? 'bg-green-500' :
                          run.status === 'failed' ? 'bg-red-500' :
                          run.status === 'running' ? 'bg-blue-500 animate-pulse' :
                          'bg-gray-300'
                        }`} />
                        <div>
                          <div className="text-sm font-medium">
                            {run.is_dry_run ? '🧪 Dry Run' : `Run`} — v{run.version_number}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(run.created_at).toLocaleString()}
                            {run.error && <span className="ml-2 text-red-500">{run.error}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          run.status === 'completed' ? 'bg-green-100 text-green-700' :
                          run.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{run.status}</span>
                        {run.status === 'failed' && (
                          <button
                            onClick={() => {
                              fetch(`/api/workflows/${id}/runs/${run.id}/replay`, { method: 'POST', credentials: 'include' })
                                .then(() => queryClient.invalidateQueries({ queryKey: ['/api/workflows', id, 'runs'] }));
                            }}
                            className="text-xs text-blue-600 hover:underline"
                          >Replay</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Test Panel (slide-in) */}
        {showTestPanel && (
          <div className="w-80 border-l bg-white p-4 overflow-auto">
            <h3 className="font-medium mb-3">🧪 Dry Run Test</h3>
            <label className="text-sm text-gray-500">Sample Data (JSON)</label>
            <textarea
              className="w-full h-32 font-mono text-xs p-2 border rounded mb-3"
              value={testData}
              onChange={e => setTestData(e.target.value)}
              placeholder='{"status": "Qualified", "owner_id": "user_1"}'
            />
            <button
              onClick={() => testMutation.mutate()}
              className="w-full px-3 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600"
            >
              Run Dry Test
            </button>
            {testResult && (
              <div className="mt-4 space-y-2">
                <div className={`text-sm font-medium ${testResult.conditions_met ? 'text-green-600' : 'text-red-600'}`}>
                  Conditions: {testResult.conditions_met ? '✓ Met' : '✗ Not Met'}
                </div>
                {testResult.steps?.map((step: any, i: number) => (
                  <div key={i} className="text-xs bg-gray-50 p-2 rounded">
                    <div className="font-medium">{step.step === 'action' ? `${step.order}. ${step.type}` : step.step}</div>
                    <div className="text-gray-500 mt-0.5">{step.description || step.reason || ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Version History Panel */}
      {workflow.versions?.length > 1 && (
        <div className="bg-gray-50 border-t px-4 py-2 flex items-center gap-4 text-xs overflow-x-auto">
          <span className="text-gray-500 whitespace-nowrap">Versions:</span>
          {workflow.versions.map((v: any) => (
            <button
              key={v.id}
              onClick={() => {
                if (v.status !== 'draft' && confirm(`Rollback to v${v.version_number}?`)) {
                  rollbackMutation.mutate(v.id);
                }
              }}
              className={`px-2 py-1 rounded whitespace-nowrap ${
                v.id === workflow.current_version_id ? 'bg-green-100 text-green-700 font-medium' :
                v.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                'bg-white border hover:bg-blue-50 text-gray-700'
              }`}
            >
              v{v.version_number} ({v.status})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
