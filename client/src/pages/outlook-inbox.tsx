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

  const { data: outlookUsers = [], isLoading: loadingUsers } = useQuery<OutlookUser[]>({
    queryKey: ["/api/outlook/users"],
    retry: false,
  });

  useEffect(() => {
    if (outlookUsers.length > 0 && !userEmail) {
      const savedEmail = localStorage.getItem("outlook_default_email");
      if (savedEmail && outlookUsers.some(u => u.mail === savedEmail || u.userPrincipalName === savedEmail)) {
        setUserEmail(savedEmail);
      } else {
        const firstEmail = outlookUsers[0].mail || outlookUsers[0].userPrincipalName;
        setUserEmail(firstEmail);
      }
    }
  }, [outlookUsers, userEmail]);

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
    setReplyText("");
    if (!email.isRead) {
      markAsReadMutation.mutate(email.id);
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
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((att) => (
                          <Badge key={att.id} variant="outline" className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {att.name}
                            <span className="text-xs text-muted-foreground">
                              ({Math.round(att.size / 1024)}KB)
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex gap-2 flex-wrap">
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
                      Extract with AI
                    </Button>
                  </div>

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

                  <div className="space-y-2">
                    <Label>Reply</Label>
                    <Textarea
                      placeholder="Type your reply..."
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
