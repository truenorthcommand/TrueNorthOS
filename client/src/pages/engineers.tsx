import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Job, Signature } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, Calendar, AlertCircle, Clock, CheckCircle2, User, 
  Briefcase, ArrowRight, Plus, RotateCw
} from "lucide-react";
import { format } from "date-fns";

interface Engineer {
  id: string;
  name: string;
  email: string;
  jobsCount: number;
  completionRate: number;
}

export default function Engineers() {
  const { user } = useAuth();
  const { jobs } = useStore();
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [returnVisits, setReturnVisits] = useState<Record<string, boolean>>({});

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
        <p className="text-muted-foreground">Only administrators can view this page.</p>
      </div>
    );
  }

  // Calculate priority based on job requirements
  const getJobPriority = (job: Job) => {
    if (job.status === "Signed Off") return "completed";
    
    const hasPhotos = job.photos.length > 0;
    const engineerSig = job.signatures.some((s: Signature) => s.type === "engineer");
    const customerSig = job.signatures.some((s: Signature) => s.type === "customer");
    
    // High priority: needs signatures but has photos
    if (hasPhotos && (!engineerSig || !customerSig)) return "high";
    
    // Medium priority: has some progress
    if (hasPhotos || engineerSig || job.status === "In Progress") return "medium";
    
    // Low priority: just started
    return "low";
  };

  // Group jobs by engineer
  const jobsByEngineer = jobs.reduce((acc, job) => {
    if (!acc[job.assignedToId]) {
      acc[job.assignedToId] = [];
    }
    acc[job.assignedToId].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  // Get engineer list from assigned jobs
  const engineers: Engineer[] = Array.from(
    new Map(
      Object.entries(jobsByEngineer).map(([engineerId, jobsList]) => [
        engineerId,
        {
          id: engineerId,
          name: jobsList[0]?.assignedToId === engineerId ? "Engineer" : `Engineer ${engineerId}`,
          email: `engineer.${engineerId}@company.com`,
          jobsCount: jobsList.length,
          completionRate: Math.round(
            (jobsList.filter(j => j.status === "Signed Off").length / jobsList.length) * 100
          ) || 0,
        }
      ])
    ).values()
  );

  // Filter jobs by priority
  const filterJobsByPriority = (jobList: Job[]) => {
    if (selectedPriority === "all") return jobList;
    return jobList.filter(job => getJobPriority(job) === selectedPriority);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
      case "medium":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "low":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "completed":
        return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      default:
        return "bg-slate-100 dark:bg-slate-800";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "High - Needs Signature";
      case "medium":
        return "Medium - In Progress";
      case "low":
        return "Low - Just Started";
      case "completed":
        return "Completed";
      default:
        return "All";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Engineers</h1>
        <p className="text-muted-foreground">
          Manage engineer assignments and track job progress
        </p>
      </div>

      {/* Priority Tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filter by Priority</span>
        </div>
        <Tabs value={selectedPriority} onValueChange={setSelectedPriority} className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
            <TabsTrigger value="all" className="flex items-center gap-2">
              All
            </TabsTrigger>
            <TabsTrigger value="high" className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" />
              High
            </TabsTrigger>
            <TabsTrigger value="medium" className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Medium
            </TabsTrigger>
            <TabsTrigger value="low" className="flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5" />
              Low
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Engineer Cards */}
      <div className="grid grid-cols-1 gap-6">
        {engineers.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
              No engineers assigned to jobs yet.
            </CardContent>
          </Card>
        ) : (
          engineers.map((engineer) => {
            const engineerJobs = filterJobsByPriority(jobsByEngineer[engineer.id] || []);
            
            return (
              <Card key={engineer.id} className="overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-semibold">
                          {engineer.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{engineer.name}</p>
                          <p className="text-sm text-muted-foreground">{engineer.email}</p>
                        </div>
                      </CardTitle>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 text-sm">
                      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded border">
                        <Briefcase className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{engineer.jobsCount}</span>
                        <span className="text-muted-foreground">jobs</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{engineer.completionRate}%</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  {engineerJobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No jobs in this priority category
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {engineerJobs.map((job) => {
                        const priority = getJobPriority(job);
                        const isReturnVisit = returnVisits[job.id];

                        return (
                          <div
                            key={job.id}
                            className={`p-4 rounded-lg border-l-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors ${getPriorityColor(
                              priority
                            )}`}
                          >
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  {job.jobNo}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {job.status}
                                </Badge>
                              </div>
                              <h4 className="font-semibold text-base">{job.customerName}</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                                  <span className="line-clamp-1">{job.address}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 shrink-0" />
                                  <span>
                                    {format(new Date(job.date), "dd MMM yyyy")} • {job.startTime}
                                  </span>
                                </div>
                              </div>

                              {/* Return Visit Checkbox */}
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-current border-opacity-20">
                                <Checkbox
                                  id={`return-${job.id}`}
                                  checked={isReturnVisit || false}
                                  onCheckedChange={(checked) => {
                                    setReturnVisits({
                                      ...returnVisits,
                                      [job.id]: checked === true,
                                    });
                                  }}
                                  className="w-4 h-4"
                                />
                                <label
                                  htmlFor={`return-${job.id}`}
                                  className="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                                >
                                  <RotateCw className="w-3.5 h-3.5" />
                                  Return Visit Required
                                </label>
                              </div>
                            </div>

                            {/* Job Requirements Status */}
                            <div className="flex-shrink-0 flex flex-col gap-2 text-xs font-medium">
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-black/20">
                                {job.photos.length > 0 ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Photos ✓</span>
                                  </>
                                ) : (
                                  <span className="text-current opacity-60">No photos</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-black/20">
                                {job.signatures.some(s => s.type === "engineer") ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Eng Sig ✓</span>
                                  </>
                                ) : (
                                  <span className="text-current opacity-60">Eng Sig</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-black/20">
                                {job.signatures.some(s => s.type === "customer") ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Cust Sig ✓</span>
                                  </>
                                ) : (
                                  <span className="text-current opacity-60">Cust Sig</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
