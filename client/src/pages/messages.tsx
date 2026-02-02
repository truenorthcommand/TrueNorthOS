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
import { 
  MessageCircle, 
  Send, 
  Plus, 
  Users, 
  Search, 
  ArrowLeft, 
  Loader2, 
  Camera,
  Image as ImageIcon,
  X,
  Check,
  CheckCheck
} from "lucide-react";

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
  imageUrl?: string | null;
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
  const [isMobileViewingConvo, setIsMobileViewingConvo] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/messages/conversations"],
    refetchInterval: 30000,
  });

  const { data: availableUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/messages/users"],
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/messages/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
    refetchInterval: 10000,
    queryFn: async () => {
      if (!selectedConversation) return [];
      try {
        const res = await fetch(`/api/messages/conversations/${selectedConversation.id}/messages`);
        if (!res.ok) throw new Error("Failed to fetch messages");
        return res.json();
      } catch (error) {
        console.error("Error fetching messages:", error);
        return [];
      }
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
      setGroupName("");
      setSelectedUsers([]);
      setIsMobileViewingConvo(true);
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, content, imageUrl }: { conversationId: string; content: string; imageUrl?: string }) => {
      const res = await fetch(`/api/messages/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, imageUrl }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (newMessage) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations", selectedConversation?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "chat_message",
          conversationId: selectedConversation?.id,
          message: newMessage,
        }));
      }
    },
  });

  const connectWebSocket = useCallback(() => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/notifications`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        // Only reconnect if not unmounted
        if (!isUnmountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              connectWebSocket();
            }
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setWsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "chat_message") {
            queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations", data.conversationId, "messages"] });
            queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
          }
          
          if (data.type === "typing") {
            setTypingUsers(prev => {
              const newMap = new Map(prev);
              if (data.isTyping) {
                newMap.set(data.conversationId, data.userName);
              } else {
                newMap.delete(data.conversationId);
              }
              return newMap;
            });
          }
        } catch (e) {
          console.error("WebSocket message parse error:", e);
        }
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      if (!isUnmountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            connectWebSocket();
          }
        }, 3000);
      }
    }
  }, [queryClient]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connectWebSocket();

    return () => {
      isUnmountedRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (selectedConversation) {
      fetch(`/api/messages/conversations/${selectedConversation.id}/read`, { method: "POST" })
        .catch(err => console.error("Error marking as read:", err));
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be less than 5MB");
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage) return null;
    
    setIsUploading(true);
    try {
      // Get presigned upload URL
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedImage.name,
          size: selectedImage.size,
          contentType: selectedImage.type,
        }),
      });
      
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();
      
      // Upload file directly to presigned URL
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: selectedImage,
        headers: {
          "Content-Type": selectedImage.type,
        },
      });
      
      if (!uploadRes.ok) throw new Error("Upload failed");
      
      // Return the object path as the image URL
      return objectPath;
    } catch (error) {
      console.error("Image upload error:", error);
      alert("Failed to upload image. Please try again.");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && !selectedImage) || !selectedConversation) return;

    let imageUrl: string | undefined;
    
    if (selectedImage) {
      const uploadedUrl = await uploadImage();
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else if (!messageInput.trim()) {
        return;
      }
    }

    sendMessage.mutate({
      conversationId: selectedConversation.id,
      content: messageInput.trim() || (imageUrl ? "📷 Photo" : ""),
      imageUrl,
    });
    
    setMessageInput("");
    clearImage();
  }, [messageInput, selectedImage, selectedConversation, sendMessage]);

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

  const handleBackToList = () => {
    setIsMobileViewingConvo(false);
    setSelectedConversation(null);
  };

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

  return (
    <div className="h-[calc(100vh-8rem)]">
      <Card className="h-full overflow-hidden border-0 shadow-lg">
        <div className="flex h-full">
          {/* Conversation List */}
          <div className={`w-full md:w-80 lg:w-96 border-r border-border bg-muted ${isMobileViewingConvo ? "hidden md:flex md:flex-col" : "flex flex-col"}`}>
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-border bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <MessageCircle className="h-6 w-6 text-[#25D366]" />
                    Messages
                  </h2>
                  <div className="flex gap-2">
                    <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-[#25D366] hover:bg-[#20BD5A] text-white" data-testid="button-new-chat">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
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
                                  <AvatarFallback className="bg-[#25D366] text-white">{u.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</AvatarFallback>
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
                      <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
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
                              onKeyDown={(e) => e.stopPropagation()}
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
                            className="w-full bg-[#25D366] hover:bg-[#20BD5A]"
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
                    onKeyDown={(e) => e.stopPropagation()}
                    className="pl-10 bg-muted border-0"
                    data-testid="input-search-conversations"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                {loadingConversations ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[#25D366]" />
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="font-medium">No conversations yet</p>
                    <p className="text-sm">Start a new conversation to chat with your team</p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-muted transition-colors border-b border-border ${
                        selectedConversation?.id === conversation.id ? "bg-muted" : "bg-card"
                      }`}
                      onClick={() => {
                        setSelectedConversation(conversation);
                        setIsMobileViewingConvo(true);
                      }}
                      data-testid={`conversation-item-${conversation.id}`}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-[#25D366] text-white font-medium">
                          {getConversationInitials(conversation)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground truncate">{getConversationName(conversation)}</span>
                          {conversation.lastMessage && (
                            <span className="text-xs text-muted-foreground">
                              {formatMessageTime(conversation.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-sm text-muted-foreground truncate">
                            {typingUsers.get(conversation.id) ? (
                              <span className="text-[#25D366] italic">typing...</span>
                            ) : conversation.lastMessage ? (
                              <>
                                {conversation.lastMessage.sender?.id === user?.id && (
                                  <CheckCheck className="inline h-4 w-4 mr-1 text-blue-500" />
                                )}
                                {conversation.lastMessage.imageUrl ? "📷 Photo" : conversation.lastMessage.content}
                              </>
                            ) : (
                              "No messages yet"
                            )}
                          </p>
                          {conversation.unreadCount > 0 && (
                            <Badge className="ml-2 bg-[#25D366] text-white rounded-full h-5 min-w-[20px] flex items-center justify-center">
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
          </div>

          {/* Chat View */}
          <div className={`flex-1 flex flex-col ${!isMobileViewingConvo && !selectedConversation ? "hidden md:flex" : isMobileViewingConvo ? "flex" : "hidden md:flex"}`}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-3 border-b border-border bg-muted flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-10 w-10"
                    onClick={handleBackToList}
                    data-testid="button-back-to-list"
                  >
                    <ArrowLeft className="h-6 w-6" />
                  </Button>
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-[#25D366] text-white">
                      {getConversationInitials(selectedConversation)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{getConversationName(selectedConversation)}</h3>
                    <p className="text-xs text-muted-foreground">
                      {typingUsers.get(selectedConversation.id) ? (
                        <span className="text-[#25D366]">typing...</span>
                      ) : selectedConversation.isGroup ? (
                        `${selectedConversation.members.length} members`
                      ) : (
                        "Online"
                      )}
                    </p>
                  </div>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 p-4" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23e5ded8\" fill-opacity=\"0.2\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')", backgroundColor: "#ECE5DD" }}>
                  {loadingMessages ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-[#25D366]" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <div className="bg-card/80 rounded-lg p-6 text-center">
                        <MessageCircle className="h-12 w-12 mx-auto mb-3 text-[#25D366] opacity-60" />
                        <p className="font-medium">No messages yet</p>
                        <p className="text-sm">Send a message to start the conversation</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {messages.map((message, index) => {
                        const isOwn = message.senderId === user?.id;
                        const showAvatar = !isOwn && (index === 0 || messages[index - 1].senderId !== message.senderId);
                        const showName = !isOwn && selectedConversation?.isGroup && showAvatar;
                        
                        return (
                          <div
                            key={message.id}
                            className={`flex items-end gap-1 ${isOwn ? "justify-end" : "justify-start"}`}
                            data-testid={`message-${message.id}`}
                          >
                            {!isOwn && showAvatar && (
                              <Avatar className="h-7 w-7 mb-1">
                                <AvatarFallback className="text-xs bg-muted-foreground text-card">
                                  {message.sender?.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            {!isOwn && !showAvatar && <div className="w-7" />}
                            <div
                              className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm relative ${
                                isOwn
                                  ? "bg-[#DCF8C6] dark:bg-[#005C4B] rounded-br-none"
                                  : "bg-card rounded-bl-none"
                              }`}
                            >
                              {showName && (
                                <p className="text-xs font-semibold text-[#25D366] mb-1">{message.sender?.name}</p>
                              )}
                              {message.imageUrl && (
                                <div className="mb-2">
                                  <img 
                                    src={message.imageUrl} 
                                    alt="Shared image" 
                                    className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer"
                                    onClick={() => window.open(message.imageUrl!, '_blank')}
                                  />
                                </div>
                              )}
                              {message.content && message.content !== "📷 Photo" && (
                                <p className="break-words text-foreground text-[15px]">{message.content}</p>
                              )}
                              <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? "text-muted-foreground" : "text-muted-foreground"}`}>
                                <span className="text-[11px]">
                                  {format(new Date(message.createdAt), "HH:mm")}
                                </span>
                                {isOwn && (
                                  <CheckCheck className="h-4 w-4 text-blue-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Image Preview */}
                {imagePreview && (
                  <div className="p-3 border-t border-border bg-muted">
                    <div className="relative inline-block">
                      <img src={imagePreview} alt="Preview" className="h-20 rounded-lg" />
                      <button
                        onClick={clearImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
                        data-testid="button-remove-image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-muted flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={handleImageSelect}
                    className="hidden"
                    data-testid="input-camera"
                  />
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => cameraInputRef.current?.click()}
                    className="text-muted-foreground hover:text-[#25D366]"
                    data-testid="button-camera"
                  >
                    <Camera className="h-5 w-5" />
                  </Button>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-muted-foreground hover:text-[#25D366]"
                    data-testid="button-attach-image"
                  >
                    <ImageIcon className="h-5 w-5" />
                  </Button>
                  
                  <Input
                    placeholder="Type a message"
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="flex-1 bg-card rounded-full border-0 shadow-sm"
                    data-testid="input-message"
                  />
                  
                  <Button 
                    type="submit" 
                    size="icon"
                    disabled={(!messageInput.trim() && !selectedImage) || isUploading || sendMessage.isPending}
                    className="bg-[#25D366] hover:bg-[#20BD5A] rounded-full h-10 w-10"
                    data-testid="button-send"
                  >
                    {isUploading || sendMessage.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-muted text-muted-foreground">
                <div className="text-center p-8">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                    <MessageCircle className="h-12 w-12 text-[#25D366]" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">TrueNorth Messages</h3>
                  <p className="text-sm max-w-xs">Send and receive messages with your team. Select a conversation or start a new one.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
