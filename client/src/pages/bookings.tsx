import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Loader2, Calendar, CalendarDays, User, MapPin, Clock
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  booking_type: 'job' | 'survey' | 'inspection' | 'signoff_visit' | 'quote_visit' | 'snag_check';
  assigned_to: number | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_role: string;
  client_id: number | null;
  client_name: string | null;
  client_phone: string | null;
  property_id: string | null;
  scheduled_date: string;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  estimated_duration_mins: number;
  travel_time_mins: number;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  notes: string | null;
  address: string | null;
  postcode: string | null;
  created_at: string;
  updated_at: string;
}

interface UserRecord {
  id: number;
  name: string;
  role: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  scheduled: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Scheduled' },
  confirmed: { badge: 'bg-green-100 text-green-700 border-green-200', label: 'Confirmed' },
  in_progress: { badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'In Progress' },
  completed: { badge: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Completed' },
  cancelled: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Cancelled' },
};

const BOOKING_TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  job: { emoji: '🔧', label: 'Job', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  survey: { emoji: '📐', label: 'Survey', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  inspection: { emoji: '👁️', label: 'Inspection', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  signoff_visit: { emoji: '✅', label: 'Sign-off Visit', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  quote_visit: { emoji: '💰', label: 'Quote Visit', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  snag_check: { emoji: '🐛', label: 'Snag Check', color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

const PRIORITY_STYLES: Record<string, { badge: string; label: string }> = {
  low: { badge: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Low' },
  normal: { badge: 'bg-blue-50 text-blue-600 border-blue-200', label: 'Normal' },
  high: { badge: 'bg-orange-100 text-orange-700 border-orange-200', label: 'High' },
  urgent: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Urgent' },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Bookings() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Build query params
  const queryParams = new URLSearchParams();
  if (statusFilter && statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (typeFilter && typeFilter !== 'all') queryParams.set('booking_type', typeFilter);
  if (personFilter && personFilter !== 'all') queryParams.set('assigned_to', personFilter);
  if (dateFrom) queryParams.set('date_from', dateFrom);
  if (dateTo) queryParams.set('date_to', dateTo);
  const queryString = queryParams.toString();

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['/api/bookings', statusFilter, typeFilter, personFilter, dateFrom, dateTo],
    queryFn: async () => {
      const url = queryString ? `/api/bookings?${queryString}` : '/api/bookings';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<UserRecord[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  // Filter users to field staff only
  const fieldStaff = users.filter(u => ['engineer', 'surveyor', 'works_manager'].includes(u.role));

  // Client-side search filter
  const filteredBookings = bookings.filter(b => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (b.client_name && b.client_name.toLowerCase().includes(q)) ||
      (b.assigned_to_name && b.assigned_to_name.toLowerCase().includes(q)) ||
      (b.address && b.address.toLowerCase().includes(q)) ||
      (b.postcode && b.postcode.toLowerCase().includes(q)) ||
      (b.notes && b.notes.toLowerCase().includes(q))
    );
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
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Manage scheduled jobs, surveys, inspections and visits</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/resource-planner')} className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Resource Planner
          </Button>
          <Button onClick={() => navigate('/bookings/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Booking
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(STATUS_STYLES).map(([key, style]) => {
          const count = bookings.filter(b => b.status === key).length;
          return (
            <Card
              key={key}
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === key ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            >
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">{style.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(BOOKING_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.emoji} {config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_STYLES).map(([key, style]) => (
              <SelectItem key={key} value={key}>{style.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={personFilter} onValueChange={setPersonFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff</SelectItem>
            {fieldStaff.map(u => (
              <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">From:</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">To:</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[160px]"
          />
        </div>
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setDateFrom(''); setDateTo(''); }}
          >
            Clear dates
          </Button>
        )}
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No bookings found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || personFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first booking to get started'}
            </p>
            {!searchQuery && statusFilter === 'all' && typeFilter === 'all' && (
              <Button onClick={() => navigate('/bookings/new')} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                New Booking
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((booking) => {
            const statusStyle = STATUS_STYLES[booking.status] || STATUS_STYLES.scheduled;
            const typeConfig = BOOKING_TYPE_CONFIG[booking.booking_type] || BOOKING_TYPE_CONFIG.job;
            const priorityStyle = PRIORITY_STYLES[booking.priority] || PRIORITY_STYLES.normal;

            return (
              <Card
                key={booking.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                onClick={() => navigate(`/bookings/${booking.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className={typeConfig.color}>
                          {typeConfig.emoji} {typeConfig.label}
                        </Badge>
                        <Badge variant="outline" className={statusStyle.badge}>
                          {statusStyle.label}
                        </Badge>
                        {booking.priority !== 'normal' && (
                          <Badge variant="outline" className={priorityStyle.badge}>
                            {priorityStyle.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        {booking.assigned_to_name && (
                          <span className="text-sm font-medium flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {booking.assigned_to_name}
                          </span>
                        )}
                        {booking.client_name && (
                          <span className="text-sm text-muted-foreground">
                            → {booking.client_name}
                          </span>
                        )}
                      </div>
                      {booking.address && (
                        <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {booking.address}
                          {booking.postcode && ` • ${booking.postcode}`}
                        </p>
                      )}
                    </div>

                    {/* Right side info */}
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1 text-sm shrink-0">
                      <span className="font-medium flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(booking.scheduled_date), 'dd MMM yyyy')}
                      </span>
                      {booking.scheduled_time_start && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {booking.scheduled_time_start}
                          {booking.scheduled_time_end && ` - ${booking.scheduled_time_end}`}
                        </span>
                      )}
                      {booking.estimated_duration_mins > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ~{booking.estimated_duration_mins} mins
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
