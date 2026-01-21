import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  BookOpen, 
  HelpCircle,
  Briefcase,
  Calculator,
  Truck,
  Users,
  Shield,
  Brain,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const quickQuestions = [
  "How do I create a new job?",
  "How do I track expenses?",
  "How do I use the AI advisors?",
  "How do vehicle walkaround checks work?",
  "How do I generate an invoice?",
  "How do I message my team?",
];

const moduleGuides = [
  { 
    icon: Briefcase, 
    title: "Operations", 
    description: "Jobs, quotes, invoices, and client management",
    color: "bg-blue-500"
  },
  { 
    icon: Calculator, 
    title: "Finance", 
    description: "Timesheets, expenses, mileage, and payments",
    color: "bg-green-500"
  },
  { 
    icon: Truck, 
    title: "Fleet", 
    description: "Vehicle management and walkaround checks",
    color: "bg-orange-500"
  },
  { 
    icon: Users, 
    title: "Workforce", 
    description: "Team messaging and GPS tracking",
    color: "bg-purple-500"
  },
  { 
    icon: Shield, 
    title: "Compliance", 
    description: "2FA, GDPR, and audit trails",
    color: "bg-red-500"
  },
  { 
    icon: Brain, 
    title: "Intelligence", 
    description: "AI advisors and smart tools",
    color: "bg-indigo-500"
  },
];

export default function UserGuide() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/user-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          question: text.trim(),
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const err = await res.json();
        toast({
          title: "Error",
          description: err.error || "Failed to get response",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to the guide assistant",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickQuestion = (question: string) => {
    sendMessage(question);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">User Guide</h1>
            <p className="text-muted-foreground">Get help and guidance for TradeHub Pro</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Ask the Guide Assistant</CardTitle>
                </div>
                <CardDescription>
                  Ask any question about using TradeHub Pro
                </CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                      <div className="p-4 bg-primary/10 rounded-full mb-4">
                        <HelpCircle className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">How can I help you today?</h3>
                      <p className="text-muted-foreground text-sm mb-6 max-w-md">
                        I'm your guide to TradeHub Pro. Ask me anything about managing jobs, 
                        tracking expenses, using AI advisors, fleet management, and more.
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                        {quickQuestions.map((q, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleQuickQuestion(q)}
                            data-testid={`quick-question-${i}`}
                          >
                            {q}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${
                            message.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          {message.role === "assistant" && (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                          {message.role === "user" && (
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex gap-3 justify-start">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                          <div className="bg-muted rounded-lg px-4 py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                <div className="p-4 border-t">
                  <form onSubmit={handleSubmit} className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask a question about the app..."
                      disabled={isLoading}
                      className="flex-1"
                      data-testid="guide-input"
                    />
                    <Button 
                      type="submit" 
                      disabled={!input.trim() || isLoading}
                      data-testid="guide-send"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">App Modules</CardTitle>
                <CardDescription className="text-xs">
                  Learn about each part of the system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {moduleGuides.map((module, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickQuestion(`Tell me about the ${module.title} module`)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                    data-testid={`module-${module.title.toLowerCase()}`}
                  >
                    <div className={`p-2 rounded-md ${module.color}`}>
                      <module.icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{module.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{module.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Getting Started</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm"
                  onClick={() => handleQuickQuestion("Give me a quick start guide for new users")}
                  data-testid="quick-start"
                >
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Quick Start Guide
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm"
                  onClick={() => handleQuickQuestion("What are the key features I should know about?")}
                  data-testid="key-features"
                >
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Key Features Overview
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm"
                  onClick={() => handleQuickQuestion("How do I get the most out of the AI features?")}
                  data-testid="ai-features"
                >
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Using AI Features
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
