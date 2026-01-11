import { useState, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Plus, MapPin, ChevronDown, Camera, CheckCircle2, AlertTriangle, Trash2, Upload, X, Pen } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from "react-signature-canvas";
import type { SnaggingSheetWithDetails, SnagItem } from "@shared/schema";

const statusColors: Record<string, string> = {
  open: "bg-orange-100 text-orange-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  verified: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  signed_off: "bg-purple-100 text-purple-800",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const snagCategories = [
  { value: "decoration", label: "Decoration" },
  { value: "joinery", label: "Joinery" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "flooring", label: "Flooring" },
  { value: "external", label: "External" },
  { value: "other", label: "Other" },
];

export default function SnaggingDetail() {
  const [match, params] = useRoute("/snagging/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clientSigCanvasRef = useRef<SignatureCanvas>(null);
  const snagPhotoInputRef = useRef<HTMLInputElement>(null);
  const completionPhotoInputRef = useRef<HTMLInputElement>(null);
  
  const [expandedLocations, setExpandedLocations] = useState<string[]>([]);
  const [addSnagDialogOpen, setAddSnagDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [clientSignatureDialogOpen, setClientSignatureDialogOpen] = useState(false);
  const [selectedSnagId, setSelectedSnagId] = useState<string | null>(null);
  const [completionPhotos, setCompletionPhotos] = useState<any[]>([]);
  const [completionNotes, setCompletionNotes] = useState("");
  
  const [newSnag, setNewSnag] = useState({
    location: "",
    category: "decoration",
    description: "",
    priority: "medium",
    photos: [] as any[],
  });

  const { data: sheet, isLoading } = useQuery<SnaggingSheetWithDetails>({
    queryKey: ["/api/snagging", params?.id],
    queryFn: async () => {
      const res = await fetch(`/api/snagging/${params?.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch snagging sheet");
      return res.json();
    },
    enabled: !!params?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<SnaggingSheetWithDetails>) => {
      const res = await fetch(`/api/snagging/${params?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update sheet");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snagging", params?.id] });
      toast({ title: "Sheet updated" });
    },
  });

  const createSnagMutation = useMutation({
    mutationFn: async (data: typeof newSnag) => {
      const res = await fetch(`/api/snagging/${params?.id}/snags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create snag");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snagging", params?.id] });
      setAddSnagDialogOpen(false);
      setNewSnag({ location: "", category: "decoration", description: "", priority: "medium", photos: [] });
      toast({ title: "Snag added" });
    },
  });

  const resolveSnagMutation = useMutation({
    mutationFn: async ({ id, completionPhotos, notes }: { id: string; completionPhotos: any[]; notes: string }) => {
      const res = await fetch(`/api/snags/${id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ completionPhotos, notes }),
      });
      if (!res.ok) throw new Error("Failed to resolve snag");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snagging", params?.id] });
      setResolveDialogOpen(false);
      setSelectedSnagId(null);
      setCompletionPhotos([]);
      setCompletionNotes("");
      toast({ title: "Snag resolved" });
    },
  });

  const deleteSnagMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/snags/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete snag");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snagging", params?.id] });
      toast({ title: "Snag deleted" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/snagging/${params?.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete sheet");
    },
    onSuccess: () => {
      toast({ title: "Snagging sheet deleted" });
      setLocation("/snagging");
    },
  });

  const handleSnagPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const photos: any[] = [];
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      photos.push({
        id: crypto.randomUUID(),
        url: dataUrl,
        timestamp: new Date().toISOString(),
      });
    }
    setNewSnag((prev) => ({ ...prev, photos: [...prev.photos, ...photos] }));
  };

  const handleCompletionPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const photos: any[] = [];
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      photos.push({
        id: crypto.randomUUID(),
        url: dataUrl,
        timestamp: new Date().toISOString(),
      });
    }
    setCompletionPhotos((prev) => [...prev, ...photos]);
  };

  const handleSaveClientSignature = () => {
    if (!clientSigCanvasRef.current || clientSigCanvasRef.current.isEmpty()) return;
    
    const clientSignature = {
      dataUrl: clientSigCanvasRef.current.toDataURL(),
      timestamp: new Date().toISOString(),
      type: "client",
    };
    
    updateMutation.mutate({ clientSignature, status: "signed_off" });
    setClientSignatureDialogOpen(false);
  };

  const toggleLocation = (location: string) => {
    setExpandedLocations((prev) =>
      prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]
    );
  };

  const openResolveDialog = (snagId: string) => {
    setSelectedSnagId(snagId);
    setResolveDialogOpen(true);
  };

  const groupedSnags = sheet?.snags?.reduce((acc, snag) => {
    const location = snag.location || "Unspecified";
    if (!acc[location]) acc[location] = [];
    acc[location].push(snag);
    return acc;
  }, {} as Record<string, SnagItem[]>) || {};

  const progressPercent = sheet?.totalSnags && sheet.totalSnags > 0
    ? Math.round(((sheet.resolvedSnags || 0) / sheet.totalSnags) * 100)
    : 0;

  const allResolved = sheet?.totalSnags && sheet.totalSnags > 0 && sheet.resolvedSnags === sheet.totalSnags;
  const clientSignature = sheet?.clientSignature as any;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold mb-4">Snagging Sheet Not Found</h2>
        <Link href="/snagging">
          <Button>Return to Snagging Sheets</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/snagging">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{sheet.sheetNo}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{sheet.siteAddress}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[sheet.status] || "bg-gray-100"}>
            {sheet.status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </Badge>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="button-delete-sheet"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sheet Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Site Address</Label>
                  <Input
                    value={sheet.siteAddress || ""}
                    onChange={(e) => updateMutation.mutate({ siteAddress: e.target.value })}
                    data-testid="input-site-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postcode</Label>
                  <Input
                    value={sheet.postcode || ""}
                    onChange={(e) => updateMutation.mutate({ postcode: e.target.value })}
                    data-testid="input-postcode"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={sheet.status}
                    onValueChange={(value) => updateMutation.mutate({ status: value })}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="signed_off">Signed Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={sheet.notes || ""}
                  onChange={(e) => updateMutation.mutate({ notes: e.target.value })}
                  rows={3}
                  data-testid="textarea-notes"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Snag Items
              </CardTitle>
              <Dialog open={addSnagDialogOpen} onOpenChange={setAddSnagDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-snag">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Snag
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Snag</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        placeholder="e.g., Kitchen, Bedroom 1, Hallway"
                        value={newSnag.location}
                        onChange={(e) => setNewSnag((prev) => ({ ...prev, location: e.target.value }))}
                        data-testid="input-snag-location"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={newSnag.category}
                        onValueChange={(value) => setNewSnag((prev) => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger data-testid="select-snag-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {snagCategories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Describe the issue..."
                        value={newSnag.description}
                        onChange={(e) => setNewSnag((prev) => ({ ...prev, description: e.target.value }))}
                        data-testid="textarea-snag-description"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={newSnag.priority}
                        onValueChange={(value) => setNewSnag((prev) => ({ ...prev, priority: value }))}
                      >
                        <SelectTrigger data-testid="select-snag-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Photos</Label>
                      <input
                        type="file"
                        ref={snagPhotoInputRef}
                        onChange={handleSnagPhotoUpload}
                        accept="image/*"
                        multiple
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => snagPhotoInputRef.current?.click()}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Add Photos
                      </Button>
                      {newSnag.photos.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {newSnag.photos.map((photo) => (
                            <div key={photo.id} className="relative">
                              <img
                                src={photo.url}
                                alt="Snag photo"
                                className="w-full h-16 object-cover rounded"
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-0 right-0 h-5 w-5"
                                onClick={() =>
                                  setNewSnag((prev) => ({
                                    ...prev,
                                    photos: prev.photos.filter((p) => p.id !== photo.id),
                                  }))
                                }
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createSnagMutation.mutate(newSnag)}
                      disabled={!newSnag.location || !newSnag.description || createSnagMutation.isPending}
                    >
                      Add Snag
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(groupedSnags).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No snags recorded yet</p>
                </div>
              ) : (
                Object.entries(groupedSnags).map(([location, snags]) => (
                  <Collapsible
                    key={location}
                    open={expandedLocations.includes(location) || expandedLocations.length === 0}
                    onOpenChange={() => toggleLocation(location)}
                    defaultOpen
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between h-12 text-lg font-medium">
                        <span>{location}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {snags.filter((s) => s.status === "resolved" || s.status === "verified").length}/{snags.length} resolved
                          </span>
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      {snags.map((snag) => {
                        const snagPhotos = (snag.photos as any[]) || [];
                        const isResolved = snag.status === "resolved" || snag.status === "verified";
                        return (
                          <div
                            key={snag.id}
                            className={`p-4 border rounded-lg ${isResolved ? "bg-green-50 border-green-200" : "bg-muted/50"}`}
                            data-testid={`snag-item-${snag.id}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="capitalize">
                                    {snag.category}
                                  </Badge>
                                  <Badge className={priorityColors[snag.priority] || "bg-gray-100"}>
                                    {snag.priority}
                                  </Badge>
                                  <Badge className={statusColors[snag.status] || "bg-gray-100"}>
                                    {snag.status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                                  </Badge>
                                </div>
                                <p className="font-medium">{snag.description}</p>
                                {snag.notes && (
                                  <p className="text-sm text-muted-foreground mt-1">{snag.notes}</p>
                                )}
                                {snagPhotos.length > 0 && (
                                  <div className="flex gap-2 mt-2">
                                    {snagPhotos.map((photo) => (
                                      <img
                                        key={photo.id}
                                        src={photo.url}
                                        alt="Snag photo"
                                        className="h-16 w-16 object-cover rounded"
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {!isResolved && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openResolveDialog(snag.id)}
                                    data-testid={`button-resolve-${snag.id}`}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Resolve
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteSnagMutation.mutate(snag.id)}
                                  data-testid={`button-delete-snag-${snag.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">{progressPercent}%</div>
                <p className="text-muted-foreground">
                  {sheet.resolvedSnags || 0} of {sheet.totalSnags || 0} snags resolved
                </p>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pen className="h-5 w-5" />
                Client Sign-Off
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientSignature?.dataUrl ? (
                <div className="border rounded-lg p-2">
                  <img
                    src={clientSignature.dataUrl}
                    alt="Client signature"
                    className="max-h-20 mx-auto"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    Signed: {format(new Date(clientSignature.timestamp), "dd MMM yyyy HH:mm")}
                  </p>
                </div>
              ) : allResolved ? (
                <Dialog open={clientSignatureDialogOpen} onOpenChange={setClientSignatureDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" data-testid="button-client-signoff">
                      <Pen className="h-4 w-4 mr-2" />
                      Client Sign-Off
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Client Sign-Off</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      By signing below, the client confirms all snags have been resolved satisfactorily.
                    </p>
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
                        Sign Off
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  All snags must be resolved before client sign-off
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created By:</span>
                  <span className="font-medium">{sheet.createdBy?.name || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">
                    {sheet.createdAt
                      ? format(new Date(sheet.createdAt), "dd MMM yyyy")
                      : "Not set"}
                  </span>
                </div>
                {sheet.job && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job:</span>
                    <Link href={`/jobs/${sheet.job.id}`}>
                      <span className="font-medium text-primary hover:underline cursor-pointer">
                        {sheet.job.jobNo}
                      </span>
                    </Link>
                  </div>
                )}
                {sheet.client && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client:</span>
                    <span className="font-medium">{sheet.client.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Snag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Completion Notes</Label>
              <Textarea
                placeholder="Describe how the issue was resolved..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                data-testid="textarea-completion-notes"
              />
            </div>
            <div className="space-y-2">
              <Label>Completion Photos</Label>
              <input
                type="file"
                ref={completionPhotoInputRef}
                onChange={handleCompletionPhotoUpload}
                accept="image/*"
                multiple
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => completionPhotoInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Add Photos
              </Button>
              {completionPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {completionPhotos.map((photo) => (
                    <div key={photo.id} className="relative">
                      <img
                        src={photo.url}
                        alt="Completion photo"
                        className="w-full h-16 object-cover rounded"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-0 right-0 h-5 w-5"
                        onClick={() =>
                          setCompletionPhotos((prev) => prev.filter((p) => p.id !== photo.id))
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                selectedSnagId &&
                resolveSnagMutation.mutate({
                  id: selectedSnagId,
                  completionPhotos,
                  notes: completionNotes,
                })
              }
              disabled={resolveSnagMutation.isPending}
            >
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
