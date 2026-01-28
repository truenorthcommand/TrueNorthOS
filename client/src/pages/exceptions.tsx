import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Eye,
  ExternalLink,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

interface Exception {
  id: string;
  type: string;
  severity: string;
  title: string;
  message?: string;
  context: Record<string, any>;
  entityType?: string;
  entityId?: string;
  stackTrace?: string;
  status: string;
  resolvedById?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ExceptionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data: exceptions, isLoading, refetch } = useQuery<Exception[]>({
    queryKey: ["/api/exceptions", { status: statusFilter, type: typeFilter, severity: severityFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (typeFilter) params.append("type", typeFilter);
      if (severityFilter) params.append("severity", severityFilter);
      const response = await fetch(`/api/exceptions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch exceptions");
      return response.json();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return apiRequest("POST", `/api/exceptions/${id}/resolve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exceptions"] });
      toast({ title: "Exception resolved" });
      setSelectedExceptionId(null);
      setResolutionNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to resolve", description: error.message, variant: "destructive" });
    },
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "error":
        return "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300";
      case "warning":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "acknowledged":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "ignored":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getEntityLink = (entityType?: string, entityId?: string) => {
    if (!entityType || !entityId) return null;
    switch (entityType) {
      case "job":
        return `/jobs/${entityId}`;
      case "invoice":
        return `/invoices/${entityId}`;
      case "quote":
        return `/quotes/${entityId}`;
      case "form":
        return `/forms/submissions?id=${entityId}`;
      default:
        return null;
    }
  };

  const selectedException = exceptions?.find(e => e.id === selectedExceptionId);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Exceptions
          </h1>
          <p className="text-muted-foreground">
            Monitor and resolve system exceptions and errors
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="ignored">Ignored</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger data-testid="select-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="workflow_failed">Workflow Failed</SelectItem>
                  <SelectItem value="webhook_failed">Webhook Failed</SelectItem>
                  <SelectItem value="ai_failed">AI Failed</SelectItem>
                  <SelectItem value="job_blocked">Job Blocked</SelectItem>
                  <SelectItem value="validation_error">Validation Error</SelectItem>
                  <SelectItem value="job_failed">Job Queue Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger data-testid="select-severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card data-testid="stat-open">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {exceptions?.filter(e => e.status === "open").length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-acknowledged">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">
              {exceptions?.filter(e => e.status === "acknowledged").length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Acknowledged</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-resolved">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {exceptions?.filter(e => e.status === "resolved").length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-critical">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-700">
              {exceptions?.filter(e => e.severity === "critical" && e.status === "open").length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Critical Open</p>
          </CardContent>
        </Card>
      </div>

      {(!exceptions || exceptions.length === 0) ? (
        <Card data-testid="card-no-exceptions">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No exceptions found</h3>
            <p className="text-muted-foreground">
              All systems are running smoothly. Check back later or adjust your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {exceptions.map((exception) => {
            const entityLink = getEntityLink(exception.entityType, exception.entityId);
            return (
              <Card 
                key={exception.id}
                className={`hover:shadow-md transition-shadow ${exception.severity === 'critical' ? 'border-red-500' : ''}`}
                data-testid={`card-exception-${exception.id}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      {getSeverityIcon(exception.severity)}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{exception.title}</h3>
                          <Badge className={getSeverityColor(exception.severity)}>
                            {exception.severity}
                          </Badge>
                          <Badge className={getStatusColor(exception.status)}>
                            {exception.status}
                          </Badge>
                          <Badge variant="outline">{exception.type}</Badge>
                        </div>
                        {exception.message && (
                          <p className="text-sm text-muted-foreground mb-2">{exception.message}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(exception.createdAt), "dd MMM yyyy HH:mm")}
                          </span>
                          {exception.entityType && exception.entityId && (
                            <span>
                              {exception.entityType}: {exception.entityId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {entityLink && (
                        <Link href={entityLink}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-entity-${exception.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedExceptionId(exception.id)}
                        data-testid={`button-view-${exception.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {exception.status === "open" && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedExceptionId(exception.id)}
                          data-testid={`button-resolve-${exception.id}`}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedExceptionId} onOpenChange={(open) => !open && setSelectedExceptionId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedException && getSeverityIcon(selectedException.severity)}
              {selectedException?.title}
            </DialogTitle>
            <DialogDescription>
              Exception details and resolution
            </DialogDescription>
          </DialogHeader>
          
          {selectedException && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="outline" className="ml-2">{selectedException.type}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Severity:</span>
                  <Badge className={`ml-2 ${getSeverityColor(selectedException.severity)}`}>
                    {selectedException.severity}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className={`ml-2 ${getStatusColor(selectedException.status)}`}>
                    {selectedException.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <span className="ml-2">{format(new Date(selectedException.createdAt), "dd MMM yyyy HH:mm:ss")}</span>
                </div>
              </div>

              {selectedException.message && (
                <div>
                  <h4 className="font-medium mb-1">Message</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    {selectedException.message}
                  </p>
                </div>
              )}

              {selectedException.context && Object.keys(selectedException.context).length > 0 && (
                <div>
                  <h4 className="font-medium mb-1">Context</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                    {JSON.stringify(selectedException.context, null, 2)}
                  </pre>
                </div>
              )}

              {selectedException.stackTrace && (
                <div>
                  <h4 className="font-medium mb-1">Stack Trace</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-48 overflow-y-auto">
                    {selectedException.stackTrace}
                  </pre>
                </div>
              )}

              {selectedException.status === "open" && (
                <div>
                  <h4 className="font-medium mb-2">Resolution Notes (Optional)</h4>
                  <Textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Enter any notes about how this was resolved..."
                    data-testid="input-resolution-notes"
                  />
                </div>
              )}

              {selectedException.status === "resolved" && selectedException.resolutionNotes && (
                <div>
                  <h4 className="font-medium mb-1">Resolution Notes</h4>
                  <p className="text-sm text-muted-foreground bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                    {selectedException.resolutionNotes}
                  </p>
                  {selectedException.resolvedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Resolved at {format(new Date(selectedException.resolvedAt), "dd MMM yyyy HH:mm")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedExceptionId(null)}>
              Close
            </Button>
            {selectedException?.status === "open" && (
              <Button 
                onClick={() => resolveMutation.mutate({ 
                  id: selectedException.id, 
                  notes: resolutionNotes 
                })}
                disabled={resolveMutation.isPending}
                data-testid="button-confirm-resolve"
              >
                {resolveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Mark as Resolved
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
