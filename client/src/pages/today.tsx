import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Briefcase,
  User,
  Phone,
  Wrench,
  MessageSquare,
  FileText,
  Loader2
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";

interface TodayJob {
  id: string;
  jobNo: string;
  nickname?: string;
  customerName: string;
  address?: string;
  postcode?: string;
  contactName?: string;
  contactPhone?: string;
  session?: string;
  status: string;
  description?: string;
  date?: string;
  orderIndex: number;
}

interface TodayFeed {
  greeting: string;
  date: string;
  jobs: TodayJob[];
  stats: {
    totalJobs: number;
    completedJobs: number;
    pendingJobs: number;
    inProgressJobs: number;
  };
  nextAction?: {
    type: string;
    jobId?: string;
    jobNo?: string;
    message: string;
  };
}

export default function TodayPage() {
  const { user } = useAuth();

  const { data: feed, isLoading, error } = useQuery<TodayFeed>({
    queryKey: ["/api/today"],
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "in progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "scheduled":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "draft":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getSessionLabel = (session?: string) => {
    switch (session) {
      case "AM":
        return "Morning";
      case "PM":
        return "Afternoon";
      case "ALL_DAY":
        return "All Day";
      default:
        return session || "Scheduled";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-6 w-64 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load today's feed. Please try again.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-greeting">
          {feed?.greeting || `Good morning, ${user?.name?.split(' ')[0] || 'there'}`}
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="text-date">
          {feed?.date || format(new Date(), "EEEE, d MMMM yyyy")}
        </p>
      </div>

      {feed?.nextAction && (
        <Card className="mb-6 border-primary/50 bg-primary/5" data-testid="card-next-action">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ArrowRight className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Next Action</p>
                  <p className="text-sm text-muted-foreground">{feed.nextAction.message}</p>
                </div>
              </div>
              {feed.nextAction.jobId && (
                <Link href={`/jobs/${feed.nextAction.jobId}`}>
                  <Button variant="default" size="sm" data-testid="button-goto-next">
                    Go to Job
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card data-testid="stat-total">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{feed?.stats.totalJobs || 0}</div>
            <p className="text-sm text-muted-foreground">Total Jobs</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-pending">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{feed?.stats.pendingJobs || 0}</div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-in-progress">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{feed?.stats.inProgressJobs || 0}</div>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-completed">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{feed?.stats.completedJobs || 0}</div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Today's Jobs
        </h2>

        {(!feed?.jobs || feed.jobs.length === 0) ? (
          <Card data-testid="card-no-jobs">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No jobs scheduled for today</h3>
              <p className="text-muted-foreground">
                Enjoy your day off or check the calendar for upcoming work.
              </p>
              <Link href="/schedule/calendar">
                <Button variant="outline" className="mt-4" data-testid="button-view-calendar">
                  View Calendar
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          feed.jobs.map((job, index) => (
            <Card 
              key={job.id} 
              className="hover:shadow-md transition-shadow"
              data-testid={`card-job-${job.id}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">
                          {job.nickname || job.jobNo}
                        </h3>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {getSessionLabel(job.session)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{job.customerName}</p>
                    </div>
                  </div>
                  <Link href={`/jobs/${job.id}`}>
                    <Button variant="ghost" size="sm" data-testid={`button-view-job-${job.id}`}>
                      View <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>

                {job.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {job.description}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {job.address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{job.address}</span>
                    </div>
                  )}
                  {job.postcode && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Briefcase className="h-4 w-4 flex-shrink-0" />
                      <span>{job.postcode}</span>
                    </div>
                  )}
                  {job.contactName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4 flex-shrink-0" />
                      <span>{job.contactName}</span>
                    </div>
                  )}
                  {job.contactPhone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <a href={`tel:${job.contactPhone}`} className="hover:underline">
                        {job.contactPhone}
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Link href={`/jobs/${job.id}`}>
                    <Button variant="outline" size="sm" data-testid={`button-details-${job.id}`}>
                      <FileText className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </Link>
                  <Link href={`/sign-off?jobId=${job.id}`}>
                    <Button variant="outline" size="sm" data-testid={`button-signoff-${job.id}`}>
                      <Wrench className="h-4 w-4 mr-1" />
                      Sign Off
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <Link href="/jobs">
          <Button variant="outline" data-testid="button-all-jobs">
            View All Jobs
          </Button>
        </Link>
        <Link href="/schedule/calendar">
          <Button variant="outline" data-testid="button-calendar">
            Open Calendar
          </Button>
        </Link>
      </div>
    </div>
  );
}
