import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  XCircle,
  Unlock,
  RotateCcw,
  Eye,
  Clock,
  User,
  Loader2,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

// ─── Types ──────────────────────────────────────────────────────────────

interface SnagItemData {
  id: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  trade_category: string;
  status: string;
  image_url: string | null;
}

interface ScanData {
  id: string;
  rag_status: string;
  image_count: number;
  created_at: string;
  scanned_by_name: string | null;
}

interface ReviewQueueItem {
  id: string;
  job_no: string;
  customer_name: string;
  address: string;
  status: string;
  rag_status: "Red" | "Amber";
  signoff_locked: boolean;
  snag_override_by: string | null;
  snag_override_reason: string | null;
  snag_override_at: string | null;
  override_by_name: string | null;
  assigned_to_name: string | null;
  scans: ScanData[] | null;
  snag_items: SnagItemData[] | null;
}

// ─── Component ──────────────────────────────────────────────────────────

export default function SnagReviewQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedJob, setSelectedJob] = useState<ReviewQueueItem | null>(null);
  const [unlockReason, setUnlockReason] = useState("");
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // ─── Fetch review queue ────────────────────────────────────────────

  const { data: queue = [], isLoading } = useQuery<ReviewQueueItem[]>({
    queryKey: ["snag-review-queue"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/snag-review-queue", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch review queue");
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const redJobs = queue.filter((j) => j.rag_status === "Red" && j.signoff_locked);
  const amberJobs = queue.filter((j) => j.rag_status === "Amber" && j.snag_override_at);

  // ─── Manager Unlock (Red jobs) ─────────────────────────────────────

  const unlockMutation = useMutation({
    mutationFn: async ({ jobId, reason }: { jobId: string; reason: string }) => {
      const res = await fetch(`/api/jobs/${jobId}/snag-manager-unlock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to unlock job");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snag-review-queue"] });
      setShowUnlockDialog(false);
      setUnlockReason("");
      setSelectedJob(null);
      toast({ title: "Job Unlocked", description: "The job has been unlocked for sign-off." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // ─── Return to Tradesman (Red jobs) ────────────────────────────────

  const returnMutation = useMutation({
    mutationFn: async ({ jobId, notes }: { jobId: string; notes: string }) => {
      const res = await fetch(`/api/jobs/${jobId}/snag-return-to-tradesman`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error("Failed to return job");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snag-review-queue"] });
      setShowReturnDialog(false);
      setReturnNotes("");
      setSelectedJob(null);
      toast({ title: "Job Returned", description: "The job has been returned to the tradesman for rectification." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // ─── Fetch presigned URL for an image ──────────────────────────────

  const loadImageUrl = async (jobId: string, key: string) => {
    if (imageUrls[key]) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/snag-images/${key}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setImageUrls((prev) => ({ ...prev, [key]: data.presignedUrl }));
      }
    } catch (err) {
      console.error("Failed to load image URL:", err);
    }
  };

  // ─── Priority badge ────────────────────────────────────────────────

  const priorityColor = (p: string) => {
    switch (p) {
      case "High": return "bg-red-100 text-red-800 border-red-300";
      case "Medium": return "bg-amber-100 text-amber-800 border-amber-300";
      case "Low": return "bg-blue-100 text-blue-800 border-blue-300";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // ─── Render a single job card ──────────────────────────────────────

  const renderJobCard = (item: ReviewQueueItem) => {
    const isRed = item.rag_status === "Red";
    const borderColor = isRed ? "border-red-300" : "border-amber-300";
    const bgColor = isRed ? "bg-red-50/50" : "bg-amber-50/50";

    return (
      <Card key={item.id} className={`border-2 ${borderColor} ${bgColor}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge
                className={`${
                  isRed
                    ? "bg-red-100 text-red-800 border-red-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                } text-sm px-3 py-1`}
              >
                {isRed ? "🚨 RED" : "⚠️ AMBER"}
              </Badge>
              <div>
                <CardTitle className="text-base">
                  <Link href={`/jobs/${item.id}`} className="hover:underline">
                    {item.job_no}
                  </Link>
                  <span className="text-muted-foreground font-normal ml-2">
                    — {item.customer_name}
                  </span>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{item.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {item.assigned_to_name && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" /> {item.assigned_to_name}
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Override info (Amber only) */}
          {!isRed && item.snag_override_at && (
            <div className="bg-amber-100 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
                <ShieldCheck className="h-4 w-4" />
                Overridden by {item.override_by_name || "Unknown"}
              </div>
              <p className="text-sm text-amber-700 mt-1">
                <strong>Reason:</strong> {item.snag_override_reason || "No reason provided"}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                <Clock className="h-3 w-3 inline mr-1" />
                {item.snag_override_at
                  ? format(parseISO(item.snag_override_at), "dd MMM yyyy HH:mm")
                  : "Unknown"}
              </p>
            </div>
          )}

          {/* Scan info */}
          {item.scans && item.scans.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <Clock className="h-3 w-3 inline mr-1" />
              Last scan: {format(parseISO(item.scans[0].created_at), "dd MMM yyyy HH:mm")}
              {item.scans[0].scanned_by_name && ` by ${item.scans[0].scanned_by_name}`}
              {" • "}{item.scans[0].image_count} photo(s)
            </div>
          )}

          {/* Snag items list */}
          {item.snag_items && item.snag_items.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                AI-Detected Issues ({item.snag_items.length}):
              </p>
              {item.snag_items.map((snag) => (
                <div
                  key={snag.id}
                  className="flex items-start gap-3 p-2.5 bg-white rounded-lg border"
                >
                  <Badge variant="outline" className={`${priorityColor(snag.priority)} text-xs mt-0.5`}>
                    {snag.priority}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{snag.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{snag.trade_category}</span>
                      <Badge variant="outline" className="text-xs">
                        {snag.status}
                      </Badge>
                    </div>
                  </div>
                  {/* Load image if available */}
                  {snag.image_url && (
                    <button
                      onClick={() => loadImageUrl(item.id, snag.image_url!)}
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" /> View
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Loaded images */}
          {item.snag_items?.some((s) => s.image_url && imageUrls[s.image_url]) && (
            <div className="grid grid-cols-3 gap-2">
              {item.snag_items
                ?.filter((s) => s.image_url && imageUrls[s.image_url])
                .map((s) => (
                  <img
                    key={s.id}
                    src={imageUrls[s.image_url!]}
                    alt="Snag evidence"
                    className="w-full h-24 object-cover rounded-md border"
                  />
                ))}
            </div>
          )}

          {/* Action buttons (Red jobs only) */}
          {isRed && item.signoff_locked && (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                onClick={() => {
                  setSelectedJob(item);
                  setShowUnlockDialog(true);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                size="sm"
              >
                <Unlock className="mr-2 h-4 w-4" /> Approve & Unlock
              </Button>
              <Button
                onClick={() => {
                  setSelectedJob(item);
                  setShowReturnDialog(true);
                }}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                size="sm"
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Return for Rework
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ─── Main render ───────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto pb-20 pt-8 px-4">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6 text-indigo-600" />
            Snag Review Queue
          </h1>
          <p className="text-muted-foreground">
            AI snagging scan results requiring manager review
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : queue.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="py-16 text-center">
            <ShieldCheck className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700">Queue Clear</h3>
            <p className="text-muted-foreground mt-1">
              No jobs requiring snag review at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* RED section */}
          {redJobs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <h2 className="text-lg font-semibold text-red-800">
                  Critical — Requires Decision ({redJobs.length})
                </h2>
              </div>
              {redJobs.map(renderJobCard)}
            </div>
          )}

          {/* AMBER section */}
          {amberJobs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-amber-800">
                  Overridden by Tradesman — For Awareness ({amberJobs.length})
                </h2>
              </div>
              {amberJobs.map(renderJobCard)}
            </div>
          )}
        </div>
      )}

      {/* ─── Unlock Dialog ────────────────────────────────────────── */}
      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & Unlock Job for Sign-Off</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are approving <strong>{selectedJob?.job_no}</strong> for sign-off despite
              critical snag issues. This action will be logged.
            </p>
            <Textarea
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Reason for approving despite critical issues (optional)..."
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowUnlockDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={unlockMutation.isPending}
              onClick={() => {
                if (selectedJob) {
                  unlockMutation.mutate({
                    jobId: selectedJob.id,
                    reason: unlockReason.trim() || "Manager approved",
                  });
                }
              }}
            >
              {unlockMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Unlocking...</>
              ) : (
                <><Unlock className="mr-2 h-4 w-4" /> Confirm Unlock</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Return Dialog ────────────────────────────────────────── */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Job for Rectification</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>{selectedJob?.job_no}</strong> will be set back to "In Progress"
              and the tradesman will be notified to address the snag issues.
            </p>
            <Textarea
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="Instructions for the tradesman (optional)..."
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReturnDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={returnMutation.isPending}
              onClick={() => {
                if (selectedJob) {
                  returnMutation.mutate({
                    jobId: selectedJob.id,
                    notes: returnNotes.trim(),
                  });
                }
              }}
            >
              {returnMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Returning...</>
              ) : (
                <><RotateCcw className="mr-2 h-4 w-4" /> Return to Tradesman</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
