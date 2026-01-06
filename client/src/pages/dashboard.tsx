import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Job, JobStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calendar, MapPin, User, ArrowRight, Camera, Signature, CheckCircle2, Pencil, Clock, Navigation, Briefcase, CheckCircle } from "lucide-react";
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const { user } = useAuth();
  const { jobs } = useStore();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  if (!user) return null;

  // For engineers, show the engineer-specific dashboard
  if (user.role === "engineer") {
    return <EngineerDashboard />;
  }

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = 
      job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.jobNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.address || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = user.role === "admin" || job.assignedToId === user.id || (job.assignedToIds || []).includes(user.id);

    return matchesSearch && matchesRole;
  });

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case "Draft": return "bg-slate-500 hover:bg-slate-600";
      case "In Progress": return "bg-blue-500 hover:bg-blue-600";
      case "Awaiting Signatures": return "bg-amber-500 hover:bg-amber-600";
      case "Signed Off": return "bg-emerald-600 hover:bg-emerald-700";
      default: return "bg-slate-500";
    }
  };

  const handleCreateJob = () => {
    setLocation("/clients");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs in Progress</h1>
          <p className="text-muted-foreground">
            {user.role === "admin" ? "Track all field operations and completion status" : "Track your assigned jobs"}
          </p>
        </div>
        
        <Button size="lg" className="w-full sm:w-auto" onClick={handleCreateJob}>
          <Plus className="mr-2 h-5 w-5" />
          New Job Sheet
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground ml-2" />
        <Input 
          placeholder="Search jobs, customers, or addresses..." 
          className="border-none shadow-none focus-visible:ring-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="signatures">Review</TabsTrigger>
          <TabsTrigger value="done">Done</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.filter(j => j.status === "In Progress" || j.status === "Draft").length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No active jobs. Great work!
              </div>
            ) : filteredJobs.filter(j => j.status === "In Progress" || j.status === "Draft").map(job => (
               <JobCard key={job.id} job={job} statusColor={getStatusColor(job.status)} isAdmin={user.role === 'admin'} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.length === 0 ? (
               <div className="col-span-full text-center py-12 text-muted-foreground">
                 No jobs found.
               </div>
            ) : filteredJobs.map(job => (
              <JobCard key={job.id} job={job} statusColor={getStatusColor(job.status)} isAdmin={user.role === 'admin'} />
            ))}
          </div>
        </TabsContent>
        

        <TabsContent value="signatures" className="mt-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.filter(j => j.status === "Awaiting Signatures").map(job => (
               <JobCard key={job.id} job={job} statusColor={getStatusColor(job.status)} isAdmin={user.role === 'admin'} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="done" className="mt-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.filter(j => j.status === "Signed Off").map(job => (
               <JobCard key={job.id} job={job} statusColor={getStatusColor(job.status)} isAdmin={user.role === 'admin'} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
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
                <span>{job.date ? format(new Date(job.date), "dd MMM yyyy") : "No date"} • {job.session || "No session"}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 shrink-0" />
                <span>{job.contactName || "No contact"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Progress</span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{completedCount}/{progressItems.length}</span>
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
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
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
        <CardFooter className="pt-3 border-t bg-slate-50 dark:bg-slate-900/50">
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

  if (!user) return null;

  const myJobs = jobs.filter(job => job.assignedToId === user.id || (job.assignedToIds || []).includes(user.id));
  
  const todayJobs = myJobs
    .filter(job => job.date && isToday(parseISO(job.date)))
    .sort((a, b) => {
      const orderA = a.orderNumber ?? 9999;
      const orderB = b.orderNumber ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      if (!a.session && b.session) return 1;
      if (a.session && !b.session) return -1;
      if (a.session && b.session && a.session !== b.session) return a.session.localeCompare(b.session);
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });

  const tomorrowJobs = myJobs
    .filter(job => job.date && isTomorrow(parseISO(job.date)))
    .sort((a, b) => {
      const orderA = a.orderNumber ?? 9999;
      const orderB = b.orderNumber ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      if (!a.session && b.session) return 1;
      if (a.session && !b.session) return -1;
      if (a.session && b.session && a.session !== b.session) return a.session.localeCompare(b.session);
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });

  const upcomingJobs = myJobs
    .filter(job => {
      if (!job.date) return false;
      const jobDate = parseISO(job.date);
      return isThisWeek(jobDate) && !isToday(jobDate) && !isTomorrow(jobDate);
    })
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });

  const activeJobs = myJobs.filter(job => job.status === "In Progress" || job.status === "Draft");
  const completedJobs = myJobs.filter(job => job.status === "Signed Off");
  const awaitingSignature = myJobs.filter(job => job.status === "Awaiting Signatures");

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
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors"
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
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/jobs/${job.id}`)}
                  data-testid={`tomorrow-job-${job.id}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{job.customerName || "Unknown Customer"}</span>
                        <Badge variant="outline" className="text-xs">{job.session || "TBD"}</Badge>
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
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors"
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
