import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Loader2, Search, Sparkles, Clock, MapPin, User, Calendar
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface Property {
  id: number;
  name?: string;
  address: string;
  postcode?: string;
}

interface UserRecord {
  id: number;
  name: string;
  email?: string;
  role: string;
}

interface AISuggestion {
  assigned_to: number;
  assigned_to_name: string;
  scheduled_date: string;
  scheduled_time_start: string;
  estimated_duration_mins: number;
  travel_time_mins: number;
  reasoning: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const BOOKING_TYPES = [
  { value: 'job', label: '🔧 Job', role: 'engineer' },
  { value: 'survey', label: '📐 Survey', role: 'surveyor' },
  { value: 'inspection', label: '👁️ Inspection', role: 'works_manager' },
  { value: 'signoff_visit', label: '✅ Sign-off Visit', role: 'works_manager' },
  { value: 'quote_visit', label: '💰 Quote Visit', role: 'surveyor' },
  { value: 'snag_check', label: '🐛 Snag Check', role: 'works_manager' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const ROLE_MAP: Record<string, string> = {
  job: 'engineer',
  survey: 'surveyor',
  inspection: 'works_manager',
  signoff_visit: 'works_manager',
  quote_visit: 'surveyor',
  snag_check: 'works_manager',
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CreateBooking() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Client search state
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);

  // Property state
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Users state
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form fields
  const [bookingType, setBookingType] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [assignedRole, setAssignedRole] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [timeStart, setTimeStart] = useState<string>('');
  const [timeEnd, setTimeEnd] = useState<string>('');
  const [estimatedDuration, setEstimatedDuration] = useState<string>('60');
  const [priority, setPriority] = useState<string>('normal');
  const [notes, setNotes] = useState('');

  // AI Suggest state
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await fetch('/api/clients', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data) ? data : (data.clients || []));
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  const fetchProperties = useCallback(async (clientId: number) => {
    setLoadingProperties(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/properties`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProperties(Array.isArray(data) ? data : (data.properties || []));
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err);
    } finally {
      setLoadingProperties(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
    fetchUsers();
  }, [fetchClients, fetchUsers]);

  useEffect(() => {
    if (selectedClient) {
      fetchProperties(selectedClient.id);
      setSelectedPropertyId('');
    } else {
      setProperties([]);
      setSelectedPropertyId('');
    }
  }, [selectedClient, fetchProperties]);

  // Auto-set role when booking type changes
  useEffect(() => {
    if (bookingType) {
      const role = ROLE_MAP[bookingType] || 'engineer';
      setAssignedRole(role);
    }
  }, [bookingType]);

  // Auto-calculate end time when start + duration change
  useEffect(() => {
    if (timeStart && estimatedDuration) {
      const [hours, mins] = timeStart.split(':').map(Number);
      const totalMins = hours * 60 + mins + parseInt(estimatedDuration);
      const endHours = Math.floor(totalMins / 60);
      const endMins = totalMins % 60;
      if (endHours < 24) {
        setTimeEnd(`${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`);
      }
    }
  }, [timeStart, estimatedDuration]);

  // ─── Client Search ─────────────────────────────────────────────────────────

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(clientSearch.toLowerCase())) ||
    (c.phone && c.phone.includes(clientSearch))
  );

  // Filter staff by assigned role
  const filteredStaff = users.filter(u => {
    if (!assignedRole) return ['engineer', 'surveyor', 'works_manager'].includes(u.role);
    return u.role === assignedRole;
  });

  // ─── AI Suggest ────────────────────────────────────────────────────────────

  const handleAISuggest = async () => {
    if (!bookingType) {
      toast({ title: 'Select booking type first', variant: 'destructive' });
      return;
    }

    setLoadingAI(true);
    setShowAISuggestions(true);
    setAiSuggestions([]);

    try {
      const payload: Record<string, any> = {
        booking_type: bookingType,
        estimated_duration_mins: parseInt(estimatedDuration) || 60,
        priority,
      };
      if (selectedClient) payload.client_id = selectedClient.id;
      if (selectedPropertyId) payload.property_id = parseInt(selectedPropertyId);

      const res = await fetch('/api/bookings/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('AI suggest failed');
      }

      const data = await res.json();
      setAiSuggestions(data.suggestions || []);

      if (!data.suggestions || data.suggestions.length === 0) {
        toast({ title: 'No suggestions available', description: data.message || 'Try different parameters' });
      }
    } catch (err) {
      console.error('AI suggest error:', err);
      toast({ title: 'AI suggest failed', description: 'Could not generate suggestions', variant: 'destructive' });
    } finally {
      setLoadingAI(false);
    }
  };

  const applySuggestion = (suggestion: AISuggestion) => {
    setAssignedTo(String(suggestion.assigned_to));
    setScheduledDate(suggestion.scheduled_date);
    setTimeStart(suggestion.scheduled_time_start);
    setEstimatedDuration(String(suggestion.estimated_duration_mins));
    setShowAISuggestions(false);
    toast({ title: 'Suggestion applied', description: `${suggestion.assigned_to_name} on ${suggestion.scheduled_date}` });
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create booking' }));
        throw new Error(err.error || 'Failed to create booking');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Booking created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      navigate('/bookings');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!bookingType || !assignedTo || !scheduledDate) {
      toast({ title: 'Missing required fields', description: 'Please fill in booking type, assigned person, and date', variant: 'destructive' });
      return;
    }

    const payload: Record<string, any> = {
      booking_type: bookingType,
      assigned_to: parseInt(assignedTo),
      assigned_role: assignedRole,
      scheduled_date: scheduledDate,
      scheduled_time_start: timeStart || null,
      scheduled_time_end: timeEnd || null,
      estimated_duration_mins: parseInt(estimatedDuration) || 60,
      priority,
      notes: notes || null,
    };

    if (selectedClient) payload.client_id = selectedClient.id;
    if (selectedPropertyId) payload.property_id = parseInt(selectedPropertyId);

    // Get address from selected property
    if (selectedPropertyId) {
      const prop = properties.find(p => p.id === parseInt(selectedPropertyId));
      if (prop) {
        payload.address = prop.address;
        payload.postcode = prop.postcode || null;
      }
    }

    createMutation.mutate(payload);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/bookings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Booking</h1>
          <p className="text-muted-foreground">Schedule a job, survey, inspection or visit</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Booking Type & Priority */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="booking_type">Booking Type *</Label>
                <Select value={bookingType} onValueChange={setBookingType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {assignedRole && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  Required role: {assignedRole.replace('_', ' ')}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client & Property */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Client & Property</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client Search */}
            <div className="space-y-2">
              <Label>Client</Label>
              {selectedClient ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedClient.name}</span>
                  {selectedClient.phone && (
                    <span className="text-sm text-muted-foreground">• {selectedClient.phone}</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => { setSelectedClient(null); setClientSearch(''); }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients..."
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                    className="pl-9"
                  />
                  {showClientDropdown && clientSearch && (
                    <div className="absolute z-10 mt-1 w-full bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {loadingClients ? (
                        <div className="p-3 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        </div>
                      ) : filteredClients.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">No clients found</div>
                      ) : (
                        filteredClients.slice(0, 10).map(client => (
                          <div
                            key={client.id}
                            className="p-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                            onMouseDown={() => { setSelectedClient(client); setClientSearch(''); setShowClientDropdown(false); }}
                          >
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{client.name}</span>
                            {client.email && <span className="text-xs text-muted-foreground">{client.email}</span>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Property Selection */}
            <div className="space-y-2">
              <Label>Property</Label>
              {!selectedClient ? (
                <p className="text-sm text-muted-foreground">Select a client first to see their properties</p>
              ) : loadingProperties ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading properties...
                </div>
              ) : properties.length === 0 ? (
                <p className="text-sm text-muted-foreground">No properties found for this client</p>
              ) : (
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(prop => (
                      <SelectItem key={prop.id} value={String(prop.id)}>
                        {prop.address}{prop.postcode ? ` • ${prop.postcode}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assignment & Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assignment & Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Assigned To */}
            <div className="space-y-2">
              <Label>Assigned To *</Label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading staff...
                </div>
              ) : (
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStaff.map(user => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name} ({user.role.replace('_', ' ')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>Estimated Duration (minutes)</Label>
              <Select value={estimatedDuration} onValueChange={setEstimatedDuration}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 mins</SelectItem>
                  <SelectItem value="45">45 mins</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="480">Full day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* AI Suggest Button */}
            <div className="pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleAISuggest}
                disabled={loadingAI || !bookingType}
              >
                {loadingAI ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                🤖 AI Suggest
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Let AI find the best available slot based on staff availability and travel time
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI Suggestions */}
        {showAISuggestions && (
          <Card className="border-purple-200 bg-purple-50/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                AI Scheduling Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAI ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  <span className="ml-2 text-muted-foreground">Analyzing availability...</span>
                </div>
              ) : aiSuggestions.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No suggestions available. Try different parameters.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {aiSuggestions.map((suggestion, idx) => (
                    <Card
                      key={idx}
                      className="cursor-pointer transition-all hover:shadow-md hover:border-purple-400"
                      onClick={() => applySuggestion(suggestion)}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-purple-600" />
                          <span className="font-semibold text-sm">{suggestion.assigned_to_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{suggestion.scheduled_date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{suggestion.scheduled_time_start}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{suggestion.travel_time_mins} min travel</span>
                        </div>
                        <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                          {suggestion.reasoning}
                        </p>
                        <Button type="button" size="sm" variant="secondary" className="w-full mt-2">
                          Apply
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add any additional notes or instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Booking
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/bookings')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
