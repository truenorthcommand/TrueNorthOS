import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ClipboardCheck, AlertTriangle, Check, X, Minus, Truck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Vehicle, WalkaroundCheckWithDetails, DefectWithDetails } from "@shared/schema";

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: vehicle, isLoading: vehicleLoading } = useQuery<Vehicle>({
    queryKey: [`/api/fleet/vehicles/${id}`],
  });

  const { data: checks = [], isLoading: checksLoading } = useQuery<WalkaroundCheckWithDetails[]>({
    queryKey: [`/api/fleet/vehicles/${id}/checks`],
  });

  const { data: defects = [], isLoading: defectsLoading } = useQuery<DefectWithDetails[]>({
    queryKey: [`/api/fleet/vehicles/${id}/defects`],
  });

  const openDefects = defects.filter(d => d.status === 'open' || d.status === 'in_progress');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500">Active</Badge>;
      case "off-road": return <Badge variant="destructive">Off Road</Badge>;
      case "maintenance": return <Badge className="bg-orange-500">Maintenance</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCheckStatusIcon = (status: string) => {
    switch (status) {
      case "pass": return <Check className="h-4 w-4 text-green-500" />;
      case "fail": return <X className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "major": return "bg-orange-500";
      case "minor": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getDefectStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge variant="destructive">Open</Badge>;
      case "in_progress": return <Badge className="bg-blue-500">In Progress</Badge>;
      case "resolved": return <Badge className="bg-green-500">Resolved</Badge>;
      case "closed": return <Badge variant="secondary">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (vehicleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="container mx-auto p-4">
        <p>Vehicle not found</p>
        <Button onClick={() => setLocation("/fleet")}>Back to Fleet</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 pb-24 md:pb-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/fleet")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{vehicle.registration}</h1>
            {getStatusBadge(vehicle.status)}
          </div>
          <p className="text-muted-foreground">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setLocation("/fleet/walkaround")} data-testid="button-start-check">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Start Check
          </Button>
          <Button variant="outline" onClick={() => setLocation("/fleet/report-defect")} data-testid="button-report-defect">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Report Defect
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Check</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-last-check">
              {checks.length > 0 
                ? format(new Date(checks[0].createdAt!), "dd/MM/yyyy")
                : "Never"
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {checks.length > 0 ? `by ${checks[0].inspector?.name}` : "No checks recorded"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Defects</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-open-defects">{openDefects.length}</div>
            <p className="text-xs text-muted-foreground">
              {openDefects.filter(d => d.severity === 'critical').length} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Checks</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-checks">{checks.length}</div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="checks" className="w-full">
        <TabsList>
          <TabsTrigger value="checks" data-testid="tab-checks">Checks History</TabsTrigger>
          <TabsTrigger value="defects" data-testid="tab-defects">Defects History</TabsTrigger>
        </TabsList>

        <TabsContent value="checks">
          <Card>
            <CardContent className="pt-6">
              {checks.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No checks recorded for this vehicle</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Inspector</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Odometer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checks.map((check) => (
                        <TableRow key={check.id} data-testid={`row-check-${check.id}`}>
                          <TableCell>
                            {check.createdAt ? format(new Date(check.createdAt), "dd/MM/yyyy HH:mm") : "-"}
                          </TableCell>
                          <TableCell className="capitalize">{check.checkType}-use</TableCell>
                          <TableCell>{check.inspector?.name || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {check.overallStatus === "pass" ? (
                                <Badge className="bg-green-500">Pass</Badge>
                              ) : (
                                <Badge variant="destructive">Fail</Badge>
                              )}
                              {!check.vehicleSafeToOperate && (
                                <Badge variant="outline" className="text-red-500 border-red-500">Unsafe</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{check.odometer ? `${check.odometer.toLocaleString()} mi` : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defects">
          <Card>
            <CardContent className="pt-6">
              {defects.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No defects recorded for this vehicle</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reported By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {defects.map((defect) => (
                        <TableRow 
                          key={defect.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setLocation(`/fleet/defects/${defect.id}`)}
                          data-testid={`row-defect-${defect.id}`}
                        >
                          <TableCell>
                            {defect.createdAt ? format(new Date(defect.createdAt), "dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell className="capitalize">{defect.category.replace(/_/g, " ")}</TableCell>
                          <TableCell>
                            <Badge className={`${getSeverityColor(defect.severity)} capitalize`}>
                              {defect.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>{getDefectStatusBadge(defect.status)}</TableCell>
                          <TableCell>{defect.reportedBy?.name || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
