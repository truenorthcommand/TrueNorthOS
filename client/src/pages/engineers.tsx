import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, User, BarChart3, CheckCircle2, AlertCircle, MapPin, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";

interface Engineer {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  jobsCompleted: number;
}

const MOCK_ENGINEERS: Engineer[] = [
  {
    id: "eng-1",
    name: "John Smith",
    email: "john@fieldflow.com",
    status: "active",
    jobsCompleted: 24,
  },
  {
    id: "eng-2",
    name: "Sarah Jones",
    email: "sarah@fieldflow.com",
    status: "active",
    jobsCompleted: 31,
  },
  {
    id: "eng-3",
    name: "Mike Davis",
    email: "mike@fieldflow.com",
    status: "inactive",
    jobsCompleted: 18,
  },
];

export default function Engineers() {
  const { user } = useAuth();
  const { jobs } = useStore();
  const { toast } = useToast();

  const [engineers, setEngineers] = useState<Engineer[]>(MOCK_ENGINEERS);
  const [newEngineer, setNewEngineer] = useState({
    name: "",
    email: "",
  });
  const [expandedEngineerId, setExpandedEngineerId] = useState<string | null>(null);

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">Only administrators can manage engineers.</p>
      </div>
    );
  }

  const handleAddEngineer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEngineer.name || !newEngineer.email) {
      toast({
        title: "Missing Information",
        description: "Please enter engineer name and email.",
        variant: "destructive",
      });
      return;
    }

    const engineer: Engineer = {
      id: `eng-${Date.now()}`,
      name: newEngineer.name,
      email: newEngineer.email,
      status: "active",
      jobsCompleted: 0,
    };

    setEngineers([...engineers, engineer]);
    setNewEngineer({ name: "", email: "" });

    toast({
      title: "Engineer Added",
      description: `${newEngineer.name} has been added to the team.`,
    });
  };

  const handleDeleteEngineer = (id: string) => {
    if (confirm("Are you sure you want to remove this engineer?")) {
      setEngineers(engineers.filter((e) => e.id !== id));
      toast({
        title: "Engineer Removed",
        variant: "default",
      });
    }
  };

  const handleToggleStatus = (id: string) => {
    setEngineers(
      engineers.map((e) =>
        e.id === id
          ? { ...e, status: e.status === "active" ? "inactive" : "active" }
          : e
      )
    );
  };

  const getEngineerJobsCount = (engineerId: string) => {
    return jobs.filter((job) => job.assignedToId === engineerId).length;
  };

  const getEngineerJobs = (engineerId: string) => {
    return jobs.filter((job) => job.assignedToId === engineerId);
  };

  const handleReassignJob = (jobId: string, newEngineerId: string) => {
    // This would require updateJob from store, but since we don't have direct access
    // we'll need to pass this to the store
    const store = useStore();
    store.updateJob(jobId, { assignedToId: newEngineerId });
    toast({
      title: "Job Reassigned",
      description: "Job has been reassigned successfully.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Engineers</h1>
        <p className="text-muted-foreground">
          Manage field engineers and monitor their job assignments
        </p>
      </div>

      {/* Add New Engineer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Engineer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddEngineer} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="Engineer name"
                  value={newEngineer.name}
                  onChange={(e) =>
                    setNewEngineer({ ...newEngineer, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="engineer@company.com"
                  value={newEngineer.email}
                  onChange={(e) =>
                    setNewEngineer({ ...newEngineer, email: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" />
                Add Engineer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Engineers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {engineers.map((engineer) => {
          const currentJobsCount = getEngineerJobsCount(engineer.id);
          return (
            <Card key={engineer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between mb-2">
                  <Badge
                    variant={engineer.status === "active" ? "default" : "secondary"}
                    className={
                      engineer.status === "active"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : ""
                    }
                  >
                    {engineer.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                  <button
                    onClick={() => handleToggleStatus(engineer.id)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Toggle
                  </button>
                </div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {engineer.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{engineer.email}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Completed</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {engineer.jobsCompleted}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">In Progress</p>
                    <p className="text-xl font-bold text-blue-600">
                      {currentJobsCount}
                    </p>
                  </div>
                </div>

                {/* Assigned Jobs Section */}
                {expandedEngineerId === engineer.id && (
                  <div className="pt-3 border-t space-y-3">
                    <h4 className="font-semibold text-sm">Assigned Jobs ({currentJobsCount})</h4>
                    {getEngineerJobs(engineer.id).length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {getEngineerJobs(engineer.id).map((job) => (
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
                                <span>{format(new Date(job.date), "dd MMM")}</span>
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

                {/* Action Buttons */}
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
                  >
                    {expandedEngineerId === engineer.id ? "Hide" : "View"} Jobs
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleDeleteEngineer(engineer.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {engineers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No engineers added yet. Create your first engineer above.</p>
        </div>
      )}
    </div>
  );
}
