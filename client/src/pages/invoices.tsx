import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Send, CheckCircle, Clock, ArrowRight, Loader2, Plus, Trash2, X } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { format, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Invoice = {
  id: string;
  invoiceNo: string;
  customerName: string;
  siteAddress: string | null;
  total: number;
  status: string;
  invoiceDate: string;
  dueDate: string | null;
  createdAt: string;
};

type Client = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
};

type LineItem = {
  id?: string;
  description: string;
  quantity: number;
  unitCost: number;
  amount: number;
};

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Create invoice dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitCost: 0, amount: 0 }
  ]);
  const [invoiceForm, setInvoiceForm] = useState({
    siteAddress: "",
    sitePostcode: "",
    dueDate: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    notes: "",
    vatRate: 20,
  });

  useEffect(() => {
    fetchInvoices();
    fetchClients();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch("/api/invoices", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch invoices", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Draft":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      case "Sent":
        return <Badge className="bg-blue-500"><Send className="w-3 h-3 mr-1" />Sent</Badge>;
      case "Paid":
        return <Badge className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case "Overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    if (field === "description") {
      updated[index].description = value as string;
    } else if (field === "quantity") {
      updated[index].quantity = Number(value) || 0;
      updated[index].amount = updated[index].quantity * updated[index].unitCost;
    } else if (field === "unitCost") {
      updated[index].unitCost = Number(value) || 0;
      updated[index].amount = updated[index].quantity * updated[index].unitCost;
    }
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unitCost: 0, amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const vatAmount = subtotal * (invoiceForm.vatRate / 100);
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  };

  const resetForm = () => {
    setSelectedClientId("");
    setLineItems([{ description: "", quantity: 1, unitCost: 0, amount: 0 }]);
    setInvoiceForm({
      siteAddress: "",
      sitePostcode: "",
      dueDate: format(addDays(new Date(), 30), "yyyy-MM-dd"),
      notes: "",
      vatRate: 20,
    });
  };

  const handleCreateInvoice = async () => {
    if (!selectedClientId) {
      toast({ title: "Error", description: "Please select a client", variant: "destructive" });
      return;
    }

    const validLineItems = lineItems.filter(item => item.description.trim() !== "");
    if (validLineItems.length === 0) {
      toast({ title: "Error", description: "Please add at least one line item", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const { subtotal, vatAmount, total } = calculateTotals();
      
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerId: selectedClientId,
          customerName: selectedClient?.name || "",
          customerEmail: selectedClient?.email || "",
          customerPhone: selectedClient?.phone || "",
          siteAddress: invoiceForm.siteAddress || selectedClient?.address || "",
          sitePostcode: invoiceForm.sitePostcode || selectedClient?.postcode || "",
          dueDate: new Date(invoiceForm.dueDate),
          lineItems: validLineItems,
          subtotal,
          vatRate: invoiceForm.vatRate,
          vatAmount,
          total,
          notes: invoiceForm.notes,
          status: "Draft",
        }),
      });

      if (res.ok) {
        const newInvoice = await res.json();
        toast({ title: "Success", description: "Invoice created successfully" });
        setShowCreateDialog(false);
        resetForm();
        fetchInvoices();
        // Navigate to the new invoice
        setLocation(`/invoices/${newInvoice.id}`);
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to create invoice", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create invoice", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setInvoiceForm(prev => ({
        ...prev,
        siteAddress: client.address || "",
        sitePostcode: client.postcode || "",
      }));
    }
  };

  const filteredInvoices = invoices.filter((invoice) =>
    invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { subtotal, vatAmount, total } = calculateTotals();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton fallbackPath="/" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground">Manage customer invoices and payments</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-invoice">
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground ml-2" />
        <Input
          placeholder="Search invoices..."
          className="border-none shadow-none focus-visible:ring-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-testid="input-search-invoices"
        />
      </div>

      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
            <p className="text-muted-foreground mb-4">Create your first invoice to get started</p>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-invoice">
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredInvoices.map((invoice) => (
            <Card
              key={invoice.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation(`/invoices/${invoice.id}`)}
              data-testid={`card-invoice-${invoice.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-muted-foreground">{invoice.invoiceNo}</span>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <h3 className="font-semibold text-lg">{invoice.customerName}</h3>
                    {invoice.siteAddress && (
                      <p className="text-sm text-muted-foreground">{invoice.siteAddress}</p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      Issued: {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
                      {invoice.dueDate && ` • Due: ${format(new Date(invoice.dueDate), "dd MMM yyyy")}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">£{invoice.total.toFixed(2)}</p>
                    <ArrowRight className="w-5 h-5 text-muted-foreground ml-auto mt-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Create Invoice
            </DialogTitle>
            <DialogDescription>
              Create a new invoice without a job or quote
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={selectedClientId} onValueChange={handleClientSelect}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Site Address */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Site Address</Label>
                <Textarea
                  placeholder="Full address"
                  value={invoiceForm.siteAddress}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, siteAddress: e.target.value })}
                  className="min-h-[80px]"
                  data-testid="input-site-address"
                />
              </div>
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input
                  placeholder="e.g., SW1A 1AA"
                  value={invoiceForm.sitePostcode}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, sitePostcode: e.target.value })}
                  data-testid="input-site-postcode"
                />
              </div>
            </div>

            {/* Due Date */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                  data-testid="input-due-date"
                />
              </div>
              <div className="space-y-2">
                <Label>VAT Rate (%)</Label>
                <Input
                  type="number"
                  value={invoiceForm.vatRate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, vatRate: Number(e.target.value) })}
                  data-testid="input-vat-rate"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Line Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                  data-testid="button-add-line-item"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="col-span-12 md:col-span-5">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                        data-testid={`input-line-item-description-${index}`}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                        data-testid={`input-line-item-quantity-${index}`}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        type="number"
                        placeholder="Price"
                        value={item.unitCost}
                        onChange={(e) => updateLineItem(index, "unitCost", e.target.value)}
                        data-testid={`input-line-item-price-${index}`}
                      />
                    </div>
                    <div className="col-span-3 md:col-span-2 flex items-center justify-end">
                      <span className="font-medium">£{item.amount.toFixed(2)}</span>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(index)}
                        disabled={lineItems.length === 1}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        data-testid={`button-remove-line-item-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes for the invoice..."
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                className="min-h-[80px]"
                data-testid="input-notes"
              />
            </div>

            {/* Totals */}
            <Card className="bg-slate-50 dark:bg-slate-900">
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>£{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT ({invoiceForm.vatRate}%)</span>
                    <span>£{vatAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>£{total.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
                data-testid="button-cancel-invoice"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateInvoice}
                disabled={isCreating}
                data-testid="button-submit-invoice"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Create Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
