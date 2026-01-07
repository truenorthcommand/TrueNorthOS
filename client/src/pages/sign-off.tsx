import { useRef, useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Eraser, CheckCircle2, AlertTriangle, Loader2, MapPin, RefreshCw } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { useToast } from "@/hooks/use-toast";
import { reverseGeocode } from "@/components/leaflet-map";

export default function SignOff() {
  const [match, params] = useRoute("/jobs/:id/sign-off");
  const [, setLocation] = useLocation();
  const { getJob, updateJob, addSignature, signOffJob, refreshJobs } = useStore();
  const { toast } = useToast();
  
  const engSigRef = useRef<SignatureCanvas>(null);
  const custSigRef = useRef<SignatureCanvas>(null);
  
  const [engName, setEngName] = useState("");
  const [custName, setCustName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setGeoLocation] = useState<{lat: number; lng: number} | null>(null);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const jobId = params?.id;
  const job = jobId ? getJob(jobId) : undefined;

  const getLocation = async () => {
    setIsGettingLocation(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setGeoLocation(coords);
        
        try {
          const address = await reverseGeocode(coords.lat, coords.lng);
          setLocationAddress(address);
        } catch {
          setLocationAddress(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        }
        setIsGettingLocation(false);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied. Please enable location access.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information is unavailable.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out.");
            break;
          default:
            setLocationError("An unknown error occurred.");
        }
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (jobId) {
      refreshJobs();
      getLocation();
    }
  }, [jobId]);

  if (!job) return null;

  const hasPhotos = (job.photos || []).filter(p => !p.source || p.source === 'engineer').length > 0;
  const hasLocation = location !== null;
  const canSubmit = hasPhotos && hasLocation && engName && custName && !isSubmitting;

  const handleComplete = async () => {
    setIsSubmitting(true);

    try {
      const newSignatures = [...(job.signatures || [])];
      
      if (engSigRef.current && !engSigRef.current.isEmpty()) {
        newSignatures.push({
          id: `sig-${Date.now()}`,
          type: "engineer" as const,
          name: engName,
          url: engSigRef.current.toDataURL(),
          timestamp: new Date().toISOString(),
        });
      }

      if (custSigRef.current && !custSigRef.current.isEmpty()) {
        newSignatures.push({
          id: `sig-${Date.now() + 1}`,
          type: "customer" as const,
          name: custName,
          url: custSigRef.current.toDataURL(),
          timestamp: new Date().toISOString(),
        });
      }

      await updateJob(job.id, { signatures: newSignatures });
      
      await refreshJobs();
      
      const response = await fetch(`/api/jobs/${job.id}/sign-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ 
          signatures: newSignatures,
          signOffLat: location?.lat,
          signOffLng: location?.lng,
          signOffAddress: locationAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Sign-off failed");
      }

      await refreshJobs();
      
      toast({
        title: "Job Completed!",
        description: "Job has been signed off successfully.",
      });

      setLocation(`/jobs/${job.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete sign-off. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 pt-8 px-4">
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/jobs/${job.id}`}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Sign Off Job</h1>
          <p className="text-muted-foreground">{job.jobNo} - {job.customerName}</p>
        </div>
      </div>

      {!hasPhotos && (
        <Alert variant="destructive" className="mb-6" data-testid="alert-missing-photos">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing Evidence</AlertTitle>
          <AlertDescription>
            You must upload at least one photo before signing off this job.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <Card className={`border-2 ${hasLocation ? 'border-emerald-200 bg-emerald-50/50' : locationError ? 'border-amber-200 bg-amber-50/50' : 'border-blue-200 bg-blue-50/50'}`} data-testid="card-location">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <MapPin className={`h-5 w-5 ${hasLocation ? 'text-emerald-600' : locationError ? 'text-amber-600' : 'text-blue-600'}`} />
              Sign-off Location
            </CardTitle>
            <CardDescription>
              Your current location will be recorded with the sign-off
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isGettingLocation ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Getting your location...</span>
              </div>
            ) : hasLocation ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Location captured</span>
                </div>
                <p className="text-sm text-muted-foreground">{locationAddress}</p>
                <p className="text-xs text-muted-foreground">
                  Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </p>
              </div>
            ) : locationError ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">{locationError}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={getLocation}
                  data-testid="button-retry-location"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Waiting for location...</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={!hasPhotos ? "opacity-50 pointer-events-none" : ""} data-testid="card-engineer-signature">
          <CardHeader>
            <CardTitle>Engineer Sign-off</CardTitle>
            <CardDescription>
              Confirm works are complete and site is safe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Engineer Name</Label>
              <Input 
                value={engName} 
                onChange={(e) => setEngName(e.target.value)} 
                placeholder="Type your name"
                data-testid="input-engineer-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Signature</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-md bg-slate-50 h-40 relative">
                <SignatureCanvas 
                  ref={engSigRef}
                  canvasProps={{ className: "sigCanvas w-full h-full" }}
                  backgroundColor="rgba(255,255,255,0)"
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="absolute bottom-2 right-2 text-xs"
                  onClick={() => engSigRef.current?.clear()}
                  data-testid="button-clear-engineer-sig"
                >
                  <Eraser className="mr-1 h-3 w-3" /> Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={!hasPhotos ? "opacity-50 pointer-events-none" : ""} data-testid="card-customer-signature">
          <CardHeader>
            <CardTitle>Customer Acceptance</CardTitle>
            <CardDescription>
              Confirm satisfaction with the work carried out.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input 
                value={custName} 
                onChange={(e) => setCustName(e.target.value)} 
                placeholder="Customer Representative Name"
                data-testid="input-customer-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Signature</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-md bg-slate-50 h-40 relative">
                 <SignatureCanvas 
                  ref={custSigRef}
                  canvasProps={{ className: "sigCanvas w-full h-full" }}
                  backgroundColor="rgba(255,255,255,0)"
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="absolute bottom-2 right-2 text-xs"
                  onClick={() => custSigRef.current?.clear()}
                  data-testid="button-clear-customer-sig"
                >
                  <Eraser className="mr-1 h-3 w-3" /> Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button 
          size="lg" 
          className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700"
          disabled={!canSubmit}
          onClick={handleComplete}
          data-testid="button-complete-signoff"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              Completing...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-6 w-6" />
              Complete & Sign Off Job
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
