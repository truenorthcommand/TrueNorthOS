import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Loader2, Brain, Building2, Home, Send, Database, RefreshCw, ChevronDown, ChevronRight, MessageSquare, Zap, Shield, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface Property {
  id: string;
  clientId: string;
  name: string;
  address: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  responseType?: string;
  timestamp: Date;
}

export default function PropertyIntelligence() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Seed database mutation
  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/seed/run');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Database Seeded", description: data.message });
      // Refresh the page to show new data
      window.location.reload();
    },
    onError: (error: any) => {
      toast({ 
        title: "Seed Failed", 
        description: error.message || "Failed to seed database",
        variant: "destructive" 
      });
    },
  });

  // Fetch properties for selected client
  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/clients", selectedClientId, "properties"],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await fetch(`/api/clients/${selectedClientId}/properties`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedClientId,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["/api/intelligence/stats", selectedClientId],
    queryFn: async () => {
      const url = selectedClientId
        ? `/api/intelligence/stats?clientId=${selectedClientId}`
        : '/api/intelligence/stats';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Ingest client mutation
  const ingestMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const res = await apiRequest('POST', `/api/intelligence/ingest/${clientId}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Data Ingested", description: data.message });
    },
    onError: () => {
      toast({ title: "Ingestion Failed", variant: "destructive" });
    },
  });

  // Ingest all mutation
  const ingestAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/intelligence/ingest-all');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "All Data Ingested", description: data.message });
    },
    onError: () => {
      toast({ title: "Ingestion Failed", variant: "destructive" });
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Determine query scope
  const getScope = (): 'organization' | 'client' | 'property' => {
    if (selectedPropertyId) return 'property';
    if (selectedClientId) return 'client';
    return 'organization';
  };

  // Handle query submission
  const handleQuery = async () => {
    if (!query.trim() || isQuerying) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setQuery("");
    setIsQuerying(true);

    try {
      const res = await fetch('/api/intelligence/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: userMessage.content,
          clientId: selectedClientId,
          propertyId: selectedPropertyId,
          scope: getScope(),
          conversationId,
        }),
      });

      if (!res.ok) throw new Error('Query failed');

      const result = await res.json();
      setConversationId(result.conversationId);

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: result.response,
        responseType: result.responseType,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast({ title: "Query Failed", description: "Unable to get response. Please try again.", variant: "destructive" });
    } finally {
      setIsQuerying(false);
    }
  };

  // Toggle client expansion
  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  // Select client
  const selectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedPropertyId(null);
    if (!expandedClients.has(clientId)) {
      toggleClient(clientId);
    }
  };

  // Select property
  const selectProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
  };

  // Get selected client/property name
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  if (!user?.superAdmin && user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold">Admin Access Required</h2>
          <p className="text-muted-foreground mt-2">Property Intelligence is only available to administrators.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* LEFT PANEL - Hierarchy */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-4">
        {/* Stats Card */}
        <Card className="tradify-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="w-4 h-4" />
              Knowledge Base
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Chunks:</span>
              <span className="font-bold">{stats?.totalChunks || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Embedded:</span>
              <span className="font-bold">{stats?.percentEmbedded || 0}%</span>
            </div>
            <Separator />
            <div className="flex gap-2">
              {selectedClientId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => ingestMutation.mutate(selectedClientId)}
                  disabled={ingestMutation.isPending}
                >
                  {ingestMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  <span className="ml-1">Sync Client</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span className="ml-1">Seed DB</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => ingestAllMutation.mutate()}
                disabled={ingestAllMutation.isPending}
              >
                {ingestAllMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                <span className="ml-1">Sync All</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Client Hierarchy */}
        <Card className="tradify-card flex-1 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4" />
              Clients & Properties
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[calc(100vh-420px)] space-y-1">
            {/* Organization level */}
            <button
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                !selectedClientId && !selectedPropertyId
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
              onClick={() => { setSelectedClientId(null); setSelectedPropertyId(null); }}
            >
              🌍 All Clients (Organization)
            </button>

            <Separator className="my-2" />

            {clients.map(client => (
              <div key={client.id}>
                <button
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    selectedClientId === client.id && !selectedPropertyId
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => selectClient(client.id)}
                >
                  {expandedClients.has(client.id) ? (
                    <ChevronDown className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  )}
                  <Building2 className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{client.name}</span>
                </button>

                {/* Properties under client */}
                {expandedClients.has(client.id) && selectedClientId === client.id && (
                  <div className="ml-6 mt-1 space-y-1">
                    {properties.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-1">No properties</p>
                    ) : (
                      properties.map(prop => (
                        <button
                          key={prop.id}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors ${
                            selectedPropertyId === prop.id
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => selectProperty(prop.id)}
                        >
                          <Home className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{prop.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* RIGHT PANEL - Intelligence Assistant */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Card className="tradify-card mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Property Intelligence</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedProperty
                      ? `Property: ${selectedProperty.name}`
                      : selectedClient
                        ? `Client: ${selectedClient.name}`
                        : 'Organization Overview'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {getScope() === 'property' ? '🏠 Property' : getScope() === 'client' ? '🏢 Client' : '🌍 Organization'}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Mode: Factual
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat Messages */}
        <Card className="tradify-card flex-1 overflow-hidden flex flex-col">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Brain className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium">Property Intelligence Assistant</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-2">
                  Ask questions about clients, properties, jobs, quotes, and invoices.
                  Select a client or property from the left panel to narrow your scope.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                  <button
                    className="p-3 rounded-lg border hover:bg-muted text-left transition-colors"
                    onClick={() => setQuery("What's the status of all active jobs?")}
                  >
                    📋 "What's the status of all active jobs?"
                  </button>
                  <button
                    className="p-3 rounded-lg border hover:bg-muted text-left transition-colors"
                    onClick={() => setQuery("Show me outstanding invoices")}
                  >
                    💰 "Show me outstanding invoices"
                  </button>
                  <button
                    className="p-3 rounded-lg border hover:bg-muted text-left transition-colors"
                    onClick={() => setQuery("What maintenance history does this property have?")}
                  >
                    🔧 "What maintenance history does this property have?"
                  </button>
                  <button
                    className="p-3 rounded-lg border hover:bg-muted text-left transition-colors"
                    onClick={() => setQuery("Give me a summary of this client's portfolio")}
                  >
                    📊 "Give me a summary of this client's portfolio"
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.role === 'assistant' && msg.responseType && (
                      <Badge variant="outline" className="mb-2 text-xs">
                        {msg.responseType === 'predictive' ? '🔮 Predictive' : '📋 Factual'}
                      </Badge>
                    )}
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    <p className="text-xs opacity-60 mt-2">
                      {new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isQuerying && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          {/* Input Area */}
          <div className="border-t p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); handleQuery(); }}
              className="flex gap-2"
            >
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Ask about ${selectedProperty?.name || selectedClient?.name || 'your portfolio'}...`}
                disabled={isQuerying}
                className="flex-1"
              />
              <Button type="submit" disabled={!query.trim() || isQuerying}>
                {isQuerying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Tip: Use words like "predict", "recommend", or "forecast" for predictive analysis
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
