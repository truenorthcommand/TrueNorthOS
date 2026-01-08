import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, User as UserIcon, Menu, Building2 as Building2Icon, CheckCircle2, Users, Home, Calendar, MapPin, Bot, Clock, FileText, Receipt, Settings, ChevronDown, ChevronRight, Briefcase, BarChart3, Wrench } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";

type MenuSection = 'jobs' | 'schedule' | 'sales' | 'team' | 'tools';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<MenuSection[]>(['jobs']);

  if (!user) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  const toggleSection = (section: MenuSection) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const isExpanded = (section: MenuSection) => expandedSections.includes(section);

  const NavLink = ({ href, icon: Icon, children: linkChildren, onClick }: { href: string; icon: React.ElementType; children: React.ReactNode; onClick?: () => void }) => (
    <Link href={href}>
      <Button
        variant={location === href || (href !== "/" && location.startsWith(href)) ? "secondary" : "ghost"}
        className="w-full justify-start h-10 text-base font-medium pl-10"
        onClick={() => {
          setIsOpen(false);
          onClick?.();
        }}
        data-testid={`nav-link-${href.replace(/\//g, '-').slice(1) || 'home'}`}
      >
        <Icon className="mr-3 h-4 w-4" />
        {linkChildren}
      </Button>
    </Link>
  );

  const MenuGroup = ({ 
    title, 
    icon: Icon, 
    section, 
    children: groupChildren 
  }: { 
    title: string; 
    icon: React.ElementType; 
    section: MenuSection; 
    children: React.ReactNode;
  }) => (
    <Collapsible open={isExpanded(section)} onOpenChange={() => toggleSection(section)}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start h-12 text-lg font-medium hover:bg-accent"
          data-testid={`menu-group-${section}`}
        >
          <Icon className="mr-3 h-5 w-5" />
          {title}
          <ChevronDown className={cn(
            "ml-auto h-4 w-4 transition-transform duration-200",
            isExpanded(section) ? "rotate-180" : ""
          )} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 ml-2 border-l-2 border-muted pl-2">
        {groupChildren}
      </CollapsibleContent>
    </Collapsible>
  );

  const NavContent = () => (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-2 mb-6 px-2">
        <img src="/logo.png" alt="TrueNorth Logo" className="w-8 h-8 rounded-md" />
        <span className="text-xl font-bold tracking-tight">Field View</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
        <Link href="/home">
          <Button
            variant={location === "/home" ? "secondary" : "ghost"}
            className="w-full justify-start h-12 text-lg font-medium"
            onClick={() => setIsOpen(false)}
            data-testid="nav-home"
          >
            <Home className="mr-3 h-5 w-5" />
            Home
          </Button>
        </Link>

        {/* Jobs Section */}
        <MenuGroup title="Jobs" icon={Briefcase} section="jobs">
          <NavLink href="/" icon={LayoutDashboard}>Jobs List</NavLink>
          {user.role === "admin" && (
            <NavLink href="/completed-jobs" icon={CheckCircle2}>Completed Jobs</NavLink>
          )}
        </MenuGroup>

        {/* Schedule Section - Admin Only */}
        {user.role === "admin" && (
          <MenuGroup title="Schedule" icon={Calendar} section="schedule">
            <NavLink href="/calendar" icon={Calendar}>Calendar</NavLink>
            <NavLink href="/time-logs" icon={Clock}>Time Logs</NavLink>
          </MenuGroup>
        )}

        {/* Sales Section - Admin Only */}
        {user.role === "admin" && (
          <MenuGroup title="Sales" icon={BarChart3} section="sales">
            <NavLink href="/clients" icon={Building2Icon}>Clients</NavLink>
            <NavLink href="/quotes" icon={FileText}>Quotes</NavLink>
            <NavLink href="/invoices" icon={Receipt}>Invoices</NavLink>
          </MenuGroup>
        )}

        {/* Team Section - Admin Only */}
        {user.role === "admin" && (
          <MenuGroup title="Team" icon={Users} section="team">
            <NavLink href="/engineers" icon={UserIcon}>Engineers</NavLink>
            {user.superAdmin && (
              <NavLink href="/staff" icon={Users}>Staff Management</NavLink>
            )}
            <NavLink href="/map" icon={MapPin}>Live Map</NavLink>
          </MenuGroup>
        )}

        {/* Tools Section */}
        <MenuGroup title="Tools" icon={Wrench} section="tools">
          <NavLink href="/ai-advisors" icon={Bot}>Technical Advisor</NavLink>
          {user.role === "admin" && (
            <>
              <NavLink href="/settings" icon={Settings}>Settings</NavLink>
              <NavLink href="/admin/advisors" icon={Bot}>Advisor Settings</NavLink>
            </>
          )}
        </MenuGroup>
      </nav>

      <div className="border-t pt-4 mt-auto">
        <div className="px-4 py-2 mb-2">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start text-destructive hover:text-destructive" 
          onClick={() => {
            setIsOpen(false);
            logout();
          }}
          data-testid="button-logout"
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r bg-background h-screen sticky top-0">
        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <NavContent />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6 shadow-sm md:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[350px] p-6">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <NavContent />
            </SheetContent>
          </Sheet>
          
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="TrueNorth Logo" className="w-8 h-8 rounded-md" />
            <span className="text-lg font-bold">Field View</span>
          </div>

          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full no-print">
          {children}
        </main>
      </div>
    </div>
  );
}
