import { useState, useRef, useCallback, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, ArrowRight, Camera, Upload, Trash2, Plus, Clock, CheckCircle2, Loader2, X, Image, PenTool
} from 'lucide-react';
import { format } from 'date-fns';

interface PhotoItem {
  id: string;
  file: File;
  preview: string;
}

interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

const UNITS = ['each', 'metres', 'm²', 'litres', 'kg', 'packs', 'rolls'];

const QUICK_NOTES = [
  'Work completed as described',
  'Area cleaned and tidied',
  'Customer informed of completion',
  'Follow-up required',
];

function renderProgressIndicator(currentStep: number) {
  const steps = ['Photos', 'Notes', 'Materials', 'Time', 'Signature', 'Review'];
  return (
    <div className="flex items-center justify-between w-full px-2 py-3">
      {steps.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isComplete = stepNum < currentStep;
        return (
          <div key={label} className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[#E8A54B] text-white shadow-lg scale-110'
                  : isComplete
                  ? 'bg-[#0F2B4C] text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {isComplete ? '✓' : stepNum}
            </div>
            <span className={`text-[10px] mt-1 ${isActive ? 'text-[#E8A54B] font-semibold' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function renderStep1Photos(
  photos: PhotoItem[],
  onCapture: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onRemove: (id: string) => void,
  cameraInputRef: React.RefObject<HTMLInputElement>,
  galleryInputRef: React.RefObject<HTMLInputElement>
) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0F2B4C]">Take completion photos</h2>
      <p className="text-sm text-gray-500">Capture photos of the completed work</p>

      <div className="flex gap-3 justify-center">
        <Button
          onClick={() => cameraInputRef.current?.click()}
          className="h-14 px-6 bg-[#0F2B4C] hover:bg-[#1a3d66] text-white"
          size="lg"
        >
          <Camera className="w-5 h-5 mr-2" />
          Camera
        </Button>
        <Button
          onClick={() => galleryInputRef.current?.click()}
          variant="outline"
          className="h-14 px-6 border-[#0F2B4C] text-[#0F2B4C]"
          size="lg"
        >
          <Upload className="w-5 h-5 mr-2" />
          Gallery
        </Button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onCapture}
        multiple
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onCapture}
        multiple
      />

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border">
              <img src={photo.preview} alt="Completion" className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(photo.id)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={`text-sm text-center font-medium ${
        photos.length >= 1 ? 'text-green-600' : 'text-amber-600'
      }`}>
        {photos.length} photo{photos.length !== 1 ? 's' : ''} added
        {photos.length < 1 && ' (minimum 1 required)'}
      </div>
    </div>
  );
}

function renderStep2Notes(
  notes: string,
  setNotes: (v: string) => void,
  quickNotes: string[],
  toggleQuickNote: (note: string) => void
) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0F2B4C]">What work was completed?</h2>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Describe the work done, any issues encountered, and the current state..."
        rows={6}
        className="resize-none"
      />

      <div className="space-y-2">
        <Label className="text-sm text-gray-500">Quick add:</Label>
        {QUICK_NOTES.map((note) => (
          <div key={note} className="flex items-center space-x-2">
            <Checkbox
              id={`qn-${note}`}
              checked={quickNotes.includes(note)}
              onCheckedChange={() => toggleQuickNote(note)}
            />
            <label htmlFor={`qn-${note}`} className="text-sm cursor-pointer">
              {note}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderStep3Materials(
  materials: MaterialItem[],
  onAdd: () => void,
  onRemove: (id: string) => void,
  onUpdate: (id: string, field: keyof MaterialItem, value: string | number) => void
) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0F2B4C]">Record materials used</h2>
      <p className="text-sm text-gray-500">Add any materials used during the job (optional)</p>

      {materials.map((mat) => (
        <Card key={mat.id} className="relative">
          <CardContent className="p-3 space-y-2">
            <button
              onClick={() => onRemove(mat.id)}
              className="absolute top-2 right-2 w-6 h-6 text-red-500 hover:bg-red-50 rounded flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            <Input
              placeholder="Material name"
              value={mat.name}
              onChange={(e) => onUpdate(mat.id, 'name', e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Qty"
                value={mat.quantity || ''}
                onChange={(e) => onUpdate(mat.id, 'quantity', parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <Select
                value={mat.unit}
                onValueChange={(v) => onUpdate(mat.id, 'unit', v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        onClick={onAdd}
        variant="outline"
        className="w-full h-12 border-dashed border-[#0F2B4C] text-[#0F2B4C]"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Material
      </Button>
    </div>
  );
}

function renderStep4Time(
  startTime: string,
  setStartTime: (v: string) => void,
  endTime: string,
  setEndTime: (v: string) => void,
  travelMinutes: number,
  setTravelMinutes: (v: number) => void,
  breakMinutes: number,
  setBreakMinutes: (v: number) => void
) {
  const totalMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  const totalHours = Math.max(0, totalMs / (1000 * 60 * 60));
  const netHours = Math.max(0, totalHours - (travelMinutes + breakMinutes) / 60);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0F2B4C]">Confirm time spent</h2>

      <div className="space-y-3">
        <div>
          <Label className="text-sm">Start Time</Label>
          <Input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-12"
          />
        </div>
        <div>
          <Label className="text-sm">End Time</Label>
          <Input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="h-12"
          />
        </div>
      </div>

      <Card className="bg-gray-50">
        <CardContent className="p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total time:</span>
            <span className="font-semibold">{totalHours.toFixed(1)} hours</span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-600 w-32">Travel (mins):</Label>
            <Input
              type="number"
              value={travelMinutes || ''}
              onChange={(e) => setTravelMinutes(parseInt(e.target.value) || 0)}
              className="h-10 w-24"
              min={0}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-600 w-32">Break (mins):</Label>
            <Input
              type="number"
              value={breakMinutes || ''}
              onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
              className="h-10 w-24"
              min={0}
            />
          </div>
          <div className="flex justify-between text-sm pt-2 border-t">
            <span className="text-gray-600 font-medium">Net working hours:</span>
            <span className="font-bold text-[#0F2B4C]">{netHours.toFixed(1)} hours</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function renderStep5Signature(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  hasSigned: boolean,
  customerName: string,
  setCustomerName: (v: string) => void,
  onStartDrawing: (e: React.TouchEvent | React.MouseEvent) => void,
  onDraw: (e: React.TouchEvent | React.MouseEvent) => void,
  onStopDrawing: () => void,
  onClear: () => void
) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0F2B4C]">Get customer signature</h2>
      <p className="text-sm text-gray-500">Please ask the customer to sign below</p>

      <div>
        <Label className="text-sm">Customer Name</Label>
        <Input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Enter customer name"
          className="h-12"
        />
      </div>

      <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white relative">
        <canvas
          ref={canvasRef}
          width={360}
          height={200}
          className="w-full touch-none cursor-crosshair"
          style={{ height: '200px' }}
          onMouseDown={onStartDrawing}
          onMouseMove={onDraw}
          onMouseUp={onStopDrawing}
          onMouseLeave={onStopDrawing}
          onTouchStart={onStartDrawing}
          onTouchMove={onDraw}
          onTouchEnd={onStopDrawing}
        />
        {!hasSigned && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-300 text-lg">Sign here</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button onClick={onClear} variant="outline" size="sm">
          Clear Signature
        </Button>
        {hasSigned && (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Signature captured ✓
          </Badge>
        )}
      </div>
    </div>
  );
}

function renderStep6Review(
  photos: PhotoItem[],
  notes: string,
  quickNotes: string[],
  materials: MaterialItem[],
  startTime: string,
  endTime: string,
  hasSigned: boolean,
  customerName: string,
  submitting: boolean,
  onSubmit: () => void
) {
  const totalMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  const totalHours = Math.max(0, totalMs / (1000 * 60 * 60));
  const canSubmit = photos.length >= 1 && hasSigned;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0F2B4C]">Review & Submit</h2>

      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Photos */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">Photos</span>
            </div>
            <Badge variant={photos.length >= 1 ? 'default' : 'destructive'}>
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          {photos.length > 0 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {photos.slice(0, 6).map((p) => (
                <img
                  key={p.id}
                  src={p.preview}
                  alt=""
                  className="w-12 h-12 rounded object-cover flex-shrink-0"
                />
              ))}
              {photos.length > 6 && (
                <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                  +{photos.length - 6}
                </div>
              )}
            </div>
          )}

          <hr />

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PenTool className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">Notes</span>
            </div>
            <p className="text-xs text-gray-600 line-clamp-2">
              {notes || quickNotes.join('. ') || 'No notes added'}
            </p>
          </div>

          <hr />

          {/* Materials */}
          <div>
            <span className="text-sm font-medium">Materials</span>
            {materials.length === 0 ? (
              <p className="text-xs text-gray-500">None recorded</p>
            ) : (
              <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                {materials.map((m) => (
                  <li key={m.id}>{m.name} — {m.quantity} {m.unit}</li>
                ))}
              </ul>
            )}
          </div>

          <hr />

          {/* Time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">Time</span>
            </div>
            <span className="text-sm text-gray-600">
              {startTime ? format(new Date(startTime), 'HH:mm') : '--:--'} →{' '}
              {endTime ? format(new Date(endTime), 'HH:mm') : '--:--'}
              {' '}({totalHours.toFixed(1)}h)
            </span>
          </div>

          <hr />

          {/* Signature */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Signature</span>
            {hasSigned ? (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Captured{customerName ? ` — ${customerName}` : ''}
              </Badge>
            ) : (
              <Badge variant="destructive">
                <X className="w-3 h-3 mr-1" />
                Missing
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {!canSubmit && (
        <p className="text-xs text-red-500 text-center">
          {photos.length < 1 && 'At least 1 photo required. '}
          {!hasSigned && 'Customer signature required.'}
        </p>
      )}

      <Button
        onClick={onSubmit}
        disabled={!canSubmit || submitting}
        className="w-full h-14 text-lg font-semibold bg-[#0F2B4C] hover:bg-[#1a3d66] text-white"
        size="lg"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Submit & Complete Job
          </>
        )}
      </Button>
    </div>
  );
}

export default function JobCompleteWizard() {
  const [match, params] = useRoute('/jobs/:id/complete');
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Photos
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Notes
  const [notes, setNotes] = useState('');
  const [quickNotes, setQuickNotes] = useState<string[]>([]);

  // Step 3: Materials
  const [materials, setMaterials] = useState<MaterialItem[]>([]);

  // Step 4: Time
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [travelMinutes, setTravelMinutes] = useState(0);
  const [breakMinutes, setBreakMinutes] = useState(0);

  // Step 5: Signature
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [customerName, setCustomerName] = useState('');

  // Step 6: Submit
  const [submitting, setSubmitting] = useState(false);

  // Initialize time on mount
  useEffect(() => {
    const now = new Date();
    const localISO = format(now, "yyyy-MM-dd'T'HH:mm");
    setEndTime(localISO);
    // Default start to 1 hour ago
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    setStartTime(format(oneHourAgo, "yyyy-MM-dd'T'HH:mm"));
  }, []);

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [currentStep]);

  // Photo handlers
  const handlePhotoCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: PhotoItem[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    e.target.value = '';
  }, []);

  const handlePhotoRemove = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  // Quick notes toggle
  const toggleQuickNote = useCallback((note: string) => {
    setQuickNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note]
    );
  }, []);

  // Materials handlers
  const addMaterial = useCallback(() => {
    setMaterials((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: '', quantity: 0, unit: 'each' },
    ]);
  }, []);

  const removeMaterial = useCallback((id: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const updateMaterial = useCallback((id: string, field: keyof MaterialItem, value: string | number) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  }, []);

  // Signature handlers
  const startDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasSigned(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ('touches' in e)
      ? (e.touches[0].clientX - rect.left) * scaleX
      : ((e as React.MouseEvent).clientX - rect.left) * scaleX;
    const y = ('touches' in e)
      ? (e.touches[0].clientY - rect.top) * scaleY
      : ((e as React.MouseEvent).clientY - rect.top) * scaleY;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ('touches' in e)
      ? (e.touches[0].clientX - rect.left) * scaleX
      : ((e as React.MouseEvent).clientX - rect.left) * scaleX;
    const y = ('touches' in e)
      ? (e.touches[0].clientY - rect.top) * scaleY
      : ((e as React.MouseEvent).clientY - rect.top) * scaleY;
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  }, []);

  const getSignatureDataUrl = useCallback((): string | null => {
    if (!hasSigned || !canvasRef.current) return null;
    return canvasRef.current.toDataURL('image/png');
  }, [hasSigned]);

  // GPS logging
  const logGPS = useCallback(async (action: string) => {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      await fetch('/api/gps/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          jobId: params?.id,
          action,
        }),
      });
    } catch {
      // Non-critical - GPS may not be available
    }
  }, [params?.id]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      // Log GPS location
      await logGPS('job-complete');

      // Upload photos
      for (const photo of photos) {
        const formData = new FormData();
        formData.append('photo', photo.file);
        await fetch(`/api/jobs/${params?.id}/photos`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      }

      // Combine notes
      const fullNotes = [notes, ...quickNotes].filter(Boolean).join('\n');

      // Update job with completion data
      await fetch(`/api/jobs/${params?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'Signed Off',
          completedAt: new Date().toISOString(),
          completionNotes: fullNotes,
          signatureData: getSignatureDataUrl(),
          signerName: customerName,
          completionMaterials: materials.filter((m) => m.name.trim()),
          actualStartTime: startTime,
          actualEndTime: endTime,
          travelTime: travelMinutes,
          breakTime: breakMinutes,
        }),
      });

      toast({ title: 'Job Completed!', description: 'Job has been signed off successfully.' });
      navigate('/my-day');
    } catch (error: any) {
      toast({ title: 'Submission failed', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }, [photos, notes, quickNotes, materials, startTime, endTime, travelMinutes, breakMinutes, customerName, hasSigned, params?.id, navigate, toast, logGPS, getSignatureDataUrl]);

  // Navigation
  const goNext = () => setCurrentStep((s) => Math.min(6, s + 1));
  const goPrev = () => setCurrentStep((s) => Math.max(1, s - 1));

  const canAdvance = (): boolean => {
    if (currentStep === 1) return photos.length >= 1;
    if (currentStep === 5) return hasSigned;
    return true;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (currentStep > 1) {
                goPrev();
              } else {
                navigate(`/jobs/${params?.id}`);
              }
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {currentStep > 1 ? 'Back' : 'Cancel'}
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-bold text-[#0F2B4C]">Complete Job</h1>
            {params?.id && (
              <span className="text-xs text-gray-500">Job #{params.id}</span>
            )}
          </div>
          <div className="w-16" />
        </div>
        {renderProgressIndicator(currentStep)}
      </div>

      {/* Content */}
      <div className="px-4 py-4 max-w-lg mx-auto">
        {currentStep === 1 &&
          renderStep1Photos(photos, handlePhotoCapture, handlePhotoRemove, cameraInputRef, galleryInputRef)}
        {currentStep === 2 &&
          renderStep2Notes(notes, setNotes, quickNotes, toggleQuickNote)}
        {currentStep === 3 &&
          renderStep3Materials(materials, addMaterial, removeMaterial, updateMaterial)}
        {currentStep === 4 &&
          renderStep4Time(startTime, setStartTime, endTime, setEndTime, travelMinutes, setTravelMinutes, breakMinutes, setBreakMinutes)}
        {currentStep === 5 &&
          renderStep5Signature(canvasRef, hasSigned, customerName, setCustomerName, startDrawing, draw, stopDrawing, clearSignature)}
        {currentStep === 6 &&
          renderStep6Review(photos, notes, quickNotes, materials, startTime, endTime, hasSigned, customerName, submitting, handleSubmit)}
      </div>

      {/* Bottom Navigation */}
      {currentStep < 6 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 safe-area-pb">
          <div className="max-w-lg mx-auto flex gap-3">
            {currentStep > 1 && (
              <Button
                onClick={goPrev}
                variant="outline"
                className="flex-1 h-12"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
            )}
            <Button
              onClick={goNext}
              disabled={!canAdvance()}
              className={`flex-1 h-12 bg-[#E8A54B] hover:bg-[#d4943f] text-white font-semibold ${
                currentStep === 1 ? 'w-full' : ''
              }`}
            >
              {currentStep === 5 ? 'Review' : 'Next'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
