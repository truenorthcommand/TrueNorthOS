import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format, isToday, isYesterday } from "date-fns";
import { MessageCircle, Send, Plus, Users, Search, ArrowLeft, Loader2 } from "lucide-react";

interface User {
  id: string;
  name: string;
  role: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: User | null;
}

interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  lastReadAt: string | null;
  user: User;
}

interface Conversation {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
  lastMessage?: Message;
  unreadCount: number;
}

export default function Messages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobileViewingConvo, setIsMobileViewingConvo] = useState(false);

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/messages/conversations"],
  });

  const { data: availableUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/messages/users"],
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/messages/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
    queryFn: async () => {
      if (!selectedConversation) return [];
      const res = await fetch(`/api/messages/conversations/${selectedConversation.id}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
  });

  const createDirectConversation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/messages/conversations/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      setSelectedConversation(conversation);
      setIsNewChatOpen(false);
      setIsMobileViewingConvo(true);
    },
  });

  const createGroupConversation = useMutation({
    mutationFn: async ({ name, memberIds }: { name: string; memberIds: string[] }) => {
      const res = await fetch("/api/messages/conversations/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, memberIds }),
      });
      if (!res.ok) throw new Error("Failed to create group");
      return res.json();
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      setSelectedConversation(conversation);
      setIsNewGroupOpen(false);
      setSelectedUsers([]);
      setGroupName("");
      setIsMobileViewingConvo(true);
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "chat_message",
          conversationId,
          content,
        }));
        return null;
      }
      const res = await fetch(`/api/messages/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
  });

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/notifications`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "new_message") {
          queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
          if (selectedConversation?.id === data.conversationId) {
            queryClient.invalidateQueries({ 
              queryKey: ["/api/messages/conversations", data.conversationId, "messages"] 
            });
          }
        } else if (data.type === "user_typing") {
          if (data.isTyping) {
            setTypingUsers(prev => new Map(prev).set(data.conversationId, data.userName));
          } else {
            setTypingUsers(prev => {
              const next = new Map(prev);
              next.delete(data.conversationId);
              return next;
            });
          }
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, [queryClient, selectedConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedConversation && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "mark_read",
        conversationId: selectedConversation.id,
      }));
    }
  }, [selectedConversation, messages]);

  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversation) return;

    sendMessage.mutate({
      conversationId: selectedConversation.id,
      content: messageInput.trim(),
    });
    setMessageInput("");
  }, [messageInput, selectedConversation, sendMessage]);

  const handleTyping = useCallback(() => {
    if (!selectedConversation || !wsRef.current) return;

    if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "typing",
        conversationId: selectedConversation.id,
        isTyping: true,
      }));
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "typing",
          conversationId: selectedConversation.id,
          isTyping: false,
        }));
      }
    }, 2000);
  }, [selectedConversation]);

  const getConversationName = (conversation: Conversation) => {
    if (conversation.isGroup && conversation.name) {
      return conversation.name;
    }
    const otherMembers = conversation.members.filter(m => m.userId !== user?.id);
    return otherMembers.map(m => m.user.name).join(", ") || "Unknown";
  };

  const getConversationInitials = (conversation: Conversation) => {
    const name = getConversationName(conversation);
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, "HH:mm");
    }
    if (isYesterday(date)) {
      return "Yesterday";
    }
    return format(date, "dd/MM/yy");
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const name = getConversationName(c).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const ConversationList = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Messages
          </h2>
          <div className="flex gap-2">
            <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-new-chat">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Conversation</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Select a team member to start chatting:</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableUsers.map((u) => (
                      <Button
                        key={u.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => createDirectConversation.mutate(u.id)}
                        disabled={createDirectConversation.isPending}
                        data-testid={`button-start-chat-${u.id}`}
                      >
                        <Avatar className="h-8 w-8 mr-2">
                          <AvatarFallback>{u.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span>{u.name}</span>
                        <Badge variant="secondary" className="ml-auto">{u.role}</Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isNewGroupOpen} onOpenChange={setIsNewGroupOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-new-group">
                  <Users className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Group Chat</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input
                      id="group-name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="e.g., Project Team"
                      data-testid="input-group-name"
                    />
                  </div>
                  <div>
                    <Label>Select Members</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto mt-2">
                      {availableUsers.map((u) => (
                        <div key={u.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`user-${u.id}`}
                            checked={selectedUsers.includes(u.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUsers([...selectedUsers, u.id]);
                              } else {
                                setSelectedUsers(selectedUsers.filter(id => id !== u.id));
                              }
                            }}
                            data-testid={`checkbox-user-${u.id}`}
                          />
                          <Label htmlFor={`user-${u.id}`} className="flex items-center gap-2 cursor-pointer">
                            {u.name}
                            <Badge variant="secondary" className="text-xs">{u.role}</Badge>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={() => createGroupConversation.mutate({ name: groupName, memberIds: selectedUsers })}
                    disabled={selectedUsers.length === 0 || !groupName.trim() || createGroupConversation.isPending}
                    className="w-full"
                    data-testid="button-create-group"
                  >
                    Create Group
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loadingConversations ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No conversations yet</p>
            <p className="text-sm">Start a new chat to get started</p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-muted transition-colors ${
                selectedConversation?.id === conversation.id ? "bg-muted" : ""
              }`}
              onClick={() => {
                setSelectedConversation(conversation);
                setIsMobileViewingConvo(true);
              }}
              data-testid={`conversation-item-${conversation.id}`}
            >
              <Avatar className="h-12 w-12">
                <AvatarFallback>{getConversationInitials(conversation)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{getConversationName(conversation)}</span>
                  {conversation.lastMessage && (
                    <span className="text-xs text-muted-foreground">
                      {formatMessageTime(conversation.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground truncate">
                    {typingUsers.get(conversation.id) ? (
                      <span className="text-primary italic">typing...</span>
                    ) : conversation.lastMessage ? (
                      <>
                        {conversation.lastMessage.sender?.id === user?.id ? "You: " : ""}
                        {conversation.lastMessage.content}
                      </>
                    ) : (
                      "No messages yet"
                    )}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <Badge variant="default" className="ml-2">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );

  const ChatView = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsMobileViewingConvo(false)}
          data-testid="button-back-to-list"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {selectedConversation && (
          <>
            <Avatar className="h-10 w-10">
              <AvatarFallback>{getConversationInitials(selectedConversation)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{getConversationName(selectedConversation)}</h3>
              {selectedConversation.isGroup && (
                <p className="text-xs text-muted-foreground">
                  {selectedConversation.members.length} members
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        {loadingMessages ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-2 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isOwn = message.senderId === user?.id;
              const showAvatar = !isOwn && (index === 0 || messages[index - 1].senderId !== message.senderId);
              
              return (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${message.id}`}
                >
                  {!isOwn && showAvatar && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {message.sender?.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  {!isOwn && !showAvatar && <div className="w-8" />}
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {!isOwn && showAvatar && selectedConversation?.isGroup && (
                      <p className="text-xs font-medium mb-1 opacity-70">{message.sender?.name}</p>
                    )}
                    <p className="break-words">{message.content}</p>
                    <p className={`text-xs mt-1 ${isOwn ? "opacity-70" : "text-muted-foreground"}`}>
                      {format(new Date(message.createdAt), "HH:mm")}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {typingUsers.get(selectedConversation?.id || "") && (
        <div className="px-4 py-2 text-sm text-muted-foreground italic">
          {typingUsers.get(selectedConversation?.id || "")} is typing...
        </div>
      )}

      <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
        <Input
          placeholder="Type a message..."
          value={messageInput}
          onChange={(e) => {
            setMessageInput(e.target.value);
            handleTyping();
          }}
          className="flex-1"
          data-testid="input-message"
        />
        <Button type="submit" disabled={!messageInput.trim()} data-testid="button-send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <MessageCircle className="h-16 w-16 mb-4 opacity-50" />
      <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
      <p className="text-sm">Choose from your existing conversations or start a new one</p>
    </div>
  );

  return (
    <div className="h-[calc(100vh-8rem)]">
      <Card className="h-full overflow-hidden">
        <div className="flex h-full">
          <div className={`w-full md:w-80 lg:w-96 border-r ${isMobileViewingConvo ? "hidden md:flex md:flex-col" : "flex flex-col"}`}>
            <ConversationList />
          </div>
          <div className={`flex-1 ${!isMobileViewingConvo && !selectedConversation ? "hidden md:flex md:flex-col" : isMobileViewingConvo ? "flex flex-col" : "hidden md:flex md:flex-col"}`}>
            {selectedConversation ? <ChatView /> : <EmptyState />}
          </div>
        </div>
      </Card>
    </div>
  );
}
