import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Copy, Plus, Edit, Trash, X, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Snippet } from "@shared/schema";

const CATEGORIES = [
  { value: "greetings", label: "Greetings" },
  { value: "pricing", label: "Pricing" },
  { value: "signatures", label: "Signatures" },
  { value: "responses", label: "Responses" },
  { value: "general", label: "General" },
];

export function SnippetWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [editSnippet, setEditSnippet] = useState<Snippet | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general",
    shortcut: "",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: snippets = [], isLoading } = useQuery<Snippet[]>({
    queryKey: ["/api/snippets"],
    queryFn: async () => {
      const res = await fetch("/api/snippets", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch snippets");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create snippet");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      resetForm();
      toast({ title: "Snippet created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & typeof formData) => {
      const res = await fetch(`/api/snippets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update snippet");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      resetForm();
      toast({ title: "Snippet updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/snippets/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete snippet");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      toast({ title: "Snippet deleted" });
    },
  });

  const resetForm = () => {
    setEditSnippet(null);
    setFormData({ title: "", content: "", category: "general", shortcut: "" });
  };

  const handleCopy = async (content: string, title: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({ title: `"${title}" copied to clipboard` });
      setIsExpanded(false);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleEdit = (snippet: Snippet) => {
    setEditSnippet(snippet);
    setFormData({
      title: snippet.title,
      content: snippet.content,
      category: snippet.category,
      shortcut: snippet.shortcut || "",
    });
  };

  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({ title: "Title and content are required", variant: "destructive" });
      return;
    }
    
    if (editSnippet) {
      updateMutation.mutate({ id: editSnippet.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredSnippets = useMemo(() => {
    if (!searchQuery.trim()) return snippets;
    const query = searchQuery.toLowerCase();
    return snippets.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.content.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query) ||
        (s.shortcut && s.shortcut.toLowerCase().includes(query))
    );
  }, [snippets, searchQuery]);

  const groupedSnippets = useMemo(() => {
    const groups: Record<string, Snippet[]> = {};
    filteredSnippets.forEach((snippet) => {
      if (!groups[snippet.category]) {
        groups[snippet.category] = [];
      }
      groups[snippet.category].push(snippet);
    });
    return groups;
  }, [filteredSnippets]);

  const getCategoryLabel = (value: string) => 
    CATEGORIES.find((c) => c.value === value)?.label || value;

  return (
    <>
      <div className="fixed bottom-20 right-6 z-50 print:hidden" data-testid="snippet-widget">
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-14 right-0 mb-2"
            >
              <Card className="w-80 max-w-[calc(100vw-2rem)] shadow-xl" data-testid="snippet-panel">
                <div className="p-3 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">Snippets</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setIsExpanded(false)}
                      data-testid="button-close-snippets"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search snippets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-sm"
                      data-testid="input-search-snippets"
                    />
                  </div>
                </div>
                
                <ScrollArea className="h-64">
                  <div className="p-2">
                    {isLoading ? (
                      <p className="text-center text-sm text-muted-foreground py-4">Loading...</p>
                    ) : Object.keys(groupedSnippets).length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        {snippets.length === 0 ? "No snippets yet" : "No matches found"}
                      </p>
                    ) : (
                      Object.entries(groupedSnippets).map(([category, items]) => (
                        <div key={category} className="mb-3">
                          <p className="text-xs font-medium text-muted-foreground px-2 mb-1">
                            {getCategoryLabel(category)}
                          </p>
                          {items.map((snippet) => (
                            <button
                              key={snippet.id}
                              onClick={() => handleCopy(snippet.content, snippet.title)}
                              className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors group"
                              data-testid={`snippet-item-${snippet.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium truncate">{snippet.title}</span>
                                <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              {snippet.shortcut && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {snippet.shortcut}
                                </Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => {
                      setIsExpanded(false);
                      setManageDialogOpen(true);
                    }}
                    data-testid="button-manage-snippets"
                  >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Manage Snippets
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-snippets"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>

      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Snippets</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4">
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-[300px] md:h-[400px]">
                <div className="space-y-2 pr-4">
                  {snippets.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No snippets yet. Create your first one!
                    </p>
                  ) : (
                    snippets.map((snippet) => (
                      <div
                        key={snippet.id}
                        className={`p-3 rounded-lg border ${
                          editSnippet?.id === snippet.id ? "border-primary bg-accent" : ""
                        }`}
                        data-testid={`manage-snippet-${snippet.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{snippet.title}</span>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {getCategoryLabel(snippet.category)}
                              </Badge>
                              {snippet.isGlobal && (
                                <Badge variant="outline" className="text-xs shrink-0">Global</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {snippet.content}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(snippet)}
                              data-testid={`button-edit-snippet-${snippet.id}`}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(snippet.id)}
                              data-testid={`button-delete-snippet-${snippet.id}`}
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            
            <div className="md:w-64 shrink-0 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4">
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                {editSnippet ? (
                  <>
                    <Edit className="h-4 w-4" /> Edit Snippet
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> New Snippet
                  </>
                )}
              </h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="snippet-title" className="text-xs">Title</Label>
                  <Input
                    id="snippet-title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Greeting"
                    className="h-8 text-sm"
                    data-testid="input-snippet-title"
                  />
                </div>
                <div>
                  <Label htmlFor="snippet-content" className="text-xs">Content</Label>
                  <Textarea
                    id="snippet-content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="The text to insert..."
                    rows={3}
                    className="text-sm resize-none"
                    data-testid="input-snippet-content"
                  />
                </div>
                <div>
                  <Label htmlFor="snippet-category" className="text-xs">Category</Label>
                  <select
                    id="snippet-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-8 text-sm rounded-md border border-input bg-background px-3"
                    data-testid="select-snippet-category"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="snippet-shortcut" className="text-xs">Shortcut (optional)</Label>
                  <Input
                    id="snippet-shortcut"
                    value={formData.shortcut}
                    onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                    placeholder="e.g., /greet"
                    className="h-8 text-sm"
                    data-testid="input-snippet-shortcut"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            {editSnippet && (
              <Button variant="outline" onClick={resetForm} data-testid="button-cancel-edit">
                Cancel Edit
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-snippet"
            >
              {editSnippet ? "Update" : "Create"} Snippet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
