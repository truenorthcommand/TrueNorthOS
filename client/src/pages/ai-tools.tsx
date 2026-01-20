import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Sparkles, Receipt, Camera, FileText, MessageSquare, ClipboardCheck, 
  Mic, Image, Loader2, Upload, Wand2, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface AIResult {
  success: boolean;
  data: any;
  error?: string;
}

export default function AITools() {
  const [activeTab, setActiveTab] = useState("receipt");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);

  const [receiptImage, setReceiptImage] = useState<string>("");
  const [sitePhotoImage, setSitePhotoImage] = useState<string>("");
  const [sitePhotoContext, setSitePhotoContext] = useState("");
  const [engineerNotes, setEngineerNotes] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [quoteServices, setQuoteServices] = useState("");
  const [messageType, setMessageType] = useState<string>("appointment_confirmation");
  const [customerName, setCustomerName] = useState("");
  const [messageDetails, setMessageDetails] = useState("");
  const [checklistData, setChecklistData] = useState("");
  const [inspectionType, setInspectionType] = useState("");
  const [audioData, setAudioData] = useState<string>("");
  const [imagePrompt, setImagePrompt] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAudioData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const callAI = async (endpoint: string, body: any) => {
    setIsProcessing(true);
    setResult(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      setResult(data);
      if (data.success) {
        toast.success("AI processing complete!");
      } else {
        toast.error(data.error || "Processing failed");
      }
    } catch (error: any) {
      setResult({ success: false, data: null, error: error.message });
      toast.error(error.message || "Failed to process");
    } finally {
      setIsProcessing(false);
    }
  };

  const renderResult = () => {
    if (!result) return null;
    
    return (
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <CardTitle className="text-base">
              {result.success ? "AI Result" : "Error"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {result.success ? (
            <pre className="text-sm bg-slate-50 p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          ) : (
            <p className="text-red-600">{result.error}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-600" />
            AI Tools
          </h1>
          <p className="text-muted-foreground mt-1">
            Powered by Gemini AI - No API key required
          </p>
        </div>
        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
          Gemini AI
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 lg:grid-cols-8 gap-1">
          <TabsTrigger value="receipt" className="flex items-center gap-1">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Receipt</span>
          </TabsTrigger>
          <TabsTrigger value="photo" className="flex items-center gap-1">
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Photo</span>
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Summary</span>
          </TabsTrigger>
          <TabsTrigger value="quote" className="flex items-center gap-1">
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">Quote</span>
          </TabsTrigger>
          <TabsTrigger value="message" className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Message</span>
          </TabsTrigger>
          <TabsTrigger value="inspection" className="flex items-center gap-1">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Report</span>
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-1">
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Voice</span>
          </TabsTrigger>
          <TabsTrigger value="image" className="flex items-center gap-1">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Image</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receipt" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Receipt Scanner
              </CardTitle>
              <CardDescription>
                Upload a receipt photo and AI will extract vendor, amount, VAT, date, and more
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Receipt Photo</Label>
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => handleImageUpload(e, setReceiptImage)}
                  data-testid="input-receipt-image"
                />
              </div>
              {receiptImage && (
                <img src={receiptImage} alt="Receipt preview" className="max-h-48 rounded-lg border" />
              )}
              <Button 
                onClick={() => callAI("/api/ai/gemini/scan-receipt", { image: receiptImage })}
                disabled={!receiptImage || isProcessing}
                data-testid="button-scan-receipt"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Scan Receipt
              </Button>
              {renderResult()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Site Photo Analysis
              </CardTitle>
              <CardDescription>
                Upload a job site photo and AI will identify issues, assess condition, and suggest actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Site Photo</Label>
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => handleImageUpload(e, setSitePhotoImage)}
                  data-testid="input-site-photo"
                />
              </div>
              {sitePhotoImage && (
                <img src={sitePhotoImage} alt="Site photo preview" className="max-h-48 rounded-lg border" />
              )}
              <div>
                <Label>Job Context (optional)</Label>
                <Input 
                  value={sitePhotoContext}
                  onChange={(e) => setSitePhotoContext(e.target.value)}
                  placeholder="e.g., Boiler installation, bathroom renovation"
                  data-testid="input-site-context"
                />
              </div>
              <Button 
                onClick={() => callAI("/api/ai/gemini/analyze-photo", { image: sitePhotoImage, jobContext: sitePhotoContext })}
                disabled={!sitePhotoImage || isProcessing}
                data-testid="button-analyze-photo"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Analyze Photo
              </Button>
              {renderResult()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Job Summary Generator
              </CardTitle>
              <CardDescription>
                Paste engineer notes and AI will create a professional job summary
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Job Title</Label>
                <Input 
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g., Boiler Service"
                  data-testid="input-job-title"
                />
              </div>
              <div>
                <Label>Engineer Notes</Label>
                <Textarea 
                  value={engineerNotes}
                  onChange={(e) => setEngineerNotes(e.target.value)}
                  placeholder="Paste the engineer's notes here..."
                  rows={6}
                  data-testid="input-engineer-notes"
                />
              </div>
              <Button 
                onClick={() => callAI("/api/ai/gemini/generate-job-summary", { 
                  engineerNotes, 
                  jobDetails: { title: jobTitle } 
                })}
                disabled={!engineerNotes || isProcessing}
                data-testid="button-generate-summary"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Summary
              </Button>
              {renderResult()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quote" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Quote Description Generator
              </CardTitle>
              <CardDescription>
                Enter services and AI will create professional quote content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Services (one per line)</Label>
                <Textarea 
                  value={quoteServices}
                  onChange={(e) => setQuoteServices(e.target.value)}
                  placeholder="Boiler installation&#10;Gas safety check&#10;Radiator replacement"
                  rows={4}
                  data-testid="input-quote-services"
                />
              </div>
              <Button 
                onClick={() => callAI("/api/ai/gemini/generate-quote", { 
                  services: quoteServices.split("\n").filter(s => s.trim()),
                  jobDetails: {} 
                })}
                disabled={!quoteServices || isProcessing}
                data-testid="button-generate-quote"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Quote Content
              </Button>
              {renderResult()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="message" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Customer Message Generator
              </CardTitle>
              <CardDescription>
                Generate professional customer communications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Message Type</Label>
                <Select value={messageType} onValueChange={setMessageType}>
                  <SelectTrigger data-testid="select-message-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment_confirmation">Appointment Confirmation</SelectItem>
                    <SelectItem value="job_complete">Job Complete</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="quote_sent">Quote Sent</SelectItem>
                    <SelectItem value="invoice_reminder">Invoice Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Customer Name</Label>
                <Input 
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g., John Smith"
                  data-testid="input-customer-name"
                />
              </div>
              <div>
                <Label>Details (JSON format)</Label>
                <Textarea 
                  value={messageDetails}
                  onChange={(e) => setMessageDetails(e.target.value)}
                  placeholder='{"date": "15/01/2026", "time": "10:00 AM", "address": "123 Main St"}'
                  rows={3}
                  data-testid="input-message-details"
                />
              </div>
              <Button 
                onClick={() => {
                  let details = {};
                  try { details = JSON.parse(messageDetails); } catch {}
                  callAI("/api/ai/gemini/generate-message", { messageType, customerName, details });
                }}
                disabled={!customerName || isProcessing}
                data-testid="button-generate-message"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Message
              </Button>
              {renderResult()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Inspection Report Generator
              </CardTitle>
              <CardDescription>
                Convert checklist data into a professional inspection report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Inspection Type</Label>
                <Input 
                  value={inspectionType}
                  onChange={(e) => setInspectionType(e.target.value)}
                  placeholder="e.g., Gas Safety Inspection, Electrical Check"
                  data-testid="input-inspection-type"
                />
              </div>
              <div>
                <Label>Checklist Data (JSON array)</Label>
                <Textarea 
                  value={checklistData}
                  onChange={(e) => setChecklistData(e.target.value)}
                  placeholder='[{"item": "Boiler pressure", "result": "pass", "notes": "2.1 bar"}]'
                  rows={6}
                  data-testid="input-checklist-data"
                />
              </div>
              <Button 
                onClick={() => {
                  let data = [];
                  try { data = JSON.parse(checklistData); } catch {}
                  callAI("/api/ai/gemini/generate-inspection-report", { checklistData: data, inspectionType });
                }}
                disabled={!checklistData || isProcessing}
                data-testid="button-generate-report"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Report
              </Button>
              {renderResult()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Voice Note Transcription
              </CardTitle>
              <CardDescription>
                Upload an audio recording and AI will transcribe and summarize it
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Audio File</Label>
                <Input 
                  type="file" 
                  accept="audio/*" 
                  onChange={handleAudioUpload}
                  data-testid="input-audio-file"
                />
              </div>
              {audioData && (
                <audio controls src={audioData} className="w-full" />
              )}
              <Button 
                onClick={() => callAI("/api/ai/gemini/transcribe-voice", { audio: audioData })}
                disabled={!audioData || isProcessing}
                data-testid="button-transcribe"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Transcribe Audio
              </Button>
              {renderResult()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                AI Image Generation
              </CardTitle>
              <CardDescription>
                Generate images for proposals, marketing materials, or documentation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Image Prompt</Label>
                <Textarea 
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Describe the image you want to generate..."
                  rows={3}
                  data-testid="input-image-prompt"
                />
              </div>
              <Button 
                onClick={() => callAI("/api/ai/gemini/generate-image", { prompt: imagePrompt })}
                disabled={!imagePrompt || isProcessing}
                data-testid="button-generate-image"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Image
              </Button>
              {result?.success && result.data?.image && (
                <Card className="mt-4">
                  <CardContent className="pt-4">
                    <img src={result.data.image} alt="Generated" className="max-w-full rounded-lg" />
                  </CardContent>
                </Card>
              )}
              {!result?.data?.image && renderResult()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
