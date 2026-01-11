import { useState, useRef, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Save, Plus, MapPin, Calendar, User, Upload, X, CheckCircle2, XCircle, Minus, ChevronDown, Camera, Pen, Cloud, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from "react-signature-canvas";
import type { InspectionWithDetails, InspectionItem } from "@shared/schema";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  signed_off: "bg-purple-100 text-purple-800",
};

const resultColors: Record<string, string> = {
  pass: "bg-green-100 text-green-800",
  fail: "bg-red-100 text-red-800",
  na: "bg-gray-100 text-gray-600",
  not_checked: "bg-yellow-100 text-yellow-800",
};

const defaultInspectionItems: Record<string, string[]> = {
  structure: ["Foundation", "Walls", "Roof", "Windows", "Doors"],
  electrical: ["Wiring", "Switches", "Sockets", "Lighting", "Consumer Unit"],
  plumbing: ["Pipework", "Taps", "Drainage", "Boiler", "Radiators"],
  safety: ["Fire Alarms", "CO Detectors", "Escape Routes", "Signage"],
  finishes: ["Plastering", "Painting", "Flooring", "Tiling"],
  external: ["Guttering", "External Walls", "Fencing", "Paving"],
};

export default function InspectionDetail() {
  const [match, params] = useRoute("/inspections/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const clientSigCanvasRef = useRef<SignatureCanvas>(null);
  
  const [expandedCategories, setExpandedCategories] = useState<string[]>(Object.keys(defaultInspectionItems));
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [clientSignatureDialogOpen, setClientSignatureDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: inspection, isLoading } = useQuery<InspectionWithDetails>({
    queryKey: ["/api/inspections", params?.id],
    queryFn: async () => {
      const res = await fetch(`/api/inspections/${params?.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inspection");
      return res.json();
    },
    enabled: !!params?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InspectionWithDetails>) => {
      const res = await fetch(`/api/inspections/${params?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update inspection");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspections", params?.id] });
      toast({ title: "Inspection updated" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: { category: string; itemName: string }) => {
      const res = await fetch(`/api/inspections/${params?.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspections", params?.id] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InspectionItem> }) => {
      const res = await fetch(`/api/inspection-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspections", params?.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inspections/${params?.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete inspection");
    },
    onSuccess: () => {
      toast({ title: "Inspection deleted" });
      setLocation("/inspections");
    },
  });

  const handleAddDefaultItems = async () => {
    setIsSaving(true);
    try {
      for (const [category, items] of Object.entries(defaultInspectionItems)) {
        for (const itemName of items) {
          await createItemMutation.mutateAsync({ category, itemName });
        }
      }
      toast({ title: "Default items added" });
    } catch (error) {
      toast({ title: "Failed to add items", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleItemResultChange = (itemId: string, result: string) => {
    updateItemMutation.mutate({ id: itemId, data: { result } });
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !inspection) return;

    const existingPhotos = (inspection.photos as any[]) || [];
    const newPhotos: any[] = [];

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newPhotos.push({
        id: crypto.randomUUID(),
        url: dataUrl,
        timestamp: new Date().toISOString(),
      });
    }

    updateMutation.mutate({ photos: [...existingPhotos, ...newPhotos] });
  };

  const handleRemovePhoto = (photoId: string) => {
    if (!inspection) return;
    const photos = ((inspection.photos as any[]) || []).filter((p) => p.id !== photoId);
    updateMutation.mutate({ photos });
  };

  const handleSaveSignature = () => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) return;
    
    const signature = {
      dataUrl: sigCanvasRef.current.toDataURL(),
      timestamp: new Date().toISOString(),
      type: "inspector",
    };
    
    updateMutation.mutate({ signature });
    setSignatureDialogOpen(false);
  };

  const handleSaveClientSignature = () => {
    if (!clientSigCanvasRef.current || clientSigCanvasRef.current.isEmpty()) return;
    
    const clientSignature = {
      dataUrl: clientSigCanvasRef.current.toDataURL(),
      timestamp: new Date().toISOString(),
      type: "client",
    };
    
    updateMutation.mutate({ clientSignature });
    setClientSignatureDialogOpen(false);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const groupedItems = inspection?.items?.reduce((acc, item) => {
    const category = item.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, InspectionItem[]>) || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold mb-4">Inspection Not Found</h2>
        <Link href="/inspections">
          <Button>Return to Inspections</Button>
        </Link>
      </div>
    );
  }

  const inspectorSignature = inspection.signature as any;
  const clientSignature = inspection.clientSignature as any;
  const photos = (inspection.photos as any[]) || [];

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/inspections">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{inspection.inspectionNo}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{inspection.siteAddress}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[inspection.status] || "bg-gray-100"}>
            {inspection.status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </Badge>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="button-delete-inspection"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inspection Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Site Address</Label>
                  <Input
                    value={inspection.siteAddress || ""}
                    onChange={(e) => updateMutation.mutate({ siteAddress: e.target.value })}
                    data-testid="input-site-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postcode</Label>
                  <Input
                    value={inspection.postcode || ""}
                    onChange={(e) => updateMutation.mutate({ postcode: e.target.value })}
                    data-testid="input-postcode"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Inspection Type</Label>
                  <Select
                    value={inspection.inspectionType}
                    onValueChange={(value) => updateMutation.mutate({ inspectionType: value })}
                  >
                    <SelectTrigger data-testid="select-inspection-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pre_start">Pre-Start</SelectItem>
                      <SelectItem value="progress">Progress</SelectItem>
                      <SelectItem value="final">Final</SelectItem>
                      <SelectItem value="handover">Handover</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={inspection.status}
                    onValueChange={(value) => updateMutation.mutate({ status: value })}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="signed_off">Signed Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Weather Conditions</Label>
                  <Input
                    value={inspection.weatherConditions || ""}
                    onChange={(e) => updateMutation.mutate({ weatherConditions: e.target.value })}
                    placeholder="e.g., Clear, 15°C"
                    data-testid="input-weather"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Overall Result</Label>
                  <Select
                    value={inspection.overallResult || ""}
                    onValueChange={(value) => updateMutation.mutate({ overallResult: value })}
                  >
                    <SelectTrigger data-testid="select-overall-result">
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pass">Pass</SelectItem>
                      <SelectItem value="pass_with_conditions">Pass with Conditions</SelectItem>
                      <SelectItem value="fail">Fail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={inspection.notes || ""}
                  onChange={(e) => updateMutation.mutate({ notes: e.target.value })}
                  rows={3}
                  data-testid="textarea-notes"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Inspection Checklist</CardTitle>
              {(!inspection.items || inspection.items.length === 0) && (
                <Button
                  size="sm"
                  onClick={handleAddDefaultItems}
                  disabled={isSaving}
                  data-testid="button-add-default-items"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Default Items
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(defaultInspectionItems).map((category) => {
                const items = groupedItems[category] || [];
                return (
                  <Collapsible
                    key={category}
                    open={expandedCategories.includes(category)}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between h-12 text-lg font-medium">
                        <span className="capitalize">{category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {items.filter((i) => i.result === "pass").length}/{items.length} passed
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              expandedCategories.includes(category) ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground pl-4">No items in this category</p>
                      ) : (
                        items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                            data-testid={`inspection-item-${item.id}`}
                          >
                            <span className="font-medium">{item.itemName}</span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant={item.result === "pass" ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleItemResultChange(item.id, "pass")}
                                className="h-8 w-8 p-0"
                                data-testid={`button-pass-${item.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant={item.result === "fail" ? "destructive" : "outline"}
                                size="sm"
                                onClick={() => handleItemResultChange(item.id, "fail")}
                                className="h-8 w-8 p-0"
                                data-testid={`button-fail-${item.id}`}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant={item.result === "na" ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => handleItemResultChange(item.id, "na")}
                                className="h-8 w-8 p-0"
                                data-testid={`button-na-${item.id}`}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                multiple
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full mb-4"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-photo"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Photos
              </Button>
              {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center">No photos uploaded</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.url}
                        alt="Inspection photo"
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemovePhoto(photo.id)}
                        data-testid={`button-remove-photo-${photo.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pen className="h-5 w-5" />
                Signatures
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Inspector Signature</Label>
                {inspectorSignature?.dataUrl ? (
                  <div className="border rounded-lg p-2">
                    <img
                      src={inspectorSignature.dataUrl}
                      alt="Inspector signature"
                      className="max-h-20 mx-auto"
                    />
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      {format(new Date(inspectorSignature.timestamp), "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                ) : (
                  <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full" data-testid="button-add-inspector-signature">
                        <Pen className="h-4 w-4 mr-2" />
                        Add Signature
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Inspector Signature</DialogTitle>
                      </DialogHeader>
                      <div className="border rounded-lg overflow-hidden">
                        <SignatureCanvas
                          ref={sigCanvasRef}
                          canvasProps={{
                            className: "w-full h-48 bg-white",
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => sigCanvasRef.current?.clear()}
                          className="flex-1"
                        >
                          Clear
                        </Button>
                        <Button onClick={handleSaveSignature} className="flex-1">
                          Save Signature
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <Separator />

              <div>
                <Label className="mb-2 block">Client Signature (Optional)</Label>
                {clientSignature?.dataUrl ? (
                  <div className="border rounded-lg p-2">
                    <img
                      src={clientSignature.dataUrl}
                      alt="Client signature"
                      className="max-h-20 mx-auto"
                    />
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      {format(new Date(clientSignature.timestamp), "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                ) : (
                  <Dialog open={clientSignatureDialogOpen} onOpenChange={setClientSignatureDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full" data-testid="button-add-client-signature">
                        <Pen className="h-4 w-4 mr-2" />
                        Add Client Signature
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Client Signature</DialogTitle>
                      </DialogHeader>
                      <div className="border rounded-lg overflow-hidden">
                        <SignatureCanvas
                          ref={clientSigCanvasRef}
                          canvasProps={{
                            className: "w-full h-48 bg-white",
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => clientSigCanvasRef.current?.clear()}
                          className="flex-1"
                        >
                          Clear
                        </Button>
                        <Button onClick={handleSaveClientSignature} className="flex-1">
                          Save Signature
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                Inspector Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inspector:</span>
                  <span className="font-medium">{inspection.inspector?.name || "Not assigned"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">
                    {inspection.inspectionDate
                      ? format(new Date(inspection.inspectionDate), "dd MMM yyyy")
                      : "Not set"}
                  </span>
                </div>
                {inspection.job && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job:</span>
                    <Link href={`/jobs/${inspection.job.id}`}>
                      <span className="font-medium text-primary hover:underline cursor-pointer">
                        {inspection.job.jobNo}
                      </span>
                    </Link>
                  </div>
                )}
                {inspection.client && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client:</span>
                    <span className="font-medium">{inspection.client.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
