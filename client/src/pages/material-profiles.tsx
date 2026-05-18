import { useState, useRef, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { hasRole } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Loader2, Ban, Package,
  ShieldCheck, ShieldAlert, Tag, Layers, X, Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────
interface MaterialProfile {
  id: string;
  name: string;
  description: string | null;
  jobTypes: string[];
  permittedMaterials: string[];
  flaggedMaterials: string[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ProfileForm {
  name: string;
  description: string;
  jobTypes: string[];
  permittedMaterials: string[];
  flaggedMaterials: string[];
  active: boolean;
}

const EMPTY_FORM: ProfileForm = {
  name: "",
  description: "",
  jobTypes: [],
  permittedMaterials: [],
  flaggedMaterials: [],
  active: true,
};

// ── Tag Input ────────────────────────────────────────────────────────
function TagInput({
  value,
  onChange,
  placeholder,
  color = "default",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  color?: "default" | "green" | "red";
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const badgeClass =
    color === "green"
      ? "bg-green-100 text-green-800 border-green-300"
      : color === "red"
        ? "bg-red-100 text-red-800 border-red-300"
        : "bg-slate-100 text-slate-800 border-slate-300";

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      const tag = input.trim().toLowerCase();
      if (!value.includes(tag)) {
        onChange([...value, tag]);
      }
      setInput("");
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 p-2 border rounded-md bg-background min-h-[40px] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="outline" className={`text-xs gap-1 ${badgeClass}`}>
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="ml-0.5 hover:text-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
      />
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────
export default function MaterialProfiles() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState("");

  // Access check
  if (!hasRole(user, "admin")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Ban className="h-16 w-16 text-red-400" />
        <h2 className="text-2xl font-bold text-[#0F2B4C]">Access Denied</h2>
        <p className="text-muted-foreground">You need admin privileges to manage material profiles.</p>
      </div>
    );
  }

  // Queries
  const { data: profiles = [], isLoading } = useQuery<MaterialProfile[]>({
    queryKey: ["/api/material-profiles"],
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      await apiRequest("POST", "/api/material-profiles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-profiles"] });
      closeDialog();
      toast({ title: "Profile Created", description: "Material profile has been created." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProfileForm }) => {
      await apiRequest("PUT", `/api/material-profiles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-profiles"] });
      closeDialog();
      toast({ title: "Profile Updated", description: "Material profile has been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/material-profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-profiles"] });
      setDeleteDialogOpen(false);
      closeDialog();
      toast({ title: "Profile Deleted", description: "Material profile has been deleted." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Handlers
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (profile: MaterialProfile) => {
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      description: profile.description ?? "",
      jobTypes: profile.jobTypes ?? [],
      permittedMaterials: profile.permittedMaterials ?? [],
      flaggedMaterials: profile.flaggedMaterials ?? [],
      active: profile.active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Validation Error", description: "Profile name is required.", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Filter
  const filtered = profiles.filter((p) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q) ?? false) ||
      p.jobTypes.some((jt) => jt.toLowerCase().includes(q))
    );
  });

  // ── Render ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0F2B4C] flex items-center gap-2">
            <Layers className="h-7 w-7 text-[#E8A54B]" />
            Material Profiles
          </h1>
          <p className="text-muted-foreground mt-1">Manage job type → expected materials mappings</p>
        </div>
        <Button onClick={openCreate} className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add Profile
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search profiles..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#0F2B4C]">No Material Profiles</h3>
            <p className="text-muted-foreground mt-1">
              {searchTerm ? "No profiles match your search." : "Create your first material profile to get started."}
            </p>
            {!searchTerm && (
              <Button onClick={openCreate} className="mt-4 bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white">
                <Plus className="h-4 w-4 mr-2" />Create Profile
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((profile) => (
            <Card
              key={profile.id}
              className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                profile.active ? "border-l-[#E8A54B]" : "border-l-gray-300 opacity-60"
              }`}
              onClick={() => openEdit(profile)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg text-[#0F2B4C]">{profile.name}</CardTitle>
                  {!profile.active && (
                    <Badge variant="outline" className="text-xs text-gray-500">Inactive</Badge>
                  )}
                </div>
                {profile.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{profile.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Job Types */}
                {profile.jobTypes.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Tag className="h-3 w-3" />Job Types
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {profile.jobTypes.map((jt) => (
                        <Badge key={jt} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          {jt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Counts */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {profile.permittedMaterials.length} permitted
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {profile.flaggedMaterials.length} flagged
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#0F2B4C]">
              {editingId ? "Edit Profile" : "Create Profile"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the material profile settings."
                : "Define a new job type → materials mapping."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Painting"
              />
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of this profile..."
                rows={2}
              />
            </div>

            {/* Job Types */}
            <div>
              <Label className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" />Job Types
              </Label>
              <p className="text-xs text-muted-foreground mb-1">Press Enter to add a job type</p>
              <TagInput
                value={form.jobTypes}
                onChange={(tags) => setForm({ ...form, jobTypes: tags })}
                placeholder="e.g. painting, plumbing..."
              />
            </div>

            {/* Permitted Materials */}
            <div>
              <Label className="flex items-center gap-1 text-green-700">
                <ShieldCheck className="h-3.5 w-3.5" />Permitted Materials
              </Label>
              <p className="text-xs text-muted-foreground mb-1">Keywords that are expected for this job type</p>
              <TagInput
                value={form.permittedMaterials}
                onChange={(tags) => setForm({ ...form, permittedMaterials: tags })}
                placeholder="e.g. emulsion, undercoat, gloss..."
                color="green"
              />
            </div>

            {/* Flagged Materials */}
            <div>
              <Label className="flex items-center gap-1 text-red-600">
                <ShieldAlert className="h-3.5 w-3.5" />Flagged Materials
              </Label>
              <p className="text-xs text-muted-foreground mb-1">Keywords that should trigger a flag for this job type</p>
              <TagInput
                value={form.flaggedMaterials}
                onChange={(tags) => setForm({ ...form, flaggedMaterials: tags })}
                placeholder="e.g. plasterboard, copper pipe..."
                color="red"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Enable this profile for receipt scanning</p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked })}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingId && (
              <Button
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 sm:mr-auto"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />Delete
              </Button>
            )}
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90 text-white"
              disabled={isSaving || !form.name.trim()}
              onClick={handleSave}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingId ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &quot;{form.name}&quot; profile. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (editingId) deleteMutation.mutate(editingId);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
