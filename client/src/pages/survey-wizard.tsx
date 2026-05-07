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
import {
  ArrowLeft, ArrowRight, Plus, Trash2, Mic, MicOff, MapPin,
  Camera, Save, FileText, ChevronDown, ChevronUp, Search,
  CheckCircle2, Loader2, Upload, X, Home, Wrench
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface WorkItem {
  id: string;
  description: string;
  type: 'material' | 'labour' | 'both';
  priority: 'essential' | 'recommended' | 'optional';
  quantity: number;
  unit: string;
}

interface RoomMedia {
  id: string;
  file: File;
  preview: string;
}

interface Room {
  id: string;
  room_name: string;
  notes: string;
  work_items: WorkItem[];
  media: RoomMedia[];
  expanded: boolean;
}

interface SurveyData {
  client_id: number | null;
  client_name: string;
  property_id: number | null;
  property_address: string;
  new_client_name: string;
  new_client_phone: string;
  new_client_email: string;
  new_property_address: string;
  new_property_postcode: string;
  gps_lat: number | null;
  gps_lng: number | null;
  survey_type: string;
  rooms: Room[];
  condition_rating: string;
  general_notes: string;
  access_notes: string;
  safety_notes: string;
  client_preferences: string;
  timeline: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: 'Client & Property', icon: '🏠' },
  { id: 2, title: 'Survey Type', icon: '📋' },
  { id: 3, title: 'Room Inspection', icon: '🔍' },
  { id: 4, title: 'General Notes', icon: '📝' },
  { id: 5, title: 'Review & Save', icon: '✅' },
];

const SURVEY_TYPES = [
  { id: 'bathroom', icon: '🛁', title: 'Bathroom Survey', desc: 'Full bathroom inspection and measurements' },
  { id: 'kitchen', icon: '🍳', title: 'Kitchen Survey', desc: 'Kitchen layout, plumbing, and electrical assessment' },
  { id: 'full', icon: '🏠', title: 'Full Property Survey', desc: 'Complete property inspection, all rooms' },
  { id: 'electrical', icon: '⚡', title: 'Electrical Survey', desc: 'Electrical systems, wiring, and compliance' },
  { id: 'roofing', icon: '🏗️', title: 'Roofing Survey', desc: 'Roof condition, tiles, guttering, and loft' },
  { id: 'external', icon: '🌳', title: 'External/Garden Survey', desc: 'Exterior walls, garden, driveways, boundaries' },
  { id: 'custom', icon: '📝', title: 'Custom Survey', desc: 'Create your own survey structure' },
];

const ROOM_OPTIONS = [
  'Kitchen', 'Bathroom', 'Bedroom 1', 'Bedroom 2', 'Bedroom 3',
  'Living Room', 'Hallway', 'En-Suite', 'Utility', 'External',
  'Roof', 'Garden', 'Garage', 'Loft', 'Dining Room', 'Custom'
];

const CONDITION_RATINGS = ['Excellent', 'Good', 'Fair', 'Poor', 'Urgent'];

// ─── Voice-to-Text Hook ────────────────────────────────────────────────────────

function useVoiceToText(onResult: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return false;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-GB';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join(' ');
      onResult(transcript);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    return true;
  }, [onResult]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      return startRecording();
    }
    return true;
  }, [isRecording, startRecording, stopRecording]);

  return { isRecording, toggle, isSupported: !!(((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) };
}

// ─── VoiceButton Component ─────────────────────────────────────────────────────

function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { isRecording, toggle, isSupported } = useVoiceToText(onTranscript);

  if (!isSupported) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      className={isRecording ? 'border-red-500 text-red-500 animate-pulse' : ''}
    >
      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SurveyWizard() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/surveys/:id');
  const surveyId = params?.id;
  const isEditing = surveyId && surveyId !== 'new';
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [clientSearch, setClientSearch] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewProperty, setShowNewProperty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<SurveyData>({
    client_id: null,
    client_name: '',
    property_id: null,
    property_address: '',
    new_client_name: '',
    new_client_phone: '',
    new_client_email: '',
    new_property_address: '',
    new_property_postcode: '',
    gps_lat: null,
    gps_lng: null,
    survey_type: '',
    rooms: [],
    condition_rating: '',
    general_notes: '',
    access_notes: '',
    safety_notes: '',
    client_preferences: '',
    timeline: '',
  });

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const res = await fetch('/api/clients', { credentials: 'include' });
      if (!res.ok) return [];
      const result = await res.json();
      return Array.isArray(result) ? result : result.clients || [];
    },
  });

  // Fetch existing survey if editing
  const { data: existingSurvey } = useQuery({
    queryKey: ['/api/surveys', surveyId],
    queryFn: async () => {
      if (!isEditing) return null;
      const res = await fetch(`/api/surveys/${surveyId}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!isEditing,
  });

  // Populate from existing survey
  useEffect(() => {
    if (existingSurvey) {
      setData(prev => ({
        ...prev,
        client_id: existingSurvey.client_id,
        client_name: existingSurvey.client_name || '',
        property_address: existingSurvey.property_address || '',
        survey_type: existingSurvey.survey_type || '',
        condition_rating: existingSurvey.condition_rating || '',
        general_notes: existingSurvey.general_notes || '',
        access_notes: existingSurvey.access_notes || '',
        safety_notes: existingSurvey.safety_notes || '',
        client_preferences: existingSurvey.client_preferences || '',
        timeline: existingSurvey.timeline || '',
        gps_lat: existingSurvey.gps_lat,
        gps_lng: existingSurvey.gps_lng,
        rooms: (existingSurvey.rooms || []).map((r: any) => ({
          id: String(r.id),
          room_name: r.room_name,
          notes: r.notes || '',
          work_items: (r.work_items || []).map((wi: any) => ({
            id: String(wi.id),
            description: wi.description,
            type: wi.type || 'both',
            priority: wi.priority || 'essential',
            quantity: wi.quantity || 1,
            unit: wi.unit || 'each',
          })),
          media: [],
          expanded: true,
        })),
      }));
    }
  }, [existingSurvey]);

  // Filtered clients
  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // GPS capture
  const captureGPS = () => {
    if (!navigator.geolocation) {
      toast({ title: 'GPS not supported', variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setData(prev => ({ ...prev, gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude }));
        toast({ title: 'GPS captured', description: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` });
      },
      () => toast({ title: 'GPS failed', description: 'Could not get location', variant: 'destructive' })
    );
  };

  // Room management
  const addRoom = () => {
    setData(prev => ({
      ...prev,
      rooms: [...prev.rooms, {
        id: crypto.randomUUID(),
        room_name: '',
        notes: '',
        work_items: [],
        media: [],
        expanded: true,
      }],
    }));
  };

  const removeRoom = (roomId: string) => {
    setData(prev => ({ ...prev, rooms: prev.rooms.filter(r => r.id !== roomId) }));
  };

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    setData(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r),
    }));
  };

  const toggleRoom = (roomId: string) => {
    setData(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.id === roomId ? { ...r, expanded: !r.expanded } : r),
    }));
  };

  // Work item management
  const addWorkItem = (roomId: string) => {
    setData(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.id === roomId ? {
        ...r,
        work_items: [...r.work_items, {
          id: crypto.randomUUID(),
          description: '',
          type: 'both',
          priority: 'essential',
          quantity: 1,
          unit: 'each',
        }],
      } : r),
    }));
  };

  const removeWorkItem = (roomId: string, itemId: string) => {
    setData(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.id === roomId ? {
        ...r,
        work_items: r.work_items.filter(wi => wi.id !== itemId),
      } : r),
    }));
  };

  const updateWorkItem = (roomId: string, itemId: string, updates: Partial<WorkItem>) => {
    setData(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.id === roomId ? {
        ...r,
        work_items: r.work_items.map(wi => wi.id === itemId ? { ...wi, ...updates } : wi),
      } : r),
    }));
  };

  // Photo management
  const addPhoto = (roomId: string, files: FileList | null) => {
    if (!files) return;
    const newMedia: RoomMedia[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));
    setData(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.id === roomId ? {
        ...r,
        media: [...r.media, ...newMedia],
      } : r),
    }));
  };

  const removePhoto = (roomId: string, mediaId: string) => {
    setData(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.id === roomId ? {
        ...r,
        media: r.media.filter(m => m.id !== mediaId),
      } : r),
    }));
  };

  // Save survey
  const saveSurvey = async (generateQuote: boolean = false) => {
    setSaving(true);
    try {
      let sid = surveyId;

      // Step 1: Create or update survey
      if (!isEditing) {
        const res = await fetch('/api/surveys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            client_id: data.client_id,
            property_id: data.property_id,
            survey_type: data.survey_type,
          }),
        });
        if (!res.ok) throw new Error('Failed to create survey');
        const created = await res.json();
        sid = String(created.id);
      }

      // Step 2: Update survey fields
      await fetch(`/api/surveys/${sid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: generateQuote ? 'complete' : 'draft',
          general_notes: data.general_notes,
          condition_rating: data.condition_rating,
          access_notes: data.access_notes,
          safety_notes: data.safety_notes,
          client_preferences: data.client_preferences,
          timeline: data.timeline,
          gps_lat: data.gps_lat,
          gps_lng: data.gps_lng,
          survey_type: data.survey_type,
        }),
      });

      // Step 3: Create rooms and work items
      for (const room of data.rooms) {
        // Only create rooms that don't have numeric IDs (new rooms)
        const isNewRoom = isNaN(Number(room.id));
        let roomId = room.id;

        if (isNewRoom) {
          const roomRes = await fetch(`/api/surveys/${sid}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              room_name: room.room_name,
              room_type: room.room_name.toLowerCase().replace(/\s+/g, '_'),
            }),
          });
          if (roomRes.ok) {
            const createdRoom = await roomRes.json();
            roomId = String(createdRoom.id);
          }
        } else {
          // Update existing room notes
          await fetch(`/api/surveys/${sid}/rooms/${roomId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ notes: room.notes }),
          });
        }

        // Create work items for new rooms
        if (isNewRoom) {
          for (const item of room.work_items) {
            await fetch(`/api/surveys/${sid}/rooms/${roomId}/work-items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                description: item.description,
                type: item.type,
                priority: item.priority,
                quantity: item.quantity,
                unit: item.unit,
              }),
            });
          }
        }

        // Upload photos
        for (const media of room.media) {
          const formData = new FormData();
          formData.append('file', media.file);
          formData.append('survey_room_id', roomId);
          await fetch(`/api/surveys/${sid}/media`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
        }
      }

      // Step 4: Generate quote if requested
      if (generateQuote) {
        const quoteRes = await fetch(`/api/surveys/${sid}/generate-quote`, {
          method: 'POST',
          credentials: 'include',
        });
        if (quoteRes.ok) {
          const quoteData = await quoteRes.json();
          toast({ title: 'Quote generated!', description: `Quote ${quoteData.quote_no} created` });
          queryClient.invalidateQueries({ queryKey: ['/api/surveys'] });
          navigate(`/quotes/${quoteData.quote_id}`);
          return;
        }
      }

      toast({ title: 'Survey saved!', description: generateQuote ? 'Survey completed' : 'Saved as draft' });
      queryClient.invalidateQueries({ queryKey: ['/api/surveys'] });
      navigate('/surveys');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Step Renderers ──────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients by name or email..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {clientSearch && filteredClients.length > 0 && (
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {filteredClients.slice(0, 10).map(client => (
                <button
                  key={client.id}
                  className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b last:border-0 ${
                    data.client_id === client.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                  }`}
                  onClick={() => {
                    setData(prev => ({ ...prev, client_id: client.id, client_name: client.name }));
                    setClientSearch('');
                  }}
                >
                  <div className="font-medium text-sm">{client.name}</div>
                  <div className="text-xs text-muted-foreground">{client.email} • {client.phone}</div>
                </button>
              ))}
            </div>
          )}

          {data.client_id && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-md border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">{data.client_name}</span>
              <Button variant="ghost" size="sm" className="ml-auto h-6" onClick={() => setData(prev => ({ ...prev, client_id: null, client_name: '' }))}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={() => setShowNewClient(!showNewClient)}>
            <Plus className="h-4 w-4 mr-1" /> Quick-add New Client
          </Button>

          {showNewClient && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border rounded-md bg-muted/30">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={data.new_client_name}
                  onChange={(e) => setData(prev => ({ ...prev, new_client_name: e.target.value }))}
                  placeholder="Client name"
                />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  value={data.new_client_phone}
                  onChange={(e) => setData(prev => ({ ...prev, new_client_phone: e.target.value }))}
                  placeholder="Phone number"
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  value={data.new_client_email}
                  onChange={(e) => setData(prev => ({ ...prev, new_client_email: e.target.value }))}
                  placeholder="Email address"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Property Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Property Address</Label>
            <Input
              value={data.property_address}
              onChange={(e) => setData(prev => ({ ...prev, property_address: e.target.value }))}
              placeholder="Enter property address"
            />
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowNewProperty(!showNewProperty)}>
            <Plus className="h-4 w-4 mr-1" /> Add New Property
          </Button>

          {showNewProperty && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-md bg-muted/30">
              <div>
                <Label className="text-xs">Address</Label>
                <Input
                  value={data.new_property_address}
                  onChange={(e) => setData(prev => ({ ...prev, new_property_address: e.target.value }))}
                  placeholder="Full address"
                />
              </div>
              <div>
                <Label className="text-xs">Postcode</Label>
                <Input
                  value={data.new_property_postcode}
                  onChange={(e) => setData(prev => ({ ...prev, new_property_postcode: e.target.value }))}
                  placeholder="Postcode"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={captureGPS}>
              <MapPin className="h-4 w-4 mr-1" /> Capture GPS Location
            </Button>
            {data.gps_lat && (
              <span className="text-xs text-muted-foreground">
                📍 {data.gps_lat.toFixed(6)}, {data.gps_lng?.toFixed(6)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0F2B4C]">Select Survey Type</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SURVEY_TYPES.map(type => (
          <Card
            key={type.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              data.survey_type === type.id
                ? 'ring-2 ring-[#E8A54B] border-[#E8A54B] bg-[#E8A54B]/5'
                : 'hover:border-[#0F2B4C]/30'
            }`}
            onClick={() => setData(prev => ({ ...prev, survey_type: type.id }))}
          >
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-3">{type.icon}</div>
              <h3 className="font-semibold text-[#0F2B4C] mb-1">{type.title}</h3>
              <p className="text-xs text-muted-foreground">{type.desc}</p>
              {data.survey_type === type.id && (
                <Badge className="mt-3 bg-[#E8A54B] text-white">Selected</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#0F2B4C]">Room Inspection</h2>
        <Button onClick={addRoom} className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90 text-white">
          <Plus className="h-4 w-4 mr-1" /> Add Room
        </Button>
      </div>

      {data.rooms.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Home className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No rooms added yet. Click "Add Room" to start.</p>
          </CardContent>
        </Card>
      )}

      {data.rooms.map((room, index) => (
        <Card key={room.id} className="overflow-hidden">
          {/* Room Header */}
          <div
            className="flex items-center gap-3 p-4 bg-muted/30 cursor-pointer"
            onClick={() => toggleRoom(room.id)}
          >
            <span className="font-medium text-sm text-[#0F2B4C] flex-1">
              {room.room_name || `Room ${index + 1}`}
            </span>
            <Badge variant="outline" className="text-xs">
              {room.work_items.length} items • {room.media.length} photos
            </Badge>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeRoom(room.id); }}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
            {room.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>

          {/* Room Body */}
          {room.expanded && (
            <CardContent className="p-4 space-y-4">
              {/* Room Name */}
              <div>
                <Label className="text-xs">Room Name</Label>
                <Select
                  value={room.room_name}
                  onValueChange={(v) => updateRoom(room.id, { room_name: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select room type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes with voice */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Label className="text-xs">Notes</Label>
                  <VoiceButton onTranscript={(text) => updateRoom(room.id, { notes: room.notes + ' ' + text })} />
                </div>
                <Textarea
                  value={room.notes}
                  onChange={(e) => updateRoom(room.id, { notes: e.target.value })}
                  placeholder="Room condition notes, observations..."
                  rows={3}
                />
              </div>

              {/* Photos */}
              <div>
                <Label className="text-xs mb-2 block">Photos & Videos</Label>
                <div className="flex flex-wrap gap-2">
                  {room.media.map(m => (
                    <div key={m.id} className="relative w-20 h-20 rounded-md overflow-hidden border">
                      <img src={m.preview} alt="" className="w-full h-full object-cover" />
                      <button
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        onClick={() => removePhoto(room.id, m.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 rounded-md border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={(e) => addPhoto(room.id, e.target.files)}
                    />
                  </label>
                </div>
              </div>

              {/* Work Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Work Items</Label>
                  <Button variant="outline" size="sm" onClick={() => addWorkItem(room.id)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Item
                  </Button>
                </div>
                <div className="space-y-2">
                  {room.work_items.map(item => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-start p-2 border rounded-md bg-muted/20">
                      <div className="col-span-12 md:col-span-4">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateWorkItem(room.id, item.id, { description: e.target.value })}
                          className="text-sm h-8"
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Select value={item.type} onValueChange={(v: any) => updateWorkItem(room.id, item.id, { type: v })}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="material">Material</SelectItem>
                            <SelectItem value="labour">Labour</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Select value={item.priority} onValueChange={(v: any) => updateWorkItem(room.id, item.id, { priority: v })}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="essential">Essential</SelectItem>
                            <SelectItem value="recommended">Recommended</SelectItem>
                            <SelectItem value="optional">Optional</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateWorkItem(room.id, item.id, { quantity: parseInt(e.target.value) || 1 })}
                          className="text-sm h-8"
                        />
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <Input
                          placeholder="Unit"
                          value={item.unit}
                          onChange={(e) => updateWorkItem(room.id, item.id, { unit: e.target.value })}
                          className="text-sm h-8"
                        />
                      </div>
                      <div className="col-span-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeWorkItem(room.id, item.id)}>
                          <X className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">General Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Overall Condition Rating</Label>
            <Select
              value={data.condition_rating}
              onValueChange={(v) => setData(prev => ({ ...prev, condition_rating: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select condition..." />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_RATINGS.map(r => (
                  <SelectItem key={r} value={r.toLowerCase()}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-xs">General Notes</Label>
              <VoiceButton onTranscript={(text) => setData(prev => ({ ...prev, general_notes: prev.general_notes + ' ' + text }))} />
            </div>
            <Textarea
              value={data.general_notes}
              onChange={(e) => setData(prev => ({ ...prev, general_notes: e.target.value }))}
              placeholder="Overall observations, key findings..."
              rows={4}
            />
          </div>

          <div>
            <Label className="text-xs">Access Issues</Label>
            <Textarea
              value={data.access_notes}
              onChange={(e) => setData(prev => ({ ...prev, access_notes: e.target.value }))}
              placeholder="Any access restrictions, parking, keys needed..."
              rows={2}
            />
          </div>

          <div>
            <Label className="text-xs">Health & Safety Concerns</Label>
            <Textarea
              value={data.safety_notes}
              onChange={(e) => setData(prev => ({ ...prev, safety_notes: e.target.value }))}
              placeholder="Asbestos risk, structural issues, hazardous materials..."
              rows={2}
            />
          </div>

          <div>
            <Label className="text-xs">Client Preferences</Label>
            <Textarea
              value={data.client_preferences}
              onChange={(e) => setData(prev => ({ ...prev, client_preferences: e.target.value }))}
              placeholder="Style preferences, budget constraints, material choices..."
              rows={2}
            />
          </div>

          <div>
            <Label className="text-xs">Timeline Expectations</Label>
            <Textarea
              value={data.timeline}
              onChange={(e) => setData(prev => ({ ...prev, timeline: e.target.value }))}
              placeholder="When does the client want work to start? Any deadlines?"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep5 = () => {
    const totalPhotos = data.rooms.reduce((sum, r) => sum + r.media.length, 0);
    const totalWorkItems = data.rooms.reduce((sum, r) => sum + r.work_items.length, 0);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Survey Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-[#0F2B4C]">{data.rooms.length}</div>
                <div className="text-xs text-muted-foreground">Rooms</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-[#0F2B4C]">{totalPhotos}</div>
                <div className="text-xs text-muted-foreground">Photos/Videos</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-[#0F2B4C]">{totalWorkItems}</div>
                <div className="text-xs text-muted-foreground">Work Items</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-[#0F2B4C] capitalize">{data.survey_type || '—'}</div>
                <div className="text-xs text-muted-foreground">Survey Type</div>
              </div>
            </div>

            {/* Rooms summary */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Rooms Inspected:</h3>
              {data.rooms.map(room => (
                <div key={room.id} className="flex items-center justify-between p-2 border rounded-md text-sm">
                  <span className="font-medium">{room.room_name || 'Unnamed Room'}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{room.work_items.length} items</span>
                    <span>{room.media.length} photos</span>
                  </div>
                </div>
              ))}
            </div>

            {data.condition_rating && (
              <div className="p-3 bg-muted/30 rounded-md">
                <span className="text-xs text-muted-foreground">Condition:</span>
                <span className="ml-2 font-medium capitalize">{data.condition_rating}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => saveSurvey(false)}
            disabled={saving}
            className="flex-1 bg-[#0F2B4C] hover:bg-[#0F2B4C]/90 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            💾 Save as Draft
          </Button>
          <Button
            onClick={() => saveSurvey(true)}
            disabled={saving || totalWorkItems === 0}
            className="flex-1 bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            📄 Generate Quote
          </Button>
        </div>
      </div>
    );
  };

  // ─── Main Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/surveys')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold text-[#0F2B4C]">
          {isEditing ? 'Edit Survey' : 'New Survey'}
        </h1>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={`flex flex-col items-center min-w-[70px] px-2 py-2 rounded-lg transition-colors ${
              step === s.id
                ? 'bg-[#0F2B4C] text-white'
                : step > s.id
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-muted/50 text-muted-foreground'
            }`}
          >
            <span className="text-lg">{s.icon}</span>
            <span className="text-[10px] font-medium mt-0.5 whitespace-nowrap">{s.title}</span>
          </button>
        ))}
      </div>

      {/* Step Content */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}

      {/* Navigation */}
      {step < 5 && (
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            onClick={() => setStep(Math.min(5, step + 1))}
            className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90 text-white"
          >
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
