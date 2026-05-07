import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, Loader2, CalendarDays, Plus, X
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CalendarBooking {
  id: string;
  booking_type: string;
  assigned_to: number;
  assigned_role: string;
  scheduled_date: string;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  estimated_duration_mins: number;
  travel_time_mins: number;
  status: string;
  priority: string;
  address: string | null;
  postcode: string | null;
  calendar_color: string | null;
  client_name: string | null;
  assigned_to_name: string | null;
}

interface ResourceGroup {
  user_id: string | null;
  user_name: string;
  role: string;
  bookings: CalendarBooking[];
}

interface CalendarResponse {
  bookings: CalendarBooking[];
  by_resource: ResourceGroup[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const BOOKING_TYPE_CONFIG: Record<string, { emoji: string; label: string; bgColor: string; textColor: string }> = {
  job: { emoji: '🔧', label: 'Job', bgColor: 'bg-orange-200', textColor: 'text-orange-900' },
  survey: { emoji: '📐', label: 'Survey', bgColor: 'bg-purple-200', textColor: 'text-purple-900' },
  inspection: { emoji: '👁️', label: 'Inspection', bgColor: 'bg-indigo-200', textColor: 'text-indigo-900' },
  signoff_visit: { emoji: '✅', label: 'Sign-off', bgColor: 'bg-emerald-200', textColor: 'text-emerald-900' },
  quote_visit: { emoji: '💰', label: 'Quote', bgColor: 'bg-amber-200', textColor: 'text-amber-900' },
  snag_check: { emoji: '🐛', label: 'Snag', bgColor: 'bg-rose-200', textColor: 'text-rose-900' },
};

const ROLE_ICONS: Record<string, string> = {
  engineer: '🔧',
  surveyor: '📐',
  works_manager: '👷',
};

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;
const HOURS_IN_DAY = WORK_END_HOUR - WORK_START_HOUR;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeToMinutes(time: string | null): number {
  if (!time) return WORK_START_HOUR * 60;
  const parts = time.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function getBlockPosition(booking: CalendarBooking): { left: string; width: string } {
  const startMins = timeToMinutes(booking.scheduled_time_start);
  const duration = booking.estimated_duration_mins || 60;
  const dayStartMins = WORK_START_HOUR * 60;
  const dayTotalMins = HOURS_IN_DAY * 60;

  const offsetMins = Math.max(0, startMins - dayStartMins);
  const left = (offsetMins / dayTotalMins) * 100;
  const width = Math.min((duration / dayTotalMins) * 100, 100 - left);

  return {
    left: `${Math.max(0, left)}%`,
    width: `${Math.max(2, width)}%`,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ResourcePlanner() {
  const [, navigate] = useLocation();
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Date range for API
  const startDate = format(currentWeekStart, 'yyyy-MM-dd');
  const endDate = format(addDays(currentWeekStart, 4), 'yyyy-MM-dd');

  // Fetch calendar data
  const { data: calendarData, isLoading } = useQuery<CalendarResponse>({
    queryKey: ['/api/bookings/calendar', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/bookings/calendar?start=${startDate}&end=${endDate}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch calendar data');
      return res.json();
    },
  });

  // Filter resources by role
  const filteredResources = useMemo(() => {
    if (!calendarData?.by_resource) return [];
    if (roleFilter === 'all') return calendarData.by_resource;

    return calendarData.by_resource.filter(resource => {
      // Use the role field directly from the resource
      if (roleFilter === 'works_manager') {
        return resource.role === 'works_manager' || resource.role === 'admin' || resource.role === 'super_admin';
      }
      return resource.role === roleFilter;
    });
  }, [calendarData, roleFilter]);

  // Navigation handlers
  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Click handlers
  const handleBookingClick = (booking: CalendarBooking) => {
    setSelectedBooking(booking);
  };

  const handleEmptySlotClick = (userId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/bookings/new?date=${dateStr}&assigned_to=${userId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Resource Planner
          </h1>
          <p className="text-muted-foreground">Weekly view of field staff bookings and availability</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/bookings')} size="sm">
            Back to Bookings
          </Button>
          <Button onClick={() => navigate('/bookings/new')} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            New Booking
          </Button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
            This Week
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2">
            {format(currentWeekStart, 'dd MMM')} - {format(addDays(currentWeekStart, 4), 'dd MMM yyyy')}
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              Week
            </Button>
            <Button
              variant={viewMode === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('day')}
            >
              Day
            </Button>
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="engineer">🔧 Engineers</SelectItem>
              <SelectItem value="surveyor">📐 Surveyors</SelectItem>
              <SelectItem value="works_manager">👷 Works Managers</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resource Grid */}
      {viewMode === 'week' ? (
        <WeekView
          weekDays={weekDays}
          resources={filteredResources}
          onBookingClick={handleBookingClick}
          onEmptySlotClick={handleEmptySlotClick}
        />
      ) : (
        <DayView
          day={selectedDay}
          weekDays={weekDays}
          resources={filteredResources}
          onBookingClick={handleBookingClick}
          onEmptySlotClick={handleEmptySlotClick}
          onDaySelect={setSelectedDay}
        />
      )}

      {/* Empty State */}
      {filteredResources.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No resources to display</h3>
            <p className="text-muted-foreground text-sm">
              No bookings found for this week or no staff match the selected role filter.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Booking Detail Popup */}
      {selectedBooking && (
        <BookingDetailPopup
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onEdit={() => navigate(`/bookings/${selectedBooking.id}`)}
        />
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2">
        {Object.entries(BOOKING_TYPE_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1 text-xs">
            <div className={`w-3 h-3 rounded ${config.bgColor}`} />
            <span>{config.emoji} {config.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 text-xs">
          <div className="w-3 h-3 rounded bg-gray-300 border border-dashed border-gray-400" />
          <span>🚗 Travel</span>
        </div>
      </div>
    </div>
  );
}

// ─── Week View Component ───────────────────────────────────────────────────────

interface WeekViewProps {
  weekDays: Date[];
  resources: ResourceGroup[];
  onBookingClick: (booking: CalendarBooking) => void;
  onEmptySlotClick: (userId: number, date: Date) => void;
}

function WeekView({ weekDays, resources, onBookingClick, onEmptySlotClick }: WeekViewProps) {
  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Header Row - Days */}
      <div className="grid border-b" style={{ gridTemplateColumns: '180px repeat(5, 1fr)' }}>
        <div className="p-2 bg-muted/50 font-medium text-sm border-r">Staff</div>
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={`p-2 text-center text-sm font-medium border-r last:border-r-0 ${
              isSameDay(day, new Date()) ? 'bg-primary/10' : 'bg-muted/50'
            }`}
          >
            <div className="font-semibold">{format(day, 'EEE')}</div>
            <div className="text-xs text-muted-foreground">{format(day, 'dd MMM')}</div>
          </div>
        ))}
      </div>

      {/* Resource Rows */}
      {resources.map((resource) => (
        <div
          key={resource.user_id}
          className="grid border-b last:border-b-0"
          style={{ gridTemplateColumns: '180px repeat(5, 1fr)' }}
        >
          {/* Staff Name */}
          <div className="p-2 border-r flex items-center gap-2 bg-muted/20">
            <span className="text-sm">{ROLE_ICONS[resource.role] || '👤'}</span>
            <span className="text-sm font-medium truncate">{resource.user_name}</span>
          </div>

          {/* Day Cells */}
          {weekDays.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayBookings = resource.bookings.filter(
              b => b.scheduled_date === dayStr
            );

            return (
              <div
                key={dayStr}
                className={`relative min-h-[60px] border-r last:border-r-0 p-1 cursor-pointer hover:bg-muted/30 transition-colors ${
                  isSameDay(day, new Date()) ? 'bg-primary/5' : ''
                }`}
                onClick={() => {
                  if (dayBookings.length === 0) {
                    onEmptySlotClick(resource.user_id, day);
                  }
                }}
              >
                {dayBookings.length === 0 ? (
                  <div className="flex items-center justify-center h-full opacity-0 hover:opacity-100 transition-opacity">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    {dayBookings.map((booking) => {
                      const typeConfig = BOOKING_TYPE_CONFIG[booking.booking_type] || BOOKING_TYPE_CONFIG.job;
                      return (
                        <div key={booking.id}>
                          {/* Travel time block */}
                          {booking.travel_time_mins > 0 && (
                            <div
                              className="text-[10px] px-1 py-0.5 rounded bg-gray-200 text-gray-600 mb-0.5 truncate"
                              title={`${booking.travel_time_mins} min travel`}
                            >
                              🚗 {booking.travel_time_mins}m
                            </div>
                          )}
                          {/* Booking block */}
                          <div
                            className={`text-[11px] px-1.5 py-1 rounded cursor-pointer truncate ${typeConfig.bgColor} ${typeConfig.textColor} hover:opacity-80 transition-opacity`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onBookingClick(booking);
                            }}
                            title={`${typeConfig.label}: ${booking.client_name || 'No client'} (${booking.scheduled_time_start || 'TBD'})`}
                          >
                            <div className="font-medium">
                              {typeConfig.emoji} {booking.scheduled_time_start || 'TBD'}
                            </div>
                            <div className="truncate opacity-80">
                              {booking.client_name || booking.address || 'No details'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Day View Component ────────────────────────────────────────────────────────

interface DayViewProps {
  day: Date;
  weekDays: Date[];
  resources: ResourceGroup[];
  onBookingClick: (booking: CalendarBooking) => void;
  onEmptySlotClick: (userId: number, date: Date) => void;
  onDaySelect: (day: Date) => void;
}

function DayView({ day, weekDays, resources, onBookingClick, onEmptySlotClick, onDaySelect }: DayViewProps) {
  const dayStr = format(day, 'yyyy-MM-dd');

  // Time grid hours
  const hours = Array.from({ length: HOURS_IN_DAY }, (_, i) => WORK_START_HOUR + i);

  return (
    <div className="space-y-3">
      {/* Day selector tabs */}
      <div className="flex gap-1">
        {weekDays.map((d) => (
          <Button
            key={d.toISOString()}
            variant={isSameDay(d, day) ? 'default' : 'outline'}
            size="sm"
            onClick={() => onDaySelect(d)}
            className="flex-1"
          >
            <div className="text-center">
              <div className="text-xs">{format(d, 'EEE')}</div>
              <div className="font-semibold">{format(d, 'dd')}</div>
            </div>
          </Button>
        ))}
      </div>

      {/* Timeline */}
      <div className="border rounded-lg overflow-hidden bg-background">
        {/* Time header */}
        <div className="flex border-b">
          <div className="w-[140px] shrink-0 p-2 bg-muted/50 border-r text-sm font-medium">Staff</div>
          <div className="flex-1 relative">
            <div className="flex">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="flex-1 text-center text-xs text-muted-foreground py-1 border-r last:border-r-0 bg-muted/50"
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resource rows with timeline */}
        {resources.map((resource) => {
          const dayBookings = resource.bookings.filter(b => b.scheduled_date === dayStr);

          return (
            <div key={resource.user_id} className="flex border-b last:border-b-0">
              {/* Staff name */}
              <div className="w-[140px] shrink-0 p-2 border-r flex items-center gap-2 bg-muted/20">
                <span className="text-sm">{ROLE_ICONS[resource.role] || '👤'}</span>
                <span className="text-xs font-medium truncate">{resource.user_name}</span>
              </div>

              {/* Timeline bar */}
              <div
                className="flex-1 relative min-h-[50px] cursor-pointer hover:bg-muted/10"
                onClick={() => onEmptySlotClick(resource.user_id, day)}
              >
                {/* Hour grid lines */}
                <div className="absolute inset-0 flex">
                  {hours.map((hour) => (
                    <div key={hour} className="flex-1 border-r last:border-r-0 border-dashed border-muted" />
                  ))}
                </div>

                {/* Booking blocks */}
                {dayBookings.map((booking) => {
                  const typeConfig = BOOKING_TYPE_CONFIG[booking.booking_type] || BOOKING_TYPE_CONFIG.job;
                  const position = getBlockPosition(booking);

                  return (
                    <div key={booking.id}>
                      {/* Travel time block */}
                      {booking.travel_time_mins > 0 && (() => {
                        const travelStart = timeToMinutes(booking.scheduled_time_start) - booking.travel_time_mins;
                        const dayStartMins = WORK_START_HOUR * 60;
                        const dayTotalMins = HOURS_IN_DAY * 60;
                        const travelLeft = ((travelStart - dayStartMins) / dayTotalMins) * 100;
                        const travelWidth = (booking.travel_time_mins / dayTotalMins) * 100;

                        return (
                          <div
                            className="absolute top-1 h-[calc(100%-8px)] bg-gray-200 border border-dashed border-gray-400 rounded text-[9px] flex items-center justify-center text-gray-500 overflow-hidden"
                            style={{ left: `${Math.max(0, travelLeft)}%`, width: `${travelWidth}%` }}
                            title={`${booking.travel_time_mins} min travel`}
                          >
                            🚗
                          </div>
                        );
                      })()}

                      {/* Booking block */}
                      <div
                        className={`absolute top-1 h-[calc(100%-8px)] rounded px-1 flex items-center text-[10px] font-medium cursor-pointer hover:opacity-80 overflow-hidden ${typeConfig.bgColor} ${typeConfig.textColor}`}
                        style={{ left: position.left, width: position.width }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookingClick(booking);
                        }}
                        title={`${typeConfig.label}: ${booking.client_name || ''} (${booking.scheduled_time_start} - ${booking.scheduled_time_end || '?'})`}
                      >
                        <span className="truncate">
                          {typeConfig.emoji} {booking.client_name || booking.address || typeConfig.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Booking Detail Popup ──────────────────────────────────────────────────────

interface BookingDetailPopupProps {
  booking: CalendarBooking;
  onClose: () => void;
  onEdit: () => void;
}

function BookingDetailPopup({ booking, onClose, onEdit }: BookingDetailPopupProps) {
  const typeConfig = BOOKING_TYPE_CONFIG[booking.booking_type] || BOOKING_TYPE_CONFIG.job;

  const STATUS_BADGE: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-green-100 text-green-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Badge className={`${typeConfig.bgColor} ${typeConfig.textColor} border-0`}>
                {typeConfig.emoji} {typeConfig.label}
              </Badge>
              <Badge className={STATUS_BADGE[booking.status] || 'bg-gray-100'}>
                {booking.status.replace('_', ' ')}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm">
            {booking.client_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{booking.client_name}</span>
              </div>
            )}
            {booking.assigned_to_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="font-medium">{booking.assigned_to_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{format(new Date(booking.scheduled_date), 'dd MMM yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">
                {booking.scheduled_time_start || 'TBD'}
                {booking.scheduled_time_end && ` - ${booking.scheduled_time_end}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{booking.estimated_duration_mins} mins</span>
            </div>
            {booking.travel_time_mins > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Travel Time</span>
                <span className="font-medium">🚗 {booking.travel_time_mins} mins</span>
              </div>
            )}
            {booking.address && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-right max-w-[60%] truncate">
                  {booking.address}{booking.postcode && ` • ${booking.postcode}`}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button size="sm" onClick={onEdit} className="flex-1">
              View / Edit
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
