import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  ArrowLeft,
  Save,
  FileText,
  Send,
  Copy,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Briefcase,
  Download,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

// Types
type QuoteLineItem = {
  id: string;
  type: 'material' | 'labour' | 'custom';
  itemCode?: string;
  description: string;
  quantity: number;
  unit?: string;
  unitCost: number;
  markup: number;
  discount: number;
  vatRate: number;
  amount: number;
};

type Quote = {
  id: string;
  quoteNo: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired' | 'Converted';
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  siteAddress: string;
  sitePostcode?: string;
  reference?: string;
  description?: string;
  quoteDate?: string;
  expiryDate?: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountTotal?: number;
  vatAmount?: number;
  total: number;
  terms?: string;
  notes?: string;
  internalNotes?: string;
  paymentTerms?: string;
  customPaymentTerms?: string;
  markupPercentage?: number;
  overallDiscount?: number;
  accessToken?: string;
  sentAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  convertedJobId?: string;
  convertedInvoiceId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
};

// Constants
const UNITS = ['each', 'm²', 'm', 'hours', 'days', 'litres', 'kg', 'metres', 'rolls', 'packs'];
const VAT_RATES = [{ label: '20%', value: 20 }, { label: '5%', value: 5 }, { label: '0%', value: 0 }];
const PAYMENT_TERMS = ['Net 7', 'Net 14', 'Net 30', 'Net 60', 'Due on Receipt', 'Custom'];

const DEFAULT_TERMS = `Terms & Conditions

1. This quotation is valid for the period stated above from the date of issue.
2. Payment terms are as stated above from the date of invoice.
3. Any additional work not included in this quotation will be charged separately.
4. All prices are subject to VAT at the applicable rate.
5. Adapt Services Group reserves the right to amend pricing if the scope of work changes.
6. Work will be scheduled upon acceptance of this quotation.
7. Cancellation within 48 hours of scheduled work may incur a cancellation fee.
8. All materials remain the property of Adapt Services Group until paid in full.
9. A warranty period of 12 months applies to all workmanship from completion date.
10. Access to the property must be provided at the agreed time. Failed access visits may be charged.`;

// Utility functions
function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function formatCurrency(amount: number): string {
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calculateLineAmount(item: QuoteLineItem): number {
  const base = item.quantity * item.unitCost;
  const afterMarkup = base * (1 + item.markup / 100);
  const afterDiscount = afterMarkup * (1 - item.discount / 100);
  return Math.round(afterDiscount * 100) / 100;
}

function createEmptyLineItem(): QuoteLineItem {
  return {
    id: generateId(),
    type: 'material',
    description: '',
    quantity: 1,
    unit: 'each',
    unitCost: 0,
    markup: 0,
    discount: 0,
    vatRate: 20,
    amount: 0,
  };
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Draft': return 'bg-gray-100 text-gray-700 border-gray-300';
    case 'Sent': return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'Accepted': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    case 'Declined': return 'bg-red-100 text-red-700 border-red-300';
    case 'Expired': return 'bg-gray-100 text-gray-500 border-gray-300';
    case 'Converted': return 'bg-purple-100 text-purple-700 border-purple-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-300';
  }
}

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Quote fields
  const [quote, setQuote] = useState<Quote | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [sitePostcode, setSitePostcode] = useState('');
  const [quoteDate, setQuoteDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [globalMarkup, setGlobalMarkup] = useState(0);
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [customPaymentTerms, setCustomPaymentTerms] = useState('');
  const [termsText, setTermsText] = useState(DEFAULT_TERMS);
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Fetch quote data
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const response = await apiRequest('GET', `/api/quotes/${id}`);
        const data = await response.json();
        setQuote(data);
        setCustomerName(data.customerName || '');
        setCustomerEmail(data.customerEmail || '');
        setCustomerPhone(data.customerPhone || '');
        setSiteAddress(data.siteAddress || '');
        setSitePostcode(data.sitePostcode || '');
        setQuoteDate(data.quoteDate ? data.quoteDate.split('T')[0] : (data.createdAt ? data.createdAt.split('T')[0] : ''));
        setExpiryDate(data.expiryDate ? data.expiryDate.split('T')[0] : '');
        setReference(data.reference || '');
        setDescription(data.description || '');
        setLineItems(data.lineItems && data.lineItems.length > 0 ? data.lineItems.map((item: QuoteLineItem) => ({
          ...item,
          id: item.id || generateId(),
          amount: calculateLineAmount(item),
        })) : [createEmptyLineItem()]);
        setGlobalMarkup(data.markupPercentage || 0);
        setOverallDiscount(data.overallDiscount || 0);
        setPaymentTerms(data.paymentTerms || 'Net 30');
        setCustomPaymentTerms(data.customPaymentTerms || '');
        setTermsText(data.terms || DEFAULT_TERMS);
        setNotes(data.notes || '');
        setInternalNotes(data.internalNotes || '');
      } catch (err: any) {
        toast({ title: 'Error', description: 'Failed to load quote', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Calculations
  const calculations = useMemo(() => {
    const materialsSubtotal = lineItems
      .filter(i => i.type === 'material')
      .reduce((sum, i) => sum + i.amount, 0);
    const labourSubtotal = lineItems
      .filter(i => i.type === 'labour')
      .reduce((sum, i) => sum + i.amount, 0);
    const customSubtotal = lineItems
      .filter(i => i.type === 'custom')
      .reduce((sum, i) => sum + i.amount, 0);
    const subtotal = materialsSubtotal + labourSubtotal + customSubtotal;

    const afterGlobalMarkup = subtotal * (1 + globalMarkup / 100);
    const afterDiscount = afterGlobalMarkup * (1 - overallDiscount / 100);
    const discountAmount = afterGlobalMarkup - afterDiscount;

    const vatBreakdown: Record<number, { items: number; amount: number }> = {};
    lineItems.forEach(item => {
      const itemAfterGlobal = item.amount * (1 + globalMarkup / 100) * (1 - overallDiscount / 100);
      const vatAmount = itemAfterGlobal * (item.vatRate / 100);
      if (!vatBreakdown[item.vatRate]) {
        vatBreakdown[item.vatRate] = { items: 0, amount: 0 };
      }
      vatBreakdown[item.vatRate].items += 1;
      vatBreakdown[item.vatRate].amount += vatAmount;
    });

    const totalVat = Object.values(vatBreakdown).reduce((sum, v) => sum + v.amount, 0);
    const grandTotal = afterDiscount + totalVat;

    return {
      materialsSubtotal,
      labourSubtotal,
      customSubtotal,
      subtotal,
      afterGlobalMarkup,
      discountAmount,
      afterDiscount,
      vatBreakdown,
      totalVat,
      grandTotal,
    };
  }, [lineItems, globalMarkup, overallDiscount]);

  // Line item handlers
  const updateLineItem = useCallback((itemId: string, updates: Partial<QuoteLineItem>) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, ...updates };
      updated.amount = calculateLineAmount(updated);
      return updated;
    }));
  }, []);

  const addLineItem = () => {
    setLineItems(prev => [...prev, createEmptyLineItem()]);
  };

  const removeLineItem = (itemId: string) => {
    setLineItems(prev => prev.length > 1 ? prev.filter(item => item.id !== itemId) : prev);
  };

  const moveLineItem = (index: number, direction: 'up' | 'down') => {
    setLineItems(prev => {
      const items = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= items.length) return prev;
      [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
      return items;
    });
  };

  // Action handlers
  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        customerName,
        customerEmail,
        customerPhone,
        siteAddress,
        sitePostcode,
        reference,
        description,
        quoteDate: quoteDate ? new Date(quoteDate).toISOString() : undefined,
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
        lineItems,
        subtotal: calculations.subtotal,
        discountTotal: calculations.discountAmount,
        vatAmount: calculations.totalVat,
        total: calculations.grandTotal,
        terms: termsText,
        notes,
        internalNotes,
        paymentTerms,
        customPaymentTerms: paymentTerms === 'Custom' ? customPaymentTerms : '',
        markupPercentage: globalMarkup,
        overallDiscount,
      };

      const response = await apiRequest('PUT', `/api/quotes/${id}`, body);
      const data = await response.json();
      setQuote(data);
      toast({ title: 'Quote Saved', description: 'All changes have been saved.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save quote', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Load logo
      try {
        const logoResponse = await fetch('/logo.png');
        const logoBlob = await logoResponse.blob();
        const logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        doc.addImage(logoBase64, 'PNG', 14, 10, 40, 16);
      } catch {
        doc.setFontSize(14);
        doc.setTextColor(15, 43, 76);
        doc.text('Adapt Services Group', 14, 20);
      }

      // Company address (right side)
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text('Adapt Services Group', pageWidth - 14, 12, { align: 'right' });
      doc.text('Unit 2 Meadow View Industrial Estate', pageWidth - 14, 17, { align: 'right' });
      doc.text('Ruckinge, Ashford, Kent', pageWidth - 14, 22, { align: 'right' });
      doc.text('TN26 2NR', pageWidth - 14, 27, { align: 'right' });
      doc.text('info@adaptservicesgroup.co.uk', pageWidth - 14, 32, { align: 'right' });

      // QUOTATION title
      doc.setFontSize(22);
      doc.setTextColor(15, 43, 76);
      doc.text('QUOTATION', 14, 42);

      // Divider line
      doc.setDrawColor(232, 165, 75);
      doc.setLineWidth(1);
      doc.line(14, 45, pageWidth - 14, 45);

      // Quote details (left)
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(`Quote Ref: ${quote?.quoteNo || 'N/A'}`, 14, 54);
      doc.text(`Date: ${quoteDate ? new Date(quoteDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}`, 14, 60);
      if (expiryDate) {
        doc.text(`Valid Until: ${new Date(expiryDate).toLocaleDateString('en-GB')}`, 14, 66);
      }
      doc.text(`Payment Terms: ${paymentTerms === 'Custom' ? customPaymentTerms : paymentTerms}`, 14, 72);

      // Client info (right)
      doc.setFontSize(10);
      doc.setTextColor(15, 43, 76);
      doc.text('QUOTED TO:', pageWidth - 80, 54);
      doc.setTextColor(0);
      doc.text(customerName || 'N/A', pageWidth - 80, 60);
      if (siteAddress) doc.text(siteAddress, pageWidth - 80, 66);
      if (sitePostcode) doc.text(sitePostcode, pageWidth - 80, 72);

      // Line items table header
      let y = 85;
      doc.setFillColor(15, 43, 76);
      doc.rect(14, y - 5, pageWidth - 28, 8, 'F');
      doc.setTextColor(255);
      doc.setFontSize(8);
      doc.text('Description', 16, y);
      doc.text('Qty', 100, y);
      doc.text('Unit', 115, y);
      doc.text('Unit Cost', 130, y);
      doc.text('VAT', 155, y);
      doc.text('Amount', pageWidth - 16, y, { align: 'right' });

      // Line items
      y += 8;
      doc.setTextColor(0);
      doc.setFontSize(9);
      const descMaxWidth = 80; // Max width for description column in mm
      lineItems.forEach((item, index) => {
        // Wrap description text to fit within allocated column width
        const descText = item.description || 'Item';
        const wrappedDesc = doc.splitTextToSize(descText, descMaxWidth);
        const rowHeight = Math.max(7, wrappedDesc.length * 5);

        // Check if we need a new page
        if (y + rowHeight > 250) {
          doc.addPage();
          y = 20;
        }

        // Alternating row background
        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(14, y - 4, pageWidth - 28, rowHeight, 'F');
        }

        // Description (wrapped, no prefix)
        wrappedDesc.forEach((line: string, lineIdx: number) => {
          doc.text(line, 16, y + (lineIdx * 5));
        });

        // Other columns (aligned to first line)
        doc.text(String(item.quantity), 100, y);
        doc.text(item.unit || 'each', 115, y);
        doc.text(`£${item.unitCost.toFixed(2)}`, 130, y);
        doc.text(`${item.vatRate}%`, 155, y);
        doc.text(`£${item.amount.toFixed(2)}`, pageWidth - 16, y, { align: 'right' });

        y += rowHeight;
      });

      // Totals section
      y += 8;
      doc.setDrawColor(200);
      doc.line(120, y - 3, pageWidth - 14, y - 3);
      doc.setFontSize(10);
      y += 4;
      doc.text('Subtotal:', 130, y);
      doc.text(`£${calculations.subtotal.toFixed(2)}`, pageWidth - 16, y, { align: 'right' });
      if (calculations.discountAmount > 0) {
        y += 7;
        doc.text('Discount:', 130, y);
        doc.text(`-£${calculations.discountAmount.toFixed(2)}`, pageWidth - 16, y, { align: 'right' });
      }
      Object.entries(calculations.vatBreakdown).forEach(([rate, data]: [string, any]) => {
        if (data.amount > 0) {
          y += 7;
          doc.text(`VAT @ ${rate}%:`, 130, y);
          doc.text(`£${data.amount.toFixed(2)}`, pageWidth - 16, y, { align: 'right' });
        }
      });
      y += 10;
      doc.setFontSize(13);
      doc.setTextColor(15, 43, 76);
      doc.text('TOTAL:', 130, y);
      doc.text(`£${calculations.grandTotal.toFixed(2)}`, pageWidth - 16, y, { align: 'right' });

      // Terms and Conditions
      y += 18;
      if (y > 200) {
        doc.addPage();
        y = 20;
      }
      doc.setDrawColor(232, 165, 75);
      doc.setLineWidth(0.5);
      doc.line(14, y - 3, pageWidth - 14, y - 3);
      y += 5;
      doc.setFontSize(11);
      doc.setTextColor(15, 43, 76);
      doc.text('Terms & Conditions', 14, y);
      y += 8;
      doc.setFontSize(8);
      doc.setTextColor(60);

      const termsLines = termsText.split('\n');
      termsLines.forEach((line) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
        if (line.trim()) {
          const wrappedLines = doc.splitTextToSize(line, pageWidth - 28);
          wrappedLines.forEach((wl: string) => {
            doc.text(wl, 14, y);
            y += 4.5;
          });
        } else {
          y += 3;
        }
      });

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(
          `Adapt Services Group | Unit 2 Meadow View Industrial Estate, Ruckinge, Ashford, Kent, TN26 2NR | Page ${i} of ${totalPages}`,
          pageWidth / 2, pageHeight - 8, { align: 'center' }
        );
      }

      doc.save(`${quote?.quoteNo || 'quote'}.pdf`);
      toast({ title: 'PDF Generated', description: 'Your quote PDF has been downloaded.' });
    } catch (err) {
      console.error('PDF generation error:', err);
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  const handleSendToClient = async () => {
    try {
      const accessUrl = quote?.accessToken
        ? `${window.location.origin}/quote/view/${quote.accessToken}`
        : `${window.location.origin}/quotes/${id}`;
      await navigator.clipboard.writeText(accessUrl);
      toast({ title: 'Link Copied', description: 'Client quote link copied to clipboard. Share via email or messaging.' });

      // Update status to Sent if currently Draft
      if (quote?.status === 'Draft') {
        try {
          const response = await apiRequest('PUT', `/api/quotes/${id}`, { status: 'Sent' });
          const data = await response.json();
          setQuote(data);
        } catch {}
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const handleClone = async () => {
    try {
      const response = await apiRequest('POST', `/api/quotes/${id}/clone`);
      const cloned = await response.json();
      toast({ title: 'Quote Cloned', description: `Clone created: ${cloned.quoteNo || 'New Quote'}` });
      navigate(`/quotes/${cloned.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to clone quote', variant: 'destructive' });
    }
  };

  const handleConvertToInvoice = async () => {
    try {
      const response = await apiRequest('POST', '/api/invoices', {
        customerId: quote?.customerId,
        customerName,
        customerEmail,
        customerPhone,
        siteAddress,
        sitePostcode,
        lineItems,
        subtotal: calculations.subtotal,
        vatAmount: calculations.totalVat,
        total: calculations.grandTotal,
        notes: `Converted from Quote ${quote?.quoteNo}`,
        quoteId: quote?.id,
      });
      const invoice = await response.json();
      toast({ title: 'Invoice Created', description: `Invoice has been created from this quote.` });
      navigate(`/invoices/${invoice.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to convert to invoice', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await apiRequest('DELETE', `/api/quotes/${id}`);
      toast({ title: 'Quote Deleted', description: 'Quote has been permanently deleted.' });
      navigate('/quotes');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete quote', variant: 'destructive' });
    }
  };

  // Render: Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0F2B4C] mx-auto mb-3" />
          <p className="text-gray-500">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">Quote not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/quotes')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Quotes
          </Button>
        </div>
      </div>
    );
  }

  // Render functions
  const renderDetailsTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#0F2B4C]">Client Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Client Name *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Client name"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="client@email.com"
                type="email"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div>
              <Label>Reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Job/PO reference"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#0F2B4C]">Site & Dates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Site Address *</Label>
              <Input
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                placeholder="Site address"
              />
            </div>
            <div>
              <Label>Postcode</Label>
              <Input
                value={sitePostcode}
                onChange={(e) => setSitePostcode(e.target.value)}
                placeholder="Postcode"
              />
            </div>
            <div>
              <Label>Quote Date</Label>
              <Input
                type="date"
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Description / Notes</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of work..."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderLineItemsTab = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-[#0F2B4C]">Line Items</CardTitle>
            <Button size="sm" onClick={addLineItem} className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90">
              <Plus className="w-4 h-4 mr-1" /> Add Line Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineItems.map((item, index) => (
            <div key={item.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
                  <span className="text-xs text-gray-400">#{index + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveLineItem(index, 'up')}
                    disabled={index === 0}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveLineItem(index, 'down')}
                    disabled={index === lineItems.length - 1}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLineItem(item.id)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                    disabled={lineItems.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={item.type}
                    onValueChange={(val) => updateLineItem(item.id, { type: val as 'material' | 'labour' | 'custom' })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="material">Material</SelectItem>
                      <SelectItem value="labour">Labour</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                    placeholder="Item description"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                    className="h-9"
                    min="0"
                    step="0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Select
                    value={item.unit || 'each'}
                    onValueChange={(val) => updateLineItem(item.id, { unit: val })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                <div>
                  <Label className="text-xs">Unit Cost (£)</Label>
                  <Input
                    type="number"
                    value={item.unitCost}
                    onChange={(e) => updateLineItem(item.id, { unitCost: parseFloat(e.target.value) || 0 })}
                    className="h-9"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label className="text-xs">Markup %</Label>
                  <Input
                    type="number"
                    value={item.markup}
                    onChange={(e) => updateLineItem(item.id, { markup: parseFloat(e.target.value) || 0 })}
                    className="h-9"
                    min="0"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Discount %</Label>
                  <Input
                    type="number"
                    value={item.discount}
                    onChange={(e) => updateLineItem(item.id, { discount: parseFloat(e.target.value) || 0 })}
                    className="h-9"
                    min="0"
                    max="100"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs">VAT Rate</Label>
                  <Select
                    value={String(item.vatRate)}
                    onValueChange={(val) => updateLineItem(item.id, { vatRate: parseInt(val) })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_RATES.map(vr => (
                        <SelectItem key={vr.value} value={String(vr.value)}>{vr.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Amount</Label>
                  <div className="h-9 flex items-center px-3 bg-gray-50 rounded-md border text-sm font-medium text-[#0F2B4C]">
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Running totals */}
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Materials</span>
                  <span>{formatCurrency(calculations.materialsSubtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Labour</span>
                  <span>{formatCurrency(calculations.labourSubtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Custom</span>
                  <span>{formatCurrency(calculations.customSubtotal)}</span>
                </div>
                <div className="border-t pt-1 flex justify-between font-semibold">
                  <span>Items Subtotal</span>
                  <span>{formatCurrency(calculations.subtotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPricingTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#0F2B4C]">Pricing Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Subtotals by type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-medium text-blue-600 uppercase">Materials</p>
              <p className="text-xl font-bold text-blue-900 mt-1">{formatCurrency(calculations.materialsSubtotal)}</p>
              <p className="text-xs text-blue-600 mt-1">{lineItems.filter(i => i.type === 'material').length} items</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs font-medium text-amber-600 uppercase">Labour</p>
              <p className="text-xl font-bold text-amber-900 mt-1">{formatCurrency(calculations.labourSubtotal)}</p>
              <p className="text-xs text-amber-600 mt-1">{lineItems.filter(i => i.type === 'labour').length} items</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs font-medium text-purple-600 uppercase">Custom</p>
              <p className="text-xl font-bold text-purple-900 mt-1">{formatCurrency(calculations.customSubtotal)}</p>
              <p className="text-xs text-purple-600 mt-1">{lineItems.filter(i => i.type === 'custom').length} items</p>
            </div>
          </div>

          {/* Global adjustments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Global Markup %</Label>
              <Input
                type="number"
                value={globalMarkup}
                onChange={(e) => setGlobalMarkup(parseFloat(e.target.value) || 0)}
                min="0"
                step="1"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">Applied on top of line item amounts</p>
            </div>
            <div>
              <Label>Overall Discount %</Label>
              <Input
                type="number"
                value={overallDiscount}
                onChange={(e) => setOverallDiscount(parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                step="1"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">Applied after markup</p>
            </div>
          </div>

          {/* VAT breakdown */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">VAT Breakdown</h4>
            <div className="space-y-2">
              {Object.entries(calculations.vatBreakdown).map(([rate, data]: [string, any]) => (
                <div key={rate} className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT @ {rate}% ({data.items} items)</span>
                  <span>{formatCurrency(data.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grand Total */}
          <div className="border-t pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal (items)</span>
                <span>{formatCurrency(calculations.subtotal)}</span>
              </div>
              {globalMarkup > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">After markup (+{globalMarkup}%)</span>
                  <span>{formatCurrency(calculations.afterGlobalMarkup)}</span>
                </div>
              )}
              {calculations.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount (-{overallDiscount}%)</span>
                  <span>-{formatCurrency(calculations.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Net amount</span>
                <span>{formatCurrency(calculations.afterDiscount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total VAT</span>
                <span>{formatCurrency(calculations.totalVat)}</span>
              </div>
              <div className="border-t pt-3 mt-3 flex justify-between items-center">
                <span className="text-lg font-bold text-[#0F2B4C]">Grand Total</span>
                <span className="text-2xl font-bold text-[#0F2B4C] bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
                  {formatCurrency(calculations.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTermsTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#0F2B4C]">Payment Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Payment Terms</Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment terms" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map(pt => (
                    <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {paymentTerms === 'Custom' && (
              <div>
                <Label>Custom Payment Terms</Label>
                <Input
                  value={customPaymentTerms}
                  onChange={(e) => setCustomPaymentTerms(e.target.value)}
                  placeholder="e.g. 50% upfront, 50% on completion"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#0F2B4C]">Terms & Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            rows={12}
            className="font-mono text-xs"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#0F2B4C]">Internal Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={4}
            placeholder="Internal notes (not visible to client)..."
          />
        </CardContent>
      </Card>
    </div>
  );

  const renderPreviewTab = () => (
    <div className="space-y-6">
      {/* Professional Quote Preview */}
      <Card className="border-2 border-[#0F2B4C]/20">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6 pb-4 border-b">
            <div>
              <h2 className="text-2xl font-bold text-[#0F2B4C]">Adapt Services Group</h2>
              <p className="text-sm text-gray-500 mt-1">Professional Services Quotation</p>
            </div>
            <div className="text-right">
              <Badge className="bg-[#0F2B4C] text-white text-sm px-3 py-1">{quote.quoteNo}</Badge>
              <p className="text-xs text-gray-500 mt-2">Date: {quoteDate ? new Date(quoteDate).toLocaleDateString('en-GB') : 'N/A'}</p>
              <p className="text-xs text-gray-500">Expires: {expiryDate ? new Date(expiryDate).toLocaleDateString('en-GB') : 'N/A'}</p>
            </div>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Client</h3>
              <p className="font-medium">{customerName}</p>
              {customerEmail && <p className="text-sm text-gray-600">{customerEmail}</p>}
              {customerPhone && <p className="text-sm text-gray-600">{customerPhone}</p>}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Site</h3>
              <p className="text-sm">{siteAddress}</p>
              {sitePostcode && <p className="text-sm text-gray-600">{sitePostcode}</p>}
              {reference && <p className="text-sm text-gray-500 mt-1">Ref: {reference}</p>}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-3">Line Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#0F2B4C]/20">
                    <th className="text-left py-2 pr-4">Description</th>
                    <th className="text-center py-2 px-2">Qty</th>
                    <th className="text-center py-2 px-2">Unit</th>
                    <th className="text-right py-2 px-2">Unit Cost</th>
                    <th className="text-right py-2 pl-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.filter(i => i.description.trim()).map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="py-2 pr-4">
                        <span className="font-medium">{item.description}</span>
                        <Badge variant="outline" className="ml-2 text-xs capitalize">{item.type}</Badge>
                      </td>
                      <td className="text-center py-2 px-2">{item.quantity}</td>
                      <td className="text-center py-2 px-2">{item.unit}</td>
                      <td className="text-right py-2 px-2">{formatCurrency(item.unitCost)}</td>
                      <td className="text-right py-2 pl-2 font-medium">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(calculations.afterDiscount)}</span>
              </div>
              {calculations.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(calculations.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>VAT</span>
                <span>{formatCurrency(calculations.totalVat)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-[#0F2B4C]">
                <span>Total</span>
                <span className="text-lg">{formatCurrency(calculations.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment Terms & Notes */}
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-gray-500">
              <strong>Payment Terms:</strong> {paymentTerms === 'Custom' ? customPaymentTerms : paymentTerms}
            </p>
            {notes && (
              <p className="text-xs text-gray-500 mt-2">
                <strong>Notes:</strong> {notes}
              </p>
            )}
            <details className="mt-3">
              <summary className="text-xs text-gray-400 cursor-pointer">Terms & Conditions</summary>
              <pre className="text-xs text-gray-400 mt-2 whitespace-pre-wrap font-sans">{termsText}</pre>
            </details>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button onClick={handleGeneratePdf} className="h-12 bg-[#0F2B4C] hover:bg-[#0F2B4C]/90">
          <Download className="w-4 h-4 mr-2" /> Generate PDF
        </Button>
        <Button onClick={handleSendToClient} className="h-12 bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white">
          <Send className="w-4 h-4 mr-2" /> Send to Client
        </Button>
        <Button variant="outline" className="h-12" onClick={() => {
          const url = quote.accessToken
            ? `${window.location.origin}/quote/view/${quote.accessToken}`
            : `${window.location.origin}/quotes/${id}`;
          navigator.clipboard.writeText(url);
          toast({ title: 'Link Copied', description: 'Client link copied to clipboard.' });
        }}>
          <Copy className="w-4 h-4 mr-2" /> Copy Client Link
        </Button>
      </div>

      {/* Client acceptance status */}
      {(quote.status === 'Accepted' || quote.status === 'Declined') && (
        <Card className={quote.status === 'Accepted' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {quote.status === 'Accepted' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <p className={`font-medium ${quote.status === 'Accepted' ? 'text-emerald-800' : 'text-red-800'}`}>
                  Quote {quote.status}
                </p>
                {quote.status === 'Accepted' && quote.acceptedAt && (
                  <p className="text-sm text-emerald-600">Accepted on {format(new Date(quote.acceptedAt), 'dd MMM yyyy HH:mm')}</p>
                )}
                {quote.status === 'Declined' && quote.declinedAt && (
                  <p className="text-sm text-red-600">Declined on {format(new Date(quote.declinedAt), 'dd MMM yyyy HH:mm')}</p>
                )}
                {quote.declineReason && (
                  <p className="text-sm text-red-600 mt-1">Reason: {quote.declineReason}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderActivityTab = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#0F2B4C]">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />

            <div className="space-y-6">
              {/* Created */}
              {quote.createdAt && (
                <div className="flex items-start gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-[#0F2B4C] flex items-center justify-center z-10 shrink-0">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="pt-1">
                    <p className="font-medium text-sm">Quote Created</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(quote.createdAt), 'dd MMM yyyy HH:mm')}
                      {quote.createdBy && ` by ${quote.createdBy}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{quote.quoteNo}</p>
                  </div>
                </div>
              )}

              {/* Sent */}
              {quote.sentAt && (
                <div className="flex items-start gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center z-10 shrink-0">
                    <Send className="w-4 h-4 text-white" />
                  </div>
                  <div className="pt-1">
                    <p className="font-medium text-sm">Quote Sent to Client</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(quote.sentAt), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              )}

              {/* Accepted */}
              {quote.acceptedAt && (
                <div className="flex items-start gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center z-10 shrink-0">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="pt-1">
                    <p className="font-medium text-sm text-emerald-700">Quote Accepted</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(quote.acceptedAt), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              )}

              {/* Declined */}
              {quote.declinedAt && (
                <div className="flex items-start gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center z-10 shrink-0">
                    <XCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="pt-1">
                    <p className="font-medium text-sm text-red-700">Quote Declined</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(quote.declinedAt), 'dd MMM yyyy HH:mm')}
                    </p>
                    {quote.declineReason && (
                      <p className="text-xs text-red-600 mt-1">Reason: {quote.declineReason}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Converted to Job */}
              {quote.convertedJobId && (
                <div className="flex items-start gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center z-10 shrink-0">
                    <Briefcase className="w-4 h-4 text-white" />
                  </div>
                  <div className="pt-1">
                    <p className="font-medium text-sm text-purple-700">Converted to Job</p>
                    <button
                      onClick={() => navigate(`/jobs/${quote.convertedJobId}`)}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      View Job →
                    </button>
                  </div>
                </div>
              )}

              {/* Converted to Invoice */}
              {quote.convertedInvoiceId && (
                <div className="flex items-start gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center z-10 shrink-0">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="pt-1">
                    <p className="font-medium text-sm text-purple-700">Converted to Invoice</p>
                    <button
                      onClick={() => navigate(`/invoices/${quote.convertedInvoiceId}`)}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      View Invoice →
                    </button>
                  </div>
                </div>
              )}

              {/* If no activity beyond creation */}
              {!quote.sentAt && !quote.acceptedAt && !quote.declinedAt && !quote.convertedJobId && !quote.convertedInvoiceId && (
                <div className="flex items-start gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center z-10 shrink-0">
                    <Clock className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="pt-1">
                    <p className="text-sm text-gray-500">Awaiting next action...</p>
                    <p className="text-xs text-gray-400">Send to client or make further edits</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Main render
  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Sticky Header */}
      <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/quotes')}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-[#0F2B4C]">{quote.quoteNo}</h1>
                  <Badge className={`text-xs ${getStatusColor(quote.status)}`}>
                    {quote.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">{customerName || 'No client'}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleGeneratePdf}>
                <Download className="w-4 h-4 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={handleSendToClient}>
                <Send className="w-4 h-4 mr-1" /> Send
              </Button>
              <Button size="sm" variant="outline" onClick={handleClone}>
                <Copy className="w-4 h-4 mr-1" /> Clone
              </Button>
              {quote.status === 'Accepted' && (
                <Button size="sm" variant="outline" onClick={handleConvertToInvoice} className="text-purple-700 border-purple-300 hover:bg-purple-50">
                  <Briefcase className="w-4 h-4 mr-1" /> Convert to Invoice
                </Button>
              )}
              {!showDeleteConfirm ? (
                <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(true)} className="text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="destructive" onClick={handleDelete}>
                    Confirm Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 md:grid-cols-6 mb-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="items">Line Items</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="terms">Terms</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            {renderDetailsTab()}
          </TabsContent>

          <TabsContent value="items">
            {renderLineItemsTab()}
          </TabsContent>

          <TabsContent value="pricing">
            {renderPricingTab()}
          </TabsContent>

          <TabsContent value="terms">
            {renderTermsTab()}
          </TabsContent>

          <TabsContent value="preview">
            {renderPreviewTab()}
          </TabsContent>

          <TabsContent value="activity">
            {renderActivityTab()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
