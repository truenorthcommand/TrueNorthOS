import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ClipboardList,
  FileText,
  MapPin,
  Truck,
  Brain,
  Users,
  Star,
  ArrowRight,
  UserPlus,
  Settings,
  Briefcase,
} from "lucide-react";

const features = [
  {
    icon: ClipboardList,
    title: "Job Management",
    description: "Create, schedule, and track jobs from quote to completion",
  },
  {
    icon: FileText,
    title: "Smart Quoting & Invoicing",
    description: "Professional quotes and invoices with UK VAT calculations",
  },
  {
    icon: MapPin,
    title: "Live GPS Tracking",
    description: "Real-time engineer locations and route optimisation",
  },
  {
    icon: Truck,
    title: "Fleet Management",
    description: "Vehicle checks, defect tracking, and compliance",
  },
  {
    icon: Brain,
    title: "AI-Powered Tools",
    description: "Smart job assignment, receipt OCR, and technical advisors",
  },
  {
    icon: Users,
    title: "Client Portal",
    description: "Secure portal for customers to view jobs and pay invoices",
  },
];

const steps = [
  {
    number: "1",
    title: "Sign Up",
    description: "Create your account in under two minutes. No credit card required.",
    icon: UserPlus,
  },
  {
    number: "2",
    title: "Set Up Your Team",
    description: "Add your engineers, vehicles, and service areas to get organised.",
    icon: Settings,
  },
  {
    number: "3",
    title: "Start Managing Jobs",
    description: "Create jobs, send quotes, dispatch engineers, and invoice clients — all from one place.",
    icon: Briefcase,
  },
];

const testimonials = [
  {
    name: "James Thornton",
    role: "Owner",
    company: "Thornton Plumbing & Heating Ltd",
    quote:
      "TrueNorth OS completely transformed how we run our plumbing business. We used to juggle spreadsheets, WhatsApp groups, and paper invoices — now everything is in one place. Our cash flow has improved dramatically since switching.",
    rating: 5,
  },
  {
    name: "Sarah Mitchell",
    role: "Director",
    company: "Sparks Electrical Contractors",
    quote:
      "The AI tools and live GPS tracking are game-changers. I can see exactly where my team is, assign the nearest engineer to urgent call-outs, and our quoting time has been cut in half. Brilliant for electrical contractors.",
    rating: 5,
  },
  {
    name: "David Okonkwo",
    role: "Operations Manager",
    company: "CoolFlow HVAC Solutions",
    quote:
      "Fleet management and compliance tracking alone made TrueNorth OS worth it. We manage 15 vans and the walkaround checks, defect logging, and service reminders keep us fully compliant without the admin headache.",
    rating: 5,
  },
];


export default function PublicHome() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 text-white" data-testid="section-hero">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6" data-testid="text-hero-headline">
            Run Your Trade Business From One Platform
          </h1>
          <p className="text-lg md:text-xl text-blue-100 max-w-3xl mx-auto mb-10" data-testid="text-hero-subheadline">
            TrueNorth OS brings together job management, quoting, invoicing, fleet tracking, and AI-powered tools — built specifically for UK trade and field service companies.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-lg px-8 py-6 w-full sm:w-auto"
                data-testid="button-hero-start-trial"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 text-white hover:bg-white/10 text-lg px-8 py-6 w-full sm:w-auto"
                data-testid="button-hero-see-pricing"
              >
                See Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 bg-slate-50 border-b" data-testid="section-trusted-by">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800" data-testid="text-trusted-by">
            Trusted by trades across the UK
          </h2>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4" data-testid="section-features">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="text-features-title">
              Everything You Need to Run Your Trade Business
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Six powerful modules working together so you can focus on the job, not the paperwork.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="border hover:shadow-lg hover:border-primary/30 transition-all"
                data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-slate-50 px-4" data-testid="section-how-it-works">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="text-how-it-works-title">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Get up and running in three simple steps.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="text-center" data-testid={`step-${step.number}`}>
                <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4" data-testid="section-testimonials">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="text-testimonials-title">
              Trusted by Trade Professionals
            </h2>
            <p className="text-lg text-muted-foreground">
              Hear from business owners who switched to TrueNorth OS.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border" data-testid={`card-testimonial-${index}`}>
                <CardContent className="pt-6">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-6 italic">
                    "{testimonial.quote}"
                  </p>
                  <div>
                    <p className="font-semibold text-sm">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.role}, {testimonial.company}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-4" data-testid="section-cta">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="text-cta-headline">
            Ready to streamline your trade business?
          </h2>
          <p className="text-lg text-blue-100 mb-8" data-testid="text-cta-subheadline">
            Start your 14-day free trial today. No credit card required.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-lg px-10 py-6"
              data-testid="button-cta-start-trial"
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
