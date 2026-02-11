import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquarePlus, Loader2 } from "lucide-react";

export function FeedbackButton() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("bug");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setCategory("bug");
    setSubject("");
    setDescription("");
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast({ title: "Please fill in both subject and description", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          description: description.trim(),
          page: location,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      toast({ title: "Feedback submitted", description: "Thank you for your feedback!" });
      resetForm();
      setOpen(false);
    } catch (err) {
      toast({ title: "Failed to submit feedback", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center"
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

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-feedback">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-feedback-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="improvement">Improvement</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your feedback"
                data-testid="input-feedback-subject"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe in detail what you've noticed, what's not working, or what could be improved..."
                rows={5}
                data-testid="input-feedback-description"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Current page: {location}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }} data-testid="button-feedback-cancel">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading} data-testid="button-feedback-submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
