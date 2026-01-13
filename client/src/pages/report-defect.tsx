import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, AlertTriangle, Camera, Info } from "lucide-react";
import type { Vehicle } from "@shared/schema";

const CATEGORIES = [
  "tyres",
  "lights",
  "mirrors_windows",
  "brakes",
  "steering",
  "fluids",
  "leaks",
  "wipers",
  "body_damage",
  "dash_warnings",
  "doors_security",
  "engine",
  "transmission",
  "electrical",
  "hvac",
  "other",
];

export default function ReportDefect() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [vehicleId, setVehicleId] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState<"critical" | "major" | "minor">("minor");
  const [description, setDescription] = useState("");
  const [vehicleOffRoad, setVehicleOffRoad] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/fleet/vehicles"],
  });

  const createDefectMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/fleet/defects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to report defect");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet"] });
      toast({ title: "Defect reported", description: "The defect has been logged successfully" });
      setLocation("/fleet");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (!vehicleId || !category || !description) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    createDefectMutation.mutate({
      vehicleId,
      category,
      severity,
      description,
      vehicleOffRoad,
      photos: [],
    });
  };

  return (
    <div className="container mx-auto p-4 pb-24 md:pb-4 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/fleet")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Report Defect</h1>
          <p className="text-muted-foreground">Log a vehicle issue</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Defect Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle <span className="text-red-500">*</span></Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger className={attemptedSubmit && !vehicleId ? "border-red-500" : ""} data-testid="select-vehicle">
                  <SelectValue placeholder="Select a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.registration} - {v.make} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!vehicleId && <p className="text-xs text-muted-foreground">Please select the affected vehicle</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className={attemptedSubmit && !category ? "border-red-500" : ""} data-testid="select-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity <span className="text-red-500">*</span></Label>
              <RadioGroup
                value={severity}
                onValueChange={(v) => setSeverity(v as "critical" | "major" | "minor")}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="critical" id="critical" />
                  <Label htmlFor="critical" className="text-red-500 font-medium">Critical</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="major" id="major" />
                  <Label htmlFor="major" className="text-orange-500 font-medium">Major</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="minor" id="minor" />
                  <Label htmlFor="minor" className="text-yellow-600 font-medium">Minor</Label>
                </div>
              </RadioGroup>
              <div className="text-sm text-muted-foreground mt-2">
                <p><span className="text-red-500 font-medium">Critical:</span> Safety hazard, vehicle must not be used</p>
                <p><span className="text-orange-500 font-medium">Major:</span> Significant issue, needs prompt attention</p>
                <p><span className="text-yellow-600 font-medium">Minor:</span> Non-urgent, can be scheduled</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
              <Textarea
                id="description"
                placeholder="Describe the defect in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={attemptedSubmit && !description.trim() ? "border-red-500" : ""}
                data-testid="input-description"
              />
              {attemptedSubmit && !description.trim() && (
                <p className="text-xs text-red-500">Please provide a detailed description of the defect</p>
              )}
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex gap-3">
                <Camera className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Photo Evidence Recommended</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Taking photos of the defect helps maintenance teams diagnose and fix issues faster.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={vehicleOffRoad ? "border-red-500" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${vehicleOffRoad ? "text-red-500" : "text-muted-foreground"}`} />
              Vehicle Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="offroad-switch" className="text-base font-medium">Take vehicle off road?</Label>
                <p className="text-sm text-muted-foreground">
                  Mark as unavailable until repaired
                </p>
              </div>
              <Switch
                id="offroad-switch"
                checked={vehicleOffRoad}
                onCheckedChange={setVehicleOffRoad}
                data-testid="switch-off-road"
              />
            </div>
            {vehicleOffRoad && (
              <p className="mt-3 text-sm text-red-500 font-medium">
                This vehicle will be marked as OFF ROAD and unavailable for use
              </p>
            )}
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={!vehicleId || !category || !description || createDefectMutation.isPending}
          data-testid="button-submit-defect"
        >
          {createDefectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Report Defect
        </Button>
      </form>
    </div>
  );
}
