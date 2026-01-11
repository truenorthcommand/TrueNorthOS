import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, 
  Camera, 
  MapPin, 
  Signature, 
  Users, 
  Shield,
  CheckCircle2,
  ArrowRight,
  Wrench,
  Bot,
  HardHat,
  Search,
  Flame,
  Zap,
  Clock,
  Receipt,
  CreditCard,
  Car,
  MessageSquare,
  FileText,
  PoundSterling,
  Building2,
  Lock,
  Smartphone,
  Globe,
  BarChart3,
  CalendarDays,
  Truck,
  Gauge,
  Brain,
  Mic,
  ShieldCheck
} from "lucide-react";

const modules = [
  {
    id: "operations",
    name: "Operations",
    description: "End-to-end job lifecycle management",
    icon: ClipboardList,
    color: "bg-blue-500",
    features: [
      { icon: ClipboardList, label: "Job Management" },
      { icon: FileText, label: "Quoting & Invoicing" },
      { icon: Users, label: "Client CRM" },
      { icon: Camera, label: "Photo Evidence" },
      { icon: Signature, label: "Digital Signatures" },
      { icon: CalendarDays, label: "Weekly Planner" },
    ]
  },
  {
    id: "finance",
    name: "Finance",
    description: "Complete financial control",
    icon: PoundSterling,
    color: "bg-green-500",
    features: [
      { icon: Clock, label: "Timesheets" },
      { icon: Receipt, label: "Expense Tracking" },
      { icon: CreditCard, label: "Payment Collection" },
      { icon: Car, label: "Mileage Calculator" },
      { icon: FileText, label: "Invoice Generation" },
      { icon: BarChart3, label: "Financial Reports" },
    ]
  },
  {
    id: "fleet",
    name: "Fleet",
    description: "Vehicle & asset management",
    icon: Truck,
    color: "bg-orange-500",
    features: [
      { icon: Car, label: "Vehicle Registry" },
      { icon: CheckCircle2, label: "Walkaround Checks" },
      { icon: Wrench, label: "Defect Tracking" },
      { icon: Gauge, label: "Status Monitoring" },
      { icon: FileText, label: "Compliance Records" },
      { icon: Clock, label: "Service History" },
    ]
  },
  {
    id: "workforce",
    name: "Workforce",
    description: "Team coordination & communication",
    icon: Users,
    color: "bg-purple-500",
    features: [
      { icon: MessageSquare, label: "Team Messaging" },
      { icon: MapPin, label: "Live GPS Tracking" },
      { icon: Users, label: "Role Management" },
      { icon: CalendarDays, label: "Shift Planning" },
      { icon: Clock, label: "Time Tracking" },
      { icon: BarChart3, label: "Performance Insights" },
    ]
  },
  {
    id: "compliance",
    name: "Compliance",
    description: "Security & regulatory compliance",
    icon: ShieldCheck,
    color: "bg-red-500",
    features: [
      { icon: Lock, label: "Two-Factor Auth (2FA)" },
      { icon: Shield, label: "Role-Based Access" },
      { icon: FileText, label: "GDPR Compliance" },
      { icon: MapPin, label: "Geo-Verified Sign-offs" },
      { icon: Clock, label: "Audit Trails" },
      { icon: FileText, label: "Privacy Controls" },
    ]
  },
  {
    id: "intelligence",
    name: "Intelligence",
    description: "AI-powered productivity tools",
    icon: Brain,
    color: "bg-indigo-500",
    features: [
      { icon: Bot, label: "Technical Advisors" },
      { icon: Camera, label: "Photo Analysis" },
      { icon: FileText, label: "Smart Writing Assistant" },
      { icon: Mic, label: "Voice-to-Text" },
      { icon: Search, label: "Parts Finder" },
      { icon: Zap, label: "Fault Diagnosis" },
    ]
  },
];

const stats = [
  { value: "6", label: "Integrated Modules" },
  { value: "50+", label: "Features" },
  { value: "100%", label: "UK Focused" },
  { value: "24/7", label: "Cloud Access" },
];

const advisors = [
  {
    icon: HardHat,
    name: "Snagging Pro",
    description: "Quality assessment & defects",
    bgClass: "bg-amber-100 dark:bg-amber-900/30",
    iconClass: "text-amber-600",
    hoverClass: "hover:border-amber-500",
  },
  {
    icon: Search,
    name: "Parts Finder",
    description: "UK parts sourcing",
    bgClass: "bg-blue-100 dark:bg-blue-900/30",
    iconClass: "text-blue-600",
    hoverClass: "hover:border-blue-500",
  },
  {
    icon: Flame,
    name: "Gas & Heating",
    description: "Boiler & Gas Safe",
    bgClass: "bg-orange-100 dark:bg-orange-900/30",
    iconClass: "text-orange-600",
    hoverClass: "hover:border-orange-500",
  },
  {
    icon: Zap,
    name: "Electrical",
    description: "BS 7671 wiring",
    bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
    iconClass: "text-yellow-600",
    hoverClass: "hover:border-yellow-500",
  },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <header className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/logo-pms.png" alt="Pro Main Solutions Logo" className="h-10 object-contain" />
              <div>
                <h1 className="text-xl font-bold tracking-tight">Pro Main Solutions</h1>
                <p className="text-xs text-muted-foreground">Powered By TrueNorth Operations Group</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/pricing">
                <Button variant="ghost" data-testid="button-pricing">
                  Pricing
                </Button>
              </Link>
              <Link href="/guides">
                <Button variant="ghost" data-testid="button-guides">
                  Guides
                </Button>
              </Link>
              {user ? (
                <Link href="/">
                  <Button data-testid="button-go-to-app">
                    Go to App
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Link href="/auth">
                  <Button data-testid="button-sign-in">
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <Badge className="mb-6 bg-primary/10 text-primary hover:bg-primary/20" data-testid="badge-erp">
              <Building2 className="h-3 w-3 mr-1" />
              Field Service ERP Suite
            </Badge>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6" data-testid="text-hero-title">
              The Complete Business Platform for
              <span className="text-primary block mt-2">UK Field Engineers</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto" data-testid="text-hero-description">
              Run your entire field service operation from one platform. Jobs, quotes, invoices, 
              timesheets, expenses, fleet, team messaging, and AI-powered tools — all integrated 
              and built for UK tradespeople.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Link href="/">
                  <Button size="lg" className="w-full sm:w-auto" data-testid="button-open-dashboard">
                    <ClipboardList className="mr-2 h-5 w-5" />
                    Open Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth">
                    <Button size="lg" className="w-full sm:w-auto" data-testid="button-get-started">
                      Start Free Trial
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/pricing">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-view-pricing">
                      View Pricing
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="py-8 border-y bg-slate-50/50 dark:bg-slate-900/50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center" data-testid={`stat-${index}`}>
                  <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-modules-title">
                Six Integrated Modules, One Platform
              </h3>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to run a field service business. No more juggling multiple apps 
                or manual spreadsheets.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modules.map((module) => (
                <Card key={module.id} className="border-2 hover:border-primary/50 hover:shadow-lg transition-all" data-testid={`module-card-${module.id}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg ${module.color} flex items-center justify-center`}>
                        <module.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{module.name}</CardTitle>
                        <CardDescription className="text-xs">{module.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {module.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <feature.icon className="h-3.5 w-3.5 text-primary" />
                          <span>{feature.label}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-slate-100/50 dark:bg-slate-900/50 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                <Bot className="h-3 w-3 mr-1" />
                AI-Powered
              </Badge>
              <h3 className="text-2xl md:text-3xl font-bold mb-4" data-testid="text-ai-title">
                Expert Technical Advisors
              </h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Get instant expert guidance from AI specialists. Upload photos for analysis 
                or ask questions about any technical issue.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {advisors.map((advisor, index) => (
                <Card key={index} className={`border-2 ${advisor.hoverClass} hover:shadow-lg transition-all cursor-pointer group`} data-testid={`advisor-card-${index}`}>
                  <CardHeader className="text-center pb-2">
                    <div className={`w-16 h-16 rounded-full ${advisor.bgClass} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                      <advisor.icon className={`h-8 w-8 ${advisor.iconClass}`} />
                    </div>
                    <CardTitle className="text-lg">{advisor.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <CardDescription>{advisor.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href={user ? "/ai-advisors" : "/auth"}>
                <Button size="lg" variant="outline" className="gap-2" data-testid="button-try-ai-advisors">
                  <Bot className="h-5 w-5" />
                  {user ? "Chat with Technical Advisor" : "Try AI Advisors Free"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-2xl md:text-3xl font-bold mb-4" data-testid="text-why-title">
                Built for UK Field Service Businesses
              </h3>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">Mobile-First PWA</h4>
                <p className="text-sm text-muted-foreground">
                  Works on any device. Install as an app with offline support for field use.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Globe className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">UK-Focused</h4>
                <p className="text-sm text-muted-foreground">
                  HMRC mileage rates, UK VAT, Gas Safe references, BS 7671 wiring regs built in.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">Secure & Compliant</h4>
                <p className="text-sm text-muted-foreground">
                  GDPR compliant with 2FA, role-based access, and full audit trails.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-primary text-primary-foreground px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-2xl md:text-3xl font-bold mb-4" data-testid="text-cta-title">
              Ready to Streamline Your Business?
            </h3>
            <p className="text-lg opacity-90 mb-8">
              Join field service companies across the UK who are saving hours every week 
              with TrueNorth Field View.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Link href="/">
                  <Button size="lg" variant="secondary" data-testid="button-view-jobs">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth">
                    <Button size="lg" variant="secondary" data-testid="button-start-trial">
                      Start Free Trial
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/pricing">
                    <Button size="lg" variant="outline" className="border-white/30 hover:bg-white/10" data-testid="button-see-pricing">
                      See Pricing
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo-pms.png" alt="Pro Main Solutions Logo" className="h-8 object-contain" />
              <span className="font-semibold">Pro Main Solutions</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The Complete Field Service ERP Suite
            </p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/privacy-policy">Privacy</Link>
              <Link href="/terms-of-service">Terms</Link>
              <Link href="/guides">Help</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
