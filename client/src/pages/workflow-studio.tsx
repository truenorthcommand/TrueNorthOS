import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ArrowLeft, Plus, Play, Pause, Trash2, Copy, Clock, CheckCircle, XCircle, AlertTriangle, Zap } from 'lucide-react';

interface Workflow {
  id: string;
  key: string;
  name: string;
  description: string;
  module: string;
  enabled: boolean;
  current_version_id: string | null;
  current_version_number: number | null;
  version_status: string | null;
  total_runs: number;
  failed_runs: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function WorkflowStudio() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ key: '', name: '', description: '', module: 'general' });

  const { data: workflows = [], isLoading } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows'],
    queryFn: async () => {
      const res = await fetch('/api/workflows', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch workflows');
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newWorkflow) => {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      setShowCreate(false);
      setNewWorkflow({ key: '', name: '', description: '', module: 'general' });
      navigate(`/app/system/workflows/${data.id}`);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled })
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/workflows'] })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/workflows'] })
  });

  const modules = ['general', 'jobs', 'quotes', 'invoices', 'clients', 'expenses', 'timesheets', 'fleet'];

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'validated': return 'bg-blue-100 text-blue-800';
      case 'testing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-amber-500" />
            <h1 className="text-2xl font-bold text-[#0F2B4C]">Workflow Studio</h1>
          </div>
          <p className="text-gray-500 mt-1">Design, test, and publish lightweight automations</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0F2B4C] text-white rounded-lg hover:bg-[#1a3d66] transition-colors"
        >
          <Plus className="h-4 w-4" /> New Workflow
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-[#0F2B4C]">{workflows.length}</div>
          <div className="text-sm text-gray-500">Total Workflows</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-green-600">{workflows.filter(w => w.enabled).length}</div>
          <div className="text-sm text-gray-500">Active</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-blue-600">{workflows.reduce((sum, w) => sum + Number(w.total_runs || 0), 0)}</div>
          <div className="text-sm text-gray-500">Total Runs</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-red-600">{workflows.reduce((sum, w) => sum + Number(w.failed_runs || 0), 0)}</div>
          <div className="text-sm text-gray-500">Failed Runs</div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Create New Workflow</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Key (unique identifier)</label>
                <input
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., job-completed-notification"
                  value={newWorkflow.key}
                  onChange={e => setNewWorkflow({ ...newWorkflow, key: e.target.value.replace(/[^a-z0-9-]/g, '') })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Job Completed Notification"
                  value={newWorkflow.name}
                  onChange={e => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="What does this workflow do?"
                  value={newWorkflow.description}
                  onChange={e => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Module</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newWorkflow.module}
                  onChange={e => setNewWorkflow({ ...newWorkflow, module: e.target.value })}
                >
                  {modules.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button
                onClick={() => createMutation.mutate(newWorkflow)}
                disabled={!newWorkflow.key || !newWorkflow.name}
                className="px-4 py-2 bg-[#0F2B4C] text-white rounded-lg disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-12">
          <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600">No workflows yet</h3>
          <p className="text-gray-400 mt-1">Create your first automation workflow</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map(wf => (
            <div
              key={wf.id}
              className="bg-white rounded-lg border hover:border-[#E8A54B] transition-colors cursor-pointer"
              onClick={() => navigate(`/app/system/workflows/${wf.id}`)}
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${wf.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#0F2B4C]">{wf.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(wf.version_status)}`}>
                        {wf.version_status || 'No version'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {wf.module}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {wf.description || wf.key}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Play className="h-3 w-3" />
                      {wf.total_runs || 0} runs
                    </div>
                    {Number(wf.failed_runs) > 0 && (
                      <div className="flex items-center gap-1 text-red-500">
                        <XCircle className="h-3 w-3" />
                        {wf.failed_runs} failed
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleMutation.mutate({ id: wf.id, enabled: !wf.enabled })}
                      className={`p-1.5 rounded ${wf.enabled ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                      title={wf.enabled ? 'Disable' : 'Enable'}
                    >
                      {wf.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this workflow?')) deleteMutation.mutate(wf.id); }}
                      className="p-1.5 rounded text-red-400 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
