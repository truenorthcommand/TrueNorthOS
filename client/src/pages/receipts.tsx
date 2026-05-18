import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { hasRole } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Receipt, Filter, Eye, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Camera, Search, ChevronLeft, FileText, ShieldCheck,
  ShieldAlert, Clock, Fuel, Sparkles, Package, Trash2, MoreHorizontal,
} from "lucide-react";
import { ReceiptPhotoCapture } from "@/components/receipt-photo-capture";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/lib/types";

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

interface ReceiptData {
  id: string;
  userId: string;
  userName?: string;
  type: "general" | "job";
  vendor: string | null;
  date: string;
  total: number;
  vatAmount: number | null;
  category: string;
  description: string | null;
  notes: string | null;
  status: "pending" | "clean" | "flagged" | "reviewed";
  aiConfidence: number | null;
  receiptImageUrl: string | null;
  createdAt: string;
  lineItems?: ReceiptLineItem[];
}

interface Deduction {
  id: string;
  userId: string;
  receiptId: string | null;
  lineItemId: string | null;
  amount: number;
  reason: string;
  notes: string | null;
  createdAt: string;
}

type ReceiptCategory = "fuel" | "cleaning" | "office_supplies" | "consumables" | "other";

const RECEIPT_CATEGORIES: { value: ReceiptCategory; label: string; icon: React.ReactNode }[] = [
  { value: "fuel", label: "Fuel", icon: <Fuel className="h-4 w-4" /> },
  { value: "cleaning", label: "Cleaning", icon: <Sparkles className="h-4 w-4" /> },
  { value: "office_supplies", label: "Office Supplies", icon: <Package className="h-4 w-4" /> },
  { value: "consumables", label: "Consumables", icon: <Receipt className="h-4 w-4" /> },
  { value: "other", label: "Other", icon: <MoreHorizontal className="h-4 w-4" /> },
];

const REJECT_REASONS = [
  "Personal item",
  "Duplicate receipt",
  "Exceeds limit",
  "Missing information",
  "Not business related",
  "Incorrect category",
  "Other",
];

// ── Status Badges ────────────────────────────────────────────────────
function getStatusBadge(status: string) {
  switch (status) {
    case "clean":
      return <Badge className="bg-green-500 hover:bg-green-600 text-white"><ShieldCheck className="h-3 w-3 mr-1" />Clean</Badge>;
    case "flagged":
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white"><ShieldAlert className="h-3 w-3 mr-1" />Flagged</Badge>;
    case "reviewed":
      return <Badge className="bg-blue-500 hover:bg-blue-600 text-white"><Eye className="h-3 w-3 mr-1" />Reviewed</Badge>;
    case "cleared":
      return <Badge className="bg-green-500 hover:bg-green-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Cleared</Badge>;
    case "rejected":
      return <Badge className="bg-red-500 hover:bg-red-600 text-white"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    case "pending":
      return <Badge className="bg-gray-400 hover:bg-gray-500 text-white"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getCategoryLabel(category: string) {
  const found = RECEIPT_CATEGORIES.find((c) => c.value === category);
  return found ? found.label : category;
}

function getCategoryIcon(category: string) {
  const found = RECEIPT_CATEGORIES.find((c) => c.value === category);
  return found ? found.icon : <MoreHorizontal className="h-4 w-4" />;
}

// ── Main Component ───────────────────────────────────────────────────
export default function Receipts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = hasRole(user, "admin");

  // View state
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingLineItem, setRejectingLineItem] = useState<ReceiptLineItem | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Upload form
  const [uploadPhoto, setUploadPhoto] = useState("");
  const [uploadCategory, setUploadCategory] = useState<ReceiptCategory>("other");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");

  // Reject form
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");

  // ── Queries ──────────────────────────────────────────────────────
  const { data: receipts = [], isLoading: receiptsLoading } = useQuery<ReceiptData[]>({
    queryKey: ["/api/receipts"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });

  const { data: lineItems = [], isLoading: lineItemsLoading } = useQuery<ReceiptLineItem[]>({
    queryKey: ["/api/receipts", selectedReceipt?.id, "line-items"],
    queryFn: async () => {
      if (!selectedReceipt?.id) return [];
      const res = await apiRequest("GET", `/api/receipts/${selectedReceipt.id}/line-items`);
      return res.json();
    },
    enabled: !!selectedReceipt?.id,
  });

  const { data: deductions = [] } = useQuery<Deduction[]>({
    queryKey: ["/api/deductions", isAdmin ? "all" : `user/${user?.id}`],
    queryFn: async () => {
      if (isAdmin) {
        const res = await apiRequest("GET", "/api/deductions");
        return res.json();
      }
      if (user?.id) {
        const res = await apiRequest("GET", `/api/deductions/user/${user.id}`);
        return res.json();
      }
      return [];
    },
    enabled: !!user,
  });

  // ── Mutations ───────────────────────────────────────────────────
  const createReceiptMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/receipts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      resetUploadForm();
      setUploadDialogOpen(false);
      toast({ title: "Receipt uploaded", description: "Your receipt is being processed by AI." });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const clearLineItemMutation = useMutation({
    mutationFn: async (lineItemId: string) => {
      const res = await apiRequest("PUT", `/api/receipt-line-items/${lineItemId}/clear`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", selectedReceipt?.id, "line-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Item cleared", description: "The flagged item has been marked as cleared." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to clear item", description: error.message, variant: "destructive" });
    },
  });

  const rejectLineItemMutation = useMutation({
    mutationFn: async ({ lineItemId, reason, reviewNotes }: { lineItemId: string; reason: string; reviewNotes: string }) => {
      const res = await apiRequest("PUT", `/api/receipt-line-items/${lineItemId}/reject`, { reason, reviewNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", selectedReceipt?.id, "line-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setRejectDialogOpen(false);
      setRejectingLineItem(null);
      setRejectReason("");
      setRejectNotes("");
      toast({ title: "Item rejected", description: "The item has been rejected and a deduction may be applied." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reject item", description: error.message, variant: "destructive" });
    },
  });

  // ── Helpers ─────────────────────────────────────────────────────
  function resetUploadForm() {
    setUploadPhoto("");
    setUploadCategory("other");
    setUploadDescription("");
    setUploadNotes("");
  }

  function handleUploadSubmit() {
    if (!uploadPhoto) {
      toast({ title: "Photo required", description: "Please take or upload a receipt photo.", variant: "destructive" });
      return;
    }
    createReceiptMutation.mutate({
      type: "general",
      category: uploadCategory,
      description: uploadDescription || null,
      notes: uploadNotes || null,
      receiptImageUrl: uploadPhoto,
    });
  }

  function handleRejectSubmit() {
    if (!rejectingLineItem || !rejectReason) return;
    rejectLineItemMutation.mutate({
      lineItemId: rejectingLineItem.id,
      reason: rejectReason,
      reviewNotes: rejectNotes,
    });
  }

  function openRejectDialog(item: ReceiptLineItem) {
    setRejectingLineItem(item);
    setRejectReason("");
    setRejectNotes("");
    setRejectDialogOpen(true);
  }

  // ── Filtering ───────────────────────────────────────────────────
  const filteredReceipts = receipts.filter((r) => {
    if (!isAdmin && r.userId !== user?.id) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterCategory !== "all" && r.category !== filterCategory) return false;
    if (isAdmin && filterUser !== "all" && r.userId !== filterUser) return false;
    if (isAdmin && filterType !== "all" && r.type !== filterType) return false;
    if (filterDateFrom && r.date < filterDateFrom) return false;
    if (filterDateTo && r.date > filterDateTo) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchVendor = r.vendor?.toLowerCase().includes(q);
      const matchDesc = r.description?.toLowerCase().includes(q);
      const matchUser = r.userName?.toLowerCase().includes(q);
      if (!matchVendor && !matchDesc && !matchUser) return false;
    }
    return true;
  });

  // ── Stats (admin) ───────────────────────────────────────────────
  const stats = {
    total: filteredReceipts.length,
    clean: filteredReceipts.filter((r) => r.status === "clean").length,
    flagged: filteredReceipts.filter((r) => r.status === "flagged").length,
    pending: filteredReceipts.filter((r) => r.status === "pending").length,
  };

  // ── Receipt Detail View ─────────────────────────────────────────
  if (selectedReceipt) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Back header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedReceipt(null)} className="text-[#0F2B4C]">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Receipts
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Receipt image + metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#0F2B4C] flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Receipt Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image viewer */}
              {selectedReceipt.receiptImageUrl ? (
                <div className="border rounded-lg overflow-hidden bg-gray-50">
                  <img
                    src={selectedReceipt.receiptImageUrl}
                    alt="Receipt"
                    className="w-full max-h-[400px] object-contain"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                  <FileText className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No receipt image</p>
                </div>
              )}

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Vendor</p>
                  <p className="font-medium text-[#0F2B4C]">{selectedReceipt.vendor || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                  <p className="font-medium text-[#0F2B4C]">
                    {selectedReceipt.date ? format(new Date(selectedReceipt.date), "dd MMM yyyy") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
                  <p className="font-bold text-lg text-[#0F2B4C]">£{(selectedReceipt.total || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">VAT</p>
                  <p className="font-medium text-[#0F2B4C]">£{(selectedReceipt.vatAmount || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Category</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {getCategoryIcon(selectedReceipt.category)}
                    <span className="font-medium text-[#0F2B4C]">{getCategoryLabel(selectedReceipt.category)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                  <div className="mt-0.5">{getStatusBadge(selectedReceipt.status)}</div>
                </div>
                {selectedReceipt.aiConfidence !== null && selectedReceipt.aiConfidence !== undefined && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">AI Confidence</p>
                    <p className="font-medium text-[#0F2B4C]">{Math.round(selectedReceipt.aiConfidence * 100)}%</p>
                  </div>
                )}
                {selectedReceipt.type && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Type</p>
                    <Badge variant="outline" className="capitalize mt-0.5">{selectedReceipt.type}</Badge>
                  </div>
                )}
              </div>

              {selectedReceipt.description && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-gray-700">{selectedReceipt.description}</p>
                </div>
              )}
              {selectedReceipt.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{selectedReceipt.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Line items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#0F2B4C] flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Line Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lineItemsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : lineItems.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No line items found</p>
                  <p className="text-xs text-gray-300 mt-1">AI scanning may still be in progress</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>AI Reason</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item) => (
                        <TableRow key={item.id} className={item.status === "flagged" ? "bg-amber-50" : ""}>
                          <TableCell className="font-medium max-w-[200px] truncate">{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">£{item.totalPrice.toFixed(2)}</TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">
                            {item.aiReason || "—"}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              {item.status === "flagged" && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                    onClick={() => clearLineItemMutation.mutate(item.id)}
                                    disabled={clearLineItemMutation.isPending}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Clear
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                                    onClick={() => openRejectDialog(item)}
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                              {item.status === "rejected" && item.reviewNotes && (
                                <span className="text-xs text-red-500 italic">{item.reviewNotes}</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Deductions section (visible to user for their own, all for admin) */}
        {deductions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[#0F2B4C] flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                Deductions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deductions
                      .filter((d) => !selectedReceipt || d.receiptId === selectedReceipt.id)
                      .map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>{format(new Date(d.createdAt), "dd MMM yyyy")}</TableCell>
                          <TableCell className="font-bold text-red-600">-£{d.amount.toFixed(2)}</TableCell>
                          <TableCell>{d.reason}</TableCell>
                          <TableCell className="text-sm text-gray-500">{d.notes || "—"}</TableCell>
                        </TableRow>
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
              <DialogTitle className="text-[#0F2B4C]">Reject Line Item</DialogTitle>
              <DialogDescription>
                Rejecting &ldquo;{rejectingLineItem?.description}&rdquo; will flag it for deduction.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={rejectReason} onValueChange={setRejectReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REJECT_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Additional Notes (optional)</Label>
                <Textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Add any additional context..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleRejectSubmit}
                disabled={!rejectReason || rejectLineItemMutation.isPending}
              >
                {rejectLineItemMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Rejecting...</>
                ) : (
                  <><XCircle className="h-4 w-4 mr-2" />Reject Item</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Main List View ──────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2B4C] flex items-center gap-2">
            <Receipt className="h-6 w-6 text-[#E8A54B]" />
            Receipts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? "Manage and review all receipts" : "View and upload your receipts"}
          </p>
        </div>
        <Button
          onClick={() => setUploadDialogOpen(true)}
          className="bg-[#E8A54B] hover:bg-[#d4953f] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Upload Receipt
        </Button>
      </div>

      {/* Admin Stats Cards */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-[#0F2B4C]">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Receipts</p>
              <p className="text-2xl font-bold text-[#0F2B4C]">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Clean</p>
              <p className="text-2xl font-bold text-green-600">{stats.clean}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Flagged</p>
              <p className="text-2xl font-bold text-amber-600">{stats.flagged}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-gray-400">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Processing</p>
              <p className="text-2xl font-bold text-gray-500">{stats.pending}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-[#0F2B4C]" />
            <span className="text-sm font-medium text-[#0F2B4C]">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search vendor, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Status filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Processing</SelectItem>
                <SelectItem value="clean">Clean</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
              </SelectContent>
            </Select>

            {/* Category filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {RECEIPT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* User filter (admin only) */}
            {isAdmin && (
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="User" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Type filter (admin only) */}
            {isAdmin && (
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="job">Job</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Date range */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-9 text-xs"
                placeholder="From"
              />
              <span className="text-gray-400 text-xs">to</span>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-9 text-xs"
                placeholder="To"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipts Table */}
      <Card>
        <CardContent className="p-0">
          {receiptsLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-16">
              <Receipt className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-500">No receipts found</h3>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery || filterStatus !== "all" || filterCategory !== "all"
                  ? "Try adjusting your filters"
                  : "Upload your first receipt to get started"}
              </p>
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="mt-4 bg-[#E8A54B] hover:bg-[#d4953f] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload Receipt
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    {isAdmin && <TableHead>User</TableHead>}
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Type</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((receipt) => (
                    <TableRow
                      key={receipt.id}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                        receipt.status === "flagged" ? "bg-amber-50/50" : ""
                      }`}
                      onClick={() => setSelectedReceipt(receipt)}
                    >
                      <TableCell className="whitespace-nowrap">
                        {receipt.date ? format(new Date(receipt.date), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {receipt.vendor || receipt.description || "—"}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-sm">{receipt.userName || "—"}</TableCell>
                      )}
                      <TableCell className="text-right font-semibold text-[#0F2B4C]">
                        £{(receipt.total || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {getCategoryIcon(receipt.category)}
                          <span className="capitalize">{getCategoryLabel(receipt.category)}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(receipt.status)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{receipt.type}</Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[#0F2B4C]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReceipt(receipt);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#0F2B4C] flex items-center gap-2">
              <Camera className="h-5 w-5 text-[#E8A54B]" />
              Upload Receipt
            </DialogTitle>
            <DialogDescription>
              Take a photo or upload an image of your receipt. Our AI will scan and verify it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ReceiptPhotoCapture
              value={uploadPhoto}
              onChange={setUploadPhoto}
              label="Receipt Photo *"
            />

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as ReceiptCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECEIPT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">{c.icon}{c.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="What is this receipt for?"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetUploadForm(); setUploadDialogOpen(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={!uploadPhoto || createReceiptMutation.isPending}
              className="bg-[#E8A54B] hover:bg-[#d4953f] text-white"
            >
              {createReceiptMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
              ) : (
                <><Receipt className="h-4 w-4 mr-2" />Upload & Scan</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
