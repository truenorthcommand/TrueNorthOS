import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardCheck, AlertTriangle, Truck, Plus, Search, Filter, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import type { DefectWithDetails, VehicleWithStats } from "@shared/schema";

export default function Fleet() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: stats } = useQuery<{
    checksCompletedToday: number;
    checksDueToday: number;
    openDefectsBySeverity: { critical: number; major: number; minor: number };
  }>({
    queryKey: ["/api/fleet/stats"],
  });

  const { data: vehicles = [] } = useQuery<VehicleWithStats[]>({
    queryKey: ["/api/fleet/vehicles"],
  });

  const { data: defects = [] } = useQuery<DefectWithDetails[]>({
    queryKey: ["/api/fleet/defects"],
  });

  const filteredDefects = defects.filter((defect) => {
    if (statusFilter !== "all" && defect.status !== statusFilter) return false;
    if (severityFilter !== "all" && defect.severity !== severityFilter) return false;
    if (vehicleFilter !== "all" && defect.vehicleId !== vehicleFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        defect.vehicle?.registration?.toLowerCase().includes(search) ||
        defect.description?.toLowerCase().includes(search) ||
        defect.category?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const totalOpenDefects = (stats?.openDefectsBySeverity.critical || 0) +
    (stats?.openDefectsBySeverity.major || 0) +
    (stats?.openDefectsBySeverity.minor || 0);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "major": return "bg-orange-500";
      case "minor": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge variant="destructive">Open</Badge>;
      case "in_progress": return <Badge className="bg-blue-500">In Progress</Badge>;
      case "resolved": return <Badge className="bg-green-500">Resolved</Badge>;
      case "closed": return <Badge variant="secondary">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 pb-24 md:pb-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fleet Maintenance</h1>
          <p className="text-muted-foreground">Manage vehicle checks and defects</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setLocation("/fleet/walkaround")} data-testid="button-start-walkaround">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Start Walkaround Check
          </Button>
          <Button variant="outline" onClick={() => setLocation("/fleet/report-defect")} data-testid="button-report-defect">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Report Defect
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checks Completed Today</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-checks-completed">{stats?.checksCompletedToday || 0}</div>
            <p className="text-xs text-muted-foreground">of {stats?.checksDueToday || 0} vehicles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Defects</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500" data-testid="text-critical-defects">{stats?.openDefectsBySeverity.critical || 0}</div>
            <p className="text-xs text-muted-foreground">requires immediate action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Major Defects</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500" data-testid="text-major-defects">{stats?.openDefectsBySeverity.major || 0}</div>
            <p className="text-xs text-muted-foreground">action required soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Open Defects</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-defects">{totalOpenDefects}</div>
            <p className="text-xs text-muted-foreground">across all vehicles</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Defects</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/fleet/vehicles")} data-testid="link-view-vehicles">
                <Truck className="h-4 w-4 mr-1" />
                View Vehicles
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search defects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-defects"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-vehicle-filter">
                  <SelectValue placeholder="Vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.registration}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-severity-filter">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDefects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No defects found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDefects.map((defect) => (
                    <TableRow key={defect.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/fleet/defects/${defect.id}`)} data-testid={`row-defect-${defect.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {defect.vehicleOffRoad && (
                            <Badge variant="destructive" className="text-xs">OFF ROAD</Badge>
                          )}
                          {defect.vehicle?.registration || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{defect.category}</TableCell>
                      <TableCell>
                        <Badge className={`${getSeverityColor(defect.severity)} capitalize`}>
                          {defect.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(defect.status)}</TableCell>
                      <TableCell>
                        {defect.createdAt ? format(new Date(defect.createdAt), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell>{defect.assignedTo?.name || "-"}</TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
