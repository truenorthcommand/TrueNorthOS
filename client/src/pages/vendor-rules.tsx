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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  Plus, Trash2, Loader2, Ban, Store,
  ShieldCheck, ShieldAlert, X, Search, Gavel,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────
interface VendorRule {
  id: string;
  vendorType: string;
  displayName: string;
  permittedItems: string[];
  flaggedItems: string[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface VendorRuleForm {
  vendorType: string;
  displayName: string;
  permittedItems: string[];
  flaggedItems: string[];
  active: boolean;
}

const EMPTY_FORM: VendorRuleForm = {
  vendorType: "",
  displayName: "",
  permittedItems: [],
  flaggedItems: [],
  active: true,
};

const VENDOR_TYPES = [
  { value: "petrol_station", label: "Petrol Station" },
  { value: "builders_merchant", label: "Builders Merchant" },
  { value: "hardware_store", label: "Hardware Store" },
  { value: "cleaning_supplier", label: "Cleaning Supplier" },
  { value: "general_retailer", label: "General Retailer" },
];

function getVendorTypeLabel(type: string): string {
  return VENDOR_TYPES.find((v) => v.value === type)?.label ?? type;
}

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
export default function VendorRules() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorRuleForm>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState("");

  // Access check
  if (!hasRole(user, "admin")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Ban className="h-16 w-16 text-red-400" />
        <h2 className="text-2xl font-bold text-[#0F2B4C]">Access Denied</h2>
        <p className="text-muted-foreground">You need admin privileges to manage vendor rules.</p>
      </div>
    );
  }

  // Queries
  const { data: rules = [], isLoading } = useQuery<VendorRule[]>({
    queryKey: ["/api/vendor-rules"],
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: VendorRuleForm) => {
      await apiRequest("POST", "/api/vendor-rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-rules"] });
      closeDialog();
      toast({ title: "Rule Created", description: "Vendor rule has been created." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: VendorRuleForm }) => {
      await apiRequest("PUT", `/api/vendor-rules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-rules"] });
      closeDialog();
      toast({ title: "Rule Updated", description: "Vendor rule has been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/vendor-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-rules"] });
      setDeleteDialogOpen(false);
      closeDialog();
      toast({ title: "Rule Deleted", description: "Vendor rule has been deleted." });
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

  const openEdit = (rule: VendorRule) => {
    setEditingId(rule.id);
    setForm({
      vendorType: rule.vendorType,
      displayName: rule.displayName,
      permittedItems: rule.permittedItems ?? [],
      flaggedItems: rule.flaggedItems ?? [],
      active: rule.active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = () => {
    if (!form.vendorType) {
      toast({ title: "Validation Error", description: "Vendor type is required.", variant: "destructive" });
      return;
    }
    if (!form.displayName.trim()) {
      toast({ title: "Validation Error", description: "Display name is required.", variant: "destructive" });
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
  const filtered = rules.filter((r) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.displayName.toLowerCase().includes(q) ||
      r.vendorType.toLowerCase().includes(q) ||
      r.permittedItems.some((i) => i.toLowerCase().includes(q)) ||
      r.flaggedItems.some((i) => i.toLowerCase().includes(q))
    );
  });

  // ── Render ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
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
            <Gavel className="h-7 w-7 text-[#E8A54B]" />
            Vendor Rules
          </h1>
          <p className="text-muted-foreground mt-1">Manage vendor type → permitted/flagged items mappings</p>
        </div>
        <Button onClick={openCreate} className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search rules..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Store className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#0F2B4C]">No Vendor Rules</h3>
            <p className="text-muted-foreground mt-1">
              {searchTerm ? "No rules match your search." : "Create your first vendor rule to get started."}
            </p>
            {!searchTerm && (
              <Button onClick={openCreate} className="mt-4 bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white">
                <Plus className="h-4 w-4 mr-2" />Create Rule
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((rule) => (
            <Card
              key={rule.id}
              className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                rule.active ? "border-l-[#E8A54B]" : "border-l-gray-300 opacity-60"
              }`}
              onClick={() => openEdit(rule)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg text-[#0F2B4C]">{rule.displayName}</CardTitle>
                    <Badge variant="outline" className="mt-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {getVendorTypeLabel(rule.vendorType)}
                    </Badge>
                  </div>
                  {!rule.active && (
                    <Badge variant="outline" className="text-xs text-gray-500">Inactive</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {rule.permittedItems.length} permitted
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {rule.flaggedItems.length} flagged
                  </span>
                </div>

                {/* Preview tags */}
                {rule.permittedItems.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {rule.permittedItems.slice(0, 5).map((item) => (
                      <Badge key={item} variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                        {item}
                      </Badge>
                    ))}
                    {rule.permittedItems.length > 5 && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        +{rule.permittedItems.length - 5} more
                      </Badge>
                    )}
                  </div>
                )}
                {rule.flaggedItems.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {rule.flaggedItems.slice(0, 5).map((item) => (
                      <Badge key={item} variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                        {item}
                      </Badge>
                    ))}
                    {rule.flaggedItems.length > 5 && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        +{rule.flaggedItems.length - 5} more
                      </Badge>
                    )}
                  </div>
                )}
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
              {editingId ? "Edit Vendor Rule" : "Create Vendor Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the vendor rule settings."
                : "Define permitted and flagged items for a vendor type."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Vendor Type */}
            <div>
              <Label>Vendor Type *</Label>
              <Select
                value={form.vendorType}
                onValueChange={(v) => {
                  setForm({ ...form, vendorType: v });
                  // Auto-fill display name if empty
                  if (!form.displayName) {
                    const label = VENDOR_TYPES.find((vt) => vt.value === v)?.label ?? "";
                    setForm((prev) => ({ ...prev, vendorType: v, displayName: label }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor type..." />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_TYPES.map((vt) => (
                    <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Display Name */}
            <div>
              <Label>Display Name *</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="e.g. Petrol Station"
              />
            </div>

            {/* Permitted Items */}
            <div>
              <Label className="flex items-center gap-1 text-green-700">
                <ShieldCheck className="h-3.5 w-3.5" />Permitted Items
              </Label>
              <p className="text-xs text-muted-foreground mb-1">Keywords for items expected at this vendor type</p>
              <TagInput
                value={form.permittedItems}
                onChange={(tags) => setForm({ ...form, permittedItems: tags })}
                placeholder="e.g. diesel, adblue, screenwash..."
                color="green"
              />
            </div>

            {/* Flagged Items */}
            <div>
              <Label className="flex items-center gap-1 text-red-600">
                <ShieldAlert className="h-3.5 w-3.5" />Flagged Items
              </Label>
              <p className="text-xs text-muted-foreground mb-1">Keywords that should trigger a flag at this vendor</p>
              <TagInput
                value={form.flaggedItems}
                onChange={(tags) => setForm({ ...form, flaggedItems: tags })}
                placeholder="e.g. food, drinks, sandwich..."
                color="red"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Enable this rule for receipt scanning</p>
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
              disabled={isSaving || !form.vendorType || !form.displayName.trim()}
              onClick={handleSave}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingId ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &quot;{form.displayName}&quot; rule. This action cannot be undone.
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
