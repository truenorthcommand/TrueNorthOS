import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  ClipboardCheck, 
  Search, 
  Flame, 
  Zap, 
  Plus,
  Pencil,
  Trash2,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type AiAdvisor = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  systemPrompt: string;
  isActive: boolean;
};

const iconOptions = [
  { value: "Bot", label: "Bot", icon: Bot },
  { value: "ClipboardCheck", label: "Clipboard Check", icon: ClipboardCheck },
  { value: "Search", label: "Search", icon: Search },
  { value: "Flame", label: "Flame", icon: Flame },
  { value: "Zap", label: "Zap", icon: Zap },
];

const categoryOptions = [
  { value: "general", label: "General" },
  { value: "quality", label: "Quality" },
  { value: "sourcing", label: "Sourcing" },
  { value: "specialist", label: "Specialist" },
];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardCheck,
  Search,
  Flame,
  Zap,
  Bot,
};

function AdvisorIcon({ icon, className }: { icon: string; className?: string }) {
  const IconComponent = iconMap[icon] || Bot;
  return <IconComponent className={className} />;
}

export default function AdminAdvisors() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAdvisor, setEditingAdvisor] = useState<AiAdvisor | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: "Bot",
    category: "general",
    systemPrompt: "",
    isActive: true,
  });

  const { data: advisors = [], isLoading } = useQuery<AiAdvisor[]>({
    queryKey: ["/api/ai-advisors/all"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/ai-advisors", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-advisors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-advisors/all"] });
      toast({ title: "Success", description: "Technical Advisor created successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const response = await apiRequest("PATCH", `/api/ai-advisors/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-advisors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-advisors/all"] });
      toast({ title: "Success", description: "Technical Advisor updated successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai-advisors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-advisors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-advisors/all"] });
      toast({ title: "Success", description: "Technical Advisor deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      icon: "Bot",
      category: "general",
      systemPrompt: "",
      isActive: true,
    });
    setEditingAdvisor(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (advisor: AiAdvisor) => {
    setEditingAdvisor(advisor);
    setFormData({
      name: advisor.name,
      description: advisor.description,
      icon: advisor.icon,
      category: advisor.category,
      systemPrompt: advisor.systemPrompt,
      isActive: advisor.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAdvisor) {
      updateMutation.mutate({ id: editingAdvisor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggleActive = (advisor: AiAdvisor) => {
    updateMutation.mutate({
      id: advisor.id,
      data: { isActive: !advisor.isActive },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Technical Advisor Settings</h1>
          <p className="text-muted-foreground">Manage advisor configurations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-advisor">
              <Plus className="h-4 w-4 mr-2" />
              Add Advisor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAdvisor ? "Edit Technical Advisor" : "Create Technical Advisor"}</DialogTitle>
              <DialogDescription>
                Configure the advisor's personality and capabilities
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Electrical Expert"
                    required
                    data-testid="input-advisor-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <Select
                    value={formData.icon}
                    onValueChange={(value) => setFormData({ ...formData, icon: value })}
                  >
                    <SelectTrigger data-testid="select-icon">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.icon className="h-4 w-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of what this advisor does..."
                  rows={2}
                  required
                  data-testid="input-advisor-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  placeholder="Enter the system prompt that defines the advisor's behavior and expertise..."
                  rows={10}
                  required
                  className="font-mono text-sm"
                  data-testid="input-system-prompt"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-active"
                />
                <Label htmlFor="isActive">Active (visible to users)</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-advisor"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingAdvisor ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {advisors.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Bot className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Technical Advisors</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Create your first advisor to get started
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Advisor
              </Button>
            </CardContent>
          </Card>
        ) : (
          advisors.map((advisor) => (
            <Card key={advisor.id} data-testid={`card-admin-advisor-${advisor.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${advisor.isActive ? 'bg-primary/10' : 'bg-muted'}`}>
                      <AdvisorIcon icon={advisor.icon} className={`h-6 w-6 ${advisor.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {advisor.name}
                        {!advisor.isActive && (
                          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground capitalize">{advisor.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={advisor.isActive}
                      onCheckedChange={() => handleToggleActive(advisor)}
                      data-testid={`switch-toggle-${advisor.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(advisor)}
                      data-testid={`button-edit-${advisor.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this advisor?")) {
                          deleteMutation.mutate(advisor.id);
                        }
                      }}
                      data-testid={`button-delete-${advisor.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-3">{advisor.description}</CardDescription>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View System Prompt
                  </summary>
                  <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {advisor.systemPrompt}
                  </pre>
                </details>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
