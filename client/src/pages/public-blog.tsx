import { useState } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, ArrowRight, Tag, Mail } from "lucide-react";

type Category = "All" | "Operations" | "Finance" | "Technology" | "Compliance" | "Fleet" | "Digital Transformation";

const categories: Category[] = ["All", "Operations", "Finance", "Technology", "Compliance", "Fleet", "Digital Transformation"];

const blogPosts = [
  {
    id: "reduce-no-shows",
    title: "5 Ways to Reduce No-Shows and Missed Appointments",
    category: "Operations" as Category,
    excerpt: "Missed appointments cost UK trade businesses thousands each year. From automated reminders to smarter scheduling, discover five proven strategies to keep your calendar full and your customers showing up.",
    author: "Mark Collins",
    date: "12 Feb 2026",
    readTime: "5 min read",
  },
  {
    id: "hmrc-mileage-rates",
    title: "Understanding HMRC Mileage Rates for Trade Businesses in 2026",
    category: "Finance" as Category,
    excerpt: "HMRC mileage allowance rates directly affect your bottom line. This guide breaks down the current rates, how to claim, and common mistakes trade businesses make when tracking business mileage.",
    author: "Sophie Irwin",
    date: "5 Feb 2026",
    readTime: "7 min read",
  },
  {
    id: "ai-field-service",
    title: "How AI is Transforming Field Service Management",
    category: "Technology" as Category,
    excerpt: "From intelligent job scheduling to predictive maintenance, artificial intelligence is reshaping how trade businesses operate. Learn how AI tools can save your team hours every week and improve first-time fix rates.",
    author: "Rachel Osei",
    date: "28 Jan 2026",
    readTime: "6 min read",
  },
  {
    id: "gas-safe-compliance",
    title: "A Complete Guide to Gas Safe Compliance",
    category: "Compliance" as Category,
    excerpt: "Gas Safe registration is a legal requirement for anyone working on gas appliances in the UK. This comprehensive guide covers everything from registration to record-keeping and staying audit-ready.",
    author: "Liam Harding",
    date: "21 Jan 2026",
    readTime: "8 min read",
  },
  {
    id: "fleet-management-tips",
    title: "Fleet Management Tips: Keeping Your Vans on the Road",
    category: "Fleet" as Category,
    excerpt: "Your vans are the backbone of your trade business. From daily walkaround checks to preventive maintenance schedules, these fleet management tips will help reduce downtime and extend vehicle life.",
    author: "Mark Collins",
    date: "14 Jan 2026",
    readTime: "5 min read",
  },
  {
    id: "digital-job-sheets",
    title: "Why Digital Job Sheets Are Replacing Paper",
    category: "Digital Transformation" as Category,
    excerpt: "Paper job sheets are slow, easy to lose, and impossible to search. Discover why trade businesses across the UK are switching to digital job sheets and how the transition can save you time and money.",
    author: "Sophie Irwin",
    date: "7 Jan 2026",
    readTime: "4 min read",
  },
];

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

  const filteredPosts = activeCategory === "All"
    ? blogPosts
    : blogPosts.filter((post) => post.category === activeCategory);

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

          <div className="grid md:grid-cols-2 gap-6">
            {filteredPosts.map((post) => (
              <Card
                key={post.id}
                className="border hover:shadow-lg hover:border-primary/30 transition-all"
                data-testid={`card-post-${post.id}`}
              >
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
                      {post.date}
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
