import { useEffect, useRef, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AITextarea } from "@/components/ui/ai-assist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Save, Printer, Trash2, Plus, 
  MapPin, Phone, Mail, Calendar, Upload, X, FileCheck,
  AlertCircle, AlertTriangle, AlertOctagon, Users, ChevronDown, ClipboardList,
  Sparkles, Loader2, Briefcase, User, Navigation, FileText,
  File, Image, FileSpreadsheet, ExternalLink, FolderOpen, QrCode,
  Edit, CheckCircle2
} from "lucide-react";
import QRCode from "qrcode";
import { generateTrueNorthCode, parseTrueNorthCode } from "@/lib/qr-utils";
import { Scanner } from "@/components/scanner";
import { useUpload } from "@/hooks/use-upload";
import { apiRequest } from "@/lib/queryClient";
import type { FileWithRelations } from "@shared/schema";
import { JobChecklist } from "@/components/job-checklist";

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5 text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <Image className="h-5 w-5 text-blue-500" />;
  if (mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) 
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActionPriority, JobUpdate, Photo, hasRole } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

const AdminOverrideSection: React.FC<{ onConfirm: (reason: string) => void }> = ({ onConfirm }) => {
  const [reason, setReason] = useState("");

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <label className="text-xs text-muted-foreground">
        Admin override (logged for review)
      </label>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why are you overriding the Quality Gate?"
        className="min-w-[260px]"
        data-testid="input-override-reason"
      />
      <Button
        variant="destructive"
        size="sm"
        disabled={!reason.trim()}
        onClick={() => onConfirm(reason.trim())}
        data-testid="button-override-complete"
      >
        Override and complete anyway
      </Button>
    </div>
  );
};

export default function JobDetail() {
  const { user } = useAuth();
  const [match, params] = useRoute("/jobs/:id");
  const [, setLocation] = useLocation();
  const { getJob, updateJob, addMaterial, removeMaterial, addPhoto, removePhoto, deleteJob, jobs, refreshJobs, isLoading } = useStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const [actionDescription, setActionDescription] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<ActionPriority>("medium");
  const [engineers, setEngineers] = useState<{id: string; name: string}[]>([]);
  const [jobNotFoundAfterRefresh, setJobNotFoundAfterRefresh] = useState(false);
  
  // Daily updates state
  const [dailyUpdatesOpen, setDailyUpdatesOpen] = useState(true);
  const [todayUpdates, setTodayUpdates] = useState<{ count: number; remaining: number; updates: JobUpdate[] }>({ count: 0, remaining: 2, updates: [] });
  const [allUpdates, setAllUpdates] = useState<JobUpdate[]>([]);
  const [updateNotes, setUpdateNotes] = useState("");
  const [updatePhotos, setUpdatePhotos] = useState<Photo[]>([]);
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  const updateFileInputRef = useRef<HTMLInputElement>(null);
  
  // AI Engineer Suggestion state
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{
    engineerId: string;
    engineerName: string;
    score: number;
    reason: string;
    matchedSkills?: string[];
    skills: string[];
    nextAvailability?: string;
    isAvailableToday?: boolean;
  }>>([]);
  const [suggestionsAiPowered, setSuggestionsAiPowered] = useState(false);
  
  // Report generation state
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  
  // QR Code dialog state
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  
  // Scan dialog state
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanResult, setScanResult] = useState<{ code: string; parsed: { type: string; id: string } | null } | null>(null);

  // Quality Gate state
  const [qualityError, setQualityError] = useState<any | null>(null);

  const handleJobScanSuccess = (code: string) => {
    const parsed = parseTrueNorthCode(code);
    setScanResult({ code, parsed });
    
    if (parsed) {
      if (parsed.type === 'asset') {
        toast({ title: "Asset Scanned", description: `Asset ID: ${parsed.id}` });
      } else if (parsed.type === 'job') {
        if (parsed.id === jobId) {
          toast({ title: "Current Job", description: "This is the current job you're viewing" });
        } else {
          toast({ title: "Different Job", description: `Scanned job ID: ${parsed.id}` });
        }
      } else if (parsed.type === 'client') {
        toast({ title: "Client Scanned", description: `Client ID: ${parsed.id}` });
      }
    } else {
      toast({ title: "Code Scanned", description: code });
    }
  };

  const handleLogToJob = async (code: string, parsed: { type: string; id: string } | null) => {
    if (!job) return;
    const logEntry = parsed 
      ? `[${parsed.type.toUpperCase()}] ${parsed.id} - Scanned ${new Date().toLocaleString()}`
      : `[BARCODE] ${code} - Scanned ${new Date().toLocaleString()}`;
    
    const updatedNotes = job.notes ? `${job.notes}\n${logEntry}` : logEntry;
    await updateJob(job.id, { notes: updatedNotes });
    
    toast({ 
      title: "Logged to Job", 
      description: parsed ? `${parsed.type} logged to job notes` : "Barcode logged to job notes" 
    });
    closeScanDialog();
  };

  const handleCreateAsset = () => {
    toast({ 
      title: "Coming Soon", 
      description: "Asset creation feature will be available soon.",
      variant: "default"
    });
  };

  const closeScanDialog = () => {
    setScanDialogOpen(false);
    setScanResult(null);
  };
  
  // View mode state - admins default to admin view, engineers to engineer view
  const [viewMode, setViewMode] = useState<'admin' | 'engineer'>('admin');
  
  const [formData, setFormData] = useState<{
    client: string;
    customerName: string;
    propertyName: string;
    address: string;
    postcode: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    date: string;
    session: string;
    description: string;
    worksCompleted: string;
    notes: string;
  }>({
    client: "",
    customerName: "",
    propertyName: "",
    address: "",
    postcode: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    date: "",
    session: "AM",
    description: "",
    worksCompleted: "",
    notes: "",
  });
  const [formInitialized, setFormInitialized] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState<string[]>([]);

  // Files state
  const queryClient = useQueryClient();
  const jobFilesInputRef = useRef<HTMLInputElement>(null);
  const [uploadingJobFile, setUploadingJobFile] = useState<File | null>(null);

  useEffect(() => {
    if (hasRole(user, 'admin')) {
      fetch('/api/users', { credentials: 'include' })
        .then(res => res.json())
        .then(data => setEngineers(data.map((u: any) => ({ id: u.id, name: u.name }))))
        .catch(() => {});
    }
  }, [user]);

  // Fetch daily updates for long-running jobs
  const fetchUpdates = async (jobId: string) => {
    try {
      const [todayRes, allRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/updates/today`, { credentials: 'include' }),
        fetch(`/api/jobs/${jobId}/updates`, { credentials: 'include' })
      ]);
      if (todayRes.ok) {
        const todayData = await todayRes.json();
        setTodayUpdates(todayData);
      }
      if (allRes.ok) {
        const allData = await allRes.json();
        setAllUpdates(allData);
      }
    } catch (error) {
      console.error('Failed to fetch updates:', error);
    }
  };

  const jobId = params?.id;
  const job = jobId ? getJob(jobId) : undefined;
  const [hasTriedRefresh, setHasTriedRefresh] = useState(false);

  // Files query and mutations
  const { data: jobFiles = [], isLoading: isLoadingFiles } = useQuery<FileWithRelations[]>({
    queryKey: [`/api/jobs/${jobId}/files`],
    enabled: !!jobId,
  });
  
  // Blocking exceptions query for workflow job gating
  const { data: blockingExceptions = [] } = useQuery<Array<{ id: string; title: string; message?: string | null; severity: string }>>({
    queryKey: [`/api/jobs/${jobId}/blocking-exceptions`],
    enabled: !!jobId,
  });

  const createFileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/files", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/files`] });
      toast({ title: "File uploaded successfully" });
      setUploadingJobFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to save file", description: error.message, variant: "destructive" });
    },
  });

  const completeJobMutation = useMutation({
    mutationFn: async (opts?: { override?: boolean; overrideReason?: string }) => {
      const res = await fetch(`/api/jobs/${jobId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(opts ?? {}),
      });

      if (res.ok) return res.json();

      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw { status: res.status, ...data };
    },
    onSuccess: () => {
      setQualityError(null);
      refreshJobs();
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/blocking-exceptions`] });
      toast({ title: "Job completed", description: "Quality Gate passed — job marked as Completed." });
    },
    onError: (err: any) => {
      if (err.error === "QUALITY_GATE_FAILED" || err.error === "QUALITY_GATE_CAN_OVERRIDE") {
        setQualityError(err);
        return;
      }
      toast({ title: "Cannot complete job", description: err.error || err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const handleCompleteJob = async () => {
    if (uploadingPhotos.length > 0) {
      toast({ 
        title: "Photos Still Uploading", 
        description: "Please wait for all photos to finish uploading before completing the job.",
        variant: "destructive" 
      });
      return;
    }
    if (hasUnsavedChanges) {
      await handleUpdateJob();
    }
    completeJobMutation.mutate({});
  };

  const canOverride = hasRole(user, 'admin');

  const { uploadFile: uploadJobFile, isUploading: isUploadingJobFile, progress: uploadProgress } = useUpload({
    onSuccess: async (response) => {
      await createFileMutation.mutateAsync({
        name: uploadingJobFile?.name || "Uploaded file",
        objectPath: response.objectPath,
        mimeType: uploadingJobFile?.type || null,
        size: uploadingJobFile?.size || null,
        jobId: jobId,
      });
    },
    onError: (error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const handleJobFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingJobFile(file);
      await uploadJobFile(file);
      e.target.value = "";
    }
  };
  
  // Refresh jobs if job not found in cache (may have been created elsewhere)
  useEffect(() => {
    if (jobId && !job && !isLoading && !hasTriedRefresh) {
      setHasTriedRefresh(true);
      refreshJobs();
    }
  }, [jobId, job, isLoading, hasTriedRefresh, refreshJobs]);
  
  // After refresh, check if job is still not found
  useEffect(() => {
    if (hasTriedRefresh && !isLoading && !job) {
      setJobNotFoundAfterRefresh(true);
    }
  }, [hasTriedRefresh, isLoading, job]);
  
  useEffect(() => {
    if (job) {
      setFormData({
        client: job.client || "",
        customerName: job.customerName || "",
        propertyName: job.propertyName || "",
        address: job.address || "",
        postcode: job.postcode || "",
        contactName: job.contactName || "",
        contactPhone: job.contactPhone || "",
        contactEmail: job.contactEmail || "",
        date: job.date ? format(new Date(job.date), "yyyy-MM-dd") : "",
        session: job.session || "AM",
        description: job.description || "",
        worksCompleted: job.worksCompleted || "",
        notes: job.notes || "",
      });
      setFormInitialized(true);
    }
  }, [job?.id]);

  // Fetch updates for long-running jobs
  useEffect(() => {
    if (job?.isLongRunning && job.id) {
      fetchUpdates(job.id);
    }
  }, [job?.id, job?.isLongRunning]);

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  if (!job) {
    // Show loading while trying to refresh/fetch the job
    if (isLoading || (!jobNotFoundAfterRefresh && jobId)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading job...</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold mb-4">Job Not Found</h2>
        <Link href="/">
          <Button>Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleUpdateJob = async () => {
    if (!job) return;
    await updateJob(job.id, {
      client: formData.client,
      customerName: formData.customerName,
      propertyName: formData.propertyName,
      address: formData.address,
      postcode: formData.postcode,
      contactName: formData.contactName,
      contactPhone: formData.contactPhone,
      contactEmail: formData.contactEmail,
      date: formData.date ? new Date(formData.date).toISOString() : undefined,
      session: formData.session,
      description: formData.description,
      worksCompleted: formData.worksCompleted,
      notes: formData.notes,
    });
    setHasUnsavedChanges(false);
    toast({ title: "Job Updated", description: "All changes have been saved." });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, source: 'admin' | 'engineer' = 'engineer') => {
    const file = e.target.files?.[0];
    if (!file || !job) return;
    
    const uploadId = `upload-${Date.now()}`;
    setUploadingPhotos(prev => [...prev, uploadId]);
    
    try {
      // Step 1: Compress image to reduce file size and improve reliability on mobile
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        try {
          const { compressImage, blobToFile, formatFileSize } = await import('@/lib/image-utils');
          const originalSize = file.size;
          const compressedBlob = await compressImage(file, 1920, 1920, 0.8);
          fileToUpload = blobToFile(compressedBlob, file.name);
          console.log(`Image compressed: ${formatFileSize(originalSize)} → ${formatFileSize(fileToUpload.size)}`);
        } catch (compressError) {
          console.warn('Image compression failed, using original:', compressError);
          // Continue with original file if compression fails
        }
      }

      // Step 2: Request upload URL with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          name: fileToUpload.name,
          size: fileToUpload.size,
          contentType: fileToUpload.type || "image/jpeg",
        }),
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload URL request failed: ${response.status} ${errorText}`);
      }
      
      const { uploadURL, objectPath } = await response.json();

      // Step 3: Upload file to storage with timeout
      const uploadController = new AbortController();
      const uploadTimeoutId = setTimeout(() => uploadController.abort(), 60000); // 60s timeout for upload
      
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: fileToUpload,
        headers: { "Content-Type": fileToUpload.type || "image/jpeg" },
        signal: uploadController.signal,
      });
      clearTimeout(uploadTimeoutId);
      
      if (!uploadResponse.ok) {
        throw new Error(`File upload failed: ${uploadResponse.status}`);
      }

      // Step 4: Save photo reference to job
      await addPhoto(job.id, objectPath, source);
      
      toast({ 
        title: "Photo Uploaded", 
        description: source === 'admin' ? "Reference photo saved to storage." : "Evidence photo saved to storage." 
      });
    } catch (error: any) {
      console.error("Photo upload failed:", error);
      
      let errorMessage = "Photo could not be saved. Please try again.";
      
      if (error.name === 'AbortError') {
        errorMessage = "Upload timed out. Please check your connection and try again.";
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({ 
        title: "Upload Failed", 
        description: errorMessage,
        variant: "destructive" 
      });
    } finally {
      setUploadingPhotos(prev => prev.filter(id => id !== uploadId));
    }
    
    e.target.value = "";
  };

  const handleUpdatePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto: Photo = {
          id: `update-photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url: reader.result as string,
          timestamp: new Date().toISOString(),
          source: 'engineer',
        };
        setUpdatePhotos((prev) => [...prev, newPhoto]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveUpdatePhoto = (photoId: string) => {
    setUpdatePhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleSubmitUpdate = async () => {
    if (!job || !updateNotes.trim()) {
      toast({
        title: "Missing Notes",
        description: "Please enter some notes for this update.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmittingUpdate(true);
    try {
      const response = await fetch(`/api/jobs/${job.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          notes: updateNotes,
          photos: updatePhotos,
        }),
      });

      if (response.ok) {
        toast({
          title: "Update Added",
          description: "Daily progress update has been saved."
        });
        setUpdateNotes("");
        setUpdatePhotos([]);
        fetchUpdates(job.id);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to submit update",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit update",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  // Fetch AI engineer suggestions
  const fetchEngineerSuggestions = async () => {
    if (!job) return;
    
    setSuggestDialogOpen(true);
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    setSuggestions([]);
    
    try {
      const response = await fetch(`/api/ai/suggest-engineers/${job.id}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch suggestions');
      }
      
      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setSuggestionsAiPowered(data.aiPowered || false);
    } catch (error) {
      setSuggestionsError(error instanceof Error ? error.message : 'Failed to fetch suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Handle selecting an engineer from suggestions
  const handleSelectSuggestedEngineer = async (engineerId: string) => {
    if (!job) return;
    
    const currentIds = job.assignedToIds || (job.assignedToId ? [job.assignedToId] : []);
    const newIds = currentIds.includes(engineerId) ? currentIds : [...currentIds, engineerId];
    
    await updateJob(job.id, { 
      assignedToIds: newIds,
      assignedToId: newIds[0] || null
    });
    setSuggestDialogOpen(false);
    
    const engineerName = suggestions.find(s => s.engineerId === engineerId)?.engineerName || 'engineer';
    toast({
      title: "Engineer Added",
      description: `${engineerName} has been added to this job.`
    });
  };

  // Generate professional report
  const generateReport = async () => {
    if (!job) return;
    
    setReportDialogOpen(true);
    setReportLoading(true);
    setReportError(null);
    setReport(null);
    
    try {
      const response = await fetch(`/api/jobs/${job.id}/generate-report`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }
      
      const data = await response.json();
      setReport(data);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  // Generate QR code for this job
  const showQrCode = async () => {
    if (!job) return;
    setQrDialogOpen(true);
    try {
      const qrContent = generateTrueNorthCode('job', job.id);
      const dataUrl = await QRCode.toDataURL(qrContent, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  // Print report
  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !report) return;
    
    const photos = report.photos || [];
    const signatures = report.signatures || [];
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Job Report - ${report.job.jobNo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e40af; padding-bottom: 20px; }
          .company-name { font-size: 24px; font-weight: bold; color: #1e40af; }
          .company-info { font-size: 12px; color: #666; margin-top: 5px; }
          .report-title { font-size: 20px; margin-top: 15px; }
          .section { margin: 25px 0; }
          .section-title { font-size: 16px; font-weight: bold; color: #1e40af; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; }
          .row { display: flex; margin: 8px 0; }
          .label { font-weight: 600; width: 140px; color: #555; }
          .value { flex: 1; }
          .summary { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; line-height: 1.6; }
          .ai-badge { display: inline-block; background: #10b981; color: white; font-size: 10px; padding: 2px 8px; border-radius: 10px; margin-left: 10px; }
          .materials-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          .materials-table th, .materials-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .materials-table th { background: #f1f5f9; }
          .photos { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
          .photo { width: 150px; height: 150px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; }
          .signature { max-height: 80px; border: 1px solid #ddd; border-radius: 4px; margin: 5px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${report.company.name}</div>
          <div class="company-info">
            ${report.company.address ? `${report.company.address}<br>` : ''}
            ${report.company.phone ? `Tel: ${report.company.phone} | ` : ''}
            ${report.company.email || ''}
          </div>
          <div class="report-title">Job Completion Report ${report.aiPowered ? '<span class="ai-badge">AI Enhanced</span>' : ''}</div>
        </div>
        
        <div class="section">
          <div class="section-title">Job Details</div>
          <div class="row"><div class="label">Job Number:</div><div class="value">${report.job.jobNo}</div></div>
          <div class="row"><div class="label">Customer:</div><div class="value">${report.job.customerName}</div></div>
          <div class="row"><div class="label">Site Address:</div><div class="value">${report.job.address || 'N/A'}${report.job.postcode ? ', ' + report.job.postcode : ''}</div></div>
          <div class="row"><div class="label">Date:</div><div class="value">${report.job.date ? new Date(report.job.date).toLocaleDateString('en-GB') : 'N/A'}</div></div>
          <div class="row"><div class="label">Status:</div><div class="value">${report.job.status}</div></div>
          ${report.engineers.length > 0 ? `<div class="row"><div class="label">Engineer(s):</div><div class="value">${report.engineers.map((e: any) => e.name).join(', ')}</div></div>` : ''}
        </div>
        
        <div class="section">
          <div class="section-title">Professional Summary</div>
          <div class="summary">${report.professionalSummary.replace(/\n/g, '<br>')}</div>
        </div>
        
        ${report.job.description ? `
        <div class="section">
          <div class="section-title">Work Description</div>
          <p>${report.job.description}</p>
        </div>` : ''}
        
        ${report.job.worksCompleted ? `
        <div class="section">
          <div class="section-title">Works Completed</div>
          <p>${report.job.worksCompleted}</p>
        </div>` : ''}
        
        ${report.materials.length > 0 ? `
        <div class="section">
          <div class="section-title">Materials Used</div>
          <table class="materials-table">
            <tr><th>Qty</th><th>Description</th></tr>
            ${report.materials.map((m: any) => `<tr><td>${m.quantity}</td><td>${m.description}</td></tr>`).join('')}
          </table>
        </div>` : ''}
        
        ${photos.length > 0 ? `
        <div class="section">
          <div class="section-title">Evidence Photos</div>
          <div class="photos">
            ${photos.map((p: any) => `<img src="${p.data || p.url}" class="photo" alt="${p.caption || 'Evidence photo'}">`).join('')}
          </div>
        </div>` : ''}
        
        ${signatures.length > 0 ? `
        <div class="section">
          <div class="section-title">Signatures</div>
          ${signatures.map((s: any) => `
            <div style="margin: 15px 0;">
              <strong>${s.type === 'engineer' ? 'Engineer' : 'Customer'} Signature:</strong>
              <img src="${s.data}" class="signature" alt="${s.type} signature">
            </div>
          `).join('')}
        </div>` : ''}
        
        ${report.signOff ? `
        <div class="section">
          <div class="section-title">Sign-off Details</div>
          <div class="row"><div class="label">Signed off:</div><div class="value">${new Date(report.signOff.timestamp).toLocaleString('en-GB')}</div></div>
          ${report.signOff.address ? `<div class="row"><div class="label">Location:</div><div class="value">${report.signOff.address}</div></div>` : ''}
        </div>` : ''}
        
        <div class="footer">
          Report generated on ${new Date(report.generatedAt).toLocaleString('en-GB')}
          ${report.aiPowered ? ' | AI-enhanced summary' : ''}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Group updates by date for display
  const groupedUpdates = allUpdates.reduce((groups, update) => {
    const date = format(new Date(update.workDate), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(update);
    return groups;
  }, {} as Record<string, JobUpdate[]>);

  const isReadOnly = job.status === "Signed Off";
  const isAdmin = hasRole(user, 'admin');
  const isAdminFieldReadOnly = isReadOnly || !isAdmin;
  
  // Set initial view mode based on user role
  const effectiveViewMode = isAdmin ? viewMode : 'engineer';
  const showAdminView = effectiveViewMode === 'admin' && isAdmin;
  const shouldMaskContactDetails = user?.role === "engineer" && job.status !== "Ready";

  const handleAddAction = () => {
    if (!actionDescription.trim()) {
      toast({
        title: "Empty Description",
        description: "Please enter a description for the action.",
        variant: "destructive"
      });
      return;
    }

    const newAction = {
      id: `action-${Date.now()}`,
      description: actionDescription,
      priority: selectedPriority,
      timestamp: new Date().toISOString()
    };

    updateJob(job.id, {
      furtherActions: [...(job.furtherActions || []), newAction]
    });

    toast({
      title: "Action Added",
      description: `New ${selectedPriority} priority action recorded.`
    });

    setActionDescription("");
    setSelectedPriority("medium");
  };

  const handleRemoveAction = (actionId: string) => {
    updateJob(job.id, {
      furtherActions: (job.furtherActions || []).filter(a => a.id !== actionId)
    });
    toast({
      title: "Action Removed",
      variant: "default"
    });
  };

  const getPriorityColor = (priority: ActionPriority) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300";
      case "high":
        return "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300";
      case "medium":
        return "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300";
      case "low":
        return "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300";
      default:
        return "bg-muted";
    }
  };

  const getPriorityIcon = (priority: ActionPriority) => {
    switch (priority) {
      case "urgent":
        return <AlertOctagon className="w-4 h-4" />;
      case "high":
        return <AlertTriangle className="w-4 h-4" />;
      case "medium":
      case "low":
        return <AlertCircle className="w-4 h-4" />;
    }
  };


  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/jobs">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{job.jobNo}</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={showQrCode}
                className="h-8 w-8"
                title="Show QR Code"
                data-testid="button-show-qr"
              >
                <QrCode className="h-4 w-4" />
              </Button>
              <Badge variant={job.status === "Signed Off" ? "default" : "secondary"}>
                {job.status}
              </Badge>
              {isAdmin && (
                <Badge variant={showAdminView ? "default" : "outline"} className={showAdminView ? "bg-blue-600" : ""}>
                  {showAdminView ? "Admin View" : "Engineer View"}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{job.customerName}{job.propertyName ? ` - ${job.propertyName}` : ''}</p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          {isAdmin && (
            <Button 
              variant={showAdminView ? "default" : "outline"} 
              onClick={() => setViewMode(viewMode === 'admin' ? 'engineer' : 'admin')}
              className="flex-1 sm:flex-none"
              data-testid="button-toggle-view"
            >
              <Users className="mr-2 h-4 w-4" />
              {showAdminView ? "Switch to Engineer View" : "Switch to Admin View"}
            </Button>
          )}
          {!isReadOnly && (
            <Button variant={hasUnsavedChanges ? "default" : "outline"} onClick={handleUpdateJob} className="flex-1 sm:flex-none" data-testid="button-update-job">
              <Save className="mr-2 h-4 w-4" />
              {hasUnsavedChanges ? "Save Changes" : "Update"}
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none">
            <Printer className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>
          <Button 
            variant="outline" 
            onClick={generateReport} 
            className="flex-1 sm:flex-none"
            data-testid="button-generate-report"
          >
            <FileText className="mr-2 h-4 w-4" />
            Report
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setScanDialogOpen(true)} 
            className="flex-1 sm:flex-none"
            data-testid="button-scan-job"
          >
            <QrCode className="mr-2 h-4 w-4" />
            Scan
          </Button>
          
          {job.status !== "Signed Off" && (job.status as string) !== "Completed" && (
            <Button
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700"
              onClick={handleCompleteJob}
              disabled={completeJobMutation.isPending}
              data-testid="button-complete-job"
            >
              {completeJobMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileCheck className="mr-2 h-4 w-4" />
              )}
              Complete Job
            </Button>
          )}

          {job.status !== "Signed Off" && (
            <Link href={`/jobs/${job.id}/sign-off`}>
              <Button 
                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700"
                data-testid="button-sign-off"
              >
                <FileCheck className="mr-2 h-4 w-4" />
                Sign Off
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Job Locked Banner - Show when signed off */}
      {isReadOnly && (
        <Card className="mb-6 border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 no-print" data-testid="card-job-locked">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <FileCheck className="h-5 w-5" />
              <span className="font-medium">Job Signed Off & Locked</span>
              <span className="text-sm text-muted-foreground ml-2">— This job has been completed and signed off. No further edits are allowed.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin View Banner */}
      {showAdminView && !isReadOnly && (
        <Card className="mb-6 border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 no-print">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Briefcase className="h-5 w-5" />
              <span className="font-medium">Admin Job Management</span>
              <span className="text-sm text-muted-foreground ml-2">— Edit job details, assign engineers, and manage customer information.</span>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Job Checklist - Only show in engineer view when job not signed off */}
      {!showAdminView && job.status !== "Signed Off" && (
        <JobChecklist 
          job={{
            id: job.id,
            jobNo: job.jobNo,
            status: job.status,
            description: job.description,
            worksCompleted: job.worksCompleted,
            worksCompletedLocked: job.worksCompletedLocked,
            photos: job.photos,
            signatures: job.signatures,
            signOffLat: job.signOffLat,
            signOffAddress: job.signOffAddress,
          }}
          blockingExceptions={blockingExceptions}
          className="mb-6 no-print"
        />
      )}

      <div className="grid gap-6 print:block">
        {/* Customer & Site Info */}
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="bg-muted print:bg-transparent print:p-0 print:mb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Site & Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6 pt-6 print:pt-0">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client/Service Provider</Label>
                <Input 
                  value={formData.client} 
                  onChange={(e) => handleFieldChange('client', e.target.value)}
                  disabled={isAdminFieldReadOnly}
                  className="print:border-none print:p-0 print:font-semibold"
                  placeholder="Your company name"
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input 
                  value={formData.customerName} 
                  onChange={(e) => handleFieldChange('customerName', e.target.value)}
                  disabled={isAdminFieldReadOnly}
                  className="print:border-none print:p-0 print:font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label>Property / Work Site</Label>
                <Input 
                  value={formData.propertyName} 
                  onChange={(e) => handleFieldChange('propertyName', e.target.value)}
                  disabled={isAdminFieldReadOnly}
                  className="print:border-none print:p-0 print:font-semibold"
                  placeholder="Property or site name"
                />
              </div>
              <div className="space-y-2">
                <Label>Site Address</Label>
                <Textarea 
                  value={formData.address} 
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  disabled={isAdminFieldReadOnly}
                  className="min-h-[80px] print:border-none print:p-0"
                />
              </div>
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input 
                  value={formData.postcode} 
                  onChange={(e) => handleFieldChange('postcode', e.target.value)}
                  disabled={isAdminFieldReadOnly}
                  className="print:border-none print:p-0"
                />
              </div>
              {(formData.address || formData.postcode) && (
                <Button
                  variant="outline"
                  className="w-full print:hidden"
                  onClick={() => {
                    const destination = encodeURIComponent(
                      `${formData.address}${formData.postcode ? ', ' + formData.postcode : ''}, UK`
                    );
                    window.open(`https://maps.google.com/maps?daddr=${destination}`, '_blank');
                  }}
                  data-testid="button-navigate-to-job"
                >
                  <Navigation className="mr-2 h-4 w-4" />
                  Navigate to Job
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Site Contact</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground print:hidden" />
                  <Input 
                    value={formData.contactName} 
                    onChange={(e) => handleFieldChange('contactName', e.target.value)}
                    disabled={isAdminFieldReadOnly}
                    className="pl-9 print:pl-0 print:border-none"
                    placeholder="Contact Name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground print:hidden" />
                  {shouldMaskContactDetails ? (
                    <div className="pl-9 py-2 text-muted-foreground italic" data-testid="text-phone-masked">
                      Contact via office
                    </div>
                  ) : (
                    <Input 
                      value={formData.contactPhone} 
                      onChange={(e) => handleFieldChange('contactPhone', e.target.value)}
                      disabled={isAdminFieldReadOnly}
                      className="pl-9 print:pl-0 print:border-none"
                      placeholder="Phone Number"
                      data-testid="input-contact-phone"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground print:hidden" />
                  {shouldMaskContactDetails ? (
                    <div className="pl-9 py-2 text-muted-foreground italic" data-testid="text-email-masked">
                      Contact via office
                    </div>
                  ) : (
                    <Input 
                      value={formData.contactEmail} 
                      onChange={(e) => handleFieldChange('contactEmail', e.target.value)}
                      disabled={isAdminFieldReadOnly}
                      className="pl-9 print:pl-0 print:border-none"
                      placeholder="Email Address"
                      data-testid="input-contact-email"
                    />
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <div className="space-y-2 flex-1">
                  <Label>Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground print:hidden" />
                    <Input 
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleFieldChange('date', e.target.value)}
                      disabled={isAdminFieldReadOnly}
                      className="pl-9 print:pl-0 print:border-none"
                    />
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Session</Label>
                  <Select 
                    value={formData.session} 
                    onValueChange={(value) => {
                      handleFieldChange('session', value);
                      if (job) updateJob(job.id, { session: value });
                    }}
                    disabled={isAdminFieldReadOnly}
                  >
                    <SelectTrigger className="print:border-none print:p-0">
                      <SelectValue placeholder="Select session..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasRole(user, 'admin') && (
                  <div className="space-y-2 flex-1">
                    <Label>Job Order</Label>
                    <Input 
                      type="number"
                      min="1"
                      max="999"
                      placeholder="Auto"
                      value={job.orderNumber ?? ""}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : null;
                        updateJob(job.id, { orderNumber: value });
                      }}
                      disabled={isReadOnly}
                      className="print:border-none print:p-0"
                      data-testid="input-order-number"
                    />
                    <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
                  </div>
                )}
              </div>
            </div>

            {/* Engineer Assignment (Admin Only) */}
            {hasRole(user, 'admin') && (
              <div className="space-y-2 border-t pt-6 mt-6">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assign to Engineer(s)
                </Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild disabled={isReadOnly}>
                      <Button 
                        variant="outline" 
                        className="flex-1 justify-between font-normal"
                        data-testid="button-assign-engineers"
                      >
                        {(job.assignedToIds && job.assignedToIds.length > 0) 
                          ? `${job.assignedToIds.length} engineer${job.assignedToIds.length > 1 ? 's' : ''} selected`
                          : job.assignedToId 
                            ? "1 engineer selected"
                            : "Select engineers..."
                        }
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {engineers.map((engineer) => {
                          const currentIds = job.assignedToIds || (job.assignedToId ? [job.assignedToId] : []);
                          const isChecked = currentIds.includes(engineer.id);
                          return (
                            <div 
                              key={engineer.id}
                              className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                              onClick={() => {
                                let newIds: string[];
                                if (isChecked) {
                                  newIds = currentIds.filter(id => id !== engineer.id);
                                } else {
                                  newIds = [...currentIds, engineer.id];
                                }
                                updateJob(job.id, { 
                                  assignedToIds: newIds,
                                  assignedToId: newIds[0] || null
                                });
                              }}
                            >
                              <Checkbox 
                                checked={isChecked}
                                data-testid={`checkbox-engineer-${engineer.id}`}
                              />
                              <span className="text-sm">{engineer.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={fetchEngineerSuggestions}
                    disabled={isReadOnly}
                    className="shrink-0"
                    title="AI Suggest Engineer"
                    data-testid="button-suggest-engineer"
                  >
                    <Sparkles className="h-4 w-4 text-amber-500" />
                  </Button>
                </div>
                {((job.assignedToIds && job.assignedToIds.length > 0) || job.assignedToId) && (
                  <p className="text-xs text-muted-foreground">
                    Currently assigned to {
                      (job.assignedToIds && job.assignedToIds.length > 0)
                        ? job.assignedToIds.map(id => engineers.find(e => e.id === id)?.name || "Unknown").join(", ")
                        : engineers.find(e => e.id === job.assignedToId)?.name || "Unknown"
                    }
                  </p>
                )}

                {/* AI Engineer Suggestions Dialog */}
                <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
                  <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        AI Engineer Suggestions
                      </DialogTitle>
                      <DialogDescription>
                        {suggestionsAiPowered 
                          ? "Recommendations based on skills, workload, and job requirements"
                          : "Best matches based on availability and skills"
                        }
                      </DialogDescription>
                    </DialogHeader>

                    {suggestionsLoading && (
                      <div className="flex flex-col items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                        <p className="text-sm text-muted-foreground">Analyzing job requirements...</p>
                      </div>
                    )}

                    {suggestionsError && (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <AlertCircle className="h-8 w-8 text-destructive mb-3" />
                        <p className="text-sm text-destructive font-medium">Failed to get suggestions</p>
                        <p className="text-xs text-muted-foreground mt-1">{suggestionsError}</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-4"
                          onClick={fetchEngineerSuggestions}
                        >
                          Try Again
                        </Button>
                      </div>
                    )}

                    {!suggestionsLoading && !suggestionsError && suggestions.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Users className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">No engineers available for this job</p>
                      </div>
                    )}

                    {!suggestionsLoading && !suggestionsError && suggestions.length > 0 && (
                      <div className="space-y-3">
                        {suggestions.map((suggestion, index) => (
                          <button
                            key={suggestion.engineerId}
                            onClick={() => handleSelectSuggestedEngineer(suggestion.engineerId)}
                            className="w-full text-left p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
                            data-testid={`suggestion-engineer-${suggestion.engineerId}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    {suggestion.engineerName}
                                    <Badge variant="outline" className="text-xs">
                                      Skills Match: {suggestion.score}%
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                    <Calendar className="h-3 w-3" />
                                    {suggestion.isAvailableToday 
                                      ? <span className="text-green-600 font-medium">Available Today</span>
                                      : suggestion.nextAvailability 
                                        ? `Next Available: ${format(new Date(suggestion.nextAvailability), "dd MMM yyyy")}`
                                        : 'Availability unknown'
                                    }
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mt-2 ml-11">
                              {suggestion.reason}
                            </p>

                            {suggestion.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2 ml-11">
                                {suggestion.skills.slice(0, 5).map((skill) => (
                                  <Badge key={skill} variant="secondary" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                                {suggestion.skills.length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{suggestion.skills.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Long-running Job Toggle (Admin Only) */}
            {hasRole(user, 'admin') && (
              <div className="flex items-center justify-between p-4 border rounded-lg mt-6 bg-muted">
                <div className="space-y-0.5">
                  <Label htmlFor="long-running-toggle" className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Long-running Job
                  </Label>
                  <p className="text-sm text-muted-foreground">Enable daily progress updates for multi-day projects</p>
                </div>
                <Switch
                  id="long-running-toggle"
                  checked={job.isLongRunning || false}
                  onCheckedChange={(checked) => updateJob(job.id, { isLongRunning: checked })}
                  disabled={isReadOnly}
                  data-testid="switch-long-running-detail"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Details */}
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="bg-muted print:bg-transparent print:p-0 print:mb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Work Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 print:pt-0">
            <div className="space-y-2">
              <Label>Description of Works</Label>
              <AITextarea 
                value={formData.description} 
                onChange={(e) => handleFieldChange('description', e.target.value)}
                disabled={isAdminFieldReadOnly}
                className="min-h-[120px] text-base print:border-none print:p-0"
                placeholder="Describe the work to be carried out..."
                aiContext="job description for field service work"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Works Completed
                <Badge variant="outline" className="text-xs font-normal">Engineer</Badge>
                {job.worksCompletedLocked && (
                  <Badge variant="default" className="text-xs font-normal bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Locked
                  </Badge>
                )}
              </Label>
              <div className="relative">
                <AITextarea 
                  value={formData.worksCompleted} 
                  onChange={(e) => handleFieldChange('worksCompleted', e.target.value)}
                  disabled={isReadOnly || job.worksCompletedLocked}
                  className={cn(
                    "min-h-[120px] text-base print:border-none print:p-0",
                    job.worksCompletedLocked 
                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
                      : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                  )}
                  placeholder="Describe the work that has been completed..."
                  data-testid="input-works-completed"
                  aiContext="engineer work completed notes and observations"
                />
                {!isReadOnly && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    {!job.worksCompletedLocked ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={async () => {
                          if (!formData.worksCompleted || formData.worksCompleted.trim().length < 10) {
                            toast({
                              title: "Cannot Lock",
                              description: "Works completed must be at least 10 characters.",
                              variant: "destructive"
                            });
                            return;
                          }
                          await updateJob(job.id, {
                            worksCompleted: formData.worksCompleted,
                            worksCompletedLocked: true
                          });
                          toast({
                            title: "Works Completed Locked",
                            description: "This field is now locked and ready for quality gate."
                          });
                        }}
                        title="Save and lock works completed"
                      >
                        <Save className="h-4 w-4 text-green-600" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={async () => {
                          await updateJob(job.id, { worksCompletedLocked: false });
                          toast({
                            title: "Works Completed Unlocked",
                            description: "You can now edit this field."
                          });
                        }}
                        title="Unlock to edit"
                      >
                        <Edit className="h-4 w-4 text-amber-600" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {job.worksCompletedLocked 
                  ? "This field is locked. Click the edit icon to make changes." 
                  : "Enter details of all work completed, then click the save icon to lock it."}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <AITextarea 
                value={formData.notes} 
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                disabled={isReadOnly}
                className="min-h-[80px] print:hidden"
                placeholder="Access codes, parking info, etc."
                aiContext="engineer job notes and observations"
              />
              <div className="hidden print:block text-sm italic text-muted-foreground">
                {job.notes}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Updates - Only for long-running jobs */}
        {job.isLongRunning && (
          <Card className="print:shadow-none print:border-none border-2 border-purple-200 dark:border-purple-900" data-testid="card-daily-updates">
            <Collapsible open={dailyUpdatesOpen} onOpenChange={setDailyUpdatesOpen}>
              <CardHeader className="bg-purple-50 dark:bg-purple-900/20 print:bg-transparent print:p-0 print:mb-4">
                <CollapsibleTrigger asChild>
                  <div className="flex justify-between items-center cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-purple-600" />
                        Daily Updates
                      </CardTitle>
                      <Badge variant="outline" className="ml-2" data-testid="badge-today-updates">
                        {todayUpdates.count} of 2 today
                      </Badge>
                    </div>
                    <ChevronDown className={`h-5 w-5 transition-transform ${dailyUpdatesOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CollapsibleTrigger>
                <p className="text-sm text-muted-foreground mt-1">Track daily progress for this long-running project</p>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-6 print:pt-0 space-y-6">
                  {/* Update Form */}
                  {!isReadOnly && todayUpdates.remaining > 0 && (
                    <div className="space-y-4 p-4 bg-card rounded-lg border" data-testid="form-daily-update">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Add Progress Update</Label>
                        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          {todayUpdates.remaining} remaining today
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Update Notes *</Label>
                        <AITextarea
                          placeholder="Describe today's progress, work completed, issues encountered..."
                          value={updateNotes}
                          onChange={(e) => setUpdateNotes(e.target.value)}
                          className="min-h-[100px]"
                          data-testid="textarea-update-notes"
                          aiContext="engineer daily progress update notes"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Photos (Optional)</Label>
                        <div className="flex flex-wrap gap-3">
                          {updatePhotos.map((photo) => (
                            <div key={photo.id} className="relative group">
                              <img
                                src={photo.url}
                                alt="Update photo"
                                className="h-20 w-20 object-cover rounded-lg border"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveUpdatePhoto(photo.id)}
                                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <label className="h-20 w-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-muted transition-colors">
                            <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground">Add</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={handleUpdatePhotoUpload}
                              ref={updateFileInputRef}
                              data-testid="input-update-photos"
                            />
                          </label>
                        </div>
                      </div>

                      <Button 
                        onClick={handleSubmitUpdate}
                        disabled={isSubmittingUpdate || !updateNotes.trim()}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        data-testid="button-submit-update"
                      >
                        {isSubmittingUpdate ? "Sending Update..." : "Send Update & Notify Admins"}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        Admins will receive a notification when you submit this update
                      </p>
                    </div>
                  )}

                  {!isReadOnly && todayUpdates.remaining === 0 && (
                    <div className="text-center py-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <p className="text-purple-700 dark:text-purple-300 font-medium">Daily update limit reached</p>
                      <p className="text-sm text-muted-foreground mt-1">You've submitted 2 updates today. Check back tomorrow.</p>
                    </div>
                  )}

                  {/* Update History */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Update History</Label>
                    
                    {Object.keys(groupedUpdates).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground bg-muted rounded-lg border border-dashed">
                        <p>No updates recorded yet.</p>
                      </div>
                    ) : (
                      Object.keys(groupedUpdates)
                        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                        .map((dateKey) => (
                          <div key={dateKey} className="space-y-3" data-testid={`update-group-${dateKey}`}>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">{format(new Date(dateKey), 'EEEE, dd MMMM yyyy')}</span>
                            </div>
                            {groupedUpdates[dateKey]
                              .sort((a, b) => a.sequence - b.sequence)
                              .map((update) => (
                                <div 
                                  key={update.id} 
                                  className="p-4 bg-muted rounded-lg border ml-6"
                                  data-testid={`update-item-${update.id}`}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <Badge variant="secondary" className="text-xs">
                                      Update #{update.sequence}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(update.createdAt), 'HH:mm')}
                                    </span>
                                  </div>
                                  {update.notes && (
                                    <p className="text-sm mb-3">{update.notes}</p>
                                  )}
                                  {update.photos && update.photos.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {update.photos.map((photo: Photo) => (
                                        <img
                                          key={photo.id}
                                          src={photo.url}
                                          alt="Update photo"
                                          className="h-16 w-16 object-cover rounded border"
                                        />
                                      ))}
                                    </div>
                                  )}
                                  {update.engineerId && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      By: {engineers.find(e => e.id === update.engineerId)?.name || 'Engineer'}
                                    </p>
                                  )}
                                </div>
                              ))}
                          </div>
                        ))
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Materials */}
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="bg-muted print:bg-transparent print:p-0 print:mb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Materials & Parts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 print:pt-0">
            <div className="space-y-4">
              {(job.materials || []).length > 0 && (
                <div className="border rounded-md overflow-hidden print:border-none">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground print:bg-transparent print:border-b">
                      <tr>
                        <th className="p-3 font-medium">Item Name</th>
                        <th className="p-3 font-medium w-32">Quantity</th>
                        {!isReadOnly && <th className="p-3 w-16 text-center no-print">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y print:divide-y-0">
                      {(job.materials || []).map((item) => (
                        <tr key={item.id}>
                          <td className="p-3">{item.name}</td>
                          <td className="p-3">{item.quantity}</td>
                          {!isReadOnly && (
                            <td className="p-3 text-center no-print">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeMaterial(job.id, item.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!isReadOnly && (
                <div className="flex gap-2 items-end no-print">
                   <form 
                    className="flex gap-2 w-full"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const nameInput = form.elements.namedItem('matName') as HTMLInputElement;
                      const qtyInput = form.elements.namedItem('matQty') as HTMLInputElement;
                      if (nameInput.value && qtyInput.value) {
                        addMaterial(job.id, { name: nameInput.value, quantity: qtyInput.value });
                        form.reset();
                        nameInput.focus();
                      }
                    }}
                   >
                    <div className="grid gap-2 flex-1">
                      <Label className="sr-only">Item Name</Label>
                      <Input name="matName" placeholder="Item Name (e.g., Copper Pipe 15mm)" />
                    </div>
                    <div className="grid gap-2 w-24">
                       <Label className="sr-only">Quantity</Label>
                       <Input name="matQty" placeholder="Qty" />
                    </div>
                    <Button type="submit" variant="secondary">
                      <Plus className="h-4 w-4" />
                    </Button>
                   </form>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Admin Reference Photos */}
        <Card className="print:shadow-none print:border-none border-2 border-blue-200 dark:border-blue-900">
          <CardHeader className="bg-blue-50 dark:bg-blue-900/20 print:bg-transparent print:p-0 print:mb-4">
             <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Reference Photos (Admin)</CardTitle>
              {isAdmin && !isReadOnly && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="no-print"
                  onClick={() => adminFileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Add Reference Photo
                </Button>
              )}
              <input 
                type="file" 
                ref={adminFileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleFileUpload(e, 'admin')}
              />
            </div>
            <p className="text-sm text-muted-foreground">Reference images, instructions, or site photos provided by admin</p>
          </CardHeader>
          <CardContent className="pt-6 print:pt-0">
             {(job.photos || []).filter(p => p.source === 'admin').length === 0 ? (
               <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground bg-blue-50/50">
                 <p>No reference photos added.</p>
               </div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {(job.photos || []).filter(p => p.source === 'admin').map((photo) => (
                   <div key={photo.id} className="relative group aspect-square bg-muted rounded-md overflow-hidden border">
                     <img src={photo.url} alt="Reference photo" className="w-full h-full object-cover" />
                     {isAdmin && !isReadOnly && (
                       <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity no-print"
                        onClick={() => removePhoto(job.id, photo.id)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     )}
                     <div className="absolute bottom-0 left-0 right-0 bg-blue-600/70 text-white text-[10px] p-1 px-2 truncate">
                       {format(new Date(photo.timestamp), "dd/MM/yy HH:mm")}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </CardContent>
        </Card>

        {/* Engineer Evidence Photos */}
        <Card className="print:shadow-none print:border-none border-2 border-emerald-200 dark:border-emerald-900">
          <CardHeader className="bg-emerald-50 dark:bg-emerald-900/20 print:bg-transparent print:p-0 print:mb-4">
             <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Evidence Photos (Engineer)</CardTitle>
              {!isReadOnly && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="no-print"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Add Evidence Photo
                </Button>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleFileUpload(e, 'engineer')}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {uploadingPhotos.length > 0 
                ? `Uploading ${uploadingPhotos.length} photo${uploadingPhotos.length > 1 ? 's' : ''}...` 
                : "Photos taken by engineers as proof of work completed"}
            </p>
          </CardHeader>
          <CardContent className="pt-6 print:pt-0">
             {(job.photos || []).filter(p => !p.source || p.source === 'engineer').length === 0 ? (
               <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground bg-emerald-50/50">
                 <p>No evidence photos uploaded yet.</p>
               </div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {(job.photos || []).filter(p => !p.source || p.source === 'engineer').map((photo) => (
                   <div key={photo.id} className="relative group aspect-square bg-muted rounded-md overflow-hidden border">
                     <img src={photo.url} alt="Evidence photo" className="w-full h-full object-cover" />
                     {!isReadOnly && (
                       <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity no-print"
                        onClick={() => removePhoto(job.id, photo.id)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     )}
                     <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/70 text-white text-[10px] p-1 px-2 truncate">
                       {format(new Date(photo.timestamp), "dd/MM/yy HH:mm")}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </CardContent>
        </Card>

        {/* Job Files Section */}
        <Card className="print:shadow-none print:border-none border-2 border-violet-200 dark:border-violet-900">
          <CardHeader className="bg-violet-50 dark:bg-violet-900/20 print:bg-transparent print:p-0 print:mb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-violet-600" />
                Job Files
              </CardTitle>
              {!isReadOnly && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="no-print"
                  onClick={() => jobFilesInputRef.current?.click()}
                  disabled={isUploadingJobFile}
                  data-testid="button-upload-job-file"
                >
                  {isUploadingJobFile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload File
                    </>
                  )}
                </Button>
              )}
              <input 
                type="file" 
                ref={jobFilesInputRef} 
                className="hidden" 
                onChange={handleJobFileSelect}
                data-testid="input-job-file"
              />
            </div>
            <p className="text-sm text-muted-foreground">Documents, certificates, and other files related to this job</p>
          </CardHeader>
          <CardContent className="pt-6 print:pt-0">
            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobFiles.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground bg-violet-50/50">
                <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No files attached to this job.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobFiles.map((file) => (
                  <div 
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                    data-testid={`file-item-${file.id}`}
                  >
                    {getFileIcon(file.mimeType)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                        {file.createdAt && ` • ${format(new Date(file.createdAt), "dd MMM yyyy")}`}
                      </p>
                    </div>
                    {file.category && (
                      <Badge variant="secondary" className="text-xs">
                        {file.category}
                      </Badge>
                    )}
                    <a 
                      href={file.objectPath} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`button-download-file-${file.id}`}
                    >
                      <Button variant="ghost" size="icon" className="no-print">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signatures Preview (if signed off) */}
        {(job.signatures || []).length > 0 && (
          <Card className="print:shadow-none print:border-none break-inside-avoid">
            <CardHeader className="bg-muted print:bg-transparent print:p-0 print:mb-4">
              <CardTitle className="text-lg">Signatures</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 print:pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {(job.signatures || []).map((sig) => (
                  <div key={sig.id} className="border rounded-md p-4 bg-muted/50 print:border-black print:bg-transparent">
                    <p className="text-sm font-medium mb-2 capitalize text-muted-foreground">{sig.type} Signature</p>
                    <div className="bg-card border-b-2 border-dashed border-border h-24 mb-2 flex items-center justify-center print:bg-transparent print:border-black">
                      <img src={sig.url} alt="Signature" className="max-h-full max-w-full" />
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="font-semibold">{sig.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sig.timestamp), "dd MMM yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sign-off Location (if signed off) */}
        {job.status === "Signed Off" && (job.signOffLat || job.signOffAddress) && (
          <Card className="print:shadow-none print:border-none break-inside-avoid border-2 border-emerald-200 dark:border-emerald-900">
            <CardHeader className="bg-emerald-50 dark:bg-emerald-900/20 print:bg-transparent print:p-0 print:mb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-600" />
                Sign-off Location
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 print:pt-0">
              <div className="space-y-2">
                {job.signOffAddress && (
                  <p className="text-sm">{job.signOffAddress}</p>
                )}
                {job.signOffLat && job.signOffLng && (
                  <p className="text-xs text-muted-foreground">
                    Coordinates: {job.signOffLat.toFixed(6)}, {job.signOffLng.toFixed(6)}
                  </p>
                )}
                {job.signOffTimestamp && (
                  <p className="text-xs text-muted-foreground">
                    Signed off: {format(new Date(job.signOffTimestamp), "dd MMM yyyy HH:mm")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Further Actions / Revisit Section */}
        <Card className="print:shadow-none print:border-none border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10">
          <CardHeader className="bg-blue-100 dark:bg-blue-900/40 print:bg-transparent print:p-0 print:mb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Further Actions / Revisit
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Alert admins of follow-up work or issues requiring attention</p>
          </CardHeader>
          <CardContent className="pt-6 print:pt-0">
            {!isReadOnly && (
              <div className="space-y-4 mb-6 p-4 bg-card rounded-lg border">
                <div className="space-y-2">
                  <Label>Action Description</Label>
                  <AITextarea
                    placeholder="Describe any further actions needed, issues found, or follow-up work required..."
                    value={actionDescription}
                    onChange={(e) => setActionDescription(e.target.value)}
                    className="min-h-[80px]"
                    aiContext="job follow-up action description"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Priority Level</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(['low', 'medium', 'high', 'urgent'] as ActionPriority[]).map((priority) => (
                      <button
                        key={priority}
                        onClick={() => setSelectedPriority(priority)}
                        className={`px-3 py-2 rounded text-sm font-medium capitalize border-2 transition-all ${
                          selectedPriority === priority
                            ? getPriorityColor(priority) + ' border-current'
                            : 'border-border bg-muted text-muted-foreground hover:border-current'
                        }`}
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleAddAction} className="w-full bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Action Alert
                </Button>
              </div>
            )}

            {job.furtherActions && job.furtherActions.length > 0 ? (
              <div className="space-y-3">
                {job.furtherActions.map((action) => (
                  <div
                    key={action.id}
                    className={`p-4 rounded-lg border-l-4 ${getPriorityColor(action.priority)}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        {getPriorityIcon(action.priority)}
                        <div className="flex-1">
                          <p className="font-medium capitalize text-sm">{action.priority} Priority</p>
                          <p className="text-sm mt-1">{action.description}</p>
                        </div>
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleRemoveAction(action.id)}
                          className="text-current hover:opacity-70 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs opacity-75">
                      {format(new Date(action.timestamp), "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-card rounded-lg border border-dashed">
                <p>No further actions recorded.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

       {!isReadOnly && (
         <div className="mt-8 flex justify-center no-print">
            <Button 
              variant="ghost" 
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                if(confirm("Are you sure you want to delete this job?")) {
                  deleteJob(job.id);
                  setLocation("/");
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Job
            </Button>
         </div>
       )}

      {/* Report Generation Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Job Completion Report
              {report?.aiPowered && (
                <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Enhanced
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Professional report generated from job data
            </DialogDescription>
          </DialogHeader>

          {reportLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Generating professional report...</p>
              <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
            </div>
          )}

          {reportError && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive font-medium">Failed to generate report</p>
              <p className="text-xs text-muted-foreground mt-1">{reportError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={generateReport}
              >
                Try Again
              </Button>
            </div>
          )}

          {!reportLoading && !reportError && report && (
            <div className="space-y-6">
              {/* Company & Job Header */}
              <div className="text-center border-b pb-4">
                <h3 className="text-lg font-bold text-primary">{report.company.name}</h3>
                {report.company.address && (
                  <p className="text-xs text-muted-foreground">{report.company.address}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {report.company.phone && `Tel: ${report.company.phone}`}
                  {report.company.phone && report.company.email && ' | '}
                  {report.company.email}
                </p>
              </div>

              {/* Job Details */}
              <div>
                <h4 className="font-semibold text-sm mb-3 text-primary">Job Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Job No:</span> {report.job.jobNo}</div>
                  <div><span className="text-muted-foreground">Status:</span> {report.job.status}</div>
                  <div><span className="text-muted-foreground">Customer:</span> {report.job.customerName}</div>
                  <div><span className="text-muted-foreground">Date:</span> {report.job.date ? new Date(report.job.date).toLocaleDateString('en-GB') : 'N/A'}</div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Address:</span> {report.job.address || 'N/A'}{report.job.postcode ? `, ${report.job.postcode}` : ''}
                  </div>
                  {report.engineers.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Engineer(s):</span> {report.engineers.map((e: any) => e.name).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Summary */}
              <div>
                <h4 className="font-semibold text-sm mb-3 text-primary flex items-center gap-2">
                  Professional Summary
                  {report.aiPowered && <Sparkles className="h-3 w-3 text-amber-500" />}
                </h4>
                <div className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap">
                  {report.professionalSummary}
                </div>
              </div>

              {/* Materials */}
              {report.materials.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 text-primary">Materials Used</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2 font-medium">Qty</th>
                          <th className="text-left p-2 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.materials.map((m: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{m.quantity}</td>
                            <td className="p-2">{m.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Evidence Photos */}
              {report.photos.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 text-primary">Evidence Photos</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {report.photos.slice(0, 6).map((p: any, i: number) => (
                      <img 
                        key={i} 
                        src={p.data || p.url} 
                        alt={p.caption || 'Evidence'} 
                        className="w-full h-24 object-cover rounded border"
                      />
                    ))}
                  </div>
                  {report.photos.length > 6 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      +{report.photos.length - 6} more photos
                    </p>
                  )}
                </div>
              )}

              {/* Signatures */}
              {report.signatures.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 text-primary">Signatures</h4>
                  <div className="flex gap-4">
                    {report.signatures.map((s: any, i: number) => (
                      <div key={i} className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1 capitalize">{s.type}</p>
                        <img 
                          src={s.data} 
                          alt={`${s.type} signature`} 
                          className="h-16 border rounded bg-card"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sign-off Details */}
              {report.signOff && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 text-primary">Sign-off Details</h4>
                  <div className="text-sm space-y-1">
                    <div><span className="text-muted-foreground">Signed off:</span> {new Date(report.signOff.timestamp).toLocaleString('en-GB')}</div>
                    {report.signOff.address && (
                      <div><span className="text-muted-foreground">Location:</span> {report.signOff.address}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Print Button */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={printReport}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Report
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Job QR Code
            </DialogTitle>
            <DialogDescription>
              Scan this code to quickly access job {job.jobNo}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {qrCodeDataUrl ? (
              <>
                <img 
                  src={qrCodeDataUrl} 
                  alt={`QR Code for job ${job.jobNo}`}
                  className="w-64 h-64 border rounded-lg"
                  data-testid="qr-code-image"
                />
                <p className="text-xs text-muted-foreground mt-4 font-mono">
                  {generateTrueNorthCode('job', job.id)}
                </p>
              </>
            ) : (
              <div className="w-64 h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scan Dialog for parts/assets/documents */}
      <Dialog open={scanDialogOpen} onOpenChange={(open) => { if (!open) closeScanDialog(); else setScanDialogOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan Parts / Assets
            </DialogTitle>
            <DialogDescription>
              Scan a QR code or barcode to log parts, assets, or documents to this job.
            </DialogDescription>
          </DialogHeader>
          
          {!scanResult ? (
            <Scanner 
              onScanSuccess={handleJobScanSuccess}
              onScanError={(error) => toast({ title: "Scan Error", description: error, variant: "destructive" })}
            />
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Scanned Code:</p>
                <p className="font-mono text-sm break-all">{scanResult.code}</p>
                
                {scanResult.parsed && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      Type: <span className="font-medium capitalize">{scanResult.parsed.type}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ID: <span className="font-mono">{scanResult.parsed.id}</span>
                    </p>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                {scanResult.parsed?.type === 'asset' || scanResult.parsed?.type === 'part' ? (
                  <Button 
                    className="w-full"
                    onClick={() => handleLogToJob(scanResult.code, scanResult.parsed)}
                    data-testid="button-log-to-job"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Log to Job
                  </Button>
                ) : scanResult.parsed ? (
                  <Button 
                    className="w-full"
                    onClick={() => handleLogToJob(scanResult.code, scanResult.parsed)}
                    data-testid="button-log-to-job"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Log to Job Notes
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button 
                      className="w-full"
                      onClick={() => handleLogToJob(scanResult.code, null)}
                      data-testid="button-log-barcode-to-job"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Log Barcode to Job
                    </Button>
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={handleCreateAsset}
                      data-testid="button-create-asset"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Create Asset from Code
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setScanResult(null)}
                  data-testid="button-scan-another"
                >
                  Scan Another
                </Button>
                <Button 
                  variant="ghost"
                  className="flex-1"
                  onClick={closeScanDialog}
                  data-testid="button-done-scanning"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quality Gate Dialog */}
      <Dialog
        open={!!qualityError}
        onOpenChange={(open) => {
          if (!open) setQualityError(null);
        }}
      >
        <DialogContent className="sm:max-w-lg" data-testid="dialog-quality-gate">
          <DialogHeader>
            <DialogTitle>Quality Gatekeeper stopped this job</DialogTitle>
            <DialogDescription>
              To prevent repeat visits, this job must meet your quality standards before it can be completed.
            </DialogDescription>
          </DialogHeader>

          {qualityError?.missing && (
            <div className="space-y-3 text-sm">
              {qualityError.missing.photos?.length > 0 && (
                <div>
                  <div className="font-medium">Photos</div>
                  <ul className="list-disc ml-4">
                    {qualityError.missing.photos.map((m: string) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {qualityError.missing.fields?.length > 0 && (
                <div>
                  <div className="font-medium">Required fields</div>
                  <ul className="list-disc ml-4">
                    {qualityError.missing.fields.map((m: string) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {qualityError.missing.forms?.length > 0 && (
                <div>
                  <div className="font-medium">Forms</div>
                  <ul className="list-disc ml-4">
                    {qualityError.missing.forms.map((m: string) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {qualityError.missing.signatures?.length > 0 && (
                <div>
                  <div className="font-medium">Signatures</div>
                  <ul className="list-disc ml-4">
                    {qualityError.missing.signatures.map((m: string) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mt-4">
            <Button variant="outline" onClick={() => setQualityError(null)} data-testid="button-fix-quality-items">
              I'll fix these now
            </Button>

            {canOverride && qualityError?.error === "QUALITY_GATE_CAN_OVERRIDE" && (
              <AdminOverrideSection
                onConfirm={(reason) =>
                  completeJobMutation.mutate({ override: true, overrideReason: reason })
                }
              />
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
