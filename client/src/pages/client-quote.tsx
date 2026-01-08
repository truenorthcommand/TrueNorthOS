import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Loader2, Building, Phone, Mail, MapPin, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type LineItem = {
  id: string;
  itemCode?: string;
  description: string;
  quantity: number;
  unitCost: number;
  discount: number;
  amount: number;
};

type Quote = {
  id: string;
  quoteNo: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  siteAddress: string | null;
  sitePostcode: string | null;
  quoteDate: string;
  expiryDate: string | null;
  description: string | null;
  lineItems: LineItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  terms: string | null;
  notes: string | null;
  status: string;
};

type CompanySettings = {
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  vatNumber: string | null;
};

export default function ClientQuote() {
  const params = useParams();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchQuote();
  }, [params.token]);

  const fetchQuote = async () => {
    try {
      const res = await fetch(`/api/quotes/view/${params.token}`);
      if (res.ok) {
        const data = await res.json();
        setQuote({ ...data.quote, lineItems: data.quote.lineItems || [] });
        setCompany(data.companySettings);
      } else {
        setError("Quote not found or has expired");
      }
    } catch (err) {
      setError("Failed to load quote");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/accept/${params.token}`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setQuote({ ...updated, lineItems: updated.lineItems || [] });
      } else {
        const err = await res.json();
        setError(err.error || "Failed to accept quote");
      }
    } catch (err) {
      setError("Failed to accept quote");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/decline/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason }),
      });
      if (res.ok) {
        const updated = await res.json();
        setQuote({ ...updated, lineItems: updated.lineItems || [] });
        setShowDeclineDialog(false);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to decline quote");
      }
    } catch (err) {
      setError("Failed to decline quote");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Quote</h2>
            <p className="text-muted-foreground">{error || "Quote not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = quote.expiryDate && new Date(quote.expiryDate) < new Date();
  const canRespond = quote.status === "Sent" && !isExpired;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {company?.companyName && (
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary">{company.companyName}</h1>
            {company.companyAddress && <p className="text-muted-foreground">{company.companyAddress}</p>}
            <div className="flex items-center justify-center gap-4 mt-2 text-sm text-muted-foreground">
              {company.companyPhone && (
                <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{company.companyPhone}</span>
              )}
              {company.companyEmail && (
                <span className="flex items-center gap-1"><Mail className="w-4 h-4" />{company.companyEmail}</span>
              )}
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Quote {quote.quoteNo}</CardTitle>
              <p className="text-muted-foreground mt-1">
                Prepared for {quote.customerName}
              </p>
            </div>
            <Badge className={
              quote.status === "Accepted" ? "bg-emerald-500" :
              quote.status === "Declined" ? "bg-red-500" :
              quote.status === "Sent" ? "bg-blue-500" : "bg-slate-500"
            }>
              {quote.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Quote Date</p>
                <p className="font-medium">{format(new Date(quote.quoteDate), "dd MMMM yyyy")}</p>
              </div>
              {quote.expiryDate && (
                <div>
                  <p className="text-muted-foreground">Valid Until</p>
                  <p className={`font-medium ${isExpired ? 'text-destructive' : ''}`}>
                    {format(new Date(quote.expiryDate), "dd MMMM yyyy")}
                    {isExpired && " (Expired)"}
                  </p>
                </div>
              )}
              {quote.siteAddress && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Site Address</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {quote.siteAddress}{quote.sitePostcode && `, ${quote.sitePostcode}`}
                  </p>
                </div>
              )}
            </div>

            {quote.description && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{quote.description}</p>
                </div>
              </>
            )}

            <Separator />

            <div>
              <h3 className="font-semibold mb-4">Items</h3>
              <div className="overflow-x-auto">
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
                    {quote.lineItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-3 px-2">
                          {item.itemCode && <span className="text-muted-foreground mr-2">[{item.itemCode}]</span>}
                          {item.description}
                        </td>
                        <td className="py-3 px-2 text-right">{item.quantity}</td>
                        <td className="py-3 px-2 text-right">£{item.unitCost.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-medium">£{item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>£{quote.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT ({quote.vatRate}%)</span>
                  <span>£{quote.vatAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span>£{quote.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {quote.terms && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Terms & Conditions</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.terms}</p>
                </div>
              </>
            )}

            {quote.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {canRespond && (
          <Card className="border-2 border-primary">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-center">Respond to This Quote</h3>
              <div className="flex gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-emerald-500 hover:bg-emerald-600"
                  onClick={handleAccept}
                  disabled={isSubmitting}
                  data-testid="button-accept-quote"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                  Accept Quote
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={() => setShowDeclineDialog(true)}
                  disabled={isSubmitting}
                  data-testid="button-decline-quote"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Decline Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {quote.status === "Accepted" && (
          <Card className="border-2 border-emerald-500 bg-emerald-50">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-emerald-700">Quote Accepted</h3>
              <p className="text-emerald-600">Thank you! We will be in touch shortly to arrange the work.</p>
            </CardContent>
          </Card>
        )}

        {quote.status === "Declined" && (
          <Card className="border-2 border-red-500 bg-red-50">
            <CardContent className="p-6 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-red-700">Quote Declined</h3>
              <p className="text-red-600">This quote has been declined.</p>
            </CardContent>
          </Card>
        )}

        {company?.vatNumber && (
          <p className="text-center text-sm text-muted-foreground">
            VAT Registration: {company.vatNumber}
          </p>
        )}
      </div>

      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Are you sure you want to decline this quote?</p>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Please let us know why you're declining..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDecline} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
