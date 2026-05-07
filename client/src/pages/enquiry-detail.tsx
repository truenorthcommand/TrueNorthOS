import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ArrowLeft, Loader2, Phone, Mail, MapPin, Calendar, User,
  Edit, Trash2, CheckCircle, XCircle, Ban, ClipboardCheck,
  FileText, Trophy, ExternalLink, Building2, Clock
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Enquiry {
  id: string;
  client_id: number;
  property_id: string | null;
  source: string;
  description: string;
  client_requirements: string | null;
  budget_indication: string | null;
  urgency: 'emergency' | 'urgent' | 'standard' | 'flexible';
  preferred_dates: string | null;
  assigned_to: number | null;
  status: 'new' | 'survey_booked' | 'survey_complete' | 'quote_sent' | 'won' | 'lost' | 'cancelled';
  lost_reason: string | null;
  survey_id: string | null;
  quote_id: string | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  property_name: string | null;
  property_address: string | null;
  property_postcode: string | null;
  assigned_to_name: string | null;
}

interface UserRecord {
  id: number;
  name: string;
  role: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  new: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'New' },
  survey_booked: { badge: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Survey Booked' },
  survey_complete: { badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Survey Complete' },
  quote_sent: { badge: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Quote Sent' },
  won: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Won' },
  lost: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Lost' },
  cancelled: { badge: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Cancelled' },
};

const URGENCY_STYLES: Record<string, { badge: string; label: string }> = {
  emergency: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Emergency' },
  urgent: { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Urgent' },
  standard: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Standard' },
  flexible: { badge: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Flexible' },
};

const SOURCE_LABELS: Record<string, string> = {
  phone: 'Phone',
  email: 'Email',
  website: 'Website',
  referral: 'Referral',
  repeat_customer: 'Repeat Customer',
  client_portal: 'Client Portal',
};

const PIPELINE_STAGES = [
  { key: 'new', label: 'New' },
  { key: 'survey_booked', label: 'Survey Booked' },
  { key: 'survey_complete', label: 'Survey Complete' },
  { key: 'quote_sent', label: 'Quote Sent' },
  { key: 'won', label: 'Won' },
];

const SURVEY_TYPES = [
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'full', label: 'Full Property' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'external', label: 'External' },
  { value: 'custom', label: 'Custom' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function EnquiryDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/enquiries/:id');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const enquiryId = params?.id;

  // Dialog states
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [showSurveyDialog, setShowSurveyDialog] = useState(false);
  const [surveyorId, setSurveyorId] = useState('');
  const [surveyType, setSurveyType] = useState('full');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editRequirements, setEditRequirements] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editUrgency, setEditUrgency] = useState('');
  const [editPreferredDates, setEditPreferredDates] = useState('');

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const { data: enquiry, isLoading, error } = useQuery<Enquiry>({
    queryKey: ['/api/enquiries', enquiryId],
    queryFn: async () => {
      const res = await fetch(`/api/enquiries/${enquiryId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch enquiry');
      return res.json();
    },
    enabled: !!enquiryId,
  });

  const { data: users = [] } = useQuery<UserRecord[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const surveyors = users.filter(u => ['admin', 'surveyor', 'super_admin'].includes(u.role));

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const invalidateEnquiry = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/enquiries', enquiryId] });
    queryClient.invalidateQueries({ queryKey: ['/api/enquiries'] });
    queryClient.invalidateQueries({ queryKey: ['/api/enquiries/stats/pipeline'] });
  };

  const actionMutation = useMutation({
    mutationFn: async ({ action, body }: { action: string; body?: Record<string, any> }) => {
      const res = await fetch(`/api/enquiries/${enquiryId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Action failed' }));
        throw new Error(err.error || 'Action failed');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      invalidateEnquiry();
      const messages: Record<string, string> = {
        'book-survey': 'Survey booked successfully',
        'create-quote': 'Quote created successfully',
        'mark-won': 'Enquiry marked as won!',
        'mark-lost': 'Enquiry marked as lost',
        'cancel': 'Enquiry cancelled',
      };
      toast({ title: 'Success', description: messages[variables.action] || 'Action completed' });
      setShowLostDialog(false);
      setShowSurveyDialog(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, any>) => {
      const res = await fetch(`/api/enquiries/${enquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Update failed' }));
        throw new Error(err.error || 'Update failed');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateEnquiry();
      toast({ title: 'Updated', description: 'Enquiry updated successfully.' });
      setShowEditDialog(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/enquiries/${enquiryId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(err.error || 'Delete failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Enquiry deleted.' });
      navigate('/enquiries');
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleBookSurvey = () => {
    if (!surveyorId) {
      toast({ title: 'Surveyor required', description: 'Please select a surveyor.', variant: 'destructive' });
      return;
    }
    actionMutation.mutate({
      action: 'book-survey',
      body: { surveyor_id: Number(surveyorId), survey_type: surveyType },
    });
  };

  const handleMarkLost = () => {
    if (!lostReason.trim()) {
      toast({ title: 'Reason required', description: 'Please provide a reason.', variant: 'destructive' });
      return;
    }
    actionMutation.mutate({ action: 'mark-lost', body: { reason: lostReason.trim() } });
  };

  const handleEdit = () => {
    updateMutation.mutate({
      description: editDescription,
      client_requirements: editRequirements || null,
      budget_indication: editBudget || null,
      urgency: editUrgency,
      preferred_dates: editPreferredDates || null,
    });
  };

  const openEditDialog = () => {
    if (enquiry) {
      setEditDescription(enquiry.description);
      setEditRequirements(enquiry.client_requirements || '');
      setEditBudget(enquiry.budget_indication || '');
      setEditUrgency(enquiry.urgency);
      setEditPreferredDates(enquiry.preferred_dates || '');
      setShowEditDialog(true);
    }
  };

  // ─── Loading / Error States ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !enquiry) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Enquiry not found</h2>
        <p className="text-muted-foreground mb-4">The enquiry you're looking for doesn't exist or you don't have access.</p>
        <Button onClick={() => navigate('/enquiries')}>Back to Enquiries</Button>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[enquiry.status] || STATUS_STYLES.new;
  const urgencyStyle = URGENCY_STYLES[enquiry.urgency] || URGENCY_STYLES.standard;

  // Determine current stage index for pipeline tracker
  const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.key === enquiry.status);
  const isTerminal = ['lost', 'cancelled'].includes(enquiry.status);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/enquiries')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">Enquiry</h1>
              <Badge variant="outline" className={statusStyle.badge}>
                {statusStyle.label}
              </Badge>
              <Badge variant="outline" className={urgencyStyle.badge}>
                {urgencyStyle.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Created {format(new Date(enquiry.created_at), 'dd MMM yyyy HH:mm')}
              {enquiry.assigned_to_name && ` • Assigned to ${enquiry.assigned_to_name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEditDialog} className="gap-1">
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="gap-1 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Pipeline Status Tracker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {PIPELINE_STAGES.map((stage, idx) => {
              const isActive = stage.key === enquiry.status;
              const isPast = !isTerminal && idx < currentStageIndex;
              const isFuture = !isTerminal && idx > currentStageIndex;
              return (
                <div key={stage.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary'
                          : isPast
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          : 'bg-muted text-muted-foreground border-muted-foreground/30'
                      }`}
                    >
                      {isPast ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                    </div>
                    <span className={`text-xs mt-1 text-center ${
                      isActive ? 'font-semibold text-primary' : isFuture ? 'text-muted-foreground' : 'text-emerald-700'
                    }`}>
                      {stage.label}
                    </span>
                  </div>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 ${
                      isPast ? 'bg-emerald-300' : 'bg-muted-foreground/20'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          {isTerminal && (
            <div className="mt-3 text-center">
              <Badge variant="outline" className={statusStyle.badge}>
                {statusStyle.label}
                {enquiry.lost_reason && ` — ${enquiry.lost_reason}`}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {!isTerminal && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {enquiry.status === 'new' && (
                <>
                  <Button onClick={() => setShowSurveyDialog(true)} className="gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Book Survey
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => actionMutation.mutate({ action: 'create-quote' })}
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Create Quote
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowLostDialog(true)}
                    className="gap-2 text-red-600 hover:text-red-700"
                  >
                    <XCircle className="h-4 w-4" />
                    Mark Lost
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => actionMutation.mutate({ action: 'cancel' })}
                    className="gap-2 text-gray-600"
                  >
                    <Ban className="h-4 w-4" />
                    Cancel
                  </Button>
                </>
              )}

              {enquiry.status === 'survey_booked' && enquiry.survey_id && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/surveys/${enquiry.survey_id}`)}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Survey
                </Button>
              )}

              {enquiry.status === 'survey_complete' && (
                <Button
                  onClick={() => actionMutation.mutate({ action: 'create-quote' })}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Create Quote
                </Button>
              )}

              {enquiry.status === 'quote_sent' && (
                <>
                  <Button
                    onClick={() => actionMutation.mutate({ action: 'mark-won' })}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Trophy className="h-4 w-4" />
                    Mark Won
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowLostDialog(true)}
                    className="gap-2 text-red-600 hover:text-red-700"
                  >
                    <XCircle className="h-4 w-4" />
                    Mark Lost
                  </Button>
                </>
              )}

              {enquiry.quote_id && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/quotes/${enquiry.quote_id}`)}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Quote
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{enquiry.client_name}</p>
            {enquiry.client_email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <a href={`mailto:${enquiry.client_email}`} className="hover:underline">
                  {enquiry.client_email}
                </a>
              </div>
            )}
            {enquiry.client_phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <a href={`tel:${enquiry.client_phone}`} className="hover:underline">
                  {enquiry.client_phone}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Property Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Property
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {enquiry.property_address ? (
              <>
                {enquiry.property_name && (
                  <p className="font-medium">{enquiry.property_name}</p>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {enquiry.property_address}
                </div>
                {enquiry.property_postcode && (
                  <p className="text-sm text-muted-foreground ml-5">{enquiry.property_postcode}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No property assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Enquiry Details */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Enquiry Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{enquiry.description}</p>
            </div>

            {enquiry.client_requirements && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Client Requirements</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{enquiry.client_requirements}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Source</Label>
                <p className="mt-1 text-sm font-medium">{SOURCE_LABELS[enquiry.source] || enquiry.source}</p>
              </div>
              {enquiry.budget_indication && (
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Budget</Label>
                  <p className="mt-1 text-sm font-medium">{enquiry.budget_indication}</p>
                </div>
              )}
              {enquiry.preferred_dates && (
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Preferred Dates</Label>
                  <p className="mt-1 text-sm font-medium">{enquiry.preferred_dates}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Last Updated</Label>
                <p className="mt-1 text-sm font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(enquiry.updated_at), 'dd MMM yyyy HH:mm')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Dialogs ──────────────────────────────────────────────────────────── */}

      {/* Mark Lost Dialog */}
      <Dialog open={showLostDialog} onOpenChange={setShowLostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Enquiry as Lost</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="lostReason">Reason for losing this enquiry</Label>
              <Textarea
                id="lostReason"
                placeholder="e.g. Customer went with a competitor, budget constraints, timing issues..."
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLostDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleMarkLost}
              disabled={actionMutation.isPending || !lostReason.trim()}
              className="gap-2"
            >
              {actionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Mark Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Book Survey Dialog */}
      <Dialog open={showSurveyDialog} onOpenChange={setShowSurveyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Survey</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="surveyor">Surveyor</Label>
              <Select value={surveyorId} onValueChange={setSurveyorId}>
                <SelectTrigger id="surveyor">
                  <SelectValue placeholder="Select a surveyor" />
                </SelectTrigger>
                <SelectContent>
                  {surveyors.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="surveyType">Survey Type</Label>
              <Select value={surveyType} onValueChange={setSurveyType}>
                <SelectTrigger id="surveyType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SURVEY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSurveyDialog(false)}>Cancel</Button>
            <Button
              onClick={handleBookSurvey}
              disabled={actionMutation.isPending || !surveyorId}
              className="gap-2"
            >
              {actionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Book Survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Enquiry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete this enquiry? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Enquiry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRequirements">Client Requirements</Label>
              <Textarea
                id="editRequirements"
                value={editRequirements}
                onChange={(e) => setEditRequirements(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editBudget">Budget Indication</Label>
                <Input
                  id="editBudget"
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editUrgency">Urgency</Label>
                <Select value={editUrgency} onValueChange={setEditUrgency}>
                  <SelectTrigger id="editUrgency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPreferredDates">Preferred Dates</Label>
              <Input
                id="editPreferredDates"
                value={editPreferredDates}
                onChange={(e) => setEditPreferredDates(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button
              onClick={handleEdit}
              disabled={updateMutation.isPending || !editDescription.trim()}
              className="gap-2"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
