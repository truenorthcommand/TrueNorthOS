import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Building, CreditCard, FileText, Loader2, RefreshCw, Smartphone, Database, Send, AlertTriangle, CheckCircle, Info, Zap, Plus, Trash2, Bell, Briefcase, MessageCircle, Receipt, Truck, Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

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

interface DatabaseTable {
  name: string;
  rowCount: number;
  schema: { column: string; type: string; nullable: boolean }[];
}

interface HealthIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: any;
}

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  
  const [dbStats, setDbStats] = useState<DatabaseTable[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [dbQuestion, setDbQuestion] = useState("");
  const [dbAnswer, setDbAnswer] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [healthIssues, setHealthIssues] = useState<HealthIssue[]>([]);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const [quickRules, setQuickRules] = useState<any[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [ruleCondition, setRuleCondition] = useState("");
  const [ruleAction, setRuleAction] = useState("");
  const [ruleName, setRuleName] = useState("");

  const [notifPrefs, setNotifPrefs] = useState<Record<string, { inApp: boolean; email: boolean; push: boolean }>>({
    jobs: { inApp: true, email: true, push: false },
    messages: { inApp: true, email: false, push: false },
    expenses: { inApp: true, email: true, push: false },
    fleet: { inApp: true, email: false, push: false },
    system: { inApp: true, email: true, push: false },
  });
  const [isLoadingNotifPrefs, setIsLoadingNotifPrefs] = useState(false);
  const [isSavingNotifPrefs, setIsSavingNotifPrefs] = useState(false);

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
    fetchNotifPrefs();
  }, []);

  const fetchNotifPrefs = async () => {
    setIsLoadingNotifPrefs(true);
    try {
      const res = await fetch("/api/notification-preferences", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data && Object.keys(data).length > 0) {
          setNotifPrefs(data);
        }
      }
    } catch (error) {
      console.error("Failed to load notification preferences");
    } finally {
      setIsLoadingNotifPrefs(false);
    }
  };

  const saveNotifPrefs = async () => {
    setIsSavingNotifPrefs(true);
    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(notifPrefs),
      });
      if (res.ok) {
        toast({ title: "Saved", description: "Notification preferences updated" });
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save notification preferences", variant: "destructive" });
    } finally {
      setIsSavingNotifPrefs(false);
    }
  };

  const toggleNotifPref = (category: string, channel: "inApp" | "email" | "push") => {
    setNotifPrefs(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [channel]: !prev[category]?.[channel],
      },
    }));
  };

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

  const loadDbStats = async () => {
    setIsLoadingStats(true);
    try {
      const res = await fetch('/api/admin/database-stats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDbStats(data.tables || []);
      } else {
        toast({ title: "Error", description: "Failed to load database stats", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load database stats", variant: "destructive" });
    } finally {
      setIsLoadingStats(false);
    }
  };

  const analyzeDatabase = async () => {
    if (!dbQuestion.trim()) return;
    setIsAnalyzing(true);
    setDbAnswer("");
    try {
      const res = await fetch('/api/admin/database-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: dbQuestion }),
      });
      if (res.ok) {
        const data = await res.json();
        setDbAnswer(data.answer || "No response");
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to analyze", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to analyze database", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const checkDbHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch('/api/admin/database-health', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setHealthIssues(data.issues || []);
        if (data.issues.length === 0) {
          toast({ title: "Health Check Complete", description: "No issues found!" });
        }
      } else {
        toast({ title: "Error", description: "Failed to check database health", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to check database health", variant: "destructive" });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const fetchQuickRules = async () => {
    setIsLoadingRules(true);
    try {
      const res = await fetch("/api/workflows/rules", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setQuickRules(data || []);
      }
    } catch (error) {
      // silently fail
    } finally {
      setIsLoadingRules(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin" || user?.superAdmin) {
      fetchQuickRules();
    }
  }, [user]);

  const conditionMap: Record<string, { type: string; operator: string; value: string; label: string }> = {
    job_stalled: { type: "time_elapsed", operator: "greater_than", value: "24", label: "Job stalled for 24+ hours" },
    field_missing: { type: "field_missing", operator: "equals", value: "assignedToId", label: "Required field missing" },
    priority_high: { type: "priority", operator: "equals", value: "urgent", label: "High priority job created" },
  };

  const actionMap: Record<string, { type: string; config: any; label: string }> = {
    escalate: { type: "EscalateJob", config: { reason: "Auto-escalated by automation rule" }, label: "Escalate to manager" },
    notify: { type: "SendNotification", config: { message: "Automation alert triggered" }, label: "Send notification" },
    block: { type: "BlockCompletion", config: { reason: "Blocked by automation rule" }, label: "Block completion" },
  };

  const saveQuickRule = async () => {
    if (!ruleCondition || !ruleAction) {
      toast({ title: "Missing Fields", description: "Please select both a condition and an action.", variant: "destructive" });
      return;
    }

    const cond = conditionMap[ruleCondition];
    const act = actionMap[ruleAction];
    const name = ruleName.trim() || `${cond.label} → ${act.label}`;

    setIsSavingRule(true);
    try {
      const res = await fetch("/api/workflows/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          description: `Quick rule: ${cond.label} → ${act.label}`,
          triggerType: ruleCondition === "priority_high" ? "job_created" : "job_status_changed",
          conditions: [{ type: cond.type, operator: cond.operator, value: cond.value }],
          actions: [{ type: act.type, config: act.config }],
          isActive: true,
          priority: 10,
        }),
      });

      if (res.ok) {
        toast({ title: "Rule Created", description: `"${name}" has been saved.` });
        setRuleCondition("");
        setRuleAction("");
        setRuleName("");
        fetchQuickRules();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Error", description: err.error || "Failed to save rule", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save rule", variant: "destructive" });
    } finally {
      setIsSavingRule(false);
    }
  };

  const deleteQuickRule = async (ruleId: string) => {
    if (!confirm("Delete this automation rule?")) return;
    try {
      const res = await fetch(`/api/workflows/rules/${ruleId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: "Rule Deleted" });
        fetchQuickRules();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete rule", variant: "destructive" });
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
            <Bell className="w-5 h-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Control how you receive notifications for each category</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingNotifPrefs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center text-sm font-medium text-muted-foreground border-b pb-2">
                <span>Category</span>
                <span className="text-center">In-App</span>
                <span className="text-center">Email</span>
                <span className="text-center">Push</span>
              </div>
              {[
                { key: "jobs", label: "Jobs & Operations", icon: Briefcase },
                { key: "messages", label: "Messages", icon: MessageCircle },
                { key: "expenses", label: "Expenses & Finance", icon: Receipt },
                { key: "fleet", label: "Fleet & Vehicles", icon: Truck },
                { key: "system", label: "System & Admin", icon: Settings2 },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center py-2" data-testid={`notif-pref-row-${key}`}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{label}</span>
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={notifPrefs[key]?.inApp ?? true}
                      onCheckedChange={() => toggleNotifPref(key, "inApp")}
                      data-testid={`switch-notif-${key}-inapp`}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={notifPrefs[key]?.email ?? false}
                      onCheckedChange={() => toggleNotifPref(key, "email")}
                      data-testid={`switch-notif-${key}-email`}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={notifPrefs[key]?.push ?? false}
                      onCheckedChange={() => toggleNotifPref(key, "push")}
                      data-testid={`switch-notif-${key}-push`}
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button onClick={saveNotifPrefs} disabled={isSavingNotifPrefs} data-testid="button-save-notif-prefs">
                  {isSavingNotifPrefs ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Preferences
                </Button>
              </div>
            </>
          )}
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

      {(user?.role === "admin" || user?.superAdmin) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Automation Rules
              </CardTitle>
              <Badge variant="secondary" data-testid="badge-ops-pro">Ops Pro Feature</Badge>
            </div>
            <CardDescription>Set up quick automation rules to handle common scenarios</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rule Name (optional)</Label>
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Escalate stalled jobs"
                  data-testid="input-quick-rule-name"
                />
              </div>

              <div className="space-y-2">
                <Label>When...</Label>
                <Select value={ruleCondition} onValueChange={setRuleCondition}>
                  <SelectTrigger data-testid="select-rule-condition">
                    <SelectValue placeholder="Select a trigger condition..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job_stalled">Job stalled for 24+ hours</SelectItem>
                    <SelectItem value="field_missing">Required field missing</SelectItem>
                    <SelectItem value="priority_high">High priority job created</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Then...</Label>
                <Select value={ruleAction} onValueChange={setRuleAction}>
                  <SelectTrigger data-testid="select-rule-action">
                    <SelectValue placeholder="Select an action..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="escalate">Escalate to manager</SelectItem>
                    <SelectItem value="notify">Send notification</SelectItem>
                    <SelectItem value="block">Block completion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={saveQuickRule}
                disabled={isSavingRule || !ruleCondition || !ruleAction}
                className="w-full"
                data-testid="button-save-quick-rule"
              >
                {isSavingRule ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Save Rule
              </Button>

              {quickRules.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Active Rules ({quickRules.length})</Label>
                    {quickRules.map((rule: any) => (
                      <div key={rule.id} className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid={`rule-item-${rule.id}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{rule.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{rule.description}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge variant={rule.isActive ? "default" : "outline"} className="text-xs">
                            {rule.isActive ? "Active" : "Disabled"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteQuickRule(rule.id)}
                            data-testid={`button-delete-rule-${rule.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {user?.superAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              AI Database Analyst
            </CardTitle>
            <CardDescription>Ask questions about your database and get AI-powered insights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={loadDbStats}
                disabled={isLoadingStats}
                data-testid="button-load-db-stats"
              >
                {isLoadingStats ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                View Database Stats
              </Button>
              <Button 
                variant="outline" 
                onClick={checkDbHealth}
                disabled={isCheckingHealth}
                data-testid="button-check-db-health"
              >
                {isCheckingHealth ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Run Health Check
              </Button>
            </div>

            {dbStats.length > 0 && (
              <div className="bg-muted p-4 rounded-lg max-h-48 overflow-y-auto">
                <p className="font-medium mb-2">Database Tables ({dbStats.length})</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {dbStats.map((table) => (
                    <div key={table.name} className="flex justify-between">
                      <span className="text-muted-foreground">{table.name}</span>
                      <span className="font-mono">{table.rowCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {healthIssues.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium">Health Check Results</p>
                {healthIssues.map((issue, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-start gap-2 p-3 rounded-lg ${
                      issue.severity === 'error' ? 'bg-red-50 text-red-800' :
                      issue.severity === 'warning' ? 'bg-yellow-50 text-yellow-800' :
                      'bg-blue-50 text-blue-800'
                    }`}
                  >
                    {issue.severity === 'error' ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
                     issue.severity === 'warning' ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
                     <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    <span className="text-sm">{issue.message}</span>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label>Ask a Question</Label>
              <div className="flex gap-2">
                <Textarea
                  value={dbQuestion}
                  onChange={(e) => setDbQuestion(e.target.value)}
                  placeholder="E.g., Show me clients with no jobs, find duplicate records, what data issues exist?"
                  rows={2}
                  className="flex-1"
                  data-testid="input-db-question"
                />
                <Button 
                  onClick={analyzeDatabase}
                  disabled={isAnalyzing || !dbQuestion.trim()}
                  data-testid="button-analyze-db"
                >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {dbAnswer && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium mb-2">AI Analysis</p>
                <div className="text-sm whitespace-pre-wrap">{dbAnswer}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
