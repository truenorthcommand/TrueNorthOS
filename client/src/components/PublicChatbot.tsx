import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, RotateCcw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: "Hi there! I'm the TrueNorth OS assistant. I can help you with questions about our field service management platform, pricing, features, or how to get started. What would you like to know?",
};

const QUICK_QUESTIONS = [
  "What is TrueNorth OS?",
  "What are the pricing plans?",
  "How do I sign up?",
  "What features are included?",
];

export function PublicChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    setHasError(false);

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const conversationHistory = messages
      .filter((m) => m !== WELCOME_MESSAGE)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch("/api/public-chatbot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantContent,
          };
          return updated;
        });
      }

      if (!assistantContent.trim()) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "I'm sorry, I couldn't generate a response. Please try again.",
          };
          return updated;
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      setHasError(true);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error instanceof Error && error.message !== "Failed to get response"
              ? error.message
              : "Sorry, I'm having trouble responding right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleReset = () => {
    setMessages([WELCOME_MESSAGE]);
    setHasError(false);
    setInput("");
  };

  const showQuickQuestions = messages.length <= 1 && !isLoading;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-white shadow-lg transition-all hover:bg-emerald-700 hover:shadow-xl hover:scale-105 active:scale-95"
          data-testid="button-open-chatbot"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Chat with us</span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
          style={{ height: "min(560px, calc(100vh - 6rem))" }}
          data-testid="chatbot-panel"
        >
          <div className="flex items-center justify-between rounded-t-2xl bg-emerald-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">TrueNorth OS</h3>
                <p className="text-xs text-emerald-100">Ask us anything</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <button
                  onClick={handleReset}
                  className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                  title="Start new conversation"
                  data-testid="button-reset-chat"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                data-testid="button-close-chatbot"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3" data-testid="chatbot-messages">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`mb-3 flex gap-2 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                data-testid={`chatbot-message-${message.role}-${idx}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    message.role === "user" ? "bg-slate-100" : "bg-emerald-100"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="h-3.5 w-3.5 text-slate-600" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {message.content || (
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking...
                    </span>
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="mb-3 flex gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Bot className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div className="rounded-2xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Thinking...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {showQuickQuestions && (
            <div className="border-t border-slate-100 px-4 py-2.5" data-testid="chatbot-quick-questions">
              <p className="mb-2 text-xs font-medium text-slate-400">Quick questions</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                    data-testid={`button-quick-question-${idx}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-slate-200 px-3 py-3"
            data-testid="chatbot-input-form"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              disabled={isLoading}
              maxLength={1000}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-300 disabled:opacity-50"
              data-testid="input-chatbot-message"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600"
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
