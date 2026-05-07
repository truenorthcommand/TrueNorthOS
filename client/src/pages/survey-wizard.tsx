import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { ArrowLeft, ArrowRight, Plus, Trash2, Mic, MicOff, MapPin, Camera, Save, ChevronDown, ChevronUp, Search, CheckCircle2, Loader2, Upload, X, Home, Wrench } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Client { id: number; name: string; phone?: string; email?: string; }
interface Property { id: number; client_id: number; address: string; postcode?: string; lat?: number; lng?: number; }
interface RoomTemplate { room_name: string; room_type: string; checklist: string[]; }
interface WizardRoom {
  local_id: string; server_id?: number; room_name: string; room_type: string;
  checklist_ref: string[]; selected: boolean; length_m: string; width_m: string;
  height_m: string; condition: string; notes: string; work_items: WorkItem[]; photos: File[];
}
interface WorkItem {
  local_id: string; server_id?: number; description: string; type: string;
  priority: string; quantity: string; unit: string; length_m: string; width_m: string; height_m: string; notes: string;
}
type SurveyType = 'bathroom' | 'kitchen' | 'full' | 'electrical' | 'roofing' | 'external' | 'custom';

// ─── Template Data ─────────────────────────────────────────────────────────────
const SURVEY_TYPES: { key: SurveyType; label: string; icon: string }[] = [
  { key: 'bathroom', label: 'Bathroom', icon: '🛁' },
  { key: 'kitchen', label: 'Kitchen', icon: '🍳' },
  { key: 'full', label: 'Full Property', icon: '🏠' },
  { key: 'electrical', label: 'Electrical', icon: '⚡' },
  { key: 'roofing', label: 'Roofing', icon: '🏗️' },
  { key: 'external', label: 'External/Garden', icon: '🌳' },
  { key: 'custom', label: 'Custom', icon: '📝' },
];

const ROOM_TEMPLATES: Record<SurveyType, RoomTemplate[]> = {
  bathroom: [{ room_name: 'Bathroom', room_type: 'bathroom', checklist: ['Plumbing condition', 'Tile condition', 'Ventilation', 'Lighting', 'Water pressure', 'Drainage', 'Fixtures condition'] }],
  kitchen: [{ room_name: 'Kitchen', room_type: 'kitchen', checklist: ['Plumbing condition', 'Electrical points', 'Ventilation', 'Flooring', 'Wall condition', 'Worktop measurements', 'Appliance spaces'] }],
  full: [
    { room_name: 'Living Room', room_type: 'living', checklist: ['Walls', 'Ceiling', 'Flooring', 'Windows', 'Electrical', 'Heating'] },
    { room_name: 'Kitchen', room_type: 'kitchen', checklist: ['Plumbing', 'Electrical', 'Ventilation', 'Flooring', 'Walls'] },
    { room_name: 'Bathroom', room_type: 'bathroom', checklist: ['Plumbing', 'Tiles', 'Ventilation', 'Fixtures'] },
    { room_name: 'Bedroom 1', room_type: 'bedroom', checklist: ['Walls', 'Ceiling', 'Flooring', 'Windows', 'Electrical'] },
    { room_name: 'Hallway', room_type: 'hallway', checklist: ['Walls', 'Flooring', 'Lighting', 'Doors'] },
    { room_name: 'Exterior', room_type: 'exterior', checklist: ['Roof', 'Guttering', 'Walls', 'Windows', 'Doors', 'Drainage'] },
  ],
  electrical: [
    { room_name: 'Consumer Unit', room_type: 'utility', checklist: ['Board condition', 'RCD protection', 'Circuit labelling', 'Earthing', 'Bonding'] },
    { room_name: 'General Circuits', room_type: 'general', checklist: ['Socket condition', 'Lighting circuits', 'Switches', 'Wiring age', 'Overloading signs'] },
  ],
  roofing: [
    { room_name: 'Roof Exterior', room_type: 'exterior', checklist: ['Tiles/slates', 'Ridge', 'Valleys', 'Flashing', 'Guttering', 'Fascia/soffit'] },
    { room_name: 'Loft Space', room_type: 'loft', checklist: ['Insulation', 'Ventilation', 'Timbers', 'Water tanks', 'Wiring'] },
  ],
  external: [
    { room_name: 'Front Exterior', room_type: 'exterior', checklist: ['Walls', 'Windows', 'Door', 'Driveway', 'Fencing'] },
    { room_name: 'Rear Exterior', room_type: 'exterior', checklist: ['Walls', 'Windows', 'Patio', 'Garden', 'Fencing', 'Drainage'] },
  ],
  custom: [],
};

const CONDITION_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor'];
const WORK_ITEM_TYPES = ['material', 'labour', 'both'];
const PRIORITY_OPTIONS = ['essential', 'recommended', 'optional'];
const UNIT_OPTIONS = ['sqm', 'lm', 'each', 'hours', 'days'];
const STEPS = ['Client & Property', 'Survey Setup', 'Room Details', 'Review & Save'];

// ─── Helper ────────────────────────────────────────────────────────────────────
function createWorkItem(): WorkItem {
  return { local_id: crypto.randomUUID(), description: '', type: 'material', priority: 'recommended', quantity: '1', unit: 'each', length_m: '', width_m: '', height_m: '', notes: '' };
}

function createRoom(name: string, type: string, checklist: string[]): WizardRoom {
  return { local_id: crypto.randomUUID(), room_name: name, room_type: type, checklist_ref: checklist, selected: true, length_m: '', width_m: '', height_m: '', condition: '', notes: '', work_items: [], photos: [] };
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SurveyWizard() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/surveys/:id');
  const surveyId = params?.id === 'new' ? null : params?.id ? Number(params.id) : null;
  const isEditing = surveyId !== null;

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Wizard State ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientName, setClientName] = useState('');
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [propertyAddress, setPropertyAddress] = useState('');
  const [surveyType, setSurveyType] = useState<SurveyType | null>(null);
  const [rooms, setRooms] = useState<WizardRoom[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');
  const [conditionRating, setConditionRating] = useState('');
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // ─── Client Search ─────────────────────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');

  // ─── Property Search ───────────────────────────────────────────────────────
  const [propertySearch, setPropertySearch] = useState('');
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showNewPropertyForm, setShowNewPropertyForm] = useState(false);
  const [newPropertyAddress, setNewPropertyAddress] = useState('');
  const [newPropertyPostcode, setNewPropertyPostcode] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  // ─── Voice recording ───────────────────────────────────────────────────────
  const [activeVoiceRoom, setActiveVoiceRoom] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // ─── Custom room form ──────────────────────────────────────────────────────
  const [customRoomName, setCustomRoomName] = useState('');

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    queryFn: () => fetch('/api/clients', { credentials: 'include' }).then(r => r.json()),
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/clients', clientId, 'properties'],
    queryFn: () => fetch(`/api/clients/${clientId}/properties`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!clientId,
  });

  const { data: existingSurvey } = useQuery({
    queryKey: ['/api/surveys', surveyId],
    queryFn: () => fetch(`/api/surveys/${surveyId}`, { credentials: 'include' }).then(r => r.json()),
    enabled: isEditing,
  });

  // ─── Load existing survey data ─────────────────────────────────────────────
  useEffect(() => {
    if (!existingSurvey) return;
    setClientId(existingSurvey.client_id || null);
    setClientName(existingSurvey.client_name || '');
    setPropertyId(existingSurvey.property_id || null);
    setPropertyAddress(existingSurvey.property_address || '');
    setSurveyType(existingSurvey.survey_type || null);
    setGeneralNotes(existingSurvey.general_notes || '');
    setAccessNotes(existingSurvey.access_notes || '');
    setSafetyNotes(existingSurvey.safety_notes || '');
    setConditionRating(existingSurvey.condition_rating || '');
    if (existingSurvey.rooms?.length) {
      setRooms(existingSurvey.rooms.map((r: any) => ({
        local_id: crypto.randomUUID(), server_id: r.id, room_name: r.room_name || '',
        room_type: r.room_type || '', checklist_ref: r.checklist_ref || [],
        selected: true, length_m: r.length_m?.toString() || '', width_m: r.width_m?.toString() || '',
        height_m: r.height_m?.toString() || '', condition: r.condition || '',
        notes: r.notes || '', photos: [],
        work_items: (r.work_items || []).map((w: any) => ({
          local_id: crypto.randomUUID(), server_id: w.id, description: w.description || '',
          type: w.type || 'material', priority: w.priority || 'recommended',
          quantity: w.quantity?.toString() || '1', unit: w.unit || 'each',
          length_m: w.length_m?.toString() || '', width_m: w.width_m?.toString() || '',
          height_m: w.height_m?.toString() || '', notes: w.notes || '',
        })),
      })));
    }
  }, [existingSurvey]);

  // ─── Filtered lists ────────────────────────────────────────────────────────
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );
  const filteredProperties = properties.filter(p =>
    p.address.toLowerCase().includes(propertySearch.toLowerCase())
  );

  // ─── Navigation ────────────────────────────────────────────────────────────
  const goBack = () => { if (step > 1) setStep(step - 1); else navigate('/surveys'); };
  const goNext = () => { if (step < 4) setStep(step + 1); };

  // ─── Client selection ──────────────────────────────────────────────────────
  const selectClient = (client: Client) => {
    setClientId(client.id); setClientName(client.name);
    setShowClientDropdown(false); setClientSearch('');
    setPropertyId(null); setPropertyAddress('');
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const res = await fetch('/api/clients', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName, phone: newClientPhone, email: newClientEmail }),
      });
      const client = await res.json();
      selectClient(client);
      setShowNewClientForm(false); setNewClientName(''); setNewClientPhone(''); setNewClientEmail('');
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({ title: 'Client created' });
    } catch { toast({ title: 'Failed to create client', variant: 'destructive' }); }
  };

  // ─── Property selection ────────────────────────────────────────────────────
  const selectProperty = (property: Property) => {
    setPropertyId(property.id); setPropertyAddress(property.address);
    setShowPropertyDropdown(false); setPropertySearch('');
  };

  const handleCreateProperty = async () => {
    if (!newPropertyAddress.trim() || !clientId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/properties`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: newPropertyAddress, postcode: newPropertyPostcode, client_id: clientId }),
      });
      const property = await res.json();
      selectProperty(property);
      setShowNewPropertyForm(false); setNewPropertyAddress(''); setNewPropertyPostcode('');
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'properties'] });
      toast({ title: 'Property created' });
    } catch { toast({ title: 'Failed to create property', variant: 'destructive' }); }
  };

  const captureGPS = () => {
    if (!navigator.geolocation) { toast({ title: 'GPS not supported', variant: 'destructive' }); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGpsLoading(false); toast({ title: `GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` }); },
      () => { setGpsLoading(false); toast({ title: 'GPS failed', variant: 'destructive' }); },
      { enableHighAccuracy: true }
    );
  };

  // ─── Survey type selection ─────────────────────────────────────────────────
  const handleSelectSurveyType = (type: SurveyType) => {
    setSurveyType(type);
    const templates = ROOM_TEMPLATES[type];
    setRooms(templates.map(t => createRoom(t.room_name, t.room_type, t.checklist)));
  };

  const toggleRoomSelected = (localId: string) => {
    setRooms(prev => prev.map(r => r.local_id === localId ? { ...r, selected: !r.selected } : r));
  };

  const addCustomRoom = () => {
    if (!customRoomName.trim()) return;
    setRooms(prev => [...prev, createRoom(customRoomName.trim(), 'custom', [])]);
    setCustomRoomName('');
  };

  // ─── Room details helpers ──────────────────────────────────────────────────
  const selectedRooms = rooms.filter(r => r.selected);

  const toggleExpanded = (localId: string) => {
    setExpandedRooms(prev => {
      const next = new Set(prev);
      next.has(localId) ? next.delete(localId) : next.add(localId);
      return next;
    });
  };

  const updateRoom = (localId: string, updates: Partial<WizardRoom>) => {
    setRooms(prev => prev.map(r => r.local_id === localId ? { ...r, ...updates } : r));
  };

  const addWorkItem = (roomId: string) => {
    setRooms(prev => prev.map(r => r.local_id === roomId ? { ...r, work_items: [...r.work_items, createWorkItem()] } : r));
  };

  const updateWorkItem = (roomId: string, itemId: string, updates: Partial<WorkItem>) => {
    setRooms(prev => prev.map(r => r.local_id === roomId ? {
      ...r, work_items: r.work_items.map(w => w.local_id === itemId ? { ...w, ...updates } : w)
    } : r));
  };

  const removeWorkItem = (roomId: string, itemId: string) => {
    setRooms(prev => prev.map(r => r.local_id === roomId ? {
      ...r, work_items: r.work_items.filter(w => w.local_id !== itemId)
    } : r));
  };

  const handlePhotoUpload = (roomId: string, files: FileList | null) => {
    if (!files) return;
    setRooms(prev => prev.map(r => r.local_id === roomId ? {
      ...r, photos: [...r.photos, ...Array.from(files)]
    } : r));
  };

  const removePhoto = (roomId: string, idx: number) => {
    setRooms(prev => prev.map(r => r.local_id === roomId ? {
      ...r, photos: r.photos.filter((_, i) => i !== idx)
    } : r));
  };

  const handleCameraCapture = (roomId: string) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = (e) => handlePhotoUpload(roomId, (e.target as HTMLInputElement).files);
    input.click();
  };

  // ─── Voice-to-text ─────────────────────────────────────────────────────────
  const toggleVoice = async (roomId: string) => {
    if (activeVoiceRoom === roomId) {
      mediaRecorderRef.current?.stop(); setActiveVoiceRoom(null); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        toast({ title: 'Voice recording saved (transcription pending)' });
      };
      recorder.start(); mediaRecorderRef.current = recorder; setActiveVoiceRoom(roomId);
    } catch { toast({ title: 'Microphone access denied', variant: 'destructive' }); }
  };

  // ─── Save logic ────────────────────────────────────────────────────────────
  const handleSave = async (status: 'draft' | 'complete') => {
    if (!clientId || !propertyId || !surveyType) {
      toast({ title: 'Please complete all required fields', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const surveyBody = {
        client_id: clientId, property_id: propertyId, survey_type: surveyType,
        status, general_notes: generalNotes, access_notes: accessNotes,
        safety_notes: safetyNotes, condition_rating: conditionRating,
      };

      let savedSurveyId = surveyId;
      if (isEditing) {
        await fetch(`/api/surveys/${surveyId}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(surveyBody),
        });
      } else {
        const res = await fetch('/api/surveys', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(surveyBody),
        });
        const created = await res.json();
        savedSurveyId = created.id;
      }

      // Save rooms and work items
      for (const room of selectedRooms) {
        const roomBody = {
          room_name: room.room_name, room_type: room.room_type, notes: room.notes,
          length_m: room.length_m ? parseFloat(room.length_m) : null,
          width_m: room.width_m ? parseFloat(room.width_m) : null,
          height_m: room.height_m ? parseFloat(room.height_m) : null,
          condition: room.condition, checklist_ref: JSON.stringify(room.checklist_ref),
        };

        let roomId = room.server_id;
        if (room.server_id) {
          await fetch(`/api/surveys/${savedSurveyId}/rooms/${room.server_id}`, {
            method: 'PATCH', credentials: 'include',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(roomBody),
          });
        } else {
          const res = await fetch(`/api/surveys/${savedSurveyId}/rooms`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(roomBody),
          });
          const created = await res.json();
          roomId = created.id;
        }

        // Save work items
        for (const item of room.work_items) {
          if (!item.description.trim()) continue;
          await fetch(`/api/surveys/${savedSurveyId}/rooms/${roomId}/work-items`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: item.description, type: item.type, priority: item.priority,
              quantity: item.quantity ? parseFloat(item.quantity) : 1, unit: item.unit,
              length_m: item.length_m ? parseFloat(item.length_m) : null,
              width_m: item.width_m ? parseFloat(item.width_m) : null,
              height_m: item.height_m ? parseFloat(item.height_m) : null, notes: item.notes,
            }),
          });
        }

        // Upload photos
        for (const photo of room.photos) {
          const formData = new FormData();
          formData.append('file', photo);
          if (roomId) formData.append('survey_room_id', roomId.toString());
          await fetch(`/api/surveys/${savedSurveyId}/media`, {
            method: 'POST', credentials: 'include', body: formData,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/surveys'] });
      toast({ title: status === 'draft' ? 'Survey saved as draft' : 'Survey marked complete' });
      navigate('/surveys');
    } catch (err) {
      toast({ title: 'Failed to save survey', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // ─── Step Indicator ────────────────────────────────────────────────────────
  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-6 px-2">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = step === stepNum;
        const isDone = step > stepNum;
        return (
          <div key={label} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
              isActive ? 'bg-blue-600 text-white' : isDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>{isDone ? '✓' : stepNum}</div>
            <span className={`ml-2 text-xs hidden sm:inline ${
              isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'
            }`}>{label}</span>
            {i < STEPS.length - 1 && <div className="w-8 sm:w-16 h-px bg-gray-300 mx-2" />}
          </div>
        );
      })}
    </div>
  );

  // ─── Step 1: Client & Property ─────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Client Search */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Client</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {clientId ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle2 className="w-3 h-3" />{clientName}</Badge>
              <Button variant="ghost" size="sm" onClick={() => { setClientId(null); setClientName(''); setPropertyId(null); setPropertyAddress(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search clients..." value={clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                  onFocus={() => setShowClientDropdown(true)} className="pl-10" />
              </div>
              {showClientDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No clients found</div>
                  ) : filteredClients.map(c => (
                    <button key={c.id} className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                      onClick={() => selectClient(c)}>{c.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowNewClientForm(!showNewClientForm)}>
            <Plus className="w-4 h-4 mr-1" /> Quick-add Client
          </Button>
          {showNewClientForm && (
            <div className="p-3 border rounded-md space-y-2 bg-gray-50">
              <Input placeholder="Name *" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
              <Input placeholder="Phone" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
              <Input placeholder="Email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
              <Button size="sm" onClick={handleCreateClient} disabled={!newClientName.trim()}>Create Client</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Property Search */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Property</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!clientId ? (
            <p className="text-sm text-gray-500">Select a client first</p>
          ) : propertyId ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle2 className="w-3 h-3" />{propertyAddress}</Badge>
              <Button variant="ghost" size="sm" onClick={() => { setPropertyId(null); setPropertyAddress(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search properties..." value={propertySearch}
                  onChange={(e) => { setPropertySearch(e.target.value); setShowPropertyDropdown(true); }}
                  onFocus={() => setShowPropertyDropdown(true)} className="pl-10" />
              </div>
              {showPropertyDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredProperties.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No properties found</div>
                  ) : filteredProperties.map(p => (
                    <button key={p.id} className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                      onClick={() => selectProperty(p)}>{p.address}{p.postcode ? ` (${p.postcode})` : ''}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {clientId && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowNewPropertyForm(!showNewPropertyForm)}>
                <Plus className="w-4 h-4 mr-1" /> Add New Property
              </Button>
              {showNewPropertyForm && (
                <div className="p-3 border rounded-md space-y-2 bg-gray-50">
                  <Input placeholder="Address *" value={newPropertyAddress} onChange={(e) => setNewPropertyAddress(e.target.value)} />
                  <Input placeholder="Postcode" value={newPropertyPostcode} onChange={(e) => setNewPropertyPostcode(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreateProperty} disabled={!newPropertyAddress.trim()}>Create Property</Button>
                    <Button size="sm" variant="outline" onClick={captureGPS} disabled={gpsLoading}>
                      {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                      <span className="ml-1">GPS</span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ─── Step 2: Survey Setup ──────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Survey Type Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Select Survey Type</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SURVEY_TYPES.map(({ key, label, icon }) => (
            <button key={key} onClick={() => handleSelectSurveyType(key)}
              className={`p-4 rounded-lg border-2 text-center transition-all hover:shadow-md ${
                surveyType === key ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <div className="text-3xl mb-2">{icon}</div>
              <div className="text-sm font-medium">{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Room Selection */}
      {surveyType && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Rooms to Survey</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {rooms.length === 0 && surveyType === 'custom' && (
              <p className="text-sm text-gray-500">Add rooms manually for a custom survey.</p>
            )}
            {rooms.map(room => (
              <div key={room.local_id} className="flex items-start gap-3 p-3 border rounded-md">
                <input type="checkbox" checked={room.selected}
                  onChange={() => toggleRoomSelected(room.local_id)}
                  className="mt-1 w-4 h-4 rounded border-gray-300" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{room.room_name}</div>
                  {room.checklist_ref.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">{room.checklist_ref.join(' • ')}</div>
                  )}
                </div>
              </div>
            ))}
            {/* Add Custom Room */}
            <div className="flex gap-2 pt-2 border-t">
              <Input placeholder="Custom room name" value={customRoomName}
                onChange={(e) => setCustomRoomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCustomRoom(); }} className="flex-1" />
              <Button size="sm" onClick={addCustomRoom} disabled={!customRoomName.trim()}>
                <Plus className="w-4 h-4 mr-1" /> Add Custom Room
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ─── Step 3: Room Details ──────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Room Details</h3>
      {selectedRooms.length === 0 ? (
        <p className="text-sm text-gray-500">No rooms selected. Go back to add rooms.</p>
      ) : selectedRooms.map(room => {
        const isExpanded = expandedRooms.has(room.local_id);
        const area = room.length_m && room.width_m
          ? (parseFloat(room.length_m) * parseFloat(room.width_m)).toFixed(1) : null;

        return (
          <Card key={room.local_id} className="overflow-hidden">
            <button className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              onClick={() => toggleExpanded(room.local_id)}>
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">{room.room_name}</span>
                <Badge variant="secondary" className="text-xs">{room.room_type}</Badge>
                {room.work_items.length > 0 && (
                  <Badge className="text-xs bg-blue-100 text-blue-700">{room.work_items.length} items</Badge>
                )}
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isExpanded && (
              <CardContent className="p-4 space-y-4">
                {/* Room name edit */}
                <div>
                  <Label className="text-xs">Room Name</Label>
                  <Input value={room.room_name} onChange={(e) => updateRoom(room.local_id, { room_name: e.target.value })} />
                </div>

                {/* Reference checklist */}
                {room.checklist_ref.length > 0 && (
                  <div className="text-xs text-gray-400 italic">
                    <span className="font-medium">Reference:</span> {room.checklist_ref.join(', ')}
                  </div>
                )}

                {/* Measurements */}
                <div>
                  <Label className="text-xs font-medium">Measurements</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <div>
                      <Label className="text-xs text-gray-500">Length (m)</Label>
                      <Input type="number" step="0.1" value={room.length_m}
                        onChange={(e) => updateRoom(room.local_id, { length_m: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Width (m)</Label>
                      <Input type="number" step="0.1" value={room.width_m}
                        onChange={(e) => updateRoom(room.local_id, { width_m: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Height (m)</Label>
                      <Input type="number" step="0.1" value={room.height_m}
                        onChange={(e) => updateRoom(room.local_id, { height_m: e.target.value })} />
                    </div>
                  </div>
                  {area && <p className="text-xs text-blue-600 mt-1 font-medium">Floor area: {area} m²</p>}
                </div>

                {/* Condition */}
                <div>
                  <Label className="text-xs">Condition</Label>
                  <Select value={room.condition} onValueChange={(v) => updateRoom(room.local_id, { condition: v })}>
                    <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes with voice */}
                <div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Notes</Label>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleVoice(room.local_id)}>
                      {activeVoiceRoom === room.local_id ? <MicOff className="w-3 h-3 text-red-500" /> : <Mic className="w-3 h-3" />}
                    </Button>
                  </div>
                  <Textarea value={room.notes} onChange={(e) => updateRoom(room.local_id, { notes: e.target.value })}
                    placeholder="Add notes about this room..." rows={3} />
                </div>

                {/* Work Items */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium flex items-center gap-1"><Wrench className="w-4 h-4" /> Work Items</Label>
                    <Button variant="outline" size="sm" onClick={() => addWorkItem(room.local_id)}>
                      <Plus className="w-3 h-3 mr-1" /> Add Work Item
                    </Button>
                  </div>
                  {room.work_items.map((item) => (
                    <div key={item.local_id} className="p-3 border rounded-md mb-2 bg-gray-50 space-y-2">
                      <div className="flex gap-2">
                        <Input placeholder="Description *" value={item.description}
                          onChange={(e) => updateWorkItem(room.local_id, item.local_id, { description: e.target.value })} className="flex-1" />
                        <Button variant="ghost" size="sm" onClick={() => removeWorkItem(room.local_id, item.local_id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Select value={item.type} onValueChange={(v) => updateWorkItem(room.local_id, item.local_id, { type: v })}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{WORK_ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={item.priority} onValueChange={(v) => updateWorkItem(room.local_id, item.local_id, { priority: v })}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" placeholder="Qty" value={item.quantity}
                          onChange={(e) => updateWorkItem(room.local_id, item.local_id, { quantity: e.target.value })} className="text-xs" />
                        <Select value={item.unit} onValueChange={(v) => updateWorkItem(room.local_id, item.local_id, { unit: v })}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input type="number" step="0.1" placeholder="L (m)" value={item.length_m}
                          onChange={(e) => updateWorkItem(room.local_id, item.local_id, { length_m: e.target.value })} className="text-xs" />
                        <Input type="number" step="0.1" placeholder="W (m)" value={item.width_m}
                          onChange={(e) => updateWorkItem(room.local_id, item.local_id, { width_m: e.target.value })} className="text-xs" />
                        <Input type="number" step="0.1" placeholder="H (m)" value={item.height_m}
                          onChange={(e) => updateWorkItem(room.local_id, item.local_id, { height_m: e.target.value })} className="text-xs" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Photos */}
                <div className="border-t pt-3">
                  <Label className="text-sm font-medium">Photos</Label>
                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
                      input.onchange = (e) => handlePhotoUpload(room.local_id, (e.target as HTMLInputElement).files);
                      input.click();
                    }}><Upload className="w-4 h-4 mr-1" /> Upload</Button>
                    <Button variant="outline" size="sm" onClick={() => handleCameraCapture(room.local_id)}>
                      <Camera className="w-4 h-4 mr-1" /> Camera
                    </Button>
                  </div>
                  {room.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {room.photos.map((photo, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-md overflow-hidden border">
                          <img src={URL.createObjectURL(photo)} alt="" className="w-full h-full object-cover" />
                          <button className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                            onClick={() => removePhoto(room.local_id, idx)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );

  // ─── Step 4: Review & Save ─────────────────────────────────────────────────
  const renderStep4 = () => {
    const totalWorkItems = selectedRooms.reduce((sum, r) => sum + r.work_items.length, 0);
    const totalPhotos = selectedRooms.reduce((sum, r) => sum + r.photos.length, 0);

    return (
      <div className="space-y-6">
        {/* Summary */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Survey Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500">Client:</div>
              <div className="font-medium">{clientName || '—'}</div>
              <div className="text-gray-500">Property:</div>
              <div className="font-medium">{propertyAddress || '—'}</div>
              <div className="text-gray-500">Survey Type:</div>
              <div className="font-medium capitalize">{surveyType || '—'}</div>
              <div className="text-gray-500">Rooms:</div>
              <div className="font-medium">{selectedRooms.length}</div>
              <div className="text-gray-500">Work Items:</div>
              <div className="font-medium">{totalWorkItems}</div>
              <div className="text-gray-500">Photos:</div>
              <div className="font-medium">{totalPhotos}</div>
            </div>

            {/* Room breakdown */}
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-medium mb-2">Rooms</h4>
              {selectedRooms.map(room => {
                const area = room.length_m && room.width_m
                  ? `${(parseFloat(room.length_m) * parseFloat(room.width_m)).toFixed(1)} m²` : null;
                return (
                  <div key={room.local_id} className="flex items-center justify-between py-1 text-sm">
                    <span>{room.room_name}</span>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {area && <span>{area}</span>}
                      {room.work_items.length > 0 && <Badge variant="secondary" className="text-xs">{room.work_items.length} items</Badge>}
                      {room.photos.length > 0 && <Badge variant="secondary" className="text-xs">{room.photos.length} 📷</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Notes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>General Notes</Label>
              <Textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="General observations about the survey..." rows={3} />
            </div>
            <div>
              <Label>Access Notes</Label>
              <Textarea value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)}
                placeholder="Parking, key location, access codes..." rows={2} />
            </div>
            <div>
              <Label>Safety Notes</Label>
              <Textarea value={safetyNotes} onChange={(e) => setSafetyNotes(e.target.value)}
                placeholder="Hazards, safety concerns..." rows={2} />
            </div>
            <div>
              <Label>Overall Condition Rating</Label>
              <Select value={conditionRating} onValueChange={setConditionRating}>
                <SelectTrigger><SelectValue placeholder="Select rating" /></SelectTrigger>
                <SelectContent>
                  {['Excellent', 'Good', 'Fair', 'Poor', 'Urgent'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => handleSave('draft')} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save as Draft
          </Button>
          <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleSave('complete')} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Mark Complete
          </Button>
        </div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold flex-1">
            {isEditing ? 'Edit Survey' : 'New Survey'}
          </h1>
          <span className="text-sm text-gray-500">Step {step} of 4</span>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <StepIndicator />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Bottom Navigation */}
      {step < 4 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between">
            <Button variant="outline" onClick={goBack}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button onClick={goNext} disabled={
              (step === 1 && (!clientId || !propertyId)) ||
              (step === 2 && !surveyType)
            }>
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
