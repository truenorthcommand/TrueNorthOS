import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Sparkles, Package, Clock, TrendingUp, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LineItem {
  type: 'material' | 'labour' | 'custom';
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  markup: number;
  discount: number;
  vatRate: number;
}

interface AIPricingWizardProps {
  open: boolean;
  onClose: () => void;
  onImportItems: (items: LineItem[]) => void;
}

interface Measurements {
  length: string;
  width: string;
  height: string;
  area: string;
  numberOfAreas: string;
  notes: string;
}

interface AIResult {
  lineItems: LineItem[];
  summary: {
    materialsCost: number;
    labourCost: number;
    totalBeforeVat: number;
    estimatedDuration: string;
    confidence: 'high' | 'medium' | 'low';
  };
  assumptions: string[];
  recommendations: string[];
}

const TRADES = [
  'Plumbing',
  'Electrical',
  'Tiling',
  'Decorating',
  'Carpentry',
  'Roofing',
  'Gas',
  'Grounds Keeping',
  'General Maintenance',
  'Full Refurbishment',
  'Plastering',
  'Flooring',
  'Glazing',
  'Drainage',
  'Fencing',
  'Brickwork',
  'Insulation',
  'Damp Proofing',
  'Locksmith',
  'Other',
];

const QUALITY_LEVELS = [
  { value: 'budget', label: 'Budget', description: 'Cost-effective materials and standard finishes' },
  { value: 'mid-range', label: 'Mid-Range', description: 'Good quality materials and finishes' },
  { value: 'premium', label: 'Premium', description: 'High-end materials and superior finishes' },
];

const LOADING_MESSAGES = [
  'Analyzing job requirements...',
  'Calculating material quantities...',
  'Estimating costs...',
  'Preparing your quote...',
];

export function AIPricingWizard({ open, onClose, onImportItems }: AIPricingWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [trade, setTrade] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [materialPreferences, setMaterialPreferences] = useState('');
  const [qualityLevel, setQualityLevel] = useState('mid-range');
  const [urgency, setUrgency] = useState('standard');
  const [hasMeasurements, setHasMeasurements] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements>({
    length: '',
    width: '',
    height: '',
    area: '',
    numberOfAreas: '1',
    notes: '',
  });
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [result, setResult] = useState<AIResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Calculate area from length × width
  const calculatedArea = useCallback(() => {
    const l = parseFloat(measurements.length);
    const w = parseFloat(measurements.width);
    if (!isNaN(l) && !isNaN(w) && l > 0 && w > 0) {
      return (l * w).toFixed(2);
    }
    return '';
  }, [measurements.length, measurements.width]);

  const calculatedWallArea = useCallback(() => {
    const l = parseFloat(measurements.length);
    const w = parseFloat(measurements.width);
    const h = parseFloat(measurements.height);
    if (!isNaN(l) && !isNaN(w) && !isNaN(h) && l > 0 && w > 0 && h > 0) {
      return (2 * (l + w) * h).toFixed(2);
    }
    return '';
  }, [measurements.length, measurements.width, measurements.height]);

  // Loading message rotation
  useEffect(() => {
    if (currentStep !== 3) return;
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [currentStep]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setTrade('');
      setJobDescription('');
      setMaterialPreferences('');
      setQualityLevel('mid-range');
      setUrgency('standard');
      setHasMeasurements(false);
      setMeasurements({ length: '', width: '', height: '', area: '', numberOfAreas: '1', notes: '' });
      setResult(null);
      setSelectedItems(new Set());
      setError(null);
      setIsLoading(false);
      setShowAssumptions(false);
      setShowRecommendations(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setCurrentStep(3);
    setIsLoading(true);
    setError(null);
    setLoadingMessageIndex(0);

    try {
      const payload: Record<string, unknown> = {
        trade,
        jobDescription,
        materialPreferences,
        qualityLevel,
        urgency,
      };

      if (hasMeasurements) {
        const effectiveArea = measurements.area || calculatedArea();
        payload.measurements = {
          length: measurements.length ? parseFloat(measurements.length) : undefined,
          width: measurements.width ? parseFloat(measurements.width) : undefined,
          height: measurements.height ? parseFloat(measurements.height) : undefined,
          area: effectiveArea ? parseFloat(effectiveArea) : undefined,
          numberOfAreas: measurements.numberOfAreas ? parseInt(measurements.numberOfAreas) : 1,
          notes: measurements.notes || undefined,
        };
      }

      const response = await fetch('/api/ai/pricing-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(errData.message || `Server error (${response.status})`);
      }

      const data: AIResult = await response.json();
      setResult(data);
      setSelectedItems(new Set(data.lineItems.map((_, i) => i)));
      setCurrentStep(4);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setCurrentStep(4);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = () => {
    if (!result) return;
    const items = result.lineItems.filter((_, i) => selectedItems.has(i));
    if (items.length === 0) {
      toast({ title: 'No items selected', description: 'Please select at least one item to import.', variant: 'destructive' });
      return;
    }
    onImportItems(items);
    toast({ title: 'Items imported', description: `${items.length} line item${items.length > 1 ? 's' : ''} imported to your quote.` });
    onClose();
  };

  const handleRecalculate = () => {
    setResult(null);
    setError(null);
    setSelectedItems(new Set());
    setCurrentStep(1);
  };

  const toggleSelectAll = () => {
    if (!result) return;
    if (selectedItems.size === result.lineItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(result.lineItems.map((_, i) => i)));
    }
  };

  const toggleItem = (index: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const canProceedStep1 = trade && jobDescription.trim().length > 10;
  const canProceedStep2 = true; // measurements are optional

  // --- Render Functions ---

  function renderStepIndicator() {
    const steps = [
      { num: 1, label: 'Job Details' },
      { num: 2, label: 'Measurements' },
      { num: 3, label: 'Calculating' },
      { num: 4, label: 'Results' },
    ];

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((step, idx) => (
          <div key={step.num} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                currentStep === step.num
                  ? 'bg-[#E8A54B] text-white'
                  : currentStep > step.num
                  ? 'bg-[#0F2B4C] text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {currentStep > step.num ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                step.num
              )}
            </div>
            <span className={`ml-1 text-xs hidden sm:inline ${
              currentStep === step.num ? 'text-[#0F2B4C] font-medium' : 'text-gray-400'
            }`}>
              {step.label}
            </span>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-2 ${
                currentStep > step.num ? 'bg-[#0F2B4C]' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderStep1() {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="trade-select" className="font-medium">Trade *</Label>
          <Select value={trade} onValueChange={setTrade}>
            <SelectTrigger id="trade-select">
              <SelectValue placeholder="Select a trade..." />
            </SelectTrigger>
            <SelectContent>
              {TRADES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-desc" className="font-medium">Job Description *</Label>
          <Textarea
            id="job-desc"
            rows={4}
            placeholder="Describe the job in detail... e.g., 'Install new bathroom suite including bath, toilet, basin, and shower. Needs tiling on all walls and floor.'"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">Minimum 10 characters. The more detail, the better the estimate.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="material-prefs" className="font-medium">Material Preferences</Label>
          <Input
            id="material-prefs"
            placeholder="e.g., Porcelain tiles, chrome fittings, oak flooring"
            value={materialPreferences}
            onChange={(e) => setMaterialPreferences(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="font-medium">Quality Level</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {QUALITY_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setQualityLevel(level.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  qualityLevel === level.value
                    ? 'border-[#E8A54B] bg-[#E8A54B]/5 ring-1 ring-[#E8A54B]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-sm">{level.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{level.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-medium">Urgency</Label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setUrgency('standard')}
              className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                urgency === 'standard'
                  ? 'border-[#E8A54B] bg-[#E8A54B]/5 ring-1 ring-[#E8A54B]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">Standard</div>
              <div className="text-xs text-muted-foreground">Normal scheduling</div>
            </button>
            <button
              type="button"
              onClick={() => setUrgency('urgent')}
              className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                urgency === 'urgent'
                  ? 'border-[#E8A54B] bg-[#E8A54B]/5 ring-1 ring-[#E8A54B]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">Urgent</div>
              <div className="text-xs text-muted-foreground">+premium applied</div>
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => setCurrentStep(2)}
            disabled={!canProceedStep1}
            className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90"
          >
            Next: Measurements
          </Button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    const floorArea = calculatedArea();
    const wallArea = calculatedWallArea();

    return (
      <div className="space-y-5">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="has-measurements"
            checked={hasMeasurements}
            onCheckedChange={(checked) => setHasMeasurements(checked === true)}
          />
          <Label htmlFor="has-measurements" className="font-medium cursor-pointer">
            I have measurements
          </Label>
        </div>

        {hasMeasurements && (
          <div className="space-y-4 p-4 rounded-lg border bg-gray-50/50">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="m-length" className="text-sm">Length (m)</Label>
                <Input
                  id="m-length"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={measurements.length}
                  onChange={(e) => setMeasurements((m) => ({ ...m, length: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-width" className="text-sm">Width (m)</Label>
                <Input
                  id="m-width"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={measurements.width}
                  onChange={(e) => setMeasurements((m) => ({ ...m, width: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-height" className="text-sm">Height (m)</Label>
                <Input
                  id="m-height"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={measurements.height}
                  onChange={(e) => setMeasurements((m) => ({ ...m, height: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="m-area" className="text-sm">
                  Area (m²) {floorArea && <span className="text-muted-foreground">— auto: {floorArea}m²</span>}
                </Label>
                <Input
                  id="m-area"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={floorArea || '0.00'}
                  value={measurements.area}
                  onChange={(e) => setMeasurements((m) => ({ ...m, area: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-rooms" className="text-sm">Number of rooms/areas</Label>
                <Input
                  id="m-rooms"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="1"
                  value={measurements.numberOfAreas}
                  onChange={(e) => setMeasurements((m) => ({ ...m, numberOfAreas: e.target.value }))}
                />
              </div>
            </div>

            {(floorArea || wallArea) && (
              <div className="flex flex-wrap gap-3 p-3 rounded-md bg-white border">
                {floorArea && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Floor area:</span>{' '}
                    <span className="font-medium">{floorArea}m²</span>
                  </div>
                )}
                {wallArea && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Wall area:</span>{' '}
                    <span className="font-medium">{wallArea}m²</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="m-notes" className="text-sm">Notes about measurements</Label>
              <Textarea
                id="m-notes"
                rows={2}
                placeholder="e.g., L-shaped room, includes alcove, ceiling is sloped..."
                value={measurements.notes}
                onChange={(e) => setMeasurements((m) => ({ ...m, notes: e.target.value }))}
                className="resize-none"
              />
            </div>
          </div>
        )}

        {!hasMeasurements && (
          <div className="p-4 rounded-lg border border-dashed border-gray-300 text-center text-sm text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No measurements provided. The AI will estimate based on typical dimensions for this type of job.</p>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={() => setCurrentStep(1)}>
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canProceedStep2}
            className="bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Quote
          </Button>
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-[#E8A54B]/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#E8A54B] animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1">
            <Sparkles className="w-5 h-5 text-[#E8A54B] animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-semibold text-lg text-[#0F2B4C]">AI is working on your quote</h3>
          <p className="text-muted-foreground animate-pulse transition-all">
            {LOADING_MESSAGES[loadingMessageIndex]}
          </p>
        </div>
        <div className="flex gap-1">
          {LOADING_MESSAGES.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === loadingMessageIndex ? 'bg-[#E8A54B]' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderStep4Error() {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-semibold text-lg">Something went wrong</h3>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRecalculate}>
            Try Again
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  function renderStep4NoItems() {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
          <Package className="w-7 h-7 text-amber-500" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-semibold text-lg">No items could be calculated</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Try providing more detail about the job, specific materials needed, or measurements to get better results.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRecalculate}>
            Add More Detail
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  function renderConfidenceBadge(confidence: 'high' | 'medium' | 'low') {
    const config = {
      high: { color: 'bg-green-100 text-green-800', label: 'High Confidence' },
      medium: { color: 'bg-amber-100 text-amber-800', label: 'Medium Confidence' },
      low: { color: 'bg-red-100 text-red-800', label: 'Low Confidence' },
    };
    const c = config[confidence];
    return <Badge className={`${c.color} font-medium`}>{c.label}</Badge>;
  }

  function renderTypeBadge(type: 'material' | 'labour' | 'custom') {
    const config = {
      material: { color: 'bg-blue-100 text-blue-800', label: 'M' },
      labour: { color: 'bg-green-100 text-green-800', label: 'L' },
      custom: { color: 'bg-amber-100 text-amber-800', label: 'C' },
    };
    const c = config[type];
    return <Badge className={`${c.color} text-xs font-bold w-6 h-6 flex items-center justify-center p-0`}>{c.label}</Badge>;
  }

  function renderStep4Results() {
    if (!result) return null;

    const { summary, lineItems, assumptions, recommendations } = result;

    return (
      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        {/* Summary Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex items-center gap-1.5 text-xs text-blue-600 mb-1">
              <Package className="w-3.5 h-3.5" />
              Materials
            </div>
            <div className="font-bold text-lg text-blue-900">
              £{summary.materialsCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-green-50 border border-green-100">
            <div className="flex items-center gap-1.5 text-xs text-green-600 mb-1">
              <Clock className="w-3.5 h-3.5" />
              Labour
            </div>
            <div className="font-bold text-lg text-green-900">
              £{summary.labourCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0F2B4C]/5 border border-[#0F2B4C]/10">
            <div className="flex items-center gap-1.5 text-xs text-[#0F2B4C] mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Total (ex VAT)
            </div>
            <div className="font-bold text-lg text-[#0F2B4C]">
              £{summary.totalBeforeVat.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div className="text-xs text-muted-foreground mb-1">Duration</div>
            <div className="font-bold text-sm">{summary.estimatedDuration}</div>
            <div className="mt-1">{renderConfidenceBadge(summary.confidence)}</div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
            <h4 className="font-medium text-sm">Line Items ({lineItems.length})</h4>
            <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="text-xs h-7">
              {selectedItems.size === lineItems.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 sticky top-0">
                <tr className="border-b">
                  <th className="p-2 w-8"></th>
                  <th className="p-2 w-8">Type</th>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-left">Unit</th>
                  <th className="p-2 text-right">Unit Cost</th>
                  <th className="p-2 text-right">VAT</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => {
                  const lineTotal = item.quantity * item.unitCost;
                  return (
                    <tr key={idx} className={`border-b hover:bg-gray-50/50 ${!selectedItems.has(idx) ? 'opacity-50' : ''}`}>
                      <td className="p-2 text-center">
                        <Checkbox
                          checked={selectedItems.has(idx)}
                          onCheckedChange={() => toggleItem(idx)}
                        />
                      </td>
                      <td className="p-2 text-center">{renderTypeBadge(item.type)}</td>
                      <td className="p-2 text-left font-medium max-w-[200px] truncate" title={item.description}>
                        {item.description}
                      </td>
                      <td className="p-2 text-right tabular-nums">{item.quantity}</td>
                      <td className="p-2 text-left text-muted-foreground">{item.unit}</td>
                      <td className="p-2 text-right tabular-nums">£{item.unitCost.toFixed(2)}</td>
                      <td className="p-2 text-right text-muted-foreground">{item.vatRate}%</td>
                      <td className="p-2 text-right font-medium tabular-nums">£{lineTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Assumptions Collapsible */}
        {assumptions && assumptions.length > 0 && (
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setShowAssumptions(!showAssumptions)}
              className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Assumptions ({assumptions.length})
              </span>
              {showAssumptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showAssumptions && (
              <div className="px-3 pb-3 border-t">
                <ul className="mt-2 space-y-1">
                  {assumptions.map((a, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Recommendations Collapsible */}
        {recommendations && recommendations.length > 0 && (
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setShowRecommendations(!showRecommendations)}
              className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#E8A54B]" />
                Recommendations ({recommendations.length})
              </span>
              {showRecommendations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showRecommendations && (
              <div className="px-3 pb-3 border-t">
                <ul className="mt-2 space-y-1">
                  {recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-[#E8A54B] mt-1">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={handleRecalculate}>
            Recalculate
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedItems.size === 0}
            className="bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Import {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    );
  }

  function renderStep4() {
    if (error) return renderStep4Error();
    if (result && result.lineItems.length === 0) return renderStep4NoItems();
    return renderStep4Results();
  }

  function renderCurrentStep() {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0F2B4C]">
            <Sparkles className="w-5 h-5 text-[#E8A54B]" />
            AI Pricing Wizard
          </DialogTitle>
        </DialogHeader>
        {renderStepIndicator()}
        <div className="flex-1 overflow-y-auto">
          {renderCurrentStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
