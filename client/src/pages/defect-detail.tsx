import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertTriangle, User, Clock, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import type { DefectWithDetails, DefectUpdate, User as UserType } from "@shared/schema";

export default function DefectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [newComment, setNewComment] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: defect, isLoading: defectLoading } = useQuery<DefectWithDetails>({
    queryKey: [`/api/fleet/defects/${id}`],
  });

  const { data: history = [] } = useQuery<(DefectUpdate & { user: Pick<UserType, 'id' | 'name'> })[]>({
    queryKey: [`/api/fleet/defects/${id}/history`],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const updateDefectMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetch(`/api/fleet/defects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update defect");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fleet/defects/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/fleet/defects/${id}/history`] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/defects"] });
      toast({ title: "Updated", description: "Defect updated successfully" });
      setNewStatus("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      const res = await fetch(`/api/fleet/defects/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ comment }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add comment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fleet/defects/${id}/history`] });
      toast({ title: "Comment added" });
      setNewComment("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleStatusChange = (status: string) => {
    setNewStatus(status);
    updateDefectMutation.mutate({ status });
  };

  const handleAssign = (userId: string) => {
    updateDefectMutation.mutate({ assignedToId: userId });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "major": return "bg-orange-500";
      case "minor": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge variant="destructive">Open</Badge>;
      case "in_progress": return <Badge className="bg-blue-500">In Progress</Badge>;
      case "resolved": return <Badge className="bg-green-500">Resolved</Badge>;
      case "closed": return <Badge variant="secondary">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (defectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!defect) {
    return (
      <div className="container mx-auto p-4">
        <p>Defect not found</p>
        <Button onClick={() => setLocation("/fleet")}>Back to Fleet</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 pb-24 md:pb-4 max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/fleet")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Defect Report</h1>
            {getStatusBadge(defect.status)}
            <Badge className={`${getSeverityColor(defect.severity)} capitalize`}>
              {defect.severity}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {defect.vehicle?.registration} - {defect.category.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Defect Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Vehicle</Label>
              <p className="font-medium">
                {defect.vehicle?.registration} - {defect.vehicle?.make} {defect.vehicle?.model}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Category</Label>
              <p className="font-medium capitalize">{defect.category.replace(/_/g, " ")}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Description</Label>
              <p className="font-medium">{defect.description}</p>
            </div>
            {defect.vehicleOffRoad && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="text-red-600 dark:text-red-400 font-medium">Vehicle is OFF ROAD</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Assignment & Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Reported By</Label>
              <p className="font-medium">{defect.reportedBy?.name || "Unknown"}</p>
              <p className="text-sm text-muted-foreground">
                {defect.createdAt ? format(new Date(defect.createdAt), "dd/MM/yyyy HH:mm") : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Select value={defect.assignedToId || ""} onValueChange={handleAssign}>
                <SelectTrigger data-testid="select-assign">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={defect.status} onValueChange={handleStatusChange} disabled={updateDefectMutation.isPending}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {defect.resolvedAt && (
              <div>
                <Label className="text-sm text-muted-foreground">Resolved At</Label>
                <p className="font-medium">{format(new Date(defect.resolvedAt), "dd/MM/yyyy HH:mm")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Activity & Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">No activity yet</p>
            ) : (
              history.map((update) => (
                <div key={update.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{update.user?.name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">
                        {update.createdAt ? format(new Date(update.createdAt), "dd/MM/yyyy HH:mm") : ""}
                      </span>
                    </div>
                    {update.statusChange && (
                      <p className="text-sm text-blue-500">
                        Changed status to <span className="capitalize font-medium">{update.statusChange.replace(/_/g, " ")}</span>
                      </p>
                    )}
                    {update.comment && <p className="text-sm mt-1">{update.comment}</p>}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>Add Comment</Label>
            <Textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              data-testid="input-comment"
            />
            <Button 
              onClick={handleAddComment} 
              disabled={!newComment.trim() || addCommentMutation.isPending}
              data-testid="button-add-comment"
            >
              {addCommentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Comment
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
