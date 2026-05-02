import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, DollarSign, Handshake } from "lucide-react";

interface Merchant {
  id: string;
  name: string;
  slug: string;
  email: string;
  commission_rate: number;
  payout_method: string;
  active: boolean;
  created_at: string;
}

interface MerchantEarnings {
  total: number;
  paid: number;
  unpaid: number;
}

const emptyForm = {
  name: "",
  slug: "",
  email: "",
  password: "",
  commission_rate: "5",
  payout_method: "bank",
  active: true,
};

export default function AdminMerchants() {
  const { toast } = useToast();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [earningsDialog, setEarningsDialog] = useState<{ merchant: Merchant; earnings: MerchantEarnings } | null>(null);

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    try {
      const res = await fetch("/api/admin/merchants", { credentials: "include" });
      if (res.ok) setMerchants(await res.json());
    } catch (error) {
      console.error("Failed to fetch merchants:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setFormData({
      name: merchant.name,
      slug: merchant.slug,
      email: merchant.email,
      password: "",
      commission_rate: String(merchant.commission_rate),
      payout_method: merchant.payout_method,
      active: merchant.active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingMerchant(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        slug: formData.slug,
        email: formData.email,
        commission_rate: parseFloat(formData.commission_rate),
        payout_method: formData.payout_method,
        active: formData.active,
      };
      if (formData.password) payload.password = formData.password;

      if (editingMerchant) {
        const res = await fetch(`/api/admin/merchants/${editingMerchant.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast({ title: "Updated", description: "Merchant partner updated successfully." });
          resetForm();
          fetchMerchants();
        } else {
          const err = await res.json();
          toast({ title: "Error", description: err.error || "Failed to update", variant: "destructive" });
        }
      } else {
        if (!formData.password) {
          toast({ title: "Error", description: "Password is required for new merchants.", variant: "destructive" });
          setSaving(false);
          return;
        }
        const res = await fetch("/api/admin/merchants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast({ title: "Created", description: "Merchant partner created successfully." });
          resetForm();
          fetchMerchants();
        } else {
          const err = await res.json();
          toast({ title: "Error", description: err.error || "Failed to create", variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const viewEarnings = async (merchant: Merchant) => {
    try {
      const res = await fetch(`/api/admin/merchants/${merchant.id}/earnings`, { credentials: "include" });
      if (res.ok) {
        const earnings = await res.json();
        setEarningsDialog({ merchant, earnings });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load earnings.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="merchants-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="admin-merchants-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-page-title">Merchant Partners</h2>
          <p className="text-muted-foreground mt-1">
            Manage merchant partners who refer customers to Adapt Services Group
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-merchant">
              <Plus className="h-4 w-4 mr-2" />
              Add Merchant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" data-testid="dialog-merchant-form">
            <DialogHeader>
              <DialogTitle>{editingMerchant ? "Edit Merchant Partner" : "Create Merchant Partner"}</DialogTitle>
              <DialogDescription>
                {editingMerchant ? "Update merchant details" : "Add a new merchant partner to the referral programme"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Business Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    required
                    data-testid="input-merchant-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                    placeholder="company-name"
                    required
                    data-testid="input-merchant-slug"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                    required
                    data-testid="input-merchant-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {editingMerchant ? "New Password (leave blank to keep)" : "Password"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                    required={!editingMerchant}
                    data-testid="input-merchant-password"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="commission">Commission Rate (%)</Label>
                  <Input
                    id="commission"
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData((f) => ({ ...f, commission_rate: e.target.value }))}
                    data-testid="input-merchant-commission"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payout">Payout Method</Label>
                  <Select
                    value={formData.payout_method}
                    onValueChange={(v) => setFormData((f) => ({ ...f, payout_method: v }))}
                  >
                    <SelectTrigger data-testid="select-merchant-payout">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="credit">Account Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(v) => setFormData((f) => ({ ...f, active: v }))}
                  data-testid="switch-merchant-active"
                />
                <Label>Active</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={saving} data-testid="button-save-merchant">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingMerchant ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {merchants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Handshake className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Merchant Partners Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create merchant partners who can refer customers and earn commission.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-merchant-empty">
              <Plus className="h-4 w-4 mr-2" /> Add First Merchant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {merchants.map((m) => (
            <Card key={m.id} data-testid={`card-merchant-${m.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${m.active ? 'bg-green-500' : 'bg-gray-400'}`}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold" data-testid={`text-merchant-name-${m.id}`}>{m.name}</h3>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {m.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">Commission: <strong>{m.commission_rate}%</strong></p>
                      <p className="text-muted-foreground">Slug: <code>/partners/{m.slug}</code></p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => viewEarnings(m)} data-testid={`button-earnings-${m.id}`}>
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(m)} data-testid={`button-edit-${m.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Earnings Dialog */}
      <Dialog open={!!earningsDialog} onOpenChange={() => setEarningsDialog(null)}>
        <DialogContent data-testid="dialog-merchant-earnings">
          <DialogHeader>
            <DialogTitle>{earningsDialog?.merchant.name} — Earnings</DialogTitle>
          </DialogHeader>
          {earningsDialog && (
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold" data-testid="text-earnings-total">
                  £{earningsDialog.earnings.total.toFixed(2)}
                </p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Paid Out</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-earnings-paid">
                  £{earningsDialog.earnings.paid.toFixed(2)}
                </p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Unpaid</p>
                <p className="text-2xl font-bold text-amber-600" data-testid="text-earnings-unpaid">
                  £{earningsDialog.earnings.unpaid.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
