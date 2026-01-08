import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, FileText, Send, CheckCircle, Clock, ArrowRight, Loader2, Plus } from "lucide-react";
import { format } from "date-fns";
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

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    fetchInvoices();
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

  const filteredInvoices = invoices.filter((invoice) =>
    invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Manage customer invoices and payments</p>
        </div>
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
            <p className="text-muted-foreground">Invoices are created when jobs are completed</p>
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
    </div>
  );
}
