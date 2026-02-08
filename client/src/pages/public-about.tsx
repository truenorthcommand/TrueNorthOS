import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wrench,
  Flag,
  Brain,
  ShieldCheck,
  ArrowRight,
  Users,
  Target,
} from "lucide-react";

const values = [
  {
    icon: Wrench,
    title: "Built for Trades",
    description:
      "Every feature is designed around the workflows of real trade businesses — plumbers, electricians, HVAC engineers, and more.",
  },
  {
    icon: Flag,
    title: "UK First",
    description:
      "VAT calculations, compliance requirements, and terminology built for the UK market from day one.",
  },
  {
    icon: Brain,
    title: "AI-Powered",
    description:
      "Smart job assignment, receipt OCR, technical advisors, and predictive analytics that learn your business.",
  },
  {
    icon: ShieldCheck,
    title: "Simple & Reliable",
    description:
      "No bloat, no steep learning curve. Reliable tools that work on-site, in the van, or in the office.",
  },
];

const team = [
  {
    name: "Mark Collins",
    role: "Co-Founder & CEO",
    background: "15 years in plumbing & heating",
  },
  {
    name: "Sophie Irwin",
    role: "Co-Founder & CTO",
    background: "Full-stack engineer, ex-BigChange",
  },
  {
    name: "Liam Harding",
    role: "Head of Product",
    background: "10 years in field service operations",
  },
  {
    name: "Rachel Osei",
    role: "Lead Engineer",
    background: "Cloud infrastructure specialist",
  },
];

export default function PublicAbout() {
  return (
    <PublicLayout>
      <section
        className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20 md:py-28 px-4"
        data-testid="section-about-hero"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight mb-6"
            data-testid="text-about-heading"
          >
            About TrueNorth OS
          </h1>
          <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto">
            Built by tradespeople, for tradespeople. We're on a mission to give
            every trade business the tools to thrive in a digital world.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4" data-testid="section-our-story">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight mb-6 text-center">
            Our Story
          </h2>
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-4">
            <p>
              TrueNorth OS was founded by tradespeople who were frustrated with
              generic software that didn't understand the day-to-day reality of
              running a trade business. Spreadsheets, WhatsApp groups, paper job
              sheets — the industry deserved better.
            </p>
            <p>
              We set out to build a platform specifically for UK trade and field
              service businesses. One that speaks the language of the trades,
              handles VAT properly, tracks your fleet, manages your jobs from
              quote to invoice, and puts powerful AI tools in the hands of every
              engineer and business owner.
            </p>
            <p>
              Today, TrueNorth OS is trusted by hundreds of trade businesses
              across the UK — from solo plumbers to multi-van electrical
              contractors and HVAC companies.
            </p>
          </div>
        </div>
      </section>

      <section
        className="py-16 md:py-24 bg-slate-50 px-4"
        data-testid="section-mission"
      >
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Our Mission
          </h2>
          <p
            className="text-xl md:text-2xl text-muted-foreground italic max-w-3xl mx-auto"
            data-testid="text-mission"
          >
            "To give every trade business the digital tools they need to
            compete, grow, and deliver exceptional service."
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4" data-testid="section-values">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight mb-12 text-center">
            Our Values
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <Card
                key={value.title}
                className="border hover:shadow-lg transition-all"
                data-testid={`card-value-${value.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <value.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section
        className="py-16 md:py-24 bg-slate-50 px-4"
        data-testid="section-team"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Meet the Team
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A small founding team of trade professionals and engineers, united
              by a shared belief that the trades deserve world-class software.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member) => (
              <Card
                key={member.name}
                className="text-center border"
                data-testid={`card-team-${member.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <CardContent className="pt-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold">{member.name}</h3>
                  <p className="text-sm text-primary font-medium">
                    {member.role}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {member.background}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section
        className="py-16 md:py-24 bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-4"
        data-testid="section-about-cta"
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            data-testid="text-about-cta"
          >
            Join 500+ trade businesses using TrueNorth OS
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            Start your 14-day free trial today. No credit card required.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-lg px-10 py-6"
              data-testid="button-about-cta"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
