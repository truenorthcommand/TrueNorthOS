import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, CheckCircle2, Clock, Play, Pause, ArrowRight,
  Trash2, User, Calendar, Wrench, ChevronDown, ChevronUp,
  AlertTriangle, Loader2
} from 'lucide-react';

type Phase = {
  id: string;
  job_id: number;
  phase_number: number;
  title: string;
  description: string | null;
  trade_type: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  status: 'pending' | 'ready' | 'in_progress' | 'complete' | 'skipped';
  estimated_duration: string | null;
  depends_on: string | null;
  depends_on_title: string | null;
  depends_on_status: string | null;
  scheduled_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  sign_off_notes: string | null;
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700', icon: Clock },
  ready: { label: 'Ready', color: 'bg-blue-100 text-blue-700', icon: Play },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: Loader2 },
  complete: { label: 'Complete', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  skipped: { label: 'Skipped', color: 'bg-gray-100 text-gray-500', icon: Pause },
};

const TRADE_TYPES = [
  'Plumber', 'Electrician', 'Carpenter', 'Plasterer', 'Tiler',
  'Painter/Decorator', 'Roofer', 'Labourer', 'Works Manager', 'Other'
];

export function JobPhases({ jobId }: { jobId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [newPhase, setNewPhase] = useState({
    title: '',
    description: '',
    trade_type: '',
    estimated_duration: '',
    depends_on: '',
    scheduled_date: '',
  });

  // Fetch phases
  const { data: phases = [], isLoading } = useQuery<Phase[]>({
    queryKey: ['/api/jobs', jobId, 'phases'],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/phases`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch engineers for assignment
  const { data: engineers = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Create phase mutation
  const createPhase = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/jobs/${jobId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create phase');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'phases'] });
      setShowAddForm(false);
      setNewPhase({ title: '', description: '', trade_type: '', estimated_duration: '', depends_on: '', scheduled_date: '' });
      toast({ title: 'Phase created', description: 'New phase added to the job' });
    },
  });

  // Update phase mutation
  const updatePhase = useMutation({
    mutationFn: async ({ phaseId, data }: { phaseId: string; data: any }) => {
      const res = await fetch(`/api/jobs/${jobId}/phases/${phaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update phase');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'phases'] });
      toast({ title: 'Phase updated' });
    },
  });

  // Delete phase mutation
  const deletePhase = useMutation({
    mutationFn: async (phaseId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/phases/${phaseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete phase');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'phases'] });
      toast({ title: 'Phase deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleAddPhase = () => {
    if (!newPhase.title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    createPhase.mutate({
      title: newPhase.title,
      description: newPhase.description || null,
      trade_type: newPhase.trade_type || null,
      estimated_duration: newPhase.estimated_duration || null,
      depends_on: newPhase.depends_on || null,
      scheduled_date: newPhase.scheduled_date || null,
    });
  };

  const getNextStatus = (current: string) => {
    const flow: Record<string, string> = {
      pending: 'ready',
      ready: 'in_progress',
      in_progress: 'complete',
    };
    return flow[current] || null;
  };

  const completedCount = phases.filter(p => p.status === 'complete' || p.status === 'skipped').length;
  const progress = phases.length > 0 ? Math.round((completedCount / phases.length) * 100) : 0;

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="h-5 w-5 text-[#0F2B4C]" />
            Job Phases
            {phases.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {completedCount}/{phases.length} complete ({progress}%)
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)} className="bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white">
            <Plus className="h-4 w-4 mr-1" /> Add Phase
          </Button>
        </div>
        {/* Progress bar */}
        {phases.length > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Add Phase Form */}
        {showAddForm && (
          <Card className="border-dashed border-[#E8A54B]">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Phase Title *</Label>
                  <Input
                    placeholder="e.g. Strip-out & demolition"
                    value={newPhase.title}
                    onChange={e => setNewPhase({ ...newPhase, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Trade Type</Label>
                  <Select value={newPhase.trade_type} onValueChange={v => setNewPhase({ ...newPhase, trade_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select trade" /></SelectTrigger>
                    <SelectContent>
                      {TRADE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Estimated Duration</Label>
                  <Input
                    placeholder="e.g. 2 days"
                    value={newPhase.estimated_duration}
                    onChange={e => setNewPhase({ ...newPhase, estimated_duration: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Depends On</Label>
                  <Select value={newPhase.depends_on} onValueChange={v => setNewPhase({ ...newPhase, depends_on: v })}>
                    <SelectTrigger><SelectValue placeholder="No dependency" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No dependency</SelectItem>
                      {phases.map(p => <SelectItem key={p.id} value={p.id}>Phase {p.phase_number}: {p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Scheduled Date</Label>
                  <Input
                    type="date"
                    value={newPhase.scheduled_date}
                    onChange={e => setNewPhase({ ...newPhase, scheduled_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  placeholder="Phase description and scope of work..."
                  value={newPhase.description}
                  onChange={e => setNewPhase({ ...newPhase, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddPhase} disabled={createPhase.isPending}>
                  {createPhase.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Add Phase
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phase List */}
        {phases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No phases defined. Add phases for complex multi-trade jobs.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {phases.map((phase, idx) => {
              const config = STATUS_CONFIG[phase.status];
              const StatusIcon = config.icon;
              const isExpanded = expandedPhase === phase.id;
              const nextStatus = getNextStatus(phase.status);

              return (
                <div key={phase.id} className="border rounded-lg overflow-hidden">
                  {/* Phase Header */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                  >
                    {/* Phase number */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#0F2B4C] text-white flex items-center justify-center text-xs font-bold">
                      {phase.phase_number}
                    </div>

                    {/* Title & trade */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{phase.title}</span>
                        {phase.trade_type && (
                          <Badge variant="outline" className="text-xs">{phase.trade_type}</Badge>
                        )}
                      </div>
                      {phase.assigned_to_name && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3" /> {phase.assigned_to_name}
                        </div>
                      )}
                    </div>

                    {/* Dependency warning */}
                    {phase.status === 'pending' && phase.depends_on && (
                      <div className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Waiting on: {phase.depends_on_title}
                      </div>
                    )}

                    {/* Status badge */}
                    <Badge className={`${config.color} text-xs`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>

                    {/* Advance button */}
                    {nextStatus && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          updatePhase.mutate({ phaseId: phase.id, data: { status: nextStatus } });
                        }}
                      >
                        <ArrowRight className="h-3 w-3 mr-1" />
                        {nextStatus === 'in_progress' ? 'Start' : nextStatus === 'complete' ? 'Complete' : 'Ready'}
                      </Button>
                    )}

                    {/* Expand toggle */}
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
                      {phase.description && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Description</Label>
                          <p className="text-sm">{phase.description}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {phase.estimated_duration && (
                          <div>
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="ml-1 font-medium">{phase.estimated_duration}</span>
                          </div>
                        )}
                        {phase.scheduled_date && (
                          <div>
                            <span className="text-muted-foreground">Scheduled:</span>
                            <span className="ml-1 font-medium">{new Date(phase.scheduled_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {phase.started_at && (
                          <div>
                            <span className="text-muted-foreground">Started:</span>
                            <span className="ml-1 font-medium">{new Date(phase.started_at).toLocaleDateString()}</span>
                          </div>
                        )}
                        {phase.completed_at && (
                          <div>
                            <span className="text-muted-foreground">Completed:</span>
                            <span className="ml-1 font-medium">{new Date(phase.completed_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Assign engineer */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Assign to:</Label>
                        <Select
                          value={phase.assigned_to?.toString() || ''}
                          onValueChange={(v) => updatePhase.mutate({ phaseId: phase.id, data: { assigned_to: parseInt(v) } })}
                        >
                          <SelectTrigger className="w-48 h-8 text-xs">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            {engineers.map((eng: any) => (
                              <SelectItem key={eng.id} value={eng.id.toString()}>{eng.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        {phase.status !== 'complete' && phase.status !== 'skipped' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => updatePhase.mutate({ phaseId: phase.id, data: { status: 'skipped' } })}
                          >
                            Skip Phase
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs"
                          onClick={() => deletePhase.mutate(phase.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Connector arrow between phases */}
                  {idx < phases.length - 1 && (
                    <div className="flex justify-center -mb-1">
                      <div className="w-0.5 h-2 bg-gray-300" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
