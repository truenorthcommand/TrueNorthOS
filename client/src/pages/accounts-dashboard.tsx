import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Receipt, FileText, Clock, CheckCircle2, AlertTriangle, 
  PoundSterling, TrendingUp, TrendingDown, Building2,
  Upload, Camera, Send, Edit, Trash2, RefreshCw,
  Calendar, Plus, AlertCircle, Eye, Mail, Phone,
  BarChart3, Wallet, Users, Car, Wrench, Package
} from "lucide-react";
import { format, parseISO, isValid, formatDistanceToNow, differenceInDays } from "date-fns";

interface AccountsReceipt {
  id: string;
  expenseId: string | null;
  uploadedById: string;
  imageUrl: string;
  ocrVendor: string | null;
  ocrAmount: number | null;
  ocrDate: string | null;
  ocrCategory: string | null;
  ocrRawData: any;
  isProcessed: boolean;
  isVerified: boolean;
  verifiedById: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface InvoiceWithChaseInfo {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  total: number;
  status: string;
  daysOverdue: number;
  lastChaseDate: string | null;
  chaseCount: number;
}

interface FixedCost {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

interface FinancialSummary {
  totalRevenue: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalCosts: number;
  staffCosts: number;
  vehicleCosts: number;
  materialsCosts: number;
  fixedCosts: number;
  netProfit: number;
  period: string;
}

interface InvoiceChaseLog {
  id: string;
  invoiceId: string;
  chaseNumber: number;
  method: string;
  message: string;
  sentAt: string | null;
  sentById: string | null;
  createdAt: string;
}

export default function AccountsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithChaseInfo | null>(null);
  const [chaseMessage, setChaseMessage] = useState("");
  const [showChaseDialog, setShowChaseDialog] = useState(false);
  const [showFixedCostDialog, setShowFixedCostDialog] = useState(false);
  const [newFixedCost, setNewFixedCost] = useState({
    name: "",
    category: "rent",
    amount: 0,
    frequency: "monthly",
    notes: "",
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<FinancialSummary>({
    queryKey: ["/api/accounts/financial-summary"],
    refetchInterval: 60000,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<InvoiceWithChaseInfo[]>({
    queryKey: ["/api/accounts/invoices"],
  });

  const { data: overdueInvoices = [] } = useQuery<InvoiceWithChaseInfo[]>({
    queryKey: ["/api/accounts/invoices/overdue"],
  });

  const { data: receipts = [] } = useQuery<AccountsReceipt[]>({
    queryKey: ["/api/accounts/receipts"],
  });

  const { data: fixedCosts = [] } = useQuery<FixedCost[]>({
    queryKey: ["/api/accounts/fixed-costs"],
  });

  const generateChaseMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("POST", `/api/accounts/invoices/${invoiceId}/generate-chase`);
      return res.json();
    },
    onSuccess: (data) => {
      setChaseMessage(data.message);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate chase message", variant: "destructive" });
    },
  });

  const sendChaseMutation = useMutation({
    mutationFn: async ({ invoiceId, message }: { invoiceId: string; message: string }) => {
      const res = await apiRequest("POST", `/api/accounts/invoices/${invoiceId}/chase`, { message, method: "email" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Chase message recorded" });
      setShowChaseDialog(false);
      setChaseMessage("");
      setSelectedInvoice(null);
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/invoices"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send chase", variant: "destructive" });
    },
  });

  const createFixedCostMutation = useMutation({
    mutationFn: async (data: typeof newFixedCost) => {
      const res = await apiRequest("POST", "/api/accounts/fixed-costs", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Fixed cost added" });
      setShowFixedCostDialog(false);
      setNewFixedCost({ name: "", category: "rent", amount: 0, frequency: "monthly", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/fixed-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/financial-summary"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add fixed cost", variant: "destructive" });
    },
  });

  const deleteFixedCostMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/accounts/fixed-costs/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Fixed cost removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/fixed-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/financial-summary"] });
    },
  });

  const processOcrMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      const res = await apiRequest("POST", `/api/accounts/receipts/${receiptId}/ocr`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Receipt processed with AI" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/receipts"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to process receipt", variant: "destructive" });
    },
  });

  const handleChaseInvoice = (invoice: InvoiceWithChaseInfo) => {
    setSelectedInvoice(invoice);
    setChaseMessage("");
    setShowChaseDialog(true);
    generateChaseMutation.mutate(invoice.id);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  };

  const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
  const pendingInvoices = invoices.filter(inv => inv.status === 'Sent' || inv.status === 'Draft');
  const unprocessedReceipts = receipts.filter(r => !r.isProcessed);

  return (
    <div className="min-h-screen bg-gray-50" data-testid="accounts-dashboard">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Accounts Portal</h1>
            <p className="text-gray-600">Manage invoices, receipts, and financial overview</p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            <PoundSterling className="w-4 h-4 mr-2" />
            Net Profit: {formatCurrency(summary?.netProfit || 0)}
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-invoices">
              <FileText className="w-4 h-4 mr-2" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="receipts" data-testid="tab-receipts">
              <Receipt className="w-4 h-4 mr-2" />
              Receipts
            </TabsTrigger>
            <TabsTrigger value="costs" data-testid="tab-costs">
              <Wallet className="w-4 h-4 mr-2" />
              Costs
            </TabsTrigger>
            <TabsTrigger value="fixed" data-testid="tab-fixed">
              <Building2 className="w-4 h-4 mr-2" />
              Fixed Costs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-revenue">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(summary?.totalRevenue || 0)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Paid invoices this period</p>
                </CardContent>
              </Card>

              <Card data-testid="card-pending">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Pending Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {formatCurrency(summary?.pendingInvoices || 0)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{pendingInvoices.length} invoices awaiting payment</p>
                </CardContent>
              </Card>

              <Card data-testid="card-overdue">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(summary?.overdueInvoices || 0)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{overdueInvoices.length} invoices overdue 14+ days</p>
                </CardContent>
              </Card>

              <Card data-testid="card-costs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Costs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(summary?.totalCosts || 0)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">All costs this period</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Overdue Invoices Requiring Action
                  </CardTitle>
                  <CardDescription>Invoices overdue by 14+ days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80">
                    {overdueInvoices.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p>No overdue invoices!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {overdueInvoices.map(invoice => (
                          <div key={invoice.id} className="p-3 bg-red-50 rounded-lg border border-red-200" data-testid={`overdue-invoice-${invoice.id}`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{invoice.customerName}</p>
                                <p className="text-sm text-gray-600">{invoice.invoiceNo}</p>
                                <p className="text-lg font-bold text-red-600">{formatCurrency(invoice.total)}</p>
                              </div>
                              <div className="text-right">
                                <Badge variant="destructive">{invoice.daysOverdue} days overdue</Badge>
                                <p className="text-xs text-gray-500 mt-1">
                                  Chased {invoice.chaseCount} times
                                </p>
                                <Button 
                                  size="sm" 
                                  className="mt-2"
                                  onClick={() => handleChaseInvoice(invoice)}
                                  data-testid={`chase-btn-${invoice.id}`}
                                >
                                  <Mail className="w-4 h-4 mr-1" />
                                  Chase
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-gray-600" />
                    Cost Breakdown
                  </CardTitle>
                  <CardDescription>Where your money is going</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <span>Staff Costs</span>
                      </div>
                      <span className="font-bold">{formatCurrency(summary?.staffCosts || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Car className="w-5 h-5 text-orange-600" />
                        <span>Vehicle Costs</span>
                      </div>
                      <span className="font-bold">{formatCurrency(summary?.vehicleCosts || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-purple-600" />
                        <span>Materials</span>
                      </div>
                      <span className="font-bold">{formatCurrency(summary?.materialsCosts || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-gray-600" />
                        <span>Fixed Costs</span>
                      </div>
                      <span className="font-bold">{formatCurrency(summary?.fixedCosts || 0)}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <span className="font-medium">Net Profit</span>
                      </div>
                      <span className={`font-bold text-lg ${(summary?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(summary?.netProfit || 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card className="cursor-pointer hover:shadow-md" data-testid="filter-paid">
                <CardContent className="pt-6 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 mb-2" />
                  <p className="font-bold text-2xl">{paidInvoices.length}</p>
                  <p className="text-sm text-gray-600">Paid</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md" data-testid="filter-pending">
                <CardContent className="pt-6 text-center">
                  <Clock className="w-8 h-8 mx-auto text-amber-600 mb-2" />
                  <p className="font-bold text-2xl">{pendingInvoices.length}</p>
                  <p className="text-sm text-gray-600">Pending</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md" data-testid="filter-overdue">
                <CardContent className="pt-6 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto text-red-600 mb-2" />
                  <p className="font-bold text-2xl">{overdueInvoices.length}</p>
                  <p className="text-sm text-gray-600">Overdue 14+ days</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {invoices.map(invoice => (
                      <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50" data-testid={`invoice-row-${invoice.id}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{invoice.invoiceNo}</span>
                            <span className="font-medium">{invoice.customerName}</span>
                            <Badge variant={
                              invoice.status === 'Paid' ? 'default' :
                              invoice.status === 'Overdue' || invoice.daysOverdue > 0 ? 'destructive' :
                              'secondary'
                            }>
                              {invoice.status === 'Sent' && invoice.daysOverdue > 0 ? `${invoice.daysOverdue}d overdue` : invoice.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            {invoice.invoiceDate && (
                              <span>Issued: {format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}</span>
                            )}
                            {invoice.dueDate && (
                              <span>Due: {format(new Date(invoice.dueDate), 'dd MMM yyyy')}</span>
                            )}
                            {invoice.customerEmail && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {invoice.customerEmail}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-lg">{formatCurrency(invoice.total)}</span>
                          {invoice.status !== 'Paid' && invoice.daysOverdue >= 14 && (
                            <Button size="sm" onClick={() => handleChaseInvoice(invoice)} data-testid={`chase-invoice-${invoice.id}`}>
                              <Mail className="w-4 h-4 mr-1" />
                              Chase
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipts" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Receipt Management</h2>
                <p className="text-sm text-gray-600">{unprocessedReceipts.length} receipts awaiting processing</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Uploaded Receipts</CardTitle>
                <CardDescription>AI-powered extraction for amounts, dates, and vendors</CardDescription>
              </CardHeader>
              <CardContent>
                {receipts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No receipts uploaded yet</p>
                    <p className="text-sm">Staff can upload receipts from the Expenses module</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {receipts.map(receipt => (
                      <Card key={receipt.id} className="overflow-hidden" data-testid={`receipt-${receipt.id}`}>
                        <div className="aspect-video bg-gray-100 relative">
                          <img 
                            src={receipt.imageUrl} 
                            alt="Receipt" 
                            className="w-full h-full object-cover"
                          />
                          {!receipt.isProcessed && (
                            <Badge className="absolute top-2 right-2" variant="secondary">Pending OCR</Badge>
                          )}
                          {receipt.isVerified && (
                            <Badge className="absolute top-2 left-2 bg-green-600">Verified</Badge>
                          )}
                        </div>
                        <CardContent className="pt-4">
                          {receipt.isProcessed ? (
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Vendor:</span>
                                <span className="font-medium">{receipt.ocrVendor || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Amount:</span>
                                <span className="font-bold">{receipt.ocrAmount ? formatCurrency(receipt.ocrAmount) : '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Date:</span>
                                <span>{receipt.ocrDate ? format(new Date(receipt.ocrDate), 'dd MMM yyyy') : '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Category:</span>
                                <Badge variant="outline">{receipt.ocrCategory || 'Unknown'}</Badge>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <Button 
                                onClick={() => processOcrMutation.mutate(receipt.id)}
                                disabled={processOcrMutation.isPending}
                                data-testid={`process-ocr-${receipt.id}`}
                              >
                                <RefreshCw className={`w-4 h-4 mr-2 ${processOcrMutation.isPending ? 'animate-spin' : ''}`} />
                                Process with AI
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cost Aggregation</CardTitle>
                <CardDescription>Automatically pulled from timesheets, expenses, fleet, and jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      Staff Costs
                    </h3>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-3xl font-bold text-blue-700">{formatCurrency(summary?.staffCosts || 0)}</p>
                      <p className="text-sm text-blue-600 mt-1">From approved timesheets</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Car className="w-5 h-5 text-orange-600" />
                      Vehicle & Fuel
                    </h3>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-3xl font-bold text-orange-700">{formatCurrency(summary?.vehicleCosts || 0)}</p>
                      <p className="text-sm text-orange-600 mt-1">Mileage claims & fuel expenses</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Package className="w-5 h-5 text-purple-600" />
                      Materials & Parts
                    </h3>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-3xl font-bold text-purple-700">{formatCurrency(summary?.materialsCosts || 0)}</p>
                      <p className="text-sm text-purple-600 mt-1">Job materials & parts purchases</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-gray-600" />
                      Fixed Overheads
                    </h3>
                    <div className="p-4 bg-gray-100 rounded-lg">
                      <p className="text-3xl font-bold text-gray-700">{formatCurrency(summary?.fixedCosts || 0)}</p>
                      <p className="text-sm text-gray-600 mt-1">Monthly fixed costs</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fixed" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Fixed Costs</h2>
                <p className="text-sm text-gray-600">Manage recurring business expenses</p>
              </div>
              <Dialog open={showFixedCostDialog} onOpenChange={setShowFixedCostDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="add-fixed-cost-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Fixed Cost
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Fixed Cost</DialogTitle>
                    <DialogDescription>Add a recurring business expense</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input 
                        value={newFixedCost.name}
                        onChange={(e) => setNewFixedCost(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Office Rent"
                        data-testid="fixed-cost-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select 
                        value={newFixedCost.category}
                        onValueChange={(v) => setNewFixedCost(prev => ({ ...prev, category: v }))}
                      >
                        <SelectTrigger data-testid="fixed-cost-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rent">Rent</SelectItem>
                          <SelectItem value="utilities">Utilities</SelectItem>
                          <SelectItem value="insurance">Insurance</SelectItem>
                          <SelectItem value="subscriptions">Subscriptions</SelectItem>
                          <SelectItem value="equipment">Equipment Lease</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (£)</Label>
                      <Input 
                        type="number"
                        value={newFixedCost.amount}
                        onChange={(e) => setNewFixedCost(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        data-testid="fixed-cost-amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select 
                        value={newFixedCost.frequency}
                        onValueChange={(v) => setNewFixedCost(prev => ({ ...prev, frequency: v }))}
                      >
                        <SelectTrigger data-testid="fixed-cost-frequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Textarea 
                        value={newFixedCost.notes}
                        onChange={(e) => setNewFixedCost(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Any additional notes..."
                        data-testid="fixed-cost-notes"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowFixedCostDialog(false)}>Cancel</Button>
                    <Button 
                      onClick={() => createFixedCostMutation.mutate(newFixedCost)}
                      disabled={!newFixedCost.name || newFixedCost.amount <= 0}
                      data-testid="save-fixed-cost"
                    >
                      Add Cost
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="pt-6">
                {fixedCosts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No fixed costs added yet</p>
                    <p className="text-sm">Add recurring expenses like rent, utilities, insurance</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fixedCosts.map(cost => (
                      <div key={cost.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`fixed-cost-${cost.id}`}>
                        <div>
                          <p className="font-medium">{cost.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{cost.category}</Badge>
                            <span className="text-sm text-gray-500">{cost.frequency}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-lg">{formatCurrency(cost.amount)}</span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteFixedCostMutation.mutate(cost.id)}
                            data-testid={`delete-fixed-cost-${cost.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Separator className="my-4" />
                    <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                      <span className="font-semibold">Total Monthly Fixed Costs</span>
                      <span className="text-xl font-bold">
                        {formatCurrency(fixedCosts.reduce((sum, fc) => {
                          if (fc.frequency === 'monthly') return sum + fc.amount;
                          if (fc.frequency === 'weekly') return sum + (fc.amount * 4.33);
                          if (fc.frequency === 'yearly') return sum + (fc.amount / 12);
                          return sum + fc.amount;
                        }, 0))}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showChaseDialog} onOpenChange={setShowChaseDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Chase Payment</DialogTitle>
              <DialogDescription>
                {selectedInvoice && (
                  <span>
                    Invoice {selectedInvoice.invoiceNo} - {selectedInvoice.customerName} - {formatCurrency(selectedInvoice.total)}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {generateChaseMutation.isPending ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-600" />
                  <p className="mt-2 text-gray-600">Generating AI chase message...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Chase Message</Label>
                    <Textarea 
                      value={chaseMessage}
                      onChange={(e) => setChaseMessage(e.target.value)}
                      className="min-h-48"
                      placeholder="Edit your chase message here..."
                      data-testid="chase-message-textarea"
                    />
                  </div>
                  {selectedInvoice?.customerEmail && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      Will be sent to: {selectedInvoice.customerEmail}
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowChaseDialog(false)}>Cancel</Button>
              <Button
                onClick={() => generateChaseMutation.mutate(selectedInvoice!.id)}
                variant="secondary"
                disabled={!selectedInvoice || generateChaseMutation.isPending}
                data-testid="regenerate-chase"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button
                onClick={() => selectedInvoice && sendChaseMutation.mutate({ invoiceId: selectedInvoice.id, message: chaseMessage })}
                disabled={!chaseMessage || sendChaseMutation.isPending}
                data-testid="send-chase"
              >
                <Send className="w-4 h-4 mr-2" />
                Record Chase
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
