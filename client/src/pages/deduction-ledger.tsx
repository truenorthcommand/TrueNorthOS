import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { hasRole } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ban, BookOpen, ChevronDown, ChevronUp, ArrowUpDown,
  Clock, CheckCircle2, AlertTriangle, Download,
  Loader2, Search, Filter, ExternalLink, DollarSign,
  FileText, Scale,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────
interface Deduction {
  id: string;
  userId: string;
  userName?: string;
  receiptId: string | null;
  receiptDate?: string;
  receiptImageUrl?: string | null;
  lineItemId: string | null;
  itemDescription: string | null;
  amount: number;
  reason: string;
  notes: string | null;
  status: "pending" | "applied" | "disputed";
  payrollRef: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface DeductionStats {
  totalPending: number;
  totalApplied: number;
  amountPending: number;
  amountApplied: number;
}

type SortField = "createdAt" | "amount" | "userName";
type SortDir = "asc" | "desc";

// ── Helpers ──────────────────────────────────────────────────────────
function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
          <Clock className="h-3 w-3 mr-1" />Pending
        </Badge>
      );
    case "applied":
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-white">
          <CheckCircle2 className="h-3 w-3 mr-1" />Applied
        </Badge>
      );
    case "disputed":
      return (
        <Badge className="bg-red-500 hover:bg-red-600 text-white">
          <AlertTriangle className="h-3 w-3 mr-1" />Disputed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function exportToCsv(deductions: Deduction[]) {
  const headers = ["User", "Receipt Date", "Item", "Amount", "Reason", "Status", "Payroll Ref", "Created"];
  const rows = deductions.map((d) => [
    d.userName ?? "",
    d.receiptDate ? format(new Date(d.receiptDate), "yyyy-MM-dd") : "",
    d.itemDescription ?? "",
    d.amount.toFixed(2),
    d.reason,
    d.status,
    d.payrollRef ?? "",
    format(new Date(d.createdAt), "yyyy-MM-dd HH:mm"),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `deductions-${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ───────────────────────────────────────────────────
export default function DeductionLedger() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyDeductionId, setApplyDeductionId] = useState<string | null>(null);
  const [payrollRef, setPayrollRef] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Access check
  if (!hasRole(user, "admin")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Ban className="h-16 w-16 text-red-400" />
        <h2 className="text-2xl font-bold text-[#0F2B4C]">Access Denied</h2>
        <p className="text-muted-foreground">You need admin or accounts privileges to view the deduction ledger.</p>
      </div>
    );
  }

  // Queries
  const { data: deductions = [], isLoading } = useQuery<Deduction[]>({
    queryKey: ["/api/deductions"],
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async ({ id, status, payrollRef }: { id: string; status: string; payrollRef: string }) => {
      await apiRequest("PUT", `/api/deductions/${id}`, { status, payrollRef });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deductions"] });
      setApplyDialogOpen(false);
      setApplyDeductionId(null);
      setPayrollRef("");
      toast({ title: "Deduction Updated", description: "Deduction has been marked as applied to payroll." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Derived data
  const stats: DeductionStats = {
    totalPending: deductions.filter((d) => d.status === "pending").length,
    totalApplied: deductions.filter((d) => d.status === "applied").length,
    amountPending: deductions.filter((d) => d.status === "pending").reduce((sum, d) => sum + d.amount, 0),
    amountApplied: deductions.filter((d) => d.status === "applied").reduce((sum, d) => sum + d.amount, 0),
  };

  const uniqueUsers = Array.from(new Set(deductions.map((d) => d.userName).filter(Boolean))) as string[];

  // Filter + sort
  let filtered = deductions.filter((d) => {
    if (filterUser !== "all" && d.userName !== filterUser) return false;
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterDateFrom && d.createdAt < filterDateFrom) return false;
    if (filterDateTo && d.createdAt > filterDateTo + "T23:59:59") return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        (d.userName?.toLowerCase().includes(q) ?? false) ||
        (d.itemDescription?.toLowerCase().includes(q) ?? false) ||
        (d.reason?.toLowerCase().includes(q) ?? false) ||
        (d.payrollRef?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "createdAt") cmp = a.createdAt.localeCompare(b.createdAt);
    else if (sortField === "amount") cmp = a.amount - b.amount;
    else if (sortField === "userName") cmp = (a.userName ?? "").localeCompare(b.userName ?? "");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />
    ) : (
      <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />
    );

  const openApplyDialog = (deductionId: string) => {
    setApplyDeductionId(deductionId);
    setPayrollRef("");
    setApplyDialogOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0F2B4C] flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-[#E8A54B]" />
            Deduction Ledger
          </h1>
          <p className="text-muted-foreground mt-1">Track and manage payroll deductions from rejected receipt items</p>
        </div>
        <Button
          variant="outline"
          onClick={() => exportToCsv(filtered)}
          disabled={filtered.length === 0}
          className="border-[#0F2B4C] text-[#0F2B4C] hover:bg-[#0F2B4C]/5"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Deductions Pending</p>
            <p className="text-2xl font-bold text-amber-600">{stats.totalPending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Deductions Applied</p>
            <p className="text-2xl font-bold text-green-600">{stats.totalApplied}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Amount Pending</p>
            <p className="text-2xl font-bold text-amber-600">£{stats.amountPending.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Amount Applied</p>
            <p className="text-2xl font-bold text-green-600">£{stats.amountApplied.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user, item, reason, or payroll ref..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full md:w-40">
              <Label className="text-xs">User</Label>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {uniqueUsers.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-36">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-36">
              <Label className="text-xs">From</Label>
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="w-full md:w-36">
              <Label className="text-xs">To</Label>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setFilterUser("all");
                setFilterStatus("all");
                setFilterDateFrom("");
                setFilterDateTo("");
              }}
            >
              <Filter className="h-4 w-4 mr-1" />Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Scale className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#0F2B4C]">No Deductions</h3>
            <p className="text-muted-foreground mt-1">No deductions found matching your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#0F2B4C]/5">
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("userName")}>
                      User <SortIcon field="userName" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("createdAt")}>
                      Receipt Date <SortIcon field="createdAt" />
                    </TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("amount")}>
                      Amount <SortIcon field="amount" />
                    </TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payroll Ref</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((deduction) => (
                    <>
                      <TableRow
                        key={deduction.id}
                        className="cursor-pointer hover:bg-[#E8A54B]/5 transition-colors"
                        onClick={() => setExpandedId(expandedId === deduction.id ? null : deduction.id)}
                      >
                        <TableCell className="font-medium">{deduction.userName ?? "—"}</TableCell>
                        <TableCell>
                          {deduction.receiptDate
                            ? format(new Date(deduction.receiptDate), "dd MMM yyyy")
                            : deduction.createdAt
                              ? format(new Date(deduction.createdAt), "dd MMM yyyy")
                              : "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{deduction.itemDescription ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-red-600">
                          £{deduction.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm">{deduction.reason}</TableCell>
                        <TableCell>{getStatusBadge(deduction.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {deduction.payrollRef ?? "—"}
                        </TableCell>
                      </TableRow>

                      {/* Expanded Detail */}
                      {expandedId === deduction.id && (
                        <TableRow key={`${deduction.id}-detail`}>
                          <TableCell colSpan={7} className="bg-slate-50 p-0">
                            <div className="p-4 md:p-6">
                              <div className="flex flex-col md:flex-row gap-6">
                                {/* Receipt Detail */}
                                <div className="flex-1 space-y-3">
                                  <h4 className="text-sm font-semibold text-[#0F2B4C] uppercase tracking-wide">Deduction Details</h4>
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">User</p>
                                      <p className="font-medium">{deduction.userName ?? "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Amount</p>
                                      <p className="font-mono font-semibold text-red-600">£{deduction.amount.toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Reason</p>
                                      <p className="font-medium">{deduction.reason}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Status</p>
                                      <div>{getStatusBadge(deduction.status)}</div>
                                    </div>
                                    {deduction.notes && (
                                      <div className="col-span-2">
                                        <p className="text-muted-foreground">Notes</p>
                                        <p className="text-sm">{deduction.notes}</p>
                                      </div>
                                    )}
                                    {deduction.payrollRef && (
                                      <div>
                                        <p className="text-muted-foreground">Payroll Reference</p>
                                        <p className="font-mono">{deduction.payrollRef}</p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-muted-foreground">Created</p>
                                      <p>{format(new Date(deduction.createdAt), "dd MMM yyyy HH:mm")}</p>
                                    </div>
                                  </div>

                                  {/* Receipt Image Link */}
                                  {deduction.receiptImageUrl && (
                                    <a
                                      href={deduction.receiptImageUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      View Original Receipt
                                    </a>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="md:w-60 shrink-0 space-y-3">
                                  <h4 className="text-sm font-semibold text-[#0F2B4C] uppercase tracking-wide">Actions</h4>
                                  {deduction.status === "pending" && (
                                    <Button
                                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openApplyDialog(deduction.id);
                                      }}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Apply to Payroll
                                    </Button>
                                  )}
                                  {deduction.status === "applied" && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                                      <p className="text-green-800 font-medium">Applied to Payroll</p>
                                      {deduction.payrollRef && (
                                        <p className="text-green-600 font-mono mt-1">Ref: {deduction.payrollRef}</p>
                                      )}
                                    </div>
                                  )}
                                  {deduction.status === "disputed" && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                                      <p className="text-red-800 font-medium">Disputed by Employee</p>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 w-full"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openApplyDialog(deduction.id);
                                        }}
                                      >
                                        Override & Apply
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Apply to Payroll Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#0F2B4C]">Apply to Payroll</DialogTitle>
            <DialogDescription>
              Mark this deduction as applied and enter the payroll reference number.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Payroll Reference *</Label>
              <Input
                value={payrollRef}
                onChange={(e) => setPayrollRef(e.target.value)}
                placeholder="e.g. PAY-2026-05-001"
              />
              <p className="text-xs text-muted-foreground mt-1">Enter the payroll run reference for tracking</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={!payrollRef.trim() || updateMutation.isPending}
              onClick={() => {
                if (applyDeductionId && payrollRef.trim()) {
                  updateMutation.mutate({
                    id: applyDeductionId,
                    status: "applied",
                    payrollRef: payrollRef.trim(),
                  });
                }
              }}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              Confirm & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
