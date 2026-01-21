import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Job, JobStatus, hasRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, LayoutGrid, MapPin, Users, Gauge, User } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { format, isSameDay, parseISO, isValid, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, TouchSensor, KeyboardSensor, useDroppable, pointerWithin, closestCenter, CollisionDetection } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
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

const customCollisionDetection: CollisionDetection = (args) => {
  const { active } = args;
  const activeId = String(active.id);
  
  const pointerCollisions = pointerWithin(args);
  
  const filteredCollisions = pointerCollisions
    .filter(c => String(c.id) !== activeId)
    .sort((a, b) => {
      const aIsContainer = String(a.id).includes('_');
      const bIsContainer = String(b.id).includes('_');
      if (aIsContainer && !bIsContainer) return 1;
      if (!aIsContainer && bIsContainer) return -1;
      return 0;
    });
  
  if (filteredCollisions.length > 0) {
    return [filteredCollisions[0]];
  }
  
  const centerCollisions = closestCenter(args);
  const filteredCenter = centerCollisions
    .filter(c => String(c.id) !== activeId)
    .sort((a, b) => {
      const aIsContainer = String(a.id).includes('_');
      const bIsContainer = String(b.id).includes('_');
      if (aIsContainer && !bIsContainer) return 1;
      if (!aIsContainer && bIsContainer) return -1;
      return 0;
    });
  
  if (filteredCenter.length > 0) {
    return [filteredCenter[0]];
  }
  
  return [];
};

type Engineer = {
  id: string;
  name: string;
};

function SortableJobCard({
  job,
  onRemoveFromDay,
  updateCount,
}: {
  job: Job;
  onRemoveFromDay: (jobId: string) => void;
  updateCount?: { count: number; remaining: number } | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({
    id: job.id,
    data: { type: 'job', job },
    animateLayoutChanges: () => false,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: 'none',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white dark:bg-slate-800 border rounded-md p-2 mb-1 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing select-none"
      data-testid={`planner-job-${job.id}`}
    >
      <p className="text-xs font-medium truncate">{job.nickname || job.customerName}</p>
      {job.postcode && (
        <p className="text-xs text-muted-foreground truncate flex items-center">
          <MapPin className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
          {job.postcode}
        </p>
      )}
      {job.isLongRunning && updateCount && (
        <Badge 
          variant="outline" 
          className="mt-1 text-[10px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700"
          data-testid={`badge-updates-${job.id}`}
        >
          Updates: {updateCount.count}/2
        </Badge>
      )}
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
  const { isOver, setNodeRef } = useDroppable({ 
    id,
    data: { type: 'container', cellId: id },
  });

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
      <p className="text-xs font-medium truncate">{job.nickname || job.customerName}</p>
    </div>
  );
}

export default function PlannerPage() {
  const { user } = useAuth();
  const { jobs, refreshJobs } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [visibleEngineerIds, setVisibleEngineerIds] = useState<string[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [engineerDialogOpen, setEngineerDialogOpen] = useState(false);
  const [updateCounts, setUpdateCounts] = useState<Record<string, { count: number; remaining: number }>>({});
  const [utilizationPopoverDay, setUtilizationPopoverDay] = useState<string | null>(null);
  const [engineers, setEngineers] = useState<Engineer[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    const fetchUpdateCounts = async () => {
      const longRunningJobs = jobs.filter(j => j.isLongRunning);
      if (longRunningJobs.length === 0) return;
      
      const counts: Record<string, { count: number; remaining: number }> = {};
      await Promise.all(
        longRunningJobs.map(async (job) => {
          try {
            const response = await fetch(`/api/jobs/${job.id}/updates/today`, { credentials: 'include' });
            if (response.ok) {
              const data = await response.json();
              counts[job.id] = { count: data.count, remaining: data.remaining };
            }
          } catch (error) {
          }
        })
      );
      setUpdateCounts(counts);
    };
    
    fetchUpdateCounts();
  }, [jobs]);

  const { data: engineersData } = useQuery({
    queryKey: ["/api/users/engineers"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      const engineerList = data.filter((u: any) => u.role === "engineer");
      return engineerList.map((e: any) => ({
        id: e.id,
        name: e.name,
      }));
    },
    enabled: user?.role === "admin",
  });

  useEffect(() => {
    if (engineersData) {
      setEngineers(engineersData);
      const savedIds = localStorage.getItem("plannerVisibleEngineers");
      if (savedIds) {
        try {
          const parsed = JSON.parse(savedIds);
          const validIds = parsed.filter((id: string) =>
            engineersData.some((e: Engineer) => e.id === id)
          );
          const newIds = engineersData
            .filter((e: Engineer) => !parsed.includes(e.id))
            .map((e: Engineer) => e.id);
          const mergedIds = validIds.length > 0 
            ? [...validIds, ...newIds]
            : engineersData.map((e: Engineer) => e.id);
          setVisibleEngineerIds(mergedIds);
        } catch {
          setVisibleEngineerIds(engineersData.map((e: Engineer) => e.id));
        }
      } else {
        setVisibleEngineerIds(engineersData.map((e: Engineer) => e.id));
      }
    }
  }, [engineersData]);

  useEffect(() => {
    if (visibleEngineerIds.length > 0) {
      localStorage.setItem(
        "plannerVisibleEngineers",
        JSON.stringify(visibleEngineerIds)
      );
    }
  }, [visibleEngineerIds]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const visibleEngineers = useMemo(() => {
    return engineers.filter((e) => visibleEngineerIds.includes(e.id));
  }, [engineers, visibleEngineerIds]);

  const getJobsForCell = (engineerId: string, date: Date): Job[] => {
    return jobs
      .filter((job) => {
        const jobDate = safeParseISO(job.date);
        if (!jobDate || !isSameDay(jobDate, date)) return false;
        const assignedIds =
          job.assignedToIds && job.assignedToIds.length > 0
            ? job.assignedToIds
            : job.assignedToId
            ? [job.assignedToId]
            : [];
        return assignedIds.includes(engineerId);
      })
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  };

  const getUnassignedJobsForDay = (date: Date): Job[] => {
    return jobs
      .filter((job) => {
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
      })
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  };

  const getUtilizationForDay = (date: Date) => {
    const standardHoursPerDay = 8;
    const estimatedHoursPerJob = 2;

    const staffBreakdown = visibleEngineers.map((engineer) => {
      const engineerJobs = getJobsForCell(engineer.id, date);
      const hoursWorked = engineerJobs.length * estimatedHoursPerJob;
      const availableHours = standardHoursPerDay;
      const percentage = Math.min(100, Math.round((hoursWorked / availableHours) * 100));
      
      return {
        id: engineer.id,
        name: engineer.name,
        hoursWorked: Math.min(hoursWorked, availableHours),
        availableHours,
        percentage,
        jobCount: engineerJobs.length,
      };
    });

    const totalHoursAvailable = staffBreakdown.length * standardHoursPerDay;
    const totalHoursWorked = staffBreakdown.reduce((sum, s) => sum + s.hoursWorked, 0);
    const totalPercentage = totalHoursAvailable > 0 
      ? Math.round((totalHoursWorked / totalHoursAvailable) * 100) 
      : 0;

    return {
      totalHoursWorked,
      totalHoursAvailable,
      totalPercentage,
      staffBreakdown,
      staffCount: visibleEngineers.length,
      totalJobs: staffBreakdown.reduce((sum, s) => sum + s.jobCount, 0),
    };
  };

  const updateJobMutation = useMutation({
    mutationFn: async ({
      jobId,
      date,
      engineerId,
      orderIndex,
      preserveEngineers,
      currentAssignedToIds,
    }: {
      jobId: string;
      date: string | null;
      engineerId?: string;
      orderIndex?: number;
      preserveEngineers?: boolean;
      currentAssignedToIds?: string[];
    }) => {
      const body: Record<string, unknown> = {
        date: date,
        ...(orderIndex !== undefined && { orderIndex }),
      };

      if (preserveEngineers && currentAssignedToIds && currentAssignedToIds.length > 1) {
      } else if (engineerId) {
        body.assignedToId = engineerId;
        body.assignedToIds = [engineerId];
      } else if (!preserveEngineers) {
        body.assignedToIds = [];
      }

      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
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

  const reorderJobsMutation = useMutation({
    mutationFn: async (jobOrders: { jobId: string; orderIndex: number }[]) => {
      const response = await fetch("/api/jobs/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ jobOrders }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reorder jobs");
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
    setOverId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverId(null);
      return;
    }
    
    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;
    
    if (activeIdStr !== overIdStr) {
      setOverId(overIdStr);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveJob(null);

    const activeId = active.id as string;
    let targetId = over?.id as string;
    
    if (targetId === activeId && overId && overId !== activeId) {
      targetId = overId;
    }
    
    setOverId(null);
    
    if (!targetId) return;

    if (activeId === targetId) return;

    const activeJobItem = jobs.find((j) => j.id === activeId);
    const isOverJob = jobs.find((j) => j.id === targetId);
    const overJob = jobs.find((j) => j.id === targetId);

    if (activeJobItem && overJob && isOverJob) {
      const activeDate = safeParseISO(activeJobItem.date);
      const overDate = safeParseISO(overJob.date);
      
      const activeAssignedIds =
        activeJobItem.assignedToIds && activeJobItem.assignedToIds.length > 0
          ? activeJobItem.assignedToIds
          : activeJobItem.assignedToId
          ? [activeJobItem.assignedToId]
          : [];
      const overAssignedIds =
        overJob.assignedToIds && overJob.assignedToIds.length > 0
          ? overJob.assignedToIds
          : overJob.assignedToId
          ? [overJob.assignedToId]
          : [];

      const sameEngineer = activeAssignedIds.some((id) => overAssignedIds.includes(id));
      const sameDate = activeDate && overDate && isSameDay(activeDate, overDate);

      if (sameEngineer && sameDate) {
        const commonEngineerId = activeAssignedIds.find((id) => overAssignedIds.includes(id));
        if (commonEngineerId && activeDate) {
          const cellJobs = getJobsForCell(commonEngineerId, activeDate);
          const oldIndex = cellJobs.findIndex((j) => j.id === activeId);
          const newIndex = cellJobs.findIndex((j) => j.id === targetId);

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const reorderedJobs = arrayMove(cellJobs, oldIndex, newIndex);
            const jobOrders = reorderedJobs.map((job, index) => ({
              jobId: job.id,
              orderIndex: index,
            }));

            reorderJobsMutation.mutate(jobOrders);
            toast({
              title: "Jobs reordered",
              description: "The job order has been updated.",
            });
          }
        }
        return;
      }
    }

    const [engineerId, dateStr] = targetId.split("_");
    if (!engineerId || !dateStr) return;

    const job = jobs.find((j) => j.id === activeId);
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

    const targetCellJobs = getJobsForCell(engineerId, targetDate);
    const newOrderIndex = targetCellJobs.length;

    const isMultiEngineerJob = currentAssignedIds.length > 1;

    updateJobMutation.mutate({
      jobId: activeId,
      date: fullIsoDate,
      engineerId: isMultiEngineerJob ? undefined : engineerId,
      orderIndex: newOrderIndex,
      preserveEngineers: isMultiEngineerJob,
      currentAssignedToIds: currentAssignedIds,
    });

    toast({
      title: "Job moved",
      description: isMultiEngineerJob 
        ? `Moved to ${format(targetDate, "EEE dd MMM")} (engineers preserved)`
        : `Moved to ${engineers.find((e) => e.id === engineerId)?.name} on ${format(targetDate, "EEE dd MMM")}`,
    });
  };

  const handleRemoveFromSchedule = (jobId: string) => {
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

  if (!user || !hasRole(user, 'admin')) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton fallbackPath="/" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <LayoutGrid className="h-8 w-8 text-primary" />
              Planner Board
            </h1>
            <p className="text-muted-foreground">
              Drag and drop jobs to schedule engineers
            </p>
          </div>
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
            onClick={() => setWeekStart(subWeeks(weekStart, 1))}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            data-testid="button-this-week"
          >
            This Week
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
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
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="min-w-[900px]">
              <div className="grid grid-cols-8 border-t border-l">
                <div className="p-2 font-medium text-sm bg-slate-100 dark:bg-slate-800 border-r border-b">
                  Engineer
                </div>
                {weekDays.map((day) => {
                  const dayStr = format(day, "yyyy-MM-dd");
                  const utilization = getUtilizationForDay(day);
                  return (
                    <Popover 
                      key={day.toISOString()}
                      open={utilizationPopoverDay === dayStr}
                      onOpenChange={(open) => setUtilizationPopoverDay(open ? dayStr : null)}
                    >
                      <PopoverTrigger asChild>
                        <div
                          className={`p-2 text-center font-medium text-sm border-r border-b cursor-pointer hover:bg-primary/5 transition-colors ${
                            isSameDay(day, new Date())
                              ? "bg-primary/10 text-primary"
                              : "bg-slate-100 dark:bg-slate-800"
                          }`}
                          data-testid={`planner-day-header-${dayStr}`}
                        >
                          <div>{format(day, "EEE")}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(day, "dd MMM")}
                          </div>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="start">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Gauge className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-sm">Labor Utilization</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(day, "EEE dd MMM")}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs text-muted-foreground">Total</div>
                              <div className="text-lg font-bold">
                                {utilization.totalHoursWorked}h / {utilization.totalHoursAvailable}h
                              </div>
                            </div>
                            <div className="relative w-14 h-14">
                              <svg className="w-14 h-14 -rotate-90">
                                <circle
                                  cx="28"
                                  cy="28"
                                  r="24"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                  className="text-slate-200 dark:text-slate-700"
                                />
                                <circle
                                  cx="28"
                                  cy="28"
                                  r="24"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                  strokeDasharray={`${utilization.totalPercentage * 1.51} 151`}
                                  className={
                                    utilization.totalPercentage > 80
                                      ? "text-green-500"
                                      : utilization.totalPercentage > 50
                                      ? "text-yellow-500"
                                      : "text-red-500"
                                  }
                                />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                                {utilization.totalPercentage}%
                              </span>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-muted-foreground mb-2">
                              STAFF BREAKDOWN
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {utilization.staffBreakdown.map((staff) => (
                                <div key={staff.id} className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{staff.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {staff.hoursWorked}h / {staff.availableHours}h
                                    </div>
                                  </div>
                                  <div className="w-10">
                                    <Progress 
                                      value={staff.percentage} 
                                      className="h-2"
                                    />
                                  </div>
                                </div>
                              ))}
                              {utilization.staffBreakdown.length === 0 && (
                                <p className="text-xs text-muted-foreground">No engineers visible</p>
                              )}
                            </div>
                          </div>

                          <div className="text-[10px] text-muted-foreground pt-2 border-t">
                            Available hours based on 8h workday. Jobs estimated at 2h each.
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}

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
                          <SortableContext
                            items={cellJobs.map((j) => j.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {cellJobs.map((job) => (
                              <SortableJobCard
                                key={job.id}
                                job={job}
                                onRemoveFromDay={handleRemoveFromSchedule}
                                updateCount={job.isLongRunning ? updateCounts[job.id] : null}
                              />
                            ))}
                          </SortableContext>
                        </DroppableCell>
                      );
                    })}
                  </>
                ))}

                <>
                  <div className="p-2 font-medium text-sm border-r border-b bg-amber-50 dark:bg-amber-900/20 flex items-center text-amber-700 dark:text-amber-400">
                    Unassigned / Other
                  </div>
                  {weekDays.map((day) => {
                    const unassignedJobs = getUnassignedJobsForDay(day);
                    const unassignedCellId = `unassigned_${format(day, "yyyy-MM-dd")}`;
                    return (
                      <DroppableCell
                        key={unassignedCellId}
                        id={unassignedCellId}
                        isEmpty={unassignedJobs.length === 0}
                      >
                        <SortableContext
                          items={unassignedJobs.map((j) => j.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {unassignedJobs.map((job) => (
                            <SortableJobCard
                              key={job.id}
                              job={job}
                              onRemoveFromDay={handleRemoveFromSchedule}
                              updateCount={job.isLongRunning ? updateCounts[job.id] : null}
                            />
                          ))}
                        </SortableContext>
                      </DroppableCell>
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
                      data-testid="button-add-engineers"
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
  );
}
