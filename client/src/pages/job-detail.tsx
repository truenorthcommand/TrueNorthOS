import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ActionPriority, JobUpdate, Photo, hasRole } from '@/lib/types';
import { useUpload } from '@/hooks/use-upload';
import { generateTrueNorthCode } from '@/lib/qr-utils';
import { JobChecklist } from '@/components/job-checklist';
import type { FileWithRelations } from '@shared/schema';
import QRCode from 'qrcode';
import {
  ArrowLeft, Save, Trash2, Plus, MapPin, Calendar, Clock, User, Users,
  FileText, Image, Upload, X, Printer, AlertTriangle, Shield, CheckCircle2,
  XCircle, Loader2, ClipboardCheck, Sparkles, Edit, Package, Camera,
  ChevronDown, File, FileSpreadsheet, ExternalLink, QrCode
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

// --- Utility functions (outside component) ---

function getStatusColor(status: string): string {
  switch (status) {
    case 'Draft': return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'Ready': return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'Awaiting Signatures': return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'Signed Off': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'On Hold': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'Cancelled': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'low': return 'bg-green-100 text-green-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'urgent': case 'emergency': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5 text-muted-foreground" />;
  if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />;
  if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_OPTIONS = ['Draft', 'Ready', 'In Progress', 'Awaiting Signatures', 'Signed Off', 'On Hold', 'Cancelled'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const SESSION_OPTIONS = ['AM', 'PM', 'Full Day'];

// --- Main Component ---

export default function JobDetail() {
  const { user } = useAuth();
  const [match, params] = useRoute('/jobs/:id');
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { getJob, updateJob, addMaterial, removeMaterial, addPhoto, removePhoto, deleteJob, refreshJobs, isLoading } = useStore();
  const { toast } = useToast();

  // Refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core state
  const [activeTab, setActiveTab] = useState('details');
  const [hasTriedRefresh, setHasTriedRefresh] = useState(false);
  const [jobNotFound, setJobNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nickname: '', description: '', notes: '', worksCompleted: '',
    date: '', session: 'AM', address: '', postcode: '',
    customerName: '', client: '', contactName: '', contactPhone: '', contactEmail: '',
    propertyName: '', isLongRunning: false, orderNumber: null as number | null,
  });

  // Materials state
  const [newMaterial, setNewMaterial] = useState({ name: '', quantity: '' });

  // Actions/Updates state
  const [actionDescription, setActionDescription] = useState('');
  const [actionPriority, setActionPriority] = useState<ActionPriority>('medium');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Engineers state
  const [engineers, setEngineers] = useState<{ id: string; name: string }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{
    engineerId: string; engineerName: string; score: number; reason: string;
    matchedSkills?: string[]; skills: string[]; nextAvailability?: string; isAvailableToday?: boolean;
  }>>([]);
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);

  // Photo upload state
  const [uploadingPhotos, setUploadingPhotos] = useState<string[]>([]);

  // File upload state
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  // Sign-off state
  const [qualityError, setQualityError] = useState<any | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  // Daily updates state (for long-running jobs)
  const [allUpdates, setAllUpdates] = useState<JobUpdate[]>([]);
  const [todayUpdates, setTodayUpdates] = useState<{ count: number; remaining: number; updates: JobUpdate[] }>({ count: 0, remaining: 2, updates: [] });
  const [updateNotes, setUpdateNotes] = useState('');
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);

  const jobId = params?.id;
  const job = jobId ? getJob(jobId) : undefined;

  // Files query
  const { data: jobFiles = [], isLoading: isLoadingFiles } = useQuery<FileWithRelations[]>({
    queryKey: [`/api/jobs/${jobId}/files`],
    enabled: !!jobId,
  });

  // Blocking exceptions
  const { data: blockingExceptions = [] } = useQuery<Array<{ id: string; title: string; message?: string | null; severity: string }>>({
    queryKey: [`/api/jobs/${jobId}/blocking-exceptions`],
    enabled: !!jobId,
  });

  // File upload hook
  const { uploadFile: uploadJobFile, isUploading: isUploadingFile } = useUpload({
    onSuccess: async (response) => {
      await createFileMutation.mutateAsync({
        name: uploadingFile?.name || 'Uploaded file',
        objectPath: response.objectPath,
        mimeType: uploadingFile?.type || null,
        size: uploadingFile?.size || null,
        jobId: jobId,
      });
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });

  const createFileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/files', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/files`] });
      toast({ title: 'File uploaded successfully' });
      setUploadingFile(null);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to save file', description: error.message, variant: 'destructive' });
    },
  });

  const completeJobMutation = useMutation({
    mutationFn: async (opts?: { override?: boolean; overrideReason?: string }) => {
      const res = await fetch(`/api/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(opts ?? {}),
      });
      if (res.ok) return res.json();
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw { status: res.status, ...data };
    },
    onSuccess: () => {
      setQualityError(null);
      refreshJobs();
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/blocking-exceptions`] });
      toast({ title: 'Job completed', description: 'Quality Gate passed — job marked as Completed.' });
    },
    onError: (err: any) => {
      if (err.error === 'QUALITY_GATE_FAILED' || err.error === 'QUALITY_GATE_CAN_OVERRIDE') {
        setQualityError(err);
        return;
      }
      toast({ title: 'Cannot complete job', description: err.error || err.message || 'Something went wrong', variant: 'destructive' });
    },
  });

  // Fetch engineers
  useEffect(() => {
    if (hasRole(user, 'admin', 'works_manager')) {
      fetch('/api/users', { credentials: 'include' })
        .then(res => res.json())
        .then(data => setEngineers(data.map((u: any) => ({ id: u.id, name: u.name }))))
        .catch(() => {});
    }
  }, [user]);

  // Refresh jobs if job not found
  useEffect(() => {
    if (jobId && !job && !isLoading && !hasTriedRefresh) {
      setHasTriedRefresh(true);
      refreshJobs();
    }
  }, [jobId, job, isLoading, hasTriedRefresh, refreshJobs]);

  useEffect(() => {
    if (hasTriedRefresh && !isLoading && !job) setJobNotFound(true);
  }, [hasTriedRefresh, isLoading, job]);

  // Init form data from job
  useEffect(() => {
    if (job) {
      setFormData({
        nickname: job.nickname || '',
        description: job.description || '',
        notes: job.notes || '',
        worksCompleted: job.worksCompleted || '',
        date: job.date ? format(new Date(job.date), 'yyyy-MM-dd') : '',
        session: job.session || 'AM',
        address: job.address || '',
        postcode: job.postcode || '',
        customerName: job.customerName || '',
        client: job.client || '',
        contactName: job.contactName || '',
        contactPhone: job.contactPhone || '',
        contactEmail: job.contactEmail || '',
        propertyName: job.propertyName || '',
        isLongRunning: job.isLongRunning || false,
        orderNumber: job.orderNumber,
      });
      setHasUnsavedChanges(false);
    }
  }, [job?.id]);

  // Fetch updates for long-running jobs
  useEffect(() => {
    if (job?.isLongRunning && job.id) {
      fetchUpdates(job.id);
    }
  }, [job?.id, job?.isLongRunning]);

  const fetchUpdates = async (id: string) => {
    try {
      const [todayRes, allRes] = await Promise.all([
        fetch(`/api/jobs/${id}/updates/today`, { credentials: 'include' }),
        fetch(`/api/jobs/${id}/updates`, { credentials: 'include' }),
      ]);
      if (todayRes.ok) setTodayUpdates(await todayRes.json());
      if (allRes.ok) setAllUpdates(await allRes.json());
    } catch (e) { console.error('Failed to fetch updates:', e); }
  };

  // Handlers
  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!job) return;
    setSaving(true);
    try {
      await updateJob(job.id, {
        nickname: formData.nickname || null,
        description: formData.description || null,
        notes: formData.notes || null,
        worksCompleted: formData.worksCompleted || null,
        date: formData.date ? new Date(formData.date).toISOString() : null,
        session: formData.session,
        address: formData.address || null,
        postcode: formData.postcode || null,
        customerName: formData.customerName,
        client: formData.client || null,
        contactName: formData.contactName || null,
        contactPhone: formData.contactPhone || null,
        contactEmail: formData.contactEmail || null,
        propertyName: formData.propertyName || null,
        isLongRunning: formData.isLongRunning,
        orderNumber: formData.orderNumber,
      });
      setHasUnsavedChanges(false);
      toast({ title: 'Job saved', description: 'All changes have been saved.' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message || 'Could not save job.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;
    try {
      await updateJob(job.id, { status: newStatus as any });
      toast({ title: 'Status updated', description: `Job status changed to ${newStatus}.` });
    } catch (e: any) {
      toast({ title: 'Status update failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!job) return;
    try {
      await deleteJob(job.id);
      toast({ title: 'Job deleted' });
      navigate('/jobs');
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
    setDeleteDialogOpen(false);
  };

  const handleAddMaterial = async () => {
    if (!job || !newMaterial.name.trim()) return;
    await addMaterial(job.id, { name: newMaterial.name.trim(), quantity: newMaterial.quantity || '1' });
    setNewMaterial({ name: '', quantity: '' });
    toast({ title: 'Material added' });
  };

  const handleRemoveMaterial = async (materialId: string) => {
    if (!job) return;
    await removeMaterial(job.id, materialId);
    toast({ title: 'Material removed' });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !job) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempId = `upload_${Date.now()}_${i}`;
      setUploadingPhotos(prev => [...prev, tempId]);
      try {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: formDataUpload });
        if (res.ok) {
          const { url } = await res.json();
          await addPhoto(job.id, url, hasRole(user, 'admin') ? 'admin' : 'engineer');
        }
      } catch (err) {
        toast({ title: 'Photo upload failed', variant: 'destructive' });
      } finally {
        setUploadingPhotos(prev => prev.filter(id => id !== tempId));
      }
    }
    e.target.value = '';
  };

  const handleRemovePhoto = async (photoId: string) => {
    if (!job) return;
    await removePhoto(job.id, photoId);
    toast({ title: 'Photo removed' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingFile(file);
      await uploadJobFile(file);
      e.target.value = '';
    }
  };

  const handleAddAction = async () => {
    if (!job || !actionDescription.trim()) return;
    setSubmittingAction(true);
    try {
      await fetch(`/api/jobs/${job.id}/further-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ description: actionDescription.trim(), priority: actionPriority }),
      });
      setActionDescription('');
      setActionPriority('medium');
      await refreshJobs();
      toast({ title: 'Action added' });
    } catch (e: any) {
      toast({ title: 'Failed to add action', description: e.message, variant: 'destructive' });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSubmitDailyUpdate = async () => {
    if (!job || !updateNotes.trim()) return;
    setIsSubmittingUpdate(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes: updateNotes.trim() }),
      });
      if (res.ok) {
        setUpdateNotes('');
        await fetchUpdates(job.id);
        toast({ title: 'Update submitted' });
      }
    } catch (e) {
      toast({ title: 'Failed to submit update', variant: 'destructive' });
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const handleAssignEngineer = async (engineerId: string) => {
    if (!job) return;
    try {
      await updateJob(job.id, { assignedToId: engineerId, assignedToIds: [engineerId] });
      toast({ title: 'Engineer assigned' });
    } catch (e: any) {
      toast({ title: 'Assignment failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleSuggestEngineers = async () => {
    if (!job) return;
    setSuggestDialogOpen(true);
    setSuggestionsLoading(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/suggest-engineers`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      toast({ title: 'Failed to get suggestions', variant: 'destructive' });
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!job) return;
    const code = generateTrueNorthCode('job', job.id);
    const url = await QRCode.toDataURL(code, { width: 256, margin: 2 });
    setQrCodeDataUrl(url);
    setQrDialogOpen(true);
  };

  const handleCompleteJob = async () => {
    if (uploadingPhotos.length > 0) {
      toast({ title: 'Photos still uploading', description: 'Wait for uploads to finish.', variant: 'destructive' });
      return;
    }
    if (hasUnsavedChanges) await handleSave();
    completeJobMutation.mutate({});
  };

  const handleOverrideComplete = (reason: string) => {
    completeJobMutation.mutate({ override: true, overrideReason: reason });
  };

  // Loading state
  if (!job) {
    if (isLoading || (!jobNotFound && jobId)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading job...</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold mb-4">Job Not Found</h2>
        <Button onClick={() => navigate('/jobs')}>Return to Jobs</Button>
      </div>
    );
  }

  const isAdmin = hasRole(user, 'admin', 'works_manager');
  const assignedEngineer = engineers.find(e => e.id === job.assignedToId);

  // --- Render functions ---

  function renderHeader() {
    return (
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{job.jobNo}</h1>
                <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                {job.orderNumber != null && (
                  <Badge variant="outline" className={getPriorityColor(
                    job.furtherActions?.some(a => a.priority === 'urgent') ? 'urgent' :
                    job.furtherActions?.some(a => a.priority === 'high') ? 'high' : 'medium'
                  )}>
                    {job.furtherActions?.some(a => a.priority === 'urgent') ? 'Emergency' :
                     job.furtherActions?.some(a => a.priority === 'high') ? 'High' : 'Medium'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {job.customerName}{job.nickname ? ` — ${job.nickname}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={job.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleGenerateQR}>
              <QrCode className="h-4 w-4 mr-1" /> QR
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !hasUnsavedChanges}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
            {isAdmin && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderTabDetails() {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Client & Site</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Client / Customer</Label>
              <Input value={formData.customerName} onChange={e => handleFieldChange('customerName', e.target.value)} />
            </div>
            <div>
              <Label>Site Address</Label>
              <Input value={formData.address} onChange={e => handleFieldChange('address', e.target.value)} placeholder="Site address" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Postcode</Label>
                <Input value={formData.postcode} onChange={e => handleFieldChange('postcode', e.target.value)} />
              </div>
              <div>
                <Label>Property</Label>
                <Input value={formData.propertyName} onChange={e => handleFieldChange('propertyName', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Contact Name</Label>
              <Input value={formData.contactName} onChange={e => handleFieldChange('contactName', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={formData.contactPhone} onChange={e => handleFieldChange('contactPhone', e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={formData.contactEmail} onChange={e => handleFieldChange('contactEmail', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Job Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Job Title / Nickname</Label>
              <Input value={formData.nickname} onChange={e => handleFieldChange('nickname', e.target.value)} placeholder="e.g. Kitchen refit" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={e => handleFieldChange('description', e.target.value)} rows={4} />
            </div>
            <div>
              <Label>Order Number</Label>
              <Input type="number" value={formData.orderNumber ?? ''} onChange={e => handleFieldChange('orderNumber', e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formData.isLongRunning} onCheckedChange={v => handleFieldChange('isLongRunning', v)} id="long-running" />
              <Label htmlFor="long-running">Long-running job</Label>
            </div>
            <div>
              <Label>Access / H&S Notes</Label>
              <Textarea value={formData.notes} onChange={e => handleFieldChange('notes', e.target.value)} rows={3} placeholder="Access instructions, hazards, etc." />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderTabSchedule() {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Scheduled Date</Label>
              <Input type="date" value={formData.date} onChange={e => handleFieldChange('date', e.target.value)} />
            </div>
            <div>
              <Label>Session</Label>
              <Select value={formData.session} onValueChange={v => handleFieldChange('session', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {job.createdAt && (
              <div className="pt-4 border-t space-y-2">
                <p className="text-sm"><span className="text-muted-foreground">Created:</span> {format(new Date(job.createdAt), 'dd MMM yyyy HH:mm')}</p>
                {job.updatedAt && <p className="text-sm"><span className="text-muted-foreground">Last updated:</span> {format(new Date(job.updatedAt), 'dd MMM yyyy HH:mm')}</p>}
                {job.signOffTimestamp && <p className="text-sm"><span className="text-muted-foreground">Signed off:</span> {format(new Date(job.signOffTimestamp), 'dd MMM yyyy HH:mm')}</p>}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Assigned Engineers</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isAdmin && (
              <>
                <Select value={job.assignedToId || ''} onValueChange={handleAssignEngineer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign an engineer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {engineers.map(eng => (
                      <SelectItem key={eng.id} value={eng.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" /> {eng.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleSuggestEngineers}>
                  <Sparkles className="h-4 w-4 mr-1" /> AI Suggest
                </Button>
              </>
            )}
            {assignedEngineer && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium">{assignedEngineer.name}</span>
              </div>
            )}
            {!assignedEngineer && job.assignedToIds?.length === 0 && (
              <p className="text-sm text-muted-foreground">No engineer assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderTabMaterials() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-5 w-5" /> Materials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {job.materials.length > 0 ? (
            <div className="divide-y">
              {job.materials.map(mat => (
                <div key={mat.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium">{mat.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">× {mat.quantity}</span>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveMaterial(mat.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No materials recorded.</p>
          )}
          <div className="flex gap-2 items-end border-t pt-4">
            <div className="flex-1">
              <Label>Material Name</Label>
              <Input value={newMaterial.name} onChange={e => setNewMaterial(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Copper pipe 15mm" />
            </div>
            <div className="w-24">
              <Label>Qty</Label>
              <Input value={newMaterial.quantity} onChange={e => setNewMaterial(p => ({ ...p, quantity: e.target.value }))} placeholder="1" />
            </div>
            <Button onClick={handleAddMaterial} disabled={!newMaterial.name.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderTabPhotos() {
    const images = job.photos || [];
    const docs = jobFiles.filter(f => !f.mimeType?.startsWith('image/'));
    const imageFiles = jobFiles.filter(f => f.mimeType?.startsWith('image/'));

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-5 w-5" /> Photos ({images.length + imageFiles.length})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => photoInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Upload
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            {images.length > 0 || imageFiles.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map(photo => (
                  <div key={photo.id} className="relative group rounded-lg overflow-hidden border aspect-square">
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                    <Button
                      variant="destructive" size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition"
                      onClick={() => handleRemovePhoto(photo.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">
                      {photo.source}
                    </span>
                  </div>
                ))}
                {imageFiles.map(f => (
                  <div key={f.id} className="relative rounded-lg overflow-hidden border aspect-square">
                    <img src={`/api/files/${f.id}/download`} alt={f.name} className="w-full h-full object-cover" />
                  </div>
                ))}
                {uploadingPhotos.map(id => (
                  <div key={id} className="flex items-center justify-center border rounded-lg aspect-square bg-muted">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5" /> Documents ({docs.length})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploadingFile}>
                {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Upload
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            {docs.length > 0 ? (
              <div className="divide-y">
                {docs.map(f => (
                  <div key={f.id} className="flex items-center gap-3 py-2">
                    {getFileIcon(f.mimeType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                    </div>
                    <a href={`/api/files/${f.id}/download`} target="_blank" rel="noopener">
                      <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderTabActions() {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Add Action / Update</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Description</Label>
              <Textarea value={actionDescription} onChange={e => setActionDescription(e.target.value)} rows={3} placeholder="Describe the update or action needed..." />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={actionPriority} onValueChange={v => setActionPriority(v as ActionPriority)}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1" />
              <Button onClick={handleAddAction} disabled={submittingAction || !actionDescription.trim()} className="mt-5">
                {submittingAction ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Add Action
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Action Timeline</CardTitle></CardHeader>
          <CardContent>
            {job.furtherActions.length > 0 ? (
              <div className="space-y-3">
                {[...job.furtherActions].reverse().map(action => (
                  <div key={action.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                      action.priority === 'urgent' ? 'text-red-500' :
                      action.priority === 'high' ? 'text-orange-500' :
                      action.priority === 'medium' ? 'text-yellow-500' : 'text-green-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm">{action.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={getPriorityColor(action.priority)}>
                          {action.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(action.timestamp), 'dd MMM yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No actions or updates yet.</p>
            )}
          </CardContent>
        </Card>

        {formData.isLongRunning && (
          <Card>
            <CardHeader><CardTitle className="text-base">Daily Updates</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea value={updateNotes} onChange={e => setUpdateNotes(e.target.value)} rows={2} placeholder="Today's progress notes..." className="flex-1" />
                <Button onClick={handleSubmitDailyUpdate} disabled={isSubmittingUpdate || !updateNotes.trim()} className="self-end">
                  {isSubmittingUpdate ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
                </Button>
              </div>
              {allUpdates.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  {allUpdates.map(upd => (
                    <div key={upd.id} className="p-2 bg-muted/50 rounded text-sm">
                      <p>{upd.notes}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(upd.createdAt), 'dd MMM yyyy HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderTabSignOff() {
    const hasPhotos = (job.photos?.length || 0) > 0;
    const hasSignatures = (job.signatures?.length || 0) > 0;
    const hasMaterials = (job.materials?.length || 0) > 0;
    const hasNotes = !!job.worksCompleted || !!job.description;
    const allMet = hasPhotos && hasSignatures && hasMaterials && hasNotes;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Quality Gate</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {hasPhotos ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                <span className="text-sm">Photos uploaded</span>
              </div>
              <div className="flex items-center gap-2">
                {hasSignatures ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                <span className="text-sm">Customer signature obtained</span>
              </div>
              <div className="flex items-center gap-2">
                {hasMaterials ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                <span className="text-sm">Materials recorded</span>
              </div>
              <div className="flex items-center gap-2">
                {hasNotes ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                <span className="text-sm">Notes / works completed</span>
              </div>
            </div>

            {blockingExceptions.length > 0 && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-amber-800">Blocking Exceptions:</p>
                {blockingExceptions.map(ex => (
                  <p key={ex.id} className="text-sm text-amber-700">• {ex.title}</p>
                ))}
              </div>
            )}

            {qualityError && (
              <div className="border border-red-200 bg-red-50 rounded-lg p-3">
                <p className="text-sm font-medium text-red-800">{qualityError.message || 'Quality gate check failed'}</p>
                {qualityError.failures?.map((f: any, i: number) => (
                  <p key={i} className="text-sm text-red-700">• {f.label || f.check}</p>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={handleCompleteJob} disabled={completeJobMutation.isPending}>
                {completeJobMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Complete & Sign Off
              </Button>
              <Button variant="outline" onClick={() => navigate(`/jobs/${job.id}/sign-off`)}>
                Full Sign-Off Page
              </Button>
            </div>

            {isAdmin && qualityError?.error === 'QUALITY_GATE_CAN_OVERRIDE' && (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Admin Override</span>
                </div>
                <Textarea
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Why are you overriding the Quality Gate?"
                  className="mb-2"
                />
                <Button variant="destructive" size="sm" disabled={!overrideReason.trim()} onClick={() => handleOverrideComplete(overrideReason.trim())}>
                  Override and complete
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <JobChecklist jobId={job.id} />
      </div>
    );
  }

  function renderTabActivity() {
    const events: Array<{ label: string; date: string; icon: React.ReactNode }> = [];
    if (job.createdAt) events.push({ label: 'Job created', date: job.createdAt, icon: <Plus className="h-3 w-3" /> });
    if (job.date) events.push({ label: 'Scheduled', date: job.date, icon: <Calendar className="h-3 w-3" /> });
    if (job.updatedAt && job.updatedAt !== job.createdAt) events.push({ label: 'Last updated', date: job.updatedAt, icon: <Edit className="h-3 w-3" /> });
    if (job.signOffTimestamp) events.push({ label: 'Signed off', date: job.signOffTimestamp, icon: <CheckCircle2 className="h-3 w-3" /> });

    // Add further actions as events
    job.furtherActions.forEach(a => {
      events.push({ label: `Action: ${a.description.substring(0, 50)}`, date: a.timestamp, icon: <AlertTriangle className="h-3 w-3" /> });
    });

    // Sort by date descending
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Activity Timeline</CardTitle></CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map((ev, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                    {ev.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ev.label}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(ev.date), 'dd MMM yyyy HH:mm')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // --- Main render ---
  return (
    <div className="container max-w-5xl mx-auto px-4 py-4">
      {renderHeader()}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full overflow-x-auto flex justify-start mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="photos">Photos & Files</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="signoff">Sign-Off</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details">{renderTabDetails()}</TabsContent>
        <TabsContent value="schedule">{renderTabSchedule()}</TabsContent>
        <TabsContent value="materials">{renderTabMaterials()}</TabsContent>
        <TabsContent value="photos">{renderTabPhotos()}</TabsContent>
        <TabsContent value="actions">{renderTabActions()}</TabsContent>
        <TabsContent value="signoff">{renderTabSignOff()}</TabsContent>
        <TabsContent value="activity">{renderTabActivity()}</TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete job {job.jobNo}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Job QR Code</DialogTitle>
            <DialogDescription>{job.jobNo}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="QR Code" className="w-48 h-48" />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>Close</Button>
            {qrCodeDataUrl && (
              <Button onClick={() => {
                const link = document.createElement('a');
                link.download = `${job.jobNo}-qr.png`;
                link.href = qrCodeDataUrl;
                link.click();
              }}>Download</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Suggest Engineers Dialog */}
      <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> AI Engineer Suggestions</DialogTitle>
          </DialogHeader>
          {suggestionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm">Finding best matches...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {suggestions.map((s, i) => (
                <div key={s.engineerId} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.engineerName}</span>
                      <Badge variant="outline">{s.score}%</Badge>
                      {s.isAvailableToday && <Badge className="bg-green-100 text-green-800">Available</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{s.reason}</p>
                    {s.matchedSkills && s.matchedSkills.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {s.matchedSkills.map(sk => <Badge key={sk} variant="secondary" className="text-xs">{sk}</Badge>)}
                      </div>
                    )}
                  </div>
                  <Button size="sm" onClick={() => { handleAssignEngineer(s.engineerId); setSuggestDialogOpen(false); }}>
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No suggestions available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
