import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, ChevronLeft, ChevronRight, Plus, CalendarIcon, Check, X, Loader2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, parseISO, isSameDay } from "date-fns";
import { toast } from "sonner";
import { hasRole } from "@/lib/types";
import type { TimesheetWithUser, User } from "@shared/schema";

export default function Timesheets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewAllStaff, setViewAllStaff] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualDate, setManualDate] = useState<Date | undefined>(new Date());
  const [manualClockIn, setManualClockIn] = useState("09:00");
  const [manualClockOut, setManualClockOut] = useState("17:00");
  const [manualBreak, setManualBreak] = useState("30");
  const [manualNotes, setManualNotes] = useState("");

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: timesheets = [], isLoading: timesheetsLoading } = useQuery<TimesheetWithUser[]>({
    queryKey: ["/api/timesheets"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: hasRole(user, 'admin'),
  });

  const createManualEntryMutation = useMutation({
    mutationFn: async (data: { date: Date; clockIn: Date; clockOut: Date; breakMinutes: number; notes: string }) => {
      const res = await apiRequest("POST", "/api/timesheets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      setManualEntryOpen(false);
      setManualDate(new Date());
      setManualClockIn("09:00");
      setManualClockOut("17:00");
      setManualBreak("30");
      setManualNotes("");
      toast.success("Manual entry created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create manual entry");
    },
  });

  const updateBreakMutation = useMutation({
    mutationFn: async ({ id, breakMinutes }: { id: string; breakMinutes: number }) => {
      const res = await apiRequest("PUT", `/api/timesheets/${id}`, { breakMinutes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast.success("Break time updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update break time");
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/timesheets/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast.success("Timesheet approved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve timesheet");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/timesheets/${id}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast.success("Timesheet rejected");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reject timesheet");
    },
  });

  const handleManualSubmit = () => {
    const [clockInHours, clockInMins] = (manualClockIn || "09:00").split(":").map(Number);
    const [clockOutHours, clockOutMins] = (manualClockOut || "17:00").split(":").map(Number);

    const clockIn = new Date(manualDate || new Date());
    clockIn.setHours(clockInHours, clockInMins, 0, 0);

    const clockOut = new Date(manualDate || new Date());
    clockOut.setHours(clockOutHours, clockOutMins, 0, 0);

    createManualEntryMutation.mutate({
      date: manualDate || new Date(),
      clockIn,
      clockOut,
      breakMinutes: parseInt(manualBreak) || 0,
      notes: manualNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500" data-testid="badge-status-pending">Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-500" data-testid="badge-status-approved">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" data-testid="badge-status-rejected">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTimesheets = timesheets.filter((ts) => {
    if (!ts.date) return false;
    const tsDate = new Date(ts.date);
    const inWeek = tsDate >= weekStart && tsDate <= weekEnd;
    if (!inWeek) return false;

    if (hasRole(user, 'admin') && viewAllStaff) {
      if (selectedUserId !== "all" && ts.userId !== selectedUserId) return false;
      return true;
    }
    return ts.userId === user?.id;
  });

  const getTimesheetForDay = (day: Date) => {
    return filteredTimesheets.find((ts) => {
      if (!ts.date) return false;
      return isSameDay(new Date(ts.date), day);
    });
  };

  const formatTimeFromDate = (dateStr: string | Date | null) => {
    if (!dateStr) return "-";
    const date = typeof dateStr === "string" ? parseISO(dateStr) : dateStr;
    return format(date, "HH:mm");
  };

  const isAdmin = hasRole(user, 'admin');

  return (
    <div className="container mx-auto p-4 pb-24 md:pb-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Timesheets</h1>
          <p className="text-muted-foreground">Track your work hours and manage timesheets</p>
        </div>
        <Dialog open={manualEntryOpen} onOpenChange={setManualEntryOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-manual-entry">
              <Plus className="h-4 w-4 mr-2" />
              Add Manual Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Manual Entry</DialogTitle>
              <DialogDescription>Create a timesheet entry manually.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-select-date">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {manualDate ? format(manualDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={manualDate} onSelect={setManualDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clockIn">Clock In Time</Label>
                  <Input
                    id="clockIn"
                    type="time"
                    value={manualClockIn}
                    onChange={(e) => setManualClockIn(e.target.value)}
                    data-testid="input-clock-in-time"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clockOut">Clock Out Time</Label>
                  <Input
                    id="clockOut"
                    type="time"
                    value={manualClockOut}
                    onChange={(e) => setManualClockOut(e.target.value)}
                    data-testid="input-clock-out-time"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="breakMinutes">Break Minutes</Label>
                <Input
                  id="breakMinutes"
                  type="number"
                  value={manualBreak}
                  onChange={(e) => setManualBreak(e.target.value)}
                  placeholder="30"
                  data-testid="input-break-minutes"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Optional notes..."
                  data-testid="input-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManualEntryOpen(false)} data-testid="button-cancel-manual">
                Cancel
              </Button>
              <Button onClick={handleManualSubmit} disabled={createManualEntryMutation.isPending} data-testid="button-submit-manual">
                {createManualEntryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isAdmin && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={viewAllStaff} onCheckedChange={setViewAllStaff} id="viewAllStaff" data-testid="switch-view-all-staff" />
                <Label htmlFor="viewAllStaff">View all staff timesheets</Label>
              </div>
              {viewAllStaff && (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-[200px]" data-testid="select-user-filter">
                    <SelectValue placeholder="Filter by staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Weekly Timesheet</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} data-testid="button-prev-week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[180px] text-center" data-testid="text-week-range">
                {format(weekStart, "dd MMM")} - {format(weekEnd, "dd MMM yyyy")}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} data-testid="button-next-week">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {timesheetsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {viewAllStaff && <TableHead>Staff</TableHead>}
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Break (mins)</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekDays.map((day) => {
                    const timesheet = getTimesheetForDay(day);
                    if (!timesheet && !viewAllStaff) {
                      return (
                        <TableRow key={day.toISOString()} data-testid={`row-day-${format(day, "yyyy-MM-dd")}`}>
                          <TableCell className="font-medium">{format(day, "EEE, dd MMM")}</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>-</TableCell>
                          {isAdmin && <TableCell>-</TableCell>}
                        </TableRow>
                      );
                    }
                    if (!timesheet) return null;
                    return (
                      <TableRow key={timesheet.id} data-testid={`row-timesheet-${timesheet.id}`}>
                        <TableCell className="font-medium">{format(new Date(timesheet.date), "EEE, dd MMM")}</TableCell>
                        {viewAllStaff && <TableCell>{timesheet.user?.name || "-"}</TableCell>}
                        <TableCell data-testid={`cell-clockin-${timesheet.id}`}>{formatTimeFromDate(timesheet.clockIn)}</TableCell>
                        <TableCell data-testid={`cell-clockout-${timesheet.id}`}>{formatTimeFromDate(timesheet.clockOut)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-20"
                            value={timesheet.breakMinutes || 0}
                            onChange={(e) =>
                              updateBreakMutation.mutate({ id: timesheet.id, breakMinutes: parseInt(e.target.value) || 0 })
                            }
                            disabled={timesheet.status !== "pending"}
                            data-testid={`input-break-${timesheet.id}`}
                          />
                        </TableCell>
                        <TableCell data-testid={`cell-totalhours-${timesheet.id}`}>
                          {timesheet.totalHours?.toFixed(2) || "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(timesheet.status)}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            {timesheet.status === "pending" && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => approveMutation.mutate(timesheet.id)}
                                  disabled={approveMutation.isPending}
                                  data-testid={`button-approve-${timesheet.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => rejectMutation.mutate(timesheet.id)}
                                  disabled={rejectMutation.isPending}
                                  data-testid={`button-reject-${timesheet.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {filteredTimesheets.length === 0 && !viewAllStaff && (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground">
                        No timesheet entries for this week
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
