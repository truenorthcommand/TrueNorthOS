import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, Briefcase, Clock, CheckCircle2, AlertTriangle, 
  MapPin, ArrowRight, Timer, Receipt, CalendarDays 
} from "lucide-react";
import { format, parseISO, isToday, isValid } from "date-fns";

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  roles?: string[];
  currentLat: number | null;
  currentLng: number | null;
  lastLocationUpdate: string | null;
  status: string;
}

interface TeamStats {
  teamSize: number;
  onlineCount: number;
  jobsToday: number;
  inProgressCount: number;
  pendingSignatures: number;
  completedThisWeek: number;
  overdueJobs: number;
  pendingTimesheets: number;
  pendingExpenses: number;
  totalPendingApprovals: number;
}

interface Job {
  id: string;
  jobNo: string;
  customerName: string;
  address: string | null;
  date: string | null;
  status: string;
  assignedToId: string | null;
  assignedToIds: string[] | null;
}

export default function WorksManagerDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<TeamStats>({
    queryKey: ["/api/works-manager/stats"],
    refetchInterval: 60000,
  });

  const { data: team, isLoading: teamLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/works-manager/team"],
    refetchInterval: 30000,
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/works-manager/jobs"],
    refetchInterval: 60000,
  });

  const isLoading = statsLoading || teamLoading;

  const todayJobs = jobs?.filter(job => {
    if (!job.date) return false;
    try {
      const jobDate = parseISO(job.date);
      return isValid(jobDate) && isToday(jobDate);
    } catch {
      return false;
    }
  }) || [];

  const overdueJobs = jobs?.filter(job => {
    if (job.status === 'Signed Off') return false;
    if (!job.date) return false;
    try {
      const jobDate = parseISO(job.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return isValid(jobDate) && jobDate < today;
    } catch {
      return false;
    }
  }) || [];

  const isOnline = (member: TeamMember) => {
    if (!member.lastLocationUpdate) return false;
    const lastUpdate = new Date(member.lastLocationUpdate);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastUpdate > fiveMinutesAgo;
  };

  if (!user) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          Team Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage your team's jobs, timesheets, and approvals
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="stat-team-size">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.teamSize || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{stats?.onlineCount || 0} online</span> now
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-jobs-today">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jobs Today</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.jobsToday || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.inProgressCount || 0} in progress
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-completed-week">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed This Week</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completedThisWeek || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.pendingSignatures || 0} awaiting signatures
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-pending-approvals">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPendingApprovals || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.pendingTimesheets || 0} timesheets, {stats?.pendingExpenses || 0} expenses
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <Link href="/works-manager/map">
              <Button variant="ghost" size="sm" data-testid="button-view-map">
                View Map <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-4">Loading team...</p>
            ) : !team || team.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No team members assigned to you yet</p>
            ) : (
              <div className="space-y-3">
                {team.map(member => (
                  <div 
                    key={member.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                    data-testid={`team-member-${member.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        isOnline(member) ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-200 dark:bg-slate-700'
                      }`}>
                        <Users className={`h-5 w-5 ${
                          isOnline(member) ? 'text-green-600' : 'text-slate-500'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {(member.roles && member.roles.length > 0 ? member.roles : [member.role]).join(', ')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={isOnline(member) ? "default" : "secondary"} className={
                      isOnline(member) ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : ''
                    }>
                      {isOnline(member) ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Today's Jobs
            </CardTitle>
            <Link href="/works-manager/jobs">
              <Button variant="ghost" size="sm" data-testid="button-view-all-jobs">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {todayJobs.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No jobs scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {todayJobs.slice(0, 5).map(job => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <div 
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      data-testid={`today-job-${job.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{job.customerName}</p>
                          <p className="text-sm text-muted-foreground truncate">{job.address}</p>
                        </div>
                        <Badge variant={
                          job.status === 'Signed Off' ? 'default' : 
                          job.status === 'In Progress' ? 'secondary' : 'outline'
                        }>
                          {job.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
                {todayJobs.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{todayJobs.length - 5} more jobs
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {overdueJobs.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Attention Needed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overdueJobs.slice(0, 5).map(job => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <div 
                      className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer transition-colors"
                      data-testid={`overdue-job-${job.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{job.customerName}</p>
                          <p className="text-sm text-amber-700 dark:text-amber-400">
                            Scheduled: {job.date ? format(parseISO(job.date), 'dd/MM/yyyy') : 'No date'}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-amber-500 text-amber-700">
                          Overdue
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/works-manager/approvals">
              <Button variant="outline" className="w-full justify-start" data-testid="button-approvals">
                <Timer className="mr-2 h-4 w-4" />
                Review Timesheets
                {(stats?.pendingTimesheets || 0) > 0 && (
                  <Badge variant="destructive" className="ml-auto">{stats?.pendingTimesheets}</Badge>
                )}
              </Button>
            </Link>
            <Link href="/works-manager/approvals">
              <Button variant="outline" className="w-full justify-start" data-testid="button-expenses">
                <Receipt className="mr-2 h-4 w-4" />
                Review Expenses
                {(stats?.pendingExpenses || 0) > 0 && (
                  <Badge variant="destructive" className="ml-auto">{stats?.pendingExpenses}</Badge>
                )}
              </Button>
            </Link>
            <Link href="/works-manager/map">
              <Button variant="outline" className="w-full justify-start" data-testid="button-team-map">
                <MapPin className="mr-2 h-4 w-4" />
                View Team Locations
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
