import { useState, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AITextarea } from "@/components/ui/ai-assist";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, Send, FileText, Loader2, Copy, ExternalLink } from "lucide-react";
import { format, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
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
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  siteAddress: string | null;
  sitePostcode: string | null;
  reference: string | null;
  quoteDate: string;
  expiryDate: string | null;
  description: string | null;
  lineItems: LineItem[];
  subtotal: number;
  discountTotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  terms: string | null;
  notes: string | null;
  status: string;
  accessToken: string | null;
  convertedJobId: string | null;
};

export default function QuoteDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isNew = params.id === "new";

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [expandedDescriptionIndex, setExpandedDescriptionIndex] = useState<number | null>(null);
  const [expandedDescriptionValue, setExpandedDescriptionValue] = useState("");

  const [quote, setQuote] = useState<Quote>({
    id: "",
    quoteNo: "",
    customerId: null,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    siteAddress: "",
    sitePostcode: "",
    reference: "",
    quoteDate: new Date().toISOString(),
    expiryDate: addDays(new Date(), 30).toISOString(),
    description: "",
    lineItems: [],
    subtotal: 0,
    discountTotal: 0,
    vatRate: 20,
    vatAmount: 0,
    total: 0,
    terms: "",
    notes: "",
    status: "Draft",
    accessToken: null,
    convertedJobId: null,
  });

  useEffect(() => {
    if (!isNew) {
      fetchQuote();
    }
  }, [params.id]);

  const fetchQuote = async () => {
    try {
      const res = await fetch(`/api/quotes/${params.id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setQuote({
          ...data,
          lineItems: data.lineItems || [],
        });
      } else {
        toast({ title: "Error", description: "Quote not found", variant: "destructive" });
        setLocation("/quotes");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch quote", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotals = (items: LineItem[], vatRate: number) => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const discountTotal = items.reduce((sum, item) => sum + (item.unitCost * item.quantity * item.discount / 100), 0);
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;
    return { subtotal, discountTotal, vatAmount, total };
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...quote.lineItems];
    
    // Coerce numeric fields from string to number
    let finalValue = value;
    if (["quantity", "unitCost", "discount"].includes(field)) {
      finalValue = value === "" ? 0 : Number(value);
    }
    
    newItems[index] = { ...newItems[index], [field]: finalValue };
    
    if (["quantity", "unitCost", "discount"].includes(field)) {
      const item = newItems[index];
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.unitCost) || 0;
      const disc = Number(item.discount) || 0;
      const gross = qty * cost;
      const discountAmount = gross * (disc / 100);
      newItems[index].amount = gross - discountAmount;
    }
    
    const totals = calculateTotals(newItems, quote.vatRate);
    setQuote({ ...quote, lineItems: newItems, ...totals });
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      itemCode: "",
      description: "",
      quantity: 1,
      unitCost: 0,
      discount: 0,
      amount: 0,
    };
    setQuote({ ...quote, lineItems: [...quote.lineItems, newItem] });
  };

  const removeLineItem = (index: number) => {
    const newItems = quote.lineItems.filter((_, i) => i !== index);
    const totals = calculateTotals(newItems, quote.vatRate);
    setQuote({ ...quote, lineItems: newItems, ...totals });
  };

  const updateVatRate = (rate: number) => {
    const totals = calculateTotals(quote.lineItems, rate);
    setQuote({ ...quote, vatRate: rate, ...totals });
  };

  const saveQuote = async (sendAfterSave = false) => {
    if (!quote.customerName.trim()) {
      toast({ title: "Error", description: "Customer name is required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const method = isNew ? "POST" : "PUT";
      const url = isNew ? "/api/quotes" : `/api/quotes/${params.id}`;
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(quote),
      });

      if (res.ok) {
        const saved = await res.json();
        if (isNew) {
          const clientName = saved.client?.name || quote.customerName;
          const jobNo = saved.draftJob?.jobNo || "";
          toast({ 
            title: "Quote Created", 
            description: `Client "${clientName}" saved and draft job ${jobNo} created.`,
          });
          if (sendAfterSave) {
            await sendQuote(saved.id);
          }
          setLocation(`/quotes/${saved.id}`);
        } else {
          setQuote(saved);
          toast({ title: "Success", description: "Quote saved" });
          if (sendAfterSave) {
            await sendQuote(saved.id);
          }
        }
      } else {
        toast({ title: "Error", description: "Failed to save quote", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save quote", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const sendQuote = async (quoteId: string) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "Sent", sentAt: new Date().toISOString() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setQuote(updated);
        toast({ title: "Success", description: "Quote marked as sent" });
        setShowSendDialog(true);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send quote", variant: "destructive" });
    }
  };

  const convertToJob = async () => {
    try {
      const res = await fetch(`/api/quotes/${params.id}/convert-to-job`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const { job } = await res.json();
        toast({ title: "Success", description: "Quote converted to job" });
        setLocation(`/jobs/${job.id}`);
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to convert", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to convert quote to job", variant: "destructive" });
    }
  };

  const getClientLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/quote/${quote.accessToken}`;
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/quotes")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{isNew ? "New Quote" : `Quote ${quote.quoteNo}`}</h1>
            {!isNew && <Badge variant="secondary">{quote.status}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          {quote.status === "Accepted" && (
            <Button variant="outline" onClick={convertToJob} data-testid="button-convert-to-job">
              <FileText className="w-4 h-4 mr-2" />
              Convert to Job
            </Button>
          )}
          {quote.status === "Sent" && quote.accessToken && (
            <Button variant="outline" onClick={copyClientLink}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
          )}
          {(quote.status === "Draft" || isNew) && (
            <>
              <Button variant="outline" onClick={() => saveQuote(false)} disabled={isSaving} data-testid="button-save-quote">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
              <Button onClick={() => saveQuote(true)} disabled={isSaving} data-testid="button-send-quote">
                <Send className="w-4 h-4 mr-2" />
                Save & Send
              </Button>
            </>
          )}
        </div>
      </div>

      {!isNew && quote.convertedJobId && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Linked Job Sheet</p>
                  <p className="text-xs text-muted-foreground">A draft job was created for this quote</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setLocation(`/jobs/${quote.convertedJobId}`)}
                data-testid="button-view-linked-job"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Job
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Name *</Label>
                  <Input
                    value={quote.customerName}
                    onChange={(e) => setQuote({ ...quote, customerName: e.target.value })}
                    placeholder="Enter customer name"
                    data-testid="input-customer-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input
                    value={quote.reference || ""}
                    onChange={(e) => setQuote({ ...quote, reference: e.target.value })}
                    placeholder="Your reference"
                    data-testid="input-reference"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={quote.customerEmail || ""}
                    onChange={(e) => setQuote({ ...quote, customerEmail: e.target.value })}
                    placeholder="customer@email.com"
                    data-testid="input-customer-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={quote.customerPhone || ""}
                    onChange={(e) => setQuote({ ...quote, customerPhone: e.target.value })}
                    placeholder="Phone number"
                    data-testid="input-customer-phone"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Site Address</Label>
                  <Input
                    value={quote.siteAddress || ""}
                    onChange={(e) => setQuote({ ...quote, siteAddress: e.target.value })}
                    placeholder="Site address"
                    data-testid="input-site-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postcode</Label>
                  <Input
                    value={quote.sitePostcode || ""}
                    onChange={(e) => setQuote({ ...quote, sitePostcode: e.target.value })}
                    placeholder="Postcode"
                    data-testid="input-postcode"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quote Date</Label>
                  <Input
                    type="date"
                    value={quote.quoteDate ? format(new Date(quote.quoteDate), "yyyy-MM-dd") : ""}
                    onChange={(e) => setQuote({ ...quote, quoteDate: new Date(e.target.value).toISOString() })}
                    data-testid="input-quote-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input
                    type="date"
                    value={quote.expiryDate ? format(new Date(quote.expiryDate), "yyyy-MM-dd") : ""}
                    onChange={(e) => setQuote({ ...quote, expiryDate: new Date(e.target.value).toISOString() })}
                    data-testid="input-expiry-date"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <AITextarea
                value={quote.description || ""}
                onChange={(e) => setQuote({ ...quote, description: e.target.value })}
                placeholder="Enter a description of the work..."
                rows={4}
                data-testid="input-description"
                aiContext="quote work description"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Code</th>
                      <th className="text-left py-2 px-2">Description</th>
                      <th className="text-right py-2 px-2 w-20">Qty</th>
                      <th className="text-right py-2 px-2 w-24">Unit Cost</th>
                      <th className="text-right py-2 px-2 w-20">Disc %</th>
                      <th className="text-right py-2 px-2 w-24">Amount</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems.map((item, index) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2 px-2">
                          <Input
                            value={item.itemCode || ""}
                            onChange={(e) => updateLineItem(index, "itemCode", e.target.value)}
                            placeholder="Code"
                            className="h-8"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <div 
                            onClick={() => {
                              setExpandedDescriptionIndex(index);
                              setExpandedDescriptionValue(item.description);
                            }}
                            className="min-h-[32px] px-3 py-1.5 border rounded-md cursor-pointer hover:bg-muted/50 flex items-center text-sm truncate"
                            data-testid={`button-expand-description-${index}`}
                          >
                            {item.description || <span className="text-muted-foreground">Click to add description...</span>}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                            className="h-8 text-right"
                            min="0"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={item.unitCost}
                            onChange={(e) => updateLineItem(index, "unitCost", parseFloat(e.target.value) || 0)}
                            className="h-8 text-right"
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={item.discount}
                            onChange={(e) => updateLineItem(index, "discount", parseFloat(e.target.value) || 0)}
                            className="h-8 text-right"
                            min="0"
                            max="100"
                          />
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          £{item.amount.toFixed(2)}
                        </td>
                        <td className="py-2 px-2">
                          <Button variant="ghost" size="icon" onClick={() => removeLineItem(index)} className="h-8 w-8">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {quote.lineItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          No items added. Click "Add Item" to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Terms & Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Terms & Conditions</Label>
                <AITextarea
                  value={quote.terms || ""}
                  onChange={(e) => setQuote({ ...quote, terms: e.target.value })}
                  placeholder="Enter terms and conditions..."
                  rows={3}
                  aiContext="quote terms and conditions"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <AITextarea
                  value={quote.notes || ""}
                  onChange={(e) => setQuote({ ...quote, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                  aiContext="quote notes for customer"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>£{quote.subtotal.toFixed(2)}</span>
              </div>
              {quote.discountTotal > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-£{quote.discountTotal.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">VAT</span>
                  <Select
                    value={String(quote.vatRate)}
                    onValueChange={(v) => updateVatRate(parseFloat(v))}
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="20">20%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span>£{quote.vatAmount.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span>£{quote.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {quote.accessToken && quote.status !== "Draft" && (
            <Card>
              <CardHeader>
                <CardTitle>Client Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Share this link with your client to view and respond to the quote.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyClientLink} className="flex-1">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(getClientLink(), "_blank")}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quote Ready to Send</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Your quote has been saved and marked as sent. Share the link below with your client:</p>
            <div className="p-3 bg-muted rounded-md break-all text-sm">
              {getClientLink()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Close</Button>
            <Button onClick={() => { copyClientLink(); setShowSendDialog(false); }}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={expandedDescriptionIndex !== null} 
        onOpenChange={(open) => {
          if (!open) {
            setExpandedDescriptionIndex(null);
            setExpandedDescriptionValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Item Description</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <AITextarea
              value={expandedDescriptionValue}
              onChange={(e) => setExpandedDescriptionValue(e.target.value)}
              placeholder="Enter a detailed description for this line item..."
              rows={8}
              className="resize-none"
              autoFocus
              data-testid="textarea-expanded-description"
              aiContext="quote line item description"
            />
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                if (expandedDescriptionIndex !== null) {
                  updateLineItem(expandedDescriptionIndex, "description", expandedDescriptionValue);
                }
                setExpandedDescriptionIndex(null);
                setExpandedDescriptionValue("");
              }}
              data-testid="button-done-description"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
