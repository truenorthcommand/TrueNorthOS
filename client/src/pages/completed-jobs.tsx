import { useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Calendar, MapPin, User, CheckCircle2, ArrowRight, Eye } from "lucide-react";
import { format } from "date-fns";

export default function CompletedJobs() {
  const { user } = useAuth();
  const { jobs } = useStore();
  const [searchTerm, setSearchTerm] = useState("");

  if (!user) return null;

  // Filter for completed jobs only
  const completedJobs = jobs
    .filter((job) => job.status === "Signed Off")
    .filter((job) => {
      const matchesSearch =
        job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.jobNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.client.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = user.role === "admin" || job.assignedToId === user.id;

      return matchesSearch && matchesRole;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const totalCompleted = jobs.filter((j) => j.status === "Signed Off").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Completed Jobs</h1>
        <p className="text-muted-foreground">
          Archived and signed-off job sheets ({totalCompleted} total)
        </p>
      </div>

      <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground ml-2" />
        <Input
          placeholder="Search by job number, customer, address, or client..."
          className="border-none shadow-none focus-visible:ring-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {completedJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Completed Jobs</h2>
          <p className="text-muted-foreground">
            {searchTerm
              ? "No completed jobs match your search."
              : "All job sheets completed so far will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {completedJobs.map((job) => (
            <Card
              key={job.id}
              className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-emerald-600"
            >
              <Link href={`/jobs/${job.id}`}>
                <div className="h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">
                        Completed
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        {job.jobNo}
                      </span>
                    </div>
                    <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                      {job.customerName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {job.client}
                    </p>
                  </CardHeader>
                  <CardContent className="flex-1 pb-3">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{job.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span>
                          {format(new Date(job.date), "dd MMM yyyy")} •{" "}
                          {job.startTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 shrink-0" />
                        <span>{job.contactName || "No contact"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>
                          Signed off{" "}
                          {format(new Date(job.updatedAt), "dd MMM yyyy")}
                        </span>
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
          ))}
        </div>
      )}
    </div>
  );
}
