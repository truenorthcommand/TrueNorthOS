import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Zap
} from "lucide-react";

export default function Home() {
  const { user } = useAuth();

  const features = [
    {
      icon: ClipboardList,
      title: "Digital Job Sheets",
      description: "Create and manage job sheets digitally. Track materials, notes, and job progress in real-time."
    },
    {
      icon: Camera,
      title: "Photo Evidence",
      description: "Upload photos as evidence of completed work. Document before and after states."
    },
    {
      icon: Signature,
      title: "Digital Signatures",
      description: "Capture engineer and customer signatures digitally for job sign-off verification."
    },
    {
      icon: MapPin,
      title: "GPS Tracking",
      description: "Location-stamped sign-offs with reverse geocoding. Verify work location automatically."
    },
    {
      icon: Users,
      title: "Team Management",
      description: "Assign jobs to engineers, track workloads, and manage your field service team."
    },
    {
      icon: Shield,
      title: "Secure Access",
      description: "Role-based access control with secure authentication for admins and engineers."
    },
  ];

  const quickLinks = [
    { href: "/", label: "Jobs Dashboard", icon: ClipboardList, description: "View and manage all job sheets" },
    { href: "/clients", label: "Clients", icon: Users, description: "Manage clients and create jobs", adminOnly: true },
    { href: "/engineers", label: "Engineers", icon: Wrench, description: "View team and assignments", adminOnly: true },
    { href: "/completed-jobs", label: "Completed Jobs", icon: CheckCircle2, description: "Review signed-off jobs", adminOnly: true },
    { href: "/staff", label: "Staff Management", icon: Shield, description: "Add or remove staff members", adminOnly: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <header className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="TrueNorth Logo" className="w-10 h-10 rounded-lg" />
              <div>
                <h1 className="text-xl font-bold tracking-tight">Field View</h1>
                <p className="text-xs text-muted-foreground">TrueNorth</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/pricing">
                <Button variant="outline" data-testid="button-pricing">
                  Pricing
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
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Digital Job Sheet Management for
              <span className="text-primary"> Field Engineers</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Streamline your field service operations with digital job sheets, photo evidence, 
              GPS tracking, and digital signatures. Everything your team needs in one place.
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
                <Link href="/auth">
                  <Button size="lg" className="w-full sm:w-auto" data-testid="button-get-started">
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="py-16 bg-slate-100/50 dark:bg-slate-900/50 px-4">
          <div className="max-w-6xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-bold text-center mb-12">
              Everything You Need for Field Service
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="border-0 shadow-sm hover:shadow-md transition-shadow" data-testid={`feature-card-${index}`}>
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
                <Bot className="h-4 w-4" />
                AI-Powered Assistance
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                Expert AI Advisors at Your Fingertips
              </h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Get instant expert guidance from our specialist AI assistants. Upload photos for analysis or ask questions about any technical issue.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-2 hover:border-amber-500 hover:shadow-lg transition-all cursor-pointer group" data-testid="advisor-card-snagging">
                <CardHeader className="text-center pb-2">
                  <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <HardHat className="h-8 w-8 text-amber-600" />
                  </div>
                  <CardTitle className="text-lg">Snagging Pro</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription>Quality assessment & refurbishment defects specialist</CardDescription>
                </CardContent>
              </Card>
              
              <Card className="border-2 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group" data-testid="advisor-card-parts">
                <CardHeader className="text-center pb-2">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Search className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">Trade Parts Finder</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription>UK parts sourcing from photos & descriptions</CardDescription>
                </CardContent>
              </Card>
              
              <Card className="border-2 hover:border-orange-500 hover:shadow-lg transition-all cursor-pointer group" data-testid="advisor-card-gas">
                <CardHeader className="text-center pb-2">
                  <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Flame className="h-8 w-8 text-orange-600" />
                  </div>
                  <CardTitle className="text-lg">Gas & Heating</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription>Boiler diagnostics & Gas Safe compliance</CardDescription>
                </CardContent>
              </Card>
              
              <Card className="border-2 hover:border-yellow-500 hover:shadow-lg transition-all cursor-pointer group" data-testid="advisor-card-electrical">
                <CardHeader className="text-center pb-2">
                  <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Zap className="h-8 w-8 text-yellow-600" />
                  </div>
                  <CardTitle className="text-lg">Electrical Expert</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription>BS 7671 wiring regs & fault diagnosis</CardDescription>
                </CardContent>
              </Card>
            </div>
            <div className="text-center mt-8">
              <Link href={user ? "/ai-advisors" : "/auth"}>
                <Button size="lg" variant="outline" className="gap-2" data-testid="button-try-ai-advisors">
                  <Bot className="h-5 w-5" />
                  {user ? "Chat with AI Advisors" : "Sign in to Try AI Advisors"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {user && (
          <section className="py-16 bg-slate-100/50 dark:bg-slate-900/50 px-4">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-2xl md:text-3xl font-bold text-center mb-8">
                Quick Navigation
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {quickLinks
                  .filter(link => !link.adminOnly || user.role === 'admin')
                  .map((link, index) => (
                    <Link key={index} href={link.href}>
                      <Card className="hover:border-primary hover:shadow-md transition-all cursor-pointer h-full" data-testid={`quick-link-${index}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <link.icon className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-base">{link.label}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">{link.description}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
              </div>
            </div>
          </section>
        )}

        <section className="py-16 bg-primary text-primary-foreground px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to Get Started?
            </h3>
            <p className="text-lg opacity-90 mb-8">
              Sign in to access your job sheets and manage your field service operations.
            </p>
            {user ? (
              <Link href="/">
                <Button size="lg" variant="secondary" data-testid="button-view-jobs">
                  View Your Jobs
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <Link href="/auth">
                <Button size="lg" variant="secondary" data-testid="button-sign-in-cta">
                  Sign In Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>TrueNorth Field View - Digital Job Sheet Management</p>
        </div>
      </footer>
    </div>
  );
}
