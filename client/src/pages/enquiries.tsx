import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Loader2, Phone, Mail, Globe, Users, RotateCcw, UserCircle,
  Inbox, ClipboardCheck, FileText, Trophy, XCircle, Ban, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Enquiry {
  id: string;
  client_id: number;
  property_id: string | null;
  source: 'phone' | 'email' | 'website' | 'referral' | 'repeat_customer' | 'client_portal';
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

interface PipelineStats {
  new: number;
  survey_booked: number;
  survey_complete: number;
  quote_sent: number;
  won: number;
  lost: number;
  cancelled: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { badge: string; label: string; icon: any }> = {
  new: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'New', icon: Inbox },
  survey_booked: { badge: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Survey Booked', icon: ClipboardCheck },
  survey_complete: { badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Survey Complete', icon: ClipboardCheck },
  quote_sent: { badge: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Quote Sent', icon: FileText },
  won: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Won', icon: Trophy },
  lost: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Lost', icon: XCircle },
  cancelled: { badge: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Cancelled', icon: Ban },
};

const URGENCY_STYLES: Record<string, { badge: string; label: string }> = {
  emergency: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Emergency' },
  urgent: { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Urgent' },
  standard: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Standard' },
  flexible: { badge: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Flexible' },
};

const SOURCE_STYLES: Record<string, { badge: string; label: string; icon: any }> = {
  phone: { badge: 'bg-green-50 text-green-700 border-green-200', label: 'Phone', icon: Phone },
  email: { badge: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Email', icon: Mail },
  website: { badge: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Website', icon: Globe },
  referral: { badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Referral', icon: Users },
  repeat_customer: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Repeat', icon: RotateCcw },
  client_portal: { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Portal', icon: UserCircle },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Enquiries() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Build query params
  const queryParams = new URLSearchParams();
  if (statusFilter && statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (urgencyFilter && urgencyFilter !== 'all') queryParams.set('urgency', urgencyFilter);
  if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());
  const queryString = queryParams.toString();

  const { data: enquiries = [], isLoading } = useQuery<Enquiry[]>({
    queryKey: ['/api/enquiries', statusFilter, urgencyFilter, searchQuery],
    queryFn: async () => {
      const url = queryString ? `/api/enquiries?${queryString}` : '/api/enquiries';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch enquiries');
      return res.json();
    },
  });

  const { data: pipelineStats } = useQuery<PipelineStats>({
    queryKey: ['/api/enquiries/stats/pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/enquiries/stats/pipeline', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch pipeline stats');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Enquiries</h1>
          <p className="text-muted-foreground">Manage incoming enquiries and track your sales pipeline</p>
        </div>
        <Button onClick={() => navigate('/enquiries/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Enquiry
        </Button>
      </div>

      {/* Pipeline Stats Cards */}
      {pipelineStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(STATUS_STYLES).map(([key, style]) => {
            const count = pipelineStats[key as keyof PipelineStats] || 0;
            const Icon = style.icon;
            return (
              <Card
                key={key}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  statusFilter === key ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              >
                <CardContent className="p-3 text-center">
                  <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground truncate">{style.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search enquiries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_STYLES).map(([key, style]) => (
              <SelectItem key={key} value={key}>{style.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Urgencies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Urgencies</SelectItem>
            {Object.entries(URGENCY_STYLES).map(([key, style]) => (
              <SelectItem key={key} value={key}>{style.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Enquiries List */}
      {enquiries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No enquiries found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery || statusFilter !== 'all' || urgencyFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first enquiry to get started'}
            </p>
            {!searchQuery && statusFilter === 'all' && urgencyFilter === 'all' && (
              <Button onClick={() => navigate('/enquiries/new')} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                New Enquiry
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {enquiries.map((enquiry) => {
            const statusStyle = STATUS_STYLES[enquiry.status] || STATUS_STYLES.new;
            const urgencyStyle = URGENCY_STYLES[enquiry.urgency] || URGENCY_STYLES.standard;
            const sourceStyle = SOURCE_STYLES[enquiry.source] || SOURCE_STYLES.phone;
            const SourceIcon = sourceStyle.icon;

            return (
              <Card
                key={enquiry.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                onClick={() => navigate(`/enquiries/${enquiry.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{enquiry.client_name}</h3>
                        <Badge variant="outline" className={statusStyle.badge}>
                          {statusStyle.label}
                        </Badge>
                        <Badge variant="outline" className={urgencyStyle.badge}>
                          {urgencyStyle.label}
                        </Badge>
                      </div>
                      {enquiry.property_address && (
                        <p className="text-sm text-muted-foreground truncate mb-1">
                          📍 {enquiry.property_address}
                          {enquiry.property_postcode && ` • ${enquiry.property_postcode}`}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {enquiry.description}
                      </p>
                    </div>

                    {/* Right side info */}
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1 text-sm shrink-0">
                      <Badge variant="outline" className={`${sourceStyle.badge} gap-1`}>
                        <SourceIcon className="h-3 w-3" />
                        {sourceStyle.label}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(enquiry.created_at), 'dd MMM yyyy')}
                      </span>
                      {enquiry.assigned_to_name && (
                        <span className="text-xs text-muted-foreground">
                          → {enquiry.assigned_to_name}
                        </span>
                      )}
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
