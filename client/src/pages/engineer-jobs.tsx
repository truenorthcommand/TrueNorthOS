import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Briefcase, MapPin, Clock, Navigation, ArrowLeft, Loader2, Calendar,
  CheckCircle2, AlertTriangle, Play
} from 'lucide-react';
import { format } from 'date-fns';

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'In Progress':
      return { label: 'In Progress', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
    case 'Completed':
    case 'Signed Off':
      return { label: status, className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
    case 'Awaiting Signatures':
      return { label: 'Awaiting Sign-off', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' };
    case 'Ready':
      return { label: 'Ready', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' };
    case 'Draft':
      return { label: 'Scheduled', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' };
    default:
      return { label: status || 'Unknown', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' };
  }
}

export default function EngineerJobs() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<'today' | 'all'>('today');

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['/api/jobs'],
  });

  const allJobs = (jobs as any[]) || [];
  const todayStr = new Date().toDateString();
  const todayJobs = allJobs.filter((j: any) => {
    const jobDate = new Date(j.scheduledDate || j.date).toDateString();
    return jobDate === todayStr;
  });

  const displayJobs = filter === 'today' ? todayJobs : allJobs;

  const handleNavigate = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-[#E8A54B]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/my-day')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#0F2B4C] dark:text-white">My Jobs</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === 'today' ? `${todayJobs.length} jobs today` : `${allJobs.length} total jobs`}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setFilter('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'today'
                ? 'bg-[#0F2B4C] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Today ({todayJobs.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-[#0F2B4C] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            All ({allJobs.length})
          </button>
        </div>
      </div>

      {/* Job List */}
      <div className="p-4 space-y-3">
        {displayJobs.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {filter === 'today' ? 'No jobs scheduled for today' : 'No jobs assigned'}
              </p>
            </CardContent>
          </Card>
        )}

        {displayJobs.map((job: any) => {
          const statusBadge = getStatusBadge(job.status);
          const jobDate = new Date(job.scheduledDate || job.date);

          return (
            <Card
              key={job.id}
              className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
              onClick={() => navigate(`/jobs/${job.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-gray-500">{job.jobNo}</span>
                      <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                    </div>
                    <h3 className="font-semibold text-[#0F2B4C] dark:text-white truncate">
                      {job.nickname || job.description || 'Untitled Job'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {job.customerName || job.client || 'No client'}
                    </p>
                  </div>
                  {job.session && (
                    <Badge variant="outline" className="ml-2 shrink-0">{job.session}</Badge>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {job.siteAddress && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {job.siteAddress}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(jobDate, 'dd MMM yyyy')}
                  </span>
                  {job.session && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {job.session}
                    </span>
                  )}
                </div>

                {/* Quick Actions */}
                {job.siteAddress && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigate(job.siteAddress);
                      }}
                      className="h-8 text-xs"
                    >
                      <Navigation className="h-3.5 w-3.5 mr-1" />
                      Navigate
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
