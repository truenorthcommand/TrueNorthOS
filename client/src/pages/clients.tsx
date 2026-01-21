import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AITextarea } from "@/components/ui/ai-assist";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Building2, MapPin, FileText, Camera, X, Send, Search, User, Phone, Mail, Star, Edit2, ChevronRight, ChevronLeft, Check, Home, Save, Upload, ExternalLink, FolderOpen, Image, FileSpreadsheet, File, Loader2, Sparkles, Briefcase, AlertCircle, Users, Calendar, Link2, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { FileWithRelations } from "@shared/schema";

interface JobPhoto {
  id: string;
  url: string;
  caption: string;
  source: 'admin' | 'engineer';
  timestamp: string;
}

interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  isPrimary: boolean;
}

interface ClientProperty {
  id: string;
  clientId: string;
  name: string;
  address: string;
  postcode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  isDefault: boolean;
}

interface Client {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  notes: string | null;
}


const STEP_TITLES = [
  "Select Client",
  "Select Property",
  "Job Details",
  "Assign & Send"
];

export default function Clients() {
  const { user } = useAuth();
  const { addJob } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [newClient, setNewClient] = useState({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    postcode: "",
  });
  const [enableClientPortal, setEnableClientPortal] = useState(false);
  const [createdPortalLink, setCreatedPortalLink] = useState<string | null>(null);
  const [newClientContacts, setNewClientContacts] = useState<Array<{
    name: string;
    email: string;
    phone: string;
    role: string;
    isPrimary: boolean;
  }>>([]);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedEngineerIds, setSelectedEngineerIds] = useState<string[]>([]);
  const [engineers, setEngineers] = useState<{id: string; name: string}[]>([]);
  const [jobForm, setJobForm] = useState({
    nickname: "",
    description: "",
    notes: "",
    session: "AM",
    date: format(new Date(), "yyyy-MM-dd"),
    orderNumber: "" as string | number,
    isLongRunning: false,
  });
  const [jobPhotos, setJobPhotos] = useState<JobPhoto[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Step-based form state
  const [currentStep, setCurrentStep] = useState(1);
  const [clientProperties, setClientProperties] = useState<Record<string, ClientProperty[]>>({});
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newProperty, setNewProperty] = useState({
    name: "",
    address: "",
    postcode: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  });
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [assignOption, setAssignOption] = useState<'ready' | 'assign'>('ready');

  // Client contacts state
  const [clientContacts, setClientContacts] = useState<Record<string, ClientContact[]>>({});
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [showAddContact, setShowAddContact] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
  const [newContact, setNewContact] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    isPrimary: false,
  });
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSavingClient, setIsSavingClient] = useState(false);
  
  // Client files state
  const [clientFiles, setClientFiles] = useState<Record<string, FileWithRelations[]>>({});
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState<Record<string, boolean>>({});
  const [uploadingFileForClient, setUploadingFileForClient] = useState<string | null>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<globalThis.File | null>(null);

  // Portal link state
  const [generatingPortalLink, setGeneratingPortalLink] = useState<string | null>(null);
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);
  const [portalLink, setPortalLink] = useState<string>("");
  const [portalClientName, setPortalClientName] = useState<string>("");

  // Generate portal link for client
  const generatePortalLink = async (clientId: string, clientName: string) => {
    setGeneratingPortalLink(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}/generate-portal-token`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const link = `${window.location.origin}/portal/${data.portalToken}`;
        setPortalLink(link);
        setPortalClientName(clientName);
        setPortalDialogOpen(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to generate portal link",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to generate portal link",
        variant: "destructive",
      });
    } finally {
      setGeneratingPortalLink(null);
    }
  };

  const copyPortalLink = async () => {
    try {
      await navigator.clipboard.writeText(portalLink);
      toast({
        title: "Copied!",
        description: "Portal link copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  // AI Engineer Suggestion state
  interface EngineerSuggestion {
    engineerId: string;
    engineerName: string;
    score: number;
    reason: string;
    matchedSkills?: string[];
    skills: string[];
    nextAvailability?: string;
    isAvailableToday?: boolean;
  }
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<EngineerSuggestion[]>([]);
  const [suggestionsAiPowered, setSuggestionsAiPowered] = useState(false);

  // Fetch AI engineer suggestions
  const fetchEngineerSuggestions = async () => {
    setSuggestDialogOpen(true);
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    setSuggestions([]);
    
    // Get property info for address/postcode
    const selectedProperty = selectedPropertyId && clientProperties[selectedClientId]
      ? clientProperties[selectedClientId].find(p => p.id === selectedPropertyId)
      : null;
    const selectedClient = clients.find(c => c.id === selectedClientId);
    
    try {
      const response = await fetch('/api/ai/suggest-engineers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: jobForm.description || '',
          address: selectedProperty?.address || selectedClient?.address || '',
          postcode: selectedProperty?.postcode || selectedClient?.postcode || '',
          requiredSkills: [],
          urgency: 'normal',
        }),
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
  const handleSelectSuggestedEngineer = (engineerId: string) => {
    if (!selectedEngineerIds.includes(engineerId)) {
      setSelectedEngineerIds([...selectedEngineerIds, engineerId]);
    }
    setSuggestDialogOpen(false);
    
    const engineerName = suggestions.find(s => s.engineerId === engineerId)?.engineerName || 'engineer';
    toast({
      title: "Engineer Selected",
      description: `${engineerName} has been added to this job.`
    });
  };

  const fetchClientContacts = async (clientId: string) => {
    try {
      setIsLoadingContacts(true);
      const res = await fetch(`/api/clients/${clientId}/contacts`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setClientContacts(prev => ({ ...prev, [clientId]: data }));
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const fetchClientProperties = async (clientId: string) => {
    try {
      setIsLoadingProperties(true);
      const res = await fetch(`/api/clients/${clientId}/properties`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setClientProperties(prev => ({ ...prev, [clientId]: data }));
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error);
    } finally {
      setIsLoadingProperties(false);
    }
  };

  const fetchClientFiles = async (clientId: string) => {
    try {
      setIsLoadingFiles(true);
      const res = await fetch(`/api/clients/${clientId}/files`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setClientFiles(prev => ({ ...prev, [clientId]: data }));
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: async (response) => {
      if (!uploadingFileForClient || !selectedFileForUpload) return;
      try {
        const res = await apiRequest("POST", "/api/files", {
          name: selectedFileForUpload.name,
          objectPath: response.objectPath,
          mimeType: selectedFileForUpload.type || null,
          size: selectedFileForUpload.size || null,
          clientId: uploadingFileForClient,
        });
        if (res.ok) {
          toast({ title: "File uploaded successfully" });
          fetchClientFiles(uploadingFileForClient);
        }
      } catch (error: any) {
        toast({ title: "Failed to save file", description: error.message, variant: "destructive" });
      } finally {
        setUploadingFileForClient(null);
        setSelectedFileForUpload(null);
      }
    },
    onError: (error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploadingFileForClient(null);
      setSelectedFileForUpload(null);
    },
  });

  const handleClientFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, clientId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFileForClient(clientId);
    setSelectedFileForUpload(file);
    await uploadFile(file);
    e.target.value = '';
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-5 w-5 text-muted-foreground" />;
    if (mimeType.startsWith("image/")) return <Image className="h-5 w-5 text-blue-500" />;
    if (mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) 
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAddProperty = async () => {
    try {
      const res = await fetch(`/api/clients/${selectedClientId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          ...newProperty,
        }),
        credentials: 'include',
      });
      if (res.ok) {
        const createdProperty = await res.json();
        toast({ title: "Success", description: "Property added successfully." });
        setNewProperty({ name: "", address: "", postcode: "", contactName: "", contactPhone: "", contactEmail: "" });
        setShowAddProperty(false);
        await fetchClientProperties(selectedClientId);
        setSelectedPropertyId(createdProperty.id);
      } else {
        toast({ title: "Error", description: "Failed to add property.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add property.", variant: "destructive" });
    }
  };

  const handleAddContact = async (clientId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: "Success", description: "Contact added successfully." });
        setNewContact({ name: "", email: "", phone: "", role: "", isPrimary: false });
        setShowAddContact(null);
        fetchClientContacts(clientId);
      } else {
        toast({ title: "Error", description: "Failed to add contact.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add contact.", variant: "destructive" });
    }
  };

  const handleUpdateContact = async (clientId: string, contactId: string, updates: Partial<ClientContact>) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: "Success", description: "Contact updated." });
        setEditingContact(null);
        fetchClientContacts(clientId);
      } else {
        toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" });
    }
  };

  const handleDeleteContact = async (clientId: string, contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts/${contactId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: "Success", description: "Contact deleted." });
        fetchClientContacts(clientId);
      } else {
        toast({ title: "Error", description: "Failed to delete contact.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete contact.", variant: "destructive" });
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingPhoto(true);
    
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto: JobPhoto = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url: reader.result as string,
          caption: file.name,
          source: 'admin',
          timestamp: new Date().toISOString(),
        };
        setJobPhotos((prev) => [...prev, newPhoto]);
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };

  const handleRemovePhoto = (photoId: string) => {
    setJobPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const fetchClients = async () => {
    try {
      setIsLoadingClients(true);
      const res = await fetch('/api/clients', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchClients();
      fetch('/api/users', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          const engineerList = data
            .filter((u: any) => u.role === 'engineer')
            .map((u: any) => ({ id: u.id, name: u.name }));
          setEngineers(engineerList);
        })
        .catch(() => {});
    }
  }, [user]);

  // Fetch contacts when a client is expanded
  useEffect(() => {
    if (expandedClientId && !clientContacts[expandedClientId]) {
      fetchClientContacts(expandedClientId);
    }
  }, [expandedClientId]);

  // Fetch contacts and properties when a client is selected in job form
  useEffect(() => {
    if (selectedClientId) {
      if (!clientContacts[selectedClientId]) {
        fetchClientContacts(selectedClientId);
      }
      if (!clientProperties[selectedClientId]) {
        fetchClientProperties(selectedClientId);
      }
    }
    // Reset selected contact and property when client changes
    setSelectedContactId("");
    setSelectedPropertyId("");
  }, [selectedClientId]);


  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatedPortalLink(null);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newClient),
      });
      if (res.ok) {
        const createdClient = await res.json();
        
        // Create any additional contacts
        if (newClientContacts.length > 0) {
          for (const contact of newClientContacts) {
            await fetch(`/api/clients/${createdClient.id}/contacts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(contact),
            });
          }
        }
        
        // Generate portal token if enabled
        let portalUrl = null;
        if (enableClientPortal) {
          const portalRes = await fetch(`/api/clients/${createdClient.id}/generate-portal-token`, {
            method: 'POST',
            credentials: 'include',
          });
          if (portalRes.ok) {
            const portalData = await portalRes.json();
            portalUrl = `${window.location.origin}${portalData.portalUrl}`;
            setCreatedPortalLink(portalUrl);
          } else {
            toast({ 
              title: "Portal Generation Failed", 
              description: "Client was created but the portal link could not be generated. You can try again from the client settings.", 
              variant: "destructive" 
            });
          }
        }
        
        setClients([...clients, createdClient]);
        setNewClient({
          name: "",
          contactName: "",
          email: "",
          phone: "",
          address: "",
          postcode: "",
        });
        setNewClientContacts([]);
        setEnableClientPortal(false);
        
        if (portalUrl) {
          toast({ 
            title: "Client Created with Portal", 
            description: "Client portal link has been generated. You can copy it below." 
          });
        } else {
          toast({ title: "Success", description: "Client added successfully." });
        }
      } else {
        toast({ title: "Error", description: "Failed to add client.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add client.", variant: "destructive" });
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setClients(clients.filter((c) => c.id !== id));
        setExpandedClientId(null);
        toast({ title: "Success", description: "Client deleted." });
      } else {
        toast({ title: "Error", description: "Failed to delete client.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete client.", variant: "destructive" });
    }
  };

  const handleUpdateClient = async () => {
    if (!editingClient) return;
    setIsSavingClient(true);
    try {
      const res = await fetch(`/api/clients/${editingClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingClient.name,
          contactName: editingClient.contactName,
          email: editingClient.email,
          phone: editingClient.phone,
          address: editingClient.address,
          postcode: editingClient.postcode,
          notes: editingClient.notes,
        }),
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: "Success", description: "Client updated successfully." });
        setEditingClient(null);
        const clientsRes = await fetch('/api/clients', { credentials: 'include' });
        if (clientsRes.ok) {
          setClients(await clientsRes.json());
        }
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to update client.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update client.", variant: "destructive" });
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleCreateJobFromClient = async (status: 'Ready' | 'Draft') => {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    // Get selected property for address info
    const selectedProperty = selectedPropertyId && clientProperties[selectedClientId]
      ? clientProperties[selectedClientId].find(p => p.id === selectedPropertyId)
      : null;

    // Use selected contact if available, then property contact, then client defaults
    const selectedContact = selectedContactId && clientContacts[selectedClientId]
      ? clientContacts[selectedClientId].find(c => c.id === selectedContactId)
      : null;

    const contactName = selectedContact?.name || selectedProperty?.contactName || client.contactName || "";
    const contactPhone = selectedContact?.phone || selectedProperty?.contactPhone || client.phone || "";
    const contactEmail = selectedContact?.email || selectedProperty?.contactEmail || client.email || "";

    // Use property address if selected, otherwise client address
    const jobAddress = selectedProperty?.address || client.address || "";
    const jobPostcode = selectedProperty?.postcode || client.postcode || "";

    const assignToIds = status === 'Draft' && selectedEngineerIds.length > 0 
      ? selectedEngineerIds 
      : [];
    const primaryAssignee = assignToIds[0] || "";
    
    const newJob = await addJob({
      jobNo: `J-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
      nickname: jobForm.nickname || null,
      client: client.name,
      customerName: client.name,
      propertyId: selectedProperty?.id || null,
      propertyName: selectedProperty?.name || null,
      address: jobAddress,
      postcode: jobPostcode,
      contactName: contactName,
      contactPhone: contactPhone,
      contactEmail: contactEmail,
      date: new Date(jobForm.date).toISOString(),
      session: jobForm.session,
      orderNumber: jobForm.orderNumber ? Number(jobForm.orderNumber) : null,
      description: jobForm.description,
      notes: jobForm.notes,
      isLongRunning: jobForm.isLongRunning,
      status: status,
      assignedToId: primaryAssignee || null,
      assignedToIds: assignToIds,
      materials: [],
      photos: jobPhotos,
      signatures: [],
      furtherActions: [],
    });

    if (newJob) {
      const message = status === 'Ready' 
        ? `Job sheet #${newJob.jobNo} saved as Ready for ${client.name}`
        : `Job sheet #${newJob.jobNo} has been created and sent for ${client.name}`;
      
      toast({
        title: status === 'Ready' ? "Job Saved as Ready" : "Job Sheet Sent",
        description: message,
      });

      // Reset form
      setSelectedClientId("");
      setSelectedContactId("");
      setSelectedPropertyId("");
      setSelectedEngineerIds([]);
      setJobForm({ nickname: "", description: "", notes: "", session: "AM", date: format(new Date(), "yyyy-MM-dd"), orderNumber: "", isLongRunning: false });
      setJobPhotos([]);
      setCurrentStep(1);
      setShowAddProperty(false);
      setAssignOption('ready');
    }
  };


  const goToNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!user) return null;

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedProperty = selectedPropertyId && clientProperties[selectedClientId]
    ? clientProperties[selectedClientId].find(p => p.id === selectedPropertyId)
    : null;

  const filteredClients = clients.filter((client) => {
    if (!clientSearchTerm) return true;
    const term = clientSearchTerm.toLowerCase();
    return (
      client.name.toLowerCase().includes(term) ||
      (client.contactName || '').toLowerCase().includes(term) ||
      (client.email || '').toLowerCase().includes(term) ||
      (client.phone || '').toLowerCase().includes(term) ||
      (client.address || '').toLowerCase().includes(term) ||
      (client.postcode || '').toLowerCase().includes(term)
    );
  });

  // Step indicator component
  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-6">
      {STEP_TITLES.map((title, index) => {
        const stepNumber = index + 1;
        const isActive = currentStep === stepNumber;
        const isCompleted = currentStep > stepNumber;
        
        return (
          <div key={stepNumber} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : stepNumber}
              </div>
              <span className={`text-xs mt-1 text-center ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {title}
              </span>
            </div>
            {stepNumber < 4 && (
              <div className={`h-0.5 flex-1 mx-2 ${isCompleted ? 'bg-emerald-600' : 'bg-muted'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger 
                  data-testid="select-client"
                >
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClient && (
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Client Information</p>
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Company</p>
                    <p className="font-medium" data-testid="text-client-name">{selectedClient.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Contact Person</p>
                    <p className="font-medium" data-testid="text-contact-name">{selectedClient.contactName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Phone</p>
                    <p className="font-medium" data-testid="text-contact-phone">{selectedClient.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Email</p>
                    <p className="font-medium" data-testid="text-contact-email">{selectedClient.email || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Address</p>
                    <p className="font-medium" data-testid="text-client-address">{selectedClient.address || '-'}{selectedClient.postcode ? `, ${selectedClient.postcode}` : ''}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            {isLoadingProperties ? (
              <p className="text-sm text-muted-foreground">Loading properties...</p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Select Property</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddProperty(!showAddProperty)}
                      data-testid="button-add-property"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add New Property
                    </Button>
                  </div>
                  
                  {(clientProperties[selectedClientId] || []).length > 0 ? (
                    <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                      <SelectTrigger 
                        data-testid="select-property"
                      >
                        <SelectValue placeholder="Choose a property..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(clientProperties[selectedClientId] || []).map((property) => (
                          <SelectItem key={property.id} value={property.id}>
                            <div className="flex flex-col">
                              <span>{property.name}{property.isDefault ? ' (Default)' : ''}</span>
                              <span className="text-xs text-muted-foreground">{property.address}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50 border-amber-300">
                      <p className="text-sm text-muted-foreground">
                        No properties found for this client. Add a new property to continue.
                      </p>
                    </div>
                  )}
                </div>

                {showAddProperty && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border space-y-4">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">New Property</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Property Name</Label>
                        <Input
                          placeholder="e.g., Head Office, Site A"
                          value={newProperty.name}
                          onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })}
                          data-testid="input-property-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Postcode</Label>
                        <Input
                          placeholder="e.g., SW1A 1AA"
                          value={newProperty.postcode}
                          onChange={(e) => setNewProperty({ ...newProperty, postcode: e.target.value })}
                          data-testid="input-property-postcode"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-sm">Address</Label>
                        <Textarea
                          placeholder="Full property address"
                          value={newProperty.address}
                          onChange={(e) => setNewProperty({ ...newProperty, address: e.target.value })}
                          className="min-h-[80px]"
                          data-testid="input-property-address"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Contact Name</Label>
                        <Input
                          placeholder="Site contact name"
                          value={newProperty.contactName}
                          onChange={(e) => setNewProperty({ ...newProperty, contactName: e.target.value })}
                          data-testid="input-property-contact-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Contact Phone</Label>
                        <Input
                          placeholder="01onal 567890"
                          value={newProperty.contactPhone}
                          onChange={(e) => setNewProperty({ ...newProperty, contactPhone: e.target.value })}
                          data-testid="input-property-contact-phone"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-sm">Contact Email</Label>
                        <Input
                          type="email"
                          placeholder="site@company.com"
                          value={newProperty.contactEmail}
                          onChange={(e) => setNewProperty({ ...newProperty, contactEmail: e.target.value })}
                          data-testid="input-property-contact-email"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={handleAddProperty} data-testid="button-save-property">
                        Save Property
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => {
                        setShowAddProperty(false);
                        setNewProperty({ name: "", address: "", postcode: "", contactName: "", contactPhone: "", contactEmail: "" });
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {selectedProperty && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Selected Property</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Name</p>
                        <p className="font-medium">{selectedProperty.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Postcode</p>
                        <p className="font-medium">{selectedProperty.postcode || '-'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Address</p>
                        <p className="font-medium">{selectedProperty.address}</p>
                      </div>
                      {(selectedProperty.contactName || selectedProperty.contactPhone || selectedProperty.contactEmail) && (
                        <>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Site Contact</p>
                            <p className="font-medium">{selectedProperty.contactName || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Contact Info</p>
                            <p className="font-medium">
                              {selectedProperty.contactPhone || selectedProperty.contactEmail || '-'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {selectedClientId && clientContacts[selectedClientId] && clientContacts[selectedClientId].length > 0 && (
                  <div className="space-y-2">
                    <Label>Contact Person (Optional)</Label>
                    <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                      <SelectTrigger data-testid="select-contact-person">
                        <SelectValue placeholder="Select a contact person..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clientContacts[selectedClientId].map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            <div className="flex flex-col">
                              <span>{contact.name}{contact.isPrimary ? ' (Primary)' : ''}</span>
                              <span className="text-xs text-muted-foreground">
                                {contact.role && `${contact.role} • `}{contact.phone || contact.email || 'No contact info'}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Appointment Date</Label>
                <Input
                  type="date"
                  value={jobForm.date}
                  onChange={(e) => setJobForm({ ...jobForm, date: e.target.value })}
                  data-testid="input-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Session</Label>
                <Select value={jobForm.session} onValueChange={(value) => setJobForm({ ...jobForm, session: value })}>
                  <SelectTrigger data-testid="select-session">
                    <SelectValue placeholder="Select session..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM (Morning)</SelectItem>
                    <SelectItem value="PM">PM (Afternoon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Job Order</Label>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  placeholder="Auto"
                  value={jobForm.orderNumber}
                  onChange={(e) => setJobForm({ ...jobForm, orderNumber: e.target.value })}
                  data-testid="input-order-number"
                />
                <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Job Nickname (shows on planner)</Label>
              <Input
                placeholder="e.g. Boiler Install, Kitchen Rewire..."
                value={jobForm.nickname}
                onChange={(e) => setJobForm({ ...jobForm, nickname: e.target.value })}
                data-testid="input-nickname"
              />
              <p className="text-xs text-muted-foreground">Optional - if blank, the client name will be shown on the planner</p>
            </div>

            <div className="space-y-2">
              <Label>Description of Works</Label>
              <AITextarea
                placeholder="Describe the work to be carried out..."
                value={jobForm.description}
                onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                className="min-h-[120px]"
                data-testid="input-description"
                aiContext="job description for field service work"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <AITextarea
                placeholder="Access codes, parking info, special instructions..."
                value={jobForm.notes}
                onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })}
                className="min-h-[80px]"
                data-testid="input-notes"
                aiContext="job notes and instructions"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="long-running-switch">Long-running Job</Label>
                <p className="text-sm text-muted-foreground">Enable daily progress updates for multi-day projects</p>
              </div>
              <Switch
                id="long-running-switch"
                checked={jobForm.isLongRunning}
                onCheckedChange={(checked) => setJobForm({ ...jobForm, isLongRunning: checked })}
                data-testid="switch-long-running"
              />
            </div>

            <div className="space-y-3">
              <Label>Photos (Optional)</Label>
              <div className="flex flex-wrap gap-3">
                {jobPhotos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.url}
                      alt={photo.caption}
                      className="h-24 w-24 object-cover rounded-lg border"
                      data-testid={`photo-preview-${photo.id}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-remove-photo-${photo.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="h-24 w-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">
                    {isUploadingPhoto ? "..." : "Add"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    data-testid="input-photo-upload"
                  />
                </label>
              </div>
              {jobPhotos.length > 0 && (
                <p className="text-xs text-muted-foreground">{jobPhotos.length} photo(s) attached</p>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">How would you like to save this job?</Label>
              
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  assignOption === 'ready' 
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
                onClick={() => setAssignOption('ready')}
                data-testid="option-save-ready"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    assignOption === 'ready' ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground'
                  }`}>
                    {assignOption === 'ready' && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium">Save as Ready</p>
                    <p className="text-sm text-muted-foreground">Save the job without assigning an engineer. You can assign engineers later.</p>
                  </div>
                </div>
              </div>

              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  assignOption === 'assign' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
                onClick={() => setAssignOption('assign')}
                data-testid="option-assign-send"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    assignOption === 'assign' ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {assignOption === 'assign' && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium">Assign Engineer & Send</p>
                    <p className="text-sm text-muted-foreground">Select engineers and send the job sheet to them immediately.</p>
                  </div>
                </div>
              </div>
            </div>

            {assignOption === 'assign' && user?.role === 'admin' && engineers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Engineers</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchEngineerSuggestions}
                    className="gap-2"
                    data-testid="button-ai-suggest-engineer"
                  >
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    AI Suggest
                  </Button>
                </div>
                <div 
                  className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto"
                  data-testid="engineer-checkbox-list"
                >
                  {engineers.map((eng) => (
                    <div key={eng.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`eng-${eng.id}`}
                        checked={selectedEngineerIds.includes(eng.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedEngineerIds([...selectedEngineerIds, eng.id]);
                          } else {
                            setSelectedEngineerIds(selectedEngineerIds.filter(id => id !== eng.id));
                          }
                        }}
                        data-testid={`checkbox-engineer-${eng.id}`}
                      />
                      <label 
                        htmlFor={`eng-${eng.id}`} 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {eng.name}
                      </label>
                    </div>
                  ))}
                </div>
                {selectedEngineerIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedEngineerIds.length} engineer(s) selected
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

            {/* Summary Card */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border space-y-3">
              <p className="text-sm font-medium">Job Summary</p>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client:</span>
                  <span className="font-medium">{selectedClient?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Property:</span>
                  <span className="font-medium">{selectedProperty?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{format(new Date(jobForm.date), "dd MMM yyyy")} ({jobForm.session})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description:</span>
                  <span className="font-medium truncate max-w-[200px]">{jobForm.description || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">
          Manage service providers and create job sheets
        </p>
      </div>

      <Tabs defaultValue="create-job" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="create-job" data-testid="tab-create-job">Create Job Sheet</TabsTrigger>
          <TabsTrigger value="manage" data-testid="tab-manage-clients">Manage Clients</TabsTrigger>
        </TabsList>

        <TabsContent value="create-job" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Step {currentStep} of 4: {STEP_TITLES[currentStep - 1]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StepIndicator />
              
              <div className="min-h-[400px]">
                {renderStepContent()}
              </div>

              <div className="flex justify-between mt-6 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToPreviousStep}
                  disabled={currentStep === 1}
                  data-testid="button-previous-step"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>

                <div className="flex gap-2">
                  {currentStep < 4 ? (
                    <Button
                      type="button"
                      onClick={goToNextStep}
                      data-testid="button-next-step"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <>
                      {assignOption === 'ready' ? (
                        <Button
                          type="button"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleCreateJobFromClient('Ready')}
                          data-testid="button-save-ready"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save as Ready
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => handleCreateJobFromClient('Draft')}
                          data-testid="button-assign-send"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Assign & Send
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add New Client</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddClient} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      placeholder="e.g., BuildTech Solutions"
                      value={newClient.name}
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                      data-testid="input-company-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input
                      placeholder="Full name"
                      value={newClient.contactName}
                      onChange={(e) =>
                        setNewClient({ ...newClient, contactName: e.target.value })
                      }
                      data-testid="input-contact-person"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="contact@company.com"
                      value={newClient.email}
                      onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                      data-testid="input-client-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      placeholder="01234 567890"
                      value={newClient.phone}
                      onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                      data-testid="input-client-phone"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Textarea
                      placeholder="Full address"
                      value={newClient.address}
                      onChange={(e) =>
                        setNewClient({ ...newClient, address: e.target.value })
                      }
                      className="min-h-[80px]"
                      data-testid="input-address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Postcode</Label>
                    <Input
                      placeholder="e.g., SW1A 1AA"
                      value={newClient.postcode}
                      onChange={(e) => setNewClient({ ...newClient, postcode: e.target.value })}
                      data-testid="input-postcode"
                    />
                  </div>
                </div>

                {/* Additional Contact Persons Section */}
                <div className="border rounded-lg p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Additional Contact Persons</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewClientContacts([...newClientContacts, { name: "", email: "", phone: "", role: "", isPrimary: false }])}
                      data-testid="button-add-new-contact"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Contact
                    </Button>
                  </div>
                  
                  {newClientContacts.length === 0 && (
                    <p className="text-sm text-muted-foreground">No additional contacts added yet. Click "Add Contact" to add contact persons.</p>
                  )}
                  
                  {newClientContacts.map((contact, index) => (
                    <div key={index} className="border rounded-md p-3 bg-white dark:bg-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Contact {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewClientContacts(newClientContacts.filter((_, i) => i !== index))}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          data-testid={`button-remove-contact-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Input
                            placeholder="Name"
                            value={contact.name}
                            onChange={(e) => {
                              const updated = [...newClientContacts];
                              updated[index].name = e.target.value;
                              setNewClientContacts(updated);
                            }}
                            data-testid={`input-contact-name-${index}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Input
                            placeholder="Email"
                            type="email"
                            value={contact.email}
                            onChange={(e) => {
                              const updated = [...newClientContacts];
                              updated[index].email = e.target.value;
                              setNewClientContacts(updated);
                            }}
                            data-testid={`input-contact-email-${index}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Input
                            placeholder="Phone"
                            value={contact.phone}
                            onChange={(e) => {
                              const updated = [...newClientContacts];
                              updated[index].phone = e.target.value;
                              setNewClientContacts(updated);
                            }}
                            data-testid={`input-contact-phone-${index}`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="space-y-1">
                          <Select
                            value={contact.role || ""}
                            onValueChange={(value) => {
                              const updated = [...newClientContacts];
                              updated[index].role = value;
                              setNewClientContacts(updated);
                            }}
                          >
                            <SelectTrigger className="w-[180px]" data-testid={`select-contact-role-${index}`}>
                              <SelectValue placeholder="Role (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="N/A">N/A</SelectItem>
                              <SelectItem value="General">General</SelectItem>
                              <SelectItem value="Accounts">Accounts</SelectItem>
                              <SelectItem value="Manager">Manager</SelectItem>
                              <SelectItem value="Site">Site Contact</SelectItem>
                              <SelectItem value="Technical">Technical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={contact.isPrimary}
                            onChange={(e) => {
                              const updated = [...newClientContacts];
                              updated[index].isPrimary = e.target.checked;
                              setNewClientContacts(updated);
                            }}
                            className="rounded"
                            data-testid={`checkbox-contact-primary-${index}`}
                          />
                          Primary Contact
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Enable Client Portal Toggle */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-portal" className="text-base font-medium flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-blue-600" />
                        Enable Client Portal
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Generate a secure portal link for this client to view their quotes, invoices, and jobs
                      </p>
                    </div>
                    <Switch
                      id="enable-portal"
                      checked={enableClientPortal}
                      onCheckedChange={setEnableClientPortal}
                      data-testid="switch-enable-client-portal"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full sm:w-auto" 
                  data-testid="button-add-client"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              </form>

              {/* Portal Link Display */}
              {createdPortalLink && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800 dark:text-green-200">Client Portal Link Created</span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                    Share this secure link with your client so they can access their portal:
                  </p>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={createdPortalLink} 
                      readOnly 
                      className="bg-white dark:bg-slate-800 text-sm font-mono"
                      data-testid="input-portal-link"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(createdPortalLink);
                        toast({ title: "Copied!", description: "Portal link copied to clipboard." });
                      }}
                      data-testid="button-copy-portal-link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-green-700 dark:text-green-300"
                    onClick={() => setCreatedPortalLink(null)}
                    data-testid="button-dismiss-portal-link"
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm mb-4">
            <Search className="w-5 h-5 text-muted-foreground ml-2" />
            <Input 
              placeholder="Search clients by name, contact, email, or address..." 
              className="border-none shadow-none focus-visible:ring-0"
              value={clientSearchTerm}
              onChange={(e) => setClientSearchTerm(e.target.value)}
              data-testid="input-search-clients"
            />
          </div>

          <div className="space-y-4">
            {filteredClients.map((client) => (
              <Card
                key={client.id}
                className="hover:shadow-md transition-shadow overflow-hidden"
                data-testid={`card-client-${client.id}`}
              >
                <CardHeader
                  className="pb-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50"
                  onClick={() =>
                    setExpandedClientId(
                      expandedClientId === client.id ? null : client.id
                    )
                  }
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{client.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {client.contactName || '-'}
                        </p>
                      </div>
                    </div>
                    {user.role === 'admin' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingClient(client);
                          }}
                          className="h-8 w-8 p-0 shrink-0"
                          data-testid={`button-edit-client-${client.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            generatePortalLink(client.id, client.name);
                          }}
                          disabled={generatingPortalLink === client.id}
                          className="h-8 w-8 p-0 shrink-0 text-[#0F2B4C] hover:text-[#0F2B4C] hover:bg-[#0F2B4C]/10"
                          data-testid={`button-portal-link-${client.id}`}
                          title="Generate Customer Portal Link"
                        >
                          {generatingPortalLink === client.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClient(client.id);
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 shrink-0"
                      data-testid={`button-delete-client-${client.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                {expandedClientId === client.id && (
                  <CardContent className="border-t space-y-6 pt-6">
                    {editingClient?.id === client.id ? (
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Edit2 className="h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold">Edit Client</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm">Company Name</Label>
                            <Input
                              value={editingClient.name}
                              onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                              data-testid={`input-edit-client-name-${client.id}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Contact Name</Label>
                            <Input
                              value={editingClient.contactName || ""}
                              onChange={(e) => setEditingClient({ ...editingClient, contactName: e.target.value })}
                              data-testid={`input-edit-client-contactName-${client.id}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Email</Label>
                            <Input
                              type="email"
                              value={editingClient.email || ""}
                              onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                              data-testid={`input-edit-client-email-${client.id}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Phone</Label>
                            <Input
                              value={editingClient.phone || ""}
                              onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                              data-testid={`input-edit-client-phone-${client.id}`}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm">Address</Label>
                            <Textarea
                              value={editingClient.address || ""}
                              onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                              className="min-h-[80px]"
                              data-testid={`input-edit-client-address-${client.id}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Postcode</Label>
                            <Input
                              value={editingClient.postcode || ""}
                              onChange={(e) => setEditingClient({ ...editingClient, postcode: e.target.value })}
                              data-testid={`input-edit-client-postcode-${client.id}`}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm">Notes</Label>
                            <Textarea
                              value={editingClient.notes || ""}
                              onChange={(e) => setEditingClient({ ...editingClient, notes: e.target.value })}
                              className="min-h-[80px]"
                              placeholder="Additional notes about this client..."
                              data-testid={`input-edit-client-notes-${client.id}`}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={handleUpdateClient}
                            disabled={isSavingClient || !editingClient.name.trim()}
                            data-testid={`button-save-client-${client.id}`}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            {isSavingClient ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingClient(null)}
                            disabled={isSavingClient}
                            data-testid={`button-cancel-edit-client-${client.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                    <div className="grid md:grid-cols-2 gap-4">
                      {client.email && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase">
                            Email
                          </p>
                          <a
                            href={`mailto:${client.email}`}
                            className="text-primary hover:underline text-sm"
                          >
                            {client.email}
                          </a>
                        </div>
                      )}
                      {client.phone && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase">
                            Phone
                          </p>
                          <a
                            href={`tel:${client.phone}`}
                            className="text-primary hover:underline text-sm"
                          >
                            {client.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {client.address && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold">Address</p>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {client.address}{client.postcode ? `, ${client.postcode}` : ''}
                        </p>
                      </div>
                    )}

                    {/* Contact Persons Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold">Contact Persons</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddContact(showAddContact === client.id ? null : client.id)}
                          data-testid={`button-add-contact-${client.id}`}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Contact
                        </Button>
                      </div>

                      {/* Add Contact Form */}
                      {showAddContact === client.id && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg mb-4 space-y-3">
                          <p className="text-sm font-medium">New Contact</p>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Name</Label>
                              <Input
                                placeholder="Contact name"
                                value={newContact.name}
                                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                                data-testid={`input-new-contact-name-${client.id}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Role <span className="text-muted-foreground">(optional or N/A)</span></Label>
                              <Input
                                placeholder="e.g., Site Manager (or N/A)"
                                value={newContact.role}
                                onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                                data-testid={`input-new-contact-role-${client.id}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Email</Label>
                              <Input
                                type="email"
                                placeholder="email@company.com"
                                value={newContact.email}
                                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                data-testid={`input-new-contact-email-${client.id}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Phone</Label>
                              <Input
                                placeholder="01234 567890"
                                value={newContact.phone}
                                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                                data-testid={`input-new-contact-phone-${client.id}`}
                              />
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`primary-${client.id}`}
                              checked={newContact.isPrimary}
                              onCheckedChange={(checked) => setNewContact({ ...newContact, isPrimary: !!checked })}
                              data-testid={`checkbox-primary-contact-${client.id}`}
                            />
                            <label htmlFor={`primary-${client.id}`} className="text-sm">Primary contact</label>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleAddContact(client.id)} 
                              data-testid={`button-save-contact-${client.id}`}
                            >
                              Save Contact
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setShowAddContact(null);
                              setNewContact({ name: "", email: "", phone: "", role: "", isPrimary: false });
                            }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Contacts List */}
                      {isLoadingContacts && expandedClientId === client.id ? (
                        <p className="text-sm text-muted-foreground">Loading contacts...</p>
                      ) : (
                        <div className="space-y-2">
                          {(clientContacts[client.id] || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No contacts added yet.</p>
                          ) : (
                            (clientContacts[client.id] || []).map((contact) => (
                              <div
                                key={contact.id}
                                className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
                                data-testid={`contact-card-${contact.id}`}
                              >
                                {editingContact?.id === contact.id ? (
                                  <div className="flex-1 space-y-3">
                                    <div className="grid md:grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Name</Label>
                                        <Input
                                          value={editingContact.name}
                                          onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                                          data-testid={`input-edit-contact-name-${contact.id}`}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Role <span className="text-muted-foreground">(optional or N/A)</span></Label>
                                        <Input
                                          value={editingContact.role || ""}
                                          placeholder="e.g., Site Manager (or N/A)"
                                          onChange={(e) => setEditingContact({ ...editingContact, role: e.target.value })}
                                          data-testid={`input-edit-contact-role-${contact.id}`}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Email</Label>
                                        <Input
                                          type="email"
                                          value={editingContact.email || ""}
                                          onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                                          data-testid={`input-edit-contact-email-${contact.id}`}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Phone</Label>
                                        <Input
                                          value={editingContact.phone || ""}
                                          onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                                          data-testid={`input-edit-contact-phone-${contact.id}`}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`edit-primary-${contact.id}`}
                                        checked={editingContact.isPrimary}
                                        onCheckedChange={(checked) => setEditingContact({ ...editingContact, isPrimary: !!checked })}
                                      />
                                      <label htmlFor={`edit-primary-${contact.id}`} className="text-sm">Primary contact</label>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          const { id, clientId, ...updateFields } = editingContact;
                                          handleUpdateContact(client.id, contact.id, updateFields);
                                        }}
                                        data-testid={`button-update-contact-${contact.id}`}
                                      >
                                        Update
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => setEditingContact(null)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="font-medium text-sm">{contact.name}</p>
                                        {contact.isPrimary && (
                                          <Badge variant="secondary" className="text-xs">
                                            <Star className="h-3 w-3 mr-1" />
                                            Primary
                                          </Badge>
                                        )}
                                      </div>
                                      {contact.role && (
                                        <p className="text-xs text-muted-foreground mb-1">{contact.role}</p>
                                      )}
                                      <div className="flex flex-wrap gap-4 text-sm">
                                        {contact.email && (
                                          <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary hover:underline">
                                            <Mail className="h-3 w-3" />
                                            {contact.email}
                                          </a>
                                        )}
                                        {contact.phone && (
                                          <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                                            <Phone className="h-3 w-3" />
                                            {contact.phone}
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditingContact(contact)}
                                        className="h-8 w-8 p-0"
                                        data-testid={`button-edit-contact-${contact.id}`}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteContact(client.id, contact.id)}
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                        data-testid={`button-delete-contact-${contact.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Files Section */}
                    <div className="border-t pt-4">
                      <Collapsible
                        open={filesExpanded[client.id] ?? false}
                        onOpenChange={(isOpen) => {
                          setFilesExpanded(prev => ({ ...prev, [client.id]: isOpen }));
                          if (isOpen && !clientFiles[client.id]) {
                            fetchClientFiles(client.id);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                              <FolderOpen className="h-4 w-4 text-primary" />
                              <p className="text-sm font-semibold">Files</p>
                              <ChevronRight className={`h-4 w-4 transition-transform ${filesExpanded[client.id] ? 'rotate-90' : ''}`} />
                              {clientFiles[client.id]?.length ? (
                                <Badge variant="secondary" className="ml-1">{clientFiles[client.id].length}</Badge>
                              ) : null}
                            </Button>
                          </CollapsibleTrigger>
                          <div className="relative">
                            <input
                              type="file"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={(e) => handleClientFileUpload(e, client.id)}
                              disabled={isUploading && uploadingFileForClient === client.id}
                              data-testid={`input-file-upload-${client.id}`}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUploading && uploadingFileForClient === client.id}
                              data-testid={`button-upload-file-${client.id}`}
                            >
                              {isUploading && uploadingFileForClient === client.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  {progress}%
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-1" />
                                  Upload
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        <CollapsibleContent className="space-y-2">
                          {isLoadingFiles && !clientFiles[client.id] ? (
                            <div className="flex items-center gap-2 py-4 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <p className="text-sm">Loading files...</p>
                            </div>
                          ) : (clientFiles[client.id] || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4">No files uploaded yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {(clientFiles[client.id] || []).map((file) => (
                                <div
                                  key={file.id}
                                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                                  data-testid={`file-item-${file.id}`}
                                >
                                  {getFileIcon(file.mimeType)}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatFileSize(file.size)}
                                      {file.createdAt && ` • ${format(new Date(file.createdAt), "dd MMM yyyy")}`}
                                    </p>
                                  </div>
                                  <a
                                    href={file.objectPath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`button-open-file-${file.id}`}
                                  >
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                      </>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          {clients.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No clients added yet.</p>
            </div>
          )}
          {clients.length > 0 && clientSearchTerm && filteredClients.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No clients match your search.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Portal Link Dialog */}
      <Dialog open={portalDialogOpen} onOpenChange={setPortalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-[#0F2B4C]" />
              Customer Portal Link
            </DialogTitle>
            <DialogDescription>
              Share this link with <strong>{portalClientName}</strong> to give them access to their customer portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={portalLink}
                readOnly
                className="flex-1 font-mono text-sm"
                data-testid="input-portal-link"
              />
              <Button
                onClick={copyPortalLink}
                className="bg-[#0F2B4C] hover:bg-[#1a3d63]"
                data-testid="button-copy-portal-link"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              This link provides secure access to view quotes, invoices, and job status without requiring a login.
            </p>
            <div className="flex justify-end gap-2">
              <a href={portalLink} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" data-testid="button-open-portal">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Portal
                </Button>
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
