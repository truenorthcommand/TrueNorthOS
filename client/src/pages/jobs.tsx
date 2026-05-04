import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { hasRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Plus, LayoutGrid, List, CalendarDays, Download, X, Filter,
  MapPin, User, Clock, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Briefcase, Camera, PenTool, Loader2, Navigation
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  isSameDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { badge: string; border: string; bg: string }> = {
  'Draft': { badge: 'bg-gray-100 text-gray-800', border: 'border-l-gray-400', bg: 'bg-gray-50' },
  'Ready': { badge: 'bg-purple-100 text-purple-800', border: 'border-l-purple-500', bg: 'bg-purple-50' },
  'In Progress': { badge: 'bg-blue-100 text-blue-800', border: 'border-l-blue-500', bg: 'bg-blue-50' },
  'Awaiting Signatures': { badge: 'bg-amber-100 text-amber-800', border: 'border-l-amber-500', bg: 'bg-amber-50' },
  'Signed Off': { badge: 'bg-emerald-100 text-emerald-800', border: 'border-l-emerald-500', bg: 'bg-emerald-50' },
  'On Hold': { badge: 'bg-orange-100 text-orange-800', border: 'border-l-orange-500', bg: 'bg-orange-50' },
  'Cancelled': { badge: 'bg-red-100 text-red-800', border: 'border-l-red-500', bg: 'bg-red-50' },
};

const PRIORITY_COLORS: Record<string, string> = {
  'emergency': 'border-l-red-500',
  'high': 'border-l-orange-500',
  'medium': 'border-l-amber-400',
  'low': 'border-l-green-500',
};

const PRIORITY_BADGE: Record<string, string> = {
  'emergency': 'bg-red-100 text-red-800',
  'high': 'bg-orange-100 text-orange-800',
  'medium': 'bg-amber-100 text-amber-800',
  'low': 'bg-green-100 text-green-800',
};

const STATUS_OPTIONS = ['All', 'Draft', 'Ready', 'In Progress', 'Awaiting Signatures', 'Signed Off', 'On Hold', 'Cancelled'];
const PRIORITY_OPTIONS = ['All', 'Emergency', 'High', 'Medium', 'Low'];
const DATE_OPTIONS = ['All', 'Today', 'This Week', 'This Month'];
const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Date (Newest)' },
  { value: 'date-asc', label: 'Date (Oldest)' },
  { value: 'priority', label: 'Priority' },
  { value: 'client', label: 'Client Name' },
  { value: 'status', label: 'Status' },
  { value: 'jobNo', label: 'Job Number' },
];

const PRIORITY_WEIGHT: Record<string, number> = { emergency: 0, high: 1, medium: 2, low: 3 };

// ─── Helper Functions ────────────────────────────────────────────────────────

function isOverdue(job: any): boolean {
  if (!job.scheduledDate) return false;
  if (job.status === 'Signed Off' || job.status === 'In Progress' || job.status === 'Cancelled') return false;
  return new Date(job.scheduledDate) < new Date(new Date().setHours(0, 0, 0, 0));
}

function isCompletedToday(job: any): boolean {
  if (job.status !== 'Signed Off') return false;
  const ref = job.completedAt || job.updatedAt;
  if (!ref) return false;
  return isToday(new Date(ref));
}

function getElapsedTime(job: any): string | null {
  if (job.status !== 'In Progress' || !job.startedAt) return null;
  const diff = Date.now() - new Date(job.startedAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function matchesSearch(job: any, query: string, engineers: any[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const engineer = engineers.find((e: any) => e.id === job.assignedToId);
  const engineerName = engineer?.fullName?.toLowerCase() || '';
  return (
    (job.customerName || '').toLowerCase().includes(q) ||
    (job.jobNo || '').toLowerCase().includes(q) ||
    (job.address || '').toLowerCase().includes(q) ||
    (job.postcode || '').toLowerCase().includes(q) ||
    engineerName.includes(q)
  );
}

function matchesDateFilter(job: any, dateFilter: string): boolean {
  if (dateFilter === 'All' || !job.scheduledDate) return dateFilter === 'All';
  const jobDate = new Date(job.scheduledDate);
  const now = new Date();
  switch (dateFilter) {
    case 'Today': return isToday(jobDate);
    case 'This Week': {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      return jobDate >= weekStart && jobDate <= weekEnd;
    }
    case 'This Month': {
      return jobDate.getMonth() === now.getMonth() && jobDate.getFullYear() === now.getFullYear();
    }
    default: return true;
  }
}

function sortJobs(jobs: any[], sortBy: string): any[] {
  return [...jobs].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc': return new Date(b.scheduledDate || 0).getTime() - new Date(a.scheduledDate || 0).getTime();
      case 'date-asc': return new Date(a.scheduledDate || 0).getTime() - new Date(b.scheduledDate || 0).getTime();
      case 'priority': return (PRIORITY_WEIGHT[a.priority || 'medium'] || 2) - (PRIORITY_WEIGHT[b.priority || 'medium'] || 2);
      case 'client': return (a.customerName || '').localeCompare(b.customerName || '');
      case 'status': return (a.status || '').localeCompare(b.status || '');
      case 'jobNo': return (a.jobNo || '').localeCompare(b.jobNo || '');
      default: return 0;
    }
  });
}

function getInitials(name: string): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Sub-render Functions ────────────────────────────────────────────────────

function renderStatsCards(stats: { total: number; inProgress: number; awaiting: number; overdue: number; completedToday: number }) {
  const cards = [
    { label: 'Total Active', value: stats.total, color: 'bg-[#0F2B4C]', textColor: 'text-white', icon: Briefcase },
    { label: 'In Progress', value: stats.inProgress, color: 'bg-blue-500', textColor: 'text-white', icon: Loader2 },
    { label: 'Awaiting Review', value: stats.awaiting, color: 'bg-amber-500', textColor: 'text-white', icon: PenTool },
    { label: 'Overdue', value: stats.overdue, color: 'bg-red-500', textColor: 'text-white', icon: AlertTriangle },
    { label: 'Completed Today', value: stats.completedToday, color: 'bg-emerald-500', textColor: 'text-white', icon: CheckCircle2 },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`${card.color} ${card.textColor} rounded-lg p-3 shadow-sm`}>
            <div className="flex items-center justify-between">
              <Icon className="h-4 w-4 opacity-80" />
              <span className="text-2xl font-bold">{card.value}</span>
            </div>
            <p className="text-xs opacity-90 mt-1">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function renderActiveFilters(
  filters: { status: string; priority: string; engineer: string; date: string },
  setFilters: (f: any) => void
) {
  const active: { key: string; label: string; value: string }[] = [];
  if (filters.status !== 'All') active.push({ key: 'status', label: 'Status', value: filters.status });
  if (filters.priority !== 'All') active.push({ key: 'priority', label: 'Priority', value: filters.priority });
  if (filters.engineer !== 'All') active.push({ key: 'engineer', label: 'Engineer', value: filters.engineer });
  if (filters.date !== 'All') active.push({ key: 'date', label: 'Date', value: filters.date });
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <Filter className="h-3.5 w-3.5 text-gray-500" />
      {active.map((f) => (
        <Badge key={f.key} variant="secondary" className="flex items-center gap-1 px-2 py-1 text-xs">
          {f.label}: {f.value}
          <X
            className="h-3 w-3 cursor-pointer hover:text-red-500"
            onClick={() => setFilters((prev: any) => ({ ...prev, [f.key]: 'All' }))}
          />
        </Badge>
      ))}
      <button
        className="text-xs text-red-600 hover:text-red-800 underline ml-2"
        onClick={() => setFilters({ status: 'All', priority: 'All', engineer: 'All', date: 'All' })}
      >
        Clear All
      </button>
    </div>
  );
}

function renderJobCard(job: any, engineers: any[], navigate: (path: string) => void) {
  const statusColor = STATUS_COLORS[job.status] || STATUS_COLORS['Draft'];
  const priorityBorder = PRIORITY_COLORS[job.priority || 'medium'] || PRIORITY_COLORS['medium'];
  const engineer = engineers.find((e: any) => e.id === job.assignedToId);
  const overdue = isOverdue(job);
  const elapsed = getElapsedTime(job);

  return (
    <Card
      key={job.id}
      className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${priorityBorder} ${statusColor.bg}`}
      onClick={() => navigate(`/jobs/${job.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-gray-500">{job.jobNo || `#${job.id}`}</span>
          <Badge className={`text-xs ${statusColor.badge}`}>{job.status}</Badge>
        </div>
        <h3 className="font-semibold text-sm text-gray-900 mb-1 truncate">{job.customerName || 'No Client'}</h3>
        {job.address && (
          <p className="text-xs text-gray-500 flex items-center gap-1 mb-2 truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" /> {job.address}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {engineer ? (
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded-full bg-[#0F2B4C] text-white flex items-center justify-center text-[10px] font-medium">
                  {getInitials(engineer.fullName)}
                </div>
                <span className="text-xs text-gray-600 truncate max-w-[80px]">{engineer.fullName}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">Unassigned</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            {job.scheduledDate ? format(new Date(job.scheduledDate), 'dd MMM') : 'No date'}
            {job.session && (
              <Badge variant="outline" className="text-[10px] ml-1 px-1 py-0">{job.session}</Badge>
            )}
          </div>
        </div>
        {/* Progress indicators & badges */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs">
            <span title="Photos">{job.photosComplete ? '📷✓' : '📷✗'}</span>
            <span title="Signatures">{job.signaturesComplete ? '✍️✓' : '✍️✗'}</span>
            <span title="Checklist">{job.checklistComplete ? '✅✓' : '✅✗'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {overdue && <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">OVERDUE</Badge>}
            {elapsed && <span className="text-[10px] text-blue-600 font-medium">{elapsed}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function renderListView(jobs: any[], engineers: any[], navigate: (path: string) => void) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-3 font-medium text-gray-600">Job No</th>
            <th className="text-left p-3 font-medium text-gray-600">Client</th>
            <th className="text-left p-3 font-medium text-gray-600 hidden md:table-cell">Address</th>
            <th className="text-left p-3 font-medium text-gray-600 hidden sm:table-cell">Engineer</th>
            <th className="text-left p-3 font-medium text-gray-600">Date</th>
            <th className="text-left p-3 font-medium text-gray-600 hidden lg:table-cell">Priority</th>
            <th className="text-left p-3 font-medium text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const statusColor = STATUS_COLORS[job.status] || STATUS_COLORS['Draft'];
            const engineer = engineers.find((e: any) => e.id === job.assignedToId);
            const overdue = isOverdue(job);
            return (
              <tr
                key={job.id}
                className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <td className="p-3 font-mono text-xs">{job.jobNo || `#${job.id}`}</td>
                <td className="p-3 font-medium">
                  <div className="flex items-center gap-1">
                    {job.customerName || 'No Client'}
                    {overdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                  </div>
                </td>
                <td className="p-3 text-gray-500 truncate max-w-[200px] hidden md:table-cell">{job.address || '-'}</td>
                <td className="p-3 hidden sm:table-cell">{engineer?.fullName || <span className="text-gray-400 italic">Unassigned</span>}</td>
                <td className="p-3 text-xs">{job.scheduledDate ? format(new Date(job.scheduledDate), 'dd/MM/yyyy') : '-'}</td>
                <td className="p-3 hidden lg:table-cell">
                  <Badge className={`text-xs ${PRIORITY_BADGE[job.priority || 'medium'] || PRIORITY_BADGE['medium']}`}>
                    {(job.priority || 'medium').charAt(0).toUpperCase() + (job.priority || 'medium').slice(1)}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge className={`text-xs ${statusColor.badge}`}>{job.status}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderCalendarView(
  jobs: any[],
  calendarMonth: Date,
  setCalendarMonth: (d: Date) => void,
  navigate: (path: string) => void
) {
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const getJobsForDate = (date: Date) => jobs.filter(j =>
    j.scheduledDate && isSameDay(new Date(j.scheduledDate), date)
  );

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Calendar header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-lg">{format(calendarMonth, 'MMMM yyyy')}</h3>
        <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {weekdays.map(wd => (
          <div key={wd} className="p-2 text-center text-xs font-medium text-gray-500 border-r last:border-r-0">
            {wd}
          </div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((d, idx) => {
          const dayJobs = getJobsForDate(d);
          const inMonth = isSameMonth(d, calendarMonth);
          const today = isToday(d);
          return (
            <div
              key={idx}
              className={`min-h-[80px] p-1 border-r border-b last:border-r-0 ${
                !inMonth ? 'bg-gray-50 opacity-50' : ''
              } ${today ? 'bg-blue-50' : ''}`}
            >
              <div className={`text-xs font-medium mb-1 ${today ? 'text-blue-600' : 'text-gray-600'}`}>
                {format(d, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayJobs.slice(0, 3).map((job) => {
                  const sc = STATUS_COLORS[job.status] || STATUS_COLORS['Draft'];
                  return (
                    <div
                      key={job.id}
                      className={`text-[10px] px-1 py-0.5 rounded cursor-pointer truncate ${sc.badge} hover:opacity-80`}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      title={`${job.jobNo} - ${job.customerName}`}
                    >
                      {job.customerName || job.jobNo || `#${job.id}`}
                    </div>
                  );
                })}
                {dayJobs.length > 3 && (
                  <div className="text-[10px] text-gray-500 pl-1">+{dayJobs.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Jobs() {
  const { user } = useAuth();
  const { jobs, refreshJobs } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ status: 'All', priority: 'All', engineer: 'All', date: 'All' });
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'calendar'>('cards');
  const [sortBy, setSortBy] = useState('date-desc');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Data
  const { data: users = [] } = useQuery<any[]>({ queryKey: ['/api/users'] });
  const engineers = useMemo(() => users.filter((u: any) => u.role === 'engineer' || u.role === 'admin'), [users]);

  const isAdmin = hasRole(user, 'admin', 'works_manager');

  // Filter by role
  const roleFilteredJobs = useMemo(() => {
    if (isAdmin) return jobs;
    return jobs.filter((j: any) => j.assignedToId === user?.id || (j.assignedToIds || []).includes(user?.id));
  }, [jobs, isAdmin, user]);

  // Apply all filters
  const displayedJobs = useMemo(() => {
    let filtered = roleFilteredJobs;

    // Search
    if (searchQuery) {
      filtered = filtered.filter((j: any) => matchesSearch(j, searchQuery, engineers));
    }

    // Status filter
    if (filters.status !== 'All') {
      filtered = filtered.filter((j: any) => j.status === filters.status);
    }

    // Priority filter
    if (filters.priority !== 'All') {
      filtered = filtered.filter((j: any) => (j.priority || 'medium').toLowerCase() === filters.priority.toLowerCase());
    }

    // Engineer filter
    if (filters.engineer !== 'All') {
      filtered = filtered.filter((j: any) => String(j.assignedToId) === filters.engineer);
    }

    // Date filter
    if (filters.date !== 'All') {
      filtered = filtered.filter((j: any) => matchesDateFilter(j, filters.date));
    }

    // Sort
    return sortJobs(filtered, sortBy);
  }, [roleFilteredJobs, searchQuery, filters, sortBy, engineers]);

  // Stats
  const stats = useMemo(() => {
    const activeStatuses = ['Ready', 'In Progress', 'Draft'];
    return {
      total: roleFilteredJobs.filter((j: any) => activeStatuses.includes(j.status)).length,
      inProgress: roleFilteredJobs.filter((j: any) => j.status === 'In Progress').length,
      awaiting: roleFilteredJobs.filter((j: any) => j.status === 'Awaiting Signatures').length,
      overdue: roleFilteredJobs.filter((j: any) => isOverdue(j)).length,
      completedToday: roleFilteredJobs.filter((j: any) => isCompletedToday(j)).length,
    };
  }, [roleFilteredJobs]);

  // Export
  const handleExport = () => {
    const headers = ['Job No', 'Client', 'Address', 'Engineer', 'Date', 'Priority', 'Status'];
    const rows = displayedJobs.map((j: any) => [
      j.jobNo || `#${j.id}`,
      j.customerName || '',
      j.address || '',
      engineers.find((e: any) => e.id === j.assignedToId)?.fullName || '',
      j.scheduledDate ? format(new Date(j.scheduledDate), 'dd/MM/yyyy') : '',
      j.priority || 'medium',
      j.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobs-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${displayedJobs.length} jobs exported to CSV` });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2B4C]">Jobs In Progress</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and track all field service jobs</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setLocation('/jobs/new')}
            className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90 text-white"
          >
            <Plus className="h-4 w-4 mr-2" /> Create Job
          </Button>
        )}
      </div>

      {/* Stats */}
      {renderStatsCards(stats)}

      {/* Search & Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by client, job no, address, postcode, engineer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
                <SelectTrigger className="w-[140px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.priority} onValueChange={(v) => setFilters(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="w-[120px] text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.engineer} onValueChange={(v) => setFilters(f => ({ ...f, engineer: v }))}>
                <SelectTrigger className="w-[140px] text-xs">
                  <SelectValue placeholder="Engineer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Engineers</SelectItem>
                  {engineers.map((e: any) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.date} onValueChange={(v) => setFilters(f => ({ ...f, date: v }))}>
                <SelectTrigger className="w-[120px] text-xs">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Active filters */}
          {renderActiveFilters(filters, setFilters)}
        </CardContent>
      </Card>

      {/* View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('cards')}
            className={viewMode === 'cards' ? 'bg-[#0F2B4C] text-white' : ''}
          >
            <LayoutGrid className="h-4 w-4 mr-1" /> Cards
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'bg-[#0F2B4C] text-white' : ''}
          >
            <List className="h-4 w-4 mr-1" /> List
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className={viewMode === 'calendar' ? 'bg-[#0F2B4C] text-white' : ''}
          >
            <CalendarDays className="h-4 w-4 mr-1" /> Calendar
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          )}
          <Badge variant="secondary" className="text-xs">
            {displayedJobs.length} job{displayedJobs.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Job Display */}
      {displayedJobs.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No jobs found</h3>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or search query</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayedJobs.map((job: any) => renderJobCard(job, engineers, setLocation))}
            </div>
          )}
          {viewMode === 'list' && (
            <Card className="shadow-sm overflow-hidden">
              {renderListView(displayedJobs, engineers, setLocation)}
            </Card>
          )}
          {viewMode === 'calendar' && renderCalendarView(displayedJobs, calendarMonth, setCalendarMonth, setLocation)}
        </>
      )}
    </div>
  );
}
