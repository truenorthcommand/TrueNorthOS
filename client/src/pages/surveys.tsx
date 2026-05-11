import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardCheck, MapPin, User, Camera,
  Calendar, Loader2, FileText, ArrowRight, Sparkles, Briefcase
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SurveyListItem {
  id: string;
  job_id: string;
  status: string;
  surveyor_notes: string | null;
  submitted_at: string | null;
  last_auto_save_at: string | null;
  created_at: string;
  updated_at: string;
  // Job info
  job_no: string | null;
  customer_name: string | null;
  job_address: string | null;
  job_status: string | null;
  // Surveyor info
  surveyor_name: string | null;
  // Counts
  photo_count: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  draft: { badge: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Draft' },
  submitting: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Creating Quote...' },
  sent: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Sent to Admin' },
  admin_reviewing: { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Admin Reviewing' },
  rejected: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Needs Revision' },
  complete: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Complete' },
  converted: { badge: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Converted to Quote' },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Surveys() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const { data: surveys = [], isLoading } = useQuery<SurveyListItem[]>({
    queryKey: ['/api/surveys/job-surveys'],
    queryFn: async () => {
      const res = await fetch('/api/surveys/job-surveys', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch surveys');
      return res.json();
    },
  });

  // Stats
  const stats = {
    total: surveys.length,
    draft: surveys.filter(s => s.status === 'draft').length,
    sent: surveys.filter(s => s.status === 'sent' || s.status === 'admin_reviewing').length,
    complete: surveys.filter(s => s.status === 'complete' || s.status === 'converted').length,
  };

  const handleGenerateQuote = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (generatingId) return;

    setGeneratingId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/survey/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate quote');
      }

      toast({
        title: 'Survey Sent',
        description: 'Survey submitted for quote generation',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to send survey',
        variant: 'destructive',
      });
    } finally {
      setGeneratingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2B4C] flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-[#E8A54B]" />
            Surveys
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Job survey notes and site photos</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-[#0F2B4C]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-[#0F2B4C]">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-400">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-700">{stats.draft}</div>
            <div className="text-xs text-muted-foreground">Drafts</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-700">{stats.sent}</div>
            <div className="text-xs text-muted-foreground">Pending Review</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-700">{stats.complete}</div>
            <div className="text-xs text-muted-foreground">Complete</div>
          </CardContent>
        </Card>
      </div>

      {/* Survey List */}
      {surveys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardCheck className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">No Surveys Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Surveys are created from the Jobs page. Open a job and start a survey from there.
            </p>
            <Button
              onClick={() => navigate('/jobs')}
              className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90 text-white"
            >
              <Briefcase className="h-4 w-4 mr-2" />
              Go to Jobs
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {surveys.map((survey) => {
            const statusStyle = STATUS_STYLES[survey.status] || STATUS_STYLES.draft;
            const photoCount = parseInt(survey.photo_count) || 0;

            return (
              <Card
                key={survey.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-[#0F2B4C]/20 hover:border-l-[#E8A54B]"
                onClick={() => navigate(`/surveys/${survey.job_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-[#0F2B4C] truncate">
                          {survey.customer_name || 'Unknown Customer'}
                        </h3>
                        {survey.job_no && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <Briefcase className="h-3 w-3 mr-1" />
                            {survey.job_no}
                          </Badge>
                        )}
                        <Badge variant="outline" className={statusStyle.badge}>
                          {statusStyle.label}
                        </Badge>
                      </div>

                      {survey.job_address && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">{survey.job_address}</span>
                        </div>
                      )}

                      {survey.surveyor_notes && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">
                            {survey.surveyor_notes.substring(0, 100)}
                            {survey.surveyor_notes.length > 100 ? '...' : ''}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Camera className="h-3.5 w-3.5" />
                          {photoCount} photo{photoCount !== 1 ? 's' : ''}
                        </span>
                        {survey.surveyor_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {survey.surveyor_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(survey.created_at), 'dd MMM yyyy')}
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="hidden md:flex items-center gap-2">
                      {survey.status === 'draft' && survey.surveyor_notes && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={(e) => handleGenerateQuote(survey.job_id, e)}
                          disabled={generatingId === survey.job_id}
                        >
                          {generatingId === survey.job_id ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                          )}
                          Send Survey
                        </Button>
                      )}
                      <ArrowRight className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
