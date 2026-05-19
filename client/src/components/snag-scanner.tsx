import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  RefreshCw,
  Eye,
  Send,
  Unlock,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────

interface SnagItem {
  id: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  trade_category: string;
  status: string;
  image_url: string | null;
}

interface ScanResult {
  id: string;
  ragStatus: "Green" | "Amber" | "Red";
  signoffLocked: boolean;
  imageCount: number;
  createdAt: string;
}

interface AnalyzeResponse {
  success: boolean;
  scan: ScanResult;
  snags: SnagItem[];
  aiResponse: {
    snags_detected: boolean;
    snags: { description: string; priority: string; trade_category: string }[];
  };
}

interface SnagScannerProps {
  jobId: string;
  jobNo: string;
  onStatusChange: (ragStatus: string, signoffLocked: boolean) => void;
}

// ─── Component ──────────────────────────────────────────────────────────

export default function SnagScanner({ jobId, jobNo, onStatusChange }: SnagScannerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [snagItems, setSnagItems] = useState<SnagItem[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalated, setEscalated] = useState(false);

  // ─── File handling ──────────────────────────────────────────────────

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Max 10 images
    const newFiles = [...selectedFiles, ...files].slice(0, 10);
    setSelectedFiles(newFiles);

    // Generate preview URLs
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    // Clean up old URLs
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls(urls);

    // Reset scan result when new files are added
    setScanResult(null);
    setSnagItems([]);
  }, [selectedFiles, previewUrls]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;

    const newFiles = [...selectedFiles, ...files].slice(0, 10);
    setSelectedFiles(newFiles);

    const urls = newFiles.map((f) => URL.createObjectURL(f));
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls(urls);

    setScanResult(null);
    setSnagItems([]);
  }, [selectedFiles, previewUrls]);

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    URL.revokeObjectURL(previewUrls[index]);
    const newUrls = previewUrls.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setPreviewUrls(newUrls);
    setScanResult(null);
    setSnagItems([]);
  };

  const clearAll = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviewUrls([]);
    setScanResult(null);
    setSnagItems([]);
    setShowOverrideForm(false);
    setOverrideReason("");
    setEscalated(false);
  };

  // ─── Upload & Analyze ─────────────────────────────────────────────

  const handleScanAndAnalyze = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "No photos selected", description: "Please upload at least one photo.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setIsAnalyzing(false);

    try {
      // Step 1: Upload images
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("photos", file));

      const uploadRes = await fetch(`/api/jobs/${jobId}/snag-upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }

      const uploadData = await uploadRes.json();
      const imageKeys = uploadData.images.map((img: any) => img.key);

      setIsUploading(false);
      setIsAnalyzing(true);

      // Step 2: Analyze with AI
      const analyzeRes = await fetch(`/api/jobs/${jobId}/snag-analyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageKeys }),
      });

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        throw new Error(err.error || "Analysis failed");
      }

      const data: AnalyzeResponse = await analyzeRes.json();

      setScanResult(data.scan);
      setSnagItems(data.snags);
      onStatusChange(data.scan.ragStatus, data.scan.signoffLocked);

      toast({
        title: data.scan.ragStatus === "Green" ? "✅ All Clear!" : data.scan.ragStatus === "Amber" ? "⚠️ Issues Found" : "🚨 Critical Issues",
        description: data.scan.ragStatus === "Green"
          ? "No snagging issues detected. Sign-off is unlocked."
          : `${data.snags.length} issue(s) detected. RAG Status: ${data.scan.ragStatus}`,
        variant: data.scan.ragStatus === "Green" ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({ title: "Scan Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  // ─── Override (Amber only) ────────────────────────────────────────

  const handleOverride = async () => {
    if (!overrideReason.trim()) {
      toast({ title: "Reason required", description: "Please explain why you are overriding.", variant: "destructive" });
      return;
    }

    setIsOverriding(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/snag-override`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: overrideReason.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Override failed");
      }

      onStatusChange("Amber", false); // Unlock signoff
      setShowOverrideForm(false);
      toast({ title: "Override Accepted", description: "Sign-off has been unlocked. Your override reason is logged for audit." });
    } catch (error: any) {
      toast({ title: "Override Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsOverriding(false);
    }
  };

  // ─── Escalate (Red only) ──────────────────────────────────────────

  const handleEscalate = async () => {
    setIsEscalating(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/snag-escalate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Escalation failed");
      }

      setEscalated(true);
      toast({ title: "Sent to Manager", description: "This job has been escalated for Works Manager review." });
    } catch (error: any) {
      toast({ title: "Escalation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsEscalating(false);
    }
  };

  // ─── Priority badge color ─────────────────────────────────────────

  const priorityColor = (p: string) => {
    switch (p) {
      case "High": return "bg-red-100 text-red-800 border-red-300";
      case "Medium": return "bg-amber-100 text-amber-800 border-amber-300";
      case "Low": return "bg-blue-100 text-blue-800 border-blue-300";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // ─── RAG Status Banner ────────────────────────────────────────────

  const renderStatusBanner = () => {
    if (!scanResult) return null;

    switch (scanResult.ragStatus) {
      case "Green":
        return (
          <Alert className="border-emerald-300 bg-emerald-50">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <AlertTitle className="text-emerald-800 text-lg">✅ All Clear — No Snags Detected</AlertTitle>
            <AlertDescription className="text-emerald-700">
              The AI inspection found no quality issues. The client signature block is now unlocked.
            </AlertDescription>
          </Alert>
        );

      case "Amber":
        return (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-800 text-lg">⚠️ Minor Issues Detected — {snagItems.length} Snag(s)</AlertTitle>
            <AlertDescription className="text-amber-700">
              The AI inspection found issues that should be addressed before sign-off.
              Client signature is locked until resolved or overridden.
            </AlertDescription>
          </Alert>
        );

      case "Red":
        return (
          <Alert className="border-red-300 bg-red-50">
            <XCircle className="h-5 w-5 text-red-600" />
            <AlertTitle className="text-red-800 text-lg">🚨 Critical Issues — Sign-Off Blocked</AlertTitle>
            <AlertDescription className="text-red-700">
              {snagItems.filter((s) => s.priority === "High").length > 0
                ? "High-priority safety/quality issues detected. "
                : `${snagItems.length} issues found (threshold exceeded). `}
              The job must be sent to your Works Manager for review.
            </AlertDescription>
          </Alert>
        );
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <Card className="border-2 border-indigo-200 bg-indigo-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Eye className="h-5 w-5 text-indigo-600" />
          Pre-Sign-Off Snag Check
          {scanResult && (
            <Badge
              className={`ml-2 ${
                scanResult.ragStatus === "Green"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : scanResult.ragStatus === "Amber"
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-red-100 text-red-800 border-red-300"
              }`}
            >
              {scanResult.ragStatus}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Upload photos of the completed work for AI quality inspection before client sign-off.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ─── Dropzone ──────────────────────────────────────────── */}
        {!scanResult && (
          <>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Camera className="h-10 w-10 text-indigo-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-indigo-700">Drop photos here or tap to select</p>
              <p className="text-xs text-indigo-500 mt-1">Up to 10 images • JPEG, PNG</p>
            </div>

            {/* ─── Preview grid ─────────────────────────────────────── */}
            {previewUrls.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    {selectedFiles.length} photo{selectedFiles.length > 1 ? "s" : ""} selected
                  </p>
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    <Trash2 className="h-4 w-4 mr-1" /> Clear all
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {previewUrls.map((url, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={url}
                        alt={`Snag photo ${i + 1}`}
                        className="w-full h-20 object-cover rounded-md border"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleScanAndAnalyze}
                  disabled={isUploading || isAnalyzing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  size="lg"
                >
                  {isUploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading photos...</>
                  ) : isAnalyzing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> AI scanning for snags...</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" /> Scan for Snags</>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        {/* ─── Results ────────────────────────────────────────────── */}
        {scanResult && (
          <div className="space-y-4">
            {renderStatusBanner()}

            {/* ─── Snag List ───────────────────────────────────────── */}
            {snagItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Detected Issues:</p>
                {snagItems.map((snag, i) => (
                  <div
                    key={snag.id || i}
                    className="flex items-start gap-3 p-3 bg-white rounded-lg border"
                  >
                    <Badge variant="outline" className={`${priorityColor(snag.priority)} text-xs mt-0.5`}>
                      {snag.priority}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{snag.description}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{snag.trade_category}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ─── Action Buttons ───────────────────────────────────── */}
            <div className="space-y-3 pt-2">
              {/* GREEN: No actions needed */}

              {/* AMBER: Rescan or Override */}
              {scanResult.ragStatus === "Amber" && scanResult.signoffLocked && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={clearAll}
                    className="flex-1"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Rectified — Rescan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowOverrideForm(true)}
                    className="flex-1 border-amber-400 text-amber-700 hover:bg-amber-50"
                  >
                    <Unlock className="mr-2 h-4 w-4" /> Override & Proceed
                  </Button>
                </div>
              )}

              {/* AMBER Override Form */}
              {showOverrideForm && (
                <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium text-amber-800">
                      Override Explanation Required
                    </p>
                  </div>
                  <Textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Explain why these issues don't require rectification before sign-off..."
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleOverride}
                      disabled={!overrideReason.trim() || isOverriding}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      {isOverriding ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                      ) : (
                        <><Unlock className="mr-2 h-4 w-4" /> Confirm Override</>
                      )}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowOverrideForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* RED: Send to Manager */}
              {scanResult.ragStatus === "Red" && !escalated && (
                <Button
                  onClick={handleEscalate}
                  disabled={isEscalating}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  {isEscalating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" /> Send to Manager for Review</>
                  )}
                </Button>
              )}

              {/* RED: Already escalated */}
              {scanResult.ragStatus === "Red" && escalated && (
                <Alert className="border-blue-300 bg-blue-50">
                  <Send className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800">Sent to Manager</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    This job has been sent to your Works Manager for review.
                    You will be notified when they respond.
                  </AlertDescription>
                </Alert>
              )}

              {/* Rescan button for all states (except fresh Green) */}
              {scanResult.ragStatus !== "Green" && (
                <Button
                  variant="ghost"
                  onClick={clearAll}
                  className="w-full text-gray-500"
                  size="sm"
                >
                  <RefreshCw className="mr-2 h-3 w-3" /> Start new scan
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
