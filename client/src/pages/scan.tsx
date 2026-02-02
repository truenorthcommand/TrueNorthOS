import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  QrCode,
  Briefcase,
  Users,
  Package,
  History,
  Loader2,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Scanner } from "@/components/scanner";
import {
  parseTrueNorthCode,
  getScanHistory,
  addToScanHistory,
  clearScanHistory,
  type ScanHistoryItem,
} from "@/lib/qr-utils";
import { format } from "date-fns";

interface ScanResult {
  code: string;
  type: 'truenorth' | 'jobNo' | 'notFound';
  resourceType?: 'job' | 'client' | 'asset';
  resourceId?: string;
  job?: any;
}

export default function ScanPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  useEffect(() => {
    setHistory(getScanHistory());
  }, []);

  const handleScanSuccess = async (code: string) => {
    setScanResult(null);
    setIsSearching(true);

    const updatedHistory = addToScanHistory(code);
    setHistory(updatedHistory);

    const parsed = parseTrueNorthCode(code);
    
    if (parsed) {
      setScanResult({
        code,
        type: 'truenorth',
        resourceType: parsed.type,
        resourceId: parsed.id,
      });
      setIsSearching(false);
      
      toast({
        title: "Code Recognized",
        description: `TrueNorth OS ${parsed.type} code detected`,
      });
      return;
    }

    try {
      const response = await fetch(`/api/jobs/search?q=${encodeURIComponent(code)}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const jobs = await response.json();
        const exactMatch = jobs.find((j: any) => 
          j.jobNo === code || j.jobNo?.toLowerCase() === code.toLowerCase()
        );
        
        if (exactMatch) {
          setScanResult({
            code,
            type: 'jobNo',
            resourceType: 'job',
            resourceId: exactMatch.id,
            job: exactMatch,
          });
          toast({
            title: "Job Found",
            description: `Found job ${exactMatch.jobNo}`,
          });
        } else if (jobs.length > 0) {
          setScanResult({
            code,
            type: 'jobNo',
            resourceType: 'job',
            resourceId: jobs[0].id,
            job: jobs[0],
          });
          toast({
            title: "Possible Match",
            description: `Found job ${jobs[0].jobNo}`,
          });
        } else {
          setScanResult({
            code,
            type: 'notFound',
          });
          toast({
            title: "No Match Found",
            description: "Could not find a matching record",
            variant: "destructive",
          });
        }
      } else {
        setScanResult({
          code,
          type: 'notFound',
        });
      }
    } catch (err) {
      setScanResult({
        code,
        type: 'notFound',
      });
      toast({
        title: "Search Failed",
        description: "Could not search for matching records",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleScanError = (error: string) => {
    toast({
      title: "Scan Error",
      description: error,
      variant: "destructive",
    });
  };

  const navigateToResource = () => {
    if (!scanResult) return;
    
    if (scanResult.resourceType === 'job' && scanResult.resourceId) {
      setLocation(`/jobs/${scanResult.resourceId}`);
    } else if (scanResult.resourceType === 'client' && scanResult.resourceId) {
      setLocation(`/clients?id=${scanResult.resourceId}`);
    } else if (scanResult.resourceType === 'asset' && scanResult.resourceId) {
      toast({
        title: "Asset Details",
        description: `Asset ID: ${scanResult.resourceId}`,
      });
    }
  };

  const handleClearHistory = () => {
    clearScanHistory();
    setHistory([]);
    toast({
      title: "History Cleared",
      description: "Scan history has been cleared",
    });
  };

  const handleHistoryItemClick = (item: ScanHistoryItem) => {
    if (item.parsedType && item.parsedId) {
      if (item.parsedType === 'job') {
        setLocation(`/jobs/${item.parsedId}`);
      } else if (item.parsedType === 'client') {
        setLocation(`/clients?id=${item.parsedId}`);
      }
    } else {
      handleScanSuccess(item.code);
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'job': return <Briefcase className="h-4 w-4" />;
      case 'client': return <Users className="h-4 w-4" />;
      case 'asset': return <Package className="h-4 w-4" />;
      default: return <QrCode className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type?: string) => {
    switch (type) {
      case 'job': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'client': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'asset': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      default: return '';
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="outline" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="h-6 w-6 text-primary" />
            QR/Barcode Scanner
          </h1>
          <p className="text-muted-foreground text-sm">
            Scan codes to find jobs, clients, or assets
          </p>
        </div>
      </div>

      <Scanner
        onScanSuccess={handleScanSuccess}
        onScanError={handleScanError}
        className="mb-6"
      />

      {isSearching && (
        <Card className="mb-6">
          <CardContent className="py-8 flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium">Searching...</p>
            <p className="text-xs text-muted-foreground">Looking up scanned code</p>
          </CardContent>
        </Card>
      )}

      {scanResult && !isSearching && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {scanResult.type === 'notFound' ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              Scan Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Scanned Code</p>
              <p className="font-mono text-sm break-all mt-1">{scanResult.code}</p>
            </div>

            {scanResult.type === 'truenorth' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={getTypeBadgeColor(scanResult.resourceType)}>
                    {getTypeIcon(scanResult.resourceType)}
                    <span className="ml-1 capitalize">{scanResult.resourceType}</span>
                  </Badge>
                  <span className="text-sm text-muted-foreground">ID: {scanResult.resourceId}</span>
                </div>
                <Button className="w-full" onClick={navigateToResource} data-testid="button-view-resource">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View {scanResult.resourceType === 'job' ? 'Job' : scanResult.resourceType === 'client' ? 'Customer' : 'Asset'}
                </Button>
              </div>
            )}

            {scanResult.type === 'jobNo' && scanResult.job && (
              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{scanResult.job.jobNo}</p>
                      <p className="text-sm text-muted-foreground">{scanResult.job.customerName || 'No customer'}</p>
                    </div>
                    <Badge variant="secondary">{scanResult.job.status || 'Unknown'}</Badge>
                  </div>
                  {scanResult.job.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {scanResult.job.description}
                    </p>
                  )}
                </div>
                <Button className="w-full" onClick={navigateToResource} data-testid="button-view-job">
                  <Briefcase className="mr-2 h-4 w-4" />
                  View Job Details
                </Button>
              </div>
            )}

            {scanResult.type === 'notFound' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">No matching record found</span>
                </div>
                <Separator />
                <p className="text-sm font-medium">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/jobs">
                    <Button variant="outline" className="w-full" data-testid="button-view-jobs">
                      <Briefcase className="mr-2 h-4 w-4" />
                      View Jobs
                    </Button>
                  </Link>
                  <Link href="/clients">
                    <Button variant="outline" className="w-full" data-testid="button-view-customers">
                      <Users className="mr-2 h-4 w-4" />
                      View Customers
                    </Button>
                  </Link>
                </div>
                <Button 
                  variant="secondary" 
                  className="w-full"
                  onClick={() => {
                    toast({
                      title: "Create Asset",
                      description: "Asset creation coming soon",
                    });
                  }}
                  data-testid="button-create-asset"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Asset
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Scans
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="text-muted-foreground hover:text-destructive"
                data-testid="button-clear-history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>Last 5 scanned codes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((item, index) => (
                <button
                  key={`${item.code}-${index}`}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  onClick={() => handleHistoryItemClick(item)}
                  data-testid={`history-item-${index}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getTypeIcon(item.parsedType)}
                      <span className="font-mono text-sm truncate">{item.code}</span>
                    </div>
                    {item.parsedType && (
                      <Badge variant="secondary" className="shrink-0 capitalize text-xs">
                        {item.parsedType}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(item.timestamp), 'MMM d, yyyy h:mm a')}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {history.length === 0 && !scanResult && !isSearching && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <QrCode className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No scans yet</p>
            <p className="text-xs mt-1">Start scanning to see your history</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
