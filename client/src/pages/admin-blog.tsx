import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ImagePlus, Loader2 } from "lucide-react";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  author: string;
  coverImage: string | null;
  readTime: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const categories = ["Operations", "Finance", "Technology", "Compliance", "Fleet", "Digital Transformation"];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

export default function AdminBlog() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<BlogPost | null>(null);
  const [uploading, setUploading] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    category: "Operations",
    author: "",
    excerpt: "",
    content: "",
    readTime: "5 min read",
    coverImage: "" as string | null,
    status: "draft",
    publishedAt: null as string | null,
  });

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/admin/blog-posts"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (editingPost) {
        return apiRequest("PUT", `/api/admin/blog-posts/${editingPost.id}`, data);
      }
      return apiRequest("POST", "/api/admin/blog-posts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog-posts"] });
      toast({ title: editingPost ? "Post updated" : "Post created" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Failed to save post", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/blog-posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog-posts"] });
      toast({ title: "Post deleted" });
      setDeleteDialogOpen(false);
      setDeletingPost(null);
    },
    onError: () => {
      toast({ title: "Failed to delete post", variant: "destructive" });
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingPost(null);
    setForm({
      title: "",
      slug: "",
      category: "Operations",
      author: "",
      excerpt: "",
      content: "",
      readTime: "5 min read",
      coverImage: null,
      status: "draft",
      publishedAt: null,
    });
  }

  function openNew() {
    setEditingPost(null);
    setForm({
      title: "",
      slug: "",
      category: "Operations",
      author: "",
      excerpt: "",
      content: "",
      readTime: "5 min read",
      coverImage: null,
      status: "draft",
      publishedAt: null,
    });
    setDialogOpen(true);
  }

  function openEdit(post: BlogPost) {
    setEditingPost(post);
    setForm({
      title: post.title,
      slug: post.slug,
      category: post.category,
      author: post.author,
      excerpt: post.excerpt,
      content: post.content,
      readTime: post.readTime,
      coverImage: post.coverImage,
      status: post.status,
      publishedAt: post.publishedAt,
    });
    setDialogOpen(true);
  }

  function handleTitleChange(title: string) {
    setForm((f) => ({
      ...f,
      title,
      slug: editingPost ? f.slug : slugify(title),
    }));
  }

  async function uploadImage(file: File): Promise<string | null> {
    try {
      setUploading(true);
      const uploadRes = await fetch("/api/admin/blog-posts/upload-image", {
        method: "POST",
        credentials: "include",
      });
      const { uploadURL, objectPath } = await uploadRes.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      return objectPath;
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleCoverImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadImage(file);
    if (path) {
      setForm((f) => ({ ...f, coverImage: path }));
    }
  }

  async function handleContentImageUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const path = await uploadImage(file);
      if (path && contentRef.current) {
        const textarea = contentRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = form.content;
        const imgTag = `<img src="${path}" alt="${file.name}" style="max-width:100%" />`;
        const newContent = text.substring(0, start) + imgTag + text.substring(end);
        setForm((f) => ({ ...f, content: newContent }));
      }
    };
    input.click();
  }

  function handleSave() {
    if (!form.title || !form.slug || !form.author || !form.excerpt) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    const data = { ...form };
    if (data.status === "published" && !data.publishedAt) {
      data.publishedAt = new Date().toISOString();
    }
    saveMutation.mutate(data);
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Blog Manager</h1>
          <p className="text-muted-foreground text-sm" data-testid="text-page-subtitle">Create and manage blog posts</p>
        </div>
        <Button onClick={openNew} data-testid="button-new-post">
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground" data-testid="text-empty-state">No blog posts yet. Click "New Post" to create one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <Card key={post.id} data-testid={`card-blog-post-${post.id}`}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate" data-testid={`text-post-title-${post.id}`}>{post.title}</h3>
                    <Badge variant={post.status === "published" ? "default" : "secondary"} data-testid={`badge-status-${post.id}`}>
                      {post.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span data-testid={`text-post-category-${post.id}`}>{post.category}</span>
                    <span data-testid={`text-post-author-${post.id}`}>{post.author}</span>
                    <span data-testid={`text-post-date-${post.id}`}>
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString()
                        : new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button variant="outline" size="sm" onClick={() => openEdit(post)} data-testid={`button-edit-${post.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setDeletingPost(post); setDeleteDialogOpen(true); }}
                    data-testid={`button-delete-${post.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingPost ? "Edit Blog Post" : "New Blog Post"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Post title"
                data-testid="input-title"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Slug *</label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="post-slug"
                data-testid="input-slug"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Author *</label>
                <Input
                  value={form.author}
                  onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                  placeholder="Author name"
                  data-testid="input-author"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Excerpt *</label>
              <Textarea
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                placeholder="Brief summary of the post"
                rows={3}
                data-testid="input-excerpt"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Read Time</label>
              <Input
                value={form.readTime}
                onChange={(e) => setForm((f) => ({ ...f, readTime: e.target.value }))}
                placeholder="5 min read"
                data-testid="input-read-time"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Cover Image</label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageUpload}
                  disabled={uploading}
                  data-testid="input-cover-image"
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {form.coverImage && (
                <div className="mt-2">
                  <img src={form.coverImage} alt="Cover preview" className="max-h-40 rounded border" data-testid="img-cover-preview" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Content (HTML)</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleContentImageUpload}
                  disabled={uploading}
                  data-testid="button-insert-image"
                >
                  <ImagePlus className="h-4 w-4 mr-1" />
                  Insert Image
                </Button>
              </div>
              <Textarea
                ref={contentRef}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Write your article content here (HTML supported)"
                rows={12}
                className="font-mono text-sm"
                data-testid="input-content"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Status</label>
              <Select value={form.status} onValueChange={(v) => {
                setForm((f) => ({
                  ...f,
                  status: v,
                  publishedAt: v === "published" && !f.publishedAt ? new Date().toISOString() : f.publishedAt,
                }));
              }}>
                <SelectTrigger className="w-40" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                data-testid="button-save"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingPost ? "Update Post" : "Create Post"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-delete-dialog-title">Delete Blog Post</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground" data-testid="text-delete-confirmation">
            Are you sure you want to delete "{deletingPost?.title}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingPost && deleteMutation.mutate(deletingPost.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
