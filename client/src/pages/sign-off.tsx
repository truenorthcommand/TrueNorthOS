import { useRef, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Eraser, CheckCircle2, AlertTriangle } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { useToast } from "@/hooks/use-toast";

export default function SignOff() {
  const [match, params] = useRoute("/jobs/:id/sign-off");
  const [, setLocation] = useLocation();
  const { getJob, updateJob, addSignature } = useStore();
  const { toast } = useToast();
  
  const engSigRef = useRef<SignatureCanvas>(null);
  const custSigRef = useRef<SignatureCanvas>(null);
  
  const [engName, setEngName] = useState("");
  const [custName, setCustName] = useState("");
  const [step, setStep] = useState(1); // 1 = Review, 2 = Engineer, 3 = Customer

  const jobId = params?.id;
  const job = jobId ? getJob(jobId) : undefined;

  if (!job) return null;

  const hasPhotos = job.photos.length > 0;

  const handleComplete = () => {
    // Save Engineer Signature
    if (engSigRef.current && !engSigRef.current.isEmpty()) {
       addSignature(job.id, {
         type: "engineer",
         name: engName,
         url: engSigRef.current.toDataURL(),
       });
    }

    // Save Customer Signature
    if (custSigRef.current && !custSigRef.current.isEmpty()) {
       addSignature(job.id, {
         type: "customer",
         name: custName,
         url: custSigRef.current.toDataURL(),
       });
    }

    // Update Status
    updateJob(job.id, { status: "Signed Off" });
    
    toast({
      title: "Job Completed!",
      description: "Job has been signed off successfully.",
    });

    setLocation(`/jobs/${job.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 pt-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/jobs/${job.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Sign Off Job</h1>
          <p className="text-muted-foreground">{job.jobNo} - {job.customerName}</p>
        </div>
      </div>

      {!hasPhotos && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing Evidence</AlertTitle>
          <AlertDescription>
            You must upload at least one photo before signing off this job.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-8">
        {/* Step 1: Engineer Signature */}
        <Card className={!hasPhotos ? "opacity-50 pointer-events-none" : ""}>
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
              />
            </div>
            <div className="space-y-2">
              <Label>Signature</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-md bg-slate-50 h-40 relative">
                <SignatureCanvas 
                  ref={engSigRef}
                  canvasProps={{ className: "sigCanvas" }}
                  backgroundColor="rgba(255,255,255,0)"
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="absolute bottom-2 right-2 text-xs"
                  onClick={() => engSigRef.current?.clear()}
                >
                  <Eraser className="mr-1 h-3 w-3" /> Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Customer Signature */}
        <Card className={!hasPhotos ? "opacity-50 pointer-events-none" : ""}>
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
              />
            </div>
            <div className="space-y-2">
              <Label>Signature</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-md bg-slate-50 h-40 relative">
                 <SignatureCanvas 
                  ref={custSigRef}
                  canvasProps={{ className: "sigCanvas" }}
                  backgroundColor="rgba(255,255,255,0)"
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="absolute bottom-2 right-2 text-xs"
                  onClick={() => custSigRef.current?.clear()}
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
          disabled={!hasPhotos || !engName || !custName}
          onClick={handleComplete}
        >
          <CheckCircle2 className="mr-2 h-6 w-6" />
          Complete & Sign Off Job
        </Button>
      </div>
    </div>
  );
}
