import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { 
  Package, 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Calendar,
  Building2,
  Wrench,
  AlertTriangle,
  Shield,
  QrCode,
  ExternalLink,
  Search,
  History,
  Loader2,
  FileText,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { Asset, AssetHistory, Client, Job } from "@shared/schema";

const CONDITION_OPTIONS = [
  { value: "new", label: "New", color: "bg-green-500" },
  { value: "good", label: "Good", color: "bg-blue-500" },
  { value: "fair", label: "Fair", color: "bg-yellow-500" },
  { value: "poor", label: "Poor", color: "bg-orange-500" },
  { value: "needs_repair", label: "Needs Repair", color: "bg-red-500" },
];

const CATEGORY_OPTIONS = [
  { value: "equipment", label: "Equipment" },
  { value: "tool", label: "Tool" },
  { value: "part", label: "Part" },
  { value: "vehicle_part", label: "Vehicle Part" },
  { value: "consumable", label: "Consumable" },
  { value: "safety_equipment", label: "Safety Equipment" },
  { value: "other", label: "Other" },
];

function getWarrantyStatus(warrantyExpiry: Date | null | undefined): { label: string; color: string; icon?: React.ReactNode; daysRemaining?: number } | null {
  if (!warrantyExpiry) return null;
  
  const now = new Date();
  const expiry = new Date(warrantyExpiry);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) {
    return { label: "Expired", color: "destructive", icon: <AlertTriangle className="h-4 w-4" />, daysRemaining: daysUntilExpiry };
  } else if (daysUntilExpiry <= 30) {
    return { label: `Expires in ${daysUntilExpiry} days`, color: "warning", icon: <AlertTriangle className="h-4 w-4" />, daysRemaining: daysUntilExpiry };
  } else if (daysUntilExpiry <= 90) {
    return { label: `Expires in ${daysUntilExpiry} days`, color: "secondary", daysRemaining: daysUntilExpiry };
  }
  return { label: "Active", color: "default", icon: <Shield className="h-4 w-4" />, daysRemaining: daysUntilExpiry };
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

export default function AssetDetailPage() {
  const [, params] = useRoute("/assets/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [webSearching, setWebSearching] = useState(false);

  const assetId = params?.id;

  const { data: asset, isLoading } = useQuery<Asset>({
    queryKey: [`/api/assets/${assetId}`],
    enabled: !!assetId && assetId !== "new",
  });

  const { data: history = [] } = useQuery<AssetHistory[]>({
    queryKey: [`/api/assets/${assetId}/history`],
    enabled: !!assetId && assetId !== "new",
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/assets/${assetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset deleted successfully" });
      navigate("/assets");
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting asset", description: error.message, variant: "destructive" });
    },
  });

  const getClientName = (clientId: string | null | undefined) => {
    if (!clientId) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  };

  const getJobInfo = (jobId: string | null | undefined) => {
    if (!jobId) return null;
    const job = jobs.find(j => j.id === jobId);
    return job;
  };

  const conditionBadge = (condition: string | null | undefined) => {
    const opt = CONDITION_OPTIONS.find(c => c.value === condition);
    if (!opt) return null;
    return (
      <Badge variant="outline">
        <span className={`w-2 h-2 rounded-full mr-2 ${opt.color}`} />
        {opt.label}
      </Badge>
    );
  };

  const categoryLabel = (category: string | null | undefined) => {
    const opt = CATEGORY_OPTIONS.find(c => c.value === category);
    return opt?.label || category || "Unknown";
  };

  const handleWebSearch = async () => {
    if (!asset) return;
    
    setWebSearching(true);
    try {
      const searchQuery = [asset.manufacturer, asset.model, asset.name].filter(Boolean).join(" ");
      const response = await fetch("/api/ai/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: `${searchQuery} product specifications manual` }),
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Web Search Complete",
          description: result.summary || "Search completed. Check the AI assistant for details.",
        });
      } else {
        toast({ title: "Web search failed", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setWebSearching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Asset not found</h3>
            <Button onClick={() => navigate("/assets")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const warrantyStatus = getWarrantyStatus(asset.warrantyExpiry);
  const assignedClient = getClientName(asset.assignedClientId);
  const assignedJob = getJobInfo(asset.assignedJobId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/assets")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-asset-name">{asset.name}</h1>
            {asset.manufacturer && (
              <p className="text-muted-foreground">{asset.manufacturer} {asset.model}</p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleWebSearch} disabled={webSearching}>
            {webSearching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Globe className="mr-2 h-4 w-4" />
            )}
            Web Search
          </Button>
          <Button variant="outline" onClick={() => navigate(`/assets/${assetId}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-6 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Asset Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Category</label>
                      <p className="font-medium">{categoryLabel(asset.categoryType)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Condition</label>
                      <div className="mt-1">{conditionBadge(asset.condition)}</div>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Location</label>
                      <p className="font-medium">{asset.location || "-"}</p>
                    </div>
                  </div>
                  
                  {asset.description && (
                    <div>
                      <label className="text-sm text-muted-foreground">Description</label>
                      <p className="mt-1">{asset.description}</p>
                    </div>
                  )}
                  
                  {asset.notes && (
                    <div>
                      <label className="text-sm text-muted-foreground">Notes</label>
                      <p className="mt-1">{asset.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Identifiers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Serial Number</label>
                      <p className="font-mono font-medium">{asset.serialNumber || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Barcode</label>
                      <p className="font-mono font-medium">{asset.barcode || "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Purchase & Warranty</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Purchase Date</label>
                      <p className="font-medium">{formatDate(asset.purchaseDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Purchase Price</label>
                      <p className="font-medium">{formatCurrency(asset.purchasePrice)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Warranty Expiry</label>
                      <p className="font-medium">{formatDate(asset.warrantyExpiry)}</p>
                    </div>
                  </div>
                  
                  {asset.warrantyProvider && (
                    <div className="mt-4">
                      <label className="text-sm text-muted-foreground">Warranty Provider</label>
                      <p className="font-medium">{asset.warrantyProvider}</p>
                    </div>
                  )}
                  
                  {asset.warrantyNotes && (
                    <div className="mt-4">
                      <label className="text-sm text-muted-foreground">Warranty Notes</label>
                      <p className="mt-1">{asset.warrantyNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(asset.productUrl || asset.manualUrl) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Links</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {asset.productUrl && (
                      <a 
                        href={asset.productUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Product Page
                      </a>
                    )}
                    {asset.manualUrl && (
                      <a 
                        href={asset.manualUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        Manual/Documentation
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Asset History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No history available</p>
                  ) : (
                    <div className="space-y-4">
                      {history.map((entry) => (
                        <div key={entry.id} className="flex gap-4 border-b pb-4 last:border-0">
                          <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium capitalize">{entry.action}</p>
                                {entry.description && (
                                  <p className="text-sm text-muted-foreground">{entry.description}</p>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(entry.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          {warrantyStatus && (
            <Card className={warrantyStatus.color === "destructive" ? "border-destructive" : ""}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Warranty Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={warrantyStatus.color as any} className="text-sm">
                  {warrantyStatus.icon}
                  <span className="ml-1">{warrantyStatus.label}</span>
                </Badge>
                {warrantyStatus.daysRemaining !== undefined && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {warrantyStatus.daysRemaining > 0 
                      ? `${warrantyStatus.daysRemaining} days remaining`
                      : `Expired ${Math.abs(warrantyStatus.daysRemaining)} days ago`
                    }
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignedClient ? (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-xs text-muted-foreground">Client</label>
                    <p className="font-medium">{assignedClient}</p>
                  </div>
                </div>
              ) : null}
              
              {assignedJob ? (
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-xs text-muted-foreground">Job</label>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto font-medium"
                      onClick={() => navigate(`/jobs/${assignedJob.id}`)}
                    >
                      #{assignedJob.id}
                    </Button>
                  </div>
                </div>
              ) : null}
              
              {!assignedClient && !assignedJob && (
                <p className="text-muted-foreground">Not assigned</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Last Service</label>
                <p className="font-medium">{formatDate(asset.lastServiceDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Next Service Due</label>
                <p className="font-medium">{formatDate(asset.nextServiceDue)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete "{asset.name}"? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
