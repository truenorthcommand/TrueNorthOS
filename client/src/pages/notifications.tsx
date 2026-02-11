import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Trash2, Filter, RefreshCw, Briefcase, MessageCircle, Receipt, Truck, Settings, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";

interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  read: boolean;
  metadata: any;
  link_url: string | null;
  email_sent: boolean;
  created_at: string;
}

const categoryConfig: Record<string, { label: string; icon: any; color: string }> = {
  jobs: { label: "Jobs", icon: Briefcase, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  messages: { label: "Messages", icon: MessageCircle, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  expenses: { label: "Expenses", icon: Receipt, color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  fleet: { label: "Fleet", icon: Truck, color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  system: { label: "System", icon: Settings, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
};

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/notifications?limit=${limit}&offset=${offset}`;
      if (categoryFilter !== "all") url += `&category=${categoryFilter}`;
      if (readFilter !== "all") url += `&read=${readFilter === "read" ? "true" : "false"}`;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setNotifications(data.notifications);
      setTotal(data.total);
      setUnread(data.unread);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [offset, categoryFilter, readFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
      setNotifications(prev => prev.filter(n => n.id !== id));
      setTotal(prev => prev - 1);
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const clearRead = async () => {
    try {
      const res = await fetch("/api/notifications", { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (data.deleted > 0) {
        fetchNotifications();
      }
    } catch (error) {
      console.error("Failed to clear read:", error);
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link_url) {
      const url = notification.link_url.startsWith('/app/') 
        ? notification.link_url.replace('/app/', '/') 
        : notification.link_url;
      setLocation(url);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl" data-testid="notifications-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Bell className="h-6 w-6" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-notification-summary">
            {unread > 0 ? `${unread} unread` : "All caught up"} · {total} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchNotifications} data-testid="button-refresh-notifications">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} data-testid="button-mark-all-read">
              <CheckCheck className="h-4 w-4 mr-1" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-[150px]" data-testid="select-category-filter">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="jobs">Jobs</SelectItem>
            <SelectItem value="messages">Messages</SelectItem>
            <SelectItem value="expenses">Expenses</SelectItem>
            <SelectItem value="fleet">Fleet</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>

        <Select value={readFilter} onValueChange={(v) => { setReadFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-[130px]" data-testid="select-read-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>

        {notifications.some(n => n.read) && (
          <Button variant="ghost" size="sm" onClick={clearRead} className="text-muted-foreground" data-testid="button-clear-read">
            <Trash2 className="h-4 w-4 mr-1" /> Clear Read
          </Button>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading notifications...
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center" data-testid="empty-notifications">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No notifications to show</p>
            <p className="text-xs text-muted-foreground mt-1">
              {categoryFilter !== "all" || readFilter !== "all" ? "Try adjusting your filters" : "You're all caught up!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const config = categoryConfig[notification.category] || categoryConfig.system;
            const Icon = config.icon;

            return (
              <Card
                key={notification.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${!notification.read ? "border-l-4 border-l-primary bg-primary/5" : ""}`}
                onClick={() => handleNotificationClick(notification)}
                data-testid={`card-notification-${notification.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className={`text-sm font-medium truncate ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {config.label}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {formatTime(notification.created_at)}
                            </span>
                            {notification.email_sent && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                Emailed
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => markAsRead(notification.id)}
                              data-testid={`button-mark-read-${notification.id}`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteNotification(notification.id)}
                            data-testid={`button-delete-notification-${notification.id}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {total > limit && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            data-testid="button-prev-page"
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">
            {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
            data-testid="button-next-page"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
