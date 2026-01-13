import { useState, useRef } from "react";
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
import { ArrowLeft, Check, X, Minus, Camera, Loader2, PenTool, Trash2 } from "lucide-react";
import type { Vehicle } from "@shared/schema";
import SignatureCanvas from "react-signature-canvas";

const CHECKLIST_ITEMS = [
  { key: "tyres", label: "Tyres", description: "Condition, pressure, tread depth" },
  { key: "lights", label: "Lights", description: "Headlights, indicators, brake lights" },
  { key: "mirrors_windows", label: "Mirrors & Windows", description: "Clean, undamaged, properly adjusted" },
  { key: "brakes", label: "Brakes", description: "Pedal feel, parking brake" },
  { key: "steering", label: "Steering", description: "Smooth operation, no play" },
  { key: "fluids", label: "Fluids", description: "Oil, coolant, washer fluid levels" },
  { key: "leaks", label: "Leaks", description: "Check for oil, fuel, or coolant leaks" },
  { key: "wipers", label: "Wipers", description: "Blades condition, washer operation" },
  { key: "body_damage", label: "Body Damage", description: "Dents, scratches, rust" },
  { key: "dash_warnings", label: "Dash Warning Lights", description: "No warning lights illuminated" },
  { key: "doors_security", label: "Doors & Load Security", description: "Locks, latches, cargo secure" },
];

type CheckStatus = "pass" | "fail" | "na";

interface CheckItemState {
  status: CheckStatus;
  note: string;
  severity?: "critical" | "major" | "minor";
  photoUrl?: string;
}

export default function WalkaroundCheck() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [vehicleId, setVehicleId] = useState("");
  const [checkType, setCheckType] = useState<"pre" | "post">("pre");
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");
  const [vehicleSafe, setVehicleSafe] = useState(true);
  const [items, setItems] = useState<Record<string, CheckItemState>>(
    Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.key, { status: "pass" as CheckStatus, note: "" }]))
  );
  const [hasSignature, setHasSignature] = useState(false);
  const signatureRef = useRef<SignatureCanvas>(null);

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/fleet/vehicles"],
  });

  const hasFailures = Object.values(items).some((item) => item.status === "fail");
  
  const failedItemsWithoutNote = Object.entries(items)
    .filter(([_, value]) => value.status === "fail" && !value.note.trim())
    .map(([key]) => key);
  
  const failedItemsWithoutSeverity = Object.entries(items)
    .filter(([_, value]) => value.status === "fail" && !value.severity)
    .map(([key]) => key);
  
  const isFormValid = vehicleId && hasSignature && 
    failedItemsWithoutNote.length === 0 && 
    failedItemsWithoutSeverity.length === 0;

  const clearSignature = () => {
    signatureRef.current?.clear();
    setHasSignature(false);
  };

  const handleSignatureEnd = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      setHasSignature(true);
    }
  };

  const createCheckMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/fleet/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save check");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet"] });
      toast({ title: "Check saved", description: "Walkaround check completed successfully" });
      setLocation("/fleet");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) {
      toast({ title: "Error", description: "Please select a vehicle", variant: "destructive" });
      return;
    }
    
    if (failedItemsWithoutSeverity.length > 0) {
      toast({ title: "Error", description: "Please select severity for all failed items", variant: "destructive" });
      return;
    }
    
    if (failedItemsWithoutNote.length > 0) {
      toast({ title: "Error", description: "Please add a note describing each failed item", variant: "destructive" });
      return;
    }
    
    if (!hasSignature) {
      toast({ title: "Error", description: "Signature is required to complete the check", variant: "destructive" });
      return;
    }

    const signatureData = signatureRef.current?.toDataURL() || null;

    const checkItems = Object.entries(items).map(([key, value]) => ({
      itemName: key,
      status: value.status,
      note: value.note || null,
      severity: value.status === "fail" ? value.severity : null,
      photoUrl: value.photoUrl || null,
    }));

    createCheckMutation.mutate({
      vehicleId,
      checkType,
      odometer: odometer ? parseInt(odometer) : null,
      notes: notes || null,
      vehicleSafeToOperate: vehicleSafe,
      items: checkItems,
      signature: signatureData,
    });
  };

  const updateItem = (key: string, updates: Partial<CheckItemState>) => {
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }));
  };

  const StatusButton = ({ item, status, icon: Icon, color }: { item: string; status: CheckStatus; icon: any; color: string }) => (
    <button
      type="button"
      onClick={() => updateItem(item, { status })}
      className={`p-3 rounded-full transition-all ${
        items[item].status === status ? `${color} text-white shadow-lg scale-110` : "bg-muted hover:bg-muted/80"
      }`}
      data-testid={`button-${item}-${status}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );

  return (
    <div className="container mx-auto p-4 pb-24 md:pb-4 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/fleet")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Daily Walkaround Check</h1>
          <p className="text-muted-foreground">Complete all checklist items</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle *</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger data-testid="select-vehicle">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check Type</Label>
                <RadioGroup value={checkType} onValueChange={(v) => setCheckType(v as "pre" | "post")} className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pre" id="pre" />
                    <Label htmlFor="pre">Pre-use</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="post" id="post" />
                    <Label htmlFor="post">Post-use</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="odometer">Odometer Reading</Label>
                <Input
                  id="odometer"
                  type="number"
                  placeholder="Current mileage"
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                  data-testid="input-odometer"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {CHECKLIST_ITEMS.map((item) => (
              <div key={item.key} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{item.label}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <StatusButton item={item.key} status="pass" icon={Check} color="bg-green-500" />
                    <StatusButton item={item.key} status="fail" icon={X} color="bg-red-500" />
                    <StatusButton item={item.key} status="na" icon={Minus} color="bg-gray-500" />
                  </div>
                </div>

                {items[item.key].status === "fail" && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-2">
                      <Label>Severity <span className="text-red-500">*</span></Label>
                      <RadioGroup
                        value={items[item.key].severity || ""}
                        onValueChange={(v) => updateItem(item.key, { severity: v as "critical" | "major" | "minor" })}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="critical" id={`${item.key}-critical`} />
                          <Label htmlFor={`${item.key}-critical`} className="text-red-500">Critical</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="major" id={`${item.key}-major`} />
                          <Label htmlFor={`${item.key}-major`} className="text-orange-500">Major</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="minor" id={`${item.key}-minor`} />
                          <Label htmlFor={`${item.key}-minor`} className="text-yellow-600">Minor</Label>
                        </div>
                      </RadioGroup>
                      {!items[item.key].severity && (
                        <p className="text-xs text-red-500">Please select a severity level</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Note <span className="text-red-500">*</span></Label>
                      <Textarea
                        placeholder="Describe the issue..."
                        value={items[item.key].note}
                        onChange={(e) => updateItem(item.key, { note: e.target.value })}
                        className={!items[item.key].note.trim() ? "border-red-300" : ""}
                        data-testid={`input-${item.key}-note`}
                      />
                      {!items[item.key].note.trim() && (
                        <p className="text-xs text-red-500">A note is required for failed items</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {hasFailures && (
          <Card className="border-orange-500">
            <CardHeader>
              <CardTitle className="text-orange-500">Vehicle Safety</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="safe-switch" className="text-base font-medium">Is the vehicle safe to operate?</Label>
                  <p className="text-sm text-muted-foreground">
                    Consider if the defects affect safe operation
                  </p>
                </div>
                <Switch
                  id="safe-switch"
                  checked={vehicleSafe}
                  onCheckedChange={setVehicleSafe}
                  data-testid="switch-vehicle-safe"
                />
              </div>
              {!vehicleSafe && (
                <p className="mt-3 text-sm text-red-500 font-medium">
                  Vehicle will be marked as OFF ROAD
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any additional observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              data-testid="input-notes"
            />
          </CardContent>
        </Card>

        <Card className={!hasSignature ? "border-orange-300" : "border-green-500"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Signature <span className="text-red-500">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign below to confirm this walkaround check is accurate and complete
            </p>
            <div className="border rounded-lg bg-white">
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: "w-full h-32 rounded-lg",
                  style: { width: "100%", height: "128px" }
                }}
                onEnd={handleSignatureEnd}
                data-testid="signature-canvas"
              />
            </div>
            <div className="flex justify-between items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSignature}
                data-testid="button-clear-signature"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
              {hasSignature ? (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="h-4 w-4" /> Signed
                </span>
              ) : (
                <span className="text-sm text-orange-500">Signature required</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={!isFormValid || createCheckMutation.isPending}
          data-testid="button-submit-check"
        >
          {createCheckMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Complete Check
        </Button>
      </form>
    </div>
  );
}
