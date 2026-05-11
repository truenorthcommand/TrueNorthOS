import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import {
  ArrowLeft, Save, Send, Camera, Loader2,
  CheckCircle2, Clock, AlertCircle, Image as ImageIcon,
  X, Info, FileText, Sparkles
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Survey {
  id: string;
  jobId: string;
  surveyorNotes: string;
  status: 'draft' | 'submitting' | 'sent' | 'admin_reviewing' | 'rejected';
  submittedAt: string | null;
  submittedBy: string | null;
  lastAutoSaveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SurveyPhoto {
  id: string;
  fileUrl: string;
  caption?: string;
  uploadedAt: string;
}

interface Job {
  id: string;
  jobNo: string;
  customerName: string;
  address?: string;
  status: string;
}

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: Clock },
  submitting: { label: 'Creating Quote...', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: Loader2 },
  sent: { label: 'Sent to Admin', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: CheckCircle2 },
  admin_reviewing: { label: 'Admin Reviewing', color: 'bg-amber-100 text-amber-700 border-amber-300', icon: FileText },
  rejected: { label: 'Needs Revision', color: 'bg-red-100 text-red-700 border-red-300', icon: AlertCircle },
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SurveyWizard() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/surveys/:id');
  const jobId = params?.id;
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── State ──────────────────────────────────────────────────────────
  const [notes, setNotes] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // ─── Queries ─────────────────────────────────────────────────────────
  const { data: job, isLoading: jobLoading } = useQuery<Job>({
    queryKey: ['/api/jobs', jobId],
    queryFn: async () => {
      if (!jobId) throw new Error('No job ID');
      const res = await fetch(`/api/jobs/${jobId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch job');
      return res.json();
    },
    enabled: !!jobId,
  });

  const { data: survey, isLoading: surveyLoading } = useQuery<Survey>({
    queryKey: ['/api/jobs', jobId, 'survey'],
    queryFn: async () => {
      if (!jobId) throw new Error('No job ID');
      const res = await fetch(`/api/jobs/${jobId}/survey`, { credentials: 'include' });
      if (res.status === 404) {
        // No survey yet, return null
        return null;
      }
      if (!res.ok) throw new Error('Failed to fetch survey');
      return res.json();
    },
    enabled: !!jobId,
  });

  const { data: photos = [], isLoading: photosLoading } = useQuery<SurveyPhoto[]>({
    queryKey: ['/api/jobs', jobId, 'survey', 'photos'],
    queryFn: async () => {
      if (!jobId) throw new Error('No job ID');
      const res = await fetch(`/api/jobs/${jobId}/survey/photos`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!jobId && !!survey,
  });

  // Query for associated quote (for surveyor visibility)
  const { data: jobQuote } = useQuery<{ quoteNo: string; total: string; status: string } | null>({
    queryKey: ['/api/quotes/by-job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const res = await fetch(`/api/quotes?jobId=${jobId}`, { credentials: 'include' });
      if (!res.ok) return null;
      const quotes = await res.json();
      if (Array.isArray(quotes) && quotes.length > 0) {
        const q = quotes[0];
        return {
          quoteNo: q.quoteNo || q.quote_no || q.id,
          total: q.total || q.amount || '0.00',
          status: q.status || 'draft'
        };
      }
      return null;
    },
    enabled: !!jobId,
  });

  // ─── Effects ─────────────────────────────────────────────────────────
  // Load survey notes into state
  useEffect(() => {
    if (survey?.surveyorNotes !== undefined) {
      setNotes(survey.surveyorNotes);
    }
  }, [survey?.surveyorNotes]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!isDirty || survey?.status === 'sent' || survey?.status === 'submitting') return;
    
    const timer = setInterval(() => {
      handleAutoSave();
    }, 30000);
    
    return () => clearInterval(timer);
  }, [isDirty, notes, jobId, survey?.status]);

  // Save on window unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirty && survey?.status !== 'sent') {
        handleAutoSave();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, notes, jobId]);

  // ─── Mutations ───────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (data: { surveyorNotes: string; status?: string }) => {
      if (!jobId) throw new Error('No job ID');
      const res = await fetch(`/api/jobs/${jobId}/survey`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save survey');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'survey'] });
      setIsDirty(false);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error('No job ID');
      const res = await fetch(`/api/jobs/${jobId}/survey/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send survey');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'survey'] });
      toast({
        title: 'Survey Sent!',
        description: `Quote ${data.quoteNo} has been generated and sent to admin.`,
        variant: 'success',
      });
      // Navigate to quote detail after success
      if (data.quoteId) {
        navigate(`/quotes/${data.quoteId}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send survey',
        variant: 'destructive',
      });
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────
  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (!isDirty) setIsDirty(true);
  };

  const handleAutoSave = useCallback(async () => {
    if (!isDirty || !jobId || survey?.status === 'sent' || survey?.status === 'submitting') return;
    
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync({ surveyorNotes: notes, status: 'draft' });
    } finally {
      setIsSaving(false);
    }
  }, [isDirty, notes, jobId, survey?.status, saveMutation]);

  const handleManualSave = async () => {
    if (!jobId) return;
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync({ surveyorNotes: notes, status: 'draft' });
      toast({ title: 'Saved', description: 'Your survey notes have been saved.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!jobId) return;
    
    // Validation
    if (notes.length < 20 && photos.length === 0) {
      toast({
        title: 'More info needed',
        description: 'Please add notes or photos before sending.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      // First save any unsaved changes
      if (isDirty) {
        await saveMutation.mutateAsync({ surveyorNotes: notes });
      }
      // Then send
      await sendMutation.mutateAsync();
    } finally {
      setIsSending(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !jobId) return;

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max file size is 10MB', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch(`/api/jobs/${jobId}/survey/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'survey', 'photos'] });
      toast({ title: 'Photo uploaded', description: 'Your site photo has been added.' });
    } catch (err) {
      toast({ title: 'Upload failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/survey/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete failed');
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'survey', 'photos'] });
    } catch {
      toast({ title: 'Error', description: 'Could not delete photo', variant: 'destructive' });
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────
  const isLoading = jobLoading || surveyLoading;
  const status = survey?.status || 'draft';
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const isReadOnly = status === 'sent' || status === 'submitting' || status === 'admin_reviewing';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#E8A54B]" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">Job not found</h2>
        <p className="text-sm text-gray-500">Return to Jobs list</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/jobs/${jobId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-[#0F2B4C]">Site Survey</h1>
              <p className="text-xs text-gray-500">{job.jobNo}</p>
            </div>
          </div>
          <Badge variant="outline" className={statusConfig.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4 pb-32">
        {/* Job Info Card */}
        <Card className="border-l-4 border-l-[#E8A54B]">
          <CardContent className="p-4">
            <h3 className="font-semibold text-[#0F2B4C]">{job.customerName}</h3>
            {job.address && (
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                <span className="text-xs">📍</span>
                {job.address}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Auto-save indicator */}
        {isDirty && status === 'draft' && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span>Unsaved changes</span>
          </div>
        )}
        {isSaving && (
          <div className="flex items-center gap-2 text-xs text-blue-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Saving...</span>
          </div>
        )}

        {/* Notes Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Survey Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isReadOnly ? (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap min-h-[120px]">
                {notes || 'No notes recorded.'}
              </div>
            ) : (
              <Textarea
                placeholder="Enter your survey notes here... Describe what work is needed, measurements, special requirements, access details, etc."
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                className="min-h-[200px] text-sm resize-none"
                disabled={isReadOnly}
              />
            )}
          </CardContent>
        </Card>

        {/* Photos Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Photos ({photos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Photo Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={photo.fileUrl}
                    alt="Site photo"
                    className="w-full h-full object-cover"
                  />
                  {!isReadOnly && (
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              
              {/* Upload Button */}
              {!isReadOnly && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#E8A54B] hover:bg-[#E8A54B]/5 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                  ) : (
                    <>
                      <Camera className="h-6 w-6 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-500">Add Photo</span>
                    </>
                  )}
                </label>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Preview Card (shown when ready to send) */}
        {status === 'draft' && (notes.length >= 30 || photos.length > 0) && (
          <Card className="bg-gradient-to-br from-[#0F2B4C] to-[#1a4475] text-white">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#E8A54B]" />
                <h3 className="font-semibold">AI Quote Generator</h3>
              </div>
              <p className="text-sm text-gray-200">
                When you send this survey, our AI will:
              </p>
              <ul className="text-xs text-gray-300 space-y-1 ml-1">
                <li>• Analyze your notes for items and quantities</li>
                <li>• Look up pricing from your database</li>
                <li>• Generate a professional quote</li>
              </ul>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSend}
                  disabled={isSending || (!isDirty && notes.length < 20 && photos.length === 0)}
                  className="flex-1 bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Quote...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send & Generate Quote
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sent state info */}
        {status === 'sent' && survey?.submittedAt && (
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-emerald-700">Survey Submitted</h3>
                <p className="text-sm text-emerald-600">
                  Sent {new Date(survey.submittedAt).toLocaleDateString()} at{' '}
                  {new Date(survey.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs text-emerald-500 mt-1">
                  The admin has been notified and is reviewing your quote.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quote Status Section (read-only for surveyor) */}
      {jobQuote && (
        <div className="px-4 mb-4">
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                <FileText className="h-4 w-4" />
                Quote Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">Quote #{jobQuote.quoteNo}</p>
                  <p className="text-lg font-bold text-slate-900">£{Number(jobQuote.total).toFixed(2)}</p>
                </div>
                <Badge className={
                  jobQuote.status === 'accepted' ? 'bg-green-100 text-green-700 border-green-300' :
                  jobQuote.status === 'sent' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                  jobQuote.status === 'rejected' || jobQuote.status === 'changes_requested' ? 'bg-red-100 text-red-700 border-red-300' :
                  'bg-gray-100 text-gray-700 border-gray-300'
                }>
                  {jobQuote.status === 'accepted' ? 'Accepted' :
                   jobQuote.status === 'sent' ? 'Sent to Customer' :
                   jobQuote.status === 'rejected' ? 'Rejected' :
                   jobQuote.status === 'changes_requested' ? 'Changes Requested' :
                   jobQuote.status.charAt(0).toUpperCase() + jobQuote.status.slice(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Action Bar */}
      {status === 'draft' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="flex gap-3 max-w-md mx-auto">
            <Button
              variant="outline"
              onClick={handleManualSave}
              disabled={isSaving || !isDirty}
              className="flex-1"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Draft
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || (notes.length < 20 && photos.length === 0)}
              className="flex-1 bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
