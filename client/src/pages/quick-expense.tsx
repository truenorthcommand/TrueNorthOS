import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, ArrowLeft, ArrowRight, Receipt, CheckCircle2, Loader2, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

function renderStepIndicator(currentStep: number) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3].map((step) => (
        <div
          key={step}
          className={`w-3 h-3 rounded-full transition-all ${
            step === currentStep
              ? 'bg-[#E8A54B] scale-125'
              : step < currentStep
              ? 'bg-[#0F2B4C]'
              : 'bg-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'Fuel': return 'bg-blue-100 text-blue-800';
    case 'Materials': return 'bg-green-100 text-green-800';
    case 'Parking': return 'bg-purple-100 text-purple-800';
    case 'Tools': return 'bg-amber-100 text-amber-800';
    case 'Other': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function renderStep1(
  receiptPhoto: File | null,
  receiptPreview: string | null,
  fileInputRef: React.RefObject<HTMLInputElement>,
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  removePhoto: () => void,
  setStep: (step: number) => void
) {
  return (
    <div className="flex flex-col items-center gap-6 px-4">
      <div className="text-center">
        <Receipt className="w-12 h-12 text-[#0F2B4C] mx-auto mb-2" />
        <h2 className="text-lg font-semibold text-[#0F2B4C]">Take a photo of your receipt</h2>
        <p className="text-sm text-gray-500 mt-1">Snap a clear photo for your records</p>
      </div>

      {receiptPreview ? (
        <div className="relative w-full max-w-sm">
          <img
            src={receiptPreview}
            alt="Receipt preview"
            className="w-full max-h-[200px] object-cover rounded-lg border-2 border-[#E8A54B]"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 rounded-full w-8 h-8"
            onClick={removePhoto}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="w-full max-w-sm space-y-4">
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-20 bg-[#E8A54B] hover:bg-[#d4953f] text-white text-lg font-semibold rounded-xl shadow-lg"
          >
            <Camera className="w-8 h-8 mr-3" />
            Take Photo
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute('capture');
                fileInputRef.current.click();
                fileInputRef.current.setAttribute('capture', 'environment');
              }
            }}
            className="w-full h-12 border-[#0F2B4C] text-[#0F2B4C]"
          >
            <Upload className="w-5 h-5 mr-2" />
            Or upload from gallery
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="w-full max-w-sm mt-4">
        <Button
          onClick={() => setStep(2)}
          disabled={!receiptPhoto}
          className="w-full h-12 bg-[#0F2B4C] hover:bg-[#1a3d63] text-white"
        >
          Continue
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <p className="text-xs text-center text-gray-400 mt-2">
          {receiptPhoto ? 'Photo captured ✓' : 'Photo required to continue'}
        </p>
      </div>
    </div>
  );
}

function renderStep2(
  amount: string,
  setAmount: (val: string) => void,
  date: string,
  setDate: (val: string) => void,
  category: string,
  setCategory: (val: string) => void,
  description: string,
  setDescription: (val: string) => void,
  jobReference: string,
  setJobReference: (val: string) => void,
  setStep: (step: number) => void
) {
  const canContinue = amount && parseFloat(amount) > 0 && date && category;

  return (
    <div className="flex flex-col gap-5 px-4">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold text-[#0F2B4C]">Expense Details</h2>
        <p className="text-sm text-gray-500">Fill in the details below</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="amount" className="text-sm font-medium text-[#0F2B4C]">Amount (£)</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="text-3xl font-bold text-center h-16 border-2 border-[#E8A54B] focus:ring-[#E8A54B]"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="date" className="text-sm font-medium text-[#0F2B4C]">Date</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-medium text-[#0F2B4C]">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Fuel">⛽ Fuel</SelectItem>
            <SelectItem value="Materials">🔩 Materials</SelectItem>
            <SelectItem value="Parking">🅿️ Parking</SelectItem>
            <SelectItem value="Tools">🔧 Tools</SelectItem>
            <SelectItem value="Other">📦 Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description" className="text-sm font-medium text-[#0F2B4C]">Description</Label>
        <Textarea
          id="description"
          rows={2}
          placeholder="e.g. Diesel for van, Screws and fixings for job"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="resize-none"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="jobReference" className="text-sm font-medium text-[#0F2B4C]">Job (optional)</Label>
        <Input
          id="jobReference"
          type="text"
          placeholder="Job reference e.g. JOB-1234"
          value={jobReference}
          onChange={(e) => setJobReference(e.target.value)}
          className="h-12"
        />
      </div>

      <div className="flex gap-3 mt-4">
        <Button
          variant="outline"
          onClick={() => setStep(1)}
          className="flex-1 h-12 border-[#0F2B4C] text-[#0F2B4C]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={() => setStep(3)}
          disabled={!canContinue}
          className="flex-1 h-12 bg-[#0F2B4C] hover:bg-[#1a3d63] text-white"
        >
          Review
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function renderStep3(
  receiptPreview: string | null,
  amount: string,
  date: string,
  category: string,
  description: string,
  jobReference: string,
  submitting: boolean,
  handleSubmit: () => void,
  setStep: (step: number) => void
) {
  const formattedDate = date ? format(new Date(date), 'dd MMM yyyy') : '';

  return (
    <div className="flex flex-col gap-5 px-4">
      <div className="text-center mb-2">
        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
        <h2 className="text-lg font-semibold text-[#0F2B4C]">Confirm & Submit</h2>
        <p className="text-sm text-gray-500">Review your expense details</p>
      </div>

      {receiptPreview && (
        <div className="flex justify-center">
          <img
            src={receiptPreview}
            alt="Receipt"
            className="max-h-[120px] object-cover rounded-lg border shadow-sm"
          />
        </div>
      )}

      <Card className="border-2 border-gray-100">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Amount</span>
            <span className="text-2xl font-bold text-[#0F2B4C]">£{parseFloat(amount || '0').toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Date</span>
            <span className="text-sm font-medium">{formattedDate}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Category</span>
            <Badge className={getCategoryColor(category)}>{category}</Badge>
          </div>
          {description && (
            <div className="flex justify-between items-start">
              <span className="text-sm text-gray-500">Description</span>
              <span className="text-sm font-medium text-right max-w-[60%]">{description}</span>
            </div>
          )}
          {jobReference && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Job</span>
              <span className="text-sm font-medium">{jobReference}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 mt-4">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-14 bg-[#E8A54B] hover:bg-[#d4953f] text-white text-lg font-semibold rounded-xl shadow-lg"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Submit Expense
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => setStep(2)}
          disabled={submitting}
          className="w-full h-12 border-[#0F2B4C] text-[#0F2B4C]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Edit
        </Button>
      </div>
    </div>
  );
}

export default function QuickExpense() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [jobReference, setJobReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removePhoto = () => {
    setReceiptPhoto(null);
    setReceiptPreview(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (receiptPhoto) {
        formData.append('receipt', receiptPhoto);
      }
      formData.append('amount', amount.toString());
      formData.append('date', date);
      formData.append('category', category);
      formData.append('description', description);
      if (jobReference) formData.append('jobReference', jobReference);

      const res = await fetch('/api/expenses', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to submit expense');

      toast({ title: 'Expense Submitted!', description: `£${parseFloat(amount).toFixed(2)} ${category} expense recorded.` });
      navigate('/my-day');
    } catch (error: any) {
      toast({ title: 'Submission failed', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/expenses')}
            className="text-[#0F2B4C]"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Expenses
          </Button>
          <h1 className="text-base font-semibold text-[#0F2B4C]">Submit Expense</h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
        <div className="pb-3">
          {renderStepIndicator(step)}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto pt-6">
        {step === 1 && renderStep1(
          receiptPhoto,
          receiptPreview,
          fileInputRef,
          handleFileChange,
          removePhoto,
          setStep
        )}
        {step === 2 && renderStep2(
          amount,
          setAmount,
          date,
          setDate,
          category,
          setCategory,
          description,
          setDescription,
          jobReference,
          setJobReference,
          setStep
        )}
        {step === 3 && renderStep3(
          receiptPreview,
          amount,
          date,
          category,
          description,
          jobReference,
          submitting,
          handleSubmit,
          setStep
        )}
      </div>
    </div>
  );
}
