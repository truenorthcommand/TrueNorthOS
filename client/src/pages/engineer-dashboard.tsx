import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ReceiptPhotoCapture } from '@/components/receipt-photo-capture';
import {
  Calendar, Clock, MapPin, Navigation, Play, CheckCircle2, Car, Sun, Moon, X,
  Briefcase, Receipt, ClipboardCheck, AlertTriangle, Loader2, Timer, Camera,
  ArrowRight, ArrowLeft, Fuel, Sparkles, Package, MoreHorizontal, FileText
} from 'lucide-react';
import { format } from 'date-fns';

// ── Receipt Categories ──────────────────────────────────────────────
type ReceiptCategory = 'fuel' | 'cleaning' | 'office_supplies' | 'consumables' | 'other';
const RECEIPT_CATEGORIES: { value: ReceiptCategory; label: string; emoji: string; icon: React.ReactNode }[] = [
  { value: 'fuel', label: 'Fuel', emoji: '⛽', icon: <Fuel className="h-4 w-4" /> },
  { value: 'cleaning', label: 'Cleaning', emoji: '🧹', icon: <Sparkles className="h-4 w-4" /> },
  { value: 'office_supplies', label: 'Office Supplies', emoji: '📎', icon: <Package className="h-4 w-4" /> },
  { value: 'consumables', label: 'Consumables', emoji: '📦', icon: <Receipt className="h-4 w-4" /> },
  { value: 'other', label: 'Other', emoji: '📋', icon: <MoreHorizontal className="h-4 w-4" /> },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatDateNice(date: Date): string {
  const dayName = format(date, 'EEEE');
  const day = date.getDate();
  const month = format(date, 'MMMM');
  const year = date.getFullYear();
  return `${dayName} ${day}${getOrdinalSuffix(day)} ${month} ${year}`;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'low': return 'border-green-500';
    case 'medium': return 'border-amber-500';
    case 'high': return 'border-orange-500';
    case 'emergency': return 'border-red-500';
    default: return 'border-gray-300';
  }
}

function getPriorityBadgeVariant(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'emergency': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
}

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'In Progress':
      return { label: 'In Progress', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
    case 'Completed':
      return { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
    default:
      return { label: 'Ready', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' };
  }
}

function getTimeBadge(job: any): string {
  if (job.isFullDay) return 'Full Day';
  const hour = new Date(job.scheduledDate).getHours();
  return hour < 12 ? 'AM' : 'PM';
}

export default function EngineerDashboard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('engineer-dark-mode') === 'true';
  });
  const [elapsed, setElapsed] = useState(0);
  const [showEndDay, setShowEndDay] = useState(false);
  const [startingJob, setStartingJob] = useState<string | null>(null);

  // ── Receipt Panel State ──────────────────────────────────────────
  const [showReceiptPanel, setShowReceiptPanel] = useState(false);
  const [receiptStep, setReceiptStep] = useState(1);
  const [receiptPhoto, setReceiptPhoto] = useState('');
  const [receiptCategory, setReceiptCategory] = useState<ReceiptCategory>('fuel');
  const [receiptDescription, setReceiptDescription] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptDate, setReceiptDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);
  const [receiptResult, setReceiptResult] = useState<{ status: string; id?: string } | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const resetReceiptPanel = () => {
    setReceiptStep(1);
    setReceiptPhoto('');
    setReceiptCategory('fuel');
    setReceiptDescription('');
    setReceiptNotes('');
    setReceiptDate(format(new Date(), 'yyyy-MM-dd'));
    setReceiptSubmitting(false);
    setReceiptResult(null);
    setReceiptError(null);
  };

  const openReceiptPanel = () => {
    resetReceiptPanel();
    setShowReceiptPanel(true);
  };

  const closeReceiptPanel = () => {
    setShowReceiptPanel(false);
    setTimeout(resetReceiptPanel, 300);
  };

  const handleReceiptSubmit = async () => {
    if (!receiptPhoto) return;
    setReceiptSubmitting(true);
    setReceiptError(null);
    try {
      const res = await apiRequest('POST', '/api/receipts', {
        type: 'general',
        category: receiptCategory,
        description: receiptDescription || null,
        notes: receiptNotes || null,
        date: receiptDate,
        receiptImageUrl: receiptPhoto,
      });
      const data = await res.json();
      setReceiptResult({ status: data.status || 'pending', id: data.id });
      setReceiptStep(4);
      toast({
        title: 'Receipt submitted!',
        description: data.status === 'clean'
          ? 'AI verification passed — no issues.'
          : data.status === 'flagged'
          ? 'Some items flagged for review.'
          : 'Receipt is being processed.',
      });
    } catch (err: any) {
      setReceiptError(err.message || 'Failed to submit receipt');
      toast({ title: 'Submission failed', description: err.message, variant: 'destructive' });
    } finally {
      setReceiptSubmitting(false);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('engineer-dark-mode', newMode.toString());
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const { data: user } = useQuery({
    queryKey: ['/api/auth/me'],
  });

  const { data: walkaroundStatus, isLoading: walkaroundLoading } = useQuery({
    queryKey: ['/api/gps/walkaround-status'],
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/jobs'],
  });

  const todayJobs = (jobs as any[])?.filter((j: any) => {
    const jobDate = new Date(j.scheduledDate).toDateString();
    const today = new Date().toDateString();
    return jobDate === today;
  })?.sort((a: any, b: any) => {
    return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
  }) || [];

  const activeJob = todayJobs.find((j: any) => j.status === 'In Progress');
  const completedJobs = todayJobs.filter((j: any) => j.status === 'Completed');
  const remainingJobs = todayJobs.filter((j: any) => j.status !== 'Completed' && j.status !== 'In Progress');

  useEffect(() => {
    if (!activeJob?.startedAt) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      const start = new Date(activeJob.startedAt).getTime();
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeJob?.startedAt]);

  const handleStartJob = async (jobId: string) => {
    setStartingJob(jobId);
    try {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        await fetch('/api/gps/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            jobId,
            action: 'job-start',
          }),
        });
      } catch {
        // GPS not available, continue anyway
      }

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'In Progress', startedAt: new Date().toISOString() }),
      });

      if (!res.ok) throw new Error('Failed to start job');

      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: 'Job Started', description: 'Timer is now running.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to start job', variant: 'destructive' });
    } finally {
      setStartingJob(null);
    }
  };

  const handleNavigate = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  const walkaroundCompleted = (walkaroundStatus as any)?.completedToday === true;
  const firstName = (user as any)?.firstName || (user as any)?.name?.split(' ')[0] || 'Engineer';

  if (walkaroundLoading || jobsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#E8A54B] mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Loading your day...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#0F2B4C] dark:text-white">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatDateNice(new Date())}
            </p>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-gray-600" />}
          </button>
        </div>
      </div>

      {/* State 1: Walkaround Required */}
      {!walkaroundCompleted && (
        <div className="p-4 space-y-6">
          {/* Walkaround Prompt */}
          <Card className="w-full max-w-md mx-auto text-center shadow-lg border-amber-200 dark:border-amber-800">
            <CardContent className="pt-8 pb-8 px-6">
              <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-6">
                <Car className="h-10 w-10 text-[#E8A54B]" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F2B4C] dark:text-white mb-2">
                Start Your Day
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Complete your vehicle walkaround check before starting work.
              </p>
              <Button
                onClick={() => navigate('/walkaround')}
                className="w-full h-14 text-lg font-semibold bg-[#E8A54B] hover:bg-[#d4943d] text-white rounded-xl shadow-md"
              >
                <Car className="h-5 w-5 mr-2" />
                Start Walkaround
              </Button>
              <div className="mt-6 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(new Date(), 'HH:mm')}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {todayJobs.length} job{todayJobs.length !== 1 ? 's' : ''} scheduled
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions - Available before walkaround */}
          <div>
            <h2 className="text-lg font-bold text-[#0F2B4C] dark:text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={openReceiptPanel}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                  <Receipt className="h-6 w-6 text-[#E8A54B] mb-2" />
                  <span className="text-sm font-medium text-[#0F2B4C] dark:text-white">Receipt</span>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={() => navigate('/timesheets')}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                  <Clock className="h-6 w-6 text-[#E8A54B] mb-2" />
                  <span className="text-sm font-medium text-[#0F2B4C] dark:text-white">Timesheets</span>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* State 2: Day Active */}
      {walkaroundCompleted && (
        <div className="p-4 space-y-4">
          {/* Active Job Timer */}
          {activeJob && (
            <Card className="border-2 border-green-400 dark:border-green-600 shadow-lg shadow-green-100 dark:shadow-green-900/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  <span className="text-sm font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">
                    In Progress
                  </span>
                </div>
                <h3 className="font-bold text-lg text-[#0F2B4C] dark:text-white truncate">
                  {activeJob.title || activeJob.jobNumber || 'Active Job'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-3">
                  {activeJob.clientName || activeJob.client?.name || 'Client'}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-2xl font-mono font-bold text-[#0F2B4C] dark:text-white">
                      {formatElapsed(elapsed)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {activeJob.siteAddress && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleNavigate(activeJob.siteAddress)}
                        className="h-10"
                      >
                        <Navigation className="h-4 w-4 mr-1" />
                        Navigate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => navigate(`/jobs/${activeJob.id}/complete`)}
                      className="h-10 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Cards Row */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{todayJobs.length}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Today's Jobs</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{completedJobs.length}</p>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Completed</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{remainingJobs.length}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Remaining</p>
              </CardContent>
            </Card>
          </div>

          {/* Today's Schedule */}
          <div>
            <h2 className="text-lg font-bold text-[#0F2B4C] dark:text-white mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today's Schedule
            </h2>
            {todayJobs.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center">
                  <Briefcase className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No jobs scheduled for today.</p>
                </CardContent>
              </Card>
            )}
            <div className="space-y-3">
              {todayJobs.map((job: any) => {
                const statusInfo = getStatusBadge(job.status);
                const isStarting = startingJob === String(job.id);
                return (
                  <Card
                    key={job.id}
                    className={`border-l-4 ${getPriorityColor(job.priority)} ${job.status === 'Completed' ? 'opacity-60' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs font-medium">
                            {getTimeBadge(job)}
                          </Badge>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityBadgeVariant(job.priority)}`}>
                          {job.priority || 'Normal'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-[#0F2B4C] dark:text-white truncate">
                        {job.clientName || job.client?.name || 'Client'}
                      </h3>
                      {(job.siteAddress || job.address) && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {job.siteAddress || job.address}
                        </p>
                      )}
                      {job.title && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">
                          {job.title}
                        </p>
                      )}
                      <div className="flex gap-2 mt-3">
                        {(job.siteAddress || job.address) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleNavigate(job.siteAddress || job.address)}
                            className="h-10 flex-1"
                          >
                            <Navigation className="h-4 w-4 mr-1" />
                            Navigate
                          </Button>
                        )}
                        {job.status !== 'Completed' && job.status !== 'In Progress' && (
                          <Button
                            size="sm"
                            onClick={() => handleStartJob(String(job.id))}
                            disabled={isStarting || !!activeJob}
                            className="h-10 flex-1 bg-[#0F2B4C] hover:bg-[#1a3d66] text-white"
                          >
                            {isStarting ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4 mr-1" />
                            )}
                            Start
                          </Button>
                        )}
                        {job.status === 'In Progress' && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/jobs/${job.id}/complete`)}
                            className="h-10 flex-1 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div>
            <h2 className="text-lg font-bold text-[#0F2B4C] dark:text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={() => navigate('/walkaround')}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                  <ClipboardCheck className="h-6 w-6 text-[#E8A54B] mb-2" />
                  <span className="text-sm font-medium text-[#0F2B4C] dark:text-white">Walkaround</span>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={() => navigate('/timesheets')}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                  <Clock className="h-6 w-6 text-[#E8A54B] mb-2" />
                  <span className="text-sm font-medium text-[#0F2B4C] dark:text-white">Log Time</span>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={openReceiptPanel}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                  <Receipt className="h-6 w-6 text-[#E8A54B] mb-2" />
                  <span className="text-sm font-medium text-[#0F2B4C] dark:text-white">Receipt</span>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={() => navigate('/jobs')}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                  <Briefcase className="h-6 w-6 text-[#E8A54B] mb-2" />
                  <span className="text-sm font-medium text-[#0F2B4C] dark:text-white">View All Jobs</span>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* End Day Section */}
          <div className="mt-6">
            {!showEndDay ? (
              <Button
                onClick={() => setShowEndDay(true)}
                variant="outline"
                className="w-full h-12 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                End Day
              </Button>
            ) : (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[#0F2B4C] dark:text-white">Timesheet Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {completedJobs.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No completed jobs today.</p>
                  )}
                  {completedJobs.map((job: any) => {
                    const startTime = job.startedAt ? new Date(job.startedAt) : null;
                    const endTime = job.completedAt ? new Date(job.completedAt) : null;
                    let hours = 0;
                    if (startTime && endTime) {
                      hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                    }
                    return (
                      <div key={job.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-[#0F2B4C] dark:text-white truncate max-w-[200px]">
                            {job.title || job.clientName || job.client?.name || 'Job'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {startTime ? format(startTime, 'HH:mm') : '--:--'} - {endTime ? format(endTime, 'HH:mm') : '--:--'}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-[#0F2B4C] dark:text-white">
                          {hours.toFixed(1)}h
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                    <span className="font-semibold text-[#0F2B4C] dark:text-white">Total Hours</span>
                    <span className="font-bold text-lg text-[#0F2B4C] dark:text-white">
                      {completedJobs.reduce((total: number, job: any) => {
                        const startTime = job.startedAt ? new Date(job.startedAt).getTime() : 0;
                        const endTime = job.completedAt ? new Date(job.completedAt).getTime() : 0;
                        return total + (startTime && endTime ? (endTime - startTime) / (1000 * 60 * 60) : 0);
                      }, 0).toFixed(1)}h
                    </span>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowEndDay(false)}
                      className="flex-1 h-11"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        toast({ title: 'Day Ended', description: 'Your timesheet has been submitted.' });
                        setShowEndDay(false);
                      }}
                      className="flex-1 h-11 bg-[#0F2B4C] hover:bg-[#1a3d66] text-white"
                    >
                      Submit & End Day
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── Receipt Upload Panel (Slide-up Overlay) ──────────────────── */}
      {showReceiptPanel && (
        <div className="fixed inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeReceiptPanel}
          />

          {/* Panel */}
          <div className="relative mt-auto bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            {/* Panel Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-[#E8A54B]" />
                  <h2 className="text-lg font-bold text-[#0F2B4C] dark:text-white">Upload Receipt</h2>
                </div>
                <button
                  onClick={closeReceiptPanel}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              {/* Step Indicator */}
              {receiptStep < 4 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  {[1, 2, 3].map((s) => (
                    <div
                      key={s}
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                        s === receiptStep
                          ? 'bg-[#E8A54B] scale-125 ring-2 ring-[#E8A54B]/30'
                          : s < receiptStep
                          ? 'bg-[#0F2B4C]'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Panel Content */}
            <div className="p-4 pb-8">
              {/* Step 1: Camera */}
              {receiptStep === 1 && (
                <div className="flex flex-col items-center gap-5">
                  <div className="text-center">
                    <Camera className="w-10 h-10 text-[#0F2B4C] dark:text-white mx-auto mb-2" />
                    <h3 className="text-base font-semibold text-[#0F2B4C] dark:text-white">Capture Your Receipt</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Take a clear photo for AI verification</p>
                  </div>
                  <div className="w-full max-w-sm">
                    <ReceiptPhotoCapture
                      value={receiptPhoto}
                      onChange={setReceiptPhoto}
                      label=""
                    />
                  </div>
                  <Button
                    onClick={() => setReceiptStep(2)}
                    disabled={!receiptPhoto}
                    className="w-full max-w-sm h-12 bg-[#0F2B4C] hover:bg-[#1a3d66] text-white text-base"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {receiptPhoto ? '✓ Photo captured' : 'Photo required to continue'}
                  </p>
                </div>
              )}

              {/* Step 2: Details */}
              {receiptStep === 2 && (
                <div className="flex flex-col gap-4">
                  <div className="text-center mb-1">
                    <FileText className="w-8 h-8 text-[#0F2B4C] dark:text-white mx-auto mb-1" />
                    <h3 className="text-base font-semibold text-[#0F2B4C] dark:text-white">Receipt Details</h3>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-[#0F2B4C] dark:text-gray-300">Category</Label>
                    <Select value={receiptCategory} onValueChange={(v) => setReceiptCategory(v as ReceiptCategory)}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {RECEIPT_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            <span className="flex items-center gap-2">
                              <span>{c.emoji}</span>
                              <span>{c.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-[#0F2B4C] dark:text-gray-300">Description</Label>
                    <Input
                      placeholder="e.g. Diesel for company van"
                      value={receiptDescription}
                      onChange={(e) => setReceiptDescription(e.target.value)}
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-[#0F2B4C] dark:text-gray-300">Notes (optional)</Label>
                    <Textarea
                      rows={2}
                      placeholder="Any additional details..."
                      value={receiptNotes}
                      onChange={(e) => setReceiptNotes(e.target.value)}
                      className="resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-[#0F2B4C] dark:text-gray-300">Date</Label>
                    <Input
                      type="date"
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                      className="h-12"
                    />
                  </div>

                  <div className="flex gap-3 mt-3">
                    <Button
                      variant="outline"
                      onClick={() => setReceiptStep(1)}
                      className="flex-1 h-12 border-[#0F2B4C] text-[#0F2B4C] dark:border-gray-500 dark:text-gray-300"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={() => setReceiptStep(3)}
                      disabled={!receiptCategory || !receiptDate}
                      className="flex-1 h-12 bg-[#0F2B4C] hover:bg-[#1a3d66] text-white"
                    >
                      Review
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Submit */}
              {receiptStep === 3 && !receiptSubmitting && (
                <div className="flex flex-col gap-4">
                  <div className="text-center mb-1">
                    <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-1" />
                    <h3 className="text-base font-semibold text-[#0F2B4C] dark:text-white">Confirm & Submit</h3>
                  </div>

                  {receiptPhoto && (
                    <div className="flex justify-center">
                      <img
                        src={receiptPhoto}
                        alt="Receipt"
                        className="max-h-[100px] object-cover rounded-lg border-2 border-[#E8A54B]/30 shadow-sm"
                      />
                    </div>
                  )}

                  <Card className="border-2 border-gray-100 dark:border-gray-700">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Category</span>
                        <Badge className="bg-[#0F2B4C]/10 text-[#0F2B4C] dark:bg-gray-700 dark:text-gray-200">
                          {RECEIPT_CATEGORIES.find(c => c.value === receiptCategory)?.emoji}{' '}
                          {RECEIPT_CATEGORIES.find(c => c.value === receiptCategory)?.label}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Date</span>
                        <span className="text-sm font-medium dark:text-white">
                          {receiptDate ? format(new Date(receiptDate), 'dd MMM yyyy') : ''}
                        </span>
                      </div>
                      {receiptDescription && (
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Description</span>
                          <span className="text-sm font-medium text-right max-w-[60%] dark:text-white">{receiptDescription}</span>
                        </div>
                      )}
                      {receiptNotes && (
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Notes</span>
                          <span className="text-sm text-gray-600 dark:text-gray-300 text-right max-w-[60%]">{receiptNotes}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {receiptError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                      <p className="text-sm text-red-600 dark:text-red-400">{receiptError}</p>
                    </div>
                  )}

                  <Button
                    onClick={handleReceiptSubmit}
                    className="w-full h-14 bg-[#E8A54B] hover:bg-[#d4953f] text-white text-lg font-semibold rounded-xl shadow-lg"
                  >
                    <Receipt className="w-5 h-5 mr-2" />
                    Submit Receipt
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setReceiptStep(2)}
                    className="w-full h-11 border-[#0F2B4C] text-[#0F2B4C] dark:border-gray-500 dark:text-gray-300"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Edit
                  </Button>
                </div>
              )}

              {/* Step 3: Submitting Animation */}
              {receiptStep === 3 && receiptSubmitting && (
                <div className="flex flex-col items-center gap-6 py-8">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-[#0F2B4C]/5 dark:bg-[#0F2B4C]/20 flex items-center justify-center">
                      <Loader2 className="w-14 h-14 text-[#E8A54B] animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-[#E8A54B]/20 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-[#0F2B4C] dark:text-white">Scanning Receipt</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AI is verifying your receipt...</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">This usually takes a few seconds</p>
                  </div>
                </div>
              )}

              {/* Step 4: Result */}
              {receiptStep === 4 && receiptResult && (
                <div className="flex flex-col items-center gap-5">
                  {receiptResult.status === 'clean' ? (
                    <>
                      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-bold text-green-700 dark:text-green-400">Receipt Clean</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AI verification passed — no issues detected.</p>
                      </div>
                    </>
                  ) : receiptResult.status === 'flagged' ? (
                    <>
                      <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <AlertTriangle className="w-12 h-12 text-amber-500" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-bold text-amber-700 dark:text-amber-400">Receipt Flagged</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Some items flagged for review by admin.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Receipt className="w-12 h-12 text-blue-500" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-bold text-blue-700 dark:text-blue-400">Processing</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your receipt is being processed.</p>
                      </div>
                    </>
                  )}

                  <div className="w-full max-w-sm space-y-3 mt-4">
                    <Button
                      onClick={() => {
                        resetReceiptPanel();
                      }}
                      className="w-full h-12 bg-[#E8A54B] hover:bg-[#d4953f] text-white font-semibold"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Submit Another Receipt
                    </Button>
                    <Button
                      variant="outline"
                      onClick={closeReceiptPanel}
                      className="w-full h-12 border-[#0F2B4C] text-[#0F2B4C] dark:border-gray-500 dark:text-gray-300"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
