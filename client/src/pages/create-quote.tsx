import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileText,
  Users,
  Package,
  PoundSterling,
  ClipboardCheck,
  Send,
  Save,
  Download,
  BookTemplate,
  Search,
  Building2,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

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

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

type Property = {
  id: string;
  address: string;
  postcode: string;
};

type QuoteTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  lineItems: QuoteLineItem[];
  terms: string;
  paymentTerms: string;
  notes: string;
};

const UNITS = ['each', 'm²', 'm', 'hours', 'days', 'litres', 'kg', 'metres', 'rolls', 'packs'];
const VAT_RATES = [{ label: '20%', value: 20 }, { label: '5%', value: 5 }, { label: '0%', value: 0 }];
const PAYMENT_TERMS = ['Net 7', 'Net 14', 'Net 30', 'Net 60', 'Due on Receipt', 'Custom'];
const TEMPLATE_CATEGORIES = ['Plumbing', 'Electrical', 'Carpentry', 'Painting & Decorating', 'Roofing', 'General Maintenance', 'Landscaping', 'Flooring', 'Tiling', 'Other'];

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

const STEPS = [
  { label: 'Client & Property', icon: Users },
  { label: 'Line Items', icon: Package },
  { label: 'Pricing Summary', icon: PoundSterling },
  { label: 'Terms & Conditions', icon: ClipboardCheck },
  { label: 'Review & Actions', icon: FileText },
  { label: 'Save Template', icon: BookTemplate },
];

function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateQuoteRef(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `QUO-${num}`;
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

function getDefaultExpiry(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split('T')[0];
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

export default function CreateQuote() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  // Step 1: Client & Property
  const [useExistingClient, setUseExistingClient] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [sitePostcode, setSitePostcode] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);

  // Step 2: Line Items
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([createEmptyLineItem()]);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Step 3: Pricing
  const [globalMarkup, setGlobalMarkup] = useState(0);
  const [overallDiscount, setOverallDiscount] = useState(0);

  // Step 4: Terms
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [customPaymentTerms, setCustomPaymentTerms] = useState('');
  const [expiryDate, setExpiryDate] = useState(getDefaultExpiry());
  const [termsText, setTermsText] = useState(DEFAULT_TERMS);
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');

  // Step 6: Template
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // Quote reference
  const [quoteRef] = useState(generateQuoteRef());

  // Fetch clients on search
  useEffect(() => {
    if (!useExistingClient) return;
    const timer = setTimeout(async () => {
      if (clientSearch.length >= 1) {
        setLoadingClients(true);
        try {
          const response = await fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}`);
          if (response.ok) {
            const data = await response.json();
            setClients(Array.isArray(data) ? data : (data.clients || []));
          }
        } catch (err) {
          console.error('Failed to fetch clients:', err);
        } finally {
          setLoadingClients(false);
        }
      } else {
        setClients([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, useExistingClient]);

  // Fetch properties when client selected
  useEffect(() => {
    if (!selectedClient) {
      setProperties([]);
      return;
    }
    (async () => {
      try {
        const response = await fetch(`/api/clients/${selectedClient.id}/properties`);
        if (response.ok) {
          const data = await response.json();
          setProperties(Array.isArray(data) ? data : (data.properties || []));
        }
      } catch (err) {
        console.error('Failed to fetch properties:', err);
      }
    })();
  }, [selectedClient]);

  // Fetch templates
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/quote-templates');
        if (response.ok) {
          const data = await response.json();
          setTemplates(Array.isArray(data) ? data : (data.templates || []));
        }
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      }
    })();
  }, []);

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

    // VAT breakdown by rate
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

  // Handlers
  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setCustomerName(client.name);
    setCustomerEmail(client.email || '');
    setCustomerPhone(client.phone || '');
    setClientSearch(client.name);
    setShowClientDropdown(false);
  };

  const handlePropertySelect = (propertyId: string) => {
    const prop = properties.find(p => p.id === propertyId);
    if (prop) {
      setSelectedProperty(prop);
      setSiteAddress(prop.address || '');
      setSitePostcode(prop.postcode || '');
    }
  };

  const updateLineItem = useCallback((id: string, updates: Partial<QuoteLineItem>) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };
      updated.amount = calculateLineAmount(updated);
      return updated;
    }));
  }, []);

  const addLineItem = () => {
    setLineItems(prev => [...prev, createEmptyLineItem()]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
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

  const loadTemplate = (template: QuoteTemplate) => {
    const newItems = template.lineItems.map(item => ({
      ...item,
      id: generateId(),
      amount: calculateLineAmount(item),
    }));
    setLineItems(newItems);
    if (template.terms) setTermsText(template.terms);
    if (template.paymentTerms) setPaymentTerms(template.paymentTerms);
    if (template.notes) setNotes(template.notes);
    setShowTemplateModal(false);
    toast({ title: 'Template Loaded', description: `"${template.name}" applied to quote.` });
  };

  const handleSave = async (status: 'Draft' | 'Sent') => {
    setSaving(true);
    try {
      const body = {
        customerId: selectedClient?.id || '',
        customerName,
        customerEmail,
        customerPhone,
        siteAddress,
        sitePostcode,
        reference,
        expiryDate: new Date(expiryDate).toISOString(),
        description: `Quote ${quoteRef}`,
        lineItems,
        subtotal: calculations.subtotal,
        discountTotal: calculations.discountAmount,
        vatRate: 20,
        vatAmount: calculations.totalVat,
        total: calculations.grandTotal,
        terms: termsText,
        notes,
        paymentTerms,
        customPaymentTerms: paymentTerms === 'Custom' ? customPaymentTerms : '',
        markupPercentage: globalMarkup,
        status,
      };

      const response = await apiRequest('POST', '/api/quotes', body);
      const data = await response.json();
      setSavedQuoteId(data.id || data.quoteId || 'saved');
      toast({
        title: status === 'Draft' ? 'Quote Saved as Draft' : 'Quote Sent',
        description: `Quote ${quoteRef} has been ${status === 'Draft' ? 'saved' : 'sent to client'}.`,
      });
      return data;
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save quote', variant: 'destructive' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPdf = async () => {
    const data = await handleSave('Draft');
    if (data?.id) {
      try {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Header
        doc.setFontSize(20);
        doc.setTextColor(15, 43, 76); // #0F2B4C
        doc.text('QUOTATION', pageWidth / 2, 20, { align: 'center' });
        
        // Company info
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Adapt Services Group', 14, 35);
        
        // Quote details
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(`Quote Ref: ${quoteRef}`, pageWidth - 14, 35, { align: 'right' });
        doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - 14, 41, { align: 'right' });
        if (expiryDate) {
          doc.text(`Expires: ${new Date(expiryDate).toLocaleDateString('en-GB')}`, pageWidth - 14, 47, { align: 'right' });
        }
        
        // Client info
        doc.setFontSize(11);
        doc.setTextColor(15, 43, 76);
        doc.text('Client:', 14, 55);
        doc.setTextColor(0);
        doc.setFontSize(10);
        doc.text(customerName || 'N/A', 14, 62);
        if (siteAddress) doc.text(siteAddress, 14, 68);
        if (sitePostcode) doc.text(sitePostcode, 14, 74);
        
        // Line items table header
        let y = 88;
        doc.setFillColor(15, 43, 76);
        doc.rect(14, y - 5, pageWidth - 28, 8, 'F');
        doc.setTextColor(255);
        doc.setFontSize(9);
        doc.text('Description', 16, y);
        doc.text('Qty', 110, y);
        doc.text('Unit Cost', 130, y);
        doc.text('VAT', 155, y);
        doc.text('Amount', pageWidth - 16, y, { align: 'right' });
        
        // Line items
        y += 10;
        doc.setTextColor(0);
        lineItems.forEach((item) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(item.description || 'Item', 16, y);
          doc.text(String(item.quantity), 110, y);
          doc.text(`£${item.unitCost.toFixed(2)}`, 130, y);
          doc.text(`${item.vatRate}%`, 155, y);
          doc.text(`£${item.amount.toFixed(2)}`, pageWidth - 16, y, { align: 'right' });
          y += 7;
        });
        
        // Totals
        y += 10;
        doc.setDrawColor(200);
        doc.line(120, y - 5, pageWidth - 14, y - 5);
        doc.setFontSize(10);
        doc.text('Subtotal:', 130, y);
        doc.text(`£${calculations.subtotal.toFixed(2)}`, pageWidth - 16, y, { align: 'right' });
        y += 7;
        doc.text('VAT:', 130, y);
        doc.text(`£${calculations.totalVat.toFixed(2)}`, pageWidth - 16, y, { align: 'right' });
        y += 7;
        doc.setFontSize(12);
        doc.setTextColor(15, 43, 76);
        doc.text('TOTAL:', 130, y);
        doc.text(`£${calculations.grandTotal.toFixed(2)}`, pageWidth - 16, y, { align: 'right' });
        
        // Payment terms
        y += 15;
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Payment Terms: ${paymentTerms}`, 14, y);
        
        // Save PDF
        doc.save(`${quoteRef}.pdf`);
        toast({ title: 'PDF Generated', description: 'Your quote PDF has been downloaded.' });
      } catch (err) {
        console.error('PDF generation error:', err);
        toast({ title: 'Quote Saved', description: 'Quote saved successfully. PDF generation encountered an issue.', variant: 'default' });
      }
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast({ title: 'Error', description: 'Please enter a template name', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiRequest('POST', '/api/quote-templates', {
        name: templateName,
        description: templateDescription,
        category: templateCategory,
        lineItems,
        terms: termsText,
        paymentTerms,
        notes,
      });
      toast({ title: 'Template Saved', description: `"${templateName}" saved for future use.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save template', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!(customerName.trim() && siteAddress.trim());
      case 1:
        return lineItems.length > 0 && lineItems.some(i => i.description.trim() && i.quantity > 0);
      case 2:
        return true;
      case 3:
        return !!(paymentTerms && expiryDate);
      case 4:
        return true;
      case 5:
        return true;
      default:
        return true;
    }
  };

  // Render functions (NOT components - avoids React unmounting)
  const renderProgressBar = () => (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          return (
            <div key={idx} className="flex flex-col items-center flex-1">
              <div className="flex items-center w-full">
                {idx > 0 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      isCompleted ? 'bg-[#E8A54B]' : 'bg-gray-200'
                    }`}
                  />
                )}
                <button
                  onClick={() => idx <= currentStep && setCurrentStep(idx)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-[#0F2B4C] text-white shadow-lg scale-110'
                      : isCompleted
                      ? 'bg-[#E8A54B] text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </button>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      isCompleted ? 'bg-[#E8A54B]' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-xs mt-2 text-center hidden sm:block ${
                  isActive ? 'text-[#0F2B4C] font-semibold' : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#E8A54B]" />
          Client & Property Selection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle existing/new */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <Label htmlFor="existing-toggle" className="text-sm">
            Use existing client
          </Label>
          <Switch
            id="existing-toggle"
            checked={useExistingClient}
            onCheckedChange={(val) => {
              setUseExistingClient(val);
              if (!val) {
                setSelectedClient(null);
                setSelectedProperty(null);
              }
            }}
          />
        </div>

        {useExistingClient ? (
          <div className="space-y-4">
            {/* Client search */}
            <div className="relative">
              <Label>Search Client</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Type to search clients..."
                  className="pl-10"
                />
              </div>
              {showClientDropdown && (clientSearch.length >= 1) && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {loadingClients ? (
                    <div className="p-3 text-center text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Searching...
                    </div>
                  ) : clients.length > 0 ? (
                    clients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => handleClientSelect(client)}
                        className="w-full text-left px-4 py-2 hover:bg-[#0F2B4C]/5 transition-colors border-b last:border-b-0"
                      >
                        <div className="font-medium text-sm">{client.name}</div>
                        <div className="text-xs text-gray-500">{client.email} • {client.phone}</div>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-gray-500 text-sm">No clients found</div>
                  )}
                </div>
              )}
            </div>

            {/* Property selection */}
            {selectedClient && properties.length > 0 && (
              <div>
                <Label>Select Property</Label>
                <Select onValueChange={handlePropertySelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(prop => (
                      <SelectItem key={prop.id} value={prop.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {prop.address}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : null}

        {/* Manual entry / filled fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Customer Name *</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Full name or company"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="07XXX XXXXXX"
            />
          </div>
          <div>
            <Label>Reference (Optional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="PO number or job ref"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Site Address *</Label>
            <Input
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="Full site address"
            />
          </div>
          <div>
            <Label>Site Postcode</Label>
            <Input
              value={sitePostcode}
              onChange={(e) => setSitePostcode(e.target.value)}
              placeholder="AB1 2CD"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#E8A54B]" />
            Line Items
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateModal(true)}
            className="text-[#0F2B4C]"
          >
            <BookTemplate className="w-4 h-4 mr-1" />
            Load Template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-y-auto">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-lg">Load from Template</h3>
              </div>
              <div className="p-4 space-y-2">
                {templates.length > 0 ? templates.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => loadTemplate(tmpl)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-[#0F2B4C]/5 transition-colors"
                  >
                    <div className="font-medium">{tmpl.name}</div>
                    <div className="text-xs text-gray-500">{tmpl.category} • {tmpl.lineItems?.length || 0} items</div>
                    {tmpl.description && <div className="text-xs text-gray-400 mt-1">{tmpl.description}</div>}
                  </button>
                )) : (
                  <p className="text-gray-500 text-center py-4">No templates available yet.</p>
                )}
              </div>
              <div className="p-4 border-t">
                <Button variant="outline" onClick={() => setShowTemplateModal(false)} className="w-full">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Line items list */}
        <div className="space-y-3">
          {lineItems.map((item, index) => (
            <div
              key={item.id}
              className={`border rounded-lg p-4 ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400">#{index + 1}</span>
                  {/* Type selector */}
                  <div className="flex gap-1">
                    {(['material', 'labour', 'custom'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => updateLineItem(item.id, { type })}
                        className={`px-2 py-1 text-xs rounded capitalize transition-colors ${
                          item.type === type
                            ? 'bg-[#0F2B4C] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveLineItem(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveLineItem(index, 'down')}
                    disabled={index === lineItems.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeLineItem(item.id)}
                    className="p-1 text-red-400 hover:text-red-600 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2 lg:col-span-4">
                  <Input
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                    placeholder="Item description"
                    className="font-medium"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Quantity</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.quantity || ''}
                    onChange={(e) => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Unit</Label>
                  <Select
                    value={item.unit}
                    onValueChange={(val) => updateLineItem(item.id, { unit: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Unit Cost (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitCost || ''}
                    onChange={(e) => updateLineItem(item.id, { unitCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">VAT Rate</Label>
                  <Select
                    value={String(item.vatRate)}
                    onValueChange={(val) => updateLineItem(item.id, { vatRate: parseInt(val) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_RATES.map(v => (
                        <SelectItem key={v.value} value={String(v.value)}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Markup %</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={item.markup || ''}
                    onChange={(e) => updateLineItem(item.id, { markup: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Discount %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={item.discount || ''}
                    onChange={(e) => updateLineItem(item.id, { discount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-end">
                  <div className="w-full">
                    <Label className="text-xs text-gray-500">Line Total</Label>
                    <div className="h-10 flex items-center px-3 bg-[#0F2B4C]/5 rounded-md font-semibold text-[#0F2B4C]">
                      {formatCurrency(item.amount)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Line Item */}
        <Button onClick={addLineItem} variant="outline" className="w-full border-dashed border-2">
          <Plus className="w-4 h-4 mr-2" />
          Add Line Item
        </Button>

        {/* Running Totals */}
        <div className="mt-6 p-4 bg-[#0F2B4C]/5 rounded-lg">
          <div className="flex justify-between items-center text-sm">
            <span>Subtotal ({lineItems.length} items)</span>
            <span className="font-semibold">{formatCurrency(calculations.subtotal)}</span>
          </div>
          {Object.entries(calculations.vatBreakdown).map(([rate, data]) => (
            <div key={rate} className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-600">VAT @ {rate}% ({data.items} items)</span>
              <span>{formatCurrency(data.amount)}</span>
            </div>
          ))}
          <div className="border-t mt-2 pt-2 flex justify-between items-center">
            <span className="font-bold text-[#0F2B4C]">Total</span>
            <span className="font-bold text-lg text-[#0F2B4C]">
              {formatCurrency(calculations.subtotal + calculations.totalVat)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PoundSterling className="w-5 h-5 text-[#E8A54B]" />
          Pricing Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <div className="text-xs text-blue-600 uppercase font-semibold mb-1">Materials</div>
            <div className="text-xl font-bold text-blue-800">{formatCurrency(calculations.materialsSubtotal)}</div>
            <div className="text-xs text-blue-500">{lineItems.filter(i => i.type === 'material').length} items</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <div className="text-xs text-green-600 uppercase font-semibold mb-1">Labour</div>
            <div className="text-xl font-bold text-green-800">{formatCurrency(calculations.labourSubtotal)}</div>
            <div className="text-xs text-green-500">{lineItems.filter(i => i.type === 'labour').length} items</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg text-center">
            <div className="text-xs text-purple-600 uppercase font-semibold mb-1">Custom</div>
            <div className="text-xl font-bold text-purple-800">{formatCurrency(calculations.customSubtotal)}</div>
            <div className="text-xs text-purple-500">{lineItems.filter(i => i.type === 'custom').length} items</div>
          </div>
        </div>

        {/* Global adjustments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Global Markup % (applies to all items)</Label>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={globalMarkup || ''}
              onChange={(e) => setGlobalMarkup(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>Overall Quote Discount %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={overallDiscount || ''}
              onChange={(e) => setOverallDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Full breakdown */}
        <div className="border rounded-lg overflow-hidden">
          <div className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(calculations.subtotal)}</span>
            </div>
            {globalMarkup > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Global Markup (+{globalMarkup}%)</span>
                <span>+{formatCurrency(calculations.afterGlobalMarkup - calculations.subtotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Total before VAT</span>
              <span className="font-medium">{formatCurrency(calculations.afterGlobalMarkup)}</span>
            </div>
            {overallDiscount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Discount (-{overallDiscount}%)</span>
                <span>-{formatCurrency(calculations.discountAmount)}</span>
              </div>
            )}
            <div className="border-t pt-2 space-y-1">
              <div className="text-xs font-semibold text-gray-500 uppercase">VAT Breakdown</div>
              {Object.entries(calculations.vatBreakdown).map(([rate, data]) => (
                <div key={rate} className="flex justify-between text-sm">
                  <span>VAT @ {rate}% ({data.items} items)</span>
                  <span>{formatCurrency(data.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium">
                <span>Total VAT</span>
                <span>{formatCurrency(calculations.totalVat)}</span>
              </div>
            </div>
          </div>
          <div className="p-4 bg-[#0F2B4C] text-white flex justify-between items-center">
            <span className="text-lg font-bold">Grand Total</span>
            <span className="text-2xl font-bold">{formatCurrency(calculations.grandTotal)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-[#E8A54B]" />
          Terms & Conditions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Payment Terms</Label>
            <Select value={paymentTerms} onValueChange={setPaymentTerms}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map(term => (
                  <SelectItem key={term} value={term}>{term}</SelectItem>
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
          <div>
            <Label>Quote Expiry Date</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Reference (Optional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Job/PO reference"
            />
          </div>
        </div>

        <div>
          <Label>Terms & Conditions</Label>
          <Textarea
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            rows={12}
            className="font-mono text-xs"
          />
        </div>

        <div>
          <Label>Notes (Optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Additional notes for client or internal reference..."
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      {/* Quote Preview */}
      <Card className="border-2 border-[#0F2B4C]/20">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6 pb-4 border-b">
            <div>
              <h2 className="text-2xl font-bold text-[#0F2B4C]">Adapt Services Group</h2>
              <p className="text-sm text-gray-500 mt-1">Professional Services Quotation</p>
            </div>
            <div className="text-right">
              <Badge className="bg-[#0F2B4C] text-white text-sm px-3 py-1">{quoteRef}</Badge>
              <p className="text-xs text-gray-500 mt-2">Date: {new Date().toLocaleDateString('en-GB')}</p>
              <p className="text-xs text-gray-500">Expires: {new Date(expiryDate).toLocaleDateString('en-GB')}</p>
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

          {/* Payment Terms & T&Cs */}
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

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button
          onClick={() => handleSave('Draft')}
          disabled={saving}
          variant="outline"
          className="h-14"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save as Draft
        </Button>
        <Button
          onClick={handleSaveAndPdf}
          disabled={saving}
          className="h-14 bg-[#0F2B4C] hover:bg-[#0F2B4C]/90"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Save & Generate PDF
        </Button>
        <Button
          onClick={() => handleSave('Sent')}
          disabled={saving}
          className="h-14 bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Save & Send to Client
        </Button>
      </div>

      {savedQuoteId && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800">Quote saved successfully!</p>
            <p className="text-sm text-green-600">You can now save it as a reusable template in the next step.</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep6 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookTemplate className="w-5 h-5 text-[#E8A54B]" />
          Save as Template (Optional)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-gray-600">
          Save this quote's line items as a reusable template for future quotes.
        </p>

        <div className="space-y-4">
          <div>
            <Label>Template Name *</Label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Standard Bathroom Refit"
            />
          </div>

          <div>
            <Label>Category</Label>
            <Select value={templateCategory} onValueChange={setTemplateCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a trade category" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <Textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of when to use this template..."
            />
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 font-medium mb-2">Template will include:</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• {lineItems.length} line item(s)</li>
              <li>• Payment terms: {paymentTerms}</li>
              <li>• Terms & conditions</li>
              {notes && <li>• Notes</li>}
            </ul>
          </div>

          <Button
            onClick={handleSaveTemplate}
            disabled={saving || !templateName.trim()}
            className="w-full bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Template
          </Button>
        </div>

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => navigate('/quotes')}
            className="w-full"
          >
            Finish & Go to Quotes
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderStep1();
      case 1: return renderStep2();
      case 2: return renderStep3();
      case 3: return renderStep4();
      case 4: return renderStep5();
      case 5: return renderStep6();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4">
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
                <h1 className="text-lg font-bold text-[#0F2B4C]">Create Quote</h1>
                <p className="text-xs text-gray-500">{quoteRef} • Step {currentStep + 1} of {STEPS.length}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[#E8A54B] border-[#E8A54B]">
              {STEPS[currentStep].label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {renderProgressBar()}
        {renderCurrentStep()}
      </div>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {currentStep === STEPS.length - 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep(STEPS.length - 1)}
                className="text-gray-500"
              >
                Skip to Template
              </Button>
            )}
            {currentStep < STEPS.length - 1 && (
              <Button
                onClick={() => setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1))}
                disabled={!canProceed(currentStep)}
                className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90"
              >
                {currentStep === 4 ? 'Save as Template' : 'Next'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
