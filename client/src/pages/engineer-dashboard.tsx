import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Navigation, Clock, Calendar, Receipt, Mic,
  ChevronDown, ChevronRight, Play, Loader2, Car
} from 'lucide-react';
import { format, isToday, addDays, startOfDay, isSameDay } from 'date-fns';
import { Job } from '@/lib/types';

export default function EngineerDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { jobs, isLoading } = useStore();
  const [weekExpanded, setWeekExpanded] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayFormatted = format(new Date(), 'EEEE d MMMM yyyy');

  const todayJobs = useMemo(() => {
    if (!user) return [];
    return jobs.filter((job) => {
      if (!job.date) return false;
      const jobDate = new Date(job.date);
      if (!isToday(jobDate)) return false;
      return (
        job.assignedToId === user.id ||
        (job.assignedToIds || []).includes(user.id)
      );
    }).sort((a, b) => {
      const sessionOrder: Record<string, number> = { 'AM': 0, 'Full Day': 1, 'PM': 2 };
      const aOrder = sessionOrder[a.session || ''] ?? 1;
      const bOrder = sessionOrder[b.session || ''] ?? 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.orderIndex || 0) - (b.orderIndex || 0);
    });
  }, [jobs, user]);

  const completedCount = todayJobs.filter(j => j.status === 'Signed Off').length;
  const pendingCount = todayJobs.filter(j => j.status !== 'Signed Off').length;

  const nextJob = useMemo(() => {
    return todayJobs.find(j => j.status === 'Ready' || j.status === 'In Progress') || null;
  }, [todayJobs]);

  const weekJobs = useMemo(() => {
    if (!user) return [];
    const today = startOfDay(new Date());
    const days: { date: Date; jobs: Job[] }[] = [];
    for (let i = 1; i <= 7; i++) {
      const day = addDays(today, i);
      const dayJobs = jobs.filter((job) => {
        if (!job.date) return false;
        return (
          isSameDay(new Date(job.date), day) &&
          (job.assignedToId === user.id || (job.assignedToIds || []).includes(user.id))
        );
      });
      days.push({ date: day, jobs: dayJobs });
    }
    return days;
  }, [jobs, user]);

  const handleNavigate = (address: string, postcode: string) => {
    const query = encodeURIComponent(`${address}, ${postcode}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ready': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Signed Off': return 'bg-green-100 text-green-700 border-green-200';
      case 'Awaiting Signatures': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getSessionBadge = (session: string | null) => {
    switch (session) {
      case 'AM': return 'bg-sky-100 text-sky-700';
      case 'PM': return 'bg-indigo-100 text-indigo-700';
      case 'Full Day': return 'bg-violet-100 text-violet-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  function renderHeader() {
    return (
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F2B4C]">
            {greeting}, {user?.name?.split(' ')[0] || 'Engineer'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{todayFormatted}</p>
        </div>
        <img
          src="/logo.png"
          alt="ASG"
          className="w-10 h-10 rounded-lg object-contain"
        />
      </div>
    );
  }

  function renderStatusCards() {
    return (
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="shadow-sm border-0 bg-white">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-sm font-bold text-blue-700">{todayJobs.length}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 font-medium">Today's Jobs</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-white">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-sm font-bold text-green-700">{completedCount}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 font-medium">Completed</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-white">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-sm font-bold text-amber-700">{pendingCount}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 font-medium">Pending</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderNextJob() {
    if (!nextJob) return null;
    return (
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Next Job</h2>
        <Card className="shadow-md border-0 border-l-4 border-l-[#E8A54B] bg-white overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-bold text-[#0F2B4C] leading-tight">
                {nextJob.customerName || nextJob.client || 'Unnamed Client'}
              </h3>
              {nextJob.session && (
                <Badge className={`${getSessionBadge(nextJob.session)} text-xs font-medium border-0 ml-2 shrink-0`}>
                  {nextJob.session}
                </Badge>
              )}
            </div>
            {nextJob.address && (
              <div className="flex items-start gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-600">
                  {nextJob.address}{nextJob.postcode ? `, ${nextJob.postcode}` : ''}
                </p>
              </div>
            )}
            {nextJob.description && (
              <p className="text-sm text-gray-500 mb-3 line-clamp-2">{nextJob.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${getStatusColor(nextJob.status)} text-xs border`}>
                {nextJob.status}
              </Badge>
            </div>
            <div className="flex gap-2 mt-4">
              {nextJob.address && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white flex-1 h-11"
                  onClick={() => handleNavigate(nextJob.address || '', nextJob.postcode || '')}
                >
                  <Navigation className="w-4 h-4 mr-1.5" />
                  Navigate
                </Button>
              )}
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white flex-1 h-11"
                onClick={() => setLocation(`/jobs/${nextJob.id}`)}
              >
                <Play className="w-4 h-4 mr-1.5" />
                Start Job
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-gray-300 text-gray-700 h-11"
                onClick={() => setLocation(`/jobs/${nextJob.id}`)}
              >
                Details
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderTodaySchedule() {
    return (
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Today's Schedule</h2>
        {todayJobs.length === 0 ? (
          <Card className="shadow-sm border-0 bg-white">
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No jobs scheduled for today</p>
              <p className="text-sm text-gray-400 mt-1">Enjoy your day off!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {todayJobs.map((job) => (
              <Card
                key={job.id}
                className="shadow-sm border-0 bg-white cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
                onClick={() => setLocation(`/jobs/${job.id}`)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {job.session && (
                          <Badge className={`${getSessionBadge(job.session)} text-[10px] font-medium border-0 px-1.5 py-0`}>
                            {job.session}
                          </Badge>
                        )}
                        <span className="text-sm font-semibold text-[#0F2B4C] truncate">
                          {job.customerName || job.client || 'Unnamed'}
                        </span>
                      </div>
                      {job.address && (
                        <p className="text-xs text-gray-500 truncate">
                          {job.address}{job.postcode ? `, ${job.postcode}` : ''}
                        </p>
                      )}
                    </div>
                    <Badge className={`${getStatusColor(job.status)} text-[10px] border ml-2 shrink-0`}>
                      {job.status === 'Awaiting Signatures' ? 'Awaiting' : job.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderQuickActions() {
    const actions = [
      { icon: Car, label: 'Start Walkaround', path: '/fleet/walkaround', color: 'text-blue-600 bg-blue-50' },
      { icon: Clock, label: 'Log Time', path: '/timesheets', color: 'text-purple-600 bg-purple-50' },
      { icon: Receipt, label: 'Submit Expense', path: '/expenses', color: 'text-green-600 bg-green-50' },
      { icon: Mic, label: 'Voice Note', path: '/voice-notes', color: 'text-amber-600 bg-amber-50' },
    ];

    return (
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Card
              key={action.path}
              className="shadow-sm border-0 bg-white cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]"
              onClick={() => setLocation(action.path)}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[88px]">
                <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center mb-2`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-gray-700">{action.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  function renderWeekPreview() {
    return (
      <div className="mb-6">
        <button
          className="flex items-center justify-between w-full text-left mb-2"
          onClick={() => setWeekExpanded(!weekExpanded)}
        >
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">This Week</h2>
          {weekExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {weekExpanded && (
          <div className="space-y-2">
            {weekJobs.map(({ date, jobs: dayJobs }) => (
              <Card key={date.toISOString()} className="shadow-sm border-0 bg-white">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#0F2B4C]">
                        {format(date, 'EEEE d MMM')}
                      </p>
                      {dayJobs.length > 0 ? (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {dayJobs[0].customerName || dayJobs[0].client || 'Job'}
                          {dayJobs.length > 1 && ` +${dayJobs.length - 1} more`}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">No jobs</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {dayJobs.length > 0 && (
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-700">{dayJobs.length}</span>
                        </div>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderLoading() {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#E8A54B] mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 pt-6 pb-24">
        {renderLoading()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-6 pb-24">
      {renderHeader()}
      {renderStatusCards()}
      {renderNextJob()}
      {renderTodaySchedule()}
      {renderQuickActions()}
      {renderWeekPreview()}
    </div>
  );
}
