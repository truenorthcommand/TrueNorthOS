import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Package, 
  Search, 
  Plus, 
  Grid, 
  List, 
  QrCode, 
  AlertTriangle,
  Calendar,
  Building2,
  Wrench,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Filter,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Scanner } from "@/components/scanner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Asset, Client, Job } from "@shared/schema";

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

function getWarrantyStatus(warrantyExpiry: Date | null | undefined): { label: string; color: string; icon?: React.ReactNode } | null {
  if (!warrantyExpiry) return null;
  
  const now = new Date();
  const expiry = new Date(warrantyExpiry);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) {
    return { label: "Expired", color: "destructive", icon: <AlertTriangle className="h-3 w-3" /> };
  } else if (daysUntilExpiry <= 30) {
    return { label: `Expires in ${daysUntilExpiry} days`, color: "warning", icon: <AlertTriangle className="h-3 w-3" /> };
  } else if (daysUntilExpiry <= 90) {
    return { label: `Expires in ${daysUntilExpiry} days`, color: "secondary" };
  }
  return { label: "Active", color: "default", icon: <Shield className="h-3 w-3" /> };
}

export default function AssetsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/assets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset deleted successfully" });
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting asset", description: error.message, variant: "destructive" });
    },
  });

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset.barcode?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset.model?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCondition = conditionFilter === "all" || asset.condition === conditionFilter;
    const matchesCategory = categoryFilter === "all" || asset.categoryType === categoryFilter;
    
    return matchesSearch && matchesCondition && matchesCategory && asset.isActive;
  });

  const getClientName = (clientId: string | null | undefined) => {
    if (!clientId) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  };

  const getJobNumber = (jobId: string | null | undefined) => {
    if (!jobId) return null;
    const job = jobs.find(j => j.id === jobId);
    return job?.id;
  };

  const handleScanResult = async (code: string) => {
    setScanDialogOpen(false);
    
    try {
      const response = await fetch(`/api/assets/lookup/barcode/${encodeURIComponent(code)}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const asset: Asset = await response.json();
        navigate(`/assets/${asset.id}`);
      } else if (response.status === 404) {
        toast({
          title: "Asset not found",
          description: `No asset found with barcode: ${code}. Would you like to create one?`,
        });
        navigate(`/assets/new?barcode=${encodeURIComponent(code)}`);
      } else {
        toast({ title: "Error looking up asset", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error looking up asset", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = (asset: Asset) => {
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };

  const conditionBadge = (condition: string | null | undefined) => {
    const opt = CONDITION_OPTIONS.find(c => c.value === condition);
    if (!opt) return null;
    return (
      <Badge variant="outline" className="text-xs">
        <span className={`w-2 h-2 rounded-full mr-1 ${opt.color}`} />
        {opt.label}
      </Badge>
    );
  };

  const categoryLabel = (category: string | null | undefined) => {
    const opt = CATEGORY_OPTIONS.find(c => c.value === category);
    return opt?.label || category || "Unknown";
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">Assets</h1>
          <p className="text-muted-foreground">Manage equipment, tools, and parts</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScanDialogOpen(true)} data-testid="button-scan-asset">
            <QrCode className="mr-2 h-4 w-4" />
            Scan Barcode
          </Button>
          <Button onClick={() => navigate("/assets/new")} data-testid="button-add-asset">
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, serial, barcode, manufacturer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-assets"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={conditionFilter} onValueChange={setConditionFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-condition-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Conditions</SelectItem>
              {CONDITION_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-category-filter">
              <Package className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORY_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {filteredAssets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No assets found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || conditionFilter !== "all" || categoryFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Get started by adding your first asset"}
            </p>
            <Button onClick={() => navigate("/assets/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Asset
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => {
            const warrantyStatus = getWarrantyStatus(asset.warrantyExpiry);
            return (
              <Card 
                key={asset.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/assets/${asset.id}`)}
                data-testid={`card-asset-${asset.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold truncate" data-testid={`text-asset-name-${asset.id}`}>{asset.name}</h3>
                      {asset.manufacturer && (
                        <p className="text-sm text-muted-foreground">{asset.manufacturer} {asset.model}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/assets/${asset.id}`); }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/assets/${asset.id}/edit`); }}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDelete(asset); }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {asset.serialNumber && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                          SN: {asset.serialNumber}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      {conditionBadge(asset.condition)}
                      <Badge variant="outline" className="text-xs">
                        {categoryLabel(asset.categoryType)}
                      </Badge>
                    </div>
                    
                    {warrantyStatus && (
                      <Badge variant={warrantyStatus.color as any} className="text-xs">
                        {warrantyStatus.icon}
                        <span className="ml-1">{warrantyStatus.label}</span>
                      </Badge>
                    )}
                    
                    {asset.assignedClientId && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{getClientName(asset.assignedClientId)}</span>
                      </div>
                    )}
                    
                    {asset.assignedJobId && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Wrench className="h-3 w-3" />
                        <span>Job #{getJobNumber(asset.assignedJobId)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Serial/Barcode</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Category</th>
                <th className="text-left p-3 font-medium">Condition</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Warranty</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Assignment</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => {
                const warrantyStatus = getWarrantyStatus(asset.warrantyExpiry);
                return (
                  <tr 
                    key={asset.id} 
                    className="border-t hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    data-testid={`row-asset-${asset.id}`}
                  >
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{asset.name}</div>
                        {asset.manufacturer && (
                          <div className="text-sm text-muted-foreground">{asset.manufacturer} {asset.model}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="space-y-1">
                        {asset.serialNumber && (
                          <div className="font-mono text-xs">SN: {asset.serialNumber}</div>
                        )}
                        {asset.barcode && (
                          <div className="font-mono text-xs text-muted-foreground">{asset.barcode}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      {categoryLabel(asset.categoryType)}
                    </td>
                    <td className="p-3">
                      {conditionBadge(asset.condition)}
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      {warrantyStatus && (
                        <Badge variant={warrantyStatus.color as any} className="text-xs">
                          {warrantyStatus.icon}
                          <span className="ml-1">{warrantyStatus.label}</span>
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="space-y-1 text-sm">
                        {asset.assignedClientId && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate">{getClientName(asset.assignedClientId)}</span>
                          </div>
                        )}
                        {asset.assignedJobId && (
                          <div className="flex items-center gap-1">
                            <Wrench className="h-3 w-3" />
                            <span>Job #{getJobNumber(asset.assignedJobId)}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/assets/${asset.id}`); }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/assets/${asset.id}/edit`); }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDelete(asset); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Asset Barcode</DialogTitle>
          </DialogHeader>
          <Scanner
            onScanSuccess={handleScanResult}
            onScanError={(error) => {
              toast({ title: "Scan error", description: error, variant: "destructive" });
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete "{assetToDelete?.name}"? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => assetToDelete && deleteMutation.mutate(assetToDelete.id)}
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
