import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { hasRole } from "@/lib/types";
import type { User } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, CheckCircle2, XCircle, Eye,
  Filter, ChevronDown, ChevronUp, ShieldAlert,
  ShieldCheck, Clock, Loader2, Search, Ban,
  Receipt, DollarSign, FileWarning, ArrowUpDown,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────
interface ReceiptLineItem {
  id: string;
  receiptId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: "clean" | "flagged" | "cleared" | "rejected";
  aiReason: string | null;
  reviewNotes: string | null;
}

interface FlaggedReceipt {
  id: string;
  userId: string;
  userName?: string;
  vendor: string | null;
  date: string;
  total: number;
  status: "pending" | "clean" | "flagged" | "reviewed";
  receiptImageUrl: string | null;
  flaggedItemCount?: number;
  lineItems?: ReceiptLineItem[];
}

interface FlaggedReceiptsStats {
  totalFlagged: number;
  pendingReview: number;
  clearedThisMonth: number;
  rejectedThisMonth: number;
  totalDeductions: number;
}

const REJECT_REASONS = [
  "Personal item",
  "Unauthorized purchase",
  "Policy violation",
  "Other",
];

type SortField = "date" | "total" | "userName";
type SortDir = "asc" | "desc";

// ── Helpers ──────────────────────────────────────────────────────────
function getLineStatusBadge(status: string) {
  switch (status) {
    case "clean":
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-white">
          <ShieldCheck className="h-3 w-3 mr-1" />Clean
        </Badge>
      );
    case "flagged":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
          <ShieldAlert className="h-3 w-3 mr-1" />Flagged
        </Badge>
      );
    case "cleared":
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-white">
          <CheckCircle2 className="h-3 w-3 mr-1" />Cleared
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-500 hover:bg-red-600 text-white">
          <XCircle className="h-3 w-3 mr-1" />Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getReceiptStatusBadge(status: string) {
  switch (status) {
    case "flagged":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
          <ShieldAlert className="h-3 w-3 mr-1" />Flagged
        </Badge>
      );
    case "reviewed":
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600 text-white">
          <Eye className="h-3 w-3 mr-1" />Reviewed
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-gray-400 hover:bg-gray-500 text-white">
          <Clock className="h-3 w-3 mr-1" />Pending
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ── Main Component ───────────────────────────────────────────────────
export default function FlaggedReceipts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectItemId, setRejectItemId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Access check
  if (!hasRole(user, "admin")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Ban className="h-16 w-16 text-red-400" />
        <h2 className="text-2xl font-bold text-[#0F2B4C]">Access Denied</h2>
        <p className="text-muted-foreground">You need admin or accounts privileges to view this page.</p>
      </div>
    );
  }

  // Queries
  const { data: receipts = [], isLoading } = useQuery<FlaggedReceipt[]>({
    queryKey: ["/api/receipts/flagged"],
  });

  // Line items query for expanded receipt
  const { data: lineItems = [], isLoading: lineItemsLoading } = useQuery<ReceiptLineItem[]>({
    queryKey: ["/api/receipts", expandedId, "line-items"],
    enabled: !!expandedId,
  });

  // Mutations
  const clearMutation = useMutation({
    mutationFn: async ({ itemId, reviewNotes }: { itemId: string; reviewNotes?: string }) => {
      await apiRequest("PUT", `/api/receipt-line-items/${itemId}/clear`, { reviewNotes: reviewNotes || "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/flagged"] });
      if (expandedId) queryClient.invalidateQueries({ queryKey: ["/api/receipts", expandedId, "line-items"] });
      toast({ title: "Item Cleared", description: "The line item has been marked as clean." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ itemId, reason, reviewNotes }: { itemId: string; reason: string; reviewNotes: string }) => {
      await apiRequest("PUT", `/api/receipt-line-items/${itemId}/reject`, { reason, reviewNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/flagged"] });
      if (expandedId) queryClient.invalidateQueries({ queryKey: ["/api/receipts", expandedId, "line-items"] });
      setRejectDialogOpen(false);
      setRejectItemId(null);
      setRejectReason("");
      setRejectNotes("");
      toast({ title: "Item Rejected", description: "The line item has been rejected and a deduction created." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Derived data
  const stats: FlaggedReceiptsStats = {
    totalFlagged: receipts.length,
    pendingReview: receipts.filter((r) => r.status === "flagged").length,
    clearedThisMonth: 0,
    rejectedThisMonth: 0,
    totalDeductions: 0,
  };

  const uniqueUsers = Array.from(new Set(receipts.map((r) => r.userName).filter(Boolean))) as string[];

  // Filter + sort
  let filtered = receipts.filter((r) => {
    if (filterUser !== "all" && r.userName !== filterUser) return false;
    if (filterDateFrom && r.date < filterDateFrom) return false;
    if (filterDateTo && r.date > filterDateTo) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        (r.userName?.toLowerCase().includes(q) ?? false) ||
        (r.vendor?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "date") cmp = a.date.localeCompare(b.date);
    else if (sortField === "total") cmp = a.total - b.total;
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

  const openRejectDialog = (itemId: string) => {
    setRejectItemId(itemId);
    setRejectReason("");
    setRejectNotes("");
    setRejectDialogOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
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
            <FileWarning className="h-7 w-7 text-[#E8A54B]" />
            Flagged Receipts
          </h1>
          <p className="text-muted-foreground mt-1">Review and action flagged receipt items</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Flagged</p>
            <p className="text-2xl font-bold text-[#0F2B4C]">{stats.totalFlagged}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Review</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pendingReview}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Cleared (Month)</p>
            <p className="text-2xl font-bold text-green-600">{stats.clearedThisMonth}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Rejected (Month)</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejectedThisMonth}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Deductions</p>
            <p className="text-2xl font-bold text-[#E8A54B]">£{stats.totalDeductions.toFixed(2)}</p>
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
                  placeholder="Search by user or vendor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
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
            <div className="w-full md:w-40">
              <Label className="text-xs">From</Label>
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="w-full md:w-40">
              <Label className="text-xs">To</Label>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearchTerm(""); setFilterUser("all"); setFilterDateFrom(""); setFilterDateTo(""); }}
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
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#0F2B4C]">No Flagged Receipts</h3>
            <p className="text-muted-foreground mt-1">All receipts are clear or no results match your filters.</p>
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
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("date")}>
                      Date <SortIcon field="date" />
                    </TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("total")}>
                      Total <SortIcon field="total" />
                    </TableHead>
                    <TableHead className="text-center">Flagged Items</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((receipt) => (
                    <>
                      <TableRow
                        key={receipt.id}
                        className="cursor-pointer hover:bg-[#E8A54B]/5 transition-colors"
                        onClick={() => setExpandedId(expandedId === receipt.id ? null : receipt.id)}
                      >
                        <TableCell className="font-medium">{receipt.userName ?? "—"}</TableCell>
                        <TableCell>{receipt.date ? format(new Date(receipt.date), "dd MMM yyyy") : "—"}</TableCell>
                        <TableCell>{receipt.vendor ?? "Unknown"}</TableCell>
                        <TableCell className="text-right font-mono">£{receipt.total.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="border-amber-400 text-amber-700">
                            {receipt.flaggedItemCount ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell>{getReceiptStatusBadge(receipt.status)}</TableCell>
                      </TableRow>

                      {/* Expanded Detail */}
                      {expandedId === receipt.id && (
                        <TableRow key={`${receipt.id}-detail`}>
                          <TableCell colSpan={6} className="bg-slate-50 p-0">
                            <div className="p-4 md:p-6 space-y-4">
                              <div className="flex flex-col md:flex-row gap-6">
                                {/* Receipt Image */}
                                {receipt.receiptImageUrl && (
                                  <div className="md:w-64 shrink-0">
                                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase">Receipt Image</p>
                                    <img
                                      src={receipt.receiptImageUrl}
                                      alt="Receipt"
                                      className="w-full rounded-lg border shadow-sm"
                                    />
                                  </div>
                                )}

                                {/* Line Items */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase">Line Items</p>
                                  {lineItemsLoading ? (
                                    <div className="space-y-2">
                                      {Array.from({ length: 3 }).map((_, i) => (
                                        <Skeleton key={i} className="h-10" />
                                      ))}
                                    </div>
                                  ) : lineItems.length === 0 ? (
                                    <p className="text-muted-foreground text-sm py-4">No line items found.</p>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead className="text-center">Qty</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                            <TableHead>AI Status</TableHead>
                                            <TableHead>AI Reason</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {lineItems.map((item) => (
                                            <TableRow key={item.id}>
                                              <TableCell className="font-medium">{item.description}</TableCell>
                                              <TableCell className="text-center">{item.quantity}</TableCell>
                                              <TableCell className="text-right font-mono">£{item.totalPrice.toFixed(2)}</TableCell>
                                              <TableCell>{getLineStatusBadge(item.status)}</TableCell>
                                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                                {item.aiReason ?? "—"}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {item.status === "flagged" && (
                                                  <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className="border-green-500 text-green-700 hover:bg-green-50"
                                                      disabled={clearMutation.isPending}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        clearMutation.mutate({ itemId: item.id });
                                                      }}
                                                    >
                                                      {clearMutation.isPending ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                      ) : (
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                      )}
                                                      Clear
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className="border-red-500 text-red-700 hover:bg-red-50"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openRejectDialog(item.id);
                                                      }}
                                                    >
                                                      <XCircle className="h-3 w-3 mr-1" />
                                                      Reject
                                                    </Button>
                                                  </div>
                                                )}
                                                {item.status === "cleared" && (
                                                  <span className="text-xs text-green-600">Cleared</span>
                                                )}
                                                {item.status === "rejected" && (
                                                  <span className="text-xs text-red-600">Rejected</span>
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
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

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#0F2B4C]">Reject Item</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this item. A deduction will be created.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Reason</Label>
              <Select value={rejectReason} onValueChange={setRejectReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {REJECT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes (optional)..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!rejectReason || rejectMutation.isPending}
              onClick={() => {
                if (rejectItemId && rejectReason) {
                  rejectMutation.mutate({
                    itemId: rejectItemId,
                    reason: rejectReason,
                    reviewNotes: rejectNotes,
                  });
                }
              }}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Reject Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
