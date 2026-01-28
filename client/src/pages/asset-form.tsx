import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Asset, Client, Job, User } from "@shared/schema";

const CONDITION_OPTIONS = [
  { value: "new", label: "New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "needs_repair", label: "Needs Repair" },
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

export default function AssetFormPage() {
  const [, editParams] = useRoute("/assets/:id/edit");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const isEdit = !!editParams?.id;
  const assetId = editParams?.id;
  
  const urlParams = new URLSearchParams(window.location.search);
  const prefillBarcode = urlParams.get("barcode");
  
  const [formData, setFormData] = useState({
    name: "",
    serialNumber: "",
    barcode: prefillBarcode || "",
    manufacturer: "",
    model: "",
    description: "",
    categoryType: "equipment",
    condition: "good",
    location: "",
    purchaseDate: "",
    purchasePrice: "",
    warrantyExpiry: "",
    warrantyNotes: "",
    warrantyProvider: "",
    assignedJobId: "",
    assignedClientId: "",
    assignedUserId: "",
    notes: "",
    lastServiceDate: "",
    nextServiceDue: "",
    productUrl: "",
    manualUrl: "",
  });

  const { data: existingAsset, isLoading: assetLoading } = useQuery<Asset>({
    queryKey: [`/api/assets/${assetId}`],
    enabled: isEdit,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    retry: false,
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    retry: false,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  useEffect(() => {
    if (existingAsset && isEdit) {
      setFormData({
        name: existingAsset.name || "",
        serialNumber: existingAsset.serialNumber || "",
        barcode: existingAsset.barcode || "",
        manufacturer: existingAsset.manufacturer || "",
        model: existingAsset.model || "",
        description: existingAsset.description || "",
        categoryType: existingAsset.categoryType || "equipment",
        condition: existingAsset.condition || "good",
        location: existingAsset.location || "",
        purchaseDate: existingAsset.purchaseDate ? new Date(existingAsset.purchaseDate).toISOString().split("T")[0] : "",
        purchasePrice: existingAsset.purchasePrice?.toString() || "",
        warrantyExpiry: existingAsset.warrantyExpiry ? new Date(existingAsset.warrantyExpiry).toISOString().split("T")[0] : "",
        warrantyNotes: existingAsset.warrantyNotes || "",
        warrantyProvider: existingAsset.warrantyProvider || "",
        assignedJobId: existingAsset.assignedJobId || "",
        assignedClientId: existingAsset.assignedClientId || "",
        assignedUserId: existingAsset.assignedUserId || "",
        notes: existingAsset.notes || "",
        lastServiceDate: existingAsset.lastServiceDate ? new Date(existingAsset.lastServiceDate).toISOString().split("T")[0] : "",
        nextServiceDue: existingAsset.nextServiceDue ? new Date(existingAsset.nextServiceDue).toISOString().split("T")[0] : "",
        productUrl: existingAsset.productUrl || "",
        manualUrl: existingAsset.manualUrl || "",
      });
    }
  }, [existingAsset, isEdit]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/assets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset created successfully" });
      navigate("/assets");
    },
    onError: (error: Error) => {
      toast({ title: "Error creating asset", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", `/api/assets/${assetId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: [`/api/assets/${assetId}`] });
      toast({ title: "Asset updated successfully" });
      navigate(`/assets/${assetId}`);
    },
    onError: (error: Error) => {
      toast({ title: "Error updating asset", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    
    const payload = {
      name: formData.name,
      serialNumber: formData.serialNumber || null,
      barcode: formData.barcode || null,
      manufacturer: formData.manufacturer || null,
      model: formData.model || null,
      description: formData.description || null,
      categoryType: formData.categoryType,
      condition: formData.condition,
      location: formData.location || null,
      purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate) : null,
      purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
      warrantyExpiry: formData.warrantyExpiry ? new Date(formData.warrantyExpiry) : null,
      warrantyNotes: formData.warrantyNotes || null,
      warrantyProvider: formData.warrantyProvider || null,
      assignedJobId: formData.assignedJobId || null,
      assignedClientId: formData.assignedClientId || null,
      assignedUserId: formData.assignedUserId || null,
      notes: formData.notes || null,
      lastServiceDate: formData.lastServiceDate ? new Date(formData.lastServiceDate) : null,
      nextServiceDue: formData.nextServiceDue ? new Date(formData.nextServiceDue) : null,
      productUrl: formData.productUrl || null,
      manualUrl: formData.manualUrl || null,
    };
    
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isEdit && assetLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(isEdit ? `/assets/${assetId}` : "/assets")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            {isEdit ? "Edit Asset" : "Add New Asset"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Update asset information" : "Register a new asset"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., Bosch Drill"
                  required
                  data-testid="input-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="categoryType">Category</Label>
                <Select value={formData.categoryType} onValueChange={(v) => handleChange("categoryType", v)}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => handleChange("manufacturer", e.target.value)}
                  placeholder="e.g., Bosch"
                  data-testid="input-manufacturer"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => handleChange("model", e.target.value)}
                  placeholder="e.g., GSB 18V-55"
                  data-testid="input-model"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select value={formData.condition} onValueChange={(v) => handleChange("condition", v)}>
                  <SelectTrigger data-testid="select-condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="e.g., Warehouse A, Van 3"
                  data-testid="input-location"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Detailed description of the asset"
                rows={3}
                data-testid="input-description"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identifiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => handleChange("serialNumber", e.target.value)}
                  placeholder="e.g., SN123456789"
                  data-testid="input-serial"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode / QR Code</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => handleChange("barcode", e.target.value)}
                  placeholder="Scanned or manual barcode"
                  data-testid="input-barcode"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Purchase & Warranty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => handleChange("purchaseDate", e.target.value)}
                  data-testid="input-purchase-date"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Purchase Price (£)</Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  step="0.01"
                  value={formData.purchasePrice}
                  onChange={(e) => handleChange("purchasePrice", e.target.value)}
                  placeholder="0.00"
                  data-testid="input-purchase-price"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
                <Input
                  id="warrantyExpiry"
                  type="date"
                  value={formData.warrantyExpiry}
                  onChange={(e) => handleChange("warrantyExpiry", e.target.value)}
                  data-testid="input-warranty-expiry"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warrantyProvider">Warranty Provider</Label>
                <Input
                  id="warrantyProvider"
                  value={formData.warrantyProvider}
                  onChange={(e) => handleChange("warrantyProvider", e.target.value)}
                  placeholder="e.g., Bosch Professional"
                  data-testid="input-warranty-provider"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="warrantyNotes">Warranty Notes</Label>
                <Input
                  id="warrantyNotes"
                  value={formData.warrantyNotes}
                  onChange={(e) => handleChange("warrantyNotes", e.target.value)}
                  placeholder="e.g., Extended warranty included"
                  data-testid="input-warranty-notes"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignedClientId">Assigned Client</Label>
                <Select value={formData.assignedClientId || "none"} onValueChange={(v) => handleChange("assignedClientId", v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assignedJobId">Assigned Job</Label>
                <Select value={formData.assignedJobId || "none"} onValueChange={(v) => handleChange("assignedJobId", v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-job">
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {jobs.slice(0, 50).map(job => (
                      <SelectItem key={job.id} value={job.id}>#{job.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assignedUserId">Assigned Engineer</Label>
                <Select value={formData.assignedUserId || "none"} onValueChange={(v) => handleChange("assignedUserId", v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-engineer">
                    <SelectValue placeholder="Select engineer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {users.filter(u => u.role === "engineer").map(user => (
                      <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lastServiceDate">Last Service Date</Label>
                <Input
                  id="lastServiceDate"
                  type="date"
                  value={formData.lastServiceDate}
                  onChange={(e) => handleChange("lastServiceDate", e.target.value)}
                  data-testid="input-last-service"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="nextServiceDue">Next Service Due</Label>
                <Input
                  id="nextServiceDue"
                  type="date"
                  value={formData.nextServiceDue}
                  onChange={(e) => handleChange("nextServiceDue", e.target.value)}
                  data-testid="input-next-service"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Links & Documentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productUrl">Product URL</Label>
                <Input
                  id="productUrl"
                  type="url"
                  value={formData.productUrl}
                  onChange={(e) => handleChange("productUrl", e.target.value)}
                  placeholder="https://..."
                  data-testid="input-product-url"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="manualUrl">Manual URL</Label>
                <Input
                  id="manualUrl"
                  type="url"
                  value={formData.manualUrl}
                  onChange={(e) => handleChange("manualUrl", e.target.value)}
                  placeholder="https://..."
                  data-testid="input-manual-url"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional notes about this asset"
              rows={4}
              data-testid="input-notes"
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate(isEdit ? `/assets/${assetId}` : "/assets")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-save">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEdit ? "Saving..." : "Creating..."}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEdit ? "Save Changes" : "Create Asset"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
