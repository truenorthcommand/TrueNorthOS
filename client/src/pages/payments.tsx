import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, CreditCard, Building2, Banknote, FileText, Loader2, PoundSterling, AlertCircle, CheckCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import type { PaymentWithInvoice, Invoice } from "@shared/schema";

type PaymentMethod = "card" | "bank_transfer" | "cash" | "cheque";
type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
];

const getMethodIcon = (method: string) => {
  switch (method) {
    case "card": return <CreditCard className="h-4 w-4" />;
    case "bank_transfer": return <Building2 className="h-4 w-4" />;
    case "cash": return <Banknote className="h-4 w-4" />;
    case "cheque": return <FileText className="h-4 w-4" />;
    default: return <PoundSterling className="h-4 w-4" />;
  }
};

const getMethodBadge = (method: string) => {
  const colorClasses: Record<string, string> = {
    card: "bg-purple-500 text-white",
    bank_transfer: "bg-blue-500 text-white",
    cash: "bg-green-500 text-white",
    cheque: "bg-amber-500 text-white",
  };
  return (
    <Badge className={`flex items-center gap-1 ${colorClasses[method] || ""}`} data-testid={`badge-method-${method}`}>
      {getMethodIcon(method)}
      <span className="capitalize">{method.replace("_", " ")}</span>
    </Badge>
  );
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return <Badge className="bg-yellow-500" data-testid="badge-status-pending">Pending</Badge>;
    case "completed":
      return <Badge className="bg-green-500" data-testid="badge-status-completed">Completed</Badge>;
    case "failed":
      return <Badge variant="destructive" data-testid="badge-status-failed">Failed</Badge>;
    case "refunded":
      return <Badge variant="secondary" data-testid="badge-status-refunded">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function Payments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<PaymentWithInvoice[]>({
    queryKey: ["/api/payments"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const unpaidInvoices = invoices.filter((inv) => inv.status !== "Paid" && inv.status !== "Cancelled");

  useEffect(() => {
    if (selectedInvoiceId) {
      const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
      if (invoice) {
        const existingPayments = payments.filter(
          (p) => p.invoiceId === selectedInvoiceId && p.status === "completed"
        );
        const paidAmount = existingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const balance = (invoice.total || 0) - paidAmount;
        setAmount(balance > 0 ? balance.toFixed(2) : "0.00");
      }
    }
  }, [selectedInvoiceId, invoices, payments]);

  const createPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/payments", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      resetForm();
      setAddPaymentOpen(false);
      toast.success("Payment recorded successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to record payment");
    },
  });

  const resetForm = () => {
    setSelectedInvoiceId("");
    setAmount("");
    setMethod("card");
    setReference("");
    setNotes("");
  };

  const handleSubmit = () => {
    if (!selectedInvoiceId) {
      toast.error("Please select an invoice");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const paymentData = {
      invoiceId: selectedInvoiceId,
      amount: parseFloat(amount),
      method,
      status: "completed" as PaymentStatus,
      reference: reference || null,
      notes: notes || null,
      paidAt: new Date(),
    };

    createPaymentMutation.mutate(paymentData);
  };

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const totalReceivedThisMonth = payments
    .filter((p) => {
      if (p.status !== "completed") return false;
      const paidDate = p.paidAt ? new Date(p.paidAt) : (p.createdAt ? new Date(p.createdAt) : new Date());
      return paidDate >= monthStart && paidDate <= monthEnd;
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const pendingPayments = payments.filter((p) => p.status === "pending");
  const pendingTotal = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const failedPayments = payments.filter((p) => p.status === "failed");
  const failedTotal = failedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const isAdmin = hasRole(user, 'admin');

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-4 pb-24 md:pb-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You need admin privileges to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 pb-24 md:pb-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-muted-foreground">View and manage all payments</p>
        </div>
        <Dialog open={addPaymentOpen} onOpenChange={setAddPaymentOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-record-payment">
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>Record a new payment against an invoice.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Invoice</Label>
                <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                  <SelectTrigger data-testid="select-invoice">
                    <SelectValue placeholder="Select invoice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unpaidInvoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id} data-testid={`invoice-option-${invoice.id}`}>
                        {invoice.invoiceNo} - {invoice.customerName} (£{(invoice.total || 0).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-amount"
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={method} onValueChange={(val) => setMethod(val as PaymentMethod)}>
                  <SelectTrigger data-testid="select-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} data-testid={`method-option-${opt.value}`}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(method === "bank_transfer" || method === "cheque") && (
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={method === "cheque" ? "Cheque number" : "Transfer reference"}
                    data-testid="input-reference"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={3}
                  data-testid="input-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPaymentOpen(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createPaymentMutation.isPending} data-testid="button-submit-payment">
                {createPaymentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Record Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-received">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Received (This Month)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">£{totalReceivedThisMonth.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-payments">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <PoundSterling className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">£{pendingTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{pendingPayments.length} payment(s)</p>
          </CardContent>
        </Card>

        <Card data-testid="card-failed-payments">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">£{failedTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{failedPayments.length} payment(s)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                      <TableCell>
                        {payment.paidAt
                          ? format(new Date(payment.paidAt), "dd/MM/yyyy")
                          : (payment.createdAt ? format(new Date(payment.createdAt), "dd/MM/yyyy") : "-")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.invoice?.invoiceNo || "-"}
                      </TableCell>
                      <TableCell>
                        {payment.invoice?.customerName || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        £{(payment.amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getMethodBadge(payment.method)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payment.status)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {payment.reference || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
