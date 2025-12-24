import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Job, JobStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calendar, MapPin, User, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
  const { user } = useAuth();
  const { jobs, addJob } = useStore();
  const [searchTerm, setSearchTerm] = useState("");

  if (!user) return null;

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = 
      job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.jobNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.address.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = user.role === "admin" || job.assignedToId === user.id;

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
    // Quick create for prototype
    addJob({
      jobNo: `J-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
      customerName: "New Customer",
      address: "",
      postcode: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      date: new Date().toISOString(),
      startTime: "09:00",
      description: "",
      notes: "",
      status: "Draft",
      assignedToId: user.id, // Assign to self for now
      materials: [],
      photos: [],
      signatures: [],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">
            {user.role === "admin" ? "Manage all field operations" : "Your assigned tasks"}
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

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="signatures">Review</TabsTrigger>
          <TabsTrigger value="done">Done</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.length === 0 ? (
               <div className="col-span-full text-center py-12 text-muted-foreground">
                 No jobs found.
               </div>
            ) : filteredJobs.map(job => (
              <JobCard key={job.id} job={job} statusColor={getStatusColor(job.status)} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="active" className="mt-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.filter(j => j.status === "In Progress" || j.status === "Draft").map(job => (
               <JobCard key={job.id} job={job} statusColor={getStatusColor(job.status)} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="signatures" className="mt-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.filter(j => j.status === "Awaiting Signatures").map(job => (
               <JobCard key={job.id} job={job} statusColor={getStatusColor(job.status)} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="done" className="mt-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.filter(j => j.status === "Signed Off").map(job => (
               <JobCard key={job.id} job={job} statusColor={getStatusColor(job.status)} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JobCard({ job, statusColor }: { job: Job, statusColor: string }) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group border-l-4" style={{ borderLeftColor: statusColor.includes('blue') ? 'var(--primary)' : undefined }}>
      <Link href={`/jobs/${job.id}`}>
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
          <CardContent className="flex-1 pb-3">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{job.address || "No address set"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>{format(new Date(job.date), "dd MMM yyyy")} • {job.startTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 shrink-0" />
                <span>{job.contactName || "No contact"}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-3 border-t bg-slate-50 dark:bg-slate-900/50">
            <div className="w-full flex items-center justify-between text-sm font-medium text-primary">
              View Details
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </CardFooter>
        </div>
      </Link>
    </Card>
  );
}
