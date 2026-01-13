import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Truck, ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import type { VehicleWithStats } from "@shared/schema";

export default function FleetVehicles() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [registration, setRegistration] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("Van");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const { data: vehicles = [], isLoading } = useQuery<VehicleWithStats[]>({
    queryKey: ["/api/fleet/vehicles"],
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/fleet/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create vehicle");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/vehicles"] });
      toast({ title: "Vehicle added", description: "New vehicle has been added to the fleet" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setRegistration("");
    setMake("");
    setModel("");
    setYear("");
    setType("Van");
    setAttemptedSubmit(false);
  };

  const isVehicleFormValid = registration.trim() && make.trim() && model.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (!registration.trim()) {
      toast({ title: "Error", description: "Registration is required", variant: "destructive" });
      return;
    }
    if (!make.trim()) {
      toast({ title: "Error", description: "Make is required", variant: "destructive" });
      return;
    }
    if (!model.trim()) {
      toast({ title: "Error", description: "Model is required", variant: "destructive" });
      return;
    }
    createVehicleMutation.mutate({
      registration: registration.toUpperCase(),
      make,
      model,
      year: year ? parseInt(year) : null,
      type,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500">Active</Badge>;
      case "off-road": return <Badge variant="destructive">Off Road</Badge>;
      case "maintenance": return <Badge className="bg-orange-500">Maintenance</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 pb-24 md:pb-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/fleet")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Fleet Vehicles</h1>
          <p className="text-muted-foreground">Manage your vehicle fleet</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-vehicle">
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Vehicle</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="registration">Registration <span className="text-red-500">*</span></Label>
                  <Input
                    id="registration"
                    placeholder="e.g. AB12 CDE"
                    value={registration}
                    onChange={(e) => setRegistration(e.target.value)}
                    className={`uppercase ${attemptedSubmit && !registration.trim() ? 'border-red-500' : ''}`}
                    data-testid="input-registration"
                  />
                  {attemptedSubmit && !registration.trim() && (
                    <p className="text-xs text-red-500">Registration is required</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="make">Make <span className="text-red-500">*</span></Label>
                    <Input
                      id="make"
                      placeholder="e.g. Ford"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      className={attemptedSubmit && !make.trim() ? 'border-red-500' : ''}
                      data-testid="input-make"
                    />
                    {attemptedSubmit && !make.trim() && (
                      <p className="text-xs text-red-500">Make is required</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model <span className="text-red-500">*</span></Label>
                    <Input
                      id="model"
                      placeholder="e.g. Transit"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className={attemptedSubmit && !model.trim() ? 'border-red-500' : ''}
                      data-testid="input-model"
                    />
                    {attemptedSubmit && !model.trim() && (
                      <p className="text-xs text-red-500">Model is required</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year">Year <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input
                      id="year"
                      type="number"
                      placeholder="e.g. 2023"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      data-testid="input-year"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type <span className="text-red-500">*</span></Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger data-testid="select-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Van">Van</SelectItem>
                        <SelectItem value="Truck">Truck</SelectItem>
                        <SelectItem value="Car">Car</SelectItem>
                        <SelectItem value="Pickup">Pickup</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground"><span className="text-red-500">*</span> Required fields</p>
                <Button type="submit" className="w-full" disabled={!isVehicleFormValid || createVehicleMutation.isPending} data-testid="button-submit-vehicle">
                  {createVehicleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Vehicle
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No vehicles in fleet</p>
              {isAdmin && (
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Vehicle
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registration</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Check</TableHead>
                    <TableHead>Open Defects</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle) => (
                    <TableRow 
                      key={vehicle.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setLocation(`/fleet/vehicles/${vehicle.id}`)}
                      data-testid={`row-vehicle-${vehicle.id}`}
                    >
                      <TableCell className="font-medium">{vehicle.registration}</TableCell>
                      <TableCell>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </TableCell>
                      <TableCell>{vehicle.type || "-"}</TableCell>
                      <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                      <TableCell>
                        {vehicle.lastCheckDate 
                          ? format(new Date(vehicle.lastCheckDate), "dd/MM/yyyy")
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        {vehicle.openDefectsCount > 0 ? (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            <span className="text-orange-500 font-medium">{vehicle.openDefectsCount}</span>
                          </div>
                        ) : (
                          <span className="text-green-500">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
