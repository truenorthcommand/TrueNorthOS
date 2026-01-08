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
  ChevronUp,
  ChevronDown,
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
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  rectIntersection,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
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

// Simplified collision detection using rectIntersection for cross-cell moves
const customCollisionDetection: CollisionDetection = (args) => {
  const { active } = args;
  const activeId = String(active.id);
  
  // Use rectIntersection to find overlapping droppable areas
  const collisions = rectIntersection(args);
  
  // Filter out the active item and prioritize containers
  const filtered = collisions
    .filter(c => String(c.id) !== activeId)
    .sort((a, b) => {
      // Prioritize containers (cells) over individual items for cross-cell moves
      const aIsContainer = String(a.id).includes('_');
      const bIsContainer = String(b.id).includes('_');
      if (aIsContainer && !bIsContainer) return -1;
      if (!aIsContainer && bIsContainer) return 1;
      return 0;
    });
  
  return filtered.length > 0 ? [filtered[0]] : [];
};

type Engineer = {
  id: string;
  name: string;
};

function SortableJobCard({
  job,
  onRemoveFromDay,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  job: Job;
  onRemoveFromDay: (jobId: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: job.id,
    data: { type: 'job', job },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-slate-800 border rounded-md p-1.5 mb-1 shadow-sm hover:shadow-md transition-shadow group"
      data-testid={`planner-job-${job.id}`}
    >
      <div className="flex items-start gap-1">
        {/* Drag handle */}
        <div 
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex-shrink-0"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
        
        {/* Job info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{job.customerName}</p>
          {job.postcode && (
            <p className="text-xs text-muted-foreground truncate flex items-center">
              <MapPin className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
              {job.postcode}
            </p>
          )}
        </div>
        
        {/* Up/Down buttons */}
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}
            disabled={!canMoveUp}
            className={`p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${!canMoveUp ? 'opacity-30 cursor-not-allowed' : ''}`}
            data-testid={`move-up-${job.id}`}
            title="Move up"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}
            disabled={!canMoveDown}
            className={`p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${!canMoveDown ? 'opacity-30 cursor-not-allowed' : ''}`}
            data-testid={`move-down-${job.id}`}
            title="Move down"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
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
  const [overId, setOverId] = useState<string | null>(null);
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

  const updateJobMutation = useMutation({
    mutationFn: async ({
      jobId,
      date,
      engineerId,
      orderIndex,
    }: {
      jobId: string;
      date: string | null;
      engineerId?: string;
      orderIndex?: number;
    }) => {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: date,
          assignedToId: engineerId,
          assignedToIds: engineerId ? [engineerId] : [],
          ...(orderIndex !== undefined && { orderIndex }),
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
    console.log('[DragOver] active:', active.id, 'over:', over?.id);
    if (!over) {
      setOverId(null);
      return;
    }
    
    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;
    
    // Only track if over is different from active
    if (activeIdStr !== overIdStr) {
      console.log('[DragOver] Tracking new overId:', overIdStr);
      setOverId(overIdStr);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveJob(null);

    // Use tracked overId if event.over.id equals active.id (collision detection bug workaround)
    const activeId = active.id as string;
    let targetId = over?.id as string;
    
    console.log('[DragEnd] activeId:', activeId, 'over?.id:', over?.id, 'tracked overId:', overId);
    
    // If collision detection returned the active item, use the last tracked overId
    if (targetId === activeId && overId && overId !== activeId) {
      targetId = overId;
      console.log('[DragEnd] Using fallback overId:', targetId);
    }
    
    setOverId(null);
    
    console.log('[DragEnd] Final targetId:', targetId);
    
    if (!targetId) return;

    const overData = over?.data?.current as { type?: string; cellId?: string; job?: Job } | undefined;

    // If dropped on itself, ignore
    if (activeId === targetId) return;

    // Check if we dropped on another job (reordering within cell)
    const activeJob = jobs.find((j) => j.id === activeId);
    const isOverJob = jobs.find((j) => j.id === targetId);
    const overJob = jobs.find((j) => j.id === targetId);

    if (activeJob && overJob && isOverJob) {
      // Reordering within the same cell
      const activeDate = safeParseISO(activeJob.date);
      const overDate = safeParseISO(overJob.date);
      
      const activeAssignedIds =
        activeJob.assignedToIds && activeJob.assignedToIds.length > 0
          ? activeJob.assignedToIds
          : activeJob.assignedToId
          ? [activeJob.assignedToId]
          : [];
      const overAssignedIds =
        overJob.assignedToIds && overJob.assignedToIds.length > 0
          ? overJob.assignedToIds
          : overJob.assignedToId
          ? [overJob.assignedToId]
          : [];

      // Check if both jobs are in the same cell
      const sameEngineer = activeAssignedIds.some((id) => overAssignedIds.includes(id));
      const sameDate = activeDate && overDate && isSameDay(activeDate, overDate);

      if (sameEngineer && sameDate) {
        // Find common engineer
        const commonEngineerId = activeAssignedIds.find((id) => overAssignedIds.includes(id));
        if (commonEngineerId && activeDate) {
          // Get all jobs in this cell and reorder
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

    // Moving to a different cell
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

    // Get the target cell's jobs to determine the new orderIndex
    const targetCellJobs = getJobsForCell(engineerId, targetDate);
    const newOrderIndex = targetCellJobs.length;

    updateJobMutation.mutate({
      jobId: activeId,
      date: fullIsoDate,
      engineerId,
      orderIndex: newOrderIndex,
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

  const handleMoveJob = (jobId: string, direction: 'up' | 'down', cellJobs: Job[]) => {
    const currentIndex = cellJobs.findIndex(j => j.id === jobId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= cellJobs.length) return;
    
    const reorderedJobs = arrayMove(cellJobs, currentIndex, newIndex);
    const jobOrders = reorderedJobs.map((job, index) => ({
      jobId: job.id,
      orderIndex: index,
    }));
    
    reorderJobsMutation.mutate(jobOrders);
    toast({
      title: "Job order updated",
      description: `Moved ${direction === 'up' ? 'up' : 'down'} in the list.`,
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
    return jobs
      .filter((job) => {
        const jobDate = safeParseISO(job.date);
        if (!jobDate) return false;
        return isSameDay(jobDate, date);
      })
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
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
                            <SortableContext
                              items={cellJobs.map((j) => j.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {cellJobs.map((job, index) => (
                                <SortableJobCard
                                  key={job.id}
                                  job={job}
                                  onRemoveFromDay={handleRemoveFromDay}
                                  onMoveUp={() => handleMoveJob(job.id, 'up', cellJobs)}
                                  onMoveDown={() => handleMoveJob(job.id, 'down', cellJobs)}
                                  canMoveUp={index > 0}
                                  canMoveDown={index < cellJobs.length - 1}
                                />
                              ))}
                            </SortableContext>
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
                            {unassignedJobs.map((job, index) => (
                              <SortableJobCard
                                key={job.id}
                                job={job}
                                onRemoveFromDay={handleRemoveFromDay}
                                onMoveUp={() => handleMoveJob(job.id, 'up', unassignedJobs)}
                                onMoveDown={() => handleMoveJob(job.id, 'down', unassignedJobs)}
                                canMoveUp={index > 0}
                                canMoveDown={index < unassignedJobs.length - 1}
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
