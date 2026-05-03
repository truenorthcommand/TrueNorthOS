import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowRight, ArrowLeft, CheckCircle2, XCircle, Camera, AlertTriangle, Shield, Car, Upload, Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface CheckItem {
  id: string;
  label: string;
  category: string;
  passed: boolean | null;
}

interface Defect {
  checkId: string;
  description: string;
  photoUrl?: string;
  severity: 'minor' | 'major' | 'unsafe';
}

const INITIAL_CHECKS: CheckItem[] = [
  // Exterior
  { id: 'tyres', label: 'Tyres: Good condition, correct pressure', category: 'exterior', passed: null },
  { id: 'lights', label: 'Lights: All working (headlights, indicators, brake)', category: 'exterior', passed: null },
  { id: 'body', label: 'Body: No new damage', category: 'exterior', passed: null },
  { id: 'windscreen', label: 'Windscreen: Clean, no cracks', category: 'exterior', passed: null },
  { id: 'plates', label: 'Registration plates: Visible, clean', category: 'exterior', passed: null },
  { id: 'mirrors_ext', label: 'Mirrors: Clean, undamaged', category: 'exterior', passed: null },
  // Interior
  { id: 'mirrors_int', label: 'Mirrors: Adjusted correctly', category: 'interior', passed: null },
  { id: 'seatbelt', label: 'Seatbelt: Working properly', category: 'interior', passed: null },
  { id: 'dashboard', label: 'Dashboard: No warning lights', category: 'interior', passed: null },
  { id: 'horn', label: 'Horn: Working', category: 'interior', passed: null },
  { id: 'wipers', label: 'Wipers: Working, washer fluid', category: 'interior', passed: null },
  { id: 'handbrake', label: 'Handbrake: Working properly', category: 'interior', passed: null },
  // Under Bonnet
  { id: 'oil', label: 'Oil level: Checked and OK', category: 'bonnet', passed: null },
  { id: 'coolant', label: 'Coolant level: Checked and OK', category: 'bonnet', passed: null },
  { id: 'washer', label: 'Washer fluid: Topped up', category: 'bonnet', passed: null },
  { id: 'battery', label: 'Battery: Secure, no corrosion', category: 'bonnet', passed: null },
  { id: 'belts', label: 'Belts/hoses: No visible damage', category: 'bonnet', passed: null },
];

function renderStepIndicator(currentStep: number, totalSteps: number, hasDefects: boolean) {
  const steps = [];
  for (let i = 1; i <= totalSteps; i++) {
    const isActive = i === currentStep;
    const isCompleted = i < currentStep;
    // If step 4 is skipped (no defects) and we're past it, adjust display
    let stepLabel = i;
    if (!hasDefects && i >= 4) {
      stepLabel = i === 4 ? 5 : i;
    }
    steps.push(
      <div key={i} className="flex items-center">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
            isActive
              ? 'bg-[#E8A54B] text-white shadow-lg scale-110'
              : isCompleted
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 text-gray-500'
          }`}
        >
          {isCompleted ? '✓' : i}
        </div>
        {i < totalSteps && (
          <div
            className={`w-6 h-0.5 mx-1 ${
              isCompleted ? 'bg-green-500' : 'bg-gray-200'
            }`}
          />
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-0">
      {steps}
    </div>
  );
}

function renderCheckItem(
  item: CheckItem,
  onToggle: (id: string, passed: boolean) => void
) {
  return (
    <div
      key={item.id}
      className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white shadow-sm min-h-[56px]"
    >
      <span className="text-sm font-medium text-gray-800 flex-1 pr-3">{item.label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onToggle(item.id, true)}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            item.passed === true
              ? 'bg-green-500 text-white shadow-md scale-105'
              : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-500'
          }`}
          aria-label={`Mark ${item.label} as pass`}
        >
          <CheckCircle2 className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={() => onToggle(item.id, false)}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            item.passed === false
              ? 'bg-red-500 text-white shadow-md scale-105'
              : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500'
          }`}
          aria-label={`Mark ${item.label} as fail`}
        >
          <XCircle className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

function renderStep1(
  checkItems: CheckItem[],
  onToggle: (id: string, passed: boolean) => void
) {
  const exteriorItems = checkItems.filter((i) => i.category === 'exterior');
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Car className="w-5 h-5 text-[#0F2B4C]" />
        <h2 className="text-lg font-bold text-[#0F2B4C]">Exterior Check</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">Walk around the vehicle and check each item below.</p>
      <div className="space-y-2">
        {exteriorItems.map((item) => renderCheckItem(item, onToggle))}
      </div>
    </div>
  );
}

function renderStep2(
  checkItems: CheckItem[],
  onToggle: (id: string, passed: boolean) => void
) {
  const interiorItems = checkItems.filter((i) => i.category === 'interior');
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-[#0F2B4C]" />
        <h2 className="text-lg font-bold text-[#0F2B4C]">Interior Check</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">Sit in the vehicle and verify each item.</p>
      <div className="space-y-2">
        {interiorItems.map((item) => renderCheckItem(item, onToggle))}
      </div>
    </div>
  );
}

function renderStep3(
  checkItems: CheckItem[],
  onToggle: (id: string, passed: boolean) => void
) {
  const bonnetItems = checkItems.filter((i) => i.category === 'bonnet');
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-[#0F2B4C]" />
        <h2 className="text-lg font-bold text-[#0F2B4C]">Under Bonnet</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">Open the bonnet and check fluid levels and components.</p>
      <div className="space-y-2">
        {bonnetItems.map((item) => renderCheckItem(item, onToggle))}
      </div>
    </div>
  );
}

function renderStep4(
  failedItems: CheckItem[],
  defects: Defect[],
  onDefectChange: (checkId: string, field: keyof Defect, value: string) => void,
  onPhotoUpload: (checkId: string) => void
) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <h2 className="text-lg font-bold text-[#0F2B4C]">Report Defects</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        The following items failed. Please provide details for each defect.
      </p>
      <div className="space-y-4">
        {failedItems.map((item) => {
          const defect = defects.find((d) => d.checkId === item.id);
          return (
            <Card key={item.id} className="border-red-200 bg-red-50/30">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Description of defect</label>
                  <Textarea
                    placeholder="Describe the defect..."
                    value={defect?.description || ''}
                    onChange={(e) => onDefectChange(item.id, 'description', e.target.value)}
                    className="text-sm min-h-[80px]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Photo evidence</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onPhotoUpload(item.id)}
                    className="gap-2"
                  >
                    {defect?.photoUrl ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Photo attached
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        Take photo
                      </>
                    )}
                  </Button>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">Severity</label>
                  <div className="flex gap-2">
                    {(['minor', 'major', 'unsafe'] as const).map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => onDefectChange(item.id, 'severity', sev)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                          defect?.severity === sev
                            ? sev === 'minor'
                              ? 'bg-yellow-500 text-white shadow-md'
                              : sev === 'major'
                              ? 'bg-orange-500 text-white shadow-md'
                              : 'bg-red-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function renderStep5(
  checkItems: CheckItem[],
  defects: Defect[],
  vehicleSafe: boolean,
  onVehicleSafeChange: (val: boolean) => void,
  hasUnsafe: boolean
) {
  const passCount = checkItems.filter((i) => i.passed === true).length;
  const failCount = checkItems.filter((i) => i.passed === false).length;
  const totalCount = checkItems.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-[#0F2B4C]" />
        <h2 className="text-lg font-bold text-[#0F2B4C]">Sign-Off</h2>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-800">{totalCount}</div>
              <div className="text-xs text-gray-500">Total Checks</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{passCount}</div>
              <div className="text-xs text-gray-500">Passed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{failCount}</div>
              <div className="text-xs text-gray-500">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Defects summary */}
      {defects.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-orange-700">Defects Reported</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {defects.map((defect) => {
              const item = checkItems.find((i) => i.id === defect.checkId);
              return (
                <div key={defect.checkId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{item?.label || defect.checkId}</span>
                  <Badge
                    variant={defect.severity === 'unsafe' ? 'destructive' : defect.severity === 'major' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {defect.severity}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Unsafe warning */}
      {hasUnsafe && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">Vehicle cannot be used</p>
              <p className="text-sm text-red-600 mt-1">
                An unsafe defect has been reported. This vehicle is blocked from use today. Report to your manager immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Safe confirmation */}
      {!hasUnsafe && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <label htmlFor="vehicle-safe" className="text-sm font-medium text-gray-800 flex-1 pr-4">
                I confirm this vehicle is safe to drive today
              </label>
              <Switch
                id="vehicle-safe"
                checked={vehicleSafe}
                onCheckedChange={onVehicleSafeChange}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function WalkaroundWizard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [checkItems, setCheckItems] = useState<CheckItem[]>(INITIAL_CHECKS);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [vehicleSafe, setVehicleSafe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const failedItems = checkItems.filter((i) => i.passed === false);
  const hasDefects = failedItems.length > 0;
  const hasUnsafe = defects.some((d) => d.severity === 'unsafe');
  const totalSteps = hasDefects ? 5 : 4; // Step 4 (defects) skipped if no fails

  // Map visual step to logical step
  const getLogicalStep = useCallback(
    (step: number) => {
      if (!hasDefects && step >= 4) return 5; // Skip step 4
      return step;
    },
    [hasDefects]
  );

  const logicalStep = getLogicalStep(currentStep);

  const handleToggle = useCallback((id: string, passed: boolean) => {
    setCheckItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, passed: item.passed === passed ? null : passed } : item
      )
    );
  }, []);

  const handleDefectChange = useCallback(
    (checkId: string, field: keyof Defect, value: string) => {
      setDefects((prev) => {
        const existing = prev.find((d) => d.checkId === checkId);
        if (existing) {
          return prev.map((d) =>
            d.checkId === checkId ? { ...d, [field]: value } : d
          );
        }
        return [
          ...prev,
          { checkId, description: '', severity: 'minor' as const, [field]: value },
        ];
      });
    },
    []
  );

  const handlePhotoUpload = useCallback((checkId: string) => {
    // Create a file input for camera capture
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setDefects((prev) => {
          const existing = prev.find((d) => d.checkId === checkId);
          if (existing) {
            return prev.map((d) =>
              d.checkId === checkId ? { ...d, photoUrl: url } : d
            );
          }
          return [
            ...prev,
            { checkId, description: '', severity: 'minor' as const, photoUrl: url },
          ];
        });
        toast({
          title: 'Photo attached',
          description: 'Defect photo has been captured.',
        });
      }
    };
    input.click();
  }, [toast]);

  const handleComplete = async () => {
    if (!hasUnsafe && !vehicleSafe) {
      toast({
        title: 'Confirmation required',
        description: 'Please confirm the vehicle is safe to drive.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch {
      // Non-critical - GPS may not be available
    }

    try {
      await fetch('/api/gps/walkaround-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          checks: checkItems.reduce((acc, item) => ({ ...acc, [item.id]: item.passed }), {}),
          defects: defects,
          vehicleSafe: vehicleSafe,
          latitude,
          longitude,
        }),
      });

      toast({
        title: 'Walkaround complete',
        description: hasUnsafe
          ? 'Vehicle flagged as unsafe. Manager has been notified.'
          : 'Vehicle check recorded. Have a safe day!',
      });

      navigate('/my-day');
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: 'Could not save walkaround. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = useCallback(
    (step: number) => {
      const logical = getLogicalStep(step);
      if (logical === 1) {
        return checkItems.filter((i) => i.category === 'exterior').every((i) => i.passed !== null);
      }
      if (logical === 2) {
        return checkItems.filter((i) => i.category === 'interior').every((i) => i.passed !== null);
      }
      if (logical === 3) {
        return checkItems.filter((i) => i.category === 'bonnet').every((i) => i.passed !== null);
      }
      if (logical === 4) {
        // Defects step - ensure all defects have description and severity
        return failedItems.every((item) => {
          const defect = defects.find((d) => d.checkId === item.id);
          return defect && defect.description.trim().length > 0 && defect.severity;
        });
      }
      return true;
    },
    [checkItems, defects, failedItems, getLogicalStep]
  );

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    } else {
      // Exit to my-day with warning
      if (window.confirm('Are you sure you want to exit? Your progress will be lost.')) {
        navigate('/my-day');
      }
    }
  };

  // Initialize defects for failed items when entering step 4
  const ensureDefectsExist = useCallback(() => {
    setDefects((prev) => {
      const updated = [...prev];
      for (const item of failedItems) {
        if (!updated.find((d) => d.checkId === item.id)) {
          updated.push({ checkId: item.id, description: '', severity: 'minor' });
        }
      }
      return updated;
    });
  }, [failedItems]);

  // Ensure defects exist when we reach step 4
  if (logicalStep === 4 && failedItems.length > 0) {
    const missingDefects = failedItems.some((item) => !defects.find((d) => d.checkId === item.id));
    if (missingDefects) {
      ensureDefectsExist();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-[#0F2B4C]" />
              <h1 className="text-lg font-bold text-[#0F2B4C]">Morning Vehicle Check</h1>
            </div>
            <span className="text-xs text-gray-500 font-medium">
              {format(new Date(), 'EEE d MMM yyyy')}
            </span>
          </div>
          {renderStepIndicator(currentStep, totalSteps, hasDefects)}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-5">
        {logicalStep === 1 && renderStep1(checkItems, handleToggle)}
        {logicalStep === 2 && renderStep2(checkItems, handleToggle)}
        {logicalStep === 3 && renderStep3(checkItems, handleToggle)}
        {logicalStep === 4 && renderStep4(failedItems, defects, handleDefectChange, handlePhotoUpload)}
        {logicalStep === 5 && renderStep5(checkItems, defects, vehicleSafe, setVehicleSafe, hasUnsafe)}
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg p-4 safe-area-pb">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="flex-1 h-12 text-sm font-semibold gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 1 ? 'Exit' : 'Back'}
          </Button>

          {logicalStep === 5 ? (
            <Button
              type="button"
              onClick={handleComplete}
              disabled={submitting || (!hasUnsafe && !vehicleSafe)}
              className="flex-1 h-12 text-sm font-semibold gap-2 bg-[#0F2B4C] hover:bg-[#0F2B4C]/90 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Complete Walkaround
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed(currentStep)}
              className="flex-1 h-12 text-sm font-semibold gap-2 bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
