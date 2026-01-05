import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Job, JobStatus, User as UserType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Clock, User, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, addMonths, subMonths, getDay, isToday, isValid } from "date-fns";

function safeParseISO(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { jobs } = useStore();
  const [, setLocation] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [engineers, setEngineers] = useState<{id: string; name: string}[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetch('/api/users', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          const engineerList = data.filter((u: any) => u.role === 'engineer');
          setEngineers(engineerList.map((e: any) => ({ id: e.id, name: e.name })));
        })
        .catch(() => {});
    }
  }, [user]);

  const getEngineerNames = (job: Job): string => {
    const ids = job.assignedToIds && job.assignedToIds.length > 0 
      ? job.assignedToIds 
      : job.assignedToId ? [job.assignedToId] : [];
    return ids.map(id => engineers.find(e => e.id === id)?.name || '').filter(Boolean).join(', ');
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Access denied. Admin only.</p>
      </div>
    );
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = getDay(monthStart);
  const endDayOfWeek = getDay(monthEnd);
  const trailingDays = endDayOfWeek === 6 ? 0 : 6 - endDayOfWeek;

  const getJobsForDate = (date: Date): Job[] => {
    return jobs.filter(job => {
      const jobDate = safeParseISO(job.date);
      if (!jobDate) return false;
      return isSameDay(jobDate, date);
    });
  };

  const getStatusColor = (status: JobStatus): string => {
    switch (status) {
      case "Draft": return "bg-slate-500";
      case "In Progress": return "bg-blue-500";
      case "Awaiting Signatures": return "bg-amber-500";
      case "Signed Off": return "bg-emerald-500";
      default: return "bg-slate-500";
    }
  };

  const getMonthStats = () => {
    const monthJobs = jobs.filter(job => {
      const jobDate = safeParseISO(job.date);
      if (!jobDate) return false;
      return isSameMonth(jobDate, currentMonth);
    });

    return {
      total: monthJobs.length,
      draft: monthJobs.filter(j => j.status === "Draft").length,
      inProgress: monthJobs.filter(j => j.status === "In Progress").length,
      awaiting: monthJobs.filter(j => j.status === "Awaiting Signatures").length,
      signedOff: monthJobs.filter(j => j.status === "Signed Off").length,
    };
  };

  const stats = getMonthStats();
  const selectedDateJobs = selectedDate ? getJobsForDate(selectedDate) : [];

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-8 w-8 text-primary" />
            Job Calendar
          </h1>
          <p className="text-muted-foreground">
            View all jobs scheduled for each month
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-slate-500">{stats.draft}</p>
            <p className="text-sm text-muted-foreground">Draft</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">{stats.inProgress}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{stats.awaiting}</p>
            <p className="text-sm text-muted-foreground">Awaiting</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-500">{stats.signedOff}</p>
            <p className="text-sm text-muted-foreground">Signed Off</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-xl">
              {format(currentMonth, "MMMM yyyy")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
                data-testid="button-today"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}

              {Array.from({ length: startDayOfWeek }).map((_, index) => (
                <div key={`empty-start-${index}`} className="h-24 bg-slate-50 dark:bg-slate-900/50 rounded" />
              ))}

              {daysInMonth.map(day => {
                const dayJobs = getJobsForDate(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`h-24 p-1 rounded border cursor-pointer transition-colors overflow-hidden ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : isTodayDate
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    }`}
                    onClick={() => setSelectedDate(day)}
                    data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isTodayDate ? "text-blue-600 dark:text-blue-400" : ""
                    }`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayJobs.slice(0, 3).map(job => {
                        const engineerNames = getEngineerNames(job);
                        return (
                          <div
                            key={job.id}
                            className={`text-xs px-1 py-0.5 rounded truncate text-white ${getStatusColor(job.status)}`}
                            title={`${job.customerName}${engineerNames ? ` - ${engineerNames}` : ''}`}
                          >
                            {job.startTime || ""} {engineerNames ? `[${engineerNames.split(',')[0].split(' ')[0]}]` : ''} {job.customerName}
                          </div>
                        );
                      })}
                      {dayJobs.length > 3 && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{dayJobs.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {Array.from({ length: trailingDays }).map((_, index) => (
                <div key={`empty-end-${index}`} className="h-24 bg-slate-50 dark:bg-slate-900/50 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDate ? format(selectedDate, "EEEE, dd MMMM yyyy") : "Select a date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-muted-foreground text-center py-8">
                Click on a date to see scheduled jobs
              </p>
            ) : selectedDateJobs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No jobs scheduled for this date
              </p>
            ) : (
              <div className="space-y-3">
                {selectedDateJobs.map(job => (
                  <div
                    key={job.id}
                    className="p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/jobs/${job.id}`)}
                    data-testid={`calendar-job-${job.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                      <span className="text-xs font-mono text-muted-foreground">{job.jobNo}</span>
                    </div>
                    <p className="font-medium text-sm mb-2">{job.customerName}</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {job.startTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{job.startTime}</span>
                        </div>
                      )}
                      {job.address && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="line-clamp-1">{job.address}</span>
                        </div>
                      )}
                      {job.contactName && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{job.contactName}</span>
                        </div>
                      )}
                      {getEngineerNames(job) && (
                        <div className="flex items-center gap-1 mt-1 pt-1 border-t">
                          <Users className="h-3 w-3 text-primary" />
                          <span className="font-medium text-primary">{getEngineerNames(job)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
