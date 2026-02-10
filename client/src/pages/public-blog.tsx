import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, ArrowRight, Tag, Mail, Loader2 } from "lucide-react";

type Category = "All" | "Operations" | "Finance" | "Technology" | "Compliance" | "Fleet" | "Digital Transformation";

const categories: Category[] = ["All", "Operations", "Finance", "Technology", "Compliance", "Fleet", "Digital Transformation"];

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

const categoryColors: Record<string, string> = {
  Operations: "bg-blue-100 text-blue-800",
  Finance: "bg-green-100 text-green-800",
  Technology: "bg-purple-100 text-purple-800",
  Compliance: "bg-orange-100 text-orange-800",
  Fleet: "bg-red-100 text-red-800",
  "Digital Transformation": "bg-teal-100 text-teal-800",
};

export default function PublicBlog() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog-posts"],
    queryFn: async () => {
      const res = await fetch("/api/blog-posts", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredPosts = activeCategory === "All"
    ? posts
    : posts.filter((post) => post.category === activeCategory);

  return (
    <PublicLayout>
      <section
        className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20 md:py-28 px-4"
        data-testid="section-blog-hero"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight mb-6"
            data-testid="text-blog-heading"
          >
            TrueNorth OS Blog
          </h1>
          <p
            className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto"
            data-testid="text-blog-subheading"
          >
            Insights, tips, and best practices for UK trade and field service businesses
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4" data-testid="section-blog-posts">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-10 justify-center" data-testid="filter-categories">
            {categories.map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(category)}
                data-testid={`filter-${category.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Tag className="h-3.5 w-3.5 mr-1.5" />
                {category}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16" data-testid="text-empty-state">
              <p className="text-xl font-semibold text-muted-foreground mb-2">Coming Soon</p>
              <p className="text-muted-foreground">We're working on new articles. Check back soon!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {filteredPosts.map((post) => (
                <Card
                  key={post.id}
                  className="border hover:shadow-lg hover:border-primary/30 transition-all overflow-hidden"
                  data-testid={`card-post-${post.id}`}
                >
                  {post.coverImage && (
                    <div className="w-full h-48 overflow-hidden">
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover"
                        data-testid={`img-cover-${post.id}`}
                      />
                    </div>
                  )}
                  <CardContent className="pt-6">
                    <Badge
                      variant="secondary"
                      className={categoryColors[post.category] || ""}
                      data-testid={`badge-category-${post.id}`}
                    >
                      {post.category}
                    </Badge>

                    <h3
                      className="text-xl font-semibold mt-3 mb-2"
                      data-testid={`text-title-${post.id}`}
                    >
                      {post.title}
                    </h3>

                    <p
                      className="text-sm text-muted-foreground mb-4"
                      data-testid={`text-excerpt-${post.id}`}
                    >
                      {post.excerpt}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1" data-testid={`text-author-${post.id}`}>
                        <User className="h-3.5 w-3.5" />
                        {post.author}
                      </span>
                      <span className="flex items-center gap-1" data-testid={`text-date-${post.id}`}>
                        <Calendar className="h-3.5 w-3.5" />
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : ""}
                      </span>
                      <span className="flex items-center gap-1" data-testid={`text-readtime-${post.id}`}>
                        <Clock className="h-3.5 w-3.5" />
                        {post.readTime}
                      </span>
                    </div>

                    <Link href="#">
                      <Button
                        variant="link"
                        className="p-0 h-auto text-primary font-medium"
                        data-testid={`link-read-more-${post.id}`}
                      >
                        Read More
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        className="py-16 md:py-24 bg-slate-50 px-4"
        data-testid="section-newsletter"
      >
        <div className="max-w-xl mx-auto text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h2
            className="text-3xl font-bold tracking-tight mb-3"
            data-testid="text-newsletter-heading"
          >
            Stay Updated
          </h2>
          <p
            className="text-lg text-muted-foreground mb-8"
            data-testid="text-newsletter-subheading"
          >
            Get the latest insights delivered to your inbox
          </p>
          <div className="flex gap-2 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="you@example.com"
              className="flex-1"
              data-testid="input-newsletter-email"
            />
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-subscribe"
            >
              Subscribe
            </Button>
          </div>
          <p
            className="text-xs text-muted-foreground mt-3"
            data-testid="text-newsletter-note"
          >
            No spam, unsubscribe anytime
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
