import { useRef, useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Eraser, CheckCircle2, AlertTriangle, MapPin, Loader2 } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { useToast } from "@/hooks/use-toast";

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
  
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [location, setLocationData] = useState<{lat: number; lng: number; address: string} | null>(null);

  const jobId = params?.id;
  const job = jobId ? getJob(jobId) : undefined;

  useEffect(() => {
    if (jobId) {
      refreshJobs();
    }
  }, [jobId]);

  const captureLocation = async () => {
    setGpsStatus('loading');
    
    if (!navigator.geolocation) {
      setGpsStatus('error');
      toast({
        title: "GPS Not Available",
        description: "Geolocation is not supported by your browser.",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.display_name) {
              address = data.display_name;
            }
          }
        } catch (e) {
          console.log("Geocoding failed, using coordinates");
        }

        setLocationData({ lat: latitude, lng: longitude, address });
        setGpsStatus('success');
        toast({
          title: "Location Captured",
          description: `Accuracy: ${accuracy?.toFixed(0)}m`,
        });
      },
      (error) => {
        setGpsStatus('error');
        toast({
          title: "Location Error",
          description: error.message || "Failed to get your location.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (!job) return null;

  const hasPhotos = (job.photos || []).length > 0;
  const hasEngineerSig = !!(engSigRef.current && !engSigRef.current.isEmpty() && engName);
  const hasCustomerSig = !!(custSigRef.current && !custSigRef.current.isEmpty() && custName);
  const canSubmit = hasPhotos && engName && custName && location && !isSubmitting;

  const handleComplete = async () => {
    if (!location) {
      toast({
        title: "Location Required",
        description: "Please capture your GPS location before signing off.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (engSigRef.current && !engSigRef.current.isEmpty()) {
        await addSignature(job.id, {
          type: "engineer",
          name: engName,
          url: engSigRef.current.toDataURL(),
        });
      }

      if (custSigRef.current && !custSigRef.current.isEmpty()) {
        await addSignature(job.id, {
          type: "customer",
          name: custName,
          url: custSigRef.current.toDataURL(),
        });
      }

      await signOffJob(job.id, location.lat, location.lng, location.address);
      
      toast({
        title: "Job Completed!",
        description: "Job has been signed off with GPS location.",
      });

      setLocation(`/jobs/${job.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete sign-off. Please try again.",
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
        <Card data-testid="card-location">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              GPS Location
            </CardTitle>
            <CardDescription>
              Capture your current location to verify sign-off location.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {location ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800 mb-1">Location Captured</p>
                <p className="text-xs text-green-600 break-words">{location.address}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </p>
              </div>
            ) : (
              <Button 
                onClick={captureLocation} 
                disabled={gpsStatus === 'loading'}
                className="w-full h-12"
                variant={gpsStatus === 'error' ? 'destructive' : 'default'}
                data-testid="button-capture-location"
              >
                {gpsStatus === 'loading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Location...
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Capture GPS Location
                  </>
                )}
              </Button>
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

        {!location && (
          <p className="text-center text-sm text-muted-foreground">
            GPS location capture is required before sign-off
          </p>
        )}
      </div>
    </div>
  );
}
