import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Mail,
  Search,
  Settings,
  Paperclip,
  Send,
  Sparkles,
  UserPlus,
  Briefcase,
  RefreshCw,
  Loader2,
  MailOpen,
  ChevronLeft,
  AlertTriangle,
  MessageSquare,
  Zap,
  CheckCircle,
  XCircle,
  Link,
  Download,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Meh,
  Clock,
  Image,
} from "lucide-react";

interface OutlookEmail {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  receivedDateTime: string;
  bodyPreview: string;
  isRead: boolean;
  hasAttachments?: boolean;
  body?: {
    contentType: string;
    content: string;
  };
  toRecipients?: Array<{ emailAddress: { name: string; address: string } }>;
  ccRecipients?: Array<{ emailAddress: { name: string; address: string } }>;
}

interface OutlookUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

interface Attachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
}

interface ExtractedData {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  jobDescription?: string;
  jobDate?: string;
  notes?: string;
}

interface EmailAnalysis {
  category: 'quote_request' | 'complaint' | 'job_update' | 'invoice_query' | 'general_enquiry' | 'booking_request' | 'cancellation' | 'feedback' | 'spam';
  priority: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  summary: string;
  suggestedReply?: string;
  extractedData?: ExtractedData & { amount?: string };
  matchedClientId?: number;
  matchedJobId?: number;
}

const categoryLabels: Record<string, { label: string; color: string }> = {
  quote_request: { label: 'Quote Request', color: 'bg-blue-100 text-blue-800' },
  complaint: { label: 'Complaint', color: 'bg-red-100 text-red-800' },
  job_update: { label: 'Job Update', color: 'bg-green-100 text-green-800' },
  invoice_query: { label: 'Invoice Query', color: 'bg-yellow-100 text-yellow-800' },
  general_enquiry: { label: 'Enquiry', color: 'bg-gray-100 text-gray-800' },
  booking_request: { label: 'Booking', color: 'bg-purple-100 text-purple-800' },
  cancellation: { label: 'Cancellation', color: 'bg-orange-100 text-orange-800' },
  feedback: { label: 'Feedback', color: 'bg-teal-100 text-teal-800' },
  spam: { label: 'Spam', color: 'bg-gray-300 text-gray-600' },
};

const priorityConfig: Record<string, { icon: any; color: string; label: string }> = {
  high: { icon: AlertTriangle, color: 'text-red-500', label: 'High Priority' },
  medium: { icon: Clock, color: 'text-yellow-500', label: 'Medium Priority' },
  low: { icon: CheckCircle, color: 'text-green-500', label: 'Low Priority' },
};

const sentimentConfig: Record<string, { icon: any; color: string; label: string }> = {
  positive: { icon: ThumbsUp, color: 'text-green-500', label: 'Positive' },
  neutral: { icon: Meh, color: 'text-gray-500', label: 'Neutral' },
  negative: { icon: ThumbsDown, color: 'text-orange-500', label: 'Negative' },
  urgent: { icon: AlertTriangle, color: 'text-red-500', label: 'Urgent' },
};

export default function OutlookInbox() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [userEmail, setUserEmail] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<OutlookEmail | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [emailAnalysis, setEmailAnalysis] = useState<EmailAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [selectedJobForAttachment, setSelectedJobForAttachment] = useState<string>("");
  const [savingAttachment, setSavingAttachment] = useState<string | null>(null);

  // Fetch current user from connector (delegated auth uses /me endpoint)
  const { data: currentUser, isLoading: loadingCurrentUser } = useQuery<{ email: string; displayName: string }>({
    queryKey: ["/api/outlook/me"],
    queryFn: async () => {
      const res = await fetch("/api/outlook/me");
      if (!res.ok) throw new Error("Failed to get current user");
      return res.json();
    },
    retry: false,
  });

  // Fall back to users list for application permissions (legacy)
  const { data: outlookUsers = [], isLoading: loadingUsers } = useQuery<OutlookUser[]>({
    queryKey: ["/api/outlook/users"],
    retry: false,
    enabled: !currentUser, // Only fetch if no current user from /me
  });

  useEffect(() => {
    // Prefer current user from /me endpoint (delegated auth)
    if (currentUser?.email && !userEmail) {
      setUserEmail(currentUser.email);
      return;
    }
    // Fall back to users list (application permissions)
    if (outlookUsers.length > 0 && !userEmail) {
      const savedEmail = localStorage.getItem("outlook_default_email");
      if (savedEmail && outlookUsers.some(u => u.mail === savedEmail || u.userPrincipalName === savedEmail)) {
        setUserEmail(savedEmail);
      } else {
        const firstEmail = outlookUsers[0].mail || outlookUsers[0].userPrincipalName;
        setUserEmail(firstEmail);
      }
    }
  }, [currentUser, outlookUsers, userEmail]);

  const { data: emails = [], isLoading: loadingEmails, refetch: refetchEmails } = useQuery<OutlookEmail[]>({
    queryKey: ["/api/outlook/emails", userEmail],
    queryFn: async () => {
      if (!userEmail) return [];
      const res = await fetch(`/api/outlook/emails/${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error("Failed to fetch emails");
      return res.json();
    },
    enabled: !!userEmail,
  });

  const { data: searchResults = [], isLoading: loadingSearch } = useQuery<OutlookEmail[]>({
    queryKey: ["/api/outlook/search", userEmail, searchQuery],
    queryFn: async () => {
      if (!userEmail || !searchQuery) return [];
      const res = await fetch(`/api/outlook/search/${encodeURIComponent(userEmail)}?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Failed to search emails");
      return res.json();
    },
    enabled: !!userEmail && !!searchQuery && searchQuery.length >= 2,
  });

  const { data: emailDetail, isLoading: loadingDetail } = useQuery<OutlookEmail>({
    queryKey: ["/api/outlook/emails", userEmail, selectedEmail?.id],
    queryFn: async () => {
      if (!userEmail || !selectedEmail) return null;
      const res = await fetch(`/api/outlook/emails/${encodeURIComponent(userEmail)}/${selectedEmail.id}`);
      if (!res.ok) throw new Error("Failed to fetch email details");
      return res.json();
    },
    enabled: !!userEmail && !!selectedEmail && detailDialogOpen,
  });

  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: ["/api/outlook/attachments", userEmail, selectedEmail?.id],
    queryFn: async () => {
      if (!userEmail || !selectedEmail) return [];
      const res = await fetch(`/api/outlook/emails/${encodeURIComponent(userEmail)}/${selectedEmail.id}/attachments`);
      if (!res.ok) throw new Error("Failed to fetch attachments");
      return res.json();
    },
    enabled: !!userEmail && !!selectedEmail && detailDialogOpen && selectedEmail.hasAttachments,
  });

  const { data: jobs = [] } = useQuery<Array<{ id: number; jobNo: string; customerName: string }>>({
    queryKey: ["/api/jobs"],
    enabled: detailDialogOpen,
  });

  const replyMutation = useMutation({
    mutationFn: async ({ messageId, body }: { messageId: string; body: string }) => {
      const res = await apiRequest("POST", `/api/outlook/emails/${encodeURIComponent(userEmail)}/${messageId}/reply`, { body });
      return res.json();
    },
    onSuccess: () => {
      toast.success("Reply sent successfully");
      setReplyText("");
      setDetailDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to send reply");
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await apiRequest("PATCH", `/api/outlook/emails/${encodeURIComponent(userEmail)}/${messageId}/read`, { isRead: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlook/emails", userEmail] });
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (clientData: { name: string; email?: string; phone?: string; address?: string }) => {
      const res = await apiRequest("POST", "/api/clients", clientData);
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Client "${data.name}" created successfully`);
      setExtractedData(null);
    },
    onError: () => {
      toast.error("Failed to create client");
    },
  });

  const createJobMutation = useMutation({
    mutationFn: async (jobData: { customerName: string; description?: string; notes?: string }) => {
      const res = await apiRequest("POST", "/api/jobs", {
        ...jobData,
        jobNo: `JOB-${Date.now()}`,
        status: "Draft",
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Job created successfully`);
      setExtractedData(null);
    },
    onError: () => {
      toast.error("Failed to create job");
    },
  });

  const handleEmailClick = async (email: OutlookEmail) => {
    setSelectedEmail(email);
    setDetailDialogOpen(true);
    setExtractedData(null);
    setEmailAnalysis(null);
    setReplyText("");
    if (!email.isRead) {
      markAsReadMutation.mutate(email.id);
    }
  };

  // AI-powered full email analysis
  const handleAnalyzeEmail = async () => {
    if (!selectedEmail || !userEmail) return;
    
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/outlook/emails/${encodeURIComponent(userEmail)}/${selectedEmail.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (res.ok) {
        const analysis = await res.json();
        setEmailAnalysis(analysis);
        // Also populate extracted data if available
        if (analysis.extractedData) {
          setExtractedData(analysis.extractedData);
        }
        toast.success("Email analyzed successfully");
      } else {
        toast.error("Failed to analyze email");
      }
    } catch (error) {
      toast.error("Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate smart reply
  const handleSmartReply = async (replyType: 'acknowledge' | 'quote' | 'schedule' | 'followup' | 'resolve') => {
    if (!selectedEmail || !userEmail) return;
    
    setIsGeneratingReply(true);
    try {
      const res = await fetch(`/api/outlook/emails/${encodeURIComponent(userEmail)}/${selectedEmail.id}/smart-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyType }),
      });
      
      if (res.ok) {
        const { reply } = await res.json();
        setReplyText(reply);
        toast.success("Reply generated");
      } else {
        toast.error("Failed to generate reply");
      }
    } catch (error) {
      toast.error("Reply generation failed");
    } finally {
      setIsGeneratingReply(false);
    }
  };

  // Save attachment to job
  const handleSaveAttachmentToJob = async (attachmentId: string, jobId: number) => {
    if (!selectedEmail || !userEmail) return;
    
    setSavingAttachment(attachmentId);
    try {
      const res = await fetch(`/api/outlook/emails/${encodeURIComponent(userEmail)}/${selectedEmail.id}/attachments/${attachmentId}/save-to-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, photoType: 'evidence' }),
      });
      
      if (res.ok) {
        toast.success("Attachment saved to job");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save attachment");
      }
    } catch (error) {
      toast.error("Save failed");
    } finally {
      setSavingAttachment(null);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem("outlook_default_email", userEmail);
    setSettingsDialogOpen(false);
    toast.success("Settings saved");
  };

  const handleExtractWithAI = async () => {
    if (!emailDetail?.body?.content) {
      toast.error("No email content to extract from");
      return;
    }

    setIsExtracting(true);
    try {
      const prompt = `Extract client and job information from this email. Return a JSON object with these fields (leave empty if not found):
- clientName: the name of the client or person
- clientEmail: their email address
- clientPhone: their phone number
- clientAddress: their address
- jobDescription: what work they need done
- jobDate: when they want the work done
- notes: any other important details

Email content:
${emailDetail.body.content.replace(/<[^>]*>/g, ' ').substring(0, 3000)}

Respond with only valid JSON, no markdown.`;

      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (res.ok) {
        const data = await res.json();
        try {
          const extracted = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
          setExtractedData(extracted);
          toast.success("Information extracted successfully");
        } catch {
          setExtractedData(data.result || data);
          toast.success("Information extracted");
        }
      } else {
        toast.error("Failed to extract information");
      }
    } catch (error) {
      toast.error("AI extraction failed");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCreateClient = () => {
    if (!extractedData?.clientName) {
      toast.error("Client name is required");
      return;
    }
    createClientMutation.mutate({
      name: extractedData.clientName,
      email: extractedData.clientEmail,
      phone: extractedData.clientPhone,
      address: extractedData.clientAddress,
    });
  };

  const handleCreateJob = () => {
    const customerName = extractedData?.clientName || emailDetail?.from?.emailAddress?.name || "Unknown";
    createJobMutation.mutate({
      customerName,
      description: extractedData?.jobDescription,
      notes: extractedData?.notes,
    });
  };

  const handleReply = () => {
    if (!replyText.trim() || !selectedEmail) return;
    replyMutation.mutate({ messageId: selectedEmail.id, body: replyText });
  };

  const displayEmails = searchQuery.length >= 2 ? searchResults : emails;

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="p-6">
          <CardTitle className="text-center">Access Denied</CardTitle>
          <p className="text-muted-foreground mt-2">Only administrators can access the Outlook Inbox.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-outlook-inbox-title">
            Outlook Inbox
          </h1>
          <p className="text-muted-foreground">
            {userEmail ? `Viewing emails for ${userEmail}` : "Configure email account to view messages"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetchEmails()}
            disabled={loadingEmails || !userEmail}
            data-testid="button-refresh-emails"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingEmails ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setSettingsDialogOpen(true)} data-testid="button-settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground ml-2" />
        <Input
          placeholder="Search emails by subject or sender..."
          className="border-none shadow-none focus-visible:ring-0"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-search-emails"
        />
        {loadingSearch && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingEmails || loadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !userEmail ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No email account configured</p>
              <Button variant="link" onClick={() => setSettingsDialogOpen(true)}>
                Configure Settings
              </Button>
            </div>
          ) : displayEmails.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{searchQuery ? "No emails match your search" : "No emails found"}</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              {displayEmails.map((email, index) => (
                <div key={email.id}>
                  <div
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      !email.isRead ? "bg-blue-50 dark:bg-blue-950/20" : ""
                    }`}
                    onClick={() => handleEmailClick(email)}
                    data-testid={`email-item-${email.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {!email.isRead ? (
                            <Mail className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          ) : (
                            <MailOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <span
                            className={`font-medium truncate ${!email.isRead ? "text-foreground" : "text-muted-foreground"}`}
                            data-testid={`email-sender-${email.id}`}
                          >
                            {email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown"}
                          </span>
                          {email.hasAttachments && (
                            <Badge variant="secondary" className="flex-shrink-0" data-testid={`email-attachment-badge-${email.id}`}>
                              <Paperclip className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                        <p
                          className={`text-sm truncate ${!email.isRead ? "font-semibold" : ""}`}
                          data-testid={`email-subject-${email.id}`}
                        >
                          {email.subject || "(No Subject)"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">{email.bodyPreview}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs text-muted-foreground" data-testid={`email-date-${email.id}`}>
                          {format(new Date(email.receivedDateTime), "MMM d, h:mm a")}
                        </span>
                        {!email.isRead && (
                          <Badge variant="default" className="text-xs" data-testid={`email-unread-badge-${email.id}`}>
                            New
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {index < displayEmails.length - 1 && <Separator />}
                </div>
              ))}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-email-detail-title">
              <Mail className="h-5 w-5" />
              {emailDetail?.subject || selectedEmail?.subject || "Email Details"}
            </DialogTitle>
            <DialogDescription>
              From: {emailDetail?.from?.emailAddress?.name || selectedEmail?.from?.emailAddress?.name} (
              {emailDetail?.from?.emailAddress?.address || selectedEmail?.from?.emailAddress?.address})
              {emailDetail?.receivedDateTime && (
                <> • {format(new Date(emailDetail.receivedDateTime), "MMMM d, yyyy 'at' h:mm a")}</>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  {emailDetail?.body?.content && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {emailDetail.body.contentType === "html" ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: emailDetail.body.content }}
                          className="overflow-x-auto"
                          data-testid="email-body-content"
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap" data-testid="email-body-content">
                          {emailDetail.body.content}
                        </pre>
                      )}
                    </div>
                  )}

                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      <Label>Attachments ({attachments.length})</Label>
                      <div className="space-y-2">
                        {attachments.map((att) => (
                          <div key={att.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <div className="flex items-center gap-2">
                              {att.contentType?.startsWith('image/') ? (
                                <Image className="h-4 w-4 text-blue-500" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                              <span className="text-sm">{att.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({Math.round(att.size / 1024)}KB)
                              </span>
                            </div>
                            {att.contentType?.startsWith('image/') && jobs.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Select value={selectedJobForAttachment} onValueChange={setSelectedJobForAttachment}>
                                  <SelectTrigger className="w-[180px] h-8 text-xs">
                                    <SelectValue placeholder="Select job..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {jobs.slice(0, 20).map((job) => (
                                      <SelectItem key={job.id} value={job.id.toString()}>
                                        {job.jobNo} - {job.customerName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSaveAttachmentToJob(att.id, parseInt(selectedJobForAttachment))}
                                  disabled={!selectedJobForAttachment || savingAttachment === att.id}
                                >
                                  {savingAttachment === att.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Download className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="default"
                      onClick={handleAnalyzeEmail}
                      disabled={isAnalyzing || !emailDetail}
                      data-testid="button-analyze-ai"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      AI Analyze
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleExtractWithAI}
                      disabled={isExtracting || !emailDetail}
                      data-testid="button-extract-ai"
                    >
                      {isExtracting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Extract Data
                    </Button>
                  </div>

                  {emailAnalysis && (
                    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Zap className="h-4 w-4 text-blue-500" />
                          AI Analysis Results
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge className={categoryLabels[emailAnalysis.category]?.color || 'bg-gray-100'}>
                            {categoryLabels[emailAnalysis.category]?.label || emailAnalysis.category}
                          </Badge>
                          {priorityConfig[emailAnalysis.priority] && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              {(() => {
                                const PriorityIcon = priorityConfig[emailAnalysis.priority].icon;
                                return <PriorityIcon className={`h-3 w-3 ${priorityConfig[emailAnalysis.priority].color}`} />;
                              })()}
                              {priorityConfig[emailAnalysis.priority].label}
                            </Badge>
                          )}
                          {sentimentConfig[emailAnalysis.sentiment] && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              {(() => {
                                const SentimentIcon = sentimentConfig[emailAnalysis.sentiment].icon;
                                return <SentimentIcon className={`h-3 w-3 ${sentimentConfig[emailAnalysis.sentiment].color}`} />;
                              })()}
                              {sentimentConfig[emailAnalysis.sentiment].label}
                            </Badge>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Summary</Label>
                          <p className="text-sm">{emailAnalysis.summary}</p>
                        </div>

                        {(emailAnalysis.matchedClientId || emailAnalysis.matchedJobId) && (
                          <div className="flex gap-2">
                            {emailAnalysis.matchedClientId && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Link className="h-3 w-3" />
                                Linked to Client #{emailAnalysis.matchedClientId}
                              </Badge>
                            )}
                            {emailAnalysis.matchedJobId && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Link className="h-3 w-3" />
                                Linked to Job #{emailAnalysis.matchedJobId}
                              </Badge>
                            )}
                          </div>
                        )}

                        {emailAnalysis.suggestedReply && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Suggested Reply</Label>
                            <p className="text-sm italic bg-white dark:bg-slate-900 p-2 rounded border mt-1">
                              {emailAnalysis.suggestedReply}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2"
                              onClick={() => setReplyText(emailAnalysis.suggestedReply || '')}
                            >
                              Use This Reply
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {extractedData && (
                    <Card className="bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Extracted Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {extractedData.clientName && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Client Name</Label>
                              <p data-testid="extracted-client-name">{extractedData.clientName}</p>
                            </div>
                          )}
                          {extractedData.clientEmail && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Email</Label>
                              <p data-testid="extracted-client-email">{extractedData.clientEmail}</p>
                            </div>
                          )}
                          {extractedData.clientPhone && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Phone</Label>
                              <p data-testid="extracted-client-phone">{extractedData.clientPhone}</p>
                            </div>
                          )}
                          {extractedData.clientAddress && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Address</Label>
                              <p data-testid="extracted-client-address">{extractedData.clientAddress}</p>
                            </div>
                          )}
                          {extractedData.jobDescription && (
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Job Description</Label>
                              <p data-testid="extracted-job-description">{extractedData.jobDescription}</p>
                            </div>
                          )}
                          {extractedData.notes && (
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Notes</Label>
                              <p data-testid="extracted-notes">{extractedData.notes}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={handleCreateClient}
                            disabled={!extractedData.clientName || createClientMutation.isPending}
                            data-testid="button-create-client"
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Create Client
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCreateJob}
                            disabled={createJobMutation.isPending}
                            data-testid="button-create-job"
                          >
                            <Briefcase className="h-4 w-4 mr-2" />
                            Create Job
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Reply</Label>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSmartReply('acknowledge')}
                          disabled={isGeneratingReply}
                          title="Generate acknowledgment"
                        >
                          {isGeneratingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSmartReply('quote')}
                          disabled={isGeneratingReply}
                          title="Generate quote offer"
                        >
                          <FileText className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSmartReply('schedule')}
                          disabled={isGeneratingReply}
                          title="Generate scheduling reply"
                        >
                          <Clock className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSmartReply('resolve')}
                          disabled={isGeneratingReply}
                          title="Generate resolution reply"
                        >
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Type your reply or use smart reply buttons above..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                      data-testid="textarea-reply"
                    />
                    <Button
                      onClick={handleReply}
                      disabled={!replyText.trim() || replyMutation.isPending}
                      data-testid="button-send-reply"
                    >
                      {replyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send Reply
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-settings-title">Outlook Settings</DialogTitle>
            <DialogDescription>Configure which email account to view</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-select">Email Account</Label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading accounts...
                </div>
              ) : outlookUsers.length > 0 ? (
                <Select value={userEmail} onValueChange={setUserEmail} data-testid="select-email-account">
                  <SelectTrigger data-testid="select-email-trigger">
                    <SelectValue placeholder="Select an email account" />
                  </SelectTrigger>
                  <SelectContent>
                    {outlookUsers.map((u) => (
                      <SelectItem key={u.id} value={u.mail || u.userPrincipalName} data-testid={`select-email-option-${u.id}`}>
                        {u.displayName} ({u.mail || u.userPrincipalName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input
                    id="email-input"
                    type="email"
                    placeholder="Enter email address manually"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    data-testid="input-email-manual"
                  />
                  <p className="text-xs text-muted-foreground">
                    Could not fetch users from Outlook. Enter email manually.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)} data-testid="button-cancel-settings">
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} data-testid="button-save-settings">
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
