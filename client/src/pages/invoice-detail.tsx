import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Send, CheckCircle, Copy, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  amount: number;
};

type Invoice = {
  id: string;
  invoiceNo: string;
  jobId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  siteAddress: string | null;
  sitePostcode: string | null;
  invoiceDate: string;
  dueDate: string | null;
  lineItems: LineItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes: string | null;
  status: string;
  accessToken: string | null;
};

export default function InvoiceDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInvoice();
  }, [params.id]);

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`/api/invoices/${params.id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setInvoice({ ...data, lineItems: data.lineItems || [] });
      } else {
        toast({ title: "Error", description: "Invoice not found", variant: "destructive" });
        setLocation("/invoices");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch invoice", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const markAsSent = async () => {
    try {
      const res = await fetch(`/api/invoices/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "Sent", sentAt: new Date().toISOString() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setInvoice({ ...updated, lineItems: updated.lineItems || [] });
        toast({ title: "Success", description: "Invoice marked as sent" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update invoice", variant: "destructive" });
    }
  };

  const markAsPaid = async () => {
    try {
      const res = await fetch(`/api/invoices/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "Paid", paidAt: new Date().toISOString() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setInvoice({ ...updated, lineItems: updated.lineItems || [] });
        toast({ title: "Success", description: "Invoice marked as paid" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update invoice", variant: "destructive" });
    }
  };

  const getClientLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invoice/${invoice?.accessToken}`;
  };

  const copyClientLink = () => {
    navigator.clipboard.writeText(getClientLink());
    toast({ title: "Copied", description: "Client link copied to clipboard" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/invoices")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Invoice {invoice.invoiceNo}</h1>
            <Badge className={
              invoice.status === "Paid" ? "bg-emerald-500" :
              invoice.status === "Sent" ? "bg-blue-500" :
              invoice.status === "Overdue" ? "bg-red-500" : ""
            }>
              {invoice.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.status === "Draft" && (
            <Button onClick={markAsSent}>
              <Send className="w-4 h-4 mr-2" />
              Mark as Sent
            </Button>
          )}
          {invoice.status === "Sent" && (
            <>
              <Button variant="outline" onClick={copyClientLink}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Button onClick={markAsPaid}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark as Paid
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{invoice.customerName}</p>
              {invoice.customerEmail && <p className="text-sm">{invoice.customerEmail}</p>}
              {invoice.customerPhone && <p className="text-sm">{invoice.customerPhone}</p>}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Site Address</p>
              <p className="font-medium">{invoice.siteAddress || "N/A"}</p>
              {invoice.sitePostcode && <p className="text-sm">{invoice.sitePostcode}</p>}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invoice Date</p>
              <p className="font-medium">{format(new Date(invoice.invoiceDate), "dd MMM yyyy")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">{invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "N/A"}</p>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-4">Line Items</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left py-2 px-2">Description</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Unit Price</th>
                  <th className="text-right py-2 px-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={item.id || `item-${index}`} className="border-b">
                    <td className="py-3 px-2">{item.description}</td>
                    <td className="py-3 px-2 text-right">{item.quantity}</td>
                    <td className="py-3 px-2 text-right">£{item.unitCost.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-medium">£{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>£{invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT ({invoice.vatRate}%)</span>
                <span>£{invoice.vatAmount.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span>£{invoice.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-muted-foreground">{invoice.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {invoice.accessToken && (
        <Card>
          <CardHeader>
            <CardTitle>Client Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share this link with your client to view the invoice and payment details.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyClientLink} className="flex-1">
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Button variant="outline" onClick={() => window.open(getClientLink(), "_blank")}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
