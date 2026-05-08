import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageSquarePlus, Loader2, Camera, X, Bug, Lightbulb, Sparkles, MessageCircle } from "lucide-react";
import html2canvas from "html2canvas";

const CATEGORIES = [
  { value: "bug", label: "Bug", emoji: "🐛", icon: Bug },
  { value: "improvement", label: "Improvement", emoji: "💡", icon: Lightbulb },
  { value: "feature", label: "Feature", emoji: "✨", icon: Sparkles },
  { value: "other", label: "Other", emoji: "💬", icon: MessageCircle },
] as const;

const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-700 border-red-200" },
] as const;

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-100 text-blue-700 border-blue-200" },
  reviewed: { label: "Reviewed", className: "bg-purple-100 text-purple-700 border-purple-200" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-700 border-green-200" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-700 border-gray-200" },
  wont_fix: { label: "Won't Fix", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGES[status] || STATUS_BADGES.new;
  return (
    <Badge variant="outline" className={`text-xs ${badge.className}`}>
      {badge.label}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const cat = CATEGORIES.find((c) => c.value === category);
  if (!cat) return null;
  return (
    <span className="text-sm">
      {cat.emoji} {cat.label}
    </span>
  );
}

export function FeedbackButton() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("submit");
  const [category, setCategory] = useState("bug");
  const [priority, setPriority] = useState("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const resetForm = () => {
    setCategory("bug");
    setPriority("medium");
    setSubject("");
    setDescription("");
    setScreenshot(null);
  };

  // Fetch user's feedback history
  const { data: myFeedback, isLoading: loadingHistory } = useQuery<any[]>({
    queryKey: ["/api/feedback/my"],
    queryFn: () => fetch("/api/feedback/my", { credentials: "include" }).then((r) => r.json()),
    enabled: open && activeTab === "history",
  });

  // Submit feedback mutation
  const submitMutation = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to submit");
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "Feedback submitted", description: "Thank you for your feedback!" });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/my"] });
      resetForm();
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to submit feedback", variant: "destructive" });
    },
  });

  const captureScreenshot = useCallback(async () => {
    setCapturing(true);
    try {
      const canvas = await html2canvas(document.body, {
        scale: 0.5,
        useCORS: true,
        logging: false,
        ignoreElements: (el) => {
          // Ignore the feedback sheet itself
          return el.getAttribute("data-feedback-sheet") === "true";
        },
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      setScreenshot(dataUrl);
      toast({ title: "Screenshot captured", description: "Page screenshot attached to your feedback." });
    } catch (err) {
      console.error("Screenshot failed:", err);
      toast({ title: "Screenshot failed", description: "Could not capture the page.", variant: "destructive" });
    } finally {
      setCapturing(false);
    }
  }, [toast]);

  const handleSubmit = () => {
    if (!subject.trim() || !description.trim()) {
      toast({ title: "Please fill in both subject and description", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      category,
      priority,
      subject: subject.trim(),
      description: description.trim(),
      page: location,
      screenshot_url: screenshot || undefined,
    });
  };

  if (!user) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all hover:scale-105"
            onClick={() => setOpen(true)}
            data-testid="button-feedback"
          >
            <MessageSquarePlus className="h-5 w-5" />
            <span className="sr-only">Send Feedback</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Send Feedback</p>
        </TooltipContent>
      </Tooltip>

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
          data-feedback-sheet="true"
          data-testid="sheet-feedback"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5" />
              Feedback
            </SheetTitle>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="submit">Submit Feedback</TabsTrigger>
              <TabsTrigger value="history">My Feedback</TabsTrigger>
            </TabsList>

            {/* Submit Tab */}
            <TabsContent value="submit" className="space-y-4 mt-4">
              {/* Category */}
              <div>
                <Label className="text-sm font-medium">Category</Label>
                <div className="grid grid-cols-4 gap-2 mt-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                        category === cat.value
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <span className="text-lg">{cat.emoji}</span>
                      <span className="font-medium">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <Label className="text-sm font-medium">Priority</Label>
                <div className="grid grid-cols-4 gap-2 mt-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={`px-2 py-1.5 rounded-md border text-xs font-medium transition-all ${
                        priority === p.value
                          ? `${p.color} ring-1 ring-offset-1`
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <Label className="text-sm font-medium">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your feedback"
                  className="mt-1.5"
                  data-testid="input-feedback-subject"
                />
              </div>

              {/* Description */}
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe in detail what you've noticed, what's not working, or what could be improved..."
                  rows={4}
                  className="mt-1.5"
                  data-testid="input-feedback-description"
                />
                <p className="text-xs text-muted-foreground mt-1">Supports markdown formatting</p>
              </div>

              {/* Screenshot */}
              <div>
                <Label className="text-sm font-medium">Screenshot</Label>
                <div className="mt-1.5">
                  {screenshot ? (
                    <div className="relative">
                      <img
                        src={screenshot}
                        alt="Page screenshot"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => setScreenshot(null)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={captureScreenshot}
                      disabled={capturing}
                      className="w-full"
                    >
                      {capturing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Camera className="h-4 w-4 mr-2" />
                      )}
                      {capturing ? "Capturing..." : "Capture Page Screenshot"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Page URL */}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="font-medium">Page:</span> {location}
              </p>

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => { setOpen(false); resetForm(); }}
                  className="flex-1"
                  data-testid="button-feedback-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="flex-1"
                  data-testid="button-feedback-submit"
                >
                  {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Submit
                </Button>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !myFeedback || myFeedback.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquarePlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No feedback submitted yet</p>
                  <p className="text-xs mt-1">Your submitted feedback will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myFeedback.map((item: any) => (
                    <div
                      key={item.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <CategoryBadge category={item.category} />
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="font-medium text-sm">{item.subject}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.page}</span>
                        <span>
                          {new Date(item.createdAt || item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {item.admin_notes && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                          <span className="font-medium">Admin note:</span> {item.admin_notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
