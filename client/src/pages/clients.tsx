import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Building2, MapPin, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Property {
  id: string;
  address: string;
  postcode: string;
}

interface Client {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  mainAddress: string;
  properties: Property[];
}

const MOCK_CLIENTS: Client[] = [
  {
    id: "c-1",
    name: "BuildTech Solutions",
    contact: "John Brown",
    email: "john@buildtech.com",
    phone: "01234 567890",
    mainAddress: "42 Industrial Estate, Manchester, M1 2AB",
    properties: [
      { id: "p-1", address: "123 Factory Lane", postcode: "M1 1AA" },
      { id: "p-2", address: "456 Warehouse Park", postcode: "M2 2BB" },
    ],
  },
  {
    id: "c-2",
    name: "HomeAssure Ltd",
    contact: "Sarah White",
    email: "sarah@homeassure.com",
    phone: "01234 567891",
    mainAddress: "10 Service Road, Birmingham, B1 1CD",
    properties: [
      { id: "p-3", address: "789 Residential Drive", postcode: "B1 5EF" },
    ],
  },
  {
    id: "c-3",
    name: "NetCable Installations",
    contact: "Mike Johnson",
    email: "mike@netcable.com",
    phone: "01234 567892",
    mainAddress: "100 Tech Hub, London, EC1 1XY",
    properties: [
      { id: "p-4", address: "201 Tech Park", postcode: "EC1 2AB" },
      { id: "p-5", address: "202 Innovation Centre", postcode: "EC2 3CD" },
      { id: "p-6", address: "203 Digital Square", postcode: "EC3 4EF" },
    ],
  },
];

export default function Clients() {
  const { user } = useAuth();
  const { addJob } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [newClient, setNewClient] = useState({
    name: "",
    contact: "",
    email: "",
    phone: "",
    mainAddress: "",
  });
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [newPropertyByClient, setNewPropertyByClient] = useState<
    Record<string, { address: string; postcode: string }>
  >({});

  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [jobForm, setJobForm] = useState({
    description: "",
    notes: "",
    startTime: format(new Date(), "HH:mm"),
  });

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClient.name && newClient.contact) {
      setClients([
        ...clients,
        {
          id: `c-${Date.now()}`,
          ...newClient,
          properties: [],
        },
      ]);
      setNewClient({
        name: "",
        contact: "",
        email: "",
        phone: "",
        mainAddress: "",
      });
    }
  };

  const handleAddProperty = (clientId: string) => {
    const propData = newPropertyByClient[clientId];
    if (propData?.address && propData?.postcode) {
      setClients(
        clients.map((c) =>
          c.id === clientId
            ? {
                ...c,
                properties: [
                  ...c.properties,
                  {
                    id: `p-${Date.now()}`,
                    ...propData,
                  },
                ],
              }
            : c
        )
      );
      setNewPropertyByClient({
        ...newPropertyByClient,
        [clientId]: { address: "", postcode: "" },
      });
    }
  };

  const handleDeleteProperty = (clientId: string, propertyId: string) => {
    setClients(
      clients.map((c) =>
        c.id === clientId
          ? {
              ...c,
              properties: c.properties.filter((p) => p.id !== propertyId),
            }
          : c
      )
    );
  };

  const handleDeleteClient = (id: string) => {
    setClients(clients.filter((c) => c.id !== id));
    setExpandedClientId(null);
  };

  const handleCreateJobFromClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClientId || !selectedPropertyId || !jobForm.description) {
      toast({ 
        title: "Missing Information", 
        description: "Please select a client, property, and enter a description.",
        variant: "destructive"
      });
      return;
    }

    const client = clients.find(c => c.id === selectedClientId);
    const property = client?.properties.find(p => p.id === selectedPropertyId);
    
    if (!client || !property) return;

    const newJob = await addJob({
      jobNo: `J-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
      client: client.name,
      customerName: client.name,
      address: property.address,
      postcode: property.postcode,
      contactName: client.contact,
      contactPhone: client.phone,
      contactEmail: client.email,
      date: new Date().toISOString(),
      startTime: jobForm.startTime,
      description: jobForm.description,
      notes: jobForm.notes,
      status: "Draft",
      assignedToId: user?.id || "",
      materials: [],
      photos: [],
      signatures: [],
      furtherActions: [],
    });

    if (newJob) {
      toast({
        title: "Job Created",
        description: `New job sheet created for ${client.name}`,
      });

      setSelectedClientId("");
      setSelectedPropertyId("");
      setJobForm({ description: "", notes: "", startTime: format(new Date(), "HH:mm") });
      setLocation("/");
    }
  };

  if (!user) return null;

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedProperty = selectedClient?.properties.find(p => p.id === selectedPropertyId);

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
                  <Select value={selectedClientId} onValueChange={(value) => {
                    setSelectedClientId(value);
                    setSelectedPropertyId("");
                  }}>
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
                  <div className="space-y-2">
                    <Label>Select Property / Site</Label>
                    <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                      <SelectTrigger data-testid="select-property">
                        <SelectValue placeholder="Choose a property..." />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedClient.properties.map((prop) => (
                          <SelectItem key={prop.id} value={prop.id}>
                            {prop.address} - {prop.postcode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                        <p className="font-medium" data-testid="text-contact-name">{selectedClient.contact}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Phone</p>
                        <p className="font-medium" data-testid="text-contact-phone">{selectedClient.phone}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Email</p>
                        <p className="font-medium" data-testid="text-contact-email">{selectedClient.email}</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedProperty && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-300 uppercase">Selected Property</p>
                    <div className="space-y-1">
                      <p className="font-semibold" data-testid="text-property-address">{selectedProperty.address}</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-property-postcode">{selectedProperty.postcode}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={jobForm.startTime}
                    onChange={(e) => setJobForm({ ...jobForm, startTime: e.target.value })}
                    data-testid="input-start-time"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description of Works *</Label>
                  <Textarea
                    placeholder="Describe the work to be carried out..."
                    value={jobForm.description}
                    onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                    className="min-h-[120px]"
                    required
                    data-testid="input-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    placeholder="Access codes, parking info, special instructions..."
                    value={jobForm.notes}
                    onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })}
                    className="min-h-[80px]"
                    data-testid="input-notes"
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700" 
                    disabled={!selectedPropertyId || !jobForm.description}
                    data-testid="button-create-job"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Job Sheet
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setSelectedClientId("");
                      setSelectedPropertyId("");
                      setJobForm({ description: "", notes: "", startTime: format(new Date(), "HH:mm") });
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
                      value={newClient.contact}
                      onChange={(e) =>
                        setNewClient({ ...newClient, contact: e.target.value })
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
                <div className="space-y-2">
                  <Label>Main Office Address</Label>
                  <Textarea
                    placeholder="Full address of main office"
                    value={newClient.mainAddress}
                    onChange={(e) =>
                      setNewClient({ ...newClient, mainAddress: e.target.value })
                    }
                    className="min-h-[80px]"
                    data-testid="input-main-address"
                  />
                </div>
                <Button type="submit" className="w-full sm:w-auto" data-testid="button-add-client">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {clients.map((client) => (
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
                          {client.contact}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {client.properties.length} properties
                          </Badge>
                        </div>
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

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">Main Office</p>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {client.mainAddress}
                      </p>
                    </div>

                    <div className="border-t pt-6">
                      <div className="mb-4">
                        <h4 className="font-semibold text-sm mb-4">Properties</h4>
                        {client.properties.length === 0 ? (
                          <p className="text-sm text-muted-foreground mb-4">
                            No properties added yet.
                          </p>
                        ) : (
                          <div className="space-y-3 mb-6">
                            {client.properties.map((prop) => (
                              <div
                                key={prop.id}
                                className="flex items-start justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md border"
                              >
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{prop.address}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {prop.postcode}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleDeleteProperty(client.id, prop.id)
                                  }
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 shrink-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-t pt-4 space-y-3">
                        <p className="text-sm font-medium">Add Property</p>
                        <div className="space-y-3">
                          <Input
                            placeholder="Property address"
                            value={newPropertyByClient[client.id]?.address || ""}
                            onChange={(e) =>
                              setNewPropertyByClient({
                                ...newPropertyByClient,
                                [client.id]: {
                                  address: e.target.value,
                                  postcode: newPropertyByClient[client.id]?.postcode || "",
                                },
                              })
                            }
                          />
                          <Input
                            placeholder="Postcode"
                            value={newPropertyByClient[client.id]?.postcode || ""}
                            onChange={(e) =>
                              setNewPropertyByClient({
                                ...newPropertyByClient,
                                [client.id]: {
                                  address: newPropertyByClient[client.id]?.address || "",
                                  postcode: e.target.value,
                                },
                              })
                            }
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={() => handleAddProperty(client.id)}
                          >
                            <Plus className="mr-2 h-3 w-3" />
                            Add Property
                          </Button>
                        </div>
                      </div>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
