import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Save, Building, CreditCard, FileText, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CompanySettings = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  bankName: string;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  vatNumber: string;
  defaultVatRate: number;
  defaultPaymentTerms: number;
  quoteTerms: string;
  invoiceTerms: string;
};

export default function Settings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const [settings, setSettings] = useState<CompanySettings>({
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    bankName: "",
    bankAccountName: "",
    bankSortCode: "",
    bankAccountNumber: "",
    vatNumber: "",
    defaultVatRate: 20,
    defaultPaymentTerms: 30,
    quoteTerms: "",
    invoiceTerms: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/company-settings", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data && Object.keys(data).length > 0) {
          setSettings({
            companyName: data.companyName || "",
            companyAddress: data.companyAddress || "",
            companyPhone: data.companyPhone || "",
            companyEmail: data.companyEmail || "",
            bankName: data.bankName || "",
            bankAccountName: data.bankAccountName || "",
            bankSortCode: data.bankSortCode || "",
            bankAccountNumber: data.bankAccountNumber || "",
            vatNumber: data.vatNumber || "",
            defaultVatRate: data.defaultVatRate || 20,
            defaultPaymentTerms: data.defaultPaymentTerms || 30,
            quoteTerms: data.quoteTerms || "",
            invoiceTerms: data.invoiceTerms || "",
          });
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/company-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast({ title: "Success", description: "Settings saved" });
      } else {
        toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const clearCacheAndRefresh = async () => {
    setIsClearingCache(true);
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        const promise = new Promise<void>((resolve, reject) => {
          messageChannel.port1.onmessage = (event) => {
            if (event.data.success) {
              resolve();
            } else {
              reject(new Error(event.data.error || 'Failed to clear cache'));
            }
          };
        });
        navigator.serviceWorker.controller.postMessage(
          { type: 'CLEAR_ALL_CACHES' },
          [messageChannel.port2]
        );
        await promise;
      }
      
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      
      localStorage.setItem('appVersion', '');
      
      toast({ 
        title: "Cache Cleared", 
        description: "Refreshing app with fresh data..." 
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Cache clear error:', error);
      toast({ 
        title: "Cache Cleared", 
        description: "Refreshing app..." 
      });
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Configure your company details and preferences</p>
        </div>
        <Button onClick={saveSettings} disabled={isSaving} data-testid="button-save-settings">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Company Details
          </CardTitle>
          <CardDescription>This information will appear on quotes and invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Company Name</Label>
              <Input
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                placeholder="Your Company Ltd"
                data-testid="input-company-name"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Textarea
                value={settings.companyAddress}
                onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                placeholder="123 Business Street, City, Postcode"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={settings.companyPhone}
                onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                placeholder="01onal 234 567 890"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={settings.companyEmail}
                onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                placeholder="info@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>VAT Number</Label>
              <Input
                value={settings.vatNumber}
                onChange={(e) => setSettings({ ...settings, vatNumber: e.target.value })}
                placeholder="GB123456789"
              />
            </div>
            <div className="space-y-2">
              <Label>Default VAT Rate (%)</Label>
              <Input
                type="number"
                value={settings.defaultVatRate}
                onChange={(e) => setSettings({ ...settings, defaultVatRate: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Bank Details
          </CardTitle>
          <CardDescription>Payment details shown on invoices for bank transfers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={settings.bankName}
                onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                placeholder="e.g. Lloyds Bank"
                data-testid="input-bank-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                value={settings.bankAccountName}
                onChange={(e) => setSettings({ ...settings, bankAccountName: e.target.value })}
                placeholder="Your Company Ltd"
                data-testid="input-bank-account-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Sort Code</Label>
              <Input
                value={settings.bankSortCode}
                onChange={(e) => setSettings({ ...settings, bankSortCode: e.target.value })}
                placeholder="00-00-00"
                data-testid="input-bank-sort-code"
              />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input
                value={settings.bankAccountNumber}
                onChange={(e) => setSettings({ ...settings, bankAccountNumber: e.target.value })}
                placeholder="12345678"
                data-testid="input-bank-account-number"
              />
            </div>
            <div className="space-y-2">
              <Label>Default Payment Terms (days)</Label>
              <Input
                type="number"
                value={settings.defaultPaymentTerms}
                onChange={(e) => setSettings({ ...settings, defaultPaymentTerms: parseInt(e.target.value) || 30 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Default Terms
          </CardTitle>
          <CardDescription>Default text for quotes and invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Quote Terms & Conditions</Label>
            <Textarea
              value={settings.quoteTerms}
              onChange={(e) => setSettings({ ...settings, quoteTerms: e.target.value })}
              placeholder="Enter default terms and conditions for quotes..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Invoice Terms</Label>
            <Textarea
              value={settings.invoiceTerms}
              onChange={(e) => setSettings({ ...settings, invoiceTerms: e.target.value })}
              placeholder="Enter default terms for invoices..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            App Settings
          </CardTitle>
          <CardDescription>Manage app data and cache for mobile and web</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Clear Cache & Refresh</p>
              <p className="text-sm text-muted-foreground">
                Clears all cached data and reloads the app with fresh data. Use this if you're seeing outdated information.
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={clearCacheAndRefresh}
              disabled={isClearingCache}
              data-testid="button-clear-cache"
            >
              {isClearingCache ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {isClearingCache ? "Clearing..." : "Clear Cache"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
