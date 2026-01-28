import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Camera, Save, Send, X, Loader2, Calculator } from "lucide-react";
import type { FormField, FormSchemaDefinition } from "@shared/schema";
import { processFormFields, validateForm, evaluateFormula } from "@/lib/form-logic";

interface SignaturePadProps {
  value?: string;
  onChange: (dataUrl: string) => void;
}

function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, [value]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      onChange(canvasRef.current.toDataURL());
    }
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={300}
        height={150}
        className="border rounded-lg bg-white touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <Button type="button" variant="outline" size="sm" onClick={clear}>
        Clear
      </Button>
    </div>
  );
}

export default function FormFill() {
  const { versionId } = useParams<{ versionId: string }>();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const entityType = params.get("entityType") || "job";
  const entityId = params.get("entityId") || "";
  const submissionId = params.get("submissionId");
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [activePhotoField, setActivePhotoField] = useState<string | null>(null);

  const { data: version, isLoading: isLoadingVersion } = useQuery({
    queryKey: ["/api/forms/versions", versionId, "schema"],
    queryFn: async () => {
      const res = await fetch(`/api/forms/versions/${versionId}/schema`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch form schema");
      return res.json() as Promise<FormSchemaDefinition>;
    },
    enabled: !!versionId,
  });

  const { data: existingSubmission } = useQuery({
    queryKey: ["/api/forms/submissions", submissionId],
    queryFn: async () => {
      const res = await fetch(`/api/forms/submissions/${submissionId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch submission");
      return res.json();
    },
    enabled: !!submissionId,
  });

  const { data: entity } = useQuery({
    queryKey: [`/api/${entityType}s`, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/${entityType}s/${entityId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!entityId && !!entityType,
  });

  useEffect(() => {
    if (existingSubmission?.data) {
      setFormData(existingSubmission.data as Record<string, unknown>);
    }
  }, [existingSubmission]);

  useEffect(() => {
    if (version?.fields && entity && !existingSubmission) {
      const prefillData: Record<string, unknown> = {};
      version.fields.forEach((field) => {
        if (field.prefill) {
          const [entityKey, propKey] = field.prefill.split(".");
          if (entityKey === entityType || entityKey === "job" || entityKey === "client" || entityKey === "quote") {
            prefillData[field.key] = entity[propKey] || entity[field.prefill.replace(`${entityKey}.`, "")];
          }
        }
      });
      if (Object.keys(prefillData).length > 0) {
        setFormData((prev) => ({ ...prev, ...prefillData }));
      }
    }
  }, [version, entity, existingSubmission, entityType]);

  const createSubmissionMutation = useMutation({
    mutationFn: async (data?: Record<string, any>) => {
      const submissionData = data || formData;
      const res = await fetch("/api/forms/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateVersionId: versionId,
          entityType,
          entityId,
          data: submissionData,
        }),
      });
      if (!res.ok) throw new Error("Failed to create submission");
      return res.json();
    },
  });

  const updateSubmissionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data?: Record<string, any> }) => {
      const submissionData = data || formData;
      const res = await fetch(`/api/forms/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data: submissionData }),
      });
      if (!res.ok) throw new Error("Failed to update submission");
      return res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/forms/submissions/${id}/submit`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to submit form");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms/submissions"] });
      toast({ title: "Form Submitted", description: "Your form has been submitted successfully" });
      setLocation("/forms/submissions");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit form", variant: "destructive" });
    },
  });

  const handleSaveDraft = async () => {
    try {
      if (submissionId) {
        await updateSubmissionMutation.mutateAsync({ id: submissionId });
      } else {
        const result = await createSubmissionMutation.mutateAsync(formData);
        const newUrl = `/forms/fill/${versionId}?entityType=${entityType}&entityId=${entityId}&submissionId=${result.id}`;
        window.history.replaceState({}, "", newUrl);
      }
      toast({ title: "Saved", description: "Draft saved successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to save draft", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    const fields = version?.fields || [];
    const { computedValues: finalValues } = processFormFields(fields, formData);
    
    const validation = validateForm(fields, formData);
    
    if (!validation.valid) {
      const errorMessages = Object.values(validation.errors);
      toast({
        title: "Required fields missing",
        description: errorMessages.slice(0, 3).join(", ") + (errorMessages.length > 3 ? ` and ${errorMessages.length - 3} more` : ""),
        variant: "destructive",
      });
      return;
    }

    const submissionData = { ...formData, ...finalValues };

    try {
      let id = submissionId;
      if (!id) {
        const result = await createSubmissionMutation.mutateAsync(submissionData);
        id = result.id;
      } else {
        await updateSubmissionMutation.mutateAsync({ id, data: submissionData });
      }
      await submitMutation.mutateAsync(id!);
    } catch {
      toast({ title: "Error", description: "Failed to submit form", variant: "destructive" });
    }
  };

  const handlePhotoCapture = (fieldKey: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const currentPhotos = (formData[fieldKey] as string[]) || [];
      setFormData({
        ...formData,
        [fieldKey]: [...currentPhotos, reader.result as string],
      });
    };
    reader.readAsDataURL(file);
    setActivePhotoField(null);
  };

  const removePhoto = (fieldKey: string, index: number) => {
    const currentPhotos = (formData[fieldKey] as string[]) || [];
    setFormData({
      ...formData,
      [fieldKey]: currentPhotos.filter((_, i) => i !== index),
    });
  };

  const renderField = (field: FormField) => {
    const value = formData[field.key];

    switch (field.type) {
      case "text":
        return (
          <Input
            value={(value as string) || ""}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            data-testid={`input-${field.key}`}
          />
        );
      case "textarea":
        return (
          <Textarea
            value={(value as string) || ""}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            rows={4}
            data-testid={`textarea-${field.key}`}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={(value as number) ?? ""}
            onChange={(e) => setFormData({ ...formData, [field.key]: parseFloat(e.target.value) || 0 })}
            data-testid={`input-${field.key}`}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={(value as string) || ""}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            data-testid={`input-${field.key}`}
          />
        );
      case "select":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={(v) => setFormData({ ...formData, [field.key]: v })}
          >
            <SelectTrigger data-testid={`select-${field.key}`}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "multiselect":
        return (
          <div className="space-y-2">
            {field.options?.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.key}-${opt.value}`}
                  checked={((value as string[]) || []).includes(opt.value)}
                  onCheckedChange={(checked) => {
                    const current = (value as string[]) || [];
                    setFormData({
                      ...formData,
                      [field.key]: checked
                        ? [...current, opt.value]
                        : current.filter((v) => v !== opt.value),
                    });
                  }}
                />
                <label htmlFor={`${field.key}-${opt.value}`}>{opt.label}</label>
              </div>
            ))}
          </div>
        );
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={field.key}
              checked={(value as boolean) || false}
              onCheckedChange={(checked) => setFormData({ ...formData, [field.key]: checked })}
              data-testid={`checkbox-${field.key}`}
            />
            <label htmlFor={field.key}>{field.label}</label>
          </div>
        );
      case "yesno":
        return (
          <RadioGroup
            value={(value as string) || ""}
            onValueChange={(v) => setFormData({ ...formData, [field.key]: v })}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="yes" id={`${field.key}-yes`} data-testid={`radio-${field.key}-yes`} />
              <label htmlFor={`${field.key}-yes`}>Yes</label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="no" id={`${field.key}-no`} data-testid={`radio-${field.key}-no`} />
              <label htmlFor={`${field.key}-no`}>No</label>
            </div>
          </RadioGroup>
        );
      case "photo":
        const photos = (value as string[]) || [];
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative">
                  <img src={photo} alt="" className="w-20 h-20 object-cover rounded-lg" />
                  <button
                    type="button"
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    onClick={() => removePhoto(field.key, index)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => handlePhotoCapture(field.key, e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActivePhotoField(field.key);
                fileInputRef.current?.click();
              }}
              data-testid={`button-photo-${field.key}`}
            >
              <Camera className="h-4 w-4 mr-2" />
              Add Photo
            </Button>
          </div>
        );
      case "signature":
        return (
          <SignaturePad
            value={(value as string) || ""}
            onChange={(dataUrl) => setFormData({ ...formData, [field.key]: dataUrl })}
          />
        );
      case "calculated":
        const calculatedValue = field.formula ? evaluateFormula(field.formula, formData) : 0;
        return (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg" data-testid={`calculated-${field.key}`}>
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-lg">{calculatedValue}</span>
            {field.helpText && <span className="text-sm text-muted-foreground ml-2">({field.helpText})</span>}
          </div>
        );
      default:
        return <p className="text-slate-500">Unsupported field type: {field.type}</p>;
    }
  };

  const { visibleFields, computedValues } = processFormFields(version?.fields || [], formData);

  if (isLoadingVersion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!version) {
    return (
      <div className="p-6">
        <p className="text-red-600">Form not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/forms/submissions")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold">{version.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={createSubmissionMutation.isPending || updateSubmissionMutation.isPending} data-testid="button-save-draft">
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitMutation.isPending} data-testid="button-submit">
              <Send className="h-4 w-4 mr-1" />
              Submit
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {visibleFields.map((field) => (
          <Card key={field.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </CardTitle>
              {field.helpText && field.type !== "calculated" && (
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              )}
            </CardHeader>
            <CardContent>{renderField(field)}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
