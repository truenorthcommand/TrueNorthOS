import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Building2 } from "lucide-react";

const MOCK_CLIENTS = [
  { id: "c-1", name: "BuildTech Solutions", contact: "John Brown", email: "john@buildtech.com", phone: "01234 567890" },
  { id: "c-2", name: "HomeAssure Ltd", contact: "Sarah White", email: "sarah@homeassure.com", phone: "01234 567891" },
  { id: "c-3", name: "NetCable Installations", contact: "Mike Johnson", email: "mike@netcable.com", phone: "01234 567892" },
];

export default function Clients() {
  const [clients, setClients] = useState(MOCK_CLIENTS);
  const [newClient, setNewClient] = useState({ name: "", contact: "", email: "", phone: "" });

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClient.name && newClient.contact) {
      setClients([
        ...clients,
        {
          id: `c-${Date.now()}`,
          ...newClient,
        },
      ]);
      setNewClient({ name: "", contact: "", email: "", phone: "" });
    }
  };

  const handleDelete = (id: string) => {
    setClients(clients.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">Manage service provider and contractor information</p>
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
                  onChange={(e) => setNewClient({ ...newClient, contact: e.target.value })}
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
            <Button type="submit" className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Clients List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <Card key={client.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{client.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{client.contact}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(client.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {client.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium">Email:</span>
                  <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                    {client.email}
                  </a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium">Phone:</span>
                  <a href={`tel:${client.phone}`} className="text-primary hover:underline">
                    {client.phone}
                  </a>
                </div>
              )}
            </CardContent>
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
