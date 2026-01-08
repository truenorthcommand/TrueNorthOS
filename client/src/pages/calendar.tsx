import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Job, JobStatus, User as UserType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  User,
  Users,
  LayoutGrid,
  MoreVertical,
  X,
  GripVertical,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
  getDay,
  isToday,
  isValid,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
} from "date-fns";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function safeParseISO(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

type Engineer = {
  id: string;
  name: string;
};

function DraggableJobCard({
  job,
  onRemoveFromDay,
  onClick,
}: {
  job: Job;
  onRemoveFromDay: (jobId: string) => void;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: job.id,
      data: { job },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const getStatusColor = (status: JobStatus): string => {
    switch (status) {
      case "Draft":
        return "bg-slate-500";
      case "In Progress":
        return "bg-blue-500";
      case "Awaiting Signatures":
        return "bg-amber-500";
      case "Signed Off":
        return "bg-emerald-500";
      default:
        return "bg-slate-500";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-slate-800 border rounded-md p-2 mb-1 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
      data-testid={`planner-job-${job.id}`}
    >
      <div className="flex items-start gap-1">
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 pt-0.5 cursor-grab"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0" onClick={onClick}>
          <div className="flex items-center gap-1 mb-1">
            <Badge
              className={`${getStatusColor(job.status)} text-xs px-1 py-0`}
            >
              {job.status === "Awaiting Signatures" ? "Await" : job.status}
            </Badge>
            {job.session && (
              <span className="text-xs text-muted-foreground flex items-center">
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                {job.session}
              </span>
            )}
          </div>
          <p className="text-xs font-medium truncate">{job.customerName}</p>
          {job.postcode && (
            <p className="text-xs text-muted-foreground truncate flex items-center">
              <MapPin className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
              {job.postcode}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 flex-shrink-0"
              data-testid={`planner-job-menu-${job.id}`}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onRemoveFromDay(job.id)}
              data-testid={`planner-remove-job-${job.id}`}
            >
              <X className="h-4 w-4 mr-2" />
              Remove from day
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function DroppableCell({
  id,
  children,
  isEmpty,
}: {
  id: string;
  children: React.ReactNode;
  isEmpty: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[100px] p-1 border-r border-b transition-colors ${
        isOver
          ? "bg-primary/10 border-primary"
          : isEmpty
          ? "bg-slate-50 dark:bg-slate-900/30"
          : ""
      }`}
      data-testid={`planner-cell-${id}`}
    >
      {children}
    </div>
  );
}

function JobCardOverlay({ job }: { job: Job }) {
  const getStatusColor = (status: JobStatus): string => {
    switch (status) {
      case "Draft":
        return "bg-slate-500";
      case "In Progress":
        return "bg-blue-500";
      case "Awaiting Signatures":
        return "bg-amber-500";
      case "Signed Off":
        return "bg-emerald-500";
      default:
        return "bg-slate-500";
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border-2 border-primary rounded-md p-2 shadow-lg w-48">
      <div className="flex items-center gap-1 mb-1">
        <Badge className={`${getStatusColor(job.status)} text-xs px-1 py-0`}>
          {job.status === "Awaiting Signatures" ? "Await" : job.status}
        </Badge>
        {job.session && (
          <span className="text-xs text-muted-foreground">{job.session}</span>
        )}
      </div>
      <p className="text-xs font-medium truncate">{job.customerName}</p>
    </div>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { jobs, refreshJobs } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [engineers, setEngineers] = useState<Engineer[]>([]);

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [visibleEngineerIds, setVisibleEngineerIds] = useState<string[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [engineerDialogOpen, setEngineerDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  // Sync planner week with calendar month - show first week of the current month
  useEffect(() => {
    const monthStart = startOfMonth(currentMonth);
    const newWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    setWeekStart(newWeekStart);
  }, [currentMonth]);

  // When a date is selected on calendar, sync planner to that week
  useEffect(() => {
    if (selectedDate) {
      const newWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      setWeekStart(newWeekStart);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetch("/api/users", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          const engineerList = data.filter((u: any) => u.role === "engineer");
          const mapped = engineerList.map((e: any) => ({
            id: e.id,
            name: e.name,
          }));
          setEngineers(mapped);
          const savedIds = localStorage.getItem("plannerVisibleEngineers");
          if (savedIds) {
            try {
              const parsed = JSON.parse(savedIds);
              const validIds = parsed.filter((id: string) =>
                mapped.some((e: Engineer) => e.id === id)
              );
              setVisibleEngineerIds(
                validIds.length > 0 ? validIds : mapped.map((e: Engineer) => e.id)
              );
            } catch {
              setVisibleEngineerIds(mapped.map((e: Engineer) => e.id));
            }
          } else {
            setVisibleEngineerIds(mapped.map((e: Engineer) => e.id));
          }
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (visibleEngineerIds.length > 0) {
      localStorage.setItem(
        "plannerVisibleEngineers",
        JSON.stringify(visibleEngineerIds)
      );
    }
  }, [visibleEngineerIds]);

  const getEngineerNames = (job: Job): string => {
    const ids =
      job.assignedToIds && job.assignedToIds.length > 0
        ? job.assignedToIds
        : job.assignedToId
        ? [job.assignedToId]
        : [];
    return ids
      .map((id) => engineers.find((e) => e.id === id)?.name || "")
      .filter(Boolean)
      .join(", ");
  };

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const visibleEngineers = useMemo(() => {
    return engineers.filter((e) => visibleEngineerIds.includes(e.id));
  }, [engineers, visibleEngineerIds]);

  const getJobsForCell = (engineerId: string, date: Date): Job[] => {
    return jobs.filter((job) => {
      if (job.status === "Draft") return false;
      const jobDate = safeParseISO(job.date);
      if (!jobDate || !isSameDay(jobDate, date)) return false;
      const assignedIds =
        job.assignedToIds && job.assignedToIds.length > 0
          ? job.assignedToIds
          : job.assignedToId
          ? [job.assignedToId]
          : [];
      return assignedIds.includes(engineerId);
    });
  };

  const getUnassignedJobsForDay = (date: Date): Job[] => {
    return jobs.filter((job) => {
      if (job.status === "Draft") return false;
      const jobDate = safeParseISO(job.date);
      if (!jobDate || !isSameDay(jobDate, date)) return false;
      const assignedIds =
        job.assignedToIds && job.assignedToIds.length > 0
          ? job.assignedToIds
          : job.assignedToId
          ? [job.assignedToId]
          : [];
      const hasNoAssignment = assignedIds.length === 0;
      const assignedToHiddenEngineer = assignedIds.length > 0 && 
        !assignedIds.some((id) => visibleEngineerIds.includes(id));
      return hasNoAssignment || assignedToHiddenEngineer;
    });
  };

  const updateJobMutation = useMutation({
    mutationFn: async ({
      jobId,
      date,
      engineerId,
    }: {
      jobId: string;
      date: string | null;
      engineerId?: string;
    }) => {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: date,
          assignedToId: engineerId,
          assignedToIds: engineerId ? [engineerId] : [],
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update job");
      }
      return response.json();
    },
    onSuccess: () => {
      refreshJobs();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const job = active.data.current?.job as Job;
    if (job) {
      setActiveJob(job);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveJob(null);

    if (!over) return;

    const jobId = active.id as string;
    const targetCellId = over.id as string;

    const [engineerId, dateStr] = targetCellId.split("_");
    if (!engineerId || !dateStr) return;

    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    const currentAssignedIds =
      job.assignedToIds && job.assignedToIds.length > 0
        ? job.assignedToIds
        : job.assignedToId
        ? [job.assignedToId]
        : [];
    const currentDate = safeParseISO(job.date);
    const targetDate = parseISO(dateStr);

    const isSameCell =
      currentAssignedIds.includes(engineerId) &&
      currentDate &&
      isSameDay(currentDate, targetDate);

    if (isSameCell) return;

    const fullIsoDate = new Date(targetDate).toISOString();

    updateJobMutation.mutate({
      jobId,
      date: fullIsoDate,
      engineerId,
    });

    toast({
      title: "Job moved",
      description: `Moved to ${
        engineers.find((e) => e.id === engineerId)?.name
      } on ${format(targetDate, "EEE dd MMM")}`,
    });
  };

  const handleRemoveFromDay = (jobId: string) => {
    updateJobMutation.mutate({
      jobId,
      date: null,
    });
    toast({
      title: "Job removed from schedule",
      description: "The job has been removed from the planner but not deleted.",
    });
  };

  const toggleEngineer = (engineerId: string) => {
    setVisibleEngineerIds((prev) =>
      prev.includes(engineerId)
        ? prev.filter((id) => id !== engineerId)
        : [...prev, engineerId]
    );
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
    return jobs.filter((job) => {
      const jobDate = safeParseISO(job.date);
      if (!jobDate) return false;
      return isSameDay(jobDate, date);
    });
  };

  const getStatusColor = (status: JobStatus): string => {
    switch (status) {
      case "Draft":
        return "bg-slate-500";
      case "In Progress":
        return "bg-blue-500";
      case "Awaiting Signatures":
        return "bg-amber-500";
      case "Signed Off":
        return "bg-emerald-500";
      default:
        return "bg-slate-500";
    }
  };

  const getMonthStats = () => {
    const monthJobs = jobs.filter((job) => {
      const jobDate = safeParseISO(job.date);
      if (!jobDate) return false;
      return isSameMonth(jobDate, currentMonth);
    });

    return {
      total: monthJobs.length,
      draft: monthJobs.filter((j) => j.status === "Draft").length,
      inProgress: monthJobs.filter((j) => j.status === "In Progress").length,
      awaiting: monthJobs.filter((j) => j.status === "Awaiting Signatures")
        .length,
      signedOff: monthJobs.filter((j) => j.status === "Signed Off").length,
    };
  };

  const stats = getMonthStats();
  const selectedDateJobs = selectedDate ? getJobsForDate(selectedDate) : [];

  const calendarWeekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
            <p className="text-3xl font-bold text-blue-500">
              {stats.inProgress}
            </p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">
              {stats.awaiting}
            </p>
            <p className="text-sm text-muted-foreground">Awaiting</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-500">
              {stats.signedOff}
            </p>
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
              {calendarWeekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}

              {Array.from({ length: startDayOfWeek }).map((_, index) => (
                <div
                  key={`empty-start-${index}`}
                  className="h-24 bg-slate-50 dark:bg-slate-900/50 rounded"
                />
              ))}

              {daysInMonth.map((day) => {
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
                    <div
                      className={`text-sm font-medium mb-1 ${
                        isTodayDate ? "text-blue-600 dark:text-blue-400" : ""
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayJobs.slice(0, 3).map((job) => {
                        const engineerNames = getEngineerNames(job);
                        return (
                          <div
                            key={job.id}
                            className={`text-xs px-1 py-0.5 rounded truncate text-white ${getStatusColor(job.status)}`}
                            title={`${job.customerName}${engineerNames ? ` - ${engineerNames}` : ""}`}
                          >
                            {job.session || ""}{" "}
                            {engineerNames
                              ? `[${engineerNames.split(",")[0].split(" ")[0]}]`
                              : ""}{" "}
                            {job.customerName}
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
                <div
                  key={`empty-end-${index}`}
                  className="h-24 bg-slate-50 dark:bg-slate-900/50 rounded"
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDate
                ? format(selectedDate, "EEEE, dd MMMM yyyy")
                : "Select a date"}
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
                {selectedDateJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/jobs/${job.id}`)}
                    data-testid={`calendar-job-${job.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        {job.jobNo}
                      </span>
                    </div>
                    <p className="font-medium text-sm mb-2">
                      {job.customerName}
                    </p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {job.session && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{job.session}</span>
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
                          <span className="font-medium text-primary">
                            {getEngineerNames(job)}
                          </span>
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

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LayoutGrid className="h-6 w-6 text-primary" />
              Planner Board
            </h2>
            <p className="text-muted-foreground">
              Drag and drop jobs to schedule engineers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog
              open={engineerDialogOpen}
              onOpenChange={setEngineerDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-manage-engineers">
                  <Users className="h-4 w-4 mr-2" />
                  Engineers ({visibleEngineers.length})
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Show/Hide Engineers</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {engineers.map((engineer) => (
                      <div
                        key={engineer.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Checkbox
                          id={`engineer-${engineer.id}`}
                          checked={visibleEngineerIds.includes(engineer.id)}
                          onCheckedChange={() => toggleEngineer(engineer.id)}
                          data-testid={`checkbox-engineer-${engineer.id}`}
                        />
                        <label
                          htmlFor={`engineer-${engineer.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          {engineer.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const newWeek = subWeeks(weekStart, 1);
                setWeekStart(newWeek);
                setCurrentMonth(newWeek);
              }}
              data-testid="button-prev-week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
                setCurrentMonth(today);
              }}
              data-testid="button-this-week"
            >
              This Week
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const newWeek = addWeeks(weekStart, 1);
                setWeekStart(newWeek);
                setCurrentMonth(newWeek);
              }}
              data-testid="button-next-week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-lg">
              Week of {format(weekStart, "dd MMM yyyy")} -{" "}
              {format(addDays(weekStart, 6), "dd MMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="min-w-[900px]">
                <div className="grid grid-cols-8 border-t border-l">
                  <div className="p-2 font-medium text-sm bg-slate-100 dark:bg-slate-800 border-r border-b">
                    Engineer
                  </div>
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`p-2 text-center font-medium text-sm border-r border-b ${
                        isSameDay(day, new Date())
                          ? "bg-primary/10 text-primary"
                          : "bg-slate-100 dark:bg-slate-800"
                      }`}
                    >
                      <div>{format(day, "EEE")}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(day, "dd MMM")}
                      </div>
                    </div>
                  ))}

                  {visibleEngineers.map((engineer) => (
                    <>
                      <div
                        key={`name-${engineer.id}`}
                        className="p-2 font-medium text-sm border-r border-b bg-slate-50 dark:bg-slate-900/50 flex items-center"
                      >
                        {engineer.name}
                      </div>
                      {weekDays.map((day) => {
                        const cellId = `${engineer.id}_${format(day, "yyyy-MM-dd")}`;
                        const cellJobs = getJobsForCell(engineer.id, day);
                        return (
                          <DroppableCell
                            key={cellId}
                            id={cellId}
                            isEmpty={cellJobs.length === 0}
                          >
                            {cellJobs.map((job) => (
                              <DraggableJobCard
                                key={job.id}
                                job={job}
                                onRemoveFromDay={handleRemoveFromDay}
                                onClick={() => setLocation(`/jobs/${job.id}`)}
                              />
                            ))}
                          </DroppableCell>
                        );
                      })}
                    </>
                  ))}

                  {/* Unassigned / Other Engineers Row */}
                  <>
                    <div className="p-2 font-medium text-sm border-r border-b bg-amber-50 dark:bg-amber-900/20 flex items-center text-amber-700 dark:text-amber-400">
                      Unassigned / Other
                    </div>
                    {weekDays.map((day) => {
                      const unassignedJobs = getUnassignedJobsForDay(day);
                      return (
                        <div
                          key={`unassigned_${format(day, "yyyy-MM-dd")}`}
                          className="min-h-[80px] p-1 border-r border-b bg-amber-50/50 dark:bg-amber-900/10"
                        >
                          {unassignedJobs.map((job) => (
                            <DraggableJobCard
                              key={job.id}
                              job={job}
                              onRemoveFromDay={handleRemoveFromDay}
                              onClick={() => setLocation(`/jobs/${job.id}`)}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </>

                  {visibleEngineers.length === 0 && (
                    <div className="col-span-8 p-8 text-center text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No engineers selected</p>
                      <Button
                        variant="link"
                        onClick={() => setEngineerDialogOpen(true)}
                      >
                        Add engineers to the board
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <DragOverlay>
                {activeJob ? <JobCardOverlay job={activeJob} /> : null}
              </DragOverlay>
            </DndContext>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
