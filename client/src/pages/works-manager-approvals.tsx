import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Timer, Receipt, Clock, Calendar, DollarSign } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface TimesheetWithUser {
  id: string;
  userId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number | null;
  totalHours: number | null;
  notes: string | null;
  status: string;
  user: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
}

interface ExpenseWithDetails {
  id: string;
  userId: string;
  date: string;
  category: string;
  amount: number;
  description: string | null;
  receiptUrl: string | null;
  status: string;
  user: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
  job: { id: string; jobNo: string; customerName: string } | null;
}

type ApprovalItem = {
  type: 'timesheet';
  item: TimesheetWithUser;
} | {
  type: 'expense';
  item: ExpenseWithDetails;
};

export default function WorksManagerApprovals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("timesheets");
  const [reviewItem, setReviewItem] = useState<ApprovalItem | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const { data: timesheets, isLoading: timesheetsLoading } = useQuery<TimesheetWithUser[]>({
    queryKey: ["/api/works-manager/timesheets"],
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<ExpenseWithDetails[]>({
    queryKey: ["/api/works-manager/expenses"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'timesheet' | 'expense'; id: string }) => {
      const endpoint = type === 'timesheet' ? `/api/timesheets/${id}` : `/api/expenses/${id}`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'approved', approvedById: user?.id }),
      });
      if (!res.ok) throw new Error(`Failed to approve ${type}`);
      return res.json();
    },
    onSuccess: (_, variables) => {
      if (variables.type === 'timesheet') {
        queryClient.invalidateQueries({ queryKey: ["/api/works-manager/timesheets"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/works-manager/expenses"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/works-manager/stats"] });
      setReviewItem(null);
      toast({ title: "Approved", description: `The ${variables.type} has been approved.` });
    },
    onError: (_, variables) => {
      toast({ title: "Error", description: `Failed to approve ${variables.type}`, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ type, id, notes }: { type: 'timesheet' | 'expense'; id: string; notes: string }) => {
      const endpoint = type === 'timesheet' ? `/api/timesheets/${id}` : `/api/expenses/${id}`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'rejected', rejectionNotes: notes }),
      });
      if (!res.ok) throw new Error(`Failed to reject ${type}`);
      return res.json();
    },
    onSuccess: (_, variables) => {
      if (variables.type === 'timesheet') {
        queryClient.invalidateQueries({ queryKey: ["/api/works-manager/timesheets"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/works-manager/expenses"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/works-manager/stats"] });
      setReviewItem(null);
      setRejectionNotes("");
      setIsRejecting(false);
      toast({ title: "Rejected", description: `The ${variables.type} has been rejected.` });
    },
    onError: (_, variables) => {
      toast({ title: "Error", description: `Failed to reject ${variables.type}`, variant: "destructive" });
    },
  });

  const pendingTimesheets = timesheets?.filter(ts => ts.status === 'pending') || [];
  const pendingExpenses = expenses?.filter(exp => exp.status === 'pending') || [];

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--';
    try {
      const date = new Date(dateStr);
      return format(date, 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return isValid(date) ? format(date, 'dd/MM/yyyy') : dateStr;
    } catch {
      return dateStr;
    }
  };

  if (!user) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-primary" />
          Team Approvals
        </h1>
        <p className="text-muted-foreground">
          Review and approve timesheets and expenses from your team
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="stat-pending-timesheets">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Timesheets</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTimesheets.length}</div>
            <p className="text-xs text-muted-foreground">
              awaiting your approval
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-pending-expenses">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingExpenses.length}</div>
            <p className="text-xs text-muted-foreground">
              awaiting your approval
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="timesheets" className="flex items-center gap-2" data-testid="tab-timesheets">
            <Timer className="h-4 w-4" />
            Timesheets
            {pendingTimesheets.length > 0 && (
              <Badge variant="destructive" className="ml-1">{pendingTimesheets.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2" data-testid="tab-expenses">
            <Receipt className="h-4 w-4" />
            Expenses
            {pendingExpenses.length > 0 && (
              <Badge variant="destructive" className="ml-1">{pendingExpenses.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timesheets" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Timesheet Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {timesheetsLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading timesheets...</p>
              ) : pendingTimesheets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No pending timesheets</p>
              ) : (
                <div className="space-y-3">
                  {pendingTimesheets.map(ts => (
                    <div 
                      key={ts.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border"
                      data-testid={`timesheet-row-${ts.id}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{ts.user.name}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(ts.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(ts.clockIn)} - {formatTime(ts.clockOut)}
                          </span>
                          {ts.totalHours && (
                            <span className="font-medium text-foreground">
                              {ts.totalHours.toFixed(1)} hrs
                            </span>
                          )}
                        </div>
                        {ts.notes && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{ts.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewItem({ type: 'timesheet', item: ts })}
                          data-testid={`button-review-timesheet-${ts.id}`}
                        >
                          Review
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate({ type: 'timesheet', id: ts.id })}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-timesheet-${ts.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Expense Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {expensesLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading expenses...</p>
              ) : pendingExpenses.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No pending expenses</p>
              ) : (
                <div className="space-y-3">
                  {pendingExpenses.map(exp => (
                    <div 
                      key={exp.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border"
                      data-testid={`expense-row-${exp.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{exp.user.name}</p>
                          <Badge variant="outline" className="capitalize">{exp.category}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(exp.date)}
                          </span>
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <DollarSign className="h-3 w-3" />
                            £{exp.amount.toFixed(2)}
                          </span>
                          {exp.job && (
                            <span className="text-xs">Job: {exp.job.jobNo}</span>
                          )}
                        </div>
                        {exp.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{exp.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewItem({ type: 'expense', item: exp })}
                          data-testid={`button-review-expense-${exp.id}`}
                        >
                          Review
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate({ type: 'expense', id: exp.id })}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-expense-${exp.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewItem} onOpenChange={() => { setReviewItem(null); setIsRejecting(false); setRejectionNotes(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Review {reviewItem?.type === 'timesheet' ? 'Timesheet' : 'Expense'}
            </DialogTitle>
          </DialogHeader>
          
          {reviewItem?.type === 'timesheet' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Employee</Label>
                  <p className="font-medium">{reviewItem.item.user.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-medium">{formatDate(reviewItem.item.date)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Clock In</Label>
                  <p className="font-medium">{formatTime(reviewItem.item.clockIn)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Clock Out</Label>
                  <p className="font-medium">{formatTime(reviewItem.item.clockOut)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Break</Label>
                  <p className="font-medium">{reviewItem.item.breakMinutes || 0} mins</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Hours</Label>
                  <p className="font-medium">{reviewItem.item.totalHours?.toFixed(1) || 0} hrs</p>
                </div>
              </div>
              {reviewItem.item.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm">{reviewItem.item.notes}</p>
                </div>
              )}
            </div>
          )}
          
          {reviewItem?.type === 'expense' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Employee</Label>
                  <p className="font-medium">{reviewItem.item.user.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-medium">{formatDate(reviewItem.item.date)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium capitalize">{reviewItem.item.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="font-medium">£{reviewItem.item.amount.toFixed(2)}</p>
                </div>
              </div>
              {reviewItem.item.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{reviewItem.item.description}</p>
                </div>
              )}
              {reviewItem.item.job && (
                <div>
                  <Label className="text-muted-foreground">Related Job</Label>
                  <p className="text-sm">{reviewItem.item.job.jobNo} - {reviewItem.item.job.customerName}</p>
                </div>
              )}
              {reviewItem.item.receiptUrl && (
                <div>
                  <Label className="text-muted-foreground">Receipt</Label>
                  <a href={reviewItem.item.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                    View Receipt
                  </a>
                </div>
              )}
            </div>
          )}

          {isRejecting && (
            <div className="space-y-2">
              <Label>Rejection Notes</Label>
              <Textarea
                placeholder="Provide a reason for rejection..."
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                data-testid="input-rejection-notes"
              />
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {!isRejecting ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setIsRejecting(true)}
                  data-testid="button-start-reject"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button 
                  onClick={() => {
                    if (reviewItem) {
                      approveMutation.mutate({ type: reviewItem.type, id: reviewItem.item.id });
                    }
                  }}
                  disabled={approveMutation.isPending}
                  data-testid="button-confirm-approve"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setIsRejecting(false); setRejectionNotes(""); }}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    if (reviewItem) {
                      rejectMutation.mutate({ 
                        type: reviewItem.type, 
                        id: reviewItem.item.id,
                        notes: rejectionNotes 
                      });
                    }
                  }}
                  disabled={rejectMutation.isPending}
                  data-testid="button-confirm-reject"
                >
                  Confirm Rejection
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
