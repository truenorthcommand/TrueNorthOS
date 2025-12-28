import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

interface Engineer {
  id: string;
  name: string;
  email: string;
  role: string;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationUpdate: string | null;
}

export default function Engineers() {
  const { user } = useAuth();
  const { jobs } = useStore();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [expandedEngineerId, setExpandedEngineerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetch('/api/users', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          const engineerList = data.filter((u: any) => u.role === 'engineer');
          setEngineers(engineerList);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [user]);

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">Only administrators can manage engineers.</p>
      </div>
    );
  }

  const getEngineerJobsCount = (engineerId: string) => {
    return jobs.filter((job) => job.assignedToId === engineerId && job.status !== "Signed Off").length;
  };

  const getEngineerCompletedCount = (engineerId: string) => {
    return jobs.filter((job) => job.assignedToId === engineerId && job.status === "Signed Off").length;
  };

  const getEngineerJobs = (engineerId: string) => {
    return jobs.filter((job) => job.assignedToId === engineerId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading engineers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Engineers</h1>
        <p className="text-muted-foreground">
          View field engineers and their job assignments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {engineers.map((engineer) => {
          const currentJobsCount = getEngineerJobsCount(engineer.id);
          const completedJobsCount = getEngineerCompletedCount(engineer.id);
          const allJobs = getEngineerJobs(engineer.id);
          
          return (
            <Card key={engineer.id} className="hover:shadow-md transition-shadow" data-testid={`card-engineer-${engineer.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between mb-2">
                  <Badge
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Active
                  </Badge>
                </div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {engineer.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{engineer.email}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {completedJobsCount}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">In Progress</p>
                    <p className="text-xl font-bold text-blue-600">
                      {currentJobsCount}
                    </p>
                  </div>
                </div>

                {expandedEngineerId === engineer.id && (
                  <div className="pt-3 border-t space-y-3">
                    <h4 className="font-semibold text-sm">Assigned Jobs ({allJobs.length})</h4>
                    {allJobs.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {allJobs.map((job) => (
                          <Link key={job.id} href={`/jobs/${job.id}`}>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border hover:border-primary transition-colors cursor-pointer">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{job.customerName}</p>
                                  <p className="text-xs text-muted-foreground">{job.jobNo}</p>
                                </div>
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs shrink-0"
                                >
                                  {job.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span>{job.date ? format(new Date(job.date), "dd MMM") : "No date"}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">No jobs assigned</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() =>
                      setExpandedEngineerId(
                        expandedEngineerId === engineer.id ? null : engineer.id
                      )
                    }
                    data-testid={`button-toggle-jobs-${engineer.id}`}
                  >
                    {expandedEngineerId === engineer.id ? "Hide" : "View"} Jobs
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {engineers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No engineers found in the system.</p>
        </div>
      )}
    </div>
  );
}
