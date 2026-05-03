import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  ArrowLeft, Building2, User, MapPin, Phone, Mail, FileText, 
  Home, Plus, Trash2, Edit2, Save, X, Link2, Copy, Check,
  Briefcase, FileSpreadsheet, Receipt, Image as ImageIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  portalEnabled: boolean | null;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [client, setClient] = useState<Client | null>(null);
  const [properties, setProperties] = useState<ClientProperty[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editedClient, setEditedClient] = useState<Client | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Property dialog states
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);
  const [editingProperty, setEditingProperty] = useState<ClientProperty | null>(null);
  const [newProperty, setNewProperty] = useState({
    name: "",
    address: "",
    postcode: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    notes: "",
  });
  
  // Portal link
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load client data
  useEffect(() => {
    if (id) {
      fetchClientData();
    }
  }, [id]);

  const fetchClientData = async () => {
    setIsLoading(true);
    try {
      // Fetch client
      const clientRes = await fetch(`/api/clients/${id}`, { credentials: 'include' });
      if (clientRes.ok) {
        const clientData = await clientRes.json();
        setClient(clientData);
        setEditedClient(clientData);
      }
      
      // Fetch properties
      const propsRes = await fetch(`/api/clients/${id}/properties`, { credentials: 'include' });
      if (propsRes.ok) {
        setProperties(await propsRes.json());
      }
      
      // Fetch contacts
      const contactsRes = await fetch(`/api/clients/${id}/contacts`, { credentials: 'include' });
      if (contactsRes.ok) {
        setContacts(await contactsRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch client data:", error);
      toast({ title: "Error", description: "Failed to load client data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClient = async () => {
    if (!editedClient) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editedClient.name,
          contactName: editedClient.contactName,
          email: editedClient.email,
          phone: editedClient.phone,
          address: editedClient.address,
          postcode: editedClient.postcode,
          notes: editedClient.notes,
          portalEnabled: editedClient.portalEnabled,
        }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setClient(updated);
        setIsEditing(false);
        toast({ title: "Success", description: "Client updated successfully" });
      } else {
        toast({ title: "Error", description: "Failed to update client", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update client", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedClient(client);
    setIsEditing(false);
  };

  const handleAddProperty = async () => {
    try {
      const res = await fetch(`/api/clients/${id}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newProperty),
      });
      
      if (res.ok) {
        const created = await res.json();
        setProperties([...properties, created]);
        setNewProperty({ name: "", address: "", postcode: "", contactName: "", contactPhone: "", contactEmail: "", notes: "" });
        setShowPropertyDialog(false);
        toast({ title: "Success", description: "Property added successfully" });
      } else {
        toast({ title: "Error", description: "Failed to add property", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add property", variant: "destructive" });
    }
  };

  const handleUpdateProperty = async () => {
    if (!editingProperty) return;
    try {
      const res = await fetch(`/api/clients/${id}/properties/${editingProperty.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editingProperty.name,
          address: editingProperty.address,
          postcode: editingProperty.postcode,
          contactName: editingProperty.contactName,
          contactPhone: editingProperty.contactPhone,
          contactEmail: editingProperty.contactEmail,
          notes: editingProperty.notes,
        }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setProperties(properties.map(p => p.id === updated.id ? updated : p));
        setEditingProperty(null);
        toast({ title: "Success", description: "Property updated successfully" });
      } else {
        toast({ title: "Error", description: "Failed to update property", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update property", variant: "destructive" });
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    if (!confirm("Are you sure you want to delete this property?")) return;
    try {
      const res = await fetch(`/api/clients/${id}/properties/${propertyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (res.ok) {
        setProperties(properties.filter(p => p.id !== propertyId));
        toast({ title: "Success", description: "Property deleted" });
      } else {
        toast({ title: "Error", description: "Failed to delete property", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete property", variant: "destructive" });
    }
  };

  const generatePortalLink = async () => {
    try {
      const res = await fetch(`/api/clients/${id}/generate-portal-token`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (res.ok) {
        const data = await res.json();
        const fullUrl = `${window.location.origin}${data.portalUrl}`;
        setPortalLink(fullUrl);
        toast({ title: "Success", description: "Portal link generated" });
      } else {
        toast({ title: "Error", description: "Failed to generate portal link", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate portal link", variant: "destructive" });
    }
  };

  const copyPortalLink = () => {
    if (portalLink) {
      navigator.clipboard.writeText(portalLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied", description: "Portal link copied to clipboard" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading client...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Client not found</p>
        <Button onClick={() => setLocation("/clients")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setLocation("/clients")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              {client.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Client since {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="outline">
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button onClick={handleCancelEdit} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveClient} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="properties">
            Properties
            {properties.length > 0 && (
              <Badge variant="secondary" className="ml-2">{properties.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts
            {contacts.length > 0 && (
              <Badge variant="secondary" className="ml-2">{contacts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isEditing ? (
                  <>
                    <div className="grid gap-4">
                      {client.contactName && (
                        <div>
                          <Label className="text-muted-foreground text-xs uppercase">Contact Person</Label>
                          <p className="font-medium">{client.contactName}</p>
                        </div>
                      )}
                      {client.email && (
                        <div>
                          <Label className="text-muted-foreground text-xs uppercase">Email</Label>
                          <a href={`mailto:${client.email}`} className="text-primary hover:underline block">
                            {client.email}
                          </a>
                        </div>
                      )}
                      {client.phone && (
                        <div>
                          <Label className="text-muted-foreground text-xs uppercase">Phone</Label>
                          <a href={`tel:${client.phone}`} className="text-primary hover:underline block">
                            {client.phone}
                          </a>
                        </div>
                      )}
                    </div>
                    {client.address && (
                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <Label>Address</Label>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {client.address}
                          {client.postcode && `\n${client.postcode}`}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Company/Client Name *</Label>
                      <Input
                        value={editedClient?.name || ""}
                        onChange={(e) => setEditedClient({ ...editedClient!, name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Contact Person</Label>
                      <Input
                        value={editedClient?.contactName || ""}
                        onChange={(e) => setEditedClient({ ...editedClient!, contactName: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editedClient?.email || ""}
                        onChange={(e) => setEditedClient({ ...editedClient!, email: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Phone</Label>
                      <Input
                        value={editedClient?.phone || ""}
                        onChange={(e) => setEditedClient({ ...editedClient!, phone: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Address</Label>
                      <Textarea
                        value={editedClient?.address || ""}
                        onChange={(e) => setEditedClient({ ...editedClient!, address: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Postcode</Label>
                      <Input
                        value={editedClient?.postcode || ""}
                        onChange={(e) => setEditedClient({ ...editedClient!, postcode: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes & Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Notes & Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isEditing ? (
                  <>
                    {client.notes ? (
                      <div>
                        <Label className="text-muted-foreground text-xs uppercase mb-2 block">Client Notes</Label>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-lg">
                          {client.notes}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No notes added</p>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={editedClient?.notes || ""}
                        onChange={(e) => setEditedClient({ ...editedClient!, notes: e.target.value })}
                        rows={5}
                        placeholder="Add any notes about this client..."
                      />
                    </div>
                  </div>
                )}

                <Separator />

                {/* Client Portal */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="font-medium flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Client Portal
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow client to view their jobs, quotes, and invoices
                      </p>
                    </div>
                    {isEditing ? (
                      <Switch
                        checked={editedClient?.portalEnabled || false}
                        onCheckedChange={(checked) => setEditedClient({ ...editedClient!, portalEnabled: checked })}
                      />
                    ) : (
                      <Badge variant={client.portalEnabled ? "default" : "secondary"}>
                        {client.portalEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    )}
                  </div>

                  {client.portalEnabled && (
                    <div className="bg-muted p-3 rounded-lg space-y-2">
                      {!portalLink ? (
                        <Button size="sm" variant="outline" onClick={generatePortalLink}>
                          <Link2 className="h-4 w-4 mr-2" />
                          Generate Portal Link
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              value={portalLink}
                              readOnly
                              className="text-xs font-mono bg-card"
                            />
                            <Button size="sm" variant="outline" onClick={copyPortalLink}>
                              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Share this link with your client for portal access
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Properties Tab */}
        <TabsContent value="properties" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Properties</h3>
              <p className="text-sm text-muted-foreground">
                Manage all properties associated with this client
              </p>
            </div>
            <Button onClick={() => { setEditingProperty(null); setShowPropertyDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Button>
          </div>

          {properties.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="p-8 text-center">
                <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Properties Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add properties to track multiple locations for this client
                </p>
                <Button onClick={() => { setEditingProperty(null); setShowPropertyDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Property
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {properties.map((property) => (
                <Card key={property.id} className={property.isDefault ? "border-primary" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Home className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">{property.name}</h4>
                          {property.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {property.address}
                          {property.postcode && `, ${property.postcode}`}
                        </p>
                        {(property.contactName || property.contactPhone || property.contactEmail) && (
                          <div className="text-sm text-muted-foreground space-y-1">
                            {property.contactName && (
                              <p className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                {property.contactName}
                              </p>
                            )}
                            {property.contactPhone && (
                              <p className="flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                {property.contactPhone}
                              </p>
                            )}
                            {property.contactEmail && (
                              <p className="flex items-center gap-2">
                                <Mail className="h-3 w-3" />
                                {property.contactEmail}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingProperty(property); setShowPropertyDialog(true); }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDeleteProperty(property.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}</div>
                )}
              </TabsContent>

              {/* Contacts Tab */}
              <TabsContent value="contacts" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Contacts</CardTitle>
                    <CardDescription>Manage additional contacts for this client</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {contacts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="font-medium">No additional contacts added yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {contacts.map((contact) => (
                          <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              {contact.role && <p className="text-sm text-muted-foreground">{contact.role}</p>}
                              {contact.email && <p className="text-sm text-muted-foreground">{contact.email}</p>}
                              {contact.phone && <p className="text-sm text-muted-foreground">{contact.phone}</p>}
                            </div>
                            {contact.isPrimary && <Badge>Primary</Badge>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Jobs Tab */}
              <TabsContent value="jobs" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Job History</CardTitle>
                    <CardDescription>View all jobs for this client</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="font-medium">Jobs will appear here</p>
                      <Button className="mt-4" onClick={() => setLocation('/create-job-sheet')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Job
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Quotes Tab */}
              <TabsContent value="quotes" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quotes</CardTitle>
                    <CardDescription>Quotes and estimates for this client</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="font-medium">No quotes yet</p>
                      <p className="text-sm mt-2">Quotes will appear here once created</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Invoices Tab */}
              <TabsContent value="invoices" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Invoices</CardTitle>
                    <CardDescription>Billing and payment history</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="font-medium">No invoices found</p>
                      <p className="text-sm mt-2">Invoices will appear here once created</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Property Dialog */}
            <Dialog open={showPropertyDialog} onOpenChange={setShowPropertyDialog}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingProperty ? "Edit Property" : "Add New Property"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingProperty ? "Update the property details below" : "Enter the property details for this client"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid gap-2">
                    <Label>Property Name *</Label>
                    <Input
                      placeholder="e.g., Head Office, Warehouse Site A"
                      value={editingProperty?.name || newProperty.name}
                      onChange={(e) => {
                        if (editingProperty) {
                          setEditingProperty({ ...editingProperty, name: e.target.value });
                        } else {
                          setNewProperty({ ...newProperty, name: e.target.value });
                        }
                      }}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Address *</Label>
                    <Textarea
                      placeholder="Full property address"
                      value={editingProperty?.address || newProperty.address}
                      onChange={(e) => {
                        if (editingProperty) {
                          setEditingProperty({ ...editingProperty, address: e.target.value });
                        } else {
                          setNewProperty({ ...newProperty, address: e.target.value });
                        }
                      }}
                      rows={2}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Postcode</Label>
                    <Input
                      placeholder="e.g., SW1A 1AA"
                      value={editingProperty?.postcode || newProperty.postcode}
                      onChange={(e) => {
                        if (editingProperty) {
                          setEditingProperty({ ...editingProperty, postcode: e.target.value });
                        } else {
                          setNewProperty({ ...newProperty, postcode: e.target.value });
                        }
                      }}
                    />
                  </div>
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-medium mb-2">Site Contact (Optional)</p>
                    <div className="grid gap-2">
                      <Input
                        placeholder="Contact name"
                        value={editingProperty?.contactName || newProperty.contactName}
                        onChange={(e) => {
                          if (editingProperty) {
                            setEditingProperty({ ...editingProperty, contactName: e.target.value });
                          } else {
                            setNewProperty({ ...newProperty, contactName: e.target.value });
                          }
                        }}
                      />
                      <Input
                        placeholder="Phone"
                        value={editingProperty?.contactPhone || newProperty.contactPhone}
                        onChange={(e) => {
                          if (editingProperty) {
                            setEditingProperty({ ...editingProperty, contactPhone: e.target.value });
                          } else {
                            setNewProperty({ ...newProperty, contactPhone: e.target.value });
                          }
                        }}
                      />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={editingProperty?.contactEmail || newProperty.contactEmail}
                        onChange={(e) => {
                          if (editingProperty) {
                            setEditingProperty({ ...editingProperty, contactEmail: e.target.value });
                          } else {
                            setNewProperty({ ...newProperty, contactEmail: e.target.value });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setShowPropertyDialog(false); setEditingProperty(null); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={editingProperty ? handleUpdateProperty : handleAddProperty}
                    disabled={!((editingProperty?.name || newProperty.name) && (editingProperty?.address || newProperty.address))}
                  >
                    {editingProperty ? "Update Property" : "Add Property"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        );
      }
