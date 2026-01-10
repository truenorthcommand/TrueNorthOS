import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, Phone, Mail, MapPin, CreditCard, CheckCircle, Banknote } from "lucide-react";
import { format } from "date-fns";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

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
  customerName: string;
  customerEmail: string | null;
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
};

type CompanySettings = {
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankSortCode: string | null;
  bankAccountNumber: string | null;
  vatNumber: string | null;
};

function PaymentForm({ invoiceId, onSuccess }: { invoiceId: string; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setPaymentError(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      setPaymentError(error.message || "Payment failed");
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {paymentError && (
        <p className="text-sm text-destructive">{paymentError}</p>
      )}
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        data-testid="button-pay-now"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Pay Now"
        )}
      </Button>
    </form>
  );
}

export default function ClientInvoice() {
  const params = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank">("card");
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentInitError, setPaymentInitError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoice();
    checkStripe();
  }, [params.token]);

  const checkStripe = async () => {
    try {
      const res = await fetch("/api/stripe/config");
      if (res.ok) {
        const data = await res.json();
        if (data.publishableKey) {
          setStripePromise(loadStripe(data.publishableKey));
          setStripeEnabled(true);
        }
      }
    } catch (err) {
      console.log("Stripe not configured");
    }
  };

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`/api/invoices/view/${params.token}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice({ ...data.invoice, lineItems: data.invoice.lineItems || [] });
        setCompany(data.companySettings);
      } else {
        setError("Invoice not found");
      }
    } catch (err) {
      setError("Failed to load invoice");
    } finally {
      setIsLoading(false);
    }
  };

  const initializeCardPayment = async () => {
    if (!invoice) return;
    setPaymentInitError(null);
    setClientSecret(null);
    try {
      const res = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, accessToken: params.token }),
      });
      if (res.ok) {
        const data = await res.json();
        setClientSecret(data.clientSecret);
      } else {
        const data = await res.json();
        setPaymentInitError(data.error || "Failed to initialize payment");
        if (data.error === "Invoice is already paid") {
          fetchInvoice();
        }
      }
    } catch (err) {
      setPaymentInitError("Failed to initialize payment. Please try again.");
    }
  };

  useEffect(() => {
    if (paymentMethod === "card" && stripeEnabled && invoice && invoice.status !== "Paid") {
      initializeCardPayment();
    }
  }, [paymentMethod, stripeEnabled, invoice]);

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    fetchInvoice();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Invoice</h2>
            <p className="text-muted-foreground">{error || "Invoice not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== "Paid";

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
              <CardTitle className="text-2xl">Invoice {invoice.invoiceNo}</CardTitle>
              <p className="text-muted-foreground mt-1">For {invoice.customerName}</p>
            </div>
            <Badge className={
              invoice.status === "Paid" ? "bg-emerald-500" :
              isOverdue ? "bg-red-500" :
              invoice.status === "Sent" ? "bg-blue-500" : "bg-slate-500"
            }>
              {isOverdue ? "Overdue" : invoice.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Invoice Date</p>
                <p className="font-medium">{format(new Date(invoice.invoiceDate), "dd MMMM yyyy")}</p>
              </div>
              {invoice.dueDate && (
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className={`font-medium ${isOverdue ? 'text-destructive' : ''}`}>
                    {format(new Date(invoice.dueDate), "dd MMMM yyyy")}
                    {isOverdue && " (Overdue)"}
                  </p>
                </div>
              )}
              {invoice.siteAddress && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Site Address</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {invoice.siteAddress}{invoice.sitePostcode && `, ${invoice.sitePostcode}`}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-4">Items</h3>
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
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id} className="border-b">
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
                  <span>Total Due</span>
                  <span>£{invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {invoice.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {invoice.status === "Paid" || paymentSuccess ? (
          <Card className="border-2 border-emerald-500 bg-emerald-50">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-emerald-700">Payment Received</h3>
              <p className="text-emerald-600">Thank you for your payment!</p>
            </CardContent>
          </Card>
        ) : (stripeEnabled || company?.bankAccountNumber) ? (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stripeEnabled && company?.bankAccountNumber && (
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={paymentMethod === "card" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setPaymentMethod("card")}
                    data-testid="button-pay-card"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay by Card
                  </Button>
                  <Button
                    variant={paymentMethod === "bank" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setPaymentMethod("bank")}
                    data-testid="button-pay-bank"
                  >
                    <Banknote className="w-4 h-4 mr-2" />
                    Bank Transfer
                  </Button>
                </div>
              )}

              {(paymentMethod === "card" && stripeEnabled) ? (
                <>
                  <p className="text-muted-foreground">
                    Pay securely with your credit or debit card:
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="flex justify-between text-lg mb-4">
                      <span className="font-semibold">Amount to Pay</span>
                      <span className="font-bold">£{invoice.total.toFixed(2)}</span>
                    </div>
                    {paymentInitError ? (
                      <div className="text-center py-4">
                        <p className="text-destructive mb-2">{paymentInitError}</p>
                        <Button variant="outline" onClick={initializeCardPayment}>
                          Try Again
                        </Button>
                      </div>
                    ) : stripePromise && clientSecret ? (
                      <Elements
                        stripe={stripePromise}
                        options={{
                          clientSecret,
                          appearance: {
                            theme: "stripe",
                            variables: {
                              colorPrimary: "#2563eb",
                            },
                          },
                        }}
                      >
                        <PaymentForm invoiceId={invoice.id} onSuccess={handlePaymentSuccess} />
                      </Elements>
                    ) : (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                </>
              ) : company?.bankAccountNumber ? (
                <>
                  <p className="text-muted-foreground">
                    Please make payment by bank transfer using the details below:
                  </p>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 space-y-3">
                    {company.bankName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bank</span>
                        <span className="font-medium">{company.bankName}</span>
                      </div>
                    )}
                    {company.bankAccountName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Name</span>
                        <span className="font-medium">{company.bankAccountName}</span>
                      </div>
                    )}
                    {company.bankSortCode && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sort Code</span>
                        <span className="font-mono font-medium">{company.bankSortCode}</span>
                      </div>
                    )}
                    {company.bankAccountNumber && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Number</span>
                        <span className="font-mono font-medium">{company.bankAccountNumber}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reference</span>
                      <span className="font-mono font-medium">{invoice.invoiceNo}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold">Amount</span>
                      <span className="font-bold">£{invoice.total.toFixed(2)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Please use the invoice number as your payment reference
                  </p>
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {company?.vatNumber && (
          <p className="text-center text-sm text-muted-foreground">
            VAT Registration: {company.vatNumber}
          </p>
        )}
      </div>
    </div>
  );
}
