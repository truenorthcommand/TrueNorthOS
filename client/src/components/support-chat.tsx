import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  MinusCircle,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MAX_MESSAGE_LENGTH = 2000;

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !threadId && user) {
      createThread();
    }
  }, [isOpen, user]);

  const validateInput = (text: string): string | null => {
    if (text.length === 0) return "Message cannot be empty";
    if (text.length > MAX_MESSAGE_LENGTH) {
      return `Message too long (${text.length}/${MAX_MESSAGE_LENGTH} characters)`;
    }

    const suspiciousPatterns = [
      /<script/gi,
      /javascript:/gi,
      /on(error|load|click)=/gi,
    ];

    for (const pattern of suspiciousPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        return "Message contains disallowed content";
      }
    }

    return null;
  };

  const createThread = async () => {
    try {
      setError(null);
      const response = await fetch("/api/support-chat/threads", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create thread");
      }

      const data = await response.json();
      setThreadId(data.threadId);

      setMessages([
        {
          role: "assistant",
          content: `Hi${user?.name ? " " + user.name.split(" ")[0] : ""}! 👋 I'm here to help with any questions about TrueNorth OS. What can I help you with today?`,
        },
      ]);
    } catch (error: any) {
      console.error("Error creating thread:", error);
      setError(error.message);
      setMessages([
        {
          role: "assistant",
          content:
            "Sorry, I had trouble connecting. Please refresh and try again.",
        },
      ]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !threadId || isStreaming) return;

    const userMessage = input.trim();

    const validationError = validateInput(userMessage);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setInput("");

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/support-chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ threadId, message: userMessage }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk
          .split("\n")
          .filter((line) => line.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "delta") {
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === "assistant") {
                  lastMessage.content += data.content;
                }
                return [...newMessages];
              });
            } else if (data.type === "done") {
              setIsStreaming(false);
            } else if (data.type === "error") {
              throw new Error(data.message);
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
      setIsStreaming(false);
    } catch (error: any) {
      console.error("Error sending message:", error);
      setError(error.message);
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.role === "assistant" && !lastMessage.content) {
          lastMessage.content =
            "Sorry, I encountered an error. Please try again.";
        }
        return [...newMessages];
      });
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const charCount = input.length;
  const isNearLimit = charCount > MAX_MESSAGE_LENGTH * 0.9;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;

  if (!user) return null;

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 z-50"
          size="icon"
          data-testid="button-support-chat-open"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 w-[380px] bg-white dark:bg-slate-900 rounded-lg shadow-2xl flex flex-col z-50 transition-all border ${
            isMinimized ? "h-14" : "h-[550px]"
          }`}
          data-testid="support-chat-panel"
        >
          <div className="p-3 border-b flex items-center justify-between bg-emerald-600 text-white rounded-t-lg cursor-pointer"
            onClick={() => isMinimized && setIsMinimized(false)}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm" data-testid="text-support-chat-title">
                  TrueNorth Support
                </h3>
                <p className="text-xs opacity-90">Usually replies instantly</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
                data-testid="button-support-chat-minimize"
              >
                <MinusCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                data-testid="button-support-chat-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-lg ${
                        msg.role === "user"
                          ? "bg-emerald-600 text-white rounded-br-none"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-bl-none"
                      }`}
                      data-testid={`chat-message-${msg.role}-${i}`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                      {msg.role === "assistant" && !msg.content && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </div>
                ))}
              </ScrollArea>

              <div className="p-3 border-t bg-gray-50 dark:bg-slate-800 rounded-b-lg">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your message..."
                    disabled={isStreaming || !threadId}
                    className={`flex-1 text-sm ${isOverLimit ? "border-red-500" : ""}`}
                    maxLength={MAX_MESSAGE_LENGTH + 100}
                    data-testid="input-support-chat-message"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={
                      !input.trim() || isStreaming || !threadId || isOverLimit
                    }
                    size="icon"
                    className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
                    data-testid="button-support-chat-send"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex justify-between items-center mt-1.5">
                  <p className="text-xs text-gray-500">
                    Press Enter to send
                  </p>
                  {isNearLimit && (
                    <p
                      className={`text-xs ${isOverLimit ? "text-red-500" : "text-amber-500"}`}
                    >
                      {charCount}/{MAX_MESSAGE_LENGTH}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
