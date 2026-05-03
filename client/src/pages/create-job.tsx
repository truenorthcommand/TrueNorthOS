import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, ArrowRight, Plus, Trash2, Search, Building2, Users, Package, Calendar, ClipboardCheck, Send, Save, Upload, FileText, Image, Sparkles, Loader2, MapPin, Clock, AlertTriangle, Shield, Wrench, CheckCircle2, User
} from 'lucide-react';
import { format } from 'date-fns';

interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  postcode?: string;
  properties?: Property[];
}

interface Property {
  id: number;
  name?: string;
  address: string;
  postcode?: string;
  type?: string;
  notes?: string;
}

interface Engineer {
  id: number;
  name: string;
  email?: string;
  role: string;
  skills?: string[];
}

interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes: string;
}

interface AISuggestion {
  engineerId: number;
  engineerName: string;
  matchPercentage: number;
  reason: string;
}

const TRADE_CATEGORIES = [
  'Plumbing', 'Electrical', 'Tiling', 'Decorating', 'Carpentry',
  'Roofing', 'Gas', 'Grounds Keeping', 'General Maintenance', 'Full Refurbishment',
  'Plastering', 'Flooring', 'Glazing', 'Drainage', 'Fencing',
  'Brickwork', 'Insulation', 'Damp Proofing', 'Locksmith', 'Other'
];

const SESSIONS = ['AM', 'PM', 'Full Day', 'Specific Time'];
const FREQUENCIES = ['Weekly', 'Fortnightly', 'Monthly', 'Quarterly'];
const CHECKLIST_TEMPLATES = ['None', 'Gas Safety', 'Electrical Test', 'General Inspection', 'Bathroom Install', 'Kitchen Install', 'Custom'];

const STEP_ICONS = [Building2, ClipboardCheck, Calendar, Package, Image, Send];
const STEP_LABELS = ['Client & Property', 'Job Details', 'Schedule', 'Materials', 'Photos', 'Review'];

export default function CreateJob() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Client & Property
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientProperties, setClientProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [siteAddress, setSiteAddress] = useState('');
  const [sitePostcode, setSitePostcode] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Step 2: Job Details
  const [jobTitle, setJobTitle] = useState('');
  const [tradeCategory, setTradeCategory] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [description, setDescription] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const [healthSafetyNotes, setHealthSafetyNotes] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [isLongRunning, setIsLongRunning] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('Monthly');
  const [recurringEndDate, setRecurringEndDate] = useState('');

  // Step 3: Schedule & Assignment
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [session, setSession] = useState('AM');
  const [specificTime, setSpecificTime] = useState('09:00');
  const [estimatedDuration, setEstimatedDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState('hours');
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [engineerSearch, setEngineerSearch] = useState('');
  const [selectedEngineers, setSelectedEngineers] = useState<Engineer[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [loadingEngineers, setLoadingEngineers] = useState(false);
  const [loadingAiSuggest, setLoadingAiSuggest] = useState(false);

  // Step 4: Materials & Requirements
  const [materials, setMaterials] = useState<Material[]>([]);
  const [specialEquipment, setSpecialEquipment] = useState('');
  const [checklistTemplate, setChecklistTemplate] = useState('None');

  // Step 5: Photos & Documents
  const [photos, setPhotos] = useState<File[]>([]);
  const [photosPreviews, setPhotosPreviews] = useState<string[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [engineerNotes, setEngineerNotes] = useState('');

  // Fetch clients
  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await fetch('/api/clients', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  // Fetch client properties
  const fetchClientProperties = useCallback(async (clientId: number) => {
    setLoadingProperties(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setClientProperties(data.properties || []);
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err);
    } finally {
      setLoadingProperties(false);
    }
  }, []);

  // Fetch engineers
  const fetchEngineers = useCallback(async () => {
    setLoadingEngineers(true);
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (res.ok) {
        const users = await res.json();
        const engineerList = users.filter((u: Engineer) => u.role === 'engineer' || u.role === 'admin');
        setEngineers(engineerList);
      }
    } catch (err) {
      console.error('Failed to fetch engineers:', err);
    } finally {
      setLoadingEngineers(false);
    }
  }, []);

  // AI Suggest Engineers
  const handleAiSuggest = useCallback(async () => {
    setLoadingAiSuggest(true);
    try {
      const res = await fetch('/api/ai/suggest-engineers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: description,
          requiredSkills: [tradeCategory],
          location: sitePostcode,
        }),
      });
      if (res.ok) {
        const suggestions = await res.json();
        setAiSuggestions(suggestions);
      } else {
        toast({ title: 'AI suggestions unavailable', description: 'Could not get AI recommendations at this time.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'AI suggestions failed', description: 'Network error getting suggestions.', variant: 'destructive' });
    } finally {
      setLoadingAiSuggest(false);
    }
  }, [description, tradeCategory, sitePostcode, toast]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (selectedClient) {
      fetchClientProperties(selectedClient.id);
    }
  }, [selectedClient, fetchClientProperties]);

  useEffect(() => {
    if (currentStep === 3) {
      fetchEngineers();
    }
  }, [currentStep, fetchEngineers]);

  // Handle property selection
  const handlePropertySelect = (property: Property) => {
    setSelectedPropertyId(property.id);
    setSiteAddress(property.address || '');
    setSitePostcode(property.postcode || '');
  };

  // Handle engineer toggle
  const toggleEngineer = (engineer: Engineer) => {
    setSelectedEngineers(prev => {
      const exists = prev.find(e => e.id === engineer.id);
      if (exists) {
        return prev.filter(e => e.id !== engineer.id);
      }
      return [...prev, engineer];
    });
  };

  // Add material
  const addMaterial = () => {
    setMaterials(prev => [...prev, {
      id: crypto.randomUUID(),
      name: '',
      quantity: 1,
      unit: 'pcs',
      notes: ''
    }]);
  };

  // Update material
  const updateMaterial = (id: string, field: keyof Material, value: string | number) => {
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // Remove material
  const removeMaterial = (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  // Handle photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotosPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove photo
  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotosPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Handle document upload
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setDocuments(prev => [...prev, ...files]);
  };

  // Remove document
  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  // Submit job
  const handleSubmit = async (actionStatus: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: selectedClient?.id,
          customerName: selectedClient?.name,
          customerEmail: selectedClient?.email,
          customerPhone: selectedClient?.phone,
          siteAddress: siteAddress,
          sitePostcode: sitePostcode,
          propertyId: selectedPropertyId,
          nickname: jobTitle,
          description: description,
          notes: engineerNotes,
          date: scheduledDate,
          session: session === 'Specific Time' ? `Specific: ${specificTime}` : session,
          status: actionStatus,
          assignedToId: selectedEngineers[0]?.id || null,
          assignedToName: selectedEngineers[0]?.name || null,
          priority: priority,
          orderNumber: orderNumber || null,
          isLongRunning: isLongRunning,
          tradeCategory: tradeCategory,
          accessInstructions: accessInstructions,
          healthSafetyNotes: healthSafetyNotes,
          estimatedDuration: estimatedDuration,
          estimatedDurationUnit: durationUnit,
          isRecurring: isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency : null,
          recurringEndDate: isRecurring && recurringEndDate ? recurringEndDate : null,
          specialEquipment: specialEquipment,
          checklistTemplate: checklistTemplate,
          engineerNotes: engineerNotes,
          materials: materials.filter(m => m.name.trim()),
        }),
      });

      if (res.ok) {
        const job = await res.json();
        toast({
          title: 'Job Created',
          description: `Job sheet "${jobTitle}" has been ${actionStatus === 'Issued' ? 'issued' : 'saved'} successfully.`,
        });
        navigate(`/jobs/${job.id}`);
      } else {
        const err = await res.text();
        toast({ title: 'Error creating job', description: err, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Network error', description: 'Failed to create job. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter clients by search
  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Filter engineers by search
  const filteredEngineers = engineers.filter(e =>
    e.name?.toLowerCase().includes(engineerSearch.toLowerCase())
  );

  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case 1: return !!selectedClient && !!selectedPropertyId;
      case 2: return !!jobTitle.trim() && !!tradeCategory && !!description.trim();
      case 3: return !!scheduledDate;
      case 4: return true;
      case 5: return true;
      default: return true;
    }
  };

  const goNext = () => {
    if (currentStep < 6 && canGoNext()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Priority colors
  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Low': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'High': return 'bg-orange-50 text-orange-700 border-orange-300';
      case 'Emergency': return 'bg-red-50 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getPriorityBadgeVariant = (p: string) => {
    switch (p) {
      case 'Low': return 'secondary' as const;
      case 'Medium': return 'default' as const;
      case 'High': return 'default' as const;
      case 'Emergency': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  // Render Step 1: Client & Property
  function renderStep1() {
    return (
      <div className="space-y-6">
        {/* Client Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-[#E8A54B]" />
              Select Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedClient ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <p className="font-semibold text-green-800">{selectedClient.name}</p>
                    {selectedClient.email && <p className="text-sm text-green-600">{selectedClient.email}</p>}
                    {selectedClient.phone && <p className="text-sm text-green-600">{selectedClient.phone}</p>}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setSelectedClient(null); setSelectedPropertyId(null); setClientProperties([]); setSiteAddress(''); setSitePostcode(''); }}>
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients by name or email..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {loadingClients ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[#E8A54B]" />
                    <span className="ml-2 text-muted-foreground">Loading clients...</span>
                  </div>
                ) : (
                  <div className="grid gap-2 max-h-64 overflow-y-auto">
                    {filteredClients.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No clients found</p>
                    ) : (
                      filteredClients.slice(0, 20).map(client => (
                        <div
                          key={client.id}
                          className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 hover:border-[#E8A54B] transition-colors"
                          onClick={() => setSelectedClient(client)}
                        >
                          <div className="h-10 w-10 rounded-full bg-[#0F2B4C] flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-semibold text-sm">{client.name?.charAt(0)?.toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{client.name}</p>
                            {client.email && <p className="text-sm text-muted-foreground truncate">{client.email}</p>}
                          </div>
                          {client.phone && <span className="text-xs text-muted-foreground">{client.phone}</span>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Property Selection */}
        {selectedClient && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-[#E8A54B]" />
                Select Property
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingProperties ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-[#E8A54B]" />
                  <span className="ml-2 text-muted-foreground">Loading properties...</span>
                </div>
              ) : clientProperties.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-2">No properties found for this client</p>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${selectedClient.id}`)}>
                    <Plus className="h-4 w-4 mr-1" /> Add New Property
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2">
                  {clientProperties.map(property => (
                    <div
                      key={property.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedPropertyId === property.id
                          ? 'bg-[#E8A54B]/10 border-[#E8A54B]'
                          : 'hover:bg-gray-50 hover:border-gray-300'
                      }`}
                      onClick={() => handlePropertySelect(property)}
                    >
                      <MapPin className={`h-5 w-5 flex-shrink-0 ${selectedPropertyId === property.id ? 'text-[#E8A54B]' : 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        {property.name && <p className="font-medium">{property.name}</p>}
                        <p className="text-sm text-muted-foreground truncate">{property.address}</p>
                        {property.postcode && <p className="text-xs text-muted-foreground">{property.postcode}</p>}
                      </div>
                      {selectedPropertyId === property.id && <CheckCircle2 className="h-5 w-5 text-[#E8A54B]" />}
                    </div>
                  ))}
                </div>
              )}

              {/* Site address display */}
              {selectedPropertyId && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">Site Address:</p>
                  <p className="text-sm text-blue-700">{siteAddress}</p>
                  {sitePostcode && <p className="text-sm text-blue-700">Postcode: {sitePostcode}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Render Step 2: Job Details
  function renderStep2() {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-[#E8A54B]" />
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Job Title */}
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title / Nickname *</Label>
              <Input
                id="jobTitle"
                placeholder="e.g., Bathroom refit, Boiler service, Emergency leak repair"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>

            {/* Trade Category */}
            <div className="space-y-2">
              <Label>Trade Category *</Label>
              <Select value={tradeCategory} onValueChange={setTradeCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trade category" />
                </SelectTrigger>
                <SelectContent>
                  {TRADE_CATEGORIES.map(trade => (
                    <SelectItem key={trade} value={trade}>{trade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Level */}
            <div className="space-y-2">
              <Label>Priority Level</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['Low', 'Medium', 'High', 'Emergency'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`p-3 rounded-lg border-2 text-center font-medium text-sm transition-all ${
                      priority === p
                        ? getPriorityColor(p) + ' ring-2 ring-offset-1 ring-current'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setPriority(p)}
                  >
                    {p === 'Emergency' && <AlertTriangle className="h-4 w-4 mx-auto mb-1" />}
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Full Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Full Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the work required in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>

            {/* Access Instructions */}
            <div className="space-y-2">
              <Label htmlFor="accessInstructions" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Access Instructions
              </Label>
              <Textarea
                id="accessInstructions"
                placeholder="Key codes, parking info, gate codes, contact on arrival..."
                value={accessInstructions}
                onChange={(e) => setAccessInstructions(e.target.value)}
                rows={3}
              />
            </div>

            {/* H&S Notes */}
            <div className="space-y-2">
              <Label htmlFor="hsNotes" className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> H&S Notes
              </Label>
              <Textarea
                id="hsNotes"
                placeholder="Safety warnings, PPE requirements, hazards..."
                value={healthSafetyNotes}
                onChange={(e) => setHealthSafetyNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Order Number */}
            <div className="space-y-2">
              <Label htmlFor="orderNumber">Order Number (optional)</Label>
              <Input
                id="orderNumber"
                placeholder="PO or reference number"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
              />
            </div>

            {/* Long Running Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="font-medium">Long-Running Job?</Label>
                <p className="text-sm text-muted-foreground">Multi-day job spanning several visits</p>
              </div>
              <Switch checked={isLongRunning} onCheckedChange={setIsLongRunning} />
            </div>

            {/* Recurring Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="font-medium">Recurring Job?</Label>
                  <p className="text-sm text-muted-foreground">Repeat this job on a schedule</p>
                </div>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
              </div>
              {isRecurring && (
                <div className="ml-4 pl-4 border-l-2 border-[#E8A54B] space-y-3">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map(f => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End Date (optional)</Label>
                    <Input
                      type="date"
                      value={recurringEndDate}
                      onChange={(e) => setRecurringEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Step 3: Schedule & Assignment
  function renderStep3() {
    return (
      <div className="space-y-6">
        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-[#E8A54B]" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scheduled Date *</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Session</Label>
                <Select value={session} onValueChange={setSession}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {session === 'Specific Time' && (
              <div className="space-y-2">
                <Label>Specific Time</Label>
                <Input
                  type="time"
                  value={specificTime}
                  onChange={(e) => setSpecificTime(e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Duration</Label>
                <Input
                  type="number"
                  min={1}
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={durationUnit} onValueChange={setDurationUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assign Engineers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-[#E8A54B]" />
              Assign Engineer(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected engineers badges */}
            {selectedEngineers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedEngineers.map(eng => (
                  <Badge key={eng.id} className="bg-[#0F2B4C] text-white flex items-center gap-1 px-3 py-1">
                    <User className="h-3 w-3" />
                    {eng.name}
                    <button onClick={() => toggleEngineer(eng)} className="ml-1 hover:text-red-300">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Search & AI Suggest */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search engineers..."
                  value={engineerSearch}
                  onChange={(e) => setEngineerSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleAiSuggest}
                disabled={loadingAiSuggest || !description}
                className="flex items-center gap-2 border-[#E8A54B] text-[#E8A54B] hover:bg-[#E8A54B]/10"
              >
                {loadingAiSuggest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                AI Suggest
              </Button>
            </div>

            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="space-y-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm font-medium text-purple-800 flex items-center gap-1">
                  <Sparkles className="h-4 w-4" /> AI Recommendations
                </p>
                {aiSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-white rounded border cursor-pointer hover:border-purple-400"
                    onClick={() => {
                      const eng = engineers.find(e => e.id === suggestion.engineerId);
                      if (eng && !selectedEngineers.find(e => e.id === eng.id)) {
                        toggleEngineer(eng);
                      }
                    }}
                  >
                    <div>
                      <p className="font-medium text-sm">{suggestion.engineerName}</p>
                      <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                    </div>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                      {suggestion.matchPercentage}% match
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Engineer list */}
            {loadingEngineers ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[#E8A54B]" />
                <span className="ml-2 text-muted-foreground">Loading engineers...</span>
              </div>
            ) : (
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {filteredEngineers.map(eng => {
                  const isSelected = selectedEngineers.some(e => e.id === eng.id);
                  return (
                    <div
                      key={eng.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#0F2B4C]/5 border-[#0F2B4C]'
                          : 'hover:bg-gray-50 hover:border-gray-300'
                      }`}
                      onClick={() => toggleEngineer(eng)}
                    >
                      <div className="h-9 w-9 rounded-full bg-[#0F2B4C] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-xs">{eng.name?.charAt(0)?.toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{eng.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{eng.role}</p>
                      </div>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-[#0F2B4C]" />}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Step 4: Materials & Requirements
  function renderStep4() {
    return (
      <div className="space-y-6">
        {/* Materials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-[#E8A54B]" />
              Pre-listed Materials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {materials.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No materials added yet</p>
            ) : (
              <div className="space-y-3">
                {materials.map((material) => (
                  <div key={material.id} className="p-3 border rounded-lg space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-5">
                        <Input
                          placeholder="Material name"
                          value={material.name}
                          onChange={(e) => updateMaterial(material.id, 'name', e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          min={1}
                          value={material.quantity}
                          onChange={(e) => updateMaterial(material.id, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          placeholder="Unit"
                          value={material.unit}
                          onChange={(e) => updateMaterial(material.id, 'unit', e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          placeholder="Notes"
                          value={material.notes}
                          onChange={(e) => updateMaterial(material.id, 'notes', e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-1 flex items-center justify-center">
                        <Button variant="ghost" size="sm" onClick={() => removeMaterial(material.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={addMaterial} className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-2" /> Add Material
            </Button>
          </CardContent>
        </Card>

        {/* Special Equipment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5 text-[#E8A54B]" />
              Special Equipment & Checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Special Equipment Required</Label>
              <Textarea
                placeholder="List any special equipment or tools needed..."
                value={specialEquipment}
                onChange={(e) => setSpecialEquipment(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Checklist Template</Label>
              <Select value={checklistTemplate} onValueChange={setChecklistTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECKLIST_TEMPLATES.map(tmpl => (
                    <SelectItem key={tmpl} value={tmpl}>{tmpl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Step 5: Photos & Documents
  function renderStep5() {
    return (
      <div className="space-y-6">
        {/* Reference Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Image className="h-5 w-5 text-[#E8A54B]" />
              Reference Photos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-[#E8A54B] transition-colors">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-upload"
              />
              <label htmlFor="photo-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium">Click to upload photos</p>
                <p className="text-sm text-muted-foreground">JPG, PNG, or HEIC</p>
              </label>
            </div>
            {photosPreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {photosPreviews.map((preview, idx) => (
                  <div key={idx} className="relative group">
                    <img src={preview} alt={`Photo ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border" />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-[#E8A54B]" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-[#E8A54B] transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xlsx"
                multiple
                onChange={handleDocUpload}
                className="hidden"
                id="doc-upload"
              />
              <label htmlFor="doc-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium">Click to upload documents</p>
                <p className="text-sm text-muted-foreground">PDF, DOC, DOCX, XLSX</p>
              </label>
            </div>
            {documents.length > 0 && (
              <div className="space-y-2">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{doc.name}</span>
                      <span className="text-xs text-muted-foreground">({(doc.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeDocument(idx)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes for Engineer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-[#E8A54B]" />
              Notes for Engineer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Private notes visible only to engineers when they view this job..."
              value={engineerNotes}
              onChange={(e) => setEngineerNotes(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Step 6: Review & Issue
  function renderStep6() {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-[#E8A54B]" />
              Review Job Sheet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Client & Location */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#0F2B4C]" />
                <span className="font-semibold">{selectedClient?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{siteAddress}{sitePostcode ? `, ${sitePostcode}` : ''}</span>
              </div>
            </div>

            {/* Job Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Job Title</p>
                <p className="font-medium">{jobTitle}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trade</p>
                <p className="font-medium">{tradeCategory}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Priority</p>
                <Badge variant={getPriorityBadgeVariant(priority)}>{priority}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="font-medium">{orderNumber || 'N/A'}</p>
              </div>
            </div>

            {/* Schedule */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-700" />
                <span className="font-medium text-blue-800">Schedule</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-blue-600">Date: </span>
                  <span className="text-blue-800 font-medium">{scheduledDate ? format(new Date(scheduledDate), 'dd MMM yyyy') : 'Not set'}</span>
                </div>
                <div>
                  <span className="text-blue-600">Session: </span>
                  <span className="text-blue-800 font-medium">{session === 'Specific Time' ? `At ${specificTime}` : session}</span>
                </div>
                <div>
                  <span className="text-blue-600">Duration: </span>
                  <span className="text-blue-800 font-medium">{estimatedDuration} {durationUnit}</span>
                </div>
                {isLongRunning && (
                  <div>
                    <Badge variant="secondary">Long-Running</Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Engineers */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Assigned Engineer(s)</p>
              {selectedEngineers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedEngineers.map(eng => (
                    <Badge key={eng.id} className="bg-[#0F2B4C] text-white">
                      <User className="h-3 w-3 mr-1" />
                      {eng.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No engineer assigned</p>
              )}
            </div>

            {/* Description */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <p className="text-sm bg-gray-50 p-3 rounded-lg">{description.length > 200 ? description.slice(0, 200) + '...' : description}</p>
            </div>

            {/* Counts */}
            <div className="grid grid-cols-3 gap-4 pt-3 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#0F2B4C]">{materials.filter(m => m.name.trim()).length}</p>
                <p className="text-xs text-muted-foreground">Materials</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#0F2B4C]">{photos.length}</p>
                <p className="text-xs text-muted-foreground">Photos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#0F2B4C]">{documents.length}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </div>

            {/* Recurring Info */}
            {isRecurring && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-800">Recurring: {recurringFrequency}</p>
                {recurringEndDate && <p className="text-xs text-amber-600">Until: {format(new Date(recurringEndDate), 'dd MMM yyyy')}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            onClick={() => handleSubmit('Draft')}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save as Draft
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit('Ready')}
            disabled={isSubmitting}
            className="w-full bg-[#0F2B4C] text-white hover:bg-[#0F2B4C]/90"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Save as Ready
          </Button>
          <Button
            onClick={() => handleSubmit('Issued')}
            disabled={isSubmitting}
            className="w-full bg-[#E8A54B] text-white hover:bg-[#E8A54B]/90"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Issue to Engineer
          </Button>
        </div>
      </div>
    );
  }

  // Render current step
  function renderCurrentStep() {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      default: return renderStep1();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* Top Row: Back + Title */}
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/jobs')} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Jobs
            </Button>
            <h1 className="text-lg font-bold text-[#0F2B4C]">Create Job Sheet</h1>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-between">
            {STEP_LABELS.map((label, idx) => {
              const stepNum = idx + 1;
              const StepIcon = STEP_ICONS[idx];
              const isActive = stepNum === currentStep;
              const isCompleted = stepNum < currentStep;

              return (
                <div key={stepNum} className="flex flex-col items-center flex-1">
                  <div className="flex items-center w-full">
                    {idx > 0 && (
                      <div className={`flex-1 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                    <button
                      onClick={() => {
                        if (stepNum < currentStep) setCurrentStep(stepNum);
                      }}
                      className={`relative flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all flex-shrink-0 ${
                        isActive
                          ? 'border-[#E8A54B] bg-[#E8A54B] text-white shadow-md'
                          : isCompleted
                            ? 'border-green-500 bg-green-500 text-white'
                            : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </button>
                    {idx < STEP_LABELS.length - 1 && (
                      <div className={`flex-1 h-0.5 ${stepNum < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 text-center leading-tight hidden sm:block ${
                    isActive ? 'text-[#E8A54B] font-semibold' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {renderCurrentStep()}

        {/* Navigation Footer */}
        {currentStep < 6 && (
          <div className="flex justify-between mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={currentStep === 1}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              onClick={goNext}
              disabled={!canGoNext()}
              className="flex items-center gap-2 bg-[#E8A54B] text-white hover:bg-[#E8A54B]/90"
            >
              Next Step
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
