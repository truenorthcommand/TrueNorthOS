import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Settings2, 
  Link2, 
  Link2Off, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  FileText, 
  Receipt, 
  Users,
  ArrowRight,
  Loader2,
  Info,
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const NAVY_PRIMARY = "#0F2B4C";

interface XeroConfig {
  isConnected: boolean;
  tenantId?: string;
  tenantName?: string;
  lastSyncAt?: string;
  syncInvoices: boolean;
  syncContacts: boolean;
  syncPayments: boolean;
  autoSync: boolean;
}

interface SyncStatus {
  type: string;
  lastSync: string | null;
  itemsSynced: number;
  status: 'success' | 'pending' | 'error' | 'never';
}

export default function Integrations() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [xeroConfig, setXeroConfig] = useState<XeroConfig>({
    isConnected: false,
    syncInvoices: true,
    syncContacts: true,
    syncPayments: true,
    autoSync: false,
  });
  
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([
    { type: 'Invoices', lastSync: null, itemsSynced: 0, status: 'never' },
    { type: 'Contacts', lastSync: null, itemsSynced: 0, status: 'never' },
    { type: 'Payments', lastSync: null, itemsSynced: 0, status: 'never' },
  ]);

  useEffect(() => {
    fetchXeroStatus();
  }, []);

  const fetchXeroStatus = async () => {
    try {
      const res = await fetch("/api/integrations/xero/status", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setXeroConfig(data.config);
        }
        if (data.syncStatuses) {
          setSyncStatuses(data.syncStatuses);
        }
      }
    } catch (error) {
      console.error("Error fetching Xero status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectXero = async () => {
    toast({
      title: "Xero Integration",
      description: "Please provide your Xero API credentials in Settings to enable the integration.",
    });
  };

  const handleDisconnectXero = async () => {
    try {
      const res = await fetch("/api/integrations/xero/disconnect", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setXeroConfig(prev => ({ ...prev, isConnected: false, tenantId: undefined, tenantName: undefined }));
        toast({ title: "Disconnected", description: "Xero integration has been disconnected." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to disconnect Xero", variant: "destructive" });
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/integrations/xero/sync", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Sync Complete", description: data.message || "Data has been synced with Xero." });
        await fetchXeroStatus();
      } else {
        toast({ title: "Sync Failed", description: "Failed to sync with Xero. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to sync with Xero", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await fetch("/api/integrations/xero/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(xeroConfig),
      });
      if (res.ok) {
        toast({ title: "Saved", description: "Xero integration settings saved." });
      } else {
        toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Synced</Badge>;
      case 'error': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Error</Badge>;
      case 'pending': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
      default: return <Badge variant="secondary">Never synced</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY_PRIMARY }}>Integrations</h1>
          <p className="text-gray-500 mt-1">Connect TrueNorth Trade OS with external services</p>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-[#13B5EA] flex items-center justify-center">
                  <span className="text-white font-bold text-lg">X</span>
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Xero Accounting
                    {xeroConfig.isConnected ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not connected</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Sync invoices, contacts, and payments with Xero
                  </CardDescription>
                </div>
              </div>
              {xeroConfig.isConnected ? (
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleSyncNow} 
                    disabled={isSyncing}
                    style={{ backgroundColor: NAVY_PRIMARY }}
                    data-testid="button-sync-xero"
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleDisconnectXero}
                    data-testid="button-disconnect-xero"
                  >
                    <Link2Off className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={handleConnectXero}
                  style={{ backgroundColor: NAVY_PRIMARY }}
                  data-testid="button-connect-xero"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect Xero
                </Button>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {xeroConfig.isConnected && xeroConfig.tenantName && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Connected Organisation</p>
                    <p className="font-medium">{xeroConfig.tenantName}</p>
                  </div>
                  {xeroConfig.lastSyncAt && (
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Last sync</p>
                      <p className="text-sm font-medium">
                        {new Date(xeroConfig.lastSyncAt).toLocaleString('en-GB')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator />

            <div>
              <h3 className="font-medium mb-4">Sync Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Sync Invoices</p>
                      <p className="text-sm text-gray-500">Push invoices to Xero when created</p>
                    </div>
                  </div>
                  <Switch
                    checked={xeroConfig.syncInvoices}
                    onCheckedChange={(checked) => setXeroConfig(prev => ({ ...prev, syncInvoices: checked }))}
                    data-testid="switch-sync-invoices"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Sync Contacts</p>
                      <p className="text-sm text-gray-500">Keep customers in sync with Xero contacts</p>
                    </div>
                  </div>
                  <Switch
                    checked={xeroConfig.syncContacts}
                    onCheckedChange={(checked) => setXeroConfig(prev => ({ ...prev, syncContacts: checked }))}
                    data-testid="switch-sync-contacts"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Sync Payments</p>
                      <p className="text-sm text-gray-500">Record payments in Xero automatically</p>
                    </div>
                  </div>
                  <Switch
                    checked={xeroConfig.syncPayments}
                    onCheckedChange={(checked) => setXeroConfig(prev => ({ ...prev, syncPayments: checked }))}
                    data-testid="switch-sync-payments"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Auto-sync</p>
                      <p className="text-sm text-gray-500">Automatically sync data every hour</p>
                    </div>
                  </div>
                  <Switch
                    checked={xeroConfig.autoSync}
                    onCheckedChange={(checked) => setXeroConfig(prev => ({ ...prev, autoSync: checked }))}
                    data-testid="switch-auto-sync"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={handleSaveConfig} variant="outline" data-testid="button-save-xero-config">
                  Save Settings
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-4">Sync Status</h3>
              <div className="space-y-3">
                {syncStatuses.map((status, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(status.status)}
                      <div>
                        <p className="font-medium">{status.type}</p>
                        {status.lastSync ? (
                          <p className="text-xs text-gray-500">
                            Last synced: {new Date(status.lastSync).toLocaleString('en-GB')} ({status.itemsSynced} items)
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">Never synced</p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(status.status)}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              How Xero Integration Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium" style={{ color: NAVY_PRIMARY }}>What Gets Synced</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Invoices are pushed to Xero when created or updated</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Client information syncs with Xero Contacts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Payments are recorded against invoices in Xero</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>VAT is calculated and mapped to Xero tax rates</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="font-medium" style={{ color: NAVY_PRIMARY }}>Setup Requirements</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Xero Standard or above subscription required</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Must have Admin access to your Xero organisation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>OAuth2 authentication keeps your data secure</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>Connection can be revoked at any time</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              For assistance with Xero integration setup, please contact our support team or visit the Xero developer documentation.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <a href="https://developer.xero.com/documentation/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Xero Developer Docs
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
