import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Search, Loader2, Building2, User, Phone, Mail
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

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CreateEnquiry() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

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
  const [source, setSource] = useState<string>('phone');
  const [description, setDescription] = useState('');
  const [clientRequirements, setClientRequirements] = useState('');
  const [budgetIndication, setBudgetIndication] = useState('');
  const [urgency, setUrgency] = useState<string>('standard');
  const [preferredDates, setPreferredDates] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');

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
        setUsers(data.filter((u: UserRecord) => ['admin', 'surveyor', 'works_manager', 'super_admin'].includes(u.role)));
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

  // ─── Client Search ─────────────────────────────────────────────────────────

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(clientSearch.toLowerCase())) ||
    (c.phone && c.phone.includes(clientSearch))
  );

  // ─── Submit ────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create enquiry' }));
        throw new Error(err.error || 'Failed to create enquiry');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Enquiry created', description: 'The enquiry has been saved successfully.' });
      navigate(`/enquiries/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClient) {
      toast({ title: 'Client required', description: 'Please select a client.', variant: 'destructive' });
      return;
    }
    if (!description.trim()) {
      toast({ title: 'Description required', description: 'Please enter a description.', variant: 'destructive' });
      return;
    }

    createMutation.mutate({
      client_id: selectedClient.id,
      property_id: selectedPropertyId || null,
      source,
      description: description.trim(),
      client_requirements: clientRequirements.trim() || null,
      budget_indication: budgetIndication.trim() || null,
      urgency,
      preferred_dates: preferredDates.trim() || null,
      assigned_to: assignedTo ? Number(assignedTo) : null,
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/enquiries')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Enquiry</h1>
          <p className="text-muted-foreground">Record a new customer enquiry</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedClient ? (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{selectedClient.name}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {selectedClient.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {selectedClient.email}
                      </span>
                    )}
                    {selectedClient.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selectedClient.phone}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedClient(null);
                    setClientSearch('');
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients by name, email or phone..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    className="pl-9"
                  />
                  {loadingClients && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                  )}
                </div>
                {showClientDropdown && clientSearch && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredClients.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        No clients found
                      </div>
                    ) : (
                      filteredClients.slice(0, 20).map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
                          onClick={() => {
                            setSelectedClient(client);
                            setShowClientDropdown(false);
                            setClientSearch('');
                          }}
                        >
                          <p className="font-medium text-sm">{client.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {client.email}{client.phone && ` • ${client.phone}`}
                          </p>
                        </button>
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
                <Building2 className="h-5 w-5" />
                Property
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProperties ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading properties...
                </div>
              ) : properties.length === 0 ? (
                <p className="text-sm text-muted-foreground">No properties on file for this client</p>
              ) : (
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a property (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={String(prop.id)}>
                        {prop.name || prop.address}
                        {prop.postcode && ` • ${prop.postcode}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        {/* Enquiry Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enquiry Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger id="source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="repeat_customer">Repeat Customer</SelectItem>
                    <SelectItem value="client_portal">Client Portal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgency">Urgency</Label>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger id="urgency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergency">🔴 Emergency</SelectItem>
                    <SelectItem value="urgent">🟠 Urgent</SelectItem>
                    <SelectItem value="standard">🔵 Standard</SelectItem>
                    <SelectItem value="flexible">⚪ Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe what the customer needs..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientRequirements">Client Requirements</Label>
              <Textarea
                id="clientRequirements"
                placeholder="Any specific requirements or preferences..."
                value={clientRequirements}
                onChange={(e) => setClientRequirements(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget Indication</Label>
                <Input
                  id="budget"
                  placeholder="e.g. £5,000 - £10,000"
                  value={budgetIndication}
                  onChange={(e) => setBudgetIndication(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredDates">Preferred Dates</Label>
                <Input
                  id="preferredDates"
                  placeholder="e.g. Next week, ASAP, flexible"
                  value={preferredDates}
                  onChange={(e) => setPreferredDates(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assignment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading team members...
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assign To</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger id="assignedTo">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/enquiries')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || !selectedClient || !description.trim()}
            className="gap-2"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Enquiry
          </Button>
        </div>
      </form>
    </div>
  );
}
