import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, Briefcase, Clock, CheckCircle2, AlertTriangle, 
  MapPin, ArrowRight, Timer, Receipt, CalendarDays,
  ClipboardCheck, FileWarning, TrendingUp, Activity,
  UserCheck, Eye, Shield, ChevronRight
} from "lucide-react";
import { format, parseISO, isToday, isValid, formatDistanceToNow } from "date-fns";

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

interface Inspection {
  id: string;
  jobId: string;
  inspectionType: string;
  status: string;
  createdAt: string;
  job?: { customerName: string; jobNo: string };
}

interface SnaggingSheet {
  id: string;
  jobId: string;
  status: string;
  totalSnags: number;
  resolvedSnags: number;
  createdAt: string;
  job?: { customerName: string; jobNo: string };
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

  const { data: inspections = [] } = useQuery<Inspection[]>({
    queryKey: ["/api/inspections"],
  });

  const { data: snaggingSheets = [] } = useQuery<SnaggingSheet[]>({
    queryKey: ["/api/snagging"],
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

  const pendingInspections = inspections.filter(i => i.status === 'in_progress').length;
  const completedInspections = inspections.filter(i => i.status === 'completed').length;
  const openSnags = snaggingSheets.reduce((sum, s) => sum + (s.totalSnags - s.resolvedSnags), 0);
  const totalSnags = snaggingSheets.reduce((sum, s) => sum + s.totalSnags, 0);
  const resolvedSnags = snaggingSheets.reduce((sum, s) => sum + s.resolvedSnags, 0);

  const recentInspections = [...inspections]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const recentSnagging = [...snaggingSheets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  if (!user) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const onlineMembers = team?.filter(isOnline) || [];

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold" data-testid="portal-title">Works Manager Portal</h1>
                <p className="text-blue-100">Welcome back, {user.name}</p>
              </div>
            </div>
            <p className="text-blue-100 mt-3 max-w-xl">
              Oversee your team's operations, manage approvals, and ensure quality standards across all jobs.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              <Users className="h-3 w-3 mr-1" />
              {stats?.onlineCount || 0} Team Online
            </Badge>
          </div>
        </div>
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

      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Link href="/works-manager/jobs">
            <Card className="hover:shadow-md transition-all hover:border-primary cursor-pointer h-full" data-testid="action-team-jobs">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                  <Briefcase className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-medium">Team Jobs</h3>
                <p className="text-sm text-muted-foreground">{jobs?.length || 0} total</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/works-manager/map">
            <Card className="hover:shadow-md transition-all hover:border-primary cursor-pointer h-full" data-testid="action-team-map">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                  <MapPin className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-medium">Team Map</h3>
                <p className="text-sm text-muted-foreground">Live locations</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/works-manager/approvals">
            <Card className="hover:shadow-md transition-all hover:border-primary cursor-pointer h-full" data-testid="action-approvals">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="font-medium">Approvals</h3>
                <p className="text-sm text-muted-foreground">
                  {(stats?.pendingTimesheets || 0) + (stats?.pendingExpenses || 0)} pending
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/inspections">
            <Card className="hover:shadow-md transition-all hover:border-primary cursor-pointer h-full" data-testid="action-inspections">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3">
                  <ClipboardCheck className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-medium">Inspections</h3>
                <p className="text-sm text-muted-foreground">{inspections.length} total</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/snagging">
            <Card className="hover:shadow-md transition-all hover:border-primary cursor-pointer h-full" data-testid="action-snagging">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
                  <FileWarning className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="font-medium">Snagging</h3>
                <p className="text-sm text-muted-foreground">{openSnags} open snags</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/timesheets">
            <Card className="hover:shadow-md transition-all hover:border-primary cursor-pointer h-full" data-testid="action-timesheets">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mx-auto mb-3">
                  <Timer className="h-6 w-6 text-cyan-600" />
                </div>
                <h3 className="font-medium">Timesheets</h3>
                <p className="text-sm text-muted-foreground">View all</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-purple-600" />
                  Quality Assurance
                </CardTitle>
                <CardDescription>Inspections and snagging overview</CardDescription>
              </div>
              <div className="flex gap-2">
                <Link href="/inspections">
                  <Button variant="ghost" size="sm">Inspections</Button>
                </Link>
                <Link href="/snagging">
                  <Button variant="ghost" size="sm">Snagging</Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Inspections</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold">{completedInspections}</span>
                  <span className="text-sm text-muted-foreground mb-0.5">completed</span>
                </div>
                {pendingInspections > 0 && (
                  <p className="text-sm text-amber-600 mt-1">{pendingInspections} in progress</p>
                )}
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileWarning className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">Snags</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold">{resolvedSnags}/{totalSnags}</span>
                  <span className="text-sm text-muted-foreground mb-0.5">resolved</span>
                </div>
                {openSnags > 0 && (
                  <p className="text-sm text-red-600 mt-1">{openSnags} open items</p>
                )}
              </div>
            </div>

            {recentInspections.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Recent Inspections</h4>
                <div className="space-y-2">
                  {recentInspections.map(inspection => (
                    <Link key={inspection.id} href={`/inspections/${inspection.id}`}>
                      <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer" data-testid={`recent-inspection-${inspection.id}`}>
                        <div className="flex items-center gap-2">
                          <Badge variant={inspection.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                            {inspection.inspectionType.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm">{inspection.job?.customerName || 'Unknown'}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Overview
              </CardTitle>
              <CardDescription>{onlineMembers.length} of {team?.length || 0} online</CardDescription>
            </div>
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
              <p className="text-muted-foreground text-center py-4">No team members assigned</p>
            ) : (
              <div className="space-y-2">
                {team.slice(0, 5).map(member => (
                  <div 
                    key={member.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                    data-testid={`team-member-${member.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        isOnline(member) ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-200 dark:bg-slate-700'
                      }`}>
                        <UserCheck className={`h-4 w-4 ${
                          isOnline(member) ? 'text-green-600' : 'text-slate-500'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {(member.roles && member.roles.length > 0 ? member.roles : [member.role]).join(', ')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={isOnline(member) ? "default" : "secondary"} className={`text-xs ${
                      isOnline(member) ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : ''
                    }`}>
                      {isOnline(member) ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                ))}
                {(team?.length || 0) > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    +{(team?.length || 0) - 5} more members
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
              <div className="space-y-2">
                {todayJobs.slice(0, 5).map(job => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <div 
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      data-testid={`today-job-${job.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{job.customerName}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{job.address}</p>
                        </div>
                        <Badge variant={
                          job.status === 'Signed Off' ? 'default' : 
                          job.status === 'In Progress' ? 'secondary' : 'outline'
                        } className="text-xs">
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

        {overdueJobs.length > 0 ? (
          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overdueJobs.slice(0, 5).map(job => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <div 
                      className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer transition-colors"
                      data-testid={`overdue-job-${job.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{job.customerName}</p>
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Due: {job.date ? format(parseISO(job.date), 'dd/MM/yyyy') : 'No date'}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-amber-500 text-amber-700 text-xs">
                          Overdue
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Jobs completed this week</span>
                  <span className="font-bold">{stats?.completedThisWeek || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Inspections completed</span>
                  <span className="font-bold">{completedInspections}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Snags resolved</span>
                  <span className="font-bold">{resolvedSnags}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Team utilization</span>
                  <span className="font-bold text-green-600">
                    {stats?.teamSize ? Math.round((stats.onlineCount / stats.teamSize) * 100) : 0}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
