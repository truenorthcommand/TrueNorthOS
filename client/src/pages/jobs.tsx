import { useState, memo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { apiRequest } from "@/lib/queryClient";
import { Job, JobStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Calendar, MapPin, User, ArrowRight, Camera, Signature, CheckCircle2, Pencil, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import type { User as UserType } from "@shared/schema";

export default function Jobs() {
  const { user } = useAuth();
  const { jobs, refreshJobs } = useStore();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [assignToEngineerId, setAssignToEngineerId] = useState<string>("");

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const engineers = users.filter((u) => u.role === "engineer" || u.role === "admin");

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ jobIds, assignedToId }: { jobIds: string[]; assignedToId: string }) => {
      const res = await apiRequest("POST", "/api/jobs/bulk-assign", { jobIds, assignedToId });
      return res.json();
    },
    onSuccess: (data) => {
      refreshJobs();
      setSelectedJobIds(new Set());
      setAssignToEngineerId("");
      toast.success(`${data.count} job(s) assigned`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to bulk assign jobs");
    },
  });

  const toggleJobSelection = (id: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedJobIds(new Set());
    setAssignToEngineerId("");
  };

  const handleBulkAssign = () => {
    if (!assignToEngineerId) {
      toast.error("Please select an engineer");
      return;
    }
    bulkAssignMutation.mutate({ jobIds: Array.from(selectedJobIds), assignedToId: assignToEngineerId });
  };

  if (!user) return null;

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
      case "Ready": return "bg-purple-500 hover:bg-purple-600";
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
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-jobs-title">Jobs in Progress</h1>
          <p className="text-muted-foreground">
            {user.role === "admin" ? "Track all field operations and completion status" : "Track your assigned jobs"}
          </p>
        </div>
        
        {user.role === "admin" && (
          <Button size="lg" className="w-full sm:w-auto" onClick={handleCreateJob} data-testid="button-new-job">
            <Plus className="mr-2 h-5 w-5" />
            New Job Sheet
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground ml-2" />
        <Input 
          placeholder="Search jobs, customers, or addresses..." 
          className="border-none shadow-none focus-visible:ring-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-testid="input-job-search"
        />
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
          <TabsTrigger value="active" data-testid="tab-active">Active</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="signatures" data-testid="tab-signatures">Review</TabsTrigger>
          <TabsTrigger value="done" data-testid="tab-done">Done</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.filter(j => j.status === "In Progress" || j.status === "Draft").length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No active jobs. Great work!
              </div>
            ) : filteredJobs.filter(j => j.status === "In Progress" || j.status === "Draft").map(job => (
               <JobCard 
                 key={job.id} 
                 job={job} 
                 statusColor={getStatusColor(job.status)} 
                 isAdmin={user.role === 'admin'}
                 isSelected={selectedJobIds.has(job.id)}
                 onToggleSelection={toggleJobSelection}
                 users={users}
               />
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
              <JobCard 
                key={job.id} 
                job={job} 
                statusColor={getStatusColor(job.status)} 
                isAdmin={user.role === 'admin'}
                isSelected={selectedJobIds.has(job.id)}
                onToggleSelection={toggleJobSelection}
                users={users}
              />
            ))}
          </div>
        </TabsContent>
        

        <TabsContent value="signatures" className="mt-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.filter(j => j.status === "Awaiting Signatures").length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No jobs awaiting signatures.
              </div>
            ) : filteredJobs.filter(j => j.status === "Awaiting Signatures").map(job => (
               <JobCard 
                 key={job.id} 
                 job={job} 
                 statusColor={getStatusColor(job.status)} 
                 isAdmin={user.role === 'admin'}
                 isSelected={selectedJobIds.has(job.id)}
                 onToggleSelection={toggleJobSelection}
                 users={users}
               />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="done" className="mt-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.filter(j => j.status === "Signed Off").length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No completed jobs.
              </div>
            ) : filteredJobs.filter(j => j.status === "Signed Off").map(job => (
               <JobCard 
                 key={job.id} 
                 job={job} 
                 statusColor={getStatusColor(job.status)} 
                 isAdmin={user.role === 'admin'}
                 isSelected={selectedJobIds.has(job.id)}
                 onToggleSelection={toggleJobSelection}
                 users={users}
               />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {user.role === "admin" && selectedJobIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
          <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm font-medium" data-testid="text-jobs-selected-count">
              {selectedJobIds.size} job(s) selected
            </span>
            <div className="flex items-center gap-2">
              <Select value={assignToEngineerId} onValueChange={setAssignToEngineerId}>
                <SelectTrigger className="w-[200px]" data-testid="select-assign-engineer">
                  <SelectValue placeholder="Select engineer" />
                </SelectTrigger>
                <SelectContent>
                  {engineers.map((eng) => (
                    <SelectItem key={eng.id} value={eng.id}>
                      {eng.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="default"
                onClick={handleBulkAssign}
                disabled={!assignToEngineerId || bulkAssignMutation.isPending}
                data-testid="button-bulk-assign"
              >
                {bulkAssignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Users className="h-4 w-4 mr-2" />
                Assign to Engineer
              </Button>
              <Button
                variant="outline"
                onClick={clearSelection}
                data-testid="button-clear-job-selection"
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function JobCard({ 
  job, 
  statusColor, 
  isAdmin,
  isSelected,
  onToggleSelection,
  users = [],
}: { 
  job: Job; 
  statusColor: string; 
  isAdmin: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  users?: UserType[];
}) {
  const [, setLocation] = useLocation();
  
  // Get assigned engineer name(s)
  const getEngineerNames = () => {
    const assignedIds = job.assignedToIds?.length ? job.assignedToIds : (job.assignedToId ? [job.assignedToId] : []);
    if (assignedIds.length === 0) return "Unassigned";
    const names = assignedIds
      .map(id => users.find(u => u.id === id)?.name)
      .filter(Boolean);
    if (names.length === 0) return "Unassigned";
    if (names.length === 1) return names[0];
    return `${names[0]} +${names.length - 1}`;
  };
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
            <div className="flex items-center gap-2">
              {isAdmin && onToggleSelection && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelection(job.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select job ${job.id}`}
                  data-testid={`checkbox-job-${job.id}`}
                />
              )}
              <Badge className={statusColor}>{job.status}</Badge>
            </div>
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
                <div className="line-clamp-2">
                  {job.propertyName && <span className="font-medium">{job.propertyName}</span>}
                  {job.propertyName && job.address && <span className="text-muted-foreground"> - </span>}
                  <span>{job.address || (job.propertyName ? "" : "No address set")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>{job.date ? format(new Date(job.date), "dd MMM yyyy") : "No date"} • {job.session || "No session"}{job.orderNumber ? ` • #${job.orderNumber}` : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 shrink-0" />
                <span>{getEngineerNames()}</span>
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
