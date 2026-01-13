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
import { Plus, Trash2, Building2, MapPin, FileText, Camera, X, Send, Search, User, Phone, Mail, Star, Edit2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

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
  const [newClientContacts, setNewClientContacts] = useState<Array<{
    name: string;
    email: string;
    phone: string;
    role: string;
    isPrimary: boolean;
  }>>([]);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const [selectedClientId, setSelectedClientId] = useState("");
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

  const handleAddContact = async (clientId: string) => {
    if (!newContact.name.trim()) {
      toast({ title: "Error", description: "Contact name is required.", variant: "destructive" });
      return;
    }
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

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name) {
      toast({ title: "Error", description: "Client name is required.", variant: "destructive" });
      return;
    }
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
        toast({ title: "Success", description: "Client added successfully." });
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

  const handleCreateJobFromClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClientId || !jobForm.description) {
      toast({ 
        title: "Missing Information", 
        description: "Please select a client and enter a description.",
        variant: "destructive"
      });
      return;
    }

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    const assignToIds = user?.role === 'admin' && selectedEngineerIds.length > 0 
      ? selectedEngineerIds 
      : user?.id ? [user.id] : [];
    const primaryAssignee = assignToIds[0] || user?.id || "";
    
    const newJob = await addJob({
      jobNo: `J-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
      nickname: jobForm.nickname || null,
      client: client.name,
      customerName: client.name,
      address: client.address || "",
      postcode: client.postcode || "",
      contactName: client.contactName || "",
      contactPhone: client.phone || "",
      contactEmail: client.email || "",
      date: new Date(jobForm.date).toISOString(),
      session: jobForm.session,
      orderNumber: jobForm.orderNumber ? Number(jobForm.orderNumber) : null,
      description: jobForm.description,
      notes: jobForm.notes,
      isLongRunning: jobForm.isLongRunning,
      status: "Draft",
      assignedToId: primaryAssignee,
      assignedToIds: assignToIds,
      materials: [],
      photos: jobPhotos,
      signatures: [],
      furtherActions: [],
    });

    if (newJob) {
      toast({
        title: "Job Sheet Sent",
        description: `Job sheet #${newJob.jobNo} has been created and sent for ${client.name}`,
      });

      setSelectedClientId("");
      setSelectedEngineerIds([]);
      setJobForm({ nickname: "", description: "", notes: "", session: "AM", date: format(new Date(), "yyyy-MM-dd"), orderNumber: "", isLongRunning: false });
      setJobPhotos([]);
    }
  };

  if (!user) return null;

  const selectedClient = clients.find(c => c.id === selectedClientId);

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
                Create New Job Sheet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateJobFromClient} className="space-y-6">
                <div className="space-y-2">
                  <Label>Select Client</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger data-testid="select-client">
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
                    <p className="text-xs font-medium text-muted-foreground uppercase">Client Information (Auto-filled)</p>
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

                {user?.role === 'admin' && engineers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Assign Engineers</Label>
                    <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto" data-testid="engineer-checkbox-list">
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
                  </div>
                )}

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
                  <Label>Description of Works *</Label>
                  <AITextarea
                    placeholder="Describe the work to be carried out..."
                    value={jobForm.description}
                    onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                    className="min-h-[120px]"
                    required
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

                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700" 
                    disabled={!selectedClientId || !jobForm.description}
                    data-testid="button-create-job"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setSelectedClientId("");
                      setSelectedEngineerIds([]);
                      setJobForm({ nickname: "", description: "", notes: "", session: "AM", date: format(new Date(), "yyyy-MM-dd"), orderNumber: "", isLongRunning: false });
                      setJobPhotos([]);
                    }}
                    data-testid="button-clear-form"
                  >
                    Clear
                  </Button>
                </div>
              </form>
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
                    <Label>Address</Label>
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
                        <Input
                          placeholder="Name *"
                          value={contact.name}
                          onChange={(e) => {
                            const updated = [...newClientContacts];
                            updated[index].name = e.target.value;
                            setNewClientContacts(updated);
                          }}
                          data-testid={`input-contact-name-${index}`}
                        />
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
                      <div className="flex items-center gap-4">
                        <Select
                          value={contact.role || ""}
                          onValueChange={(value) => {
                            const updated = [...newClientContacts];
                            updated[index].role = value;
                            setNewClientContacts(updated);
                          }}
                        >
                          <SelectTrigger className="w-[180px]" data-testid={`select-contact-role-${index}`}>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="General">General</SelectItem>
                            <SelectItem value="Accounts">Accounts</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Site">Site Contact</SelectItem>
                            <SelectItem value="Technical">Technical</SelectItem>
                          </SelectContent>
                        </Select>
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

                <Button type="submit" className="w-full sm:w-auto" data-testid="button-add-client">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              </form>
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
                              <Label className="text-xs">Name *</Label>
                              <Input
                                placeholder="Contact name"
                                value={newContact.name}
                                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                                data-testid={`input-new-contact-name-${client.id}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Role</Label>
                              <Input
                                placeholder="e.g., Site Manager"
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
                            <Button size="sm" onClick={() => handleAddContact(client.id)} data-testid={`button-save-contact-${client.id}`}>
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
                                        <Label className="text-xs">Name *</Label>
                                        <Input
                                          value={editingContact.name}
                                          onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                                          data-testid={`input-edit-contact-name-${contact.id}`}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Role</Label>
                                        <Input
                                          value={editingContact.role || ""}
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
    </div>
  );
}
