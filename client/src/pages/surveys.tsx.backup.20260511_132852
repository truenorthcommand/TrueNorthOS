import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardCheck, Plus, MapPin, User, Camera, Wrench,
  Home, Calendar, Loader2, FileText, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Survey {
  id: number;
  client_id: number;
  property_id: number | null;
  surveyor_id: number;
  survey_type: string;
  status: string;
  property_address: string | null;
  general_notes: string | null;
  condition_rating: string | null;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  client_email: string | null;
  surveyor_name: string | null;
  room_count: string;
  media_count: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  draft: { badge: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Draft' },
  in_progress: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'In Progress' },
  complete: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Complete' },
  converted: { badge: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Converted to Quote' },
};

const SURVEY_TYPE_STYLES: Record<string, { icon: string; label: string; color: string }> = {
  bathroom: { icon: '🛁', label: 'Bathroom', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  kitchen: { icon: '🍳', label: 'Kitchen', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  full: { icon: '🏠', label: 'Full Property', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  electrical: { icon: '⚡', label: 'Electrical', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  roofing: { icon: '🏗️', label: 'Roofing', color: 'bg-red-50 text-red-700 border-red-200' },
  external: { icon: '🌳', label: 'External', color: 'bg-green-50 text-green-700 border-green-200' },
  custom: { icon: '📝', label: 'Custom', color: 'bg-gray-50 text-gray-700 border-gray-200' },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Surveys() {
  const [, navigate] = useLocation();

  const { data: surveys = [], isLoading } = useQuery<Survey[]>({
    queryKey: ['/api/surveys'],
    queryFn: async () => {
      const res = await fetch('/api/surveys', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch surveys');
      return res.json();
    },
  });

  // Stats
  const stats = {
    total: surveys.length,
    draft: surveys.filter(s => s.status === 'draft').length,
    inProgress: surveys.filter(s => s.status === 'in_progress').length,
    complete: surveys.filter(s => s.status === 'complete').length,
    converted: surveys.filter(s => s.status === 'converted').length,
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
          <p className="text-muted-foreground text-sm mt-1">Manage property surveys and inspections</p>
        </div>
        <Button
          onClick={() => navigate('/surveys/new')}
          className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Survey
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-[#0F2B4C]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-[#0F2B4C]">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-400">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-700">{stats.draft}</div>
            <div className="text-xs text-muted-foreground">Draft</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-700">{stats.inProgress}</div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-700">{stats.complete}</div>
            <div className="text-xs text-muted-foreground">Complete</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-700">{stats.converted}</div>
            <div className="text-xs text-muted-foreground">Converted</div>
          </CardContent>
        </Card>
      </div>

      {/* Survey List */}
      {surveys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardCheck className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">No Surveys Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first property survey to get started</p>
            <Button
              onClick={() => navigate('/surveys/new')}
              className="bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Survey
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {surveys.map((survey) => {
            const statusStyle = STATUS_STYLES[survey.status] || STATUS_STYLES.draft;
            const typeStyle = SURVEY_TYPE_STYLES[survey.survey_type] || SURVEY_TYPE_STYLES.custom;
            const roomCount = parseInt(survey.room_count) || 0;
            const mediaCount = parseInt(survey.media_count) || 0;

            return (
              <Card
                key={survey.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-[#0F2B4C]/20 hover:border-l-[#E8A54B]"
                onClick={() => navigate(`/surveys/${survey.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-[#0F2B4C] truncate">
                          {survey.client_name || 'Unknown Client'}
                        </h3>
                        <Badge variant="outline" className={typeStyle.color}>
                          {typeStyle.icon} {typeStyle.label}
                        </Badge>
                        <Badge variant="outline" className={statusStyle.badge}>
                          {statusStyle.label}
                        </Badge>
                      </div>

                      {survey.property_address && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">{survey.property_address}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Home className="h-3.5 w-3.5" />
                          {roomCount} room{roomCount !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Camera className="h-3.5 w-3.5" />
                          {mediaCount} photo{mediaCount !== 1 ? 's' : ''}
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

                    {/* Right: Arrow */}
                    <div className="hidden md:flex items-center gap-2">
                      {survey.status === 'complete' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={(e) => { e.stopPropagation(); navigate(`/quotes/new?from_survey=${survey.id}`); }}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          Create Quote
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
