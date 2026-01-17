import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Sparkles, Search, Loader2, ExternalLink, Minimize2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SearchResult {
  type: "job" | "client" | "quote" | "invoice";
  id: string;
  title: string;
  subtitle: string;
  status?: string;
}

export function GlobalAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [location, navigate] = useLocation();

  const currentPage = location.split("/")[1] || "dashboard";

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

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      fetchSuggestions();
    }
  }, [isOpen, currentPage, messages.length]);

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`/api/global-assistant/suggestions?page=${currentPage}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch("/api/global-assistant/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error("Error searching:", error);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, overrideMessage?: string) => {
    e?.preventDefault();
    const messageToSend = overrideMessage || input.trim();
    if (!messageToSend || isLoading) return;

    const userMessage: Message = { role: "user", content: messageToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setSuggestions([]);
    setSearchResults([]);
    setShowSearch(false);

    try {
      const response = await fetch("/api/global-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          currentPage,
          conversationHistory: messages,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let assistantMessage = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantMessage += data.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: "assistant",
                    content: assistantMessage,
                  };
                  return newMessages;
                });
              }
            } catch {
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSubmit(undefined, suggestion);
  };

  const handleResultClick = (result: SearchResult) => {
    const routes: Record<string, string> = {
      job: `/jobs/${result.id}`,
      client: `/clients/${result.id}`,
      quote: `/quotes/${result.id}`,
      invoice: `/invoices/${result.id}`,
    };
    navigate(routes[result.type] || "/");
    setIsOpen(false);
  };

  const getStatusColor = (status?: string) => {
    if (!status) return "bg-gray-100 text-gray-600";
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700",
      in_progress: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      sent: "bg-purple-100 text-purple-700",
      paid: "bg-green-100 text-green-700",
      overdue: "bg-red-100 text-red-700",
      draft: "bg-gray-100 text-gray-600",
    };
    return colors[status.toLowerCase()] || "bg-gray-100 text-gray-600";
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      job: "🔧",
      client: "👤",
      quote: "📝",
      invoice: "💷",
    };
    return icons[type] || "📄";
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center group"
        data-testid="button-open-global-ai"
      >
        <Sparkles className="h-6 w-6 group-hover:animate-pulse" />
        <span className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-50 bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300",
        isExpanded
          ? "bottom-4 right-4 left-4 top-4 md:left-auto md:w-[600px] md:top-20 md:bottom-20"
          : "bottom-4 right-4 w-[380px] h-[520px]"
      )}
      data-testid="global-ai-panel"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-white" />
          <span className="font-semibold text-white">TrueNorth AI</span>
          <span className="text-xs text-blue-200 hidden sm:inline">Your intelligent assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              showSearch ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"
            )}
            data-testid="button-toggle-search"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-white/80 hover:bg-white/10 rounded-lg transition-colors hidden md:block"
            data-testid="button-expand-ai"
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-white/80 hover:bg-white/10 rounded-lg transition-colors"
            data-testid="button-close-global-ai"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="p-3 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs, clients, quotes, invoices..."
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => handleSearch(e.target.value)}
              data-testid="input-global-search"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {searchResults.map((result, idx) => (
                <button
                  key={`${result.type}-${result.id}-${idx}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-100 rounded-lg transition-colors"
                  data-testid={`search-result-${result.type}-${result.id}`}
                >
                  <span className="text-lg">{getTypeIcon(result.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.title}</p>
                    <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                  </div>
                  {result.status && (
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", getStatusColor(result.status))}>
                      {result.status}
                    </span>
                  )}
                  <ExternalLink className="h-3 w-3 text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">How can I help you?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Ask me anything about your business
            </p>
            {suggestions.length > 0 && (
              <div className="space-y-2">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="block w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border"
                    data-testid={`suggestion-${idx}`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((message, idx) => (
            <div
              key={idx}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2",
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        {isLoading && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t bg-gray-50 rounded-b-2xl">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 text-sm border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            disabled={isLoading}
            data-testid="input-ai-message"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="button-send-ai-message"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
