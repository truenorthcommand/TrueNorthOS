import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Mic, MicOff, Sparkles, Save, Loader2, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Job = {
  id: string;
  jobNo: string;
  customerName: string;
  address: string | null;
  status: string;
  isLongRunning: boolean;
};

type SummarizeResult = {
  original: string;
  cleanedNotes: string;
  clientSummary: string;
  actionItems: string[];
};

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function VoiceNotes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [summarizeResult, setSummarizeResult] = useState<SummarizeResult | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  
  const recognitionRef = useRef<any>(null);

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const longRunningJobs = jobs.filter(job => 
    job.isLongRunning && 
    job.status !== 'Signed Off' && 
    job.status !== 'Draft'
  );

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      
      if (final) {
        setTranscript(prev => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access to use voice notes.",
          variant: "destructive",
        });
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (isRecording) {
        try {
          recognition.start();
        } catch (e) {
          setIsRecording(false);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setInterimTranscript("");
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        toast({
          title: "Error",
          description: "Could not start recording. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ai/summarize-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          transcript: transcript.trim(),
          jobContext: selectedJob ? `Job ${selectedJob.jobNo} for ${selectedJob.customerName} at ${selectedJob.address || 'site'}` : undefined
        }),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to summarize");
      }
      return response.json();
    },
    onSuccess: (data: SummarizeResult) => {
      setSummarizeResult(data);
      toast({
        title: "Notes Summarized",
        description: "Your voice notes have been processed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJobId || !summarizeResult) {
        throw new Error("Please select a job and summarize your notes first");
      }

      // Build notes with summary and action items
      let fullNotes = summarizeResult.clientSummary;
      if (summarizeResult.actionItems && summarizeResult.actionItems.length > 0) {
        fullNotes += '\n\n**Action Items:**\n' + summarizeResult.actionItems.map(item => `• ${item}`).join('\n');
      }

      const response = await fetch(`/api/jobs/${selectedJobId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          notes: fullNotes,
          photos: []
        }),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save update");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Update Saved",
        description: "Your job update has been saved successfully.",
      });
      setTranscript("");
      setInterimTranscript("");
      setSummarizeResult(null);
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${selectedJobId}/updates`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearAll = () => {
    setTranscript("");
    setInterimTranscript("");
    setSummarizeResult(null);
    if (isRecording) {
      toggleRecording();
    }
  };

  if (!speechSupported) {
    return (
      <div className="space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Voice Notes</h1>
          <p className="text-muted-foreground">Record and transcribe voice notes for job updates</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Speech Recognition Not Supported</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Your browser doesn't support the Web Speech API. Please use Chrome, Edge, or Safari for voice notes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Voice Notes</h1>
        <p className="text-muted-foreground">Record and transcribe voice notes for job updates</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Job</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={jobsLoading}>
            <SelectTrigger data-testid="select-job">
              <SelectValue placeholder={jobsLoading ? "Loading jobs..." : "Select a job to update"} />
            </SelectTrigger>
            <SelectContent>
              {longRunningJobs.length === 0 ? (
                <SelectItem value="_none" disabled>No long-running jobs available</SelectItem>
              ) : (
                longRunningJobs.map(job => (
                  <SelectItem key={job.id} value={job.id} data-testid={`job-option-${job.id}`}>
                    {job.jobNo} - {job.customerName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {selectedJob && (
            <div className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">{selectedJob.address}</span>
              <Badge variant="outline" className="ml-2">{selectedJob.status}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={toggleRecording}
              disabled={!selectedJobId}
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
                "focus:outline-none focus:ring-4 focus:ring-primary/30",
                isRecording 
                  ? "bg-red-500 hover:bg-red-600 animate-pulse shadow-lg shadow-red-500/50" 
                  : selectedJobId 
                    ? "bg-primary hover:bg-primary/90 shadow-lg" 
                    : "bg-muted cursor-not-allowed"
              )}
              data-testid="button-record"
            >
              {isRecording ? (
                <MicOff className="h-10 w-10 text-white" />
              ) : (
                <Mic className="h-10 w-10 text-white" />
              )}
            </button>
            
            <p className="text-sm text-muted-foreground">
              {!selectedJobId 
                ? "Select a job to start recording" 
                : isRecording 
                  ? "Tap to stop recording" 
                  : "Tap to start recording"}
            </p>

            {isRecording && (
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div 
                    key={i} 
                    className="w-1 bg-primary rounded-full animate-pulse"
                    style={{ 
                      height: `${12 + Math.random() * 20}px`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {(transcript || interimTranscript) && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Raw Transcript</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAll}
                  data-testid="button-clear"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={transcript + interimTranscript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Your speech will appear here..."
                className="min-h-[200px] resize-none"
                data-testid="textarea-transcript"
              />
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={() => summarizeMutation.mutate()}
                  disabled={!transcript.trim() || summarizeMutation.isPending}
                  className="flex-1"
                  data-testid="button-summarize"
                >
                  {summarizeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Summarizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Summarize with AI
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {summarizeResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Client-Friendly Summary</label>
                  <Textarea
                    value={summarizeResult.clientSummary}
                    onChange={(e) => setSummarizeResult({
                      ...summarizeResult,
                      clientSummary: e.target.value
                    })}
                    className="min-h-[120px] resize-none"
                    data-testid="textarea-summary"
                  />
                </div>

                {summarizeResult.actionItems.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Action Items</label>
                    <ul className="space-y-1">
                      {summarizeResult.actionItems.map((item, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  onClick={() => saveUpdateMutation.mutate()}
                  disabled={!selectedJobId || saveUpdateMutation.isPending}
                  className="w-full"
                  data-testid="button-save-update"
                >
                  {saveUpdateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save as Job Update
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!transcript && !interimTranscript && !isRecording && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Mic className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-1">Ready to Record</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Select a job and tap the microphone button to start recording your voice notes. 
              Your speech will be transcribed in real-time.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
