import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Plus, CalendarIcon, Car, Package, Wrench, Fuel, Utensils, MoreHorizontal, Check, X, Loader2, Wallet, Camera, FileText, Image, FileSpreadsheet, File, Upload, ExternalLink, Trash2, Sparkles, Wand2 } from "lucide-react";
import { ReceiptPhotoCapture } from "@/components/receipt-photo-capture";
import { useUpload } from "@/hooks/use-upload";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import type { ExpenseWithDetails, User, Job, FileWithRelations } from "@shared/schema";

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5 text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <Image className="h-5 w-5 text-blue-500" />;
  if (mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) 
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ExpenseCategory = "mileage" | "materials" | "tools" | "fuel" | "subsistence" | "other";
type ExpenseStatus = "pending" | "approved" | "rejected" | "paid";

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "mileage", label: "Mileage" },
  { value: "materials", label: "Materials" },
  { value: "tools", label: "Tools" },
  { value: "fuel", label: "Fuel" },
  { value: "subsistence", label: "Subsistence" },
  { value: "other", label: "Other" },
];

const MILEAGE_RATES = [
  { value: 0.45, label: "45p/mile (first 10,000 miles)" },
  { value: 0.25, label: "25p/mile (over 10,000 miles)" },
];

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "mileage": return <Car className="h-4 w-4" />;
    case "materials": return <Package className="h-4 w-4" />;
    case "tools": return <Wrench className="h-4 w-4" />;
    case "fuel": return <Fuel className="h-4 w-4" />;
    case "subsistence": return <Utensils className="h-4 w-4" />;
    default: return <MoreHorizontal className="h-4 w-4" />;
  }
};

const getCategoryBadge = (category: string) => {
  return (
    <Badge variant="outline" className="flex items-center gap-1" data-testid={`badge-category-${category}`}>
      {getCategoryIcon(category)}
      <span className="capitalize">{category}</span>
    </Badge>
  );
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return <Badge className="bg-yellow-500" data-testid="badge-status-pending">Pending</Badge>;
    case "approved":
      return <Badge className="bg-green-500" data-testid="badge-status-approved">Approved</Badge>;
    case "rejected":
      return <Badge variant="destructive" data-testid="badge-status-rejected">Rejected</Badge>;
    case "paid":
      return <Badge className="bg-blue-500" data-testid="badge-status-paid">Paid</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function Expenses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [viewAllStaff, setViewAllStaff] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithDetails | null>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  const [expenseDate, setExpenseDate] = useState<Date | undefined>(new Date());
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const [mileage, setMileage] = useState("");
  const [mileageRate, setMileageRate] = useState("0.45");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [jobId, setJobId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [noReceipt, setNoReceipt] = useState(false);
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [uploadingExpenseFile, setUploadingExpenseFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<ExpenseWithDetails[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin",
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: expenseFiles = [], isLoading: expenseFilesLoading, refetch: refetchExpenseFiles } = useQuery<FileWithRelations[]>({
    queryKey: ["/api/expenses", selectedExpense?.id, "files"],
    queryFn: async () => {
      if (!selectedExpense?.id) return [];
      const res = await apiRequest("GET", `/api/expenses/${selectedExpense.id}/files`);
      return res.json();
    },
    enabled: !!selectedExpense?.id,
  });

  const { uploadFile, isUploading: isUploadingFile, progress: uploadProgress } = useUpload({
    onSuccess: async (response) => {
      if (!selectedExpense || !uploadingExpenseFile) return;
      await createFileMutation.mutateAsync({
        name: uploadingExpenseFile.name,
        objectPath: response.objectPath,
        mimeType: uploadingExpenseFile.type || null,
        size: uploadingExpenseFile.size || null,
        expenseId: selectedExpense.id,
        category: "receipt",
        notes: null,
      });
    },
    onError: (error) => {
      toast.error(error.message || "Upload failed");
    },
  });

  const createFileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/files", data);
      return res.json();
    },
    onSuccess: () => {
      refetchExpenseFiles();
      toast.success("File uploaded successfully");
      setUploadingExpenseFile(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save file");
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/files/${id}`);
    },
    onSuccess: () => {
      refetchExpenseFiles();
      toast.success("File deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete file");
    },
  });

  const handleExpenseFileUpload = async () => {
    if (!uploadingExpenseFile) return;
    await uploadFile(uploadingExpenseFile);
  };

  useEffect(() => {
    if (category === "mileage" && mileage && mileageRate) {
      const miles = parseFloat(mileage) || 0;
      const rate = parseFloat(mileageRate) || 0.45;
      const calculatedAmount = miles * rate;
      setAmount(calculatedAmount.toFixed(2));
    }
  }, [category, mileage, mileageRate]);

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/expenses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      resetForm();
      setAddExpenseOpen(false);
      toast.success("Expense created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create expense");
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/expenses/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast.success("Expense approved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve expense");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/expenses/${id}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast.success("Expense rejected");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reject expense");
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/expenses/${id}/mark-paid`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast.success("Expense marked as paid");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to mark expense as paid");
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (expenseIds: string[]) => {
      const res = await apiRequest("POST", "/api/expenses/bulk-approve", { expenseIds });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setSelectedExpenseIds(new Set());
      toast.success(`${data.count} expense(s) approved`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to bulk approve expenses");
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async (expenseIds: string[]) => {
      const res = await apiRequest("POST", "/api/expenses/bulk-reject", { expenseIds });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setSelectedExpenseIds(new Set());
      toast.success(`${data.count} expense(s) rejected`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to bulk reject expenses");
    },
  });

  const resetForm = () => {
    setExpenseDate(new Date());
    setCategory("other");
    setDescription("");
    setAmount("");
    setVatAmount("");
    setMileage("");
    setMileageRate("0.45");
    setReceiptUrl("");
    setJobId("");
    setNotes("");
    setNoReceipt(false);
    setFromLocation("");
    setToLocation("");
  };

  const handleAIScan = async () => {
    if (!receiptUrl) {
      toast.error("Please capture a receipt photo first");
      return;
    }
    
    setIsScanning(true);
    try {
      const response = await fetch("/api/ai/gemini/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: receiptUrl }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to scan receipt");
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        const data = result.data;
        
        if (data.vendorName) {
          setDescription(data.vendorName + (data.items?.[0]?.description ? ` - ${data.items[0].description}` : ""));
        }
        if (data.total) {
          setAmount(data.total.toString());
        }
        if (data.vatAmount) {
          setVatAmount(data.vatAmount.toString());
        }
        if (data.receiptDate) {
          const parts = data.receiptDate.split("/");
          if (parts.length === 3) {
            const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            if (!isNaN(date.getTime())) {
              setExpenseDate(date);
            }
          }
        }
        if (data.suggestedCategory && ["mileage", "materials", "tools", "fuel", "subsistence", "other"].includes(data.suggestedCategory)) {
          setCategory(data.suggestedCategory as ExpenseCategory);
        }
        
        toast.success("Receipt scanned successfully! Fields auto-filled.");
      }
    } catch (error: any) {
      console.error("AI scan error:", error);
      toast.error(error.message || "Failed to scan receipt with AI");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = () => {
    const expenseData: any = {
      date: expenseDate,
      category,
      description,
      amount: parseFloat(amount),
      vatAmount: vatAmount ? parseFloat(vatAmount) : 0,
      receiptUrl: receiptUrl || null,
      jobId: (jobId && jobId !== "none") ? jobId : null,
      notes: notes || null,
      noReceipt,
      fromLocation: fromLocation || null,
      toLocation: toLocation || null,
    };

    if (category === "mileage" && mileage) {
      expenseData.mileage = parseFloat(mileage);
      expenseData.mileageRate = parseFloat(mileageRate) * 100;
    }

    createExpenseMutation.mutate(expenseData);
  };

  const filteredExpenses = expenses.filter((exp) => {
    if (user?.role === "admin" && viewAllStaff) {
      if (selectedUserId !== "all" && exp.userId !== selectedUserId) return false;
      return true;
    }
    return exp.userId === user?.id;
  });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const totalPending = filteredExpenses
    .filter((exp) => exp.status === "pending")
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const totalApprovedThisMonth = filteredExpenses
    .filter((exp) => {
      if (exp.status !== "approved") return false;
      const expDate = new Date(exp.date);
      return expDate >= monthStart && expDate <= monthEnd;
    })
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const totalPaidThisMonth = filteredExpenses
    .filter((exp) => {
      if (exp.status !== "paid") return false;
      const expDate = new Date(exp.date);
      return expDate >= monthStart && expDate <= monthEnd;
    })
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const isAdmin = user?.role === "admin";

  const pendingExpenses = filteredExpenses.filter((exp) => exp.status === "pending");
  const allPendingSelected = pendingExpenses.length > 0 && pendingExpenses.every((exp) => selectedExpenseIds.has(exp.id));
  const somePendingSelected = pendingExpenses.some((exp) => selectedExpenseIds.has(exp.id));

  const toggleExpenseSelection = (id: string) => {
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllPending = () => {
    if (allPendingSelected) {
      setSelectedExpenseIds(new Set());
    } else {
      setSelectedExpenseIds(new Set(pendingExpenses.map((exp) => exp.id)));
    }
  };

  const clearSelection = () => {
    setSelectedExpenseIds(new Set());
  };

  return (
    <div className="container mx-auto p-4 pb-24 md:pb-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Track and manage your expenses</p>
        </div>
        <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>Submit a new expense claim.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(opt.value)}
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-select-date">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expenseDate ? format(expenseDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={expenseDate} onSelect={setExpenseDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What was the expense for?"
                  data-testid="input-description"
                />
              </div>

              {category === "mileage" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fromLocation">From Location</Label>
                      <Input
                        id="fromLocation"
                        value={fromLocation}
                        onChange={(e) => setFromLocation(e.target.value)}
                        placeholder="Starting location"
                        data-testid="input-from-location"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toLocation">To Location</Label>
                      <Input
                        id="toLocation"
                        value={toLocation}
                        onChange={(e) => setToLocation(e.target.value)}
                        placeholder="Destination"
                        data-testid="input-to-location"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mileage">Miles Travelled</Label>
                      <Input
                        id="mileage"
                        type="number"
                        step="0.1"
                        value={mileage}
                        onChange={(e) => setMileage(e.target.value)}
                        placeholder="Enter miles"
                        data-testid="input-mileage"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rate</Label>
                      <Select value={mileageRate} onValueChange={setMileageRate}>
                        <SelectTrigger data-testid="select-mileage-rate">
                          <SelectValue placeholder="Select rate" />
                        </SelectTrigger>
                        <SelectContent>
                          {MILEAGE_RATES.map((rate) => (
                            <SelectItem key={rate.value} value={rate.value.toString()}>
                              {rate.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Amount is automatically calculated from mileage × rate
                  </p>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (£)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    readOnly={category === "mileage"}
                    data-testid="input-amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vatAmount">VAT Amount (£)</Label>
                  <Input
                    id="vatAmount"
                    type="number"
                    step="0.01"
                    value={vatAmount}
                    onChange={(e) => setVatAmount(e.target.value)}
                    placeholder="0.00 (optional)"
                    data-testid="input-vat-amount"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="noReceipt"
                    checked={noReceipt}
                    onCheckedChange={(checked) => setNoReceipt(checked === true)}
                    data-testid="checkbox-no-receipt"
                  />
                  <Label htmlFor="noReceipt" className="text-sm font-normal cursor-pointer">
                    No receipt available
                  </Label>
                </div>
                {!noReceipt && (
                  <div className="space-y-3">
                    <ReceiptPhotoCapture
                      value={receiptUrl}
                      onChange={setReceiptUrl}
                      label="Receipt Photo *"
                    />
                    {receiptUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 border-purple-200"
                        onClick={handleAIScan}
                        disabled={isScanning}
                        data-testid="button-ai-scan-receipt"
                      >
                        {isScanning ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Scanning with AI...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
                            <span className="text-purple-700">Auto-fill with AI</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Link to Job</Label>
                <Select value={jobId} onValueChange={setJobId}>
                  <SelectTrigger data-testid="select-job">
                    <SelectValue placeholder="Select job (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No job linked</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.jobNo} - {job.customerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes (optional)"
                  rows={3}
                  data-testid="input-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddExpenseOpen(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createExpenseMutation.isPending} data-testid="button-submit-expense">
                {createExpenseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Expense
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isAdmin && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="viewAllStaff"
                  checked={viewAllStaff}
                  onCheckedChange={setViewAllStaff}
                  data-testid="switch-view-all-staff"
                />
                <Label htmlFor="viewAllStaff">View all staff expenses</Label>
              </div>
              {viewAllStaff && (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-[200px]" data-testid="select-user-filter">
                    <SelectValue placeholder="Filter by user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            <Wallet className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-pending">
              £{totalPending.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Approved</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-approved">
              £{totalApprovedThisMonth.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-total-paid">
              £{totalPaidThisMonth.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense List</CardTitle>
        </CardHeader>
        <CardContent>
          {expensesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && (
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={allPendingSelected}
                          onCheckedChange={toggleAllPending}
                          aria-label="Select all pending expenses"
                          data-testid="checkbox-select-all"
                          className={somePendingSelected && !allPendingSelected ? "opacity-50" : ""}
                        />
                      </TableHead>
                    )}
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && viewAllStaff && <TableHead>User</TableHead>}
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? (viewAllStaff ? 9 : 8) : 6} className="text-center py-8 text-muted-foreground">
                        No expenses found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <TableRow
                        key={expense.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedExpense(expense)}
                        data-testid={`row-expense-${expense.id}`}
                      >
                        {isAdmin && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedExpenseIds.has(expense.id)}
                              onCheckedChange={() => toggleExpenseSelection(expense.id)}
                              disabled={expense.status !== "pending"}
                              aria-label={`Select expense ${expense.id}`}
                              data-testid={`checkbox-expense-${expense.id}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(expense.date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>{getCategoryBadge(expense.category)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-medium">
                          £{expense.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(expense.status)}</TableCell>
                        {isAdmin && viewAllStaff && (
                          <TableCell>{expense.user?.name || "Unknown"}</TableCell>
                        )}
                        {isAdmin && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              {expense.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => approveMutation.mutate(expense.id)}
                                    disabled={approveMutation.isPending}
                                    data-testid={`button-approve-${expense.id}`}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => rejectMutation.mutate(expense.id)}
                                    disabled={rejectMutation.isPending}
                                    data-testid={`button-reject-${expense.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {expense.status === "approved" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markPaidMutation.mutate(expense.id)}
                                  disabled={markPaidMutation.isPending}
                                  data-testid={`button-mark-paid-${expense.id}`}
                                >
                                  Mark Paid
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedExpense} onOpenChange={() => setSelectedExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-medium">{format(new Date(selectedExpense.date), "dd MMMM yyyy")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <div className="mt-1">{getCategoryBadge(selectedExpense.category)}</div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="font-medium">{selectedExpense.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="text-xl font-bold">£{selectedExpense.amount.toFixed(2)}</p>
                </div>
                {selectedExpense.vatAmount && selectedExpense.vatAmount > 0 && (
                  <div>
                    <Label className="text-muted-foreground">VAT Amount</Label>
                    <p className="font-medium">£{selectedExpense.vatAmount.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {selectedExpense.category === "mileage" && selectedExpense.mileage && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Mileage</Label>
                    <p className="font-medium">{selectedExpense.mileage} miles</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Rate</Label>
                    <p className="font-medium">{selectedExpense.mileageRate}p/mile</p>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">{getStatusBadge(selectedExpense.status)}</div>
              </div>

              {selectedExpense.job && (
                <div>
                  <Label className="text-muted-foreground">Linked Job</Label>
                  <p className="font-medium">{selectedExpense.job.jobNo} - {selectedExpense.job.customerName}</p>
                </div>
              )}

              {selectedExpense.receiptUrl && (
                <div>
                  <Label className="text-muted-foreground">Receipt</Label>
                  <a
                    href={selectedExpense.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline block"
                  >
                    View Receipt
                  </a>
                </div>
              )}

              {selectedExpense.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{selectedExpense.notes}</p>
                </div>
              )}

              {selectedExpense.user && (
                <div>
                  <Label className="text-muted-foreground">Submitted by</Label>
                  <p className="font-medium">{selectedExpense.user.name}</p>
                </div>
              )}

              {selectedExpense.approvedBy && (
                <div>
                  <Label className="text-muted-foreground">Approved by</Label>
                  <p className="font-medium">{selectedExpense.approvedBy.name}</p>
                </div>
              )}

              <Separator className="my-4" />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-muted-foreground">Files & Documents</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      id="expense-file-upload"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadingExpenseFile(file);
                        }
                      }}
                      data-testid="input-expense-file"
                    />
                    <label htmlFor="expense-file-upload">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="cursor-pointer"
                        data-testid="button-select-expense-file"
                      >
                        <span>
                          <Upload className="h-4 w-4 mr-1" />
                          Select File
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                {uploadingExpenseFile && (
                  <div className="flex items-center gap-2 p-2 mb-3 bg-muted rounded-md">
                    {getFileIcon(uploadingExpenseFile.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadingExpenseFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(uploadingExpenseFile.size)}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleExpenseFileUpload}
                      disabled={isUploadingFile || createFileMutation.isPending}
                      data-testid="button-upload-expense-file"
                    >
                      {isUploadingFile ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          {uploadProgress}%
                        </>
                      ) : (
                        "Upload"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setUploadingExpenseFile(null)}
                      data-testid="button-cancel-expense-file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {expenseFilesLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : expenseFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No files attached to this expense
                  </p>
                ) : (
                  <div className="space-y-2">
                    {expenseFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-2 rounded-md border hover:bg-accent"
                        data-testid={`expense-file-${file.id}`}
                      >
                        {getFileIcon(file.mimeType)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                            {file.category && ` • ${file.category}`}
                          </p>
                        </div>
                        <a
                          href={file.objectPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`button-open-file-${file.id}`}
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this file?")) {
                              deleteFileMutation.mutate(file.id);
                            }
                          }}
                          data-testid={`button-delete-file-${file.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedExpense(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin && selectedExpenseIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
          <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm font-medium" data-testid="text-selected-count">
              {selectedExpenseIds.size} expense(s) selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => bulkApproveMutation.mutate(Array.from(selectedExpenseIds))}
                disabled={bulkApproveMutation.isPending || bulkRejectMutation.isPending}
                data-testid="button-bulk-approve"
              >
                {bulkApproveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Check className="h-4 w-4 mr-2" />
                Approve Selected ({selectedExpenseIds.size})
              </Button>
              <Button
                variant="destructive"
                onClick={() => bulkRejectMutation.mutate(Array.from(selectedExpenseIds))}
                disabled={bulkApproveMutation.isPending || bulkRejectMutation.isPending}
                data-testid="button-bulk-reject"
              >
                {bulkRejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <X className="h-4 w-4 mr-2" />
                Reject Selected ({selectedExpenseIds.size})
              </Button>
              <Button
                variant="outline"
                onClick={clearSelection}
                data-testid="button-clear-selection"
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
