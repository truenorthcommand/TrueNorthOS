import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { apiRequest } from "@/lib/queryClient";
import { FolderOpen, Upload, FileText, Image, FileSpreadsheet, File, Search, Grid, List, Trash2, Link2, ExternalLink, X, Loader2, Sparkles, Check, QrCode } from "lucide-react";
import { Scanner } from "@/components/scanner";
import { parseTrueNorthCode } from "@/lib/qr-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FileWithRelations, Client, Job, Expense } from "@shared/schema";

interface AiSuggestion {
  suggestedClientId: string | null;
  suggestedClientName?: string | null;
  suggestedJobId: string | null;
  suggestedJobNo?: string | null;
  suggestedCategory: string | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-8 w-8 text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <Image className="h-8 w-8 text-blue-500" />;
  if (mimeType.includes("pdf")) return <FileText className="h-8 w-8 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) 
    return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
  return <FileText className="h-8 w-8 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Files() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "client" | "job" | "expense" | "unassigned">("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileWithRelations | null>(null);
  
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadedObjectPath, setUploadedObjectPath] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [newFileData, setNewFileData] = useState({
    clientId: "",
    jobId: "",
    expenseId: "",
    category: "",
    notes: "",
  });
  const [scanDialogOpen, setScanDialogOpen] = useState(false);

  const handleScanSuccess = (code: string) => {
    const parsed = parseTrueNorthCode(code);
    if (parsed) {
      if (parsed.type === 'job') {
        const matchedJob = jobs.find(j => j.id === parsed.id);
        if (matchedJob) {
          setNewFileData(prev => ({ ...prev, jobId: parsed.id }));
          toast({ title: "Job Scanned", description: `Ready to attach file to Job ${matchedJob.jobNo}` });
        } else {
          toast({ title: "Job Not Found", description: "The scanned job ID was not found", variant: "destructive" });
        }
      } else if (parsed.type === 'client') {
        const matchedClient = clients.find(c => c.id === parsed.id);
        if (matchedClient) {
          setNewFileData(prev => ({ ...prev, clientId: parsed.id }));
          toast({ title: "Client Scanned", description: `Ready to attach file to ${matchedClient.name}` });
        } else {
          toast({ title: "Client Not Found", description: "The scanned client ID was not found", variant: "destructive" });
        }
      } else if (parsed.type === 'asset') {
        toast({ title: "Asset Scanned", description: `Asset ID: ${parsed.id}. Select a job or client to attach the file.` });
      }
      setScanDialogOpen(false);
      setUploadDialogOpen(true);
    } else {
      toast({ title: "Unknown Code", description: `Scanned: ${code}`, variant: "default" });
      setScanDialogOpen(false);
    }
  };

  const { data: files = [], isLoading } = useQuery<FileWithRelations[]>({
    queryKey: ["/api/files"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: async (response) => {
      setUploadedObjectPath(response.objectPath);
      
      setIsAnalyzing(true);
      try {
        const analysisRes = await apiRequest("POST", "/api/files/analyze", {
          objectPath: response.objectPath,
          fileName: uploadingFile?.name,
          mimeType: uploadingFile?.type,
        });
        const suggestion = await analysisRes.json();
        setAiSuggestion(suggestion);
        
        if (suggestion.suggestedClientId && !newFileData.clientId) {
          setNewFileData(prev => ({ ...prev, clientId: suggestion.suggestedClientId }));
        }
        if (suggestion.suggestedJobId && !newFileData.jobId) {
          setNewFileData(prev => ({ ...prev, jobId: suggestion.suggestedJobId }));
        }
        if (suggestion.suggestedCategory && !newFileData.category) {
          setNewFileData(prev => ({ ...prev, category: suggestion.suggestedCategory }));
        }
      } catch (error) {
        console.error("AI analysis failed:", error);
      } finally {
        setIsAnalyzing(false);
      }
    },
    onError: (error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const createFileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/files", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "File uploaded successfully" });
      setUploadDialogOpen(false);
      setUploadingFile(null);
      setUploadedObjectPath(null);
      setAiSuggestion(null);
      setNewFileData({ clientId: "", jobId: "", expenseId: "", category: "", notes: "" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to save file", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveUploadedFile = async () => {
    if (!uploadedObjectPath || !uploadingFile) return;
    await createFileMutation.mutateAsync({
      name: uploadingFile.name || "Uploaded file",
      objectPath: uploadedObjectPath,
      mimeType: uploadingFile.type || null,
      size: uploadingFile.size || null,
      clientId: newFileData.clientId || null,
      jobId: newFileData.jobId || null,
      expenseId: newFileData.expenseId || null,
      category: newFileData.category || null,
      notes: newFileData.notes || null,
    });
  };

  const updateFileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/files/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "File updated successfully" });
      setAssignDialogOpen(false);
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update file", description: error.message, variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "File deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete file", description: error.message, variant: "destructive" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingFile(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadingFile) return;
    await uploadFile(uploadingFile);
  };

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesFilter = true;
    
    switch (filterType) {
      case "client":
        matchesFilter = !!file.clientId;
        break;
      case "job":
        matchesFilter = !!file.jobId;
        break;
      case "expense":
        matchesFilter = !!file.expenseId;
        break;
      case "unassigned":
        matchesFilter = !file.clientId && !file.jobId && !file.expenseId;
        break;
    }
    
    return matchesSearch && matchesFilter;
  });

  const openAssignDialog = (file: FileWithRelations) => {
    setSelectedFile(file);
    setNewFileData({
      clientId: file.clientId || "",
      jobId: file.jobId || "",
      expenseId: file.expenseId || "",
      category: file.category || "",
      notes: file.notes || "",
    });
    setAssignDialogOpen(true);
  };

  const handleSaveAssignment = () => {
    if (!selectedFile) return;
    updateFileMutation.mutate({
      id: selectedFile.id,
      data: {
        clientId: newFileData.clientId || null,
        jobId: newFileData.jobId || null,
        expenseId: newFileData.expenseId || null,
        category: newFileData.category || null,
        notes: newFileData.notes || null,
      },
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="files-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Files</h1>
          <p className="text-muted-foreground">Manage uploaded documents and files</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScanDialogOpen(true)} data-testid="button-scan-to-attach">
            <QrCode className="mr-2 h-4 w-4" />
            Scan to Attach
          </Button>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-file">
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload File</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select File</Label>
                <Input 
                  type="file" 
                  onChange={handleFileSelect}
                  disabled={!!uploadedObjectPath}
                  data-testid="input-file-upload"
                />
                {uploadingFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {uploadingFile.name} ({formatFileSize(uploadingFile.size)})
                  </p>
                )}
              </div>

              {isAnalyzing && (
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI is analyzing your file to suggest assignment...
                  </AlertDescription>
                </Alert>
              )}

              {aiSuggestion && !isAnalyzing && (
                <div className="rounded-lg border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                      <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100">AI Analysis Results</h4>
                      <p className="text-xs text-blue-600 dark:text-blue-400 capitalize">{aiSuggestion.confidence} confidence</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-blue-800 dark:text-blue-200 bg-white/50 dark:bg-black/20 rounded p-2">
                    {aiSuggestion.reasoning}
                  </p>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">Suggested Actions</p>
                    <div className="flex flex-wrap gap-2">
                      {aiSuggestion.suggestedClientId && aiSuggestion.suggestedClientName && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="bg-card border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                          onClick={() => setNewFileData({ ...newFileData, clientId: aiSuggestion.suggestedClientId || "" })}
                          data-testid="button-apply-client"
                        >
                          <Check className="h-3 w-3 mr-1 text-green-600" />
                          Assign to {aiSuggestion.suggestedClientName}
                        </Button>
                      )}
                      {aiSuggestion.suggestedJobId && aiSuggestion.suggestedJobNo && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="bg-card border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                          onClick={() => setNewFileData({ ...newFileData, jobId: aiSuggestion.suggestedJobId || "" })}
                          data-testid="button-apply-job"
                        >
                          <Check className="h-3 w-3 mr-1 text-green-600" />
                          Assign to Job {aiSuggestion.suggestedJobNo}
                        </Button>
                      )}
                      {aiSuggestion.suggestedCategory && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="bg-card border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 capitalize"
                          onClick={() => setNewFileData({ ...newFileData, category: aiSuggestion.suggestedCategory || "" })}
                          data-testid="button-apply-category"
                        >
                          <Check className="h-3 w-3 mr-1 text-green-600" />
                          Set as {aiSuggestion.suggestedCategory}
                        </Button>
                      )}
                      {(aiSuggestion.suggestedClientId || aiSuggestion.suggestedJobId || aiSuggestion.suggestedCategory) && (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => setNewFileData({
                            ...newFileData,
                            clientId: aiSuggestion.suggestedClientId || newFileData.clientId,
                            jobId: aiSuggestion.suggestedJobId || newFileData.jobId,
                            category: aiSuggestion.suggestedCategory || newFileData.category
                          })}
                          data-testid="button-apply-all"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Apply All Suggestions
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <Label>Assign to Client (Optional)</Label>
                <Select value={newFileData.clientId || "none"} onValueChange={(v) => setNewFileData({ ...newFileData, clientId: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Assign to Job (Optional)</Label>
                <Select value={newFileData.jobId || "none"} onValueChange={(v) => setNewFileData({ ...newFileData, jobId: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="select-job">
                    <SelectValue placeholder="Select job..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>{job.jobNo} - {job.customerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Category</Label>
                <Select value={newFileData.category || "none"} onValueChange={(v) => setNewFileData({ ...newFileData, category: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="certificate">Certificate</SelectItem>
                    <SelectItem value="warranty">Warranty</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Notes</Label>
                <Textarea 
                  value={newFileData.notes}
                  onChange={(e) => setNewFileData({ ...newFileData, notes: e.target.value })}
                  placeholder="Add notes..."
                  data-testid="input-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setUploadDialogOpen(false);
                setUploadingFile(null);
                setUploadedObjectPath(null);
                setAiSuggestion(null);
                setNewFileData({ clientId: "", jobId: "", expenseId: "", category: "", notes: "" });
              }}>Cancel</Button>
              {!uploadedObjectPath ? (
                <Button 
                  onClick={handleUpload} 
                  disabled={!uploadingFile || isUploading}
                  data-testid="button-confirm-upload"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading {progress}%
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload & Analyze
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={handleSaveUploadedFile}
                  disabled={isAnalyzing || createFileMutation.isPending}
                  data-testid="button-save-file"
                >
                  {createFileMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Save File
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>

        <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Scan QR/Barcode</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Scan a job or client QR code to pre-select the assignment for your file upload.
            </p>
            <Scanner 
              onScanSuccess={handleScanSuccess}
              onScanError={(error) => toast({ title: "Scan Error", description: error, variant: "destructive" })}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-files"
              />
            </div>
            
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-48" data-testid="select-filter-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Files</SelectItem>
                <SelectItem value="client">Client Files</SelectItem>
                <SelectItem value="job">Job Files</SelectItem>
                <SelectItem value="expense">Expense Files</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex gap-1">
              <Button 
                variant={viewMode === "grid" ? "default" : "outline"} 
                size="icon"
                onClick={() => setViewMode("grid")}
                data-testid="button-view-grid"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === "list" ? "default" : "outline"} 
                size="icon"
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No files found</h3>
              <p className="text-muted-foreground">Upload your first file to get started</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredFiles.map((file) => (
                <Card 
                  key={file.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openAssignDialog(file)}
                  data-testid={`file-card-${file.id}`}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    {file.mimeType?.startsWith("image/") ? (
                      <img 
                        src={file.objectPath} 
                        alt={file.name}
                        className="h-16 w-16 object-cover rounded mb-2"
                      />
                    ) : (
                      <div className="mb-2">
                        {getFileIcon(file.mimeType)}
                      </div>
                    )}
                    <p className="font-medium text-sm truncate w-full">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {file.client && (
                        <Badge variant="outline" className="text-xs">
                          {file.client.name}
                        </Badge>
                      )}
                      {file.job && (
                        <Badge variant="secondary" className="text-xs">
                          {file.job.jobNo}
                        </Badge>
                      )}
                      {file.category && (
                        <Badge className="text-xs">
                          {file.category}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent cursor-pointer"
                  onClick={() => openAssignDialog(file)}
                  data-testid={`file-row-${file.id}`}
                >
                  {getFileIcon(file.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)} • Uploaded {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {file.client && (
                      <Badge variant="outline">{file.client.name}</Badge>
                    )}
                    {file.job && (
                      <Badge variant="secondary">{file.job.jobNo}</Badge>
                    )}
                    {file.category && (
                      <Badge>{file.category}</Badge>
                    )}
                  </div>
                  <a 
                    href={file.objectPath} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`button-download-${file.id}`}
                  >
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit File Assignment</DialogTitle>
          </DialogHeader>
          {selectedFile && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                {getFileIcon(selectedFile.mimeType)}
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>

              <div>
                <Label>Assign to Client</Label>
                <Select value={newFileData.clientId || "none"} onValueChange={(v) => setNewFileData({ ...newFileData, clientId: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Assign to Job</Label>
                <Select value={newFileData.jobId || "none"} onValueChange={(v) => setNewFileData({ ...newFileData, jobId: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>{job.jobNo} - {job.customerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Category</Label>
                <Select value={newFileData.category || "none"} onValueChange={(v) => setNewFileData({ ...newFileData, category: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="certificate">Certificate</SelectItem>
                    <SelectItem value="warranty">Warranty</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Notes</Label>
                <Textarea 
                  value={newFileData.notes}
                  onChange={(e) => setNewFileData({ ...newFileData, notes: e.target.value })}
                  placeholder="Add notes..."
                />
              </div>

              <div className="flex gap-2">
                <a 
                  href={selectedFile.objectPath} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open File
                  </Button>
                </a>
                <Button 
                  variant="destructive" 
                  size="icon"
                  onClick={() => {
                    if (confirm("Delete this file?")) {
                      deleteFileMutation.mutate(selectedFile.id);
                      setAssignDialogOpen(false);
                    }
                  }}
                  data-testid="button-delete-file"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAssignment} data-testid="button-save-assignment">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
