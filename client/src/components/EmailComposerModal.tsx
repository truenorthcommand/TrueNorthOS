import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  X,
  Sparkles,
  Loader2,
  Bold,
  Italic,
  Underline,
  List,
  Link,
  Wand2,
  Smile,
  Briefcase,
  CheckCircle,
} from "lucide-react";

const NAVY = "#0F2B4C";

interface EmailComposerModalProps {
  open: boolean;
  onClose: () => void;
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
  clientName: string;
  onSuccess?: () => void;
}

function generateDefaultTemplate(clientName: string, portalUrl: string, companyName: string): string {
  return `Dear ${clientName},

We are pleased to invite you to your dedicated Customer Portal, where you can manage your account and stay up to date with all your projects.

Through the portal, you will be able to:
• View and approve quotes
• Track the status of your jobs
• Access and download invoices
• Review your complete job history

To get started, simply click the link below:
${portalUrl}

You will be prompted to create a secure password on your first visit.

If you have any questions or need assistance, please do not hesitate to contact us.

Kind regards,
${companyName} Team`;
}

export default function EmailComposerModal({
  open,
  onClose,
  defaultTo,
  defaultSubject,
  defaultBody,
  clientName,
  onSuccess,
}: EmailComposerModalProps) {
  const { toast } = useToast();
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improvingStyle, setImprovingStyle] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setSending(false);
      setImproving(false);
      setImprovingStyle(null);
    }
  }, [open, defaultTo, defaultSubject, defaultBody]);

  const resetAndClose = useCallback(() => {
    setSending(false);
    setImproving(false);
    setImprovingStyle(null);
    onClose();
  }, [onClose]);

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields (To, Subject, Body).",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const htmlBody = body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")
        .replace(/• /g, "&#8226; ");

      const styledHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
          ${htmlBody}
        </div>
      `;

      const res = await fetch("/api/outlook/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to,
          subject,
          body: styledHtml,
          isHtml: true,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast({
          title: "Email Sent",
          description: `Email invitation sent successfully to ${to}`,
        });
        onSuccess?.();
        resetAndClose();
      } else {
        let errorMessage = data.error || "Failed to send email";
        if (data.code === "OUTLOOK_NOT_CONNECTED" || data.code === "OUTLOOK_AUTH_ERROR") {
          errorMessage = "Your Outlook account needs to be reconnected. Please check the Outlook integration in Settings.";
        } else if (data.code === "RATE_LIMIT") {
          errorMessage = "Too many emails sent recently. Please wait a moment and try again.";
        }
        toast({
          title: "Email Not Sent",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Network Error",
        description: "Could not reach the server. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleAIImprove = async (style: string) => {
    if (!body.trim()) {
      toast({
        title: "No Content",
        description: "Please write some email content before using the AI assistant.",
        variant: "destructive",
      });
      return;
    }

    setImproving(true);
    setImprovingStyle(style);

    try {
      const res = await fetch("/api/ai/improve-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: body, style }),
      });

      const data = await res.json();

      if (res.ok && data.improved) {
        setBody(data.improved);
        const styleLabels: Record<string, string> = {
          improve: "Improved",
          friendly: "Made friendlier",
          formal: "Made more formal",
          grammar: "Grammar fixed",
        };
        toast({
          title: "AI Assistant",
          description: `${styleLabels[style] || "Updated"} - review the changes below.`,
        });
      } else {
        toast({
          title: "AI Unavailable",
          description: data.error || "Could not improve the email. Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Could not reach the AI service. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImproving(false);
      setImprovingStyle(null);
    }
  };

  const insertFormatting = (prefix: string, suffix: string) => {
    const textarea = document.querySelector('[data-testid="email-body-textarea"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);

    if (selectedText) {
      const newBody = body.substring(0, start) + prefix + selectedText + suffix + body.substring(end);
      setBody(newBody);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && resetAndClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="email-composer-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
            <Send className="h-5 w-5" />
            Compose Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="email-to" className="text-sm font-medium">To</Label>
            <Input
              id="email-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              type="email"
              data-testid="email-to-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-subject" className="text-sm font-medium">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              data-testid="email-subject-input"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-body" className="text-sm font-medium">Body</Label>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-0.5 border rounded-md p-0.5 mr-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => insertFormatting("**", "**")}
                    title="Bold"
                    data-testid="format-bold"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => insertFormatting("_", "_")}
                    title="Italic"
                    data-testid="format-italic"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => insertFormatting("__", "__")}
                    title="Underline"
                    data-testid="format-underline"
                  >
                    <Underline className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={improving}
                      data-testid="ai-writing-assistant-trigger"
                    >
                      {improving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      AI Assistant
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      onClick={() => handleAIImprove("improve")}
                      disabled={improving}
                      data-testid="ai-improve-writing"
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      Improve Writing
                      {improvingStyle === "improve" && <Loader2 className="h-3 w-3 ml-auto animate-spin" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleAIImprove("friendly")}
                      disabled={improving}
                      data-testid="ai-make-friendlier"
                    >
                      <Smile className="h-4 w-4 mr-2" />
                      Make Friendlier
                      {improvingStyle === "friendly" && <Loader2 className="h-3 w-3 ml-auto animate-spin" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleAIImprove("formal")}
                      disabled={improving}
                      data-testid="ai-make-formal"
                    >
                      <Briefcase className="h-4 w-4 mr-2" />
                      Make Formal
                      {improvingStyle === "formal" && <Loader2 className="h-3 w-3 ml-auto animate-spin" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleAIImprove("grammar")}
                      disabled={improving}
                      data-testid="ai-fix-grammar"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Fix Grammar
                      {improvingStyle === "grammar" && <Loader2 className="h-3 w-3 ml-auto animate-spin" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email here..."
              className="min-h-[300px] font-sans text-sm leading-relaxed resize-y"
              data-testid="email-body-textarea"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Sent via your connected Outlook account
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={resetAndClose}
                disabled={sending}
                data-testid="email-cancel-button"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSend}
                disabled={sending || !to || !subject || !body.trim()}
                style={{ backgroundColor: NAVY }}
                className="text-white hover:opacity-90"
                data-testid="email-send-button"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { generateDefaultTemplate };
