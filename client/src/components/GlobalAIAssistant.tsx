import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Sparkles, Search, Loader2, ExternalLink, Minimize2, Maximize2, History, Plus, Trash2, ChevronLeft, Globe, AlertTriangle, TrendingUp, Info, ArrowRight, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface SmartInsight {
  type: 'alert' | 'opportunity' | 'info';
  title: string;
  description: string;
  action?: string;
  actionPath?: string;
  priority: 'high' | 'medium' | 'low';
}

interface SearchResult {
  type: "job" | "client" | "quote" | "invoice";
  id: string;
  title: string;
  subtitle: string;
  status?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastMessageAt: string;
  context?: string;
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
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [insights, setInsights] = useState<SmartInsight[]>([]);
  const [showInsights, setShowInsights] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [location, navigate] = useLocation();

  const willSearchWeb = (message: string): boolean => {
    const searchTriggers = [
      "search for", "search the web", "look up", "find online", "google", "research",
      "what is", "how to", "where can i", "where to buy", "supplier", "price of",
      "cost of", "regulations", "bs 7671", "gas safe", "building regs", "part p",
      "wiring regulations", "specifications", "specs for", "datasheet", "technical",
      "manufacturer", "stockist", "wholesaler", "trade counter", "plumbers merchant",
      "electrical wholesaler", "compare", "alternative to", "equivalent",
    ];
    const lowerMessage = message.toLowerCase();
    return searchTriggers.some(trigger => lowerMessage.includes(trigger));
  };

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
      fetchInsights();
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

  const fetchInsights = async () => {
    try {
      const response = await fetch("/api/global-assistant/insights");
      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
      }
    } catch (error) {
      console.error("Error fetching insights:", error);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      case 'opportunity': return <TrendingUp className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getInsightStyle = (type: string, priority: string) => {
    if (type === 'alert' && priority === 'high') {
      return 'bg-red-50 border-red-200 text-red-800';
    } else if (type === 'opportunity') {
      return 'bg-amber-50 border-amber-200 text-amber-800';
    }
    return 'bg-blue-50 border-blue-200 text-blue-800';
  };

  const fetchConversations = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/global-assistant/conversations");
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const createNewConversation = async (preserveMessages = false) => {
    try {
      const response = await fetch("/api/global-assistant/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: currentPage }),
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentConversationId(data.conversation.id);
        // Only clear messages if this is a user-initiated new chat
        if (!preserveMessages) {
          setMessages([]);
          setSuggestions([]);
          fetchSuggestions();
        }
        setShowHistory(false);
        return data.conversation.id;
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
    return null;
  };

  const loadConversation = async (conversation: Conversation) => {
    setCurrentConversationId(conversation.id);
    setMessages(conversation.messages || []);
    setShowHistory(false);
    setSuggestions([]);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/global-assistant/conversations/${id}`, { method: "DELETE" });
      setConversations(conversations.filter(c => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
        fetchSuggestions();
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setShowHistory(false);
    fetchSuggestions();
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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

    const userMessage: Message = { role: "user", content: messageToSend, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setIsSearchingWeb(willSearchWeb(messageToSend));
    setSuggestions([]);
    setSearchResults([]);
    setShowSearch(false);

    // Create a new conversation if we don't have one (preserve messages since we just added one)
    let convId = currentConversationId;
    if (!convId) {
      convId = await createNewConversation(true);
    }

    try {
      const response = await fetch("/api/global-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          currentPage,
          conversationId: convId,
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
              if (data.conversationId && !currentConversationId) {
                setCurrentConversationId(data.conversationId);
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
      setIsSearchingWeb(false);
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

  const renderMessageContent = (content: string, isUser: boolean) => {
    const urlRegex = /(https?:\/\/[^\s<>"\]]+)/g;
    const parts = content.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        urlRegex.lastIndex = 0;
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "underline hover:opacity-80 inline-flex items-center gap-1",
              isUser ? "text-blue-100" : "text-blue-600"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {part.length > 50 ? part.slice(0, 50) + "..." : part}
            <ExternalLink className="h-3 w-3 inline flex-shrink-0" />
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full bg-[#0F2B4C] hover:bg-[#1a3a5c] text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center group"
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
      <div className="flex items-center justify-between px-4 py-3 bg-[#0F2B4C] rounded-t-2xl">
        <div className="flex items-center gap-2">
          {showHistory ? (
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 text-white/80 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <Sparkles className="h-5 w-5 text-white" />
          )}
          <span className="font-semibold text-white">
            {showHistory ? "Chat History" : "Foreman AI"}
          </span>
          {!showHistory && (
            <span className="text-xs text-white/70 hidden sm:inline">
              {currentConversationId ? "Remembers your chats" : "Your intelligent assistant"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!showHistory && (
            <>
              <button
                onClick={() => {
                  setShowHistory(true);
                  fetchConversations();
                }}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  "text-white/80 hover:bg-white/10"
                )}
                data-testid="button-toggle-history"
                title="Chat history"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                onClick={startNewChat}
                className="p-1.5 text-white/80 hover:bg-white/10 rounded-lg transition-colors"
                data-testid="button-new-chat"
                title="New chat"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setInput("Search the web for ");
                  inputRef.current?.focus();
                }}
                className="p-1.5 text-white/80 hover:bg-white/10 rounded-lg transition-colors"
                data-testid="button-web-search"
                title="Search the web"
              >
                <Globe className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  showSearch ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"
                )}
                data-testid="button-toggle-search"
                title="Search records"
              >
                <Search className="h-4 w-4" />
              </button>
            </>
          )}
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

      {showHistory ? (
        <div className="flex-1 overflow-y-auto">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="font-medium text-gray-700 mb-1">No conversations yet</h3>
              <p className="text-sm text-gray-500 mb-4">Start a chat and it will be saved here</p>
              <button
                onClick={startNewChat}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Start New Chat
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 text-left rounded-lg transition-colors group",
                    currentConversationId === conv.id
                      ? "bg-blue-50 border border-blue-200"
                      : "hover:bg-gray-50 border border-transparent"
                  )}
                  data-testid={`conversation-${conv.id}`}
                >
                  <MessageSquare className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conv.title}</p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(conv.lastMessageAt)}</p>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
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
              <div className="space-y-4">
                {insights.length > 0 && showInsights && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        Smart Insights
                      </div>
                      <button
                        onClick={() => setShowInsights(false)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                        data-testid="button-hide-insights"
                      >
                        Hide
                      </button>
                    </div>
                    {insights.slice(0, 3).map((insight, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (insight.actionPath) {
                            navigate(insight.actionPath);
                            setIsOpen(false);
                          }
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm",
                          getInsightStyle(insight.type, insight.priority)
                        )}
                        data-testid={`insight-${idx}`}
                      >
                        <div className="flex items-start gap-2">
                          {getInsightIcon(insight.type)}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{insight.title}</p>
                            <p className="text-xs opacity-80 mt-0.5">{insight.description}</p>
                          </div>
                          {insight.action && (
                            <ArrowRight className="h-4 w-4 opacity-50 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="text-center py-4">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                    <MessageSquare className="h-7 w-7 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1">How can I help you?</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Ask me anything about your business
                  </p>
                </div>

                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 px-1">
                      <Sparkles className="h-3 w-3" />
                      Suggested for you
                    </div>
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
                    <p className="text-sm whitespace-pre-wrap">
                      {renderMessageContent(message.content, message.role === "user")}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-2 flex items-center gap-2">
                  {isSearchingWeb ? (
                    <>
                      <Globe className="h-4 w-4 animate-pulse text-blue-500" />
                      <span className="text-sm text-gray-500">Searching the web...</span>
                    </>
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  )}
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
        </>
      )}
    </div>
  );
}
