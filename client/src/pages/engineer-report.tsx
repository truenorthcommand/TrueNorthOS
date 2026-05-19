import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Plus, Trash2, Send, ArrowLeft, Package, FileText, ClipboardCheck, Loader2, Upload, X } from "lucide-react";

interface Material {
  name: string;
  quantity: string;
}

interface FurtherAction {
  description: string;
  priority: string;
}

interface UploadedPhoto {
  url: string;
  source: string;
}

export default function EngineerReport() {
  const [match, params] = useRoute("/jobs/:id/report");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const jobId = params?.id;

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}`],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!jobId,
  });

  const [worksCompleted, setWorksCompleted] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [furtherActions, setFurtherActions] = useState<FurtherAction[]>([]);
  const [notes, setNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const existingPhotos = job?.photos || [];
      const allPhotos = [...existingPhotos, ...photos];

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          worksCompleted,
          materials: materials.filter(m => m.name.trim()),
          photos: allPhotos,
          furtherActions: furtherActions.filter(a => a.description.trim()),
          notes,
          status: 'Awaiting Signatures',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to submit report' }));
        throw new Error(err.error || 'Failed to submit report');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Report Submitted', description: 'Job moved to Awaiting Signatures.' });
      setLocation(`/jobs/${jobId}/sign-off`);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to submit report', variant: 'destructive' });
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        setPhotos(prev => [...prev, { url: data.url, source: 'engineer' }]);
      }
      toast({ title: 'Photos uploaded', description: `${files.length} photo(s) added.` });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const addMaterial = () => {
    setMaterials(prev => [...prev, { name: '', quantity: '' }]);
  };

  const updateMaterial = (index: number, field: keyof Material, value: string) => {
    setMaterials(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const removeMaterial = (index: number) => {
    setMaterials(prev => prev.filter((_, i) => i !== index));
  };

  const addFurtherAction = () => {
    setFurtherActions(prev => [...prev, { description: '', priority: 'Medium' }]);
  };

  const updateFurtherAction = (index: number, field: keyof FurtherAction, value: string) => {
    setFurtherActions(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const removeFurtherAction = (index: number) => {
    setFurtherActions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!worksCompleted.trim()) {
      toast({ title: 'Required', description: 'Please describe the works completed.', variant: 'destructive' });
      return;
    }
    submitMutation.mutate();
  };

  if (jobLoading || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#E8A54B] mx-auto" />
          <p className="text-gray-500">Loading job details...</p>
          <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[#0F2B4C]">Tradesman Report</h1>
            <p className="text-sm text-gray-500">Complete your work report</p>
          </div>
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">{job.status}</Badge>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Job Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-[#E8A54B]" />
              <CardTitle className="text-base text-[#0F2B4C]">Job Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Job Number</span>
              <span className="text-sm font-medium">{job.jobNumber || job.id}</span>
            </div>
            {job.clientName && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Client</span>
                <span className="text-sm font-medium">{job.clientName}</span>
              </div>
            )}
            {(job.siteAddress || job.address) && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Site Address</span>
                <span className="text-sm font-medium text-right max-w-[60%]">{job.siteAddress || job.address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Works Completed */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#E8A54B]" />
              <CardTitle className="text-base text-[#0F2B4C]">Works Completed *</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Describe what was done on site..."
              value={worksCompleted}
              onChange={(e) => setWorksCompleted(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </CardContent>
        </Card>

        {/* Materials Used */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#E8A54B]" />
                <CardTitle className="text-base text-[#0F2B4C]">Materials Used</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={addMaterial}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {materials.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">No materials added yet</p>
            )}
            {materials.map((material, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Material name"
                    value={material.name}
                    onChange={(e) => updateMaterial(index, 'name', e.target.value)}
                  />
                </div>
                <div className="w-24">
                  <Input
                    placeholder="Qty"
                    value={material.quantity}
                    onChange={(e) => updateMaterial(index, 'quantity', e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeMaterial(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-[#E8A54B]" />
                <CardTitle className="text-base text-[#0F2B4C]">Photos</CardTitle>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <div className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Upload
                </div>
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {photos.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">No photos uploaded yet</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative group">
                  <img
                    src={photo.url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Further Actions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-[#E8A54B]" />
                <CardTitle className="text-base text-[#0F2B4C]">Further Actions Required</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={addFurtherAction}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {furtherActions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">No further actions needed</p>
            )}
            {furtherActions.map((action, index) => (
              <div key={index} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Describe follow-up work needed"
                      value={action.description}
                      onChange={(e) => updateFurtherAction(index, 'description', e.target.value)}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFurtherAction(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Select
                  value={action.priority}
                  onValueChange={(val) => updateFurtherAction(index, 'priority', val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low Priority</SelectItem>
                    <SelectItem value="Medium">Medium Priority</SelectItem>
                    <SelectItem value="High">High Priority</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#E8A54B]" />
              <CardTitle className="text-base text-[#0F2B4C]">Additional Notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any additional notes or observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </CardContent>
        </Card>
      </div>

      {/* Fixed Bottom Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {photos.length} photo(s) · {materials.filter(m => m.name.trim()).length} material(s)
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !worksCompleted.trim()}
            className="bg-[#E8A54B] hover:bg-[#d4953f] text-white"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Submit Report
          </Button>
        </div>
      </div>
    </div>
  );
}
