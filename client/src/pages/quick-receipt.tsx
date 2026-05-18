import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ReceiptPhotoCapture } from "@/components/receipt-photo-capture";
import {
  ArrowLeft, ArrowRight, Receipt, CheckCircle2, Loader2,
  AlertTriangle, Camera, FileText, Fuel, Sparkles, Package, MoreHorizontal,
} from "lucide-react";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────
type ReceiptCategory = "fuel" | "cleaning" | "office_supplies" | "consumables" | "other";
type SubmitResult = { status: "clean" | "flagged" | "pending"; id: string } | null;

const CATEGORIES: { value: ReceiptCategory; label: string; emoji: string; icon: React.ReactNode }[] = [
  { value: "fuel", label: "Fuel", emoji: "⛽", icon: <Fuel className="h-4 w-4" /> },
  { value: "cleaning", label: "Cleaning", emoji: "🧹", icon: <Sparkles className="h-4 w-4" /> },
  { value: "office_supplies", label: "Office Supplies", emoji: "📎", icon: <Package className="h-4 w-4" /> },
  { value: "consumables", label: "Consumables", emoji: "📦", icon: <Receipt className="h-4 w-4" /> },
  { value: "other", label: "Other", emoji: "📋", icon: <MoreHorizontal className="h-4 w-4" /> },
];

function getCategoryInfo(value: string) {
  return CATEGORIES.find((c) => c.value === value) || CATEGORIES[4];
}

// ── Step Indicator ───────────────────────────────────────────────────
function StepIndicator({ current, total = 3 }: { current: number; total?: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div
          key={step}
          className={`w-3 h-3 rounded-full transition-all duration-300 ${
            step === current
              ? "bg-[#E8A54B] scale-125 ring-2 ring-[#E8A54B]/30"
              : step < current
              ? "bg-[#0F2B4C]"
              : "bg-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────
export default function QuickReceipt() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Wizard state
  const [step, setStep] = useState(1);
  const [receiptPhoto, setReceiptPhoto] = useState("");
  const [category, setCategory] = useState<ReceiptCategory>("other");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptDate, setReceiptDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!receiptPhoto) {
      toast({ title: "Photo required", description: "Please capture a receipt photo first.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitResult(null);

    try {
      const res = await apiRequest("POST", "/api/receipts", {
        type: "general",
        category,
        description: description || null,
        notes: notes || null,
        date: receiptDate,
        receiptImageUrl: receiptPhoto,
      });

      const data = await res.json();
      setSubmitResult({
        status: data.status || "pending",
        id: data.id,
      });

      toast({
        title: "Receipt submitted!",
        description: data.status === "clean"
          ? "Your receipt passed AI verification."
          : data.status === "flagged"
          ? "Your receipt has been flagged for review."
          : "Your receipt is being processed.",
      });
    } catch (error: any) {
      setSubmitError(error.message || "Failed to submit receipt");
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 1: Photo ──────────────────────────────────────────────
  function renderStep1() {
    return (
      <div className="flex flex-col items-center gap-6 px-4">
        <div className="text-center">
          <Camera className="w-12 h-12 text-[#0F2B4C] mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-[#0F2B4C]">Capture Your Receipt</h2>
          <p className="text-sm text-gray-500 mt-1">Take a clear photo for AI verification</p>
        </div>

        <div className="w-full max-w-sm">
          <ReceiptPhotoCapture
            value={receiptPhoto}
            onChange={setReceiptPhoto}
            label=""
          />
        </div>

        <div className="w-full max-w-sm mt-4">
          <Button
            onClick={() => setStep(2)}
            disabled={!receiptPhoto}
            className="w-full h-12 bg-[#0F2B4C] hover:bg-[#1a3d63] text-white text-base"
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <p className="text-xs text-center text-gray-400 mt-2">
            {receiptPhoto ? "Photo captured ✓" : "Photo required to continue"}
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Details ────────────────────────────────────────────
  function renderStep2() {
    const canContinue = category && receiptDate;

    return (
      <div className="flex flex-col gap-5 px-4">
        <div className="text-center mb-2">
          <FileText className="w-10 h-10 text-[#0F2B4C] mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-[#0F2B4C]">Receipt Details</h2>
          <p className="text-sm text-gray-500">Categorize your receipt</p>
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-medium text-[#0F2B4C]">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ReceiptCategory)}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <span className="flex items-center gap-2">
                    <span>{c.emoji}</span>
                    <span>{c.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="description" className="text-sm font-medium text-[#0F2B4C]">Description</Label>
          <Input
            id="description"
            placeholder="e.g. Diesel for company van, cleaning supplies"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-12"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="notes" className="text-sm font-medium text-[#0F2B4C]">Notes (optional)</Label>
          <Textarea
            id="notes"
            rows={2}
            placeholder="Any additional details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="resize-none"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="date" className="text-sm font-medium text-[#0F2B4C]">Date</Label>
          <Input
            id="date"
            type="date"
            value={receiptDate}
            onChange={(e) => setReceiptDate(e.target.value)}
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

  // ── Step 3: Review & Submit ────────────────────────────────────
  function renderStep3() {
    const catInfo = getCategoryInfo(category);
    const formattedDate = receiptDate ? format(new Date(receiptDate), "dd MMM yyyy") : "";

    // If we have a result, show it
    if (submitResult) {
      return (
        <div className="flex flex-col items-center gap-6 px-4">
          {submitResult.status === "clean" ? (
            <>
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-green-700">Receipt Clean</h2>
                <p className="text-sm text-gray-500 mt-1">AI verification passed — no issues detected.</p>
              </div>
            </>
          ) : submitResult.status === "flagged" ? (
            <>
              <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-12 h-12 text-amber-500" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-amber-700">Receipt Flagged</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Some items have been flagged for review by an administrator.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-blue-700">Processing</h2>
                <p className="text-sm text-gray-500 mt-1">Your receipt is being scanned by AI. Check back shortly.</p>
              </div>
            </>
          )}

          <div className="w-full max-w-sm space-y-3 mt-4">
            <Button
              onClick={() => navigate("/receipts")}
              className="w-full h-12 bg-[#0F2B4C] hover:bg-[#1a3d63] text-white"
            >
              <Receipt className="w-4 h-4 mr-2" />
              View All Receipts
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                setReceiptPhoto("");
                setCategory("other");
                setDescription("");
                setNotes("");
                setReceiptDate(format(new Date(), "yyyy-MM-dd"));
                setSubmitResult(null);
                setSubmitError(null);
              }}
              className="w-full h-12 border-[#E8A54B] text-[#E8A54B] hover:bg-[#E8A54B]/5"
            >
              <Camera className="w-4 h-4 mr-2" />
              Submit Another Receipt
            </Button>
          </div>
        </div>
      );
    }

    // If submitting, show processing animation
    if (submitting) {
      return (
        <div className="flex flex-col items-center gap-6 px-4 py-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#0F2B4C]/5 flex items-center justify-center">
              <Loader2 className="w-14 h-14 text-[#E8A54B] animate-spin" />
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-[#E8A54B]/20 animate-pulse" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[#0F2B4C]">Scanning Receipt</h2>
            <p className="text-sm text-gray-500 mt-1">AI is verifying your receipt...</p>
            <p className="text-xs text-gray-400 mt-2">This usually takes a few seconds</p>
          </div>
        </div>
      );
    }

    // Review view
    return (
      <div className="flex flex-col gap-5 px-4">
        <div className="text-center mb-2">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-[#0F2B4C]">Confirm & Submit</h2>
          <p className="text-sm text-gray-500">Review your receipt details</p>
        </div>

        {/* Photo thumbnail */}
        {receiptPhoto && (
          <div className="flex justify-center">
            <img
              src={receiptPhoto}
              alt="Receipt"
              className="max-h-[120px] object-cover rounded-lg border-2 border-[#E8A54B]/30 shadow-sm"
            />
          </div>
        )}

        {/* Summary card */}
        <Card className="border-2 border-gray-100">
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Category</span>
              <Badge className="bg-[#0F2B4C]/10 text-[#0F2B4C] hover:bg-[#0F2B4C]/15">
                <span className="mr-1">{catInfo.emoji}</span>
                {catInfo.label}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Date</span>
              <span className="text-sm font-medium">{formattedDate}</span>
            </div>
            {description && (
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-500">Description</span>
                <span className="text-sm font-medium text-right max-w-[60%]">{description}</span>
              </div>
            )}
            {notes && (
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-500">Notes</span>
                <span className="text-sm text-gray-600 text-right max-w-[60%]">{notes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error display */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <p className="text-sm text-red-600">{submitError}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSubmitError(null)}
              className="mt-1 text-xs text-red-500"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 mt-4">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-14 bg-[#E8A54B] hover:bg-[#d4953f] text-white text-lg font-semibold rounded-xl shadow-lg"
          >
            <Receipt className="w-5 h-5 mr-2" />
            Submit Receipt
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

  // ── Layout ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/receipts")}
            className="text-[#0F2B4C]"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Receipts
          </Button>
          <h1 className="text-base font-semibold text-[#0F2B4C]">Quick Receipt</h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
        <div className="pb-3">
          <StepIndicator current={step} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto pt-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
}
