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
  AlertTriangle,
  Zap,
  CheckCircle,
  Link,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Meh,
  Clock,
  Image,
  Reply,
  X,
  LinkIcon,
  ChevronLeft,
  ChevronRight,
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
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [emailAnalysis, setEmailAnalysis] = useState<EmailAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [linkedClientId, setLinkedClientId] = useState<string>("");
  const [linkedJobId, setLinkedJobId] = useState<string>("");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const { data: currentUser, isLoading: loadingCurrentUser } = useQuery<{ email: string; displayName: string }>({
    queryKey: ["/api/outlook/me"],
    queryFn: async () => {
      const res = await fetch("/api/outlook/me");
      if (!res.ok) throw new Error("Failed to get current user");
      return res.json();
    },
    retry: false,
  });

  const hasInitialized = useState(false);
  
  useEffect(() => {
    if (hasInitialized[0]) return;
    
    const savedEmail = localStorage.getItem("outlook_default_email");
    if (savedEmail) {
      setUserEmail(savedEmail);
      hasInitialized[1](true);
      return;
    }
    if (currentUser?.email) {
      setUserEmail(currentUser.email);
      hasInitialized[1](true);
    }
  }, [currentUser]);

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
    queryKey: ["/api/outlook/emails", userEmail, selectedEmail?.id, "detail"],
    queryFn: async () => {
      if (!userEmail || !selectedEmail) return null;
      const res = await fetch(`/api/outlook/emails/${encodeURIComponent(userEmail)}/${selectedEmail.id}`);
      if (!res.ok) throw new Error("Failed to fetch email details");
      return res.json();
    },
    enabled: !!userEmail && !!selectedEmail,
  });

  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: ["/api/outlook/attachments", userEmail, selectedEmail?.id],
    queryFn: async () => {
      if (!userEmail || !selectedEmail) return [];
      const res = await fetch(`/api/outlook/emails/${encodeURIComponent(userEmail)}/${selectedEmail.id}/attachments`);
      if (!res.ok) throw new Error("Failed to fetch attachments");
      return res.json();
    },
    enabled: !!userEmail && !!selectedEmail && selectedEmail.hasAttachments,
  });

  const { data: jobs = [] } = useQuery<Array<{ id: number; jobNo: string; customerName: string }>>({
    queryKey: ["/api/jobs"],
    enabled: !!selectedEmail,
  });

  const { data: clients = [] } = useQuery<Array<{ id: string; name: string; email: string }>>({
    queryKey: ["/api/clients"],
    enabled: !!selectedEmail,
  });

  const replyMutation = useMutation({
    mutationFn: async ({ messageId, body }: { messageId: string; body: string }) => {
      const res = await apiRequest("POST", `/api/outlook/emails/${encodeURIComponent(userEmail)}/${messageId}/reply`, { body });
      return res.json();
    },
    onSuccess: () => {
      toast.success("Reply sent successfully");
      setReplyText("");
      setComposeDialogOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: () => {
      toast.error("Failed to create job");
    },
  });

  const handleEmailClick = async (email: OutlookEmail) => {
    setSelectedEmail(email);
    setExtractedData(null);
    setEmailAnalysis(null);
    setReplyText("");
    setLinkedClientId("");
    setLinkedJobId("");
    if (!email.isRead) {
      markAsReadMutation.mutate(email.id);
    }
  };

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

  const handleLinkToClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setLinkedClientId(clientId);
      toast.success(`Linked to client: ${client.name}`);
    }
  };

  const handleLinkToJob = (jobId: string) => {
    const job = jobs.find(j => j.id.toString() === jobId);
    if (job) {
      setLinkedJobId(jobId);
      toast.success(`Linked to job: ${job.jobNo}`);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem("outlook_default_email", userEmail);
    setSettingsDialogOpen(false);
    toast.success("Settings saved");
    refetchEmails();
  };

  const handleCreateClient = () => {
    const name = extractedData?.clientName || emailDetail?.from?.emailAddress?.name || "";
    const email = extractedData?.clientEmail || emailDetail?.from?.emailAddress?.address || "";
    
    if (!name) {
      toast.error("Client name is required");
      return;
    }
    
    createClientMutation.mutate({
      name,
      email,
      phone: extractedData?.clientPhone,
      address: extractedData?.clientAddress,
    });
  };

  const handleCreateJob = () => {
    const customerName = extractedData?.clientName || emailDetail?.from?.emailAddress?.name || "Unknown";
    createJobMutation.mutate({
      customerName,
      description: extractedData?.jobDescription || emailDetail?.subject,
      notes: emailDetail?.bodyPreview,
    });
  };

  const handleUseReply = () => {
    if (emailAnalysis?.suggestedReply) {
      setReplyText(emailAnalysis.suggestedReply);
      setComposeDialogOpen(true);
    }
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
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-outlook-inbox-title">
            Outlook Inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            {userEmail || "Configure email account"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchEmails()}
            disabled={loadingEmails || !userEmail}
            data-testid="button-refresh-emails"
          >
            <RefreshCw className={`h-4 w-4 ${loadingEmails ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)} data-testid="button-settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-80 flex flex-col border rounded-lg bg-white dark:bg-slate-900 shadow-sm">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search emails..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-emails"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            {loadingEmails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !userEmail ? (
              <div className="text-center py-12 text-muted-foreground px-4">
                <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No email configured</p>
              </div>
            ) : displayEmails.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground px-4">
                <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{searchQuery ? "No results" : "No emails"}</p>
              </div>
            ) : (
              displayEmails.map((email) => (
                <div
                  key={email.id}
                  className={`p-3 cursor-pointer border-b transition-colors ${
                    selectedEmail?.id === email.id 
                      ? "bg-blue-50 dark:bg-blue-950/30 border-l-2 border-l-blue-500" 
                      : "hover:bg-muted/50"
                  } ${!email.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                  onClick={() => handleEmailClick(email)}
                  data-testid={`email-item-${email.id}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!email.isRead ? "bg-blue-500" : "bg-transparent"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${!email.isRead ? "font-semibold" : "font-medium"}`}>
                          {email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {format(new Date(email.receivedDateTime), "MMM d")}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${!email.isRead ? "font-medium" : "text-muted-foreground"}`}>
                        {email.subject || "(No Subject)"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {email.bodyPreview}
                      </p>
                      {email.hasAttachments && (
                        <Paperclip className="h-3 w-3 text-muted-foreground mt-1" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex gap-4 min-w-0">
          <div className="flex-1 border rounded-lg bg-white dark:bg-slate-900 shadow-sm flex flex-col min-w-0">
            {selectedEmail ? (
              <>
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold truncate" data-testid="text-email-subject">
                        {emailDetail?.subject || selectedEmail.subject || "(No Subject)"}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {emailDetail?.from?.emailAddress?.name || selectedEmail.from?.emailAddress?.name}
                        </span>
                        <span>&lt;{emailDetail?.from?.emailAddress?.address || selectedEmail.from?.emailAddress?.address}&gt;</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {emailDetail?.receivedDateTime && format(new Date(emailDetail.receivedDateTime), "MMMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEmail(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {emailDetail?.body?.content && (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {emailDetail.body.contentType === "html" ? (
                            <div
                              dangerouslySetInnerHTML={{ __html: emailDetail.body.content }}
                              className="overflow-x-auto"
                              data-testid="email-body-content"
                            />
                          ) : (
                            <pre className="whitespace-pre-wrap font-sans" data-testid="email-body-content">
                              {emailDetail.body.content}
                            </pre>
                          )}
                        </div>
                      )}

                      {attachments.length > 0 && (
                        <div className="pt-4 border-t">
                          <Label className="text-xs text-muted-foreground mb-2 block">
                            Attachments ({attachments.length})
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {attachments.map((att) => (
                              <div key={att.id} className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded text-sm">
                                {att.contentType?.startsWith('image/') ? (
                                  <Image className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <FileText className="h-4 w-4" />
                                )}
                                <span>{att.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({Math.round(att.size / 1024)}KB)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {emailAnalysis && (
                        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Zap className="h-4 w-4 text-blue-500" />
                              AI Analysis
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
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
                            <p className="text-sm">{emailAnalysis.summary}</p>
                            {(emailAnalysis.matchedClientId || emailAnalysis.matchedJobId) && (
                              <div className="flex gap-2">
                                {emailAnalysis.matchedClientId && (
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Link className="h-3 w-3" />
                                    Linked to Client
                                  </Badge>
                                )}
                                {emailAnalysis.matchedJobId && (
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Link className="h-3 w-3" />
                                    Linked to Job
                                  </Badge>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select an email to view</p>
                </div>
              </div>
            )}
          </div>

          {selectedEmail && (
            <div className={`${sidebarExpanded ? 'w-72' : 'w-12'} border rounded-lg bg-white dark:bg-slate-900 shadow-sm flex flex-col transition-all duration-200`}>
              <div className="p-3 border-b bg-blue-600 text-white rounded-t-lg flex items-center justify-between">
                {sidebarExpanded && <h3 className="font-semibold text-sm">Quick Actions</h3>}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:bg-blue-500"
                  onClick={() => setSidebarExpanded(!sidebarExpanded)}
                  data-testid="button-toggle-sidebar"
                >
                  {sidebarExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </div>
              
              {sidebarExpanded ? (
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={handleAnalyzeEmail}
                    disabled={isAnalyzing}
                    data-testid="button-analyze-ai"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2 text-blue-500" />
                    )}
                    AI Analyze
                  </Button>

                  <Separator className="my-3" />

                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={handleCreateClient}
                    disabled={createClientMutation.isPending}
                    data-testid="button-create-client"
                  >
                    <UserPlus className="h-4 w-4 mr-2 text-green-600" />
                    Create Contact
                  </Button>

                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={handleCreateJob}
                    disabled={createJobMutation.isPending}
                    data-testid="button-create-job"
                  >
                    <Briefcase className="h-4 w-4 mr-2 text-purple-600" />
                    Create Job
                  </Button>

                  {clients.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" />
                        Link to Client
                      </Label>
                      <Select value={linkedClientId} onValueChange={handleLinkToClient}>
                        <SelectTrigger className="w-full" data-testid="select-link-client">
                          <SelectValue placeholder="Select client..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.slice(0, 10).map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {linkedClientId && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                          Linked
                        </Badge>
                      )}
                    </div>
                  )}

                  {jobs.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" />
                        Link to Job
                      </Label>
                      <Select value={linkedJobId} onValueChange={handleLinkToJob}>
                        <SelectTrigger className="w-full" data-testid="select-link-job">
                          <SelectValue placeholder="Select job..." />
                        </SelectTrigger>
                        <SelectContent>
                          {jobs.slice(0, 10).map((job) => (
                            <SelectItem key={job.id} value={job.id.toString()}>
                              {job.jobNo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {linkedJobId && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                          Linked
                        </Badge>
                      )}
                    </div>
                  )}

                  <Separator className="my-3" />

                  {emailAnalysis?.suggestedReply && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Suggested Reply</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={handleAnalyzeEmail}
                          disabled={isAnalyzing}
                          title="Get a different reply"
                          data-testid="button-retry-reply"
                        >
                          <RefreshCw className={`h-3 w-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                      <p className="text-xs bg-muted p-2 rounded italic">
                        {emailAnalysis.suggestedReply.substring(0, 150)}...
                      </p>
                      <Button
                        className="w-full"
                        onClick={handleUseReply}
                        data-testid="button-use-reply"
                      >
                        <Reply className="h-4 w-4 mr-2" />
                        Use This Reply
                      </Button>
                    </div>
                  )}

                  {!emailAnalysis?.suggestedReply && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        setReplyText("");
                        setComposeDialogOpen(true);
                      }}
                    >
                      <Reply className="h-4 w-4 mr-2" />
                      Reply
                    </Button>
                  )}

                  {extractedData && Object.values(extractedData).some(v => v) && (
                    <>
                      <Separator className="my-3" />
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Extracted Data
                        </Label>
                        <div className="text-xs space-y-1 bg-muted p-2 rounded">
                          {extractedData.clientName && (
                            <p><span className="font-medium">Name:</span> {extractedData.clientName}</p>
                          )}
                          {extractedData.clientEmail && (
                            <p><span className="font-medium">Email:</span> {extractedData.clientEmail}</p>
                          )}
                          {extractedData.clientPhone && (
                            <p><span className="font-medium">Phone:</span> {extractedData.clientPhone}</p>
                          )}
                          {extractedData.jobDescription && (
                            <p><span className="font-medium">Job:</span> {extractedData.jobDescription}</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
              ) : (
                <div className="flex-1 flex flex-col items-center py-4 gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={handleAnalyzeEmail}
                    disabled={isAnalyzing}
                    title="AI Analyze"
                  >
                    {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-blue-500" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={handleCreateClient}
                    title="Create Contact"
                  >
                    <UserPlus className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={handleCreateJob}
                    title="Create Job"
                  >
                    <Briefcase className="h-4 w-4 text-purple-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setReplyText("");
                      setComposeDialogOpen(true);
                    }}
                    title="Reply"
                  >
                    <Reply className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={composeDialogOpen} onOpenChange={setComposeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="h-5 w-5" />
              Reply to: {selectedEmail?.from?.emailAddress?.name}
            </DialogTitle>
            <DialogDescription>
              Re: {selectedEmail?.subject}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={8}
              data-testid="textarea-reply"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeDialogOpen(false)}>
              Cancel
            </Button>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Settings</DialogTitle>
            <DialogDescription>
              Configure your Outlook integration settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-input">Email Address</Label>
              <Input
                id="email-input"
                type="email"
                placeholder="Enter email address (e.g. info@promainsolutions.co.uk)"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                data-testid="input-email-address"
              />
              {currentUser && (
                <p className="text-xs text-muted-foreground">
                  Currently connected: {currentUser.displayName} ({currentUser.email})
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter the email address you want to use for reading and sending emails.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveSettings}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
