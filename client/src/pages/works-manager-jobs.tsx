import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Briefcase, Search, Filter, Users, Calendar, ExternalLink, RefreshCw } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  name: string;
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

const JOB_STATUSES = ['All', 'Draft', 'In Progress', 'Awaiting Signatures', 'Signed Off'];

export default function WorksManagerJobs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [engineerFilter, setEngineerFilter] = useState("all");
  const [reassignJob, setReassignJob] = useState<Job | null>(null);
  const [newAssignee, setNewAssignee] = useState("");

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/works-manager/jobs"],
  });

  const { data: team } = useQuery<TeamMember[]>({
    queryKey: ["/api/works-manager/team"],
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ jobId, assignedToId }: { jobId: string; assignedToId: string }) => {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedToId }),
      });
      if (!res.ok) throw new Error('Failed to reassign job');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/works-manager/jobs"] });
      setReassignJob(null);
      setNewAssignee("");
      toast({ title: "Job Reassigned", description: "The job has been reassigned successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reassign job", variant: "destructive" });
    },
  });

  const filteredJobs = jobs?.filter(job => {
    const matchesSearch = 
      job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.jobNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.address?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
    
    const matchesEngineer = engineerFilter === 'all' || 
      job.assignedToId === engineerFilter ||
      (job.assignedToIds && job.assignedToIds.includes(engineerFilter));
    
    return matchesSearch && matchesStatus && matchesEngineer;
  }) || [];

  const getAssigneeName = (job: Job) => {
    if (!team) return 'Unassigned';
    const assignee = team.find(m => m.id === job.assignedToId);
    return assignee?.name || 'Unassigned';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Signed Off':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Awaiting Signatures':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400';
    }
  };

  if (!user) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-primary" />
            Team Jobs
          </h1>
          <p className="text-muted-foreground">
            View and manage all jobs assigned to your team
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/works-manager/jobs"] })}
          data-testid="button-refresh-jobs"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer, job no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-jobs"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUSES.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Engineer</Label>
              <Select value={engineerFilter} onValueChange={setEngineerFilter}>
                <SelectTrigger data-testid="select-engineer-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Engineers</SelectItem>
                  {team?.map(member => (
                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Jobs ({filteredJobs.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading jobs...</p>
          ) : filteredJobs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No jobs found</p>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map(job => (
                <div 
                  key={job.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border"
                  data-testid={`job-row-${job.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono">{job.jobNo}</Badge>
                      <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                    </div>
                    <p className="font-medium mt-1">{job.customerName}</p>
                    <p className="text-sm text-muted-foreground truncate">{job.address || 'No address'}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {getAssigneeName(job)}
                      </span>
                      {job.date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {isValid(parseISO(job.date)) ? format(parseISO(job.date), 'dd/MM/yyyy') : 'Invalid date'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReassignJob(job);
                        setNewAssignee(job.assignedToId || '');
                      }}
                      disabled={job.status === 'Signed Off'}
                      data-testid={`button-reassign-${job.id}`}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Reassign
                    </Button>
                    <Link href={`/jobs/${job.id}`}>
                      <Button size="sm" data-testid={`button-view-job-${job.id}`}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reassignJob} onOpenChange={() => setReassignJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Job</DialogTitle>
          </DialogHeader>
          {reassignJob && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <p className="font-medium">{reassignJob.customerName}</p>
                <p className="text-sm text-muted-foreground">{reassignJob.jobNo}</p>
              </div>
              <div className="space-y-2">
                <Label>Assign to</Label>
                <Select value={newAssignee} onValueChange={setNewAssignee}>
                  <SelectTrigger data-testid="select-new-assignee">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {team?.map(member => (
                      <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignJob(null)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (reassignJob && newAssignee) {
                  reassignMutation.mutate({ jobId: reassignJob.id, assignedToId: newAssignee });
                }
              }}
              disabled={!newAssignee || reassignMutation.isPending}
              data-testid="button-confirm-reassign"
            >
              {reassignMutation.isPending ? 'Reassigning...' : 'Reassign Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
