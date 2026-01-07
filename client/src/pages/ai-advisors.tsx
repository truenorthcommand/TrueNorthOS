import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { 
  Bot, 
  ClipboardCheck, 
  Search, 
  Flame, 
  Zap, 
  Send, 
  ImagePlus, 
  X, 
  ArrowLeft,
  Loader2,
  User,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";

type AiAdvisor = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  isActive: boolean;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  image?: string;
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardCheck,
  Search,
  Flame,
  Zap,
  Bot,
};

function AdvisorIcon({ icon, className }: { icon: string; className?: string }) {
  const IconComponent = iconMap[icon] || Bot;
  return <IconComponent className={className} />;
}

export default function AiAdvisors() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAdvisor, setSelectedAdvisor] = useState<AiAdvisor | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: advisors = [], isLoading } = useQuery<AiAdvisor[]>({
    queryKey: ["/api/ai-advisors"],
  });

  const chatMutation = useMutation({
    mutationFn: async ({ advisorId, messages }: { advisorId: string; messages: Message[] }) => {
      const response = await fetch(`/api/ai-advisors/${advisorId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Chat failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ai-advisors/seed", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to initialize advisors");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `${data.count} AI advisors have been initialized`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-advisors"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectAdvisor = (advisor: AiAdvisor) => {
    setSelectedAdvisor(advisor);
    setMessages([]);
    setInput("");
    setImagePreview(null);
  };

  const handleBack = () => {
    setSelectedAdvisor(null);
    setMessages([]);
    setInput("");
    setImagePreview(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please select an image file", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be less than 10MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = () => {
    if (!input.trim() && !imagePreview) return;
    if (!selectedAdvisor) return;

    const newMessage: Message = {
      role: "user",
      content: input.trim(),
      image: imagePreview || undefined,
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput("");
    setImagePreview(null);

    chatMutation.mutate({
      advisorId: selectedAdvisor.id,
      messages: updatedMessages,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (advisors.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Technical Advisor</h1>
          <p className="text-muted-foreground">Expert AI assistants for field service tasks</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Technical Advisors Available</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Technical advisors haven't been configured yet.
            </p>
            {user?.role === "admin" && (
              <Button 
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                data-testid="button-seed-advisors"
              >
                {seedMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Initialize Default Advisors
                  </>
                )}
              </Button>
            )}
            {user?.role !== "admin" && (
              <p className="text-muted-foreground text-sm">
                Contact your administrator to set them up.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedAdvisor) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <AdvisorIcon icon={selectedAdvisor.icon} className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold" data-testid="text-advisor-name">{selectedAdvisor.name}</h2>
              <p className="text-sm text-muted-foreground">{selectedAdvisor.category}</p>
            </div>
          </div>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <AdvisorIcon icon={selectedAdvisor.icon} className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation with {selectedAdvisor.name}</p>
                  <p className="text-sm mt-2">{selectedAdvisor.description}</p>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <AdvisorIcon icon={selectedAdvisor.icon} className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                    data-testid={`message-${message.role}-${index}`}
                  >
                    {message.image && (
                      <img
                        src={message.image}
                        alt="Uploaded"
                        className="max-w-full rounded mb-2 max-h-48 object-contain"
                      />
                    )}
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  </div>
                  {message.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <AdvisorIcon icon={selectedAdvisor.icon} className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            {imagePreview && (
              <div className="relative inline-block mb-3">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-20 rounded border object-cover"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={() => setImagePreview(null)}
                  data-testid="button-remove-image"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-image"
              >
                <ImagePlus className="h-5 w-5" />
              </Button>
              <Textarea
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
                data-testid="input-message"
              />
              <Button
                onClick={handleSend}
                disabled={(!input.trim() && !imagePreview) || chatMutation.isPending}
                data-testid="button-send"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Technical Advisor</h1>
        <p className="text-muted-foreground">Expert technical assistants to help with field service tasks</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {advisors.map((advisor) => (
          <Card
            key={advisor.id}
            className="hover:border-primary hover:shadow-md transition-all cursor-pointer"
            onClick={() => handleSelectAdvisor(advisor)}
            data-testid={`card-advisor-${advisor.id}`}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <AdvisorIcon icon={advisor.icon} className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{advisor.name}</CardTitle>
                  <span className="text-xs text-muted-foreground capitalize">{advisor.category}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{advisor.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
