import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquarePlus, ExternalLink, Trash2, Image, X } from "lucide-react";

const CATEGORIES = [
  { value: "bug", label: "Bug", emoji: "🐛" },
  { value: "improvement", label: "Improvement", emoji: "💡" },
  { value: "feature", label: "Feature", emoji: "✨" },
  { value: "other", label: "Other", emoji: "💬" },
];

const PRIORITIES = [
  { value: "low", label: "Low", className: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "medium", label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "high", label: "High", className: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "critical", label: "Critical", className: "bg-red-100 text-red-700 border-red-300" },
];

const STATUSES = [
  { value: "new", label: "New", className: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "reviewed", label: "Reviewed", className: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "in_progress", label: "In Progress", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "resolved", label: "Resolved", className: "bg-green-100 text-green-700 border-green-300" },
  { value: "closed", label: "Closed", className: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "wont_fix", label: "Won't Fix", className: "bg-gray-100 text-gray-500 border-gray-300" },
];

function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITIES.find((x) => x.value === priority);
  if (!p) return <Badge variant="outline">{priority}</Badge>;
  return (
    <Badge variant="outline" className={`text-xs ${p.className}`}>
      {p.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find((x) => x.value === status);
  if (!s) return <Badge variant="outline">{status}</Badge>;
  return (
    <Badge variant="outline" className={`text-xs ${s.className}`}>
      {s.label}
    </Badge>
  );
}

function CategoryLabel({ category }: { category: string }) {
  const cat = CATEGORIES.find((c) => c.value === category);
  if (!cat) return <span>{category}</span>;
  return (
    <span className="text-sm font-medium">
      {cat.emoji} {cat.label}
    </span>
  );
}

export default function AdminFeedback() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  // Detail dialog
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [screenshotExpanded, setScreenshotExpanded] = useState(false);

  // Build query params
  const params = new URLSearchParams();
  if (filterStatus !== "all") params.set("status", filterStatus);
  if (filterCategory !== "all") params.set("category", filterCategory);
  if (filterPriority !== "all") params.set("priority", filterPriority);
  const queryString = params.toString();

  // Fetch feedback list
  const { data: feedbackList, isLoading } = useQuery<any[]>({
    queryKey: ["/api/feedback", queryString],
    queryFn: async () => {
      const r = await fetch(`/api/feedback${queryString ? `?${queryString}` : ""}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error('Failed to fetch feedback');
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch stats
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/feedback/stats"],
    queryFn: async () => {
      const r = await fetch("/api/feedback/stats", { credentials: "include" });
      if (!r.ok) throw new Error('Failed to fetch stats');
      return r.json();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to update");
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "Feedback updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/stats"] });
      setSelectedFeedback(null);
    },
    onError: () => {
      toast({ title: "Failed to update feedback", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/feedback/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to delete");
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "Feedback deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/stats"] });
      setSelectedFeedback(null);
    },
    onError: () => {
      toast({ title: "Failed to delete feedback", variant: "destructive" });
    },
  });

  const openDetail = (item: any) => {
    setSelectedFeedback(item);
    setEditStatus(item.status || "new");
    setEditPriority(item.priority || "medium");
    setEditNotes(item.admin_notes || "");
    setScreenshotExpanded(false);
  };

  const handleSave = () => {
    if (!selectedFeedback) return;
    updateMutation.mutate({
      id: selectedFeedback.id,
      data: {
        status: editStatus,
        priority: editPriority,
        admin_notes: editNotes,
      },
    });
  };

  const handleDelete = () => {
    if (!selectedFeedback) return;
    if (window.confirm("Are you sure you want to delete this feedback?")) {
      deleteMutation.mutate(selectedFeedback.id);
    }
  };

  const statsNew = stats?.new || 0;
  const statsInProgress = stats?.in_progress || 0;
  const statsResolved = stats?.resolved || 0;
  const statsReviewed = stats?.reviewed || 0;
  const totalOpen = statsNew + statsReviewed + statsInProgress;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <MessageSquarePlus className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Feedback Management</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{statsNew}</div>
            <p className="text-sm text-muted-foreground">New</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{statsInProgress}</div>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{statsResolved}</div>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{totalOpen}</div>
            <p className="text-sm text-muted-foreground">Total Open</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.emoji} {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Feedback List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !feedbackList || feedbackList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquarePlus className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No feedback found</p>
          <p className="text-sm mt-1">Adjust filters or wait for user submissions</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {feedbackList.map((item: any) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDetail(item)}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <CategoryLabel category={item.category} />
                  <StatusBadge status={item.status} />
                </div>

                {/* Priority */}
                <div>
                  <PriorityBadge priority={item.priority} />
                </div>

                {/* Subject */}
                <p className="font-semibold text-sm line-clamp-1">{item.subject}</p>

                {/* Description */}
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.description}
                </p>

                {/* User info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {(item.user_name || item.userName || "U").charAt(0).toUpperCase()}
                  </div>
                  <span>{item.user_name || item.userName || "Unknown"}</span>
                  {(item.user_role || item.userRole) && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {item.user_role || item.userRole}
                    </Badge>
                  )}
                </div>

                {/* Page URL */}
                {item.page && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">{item.page}</span>
                  </div>
                )}

                {/* Screenshot indicator + Date */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {item.screenshot_url ? (
                    <span className="flex items-center gap-1">
                      <Image className="h-3 w-3" /> Screenshot
                    </span>
                  ) : (
                    <span />
                  )}
                  <span>
                    {new Date(item.createdAt || item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail/Edit Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={(v) => { if (!v) setSelectedFeedback(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CategoryLabel category={selectedFeedback?.category} />
              <span className="text-base">— {selectedFeedback?.subject}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-4">
              {/* User info */}
              <div className="flex items-center gap-2 text-sm">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {(selectedFeedback.user_name || selectedFeedback.userName || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{selectedFeedback.user_name || selectedFeedback.userName || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedFeedback.user_role || selectedFeedback.userRole || "user"} · {new Date(selectedFeedback.createdAt || selectedFeedback.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{selectedFeedback.description}</p>
              </div>

              {/* Page URL */}
              {selectedFeedback.page && (
                <div className="text-sm">
                  <Label className="text-xs font-medium text-muted-foreground">Page</Label>
                  <p className="text-primary underline cursor-pointer text-xs mt-0.5">
                    {selectedFeedback.page}
                  </p>
                </div>
              )}

              {/* Screenshot */}
              {selectedFeedback.screenshot_url && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Screenshot</Label>
                  <div className="mt-1">
                    {screenshotExpanded ? (
                      <div className="relative">
                        <img
                          src={selectedFeedback.screenshot_url}
                          alt="Feedback screenshot"
                          className="w-full rounded-lg border"
                        />
                        <button
                          onClick={() => setScreenshotExpanded(false)}
                          className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80 border flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <img
                        src={selectedFeedback.screenshot_url}
                        alt="Feedback screenshot"
                        className="w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setScreenshotExpanded(true)}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Status change */}
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority change */}
              <div>
                <Label className="text-sm font-medium">Priority</Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Admin notes */}
              <div>
                <Label className="text-sm font-medium">Admin Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Internal notes about this feedback..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedFeedback(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
