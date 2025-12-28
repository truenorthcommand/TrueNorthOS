import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Building2, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">
          Manage service providers and properties
        </p>
      </div>

      {/* Add New Client Form */}
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
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="contact@company.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="01234 567890"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
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
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Clients List */}
      <div className="space-y-4">
        {clients.map((client) => (
          <Card
            key={client.id}
            className="hover:shadow-md transition-shadow overflow-hidden"
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
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            {/* Expanded Content */}
            {expandedClientId === client.id && (
              <CardContent className="border-t space-y-6 pt-6">
                {/* Contact Info */}
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

                {/* Main Address */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Main Office</p>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {client.mainAddress}
                  </p>
                </div>

                {/* Properties Section */}
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

                  {/* Add Property Form */}
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
    </div>
  );
}
