import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, GripVertical, Trash2, Save, Send, Type, AlignLeft, Hash, Calendar, List, CheckSquare, Camera, PenTool, ToggleLeft, Repeat, Calculator } from "lucide-react";
import type { FormField, FormSchemaDefinition, ConditionalLogic } from "@shared/schema";

const fieldTypes = [
  { type: "text", label: "Text", icon: Type },
  { type: "textarea", label: "Text Area", icon: AlignLeft },
  { type: "number", label: "Number", icon: Hash },
  { type: "date", label: "Date", icon: Calendar },
  { type: "select", label: "Dropdown", icon: List },
  { type: "multiselect", label: "Multi-Select", icon: List },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "yesno", label: "Yes/No", icon: ToggleLeft },
  { type: "photo", label: "Photo", icon: Camera },
  { type: "signature", label: "Signature", icon: PenTool },
  { type: "repeatable_group", label: "Repeatable Group", icon: Repeat },
  { type: "calculated", label: "Calculated", icon: Calculator },
] as const;

interface SortableFieldProps {
  field: FormField;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableField({ field, onEdit, onDelete }: SortableFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const FieldIcon = fieldTypes.find((f) => f.type === field.type)?.icon || Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border rounded-lg group hover:border-muted-foreground transition-colors"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FieldIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{field.label}</p>
          <p className="text-xs text-muted-foreground">{field.key} {field.required && <span className="text-red-500">*</span>}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-${field.key}`}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700" data-testid={`button-delete-${field.key}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function FormBuilder() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fields, setFields] = useState<FormField[]>([]);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: template } = useQuery({
    queryKey: ["/api/forms/templates", id],
    queryFn: async () => {
      const res = await fetch(`/api/forms/templates/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch template");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: versions } = useQuery({
    queryKey: ["/api/forms/templates", id, "versions"],
    queryFn: async () => {
      const res = await fetch(`/api/forms/templates/${id}/versions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch versions");
      return res.json();
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (versions && versions.length > 0) {
      const latestVersion = versions[0];
      const schema = latestVersion.schema as FormSchemaDefinition;
      setFields(schema?.fields || []);
    }
  }, [versions]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const schema: FormSchemaDefinition = {
        name: template?.name || "Untitled",
        style: "clean",
        fields,
      };
      const res = await fetch(`/api/forms/templates/${id}/schema`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ schema }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/forms/templates", id, "versions"] });
      toast({ title: "Saved", description: "Changes saved successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (hasChanges) {
        await saveMutation.mutateAsync();
      }
      const res = await fetch(`/api/forms/templates/${id}/publish`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to publish");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms/templates"] });
      toast({ title: "Published", description: "Template is now available for use" });
      setLocation("/forms/templates");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to publish template", variant: "destructive" });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.key === active.id);
      const newIndex = fields.findIndex((f) => f.key === over.id);
      setFields(arrayMove(fields, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const addField = (type: FormField["type"]) => {
    const count = fields.filter((f) => f.type === type).length + 1;
    const newField: FormField = {
      type,
      key: `${type}_${Date.now()}`,
      label: `${fieldTypes.find((f) => f.type === type)?.label} ${count}`,
      required: false,
    };
    if (type === "select" || type === "multiselect") {
      newField.options = [{ label: "Option 1", value: "option_1" }];
    }
    setFields([...fields, newField]);
    setEditingField(newField);
    setIsSheetOpen(true);
    setHasChanges(true);
  };

  const updateField = (key: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.key === key ? { ...f, ...updates } : f)));
    setHasChanges(true);
  };

  const deleteField = (key: string) => {
    setFields(fields.filter((f) => f.key !== key));
    setHasChanges(true);
    if (editingField?.key === key) {
      setIsSheetOpen(false);
      setEditingField(null);
    }
  };

  const handleEditField = (field: FormField) => {
    setEditingField(field);
    setIsSheetOpen(true);
  };

  return (
    <div className="min-h-screen bg-muted">
      <div className="sticky top-0 z-10 bg-card border-b px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/forms/templates")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-lg">{template?.name || "Form Builder"}</h1>
              <p className="text-sm text-muted-foreground">
                {template?.status === "draft" ? "Draft" : "Published"} • {fields.length} fields
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasChanges}
              data-testid="button-save"
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || fields.length === 0}
              data-testid="button-publish"
            >
              <Send className="h-4 w-4 mr-2" />
              Publish
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Form Fields</CardTitle>
              </CardHeader>
              <CardContent>
                {fields.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No fields yet. Add fields from the panel on the right.</p>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {fields.map((field) => (
                          <SortableField
                            key={field.key}
                            field={field}
                            onEdit={() => handleEditField(field)}
                            onDelete={() => deleteField(field.key)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add Field</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {fieldTypes.map(({ type, label, icon: Icon }) => (
                  <Button
                    key={type}
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center gap-1 text-xs"
                    onClick={() => addField(type)}
                    data-testid={`button-add-${type}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Field Settings</SheetTitle>
          </SheetHeader>
          {editingField && (
            <div className="space-y-6 mt-6">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={editingField.label}
                  onChange={(e) => {
                    const updated = { ...editingField, label: e.target.value };
                    setEditingField(updated);
                    updateField(editingField.key, { label: e.target.value });
                  }}
                  data-testid="input-field-label"
                />
              </div>

              <div className="space-y-2">
                <Label>Field Key</Label>
                <Input
                  value={editingField.key}
                  onChange={(e) => {
                    const newKey = e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
                    const updated = { ...editingField, key: newKey };
                    setEditingField(updated);
                    setFields(fields.map((f) => (f.key === editingField.key ? updated : f)));
                    setHasChanges(true);
                  }}
                  data-testid="input-field-key"
                />
                <p className="text-xs text-muted-foreground">Unique identifier used for data storage</p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Required</Label>
                  <p className="text-xs text-muted-foreground">Make this field mandatory</p>
                </div>
                <Switch
                  checked={editingField.required || false}
                  onCheckedChange={(checked) => {
                    const updated = { ...editingField, required: checked };
                    setEditingField(updated);
                    updateField(editingField.key, { required: checked });
                  }}
                  data-testid="switch-required"
                />
              </div>

              {(editingField.type === "photo") && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Multiple</Label>
                    <p className="text-xs text-muted-foreground">Allow multiple photos</p>
                  </div>
                  <Switch
                    checked={editingField.multiple || false}
                    onCheckedChange={(checked) => {
                      const updated = { ...editingField, multiple: checked };
                      setEditingField(updated);
                      updateField(editingField.key, { multiple: checked });
                    }}
                    data-testid="switch-multiple"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Prefill From</Label>
                <Select
                  value={editingField.prefill || "none"}
                  onValueChange={(value) => {
                    const prefill = value === "none" ? undefined : value;
                    const updated = { ...editingField, prefill };
                    setEditingField(updated);
                    updateField(editingField.key, { prefill });
                  }}
                >
                  <SelectTrigger data-testid="select-prefill">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="job.ref">Job Reference</SelectItem>
                    <SelectItem value="job.customerName">Customer Name</SelectItem>
                    <SelectItem value="job.address">Job Address</SelectItem>
                    <SelectItem value="client.name">Client Name</SelectItem>
                    <SelectItem value="client.email">Client Email</SelectItem>
                    <SelectItem value="quote.number">Quote Number</SelectItem>
                    <SelectItem value="user.name">Current User Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(editingField.type === "select" || editingField.type === "multiselect") && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="space-y-2">
                    {(editingField.options || []).map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={option.label}
                          onChange={(e) => {
                            const newOptions = [...(editingField.options || [])];
                            newOptions[index] = { ...newOptions[index], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "_") };
                            const updated = { ...editingField, options: newOptions };
                            setEditingField(updated);
                            updateField(editingField.key, { options: newOptions });
                          }}
                          placeholder="Option label"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newOptions = (editingField.options || []).filter((_, i) => i !== index);
                            const updated = { ...editingField, options: newOptions };
                            setEditingField(updated);
                            updateField(editingField.key, { options: newOptions });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newOptions = [...(editingField.options || []), { label: "", value: "" }];
                        const updated = { ...editingField, options: newOptions };
                        setEditingField(updated);
                        updateField(editingField.key, { options: newOptions });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Option
                    </Button>
                  </div>
                </div>
              )}

              {/* Calculated field formula */}
              {editingField.type === "calculated" && (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-2">
                    <Label>Formula</Label>
                    <Input
                      value={editingField.formula || ""}
                      onChange={(e) => {
                        const updated = { ...editingField, formula: e.target.value };
                        setEditingField(updated);
                        updateField(editingField.key, { formula: e.target.value });
                      }}
                      placeholder="e.g., {quantity} * {unit_price}"
                      data-testid="input-formula"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {"{field_key}"} to reference other fields. Supports: +, -, *, /, parentheses.
                    </p>
                  </div>
                </div>
              )}

              {/* Placeholder and help text for text fields */}
              {(editingField.type === "text" || editingField.type === "textarea" || editingField.type === "number") && (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-2">
                    <Label>Placeholder</Label>
                    <Input
                      value={editingField.placeholder || ""}
                      onChange={(e) => {
                        const updated = { ...editingField, placeholder: e.target.value };
                        setEditingField(updated);
                        updateField(editingField.key, { placeholder: e.target.value });
                      }}
                      placeholder="Placeholder text..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Help Text</Label>
                    <Input
                      value={editingField.helpText || ""}
                      onChange={(e) => {
                        const updated = { ...editingField, helpText: e.target.value };
                        setEditingField(updated);
                        updateField(editingField.key, { helpText: e.target.value });
                      }}
                      placeholder="Additional instructions..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
