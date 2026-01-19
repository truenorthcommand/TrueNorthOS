import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, XCircle, Phone, Mail, FileText, Receipt, 
  Briefcase, CheckCircle, Clock, AlertTriangle, ExternalLink,
  Building2, MapPin, Calendar
} from "lucide-react";
import { format } from "date-fns";

interface PortalQuote {
  id: string;
  quoteNo: string;
  accessToken: string;
  total: number;
  status: string;
  quoteDate: string;
  expiryDate: string | null;
  description: string | null;
}

interface PortalInvoice {
  id: string;
  invoiceNo: string;
  accessToken: string;
  total: number;
  status: string;
  invoiceDate: string;
  dueDate: string | null;
}

interface PortalJob {
  id: string;
  jobNo: string;
  status: string;
  description: string | null;
  address: string | null;
  date: string | null;
}

interface PortalClient {
  id: string;
  name: string;
  email: string | null;
}

interface CompanySettings {
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
}

interface PortalData {
  client: PortalClient;
  quotes: PortalQuote[];
  invoices: PortalInvoice[];
  jobs: PortalJob[];
  companySettings: CompanySettings | null;
}

export default function CustomerPortal() {
  const params = useParams();
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchPortalData();
  }, [params.token]);

  const fetchPortalData = async () => {
    try {
      const res = await fetch(`/api/portal/${params.token}`);
      if (res.ok) {
        const data = await res.json();
        setPortalData(data);
      } else {
        setError("Portal not found or has expired");
      }
    } catch (err) {
      setError("Failed to load portal");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  };

  const getStatusBadge = (status: string, type: 'quote' | 'invoice' | 'job') => {
    const statusColors: Record<string, string> = {
      'Draft': 'bg-slate-500',
      'Sent': 'bg-blue-500',
      'Accepted': 'bg-emerald-500',
      'Declined': 'bg-red-500',
      'Expired': 'bg-orange-500',
      'Converted': 'bg-purple-500',
      'Paid': 'bg-emerald-500',
      'Overdue': 'bg-red-500',
      'Ready': 'bg-purple-500',
      'In Progress': 'bg-blue-500',
      'Awaiting Signatures': 'bg-amber-500',
      'Signed Off': 'bg-emerald-600',
    };
    return (
      <Badge className={statusColors[status] || 'bg-slate-500'} data-testid={`badge-status-${status.toLowerCase().replace(' ', '-')}`}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" data-testid="portal-loading">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0F2B4C] mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error || !portalData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" data-testid="portal-error">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Portal</h2>
            <p className="text-muted-foreground">{error || "Portal not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { client, quotes, invoices, jobs, companySettings } = portalData;
  
  const pendingQuotes = quotes.filter(q => q.status === 'Sent');
  const unpaidInvoices = invoices.filter(i => i.status !== 'Paid');
  const activeJobs = jobs.filter(j => j.status !== 'Signed Off' && j.status !== 'Draft');
  
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div className="min-h-screen bg-slate-50" data-testid="customer-portal">
      <div className="bg-[#0F2B4C] text-white py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              {companySettings?.companyName && (
                <h1 className="text-2xl font-bold">{companySettings.companyName}</h1>
              )}
              <p className="text-white/80 mt-1">Customer Portal</p>
            </div>
            <div className="flex items-center gap-4 text-sm text-white/80">
              {companySettings?.companyPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  {companySettings.companyPhone}
                </span>
              )}
              {companySettings?.companyEmail && (
                <span className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {companySettings.companyEmail}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <Card className="border-[#0F2B4C]/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Welcome back,</p>
                <h2 className="text-2xl font-bold text-[#0F2B4C]" data-testid="text-client-name">{client.name}</h2>
                {client.email && <p className="text-muted-foreground">{client.email}</p>}
              </div>
              <div className="flex gap-3">
                <div className="text-center px-4 py-2 bg-amber-50 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600" data-testid="text-pending-quotes">{pendingQuotes.length}</p>
                  <p className="text-xs text-amber-600">Pending Quotes</p>
                </div>
                <div className="text-center px-4 py-2 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600" data-testid="text-active-jobs">{activeJobs.length}</p>
                  <p className="text-xs text-blue-600">Active Jobs</p>
                </div>
                <div className="text-center px-4 py-2 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600" data-testid="text-outstanding">{formatCurrency(totalOutstanding)}</p>
                  <p className="text-xs text-red-600">Outstanding</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-slate-100">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#0F2B4C] data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="quotes" className="data-[state=active]:bg-[#0F2B4C] data-[state=active]:text-white">
              Quotes ({quotes.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="data-[state=active]:bg-[#0F2B4C] data-[state=active]:text-white">
              Invoices ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="jobs" className="data-[state=active]:bg-[#0F2B4C] data-[state=active]:text-white">
              Jobs ({jobs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {pendingQuotes.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="w-5 h-5" />
                    Action Required
                  </CardTitle>
                  <CardDescription>You have {pendingQuotes.length} quote(s) awaiting your response</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingQuotes.map(quote => (
                    <div key={quote.id} className="flex items-center justify-between p-3 bg-white rounded-lg border" data-testid={`pending-quote-${quote.id}`}>
                      <div>
                        <p className="font-medium">{quote.quoteNo}</p>
                        <p className="text-sm text-muted-foreground">{quote.description || 'No description'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">{formatCurrency(quote.total)}</span>
                        <a href={`/quote/${quote.accessToken}`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" className="bg-[#0F2B4C] hover:bg-[#1a3d63]" data-testid={`view-quote-${quote.id}`}>
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View & Respond
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {unpaidInvoices.length > 0 && (
              <Card className="border-red-200 bg-red-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <Receipt className="w-5 h-5" />
                    Outstanding Invoices
                  </CardTitle>
                  <CardDescription>Total outstanding: {formatCurrency(totalOutstanding)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {unpaidInvoices.slice(0, 3).map(invoice => {
                    const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date();
                    return (
                      <div key={invoice.id} className="flex items-center justify-between p-3 bg-white rounded-lg border" data-testid={`unpaid-invoice-${invoice.id}`}>
                        <div>
                          <p className="font-medium">{invoice.invoiceNo}</p>
                          <p className="text-sm text-muted-foreground">
                            Due: {invoice.dueDate ? format(new Date(invoice.dueDate), 'dd MMM yyyy') : 'No due date'}
                            {isOverdue && <span className="text-red-600 ml-2">(Overdue)</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold">{formatCurrency(invoice.total)}</span>
                          <a href={`/invoice/${invoice.accessToken}`} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant={isOverdue ? "destructive" : "default"} className={!isOverdue ? "bg-[#0F2B4C] hover:bg-[#1a3d63]" : ""} data-testid={`pay-invoice-${invoice.id}`}>
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Pay Now
                            </Button>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {activeJobs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-[#0F2B4C]" />
                    Active Work
                  </CardTitle>
                  <CardDescription>Jobs currently in progress</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeJobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg" data-testid={`active-job-${job.id}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{job.jobNo}</p>
                          {getStatusBadge(job.status, 'job')}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{job.description || 'No description'}</p>
                        {job.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {job.address}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {pendingQuotes.length === 0 && unpaidInvoices.length === 0 && activeJobs.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">All Caught Up!</h3>
                  <p className="text-muted-foreground mt-1">No pending actions at this time.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="quotes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0F2B4C]" />
                  Your Quotes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quotes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No quotes yet</p>
                ) : (
                  <div className="space-y-3">
                    {quotes.map(quote => (
                      <div key={quote.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors" data-testid={`quote-row-${quote.id}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{quote.quoteNo}</p>
                            {getStatusBadge(quote.status, 'quote')}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date(quote.quoteDate), 'dd MMM yyyy')}
                            {quote.description && ` - ${quote.description}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-lg">{formatCurrency(quote.total)}</span>
                          <a href={`/quote/${quote.accessToken}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#0F2B4C]" />
                  Your Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No invoices yet</p>
                ) : (
                  <div className="space-y-3">
                    {invoices.map(invoice => {
                      const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'Paid';
                      return (
                        <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors" data-testid={`invoice-row-${invoice.id}`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{invoice.invoiceNo}</p>
                              {getStatusBadge(isOverdue ? 'Overdue' : invoice.status, 'invoice')}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}
                              {invoice.dueDate && ` - Due: ${format(new Date(invoice.dueDate), 'dd MMM yyyy')}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-lg">{formatCurrency(invoice.total)}</span>
                            <a href={`/invoice/${invoice.accessToken}`} target="_blank" rel="noopener noreferrer">
                              <Button 
                                variant={invoice.status === 'Paid' ? 'outline' : 'default'} 
                                size="sm"
                                className={invoice.status !== 'Paid' ? "bg-[#0F2B4C] hover:bg-[#1a3d63]" : ""}
                              >
                                <ExternalLink className="w-4 h-4 mr-1" />
                                {invoice.status === 'Paid' ? 'View' : 'Pay'}
                              </Button>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-[#0F2B4C]" />
                  Your Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No jobs yet</p>
                ) : (
                  <div className="space-y-3">
                    {jobs.map(job => (
                      <div key={job.id} className="p-4 border rounded-lg hover:bg-slate-50 transition-colors" data-testid={`job-row-${job.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{job.jobNo}</p>
                            {getStatusBadge(job.status, 'job')}
                          </div>
                          {job.date && (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {format(new Date(job.date), 'dd MMM yyyy')}
                            </span>
                          )}
                        </div>
                        {job.description && (
                          <p className="text-muted-foreground mt-2">{job.description}</p>
                        )}
                        {job.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
                            <MapPin className="w-4 h-4" />
                            {job.address}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="text-center text-sm text-muted-foreground pb-8">
          {companySettings?.companyName && (
            <p>&copy; {new Date().getFullYear()} {companySettings.companyName}. All rights reserved.</p>
          )}
        </div>
      </div>
    </div>
  );
}
