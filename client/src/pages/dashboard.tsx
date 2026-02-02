import { useState, useMemo, memo, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Job, JobStatus, hasRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calendar, MapPin, User, ArrowRight, Camera, Signature, CheckCircle2, Pencil, Clock, Navigation, Briefcase, CheckCircle, LogIn, LogOut, Timer, Loader2, FileText, Receipt, Users, Wallet, TrendingUp, AlertCircle, Building2, Truck, Shield, ClipboardCheck, Crown, type LucideIcon } from "lucide-react";
import { format, isToday, isTomorrow, isThisWeek, parseISO, formatDistanceToNow } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface PortalConfig {
  role: string;
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  gradient: string;
}

const PORTAL_CONFIGS: PortalConfig[] = [
  {
    role: 'works_manager',
    title: 'Works Manager Portal',
    description: 'Manage your team, approvals, and quality oversight',
    path: '/works-manager',
    icon: Shield,
    gradient: 'from-blue-600 to-blue-800',
  },
  {
    role: 'fleet_manager',
    title: 'Fleet Manager Portal',
    description: 'Vehicle checks, defect management, and fleet oversight',
    path: '/fleet',
    icon: Truck,
    gradient: 'from-orange-500 to-orange-700',
  },
  {
    role: 'surveyor',
    title: 'Surveyor Portal',
    description: 'Quotes, client management, and site surveys',
    path: '/quotes',
    icon: ClipboardCheck,
    gradient: 'from-purple-600 to-purple-800',
  },
  {
    role: 'accounts',
    title: 'Accounts Portal',
    description: 'Invoices, receipts, costs, and financial overview',
    path: '/accounts',
    icon: Wallet,
    gradient: 'from-green-600 to-green-800',
  },
  {
    role: 'director',
    title: "Director's Suite",
    description: 'Executive dashboards and business analytics',
    path: '/directors',
    icon: Crown,
    gradient: 'from-[#1e3a5f] to-[#0a1929]',
  },
];

function RolePortals({ user, setLocation }: { user: any; setLocation: (path: string) => void }) {
  const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
  const isAdminUser = user.role === 'super_admin' || user.role === 'admin' || user.superAdmin;
  
  const availablePortals = PORTAL_CONFIGS.filter(portal => {
    if (isAdminUser) return true;
    if (portal.role === 'director') {
      return userRoles.includes('director') || user.hasDirectorsSuite;
    }
    return userRoles.includes(portal.role);
  });
  
  if (availablePortals.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      {availablePortals.map(portal => {
        const Icon = portal.icon;
        return (
          <Card 
            key={portal.role}
            className={`bg-gradient-to-r ${portal.gradient} text-white cursor-pointer hover:shadow-lg transition-shadow`}
            onClick={() => setLocation(portal.path)}
            data-testid={`card-${portal.role}-portal`}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold truncate">{portal.title}</h3>
                  <p className="text-sm opacity-90 truncate">{portal.description}</p>
                </div>
              </div>
              <Button 
                variant="secondary" 
                size="sm"
                className="mt-4 w-full bg-white/20 hover:bg-white/30 text-white border-0" 
                data-testid={`button-open-${portal.role}`}
              >
                Open Portal
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { jobs } = useStore();
  const [, setLocation] = useLocation();

  if (!user) return null;

  if (user.role === "engineer") {
    return <EngineerDashboard />;
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const { user } = useAuth();
  const { jobs } = useStore();
  const [, setLocation] = useLocation();

  const { data: quotes = [] } = useQuery<any[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const { data: engineers = [] } = useQuery<any[]>({
    queryKey: ["/api/engineers"],
  });

  const { data: pendingTimesheets = [] } = useQuery<any[]>({
    queryKey: ["/api/timesheets/pending"],
  });

  const { data: pendingExpenses = [] } = useQuery<any[]>({
    queryKey: ["/api/expenses/pending"],
  });

  const activeJobs = jobs.filter(j => j.status === "In Progress" || j.status === "Draft");
  const awaitingSignature = jobs.filter(j => j.status === "Awaiting Signatures");
  const completedJobs = jobs.filter(j => j.status === "Signed Off");
  const todayJobs = jobs.filter(j => j.date && isToday(parseISO(j.date)));

  const pendingQuotes = quotes.filter((q: any) => q.status === "pending" || q.status === "sent");
  const acceptedQuotes = quotes.filter((q: any) => q.status === "accepted");

  const unpaidInvoices = invoices.filter((i: any) => i.status === "sent" || i.status === "overdue");
  const overdueInvoices = invoices.filter((i: any) => i.status === "overdue");

  const totalUnpaidAmount = unpaidInvoices.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name}. Here's your business overview.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/clients")} data-testid="button-quick-client">
            <Plus className="mr-2 h-4 w-4" />
            New Client
          </Button>
          <Button onClick={() => setLocation("/quotes")} data-testid="button-quick-quote">
            <FileText className="mr-2 h-4 w-4" />
            New Quote
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/jobs")} data-testid="card-active-jobs">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeJobs.length}</p>
                <p className="text-xs text-muted-foreground">Active Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/quotes")} data-testid="card-pending-quotes">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingQuotes.length}</p>
                <p className="text-xs text-muted-foreground">Pending Quotes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/invoices")} data-testid="card-unpaid-invoices">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${overdueInvoices.length > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}>
                <Receipt className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unpaidInvoices.length}</p>
                <p className="text-xs text-muted-foreground">Unpaid Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/engineers")} data-testid="card-team">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{engineers.length}</p>
                <p className="text-xs text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <RolePortals user={user} setLocation={setLocation} />

      {totalUnpaidAmount > 0 && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500 rounded-lg">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">Outstanding Revenue</p>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">£{totalUnpaidAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <Button variant="outline" className="border-emerald-300" onClick={() => setLocation("/invoices")}>
                View Invoices
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Today's Schedule
            </CardTitle>
            <CardDescription>{format(new Date(), "EEEE, dd MMMM yyyy")}</CardDescription>
          </CardHeader>
          <CardContent>
            {todayJobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No jobs scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayJobs.slice(0, 5).map(job => (
                  <div 
                    key={job.id} 
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => setLocation(`/jobs/${job.id}`)}
                    data-testid={`today-job-${job.id}`}
                  >
                    <Badge variant={job.status === "In Progress" ? "default" : "secondary"} className="shrink-0">
                      {job.session || "TBD"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{job.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">{job.address || "No address"}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
                {todayJobs.length > 5 && (
                  <Button variant="ghost" className="w-full" onClick={() => setLocation("/jobs")}>
                    View all {todayJobs.length} jobs
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Pending Approvals
            </CardTitle>
            <CardDescription>Items requiring your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {awaitingSignature.length > 0 && (
                <div 
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                  onClick={() => setLocation("/jobs")}
                  data-testid="pending-signatures"
                >
                  <div className="flex items-center gap-3">
                    <Signature className="h-5 w-5 text-amber-600" />
                    <span className="font-medium">Jobs Awaiting Sign-off</span>
                  </div>
                  <Badge variant="secondary">{awaitingSignature.length}</Badge>
                </div>
              )}
              
              {pendingTimesheets.length > 0 && (
                <div 
                  className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  onClick={() => setLocation("/timesheets")}
                  data-testid="pending-timesheets"
                >
                  <div className="flex items-center gap-3">
                    <Timer className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Timesheets to Approve</span>
                  </div>
                  <Badge variant="secondary">{pendingTimesheets.length}</Badge>
                </div>
              )}

              {pendingExpenses.length > 0 && (
                <div 
                  className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                  onClick={() => setLocation("/expenses")}
                  data-testid="pending-expenses"
                >
                  <div className="flex items-center gap-3">
                    <Receipt className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">Expenses to Approve</span>
                  </div>
                  <Badge variant="secondary">{pendingExpenses.length}</Badge>
                </div>
              )}

              {acceptedQuotes.length > 0 && (
                <div 
                  className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  onClick={() => setLocation("/quotes")}
                  data-testid="accepted-quotes"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    <span className="font-medium">Accepted Quotes (Ready for Job)</span>
                  </div>
                  <Badge variant="secondary">{acceptedQuotes.length}</Badge>
                </div>
              )}

              {awaitingSignature.length === 0 && pendingTimesheets.length === 0 && pendingExpenses.length === 0 && acceptedQuotes.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-50 text-emerald-500" />
                  <p>All caught up!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/clients")} data-testid="card-clients">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-500 rounded-lg">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clients.length}</p>
                <p className="text-xs text-muted-foreground">Total Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/completed-jobs")} data-testid="card-completed">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500 rounded-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedJobs.length}</p>
                <p className="text-xs text-muted-foreground">Completed Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/fleet")} data-testid="card-fleet">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold">Fleet</p>
                <p className="text-xs text-muted-foreground">Manage Vehicles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function JobCard({ job, statusColor, isAdmin }: { job: Job, statusColor: string, isAdmin: boolean }) {
  const [, setLocation] = useLocation();
  const photos = job.photos || [];
  const signatures = job.signatures || [];
  
  const photosComplete = photos.length > 0;
  const engineerSignatureComplete = signatures.some(s => s.type === "engineer");
  const customerSignatureComplete = signatures.some(s => s.type === "customer");
  
  const progressItems = [
    { label: "Photos", complete: photosComplete, icon: Camera },
    { label: "Engineer Sig", complete: engineerSignatureComplete, icon: Signature },
    { label: "Customer Sig", complete: customerSignatureComplete, icon: Signature },
  ];
  
  const completedCount = progressItems.filter(item => item.complete).length;
  const progressPercentage = (completedCount / progressItems.length) * 100;

  const handleCardClick = () => {
    setLocation(`/jobs/${job.id}`);
  };

  return (
    <Card 
      className="hover:shadow-lg transition-all cursor-pointer group border-l-4 overflow-hidden" 
      style={{ borderLeftColor: statusColor.includes('blue') ? 'rgb(59, 130, 246)' : statusColor.includes('amber') ? 'rgb(217, 119, 6)' : statusColor.includes('emerald') ? 'rgb(16, 185, 129)' : 'rgb(100, 116, 139)' }}
      onClick={handleCardClick}
      data-testid={`card-job-${job.id}`}
    >
      <div className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start mb-2">
            <Badge className={statusColor}>{job.status}</Badge>
            <span className="text-xs font-mono text-muted-foreground">{job.jobNo}</span>
          </div>
          <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
            {job.customerName}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 pb-4">
          <div className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{job.address || "No address set"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>{job.date ? format(new Date(job.date), "dd MMM yyyy") : "No date"} • {job.session || "No session"}{job.orderNumber ? ` • #${job.orderNumber}` : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 shrink-0" />
                <span>{job.contactName || "No contact"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Progress</span>
                <span className="text-xs font-bold text-muted-foreground">{completedCount}/{progressItems.length}</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            <div className="flex gap-2 flex-wrap">
              {progressItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={idx}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      item.complete 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' 
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{item.label}</span>
                    {item.complete && <CheckCircle2 className="w-3 h-3 ml-0.5" />}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-3 border-t bg-muted">
          <div className="w-full flex items-center justify-between">
            <span className="text-sm font-medium text-primary flex items-center gap-1">
              View Details
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
            {isAdmin && job.status !== "Signed Off" && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 gap-1"
                data-testid={`button-edit-job-${job.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation(`/jobs/${job.id}`);
                }}
              >
                <Pencil className="w-3 h-3" />
                Edit
              </Button>
            )}
          </div>
        </CardFooter>
      </div>
    </Card>
  );
}

function EngineerDashboard() {
  const { user } = useAuth();
  const { jobs } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [isClocking, setIsClocking] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("");

  const fetchClockStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/time/status", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setClockedIn(data.clockedIn);
        if (data.activeLog?.clockInTime) {
          setClockInTime(new Date(data.activeLog.clockInTime));
        }
      }
    } catch (error) {
      console.error("Failed to fetch clock status", error);
    }
  }, []);

  useEffect(() => {
    fetchClockStatus();
  }, [fetchClockStatus]);

  useEffect(() => {
    if (!clockedIn || !clockInTime) {
      setElapsedTime("");
      return;
    }
    const updateElapsed = () => {
      setElapsedTime(formatDistanceToNow(clockInTime, { addSuffix: false }));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 60000);
    return () => clearInterval(interval);
  }, [clockedIn, clockInTime]);

  const getLocationAndAddress = async (): Promise<{ latitude: number | null; longitude: number | null; address: string | null }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: null, longitude: null, address: null });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          let address = null;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            if (res.ok) {
              const data = await res.json();
              address = data.display_name || null;
            }
          } catch {
            console.error("Reverse geocoding failed");
          }
          resolve({ latitude: lat, longitude: lng, address });
        },
        () => resolve({ latitude: null, longitude: null, address: null }),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleClockInOut = async () => {
    setIsClocking(true);
    try {
      const location = await getLocationAndAddress();
      const endpoint = clockedIn ? "/api/time/clock-out" : "/api/time/clock-in";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(location),
      });
      if (res.ok) {
        const data = await res.json();
        if (clockedIn) {
          setClockedIn(false);
          setClockInTime(null);
          toast({ title: "Clocked Out", description: `Session ended at ${format(new Date(), "HH:mm")}` });
        } else {
          setClockedIn(true);
          setClockInTime(new Date(data.clockInTime));
          toast({ title: "Clocked In", description: `Started at ${format(new Date(), "HH:mm")}` });
        }
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to process request", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to clock in/out", variant: "destructive" });
    } finally {
      setIsClocking(false);
    }
  };

  const sortByOrder = (a: Job, b: Job) => {
    const orderA = a.orderNumber ?? 9999;
    const orderB = b.orderNumber ?? 9999;
    if (orderA !== orderB) return orderA - orderB;
    if (!a.session && b.session) return 1;
    if (a.session && !b.session) return -1;
    if (a.session && b.session && a.session !== b.session) return a.session.localeCompare(b.session);
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  };

  const myJobs = useMemo(() => 
    jobs.filter(job => job.assignedToId === user?.id || (job.assignedToIds || []).includes(user?.id || '')),
    [jobs, user?.id]
  );
  
  const todayJobs = useMemo(() => 
    myJobs
      .filter(job => job.date && isToday(parseISO(job.date)))
      .sort(sortByOrder),
    [myJobs]
  );

  const tomorrowJobs = useMemo(() => 
    myJobs
      .filter(job => job.date && isTomorrow(parseISO(job.date)))
      .sort(sortByOrder),
    [myJobs]
  );

  const upcomingJobs = useMemo(() => 
    myJobs
      .filter(job => {
        if (!job.date) return false;
        const jobDate = parseISO(job.date);
        return isThisWeek(jobDate) && !isToday(jobDate) && !isTomorrow(jobDate);
      })
      .sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB;
      }),
    [myJobs]
  );

  const activeJobs = useMemo(() => 
    myJobs.filter(job => job.status === "In Progress" || job.status === "Draft").sort(sortByOrder),
    [myJobs]
  );
  
  const completedJobs = useMemo(() => 
    myJobs.filter(job => job.status === "Signed Off").sort(sortByOrder),
    [myJobs]
  );
  
  const awaitingSignature = useMemo(() => 
    myJobs.filter(job => job.status === "Awaiting Signatures").sort(sortByOrder),
    [myJobs]
  );

  if (!user) return null;

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case "Draft": return "bg-slate-500 hover:bg-slate-600";
      case "In Progress": return "bg-blue-500 hover:bg-blue-600";
      case "Awaiting Signatures": return "bg-amber-500 hover:bg-amber-600";
      case "Signed Off": return "bg-emerald-600 hover:bg-emerald-700";
      default: return "bg-slate-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name}
          </p>
        </div>
      </div>

      {/* Clock In/Out Card */}
      <Card className={`border-2 ${clockedIn ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-border'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${clockedIn ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                <Timer className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-lg">
                  {clockedIn ? 'Currently On Shift' : 'Not Clocked In'}
                </p>
                {clockedIn && clockInTime && (
                  <p className="text-sm text-muted-foreground">
                    Started at {format(clockInTime, "HH:mm")} ({elapsedTime})
                  </p>
                )}
              </div>
            </div>
            <Button
              size="lg"
              onClick={handleClockInOut}
              disabled={isClocking}
              className={clockedIn ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}
              data-testid="button-clock-in-out"
            >
              {isClocking ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : clockedIn ? (
                <>
                  <LogOut className="h-5 w-5 mr-2" />
                  Clock Out
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Clock In
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Role-Based Portal Launchers */}
      <RolePortals user={user} setLocation={setLocation} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{activeJobs.length}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Active Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{todayJobs.length}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Today's Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Signature className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{awaitingSignature.length}</p>
                <p className="text-xs text-purple-600 dark:text-purple-400">Need Sign-off</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500 rounded-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{completedJobs.length}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Route */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Today's Route - {format(new Date(), "EEEE, dd MMMM")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {todayJobs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No jobs scheduled for today</p>
              <p className="text-sm">Enjoy your day off!</p>
            </div>
          ) : (
            <div className="divide-y">
              {todayJobs.map((job, index) => (
                <div
                  key={job.id}
                  className="p-4 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => setLocation(`/jobs/${job.id}`)}
                  data-testid={`route-job-${job.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      {index < todayJobs.length - 1 && (
                        <div className="w-0.5 h-8 bg-blue-200 dark:bg-blue-800 mt-2" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold truncate">{job.customerName || "Unknown Customer"}</span>
                        <Badge className={getStatusColor(job.status)}>{job.status || "Draft"}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{job.session || "No session"}</span>
                        {job.orderNumber && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">Order #{job.orderNumber}</Badge>
                        )}
                        <span className="text-xs font-mono">#{job.jobNo}</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span className="line-clamp-1">{job.address || "No address"}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tomorrow's Jobs */}
      {tomorrowJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Tomorrow - {format(new Date(Date.now() + 86400000), "EEEE, dd MMMM")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {tomorrowJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-4 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => setLocation(`/jobs/${job.id}`)}
                  data-testid={`tomorrow-job-${job.id}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{job.customerName || "Unknown Customer"}</span>
                        <Badge variant="outline" className="text-xs">{job.session || "TBD"}</Badge>
                        {job.orderNumber && (
                          <Badge variant="outline" className="text-xs px-1.5">#{job.orderNumber}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-1">{job.address || "No address"}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* This Week */}
      {upcomingJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Later This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {upcomingJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-4 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => setLocation(`/jobs/${job.id}`)}
                  data-testid={`upcoming-job-${job.id}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{job.customerName || "Unknown Customer"}</span>
                        <Badge variant="secondary" className="text-xs">
                          {job.date ? format(parseISO(job.date), "EEE dd") : "No date"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-1">{job.address || "No address"}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All My Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5 text-primary" />
            All Assigned Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">Active ({activeJobs.length})</TabsTrigger>
              <TabsTrigger value="review">Review ({awaitingSignature.length})</TabsTrigger>
              <TabsTrigger value="done">Done ({completedJobs.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeJobs.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No active jobs
                  </div>
                ) : activeJobs.map(job => (
                  <JobCard key={job.id} job={job} statusColor={getStatusColor(job.status)} isAdmin={false} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="review" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {awaitingSignature.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No jobs awaiting signatures
                  </div>
                ) : awaitingSignature.map(job => (
                  <JobCard key={job.id} job={job} statusColor={getStatusColor(job.status)} isAdmin={false} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="done" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedJobs.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No completed jobs yet
                  </div>
                ) : completedJobs.map(job => (
                  <JobCard key={job.id} job={job} statusColor={getStatusColor(job.status)} isAdmin={false} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
