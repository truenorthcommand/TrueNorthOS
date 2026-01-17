import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, User as UserIcon, Menu, Building2 as Building2Icon, CheckCircle2, Users, Home, Calendar, MapPin, Bot, Clock, FileText, Receipt, Settings, ChevronDown, ChevronLeft, ChevronRight, Briefcase, BarChart3, Wrench, Bell, Shield, MessageCircle, Truck, ClipboardCheck, AlertTriangle, Wallet, Timer, CreditCard, PieChart, WifiOff, RefreshCw, Mic, BookOpen, Scan, Mail, LayoutGrid, FolderOpen } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useNotifications, Notification } from "@/hooks/use-notifications";
import { useOffline } from "@/hooks/use-offline";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { SnippetWidget } from "@/components/snippet-widget";

type MenuSection = 'jobs' | 'schedule' | 'sales' | 'team' | 'tools' | 'fleet' | 'finance' | 'clients';
import { LayoutDashboard as DashboardIcon } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<MenuSection[]>(['jobs']);
  const { refreshJobs } = useStore();
  
  const handleNotification = useCallback((notification: Notification) => {
    if (notification.type === 'urgent_job_assigned' || 
        notification.type === 'job_rescheduled_today' ||
        notification.type === 'job_assigned' ||
        notification.jobId) {
      refreshJobs();
    }
  }, [refreshJobs]);
  
  useNotifications(handleNotification);
  const { isOnline, pendingActions, syncOfflineQueue } = useOffline();

  const { data: unreadData } = useQuery<{ count: number } | null>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 30000,
    retry: false,
    throwOnError: false,
    queryFn: async () => {
      try {
        const res = await fetch("/api/messages/unread-count", { credentials: "include" });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
  });
  const unreadCount = unreadData?.count || 0;

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

  const NavLink = ({ href, icon: Icon, children: linkChildren, onClick }: { href: string; icon: React.ElementType; children: React.ReactNode; onClick?: () => void }) => {
    const isActive = location === href || (href !== "/" && location.startsWith(href));
    
    if (sidebarCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="icon"
                className="w-10 h-10"
                onClick={onClick}
                data-testid={`nav-link-${href.replace(/\//g, '-').slice(1) || 'home'}`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">
            {linkChildren}
          </TooltipContent>
        </Tooltip>
      );
    }
    
    return (
      <Link href={href}>
        <Button
          variant={isActive ? "secondary" : "ghost"}
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
  };

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
  }) => {
    if (sidebarCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10"
              onClick={() => setSidebarCollapsed(false)}
              data-testid={`menu-group-${section}`}
            >
              <Icon className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {title}
          </TooltipContent>
        </Tooltip>
      );
    }
    
    return (
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
  };

  const NavContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="flex flex-col gap-2 h-full">
      <div className={cn(
        "flex items-center gap-2 mb-6",
        collapsed ? "justify-center" : "px-2"
      )}>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight leading-tight">Pro Main Solutions</span>
            <span className="text-[10px] text-muted-foreground leading-tight">Powered By TrueNorth Operations Group</span>
          </div>
        )}
      </div>

      <nav className={cn(
        "flex flex-col gap-1 flex-1 overflow-y-auto",
        collapsed && "items-center"
      )}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/">
                <Button
                  variant={location === "/" ? "secondary" : "ghost"}
                  size="icon"
                  className="w-10 h-10"
                  data-testid="nav-dashboard"
                >
                  <LayoutDashboard className="h-5 w-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Dashboard</TooltipContent>
          </Tooltip>
        ) : (
          <Link href="/">
            <Button
              variant={location === "/" ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium"
              onClick={() => setIsOpen(false)}
              data-testid="nav-dashboard"
            >
              <LayoutDashboard className="mr-3 h-5 w-5" />
              Dashboard
            </Button>
          </Link>
        )}

        {/* Clients - Admin & Surveyor */}
        {hasRole(user, 'admin', 'surveyor') && (
          collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/clients">
                  <Button
                    variant={location === "/clients" ? "secondary" : "ghost"}
                    size="icon"
                    className="w-10 h-10"
                    data-testid="nav-clients"
                  >
                    <Building2Icon className="h-5 w-5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Clients</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/clients">
              <Button
                variant={location === "/clients" ? "secondary" : "ghost"}
                className="w-full justify-start h-12 text-lg font-medium"
                onClick={() => setIsOpen(false)}
                data-testid="nav-clients"
              >
                <Building2Icon className="mr-3 h-5 w-5" />
                Clients
              </Button>
            </Link>
          )
        )}

        {/* Email - Admin Only */}
        {hasRole(user, 'admin') && (
          collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/outlook-inbox">
                  <Button
                    variant={location === "/outlook-inbox" ? "secondary" : "ghost"}
                    size="icon"
                    className="w-10 h-10"
                    data-testid="nav-email"
                  >
                    <Mail className="h-5 w-5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Email</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/outlook-inbox">
              <Button
                variant={location === "/outlook-inbox" ? "secondary" : "ghost"}
                className="w-full justify-start h-12 text-lg font-medium"
                onClick={() => setIsOpen(false)}
                data-testid="nav-email"
              >
                <Mail className="mr-3 h-5 w-5" />
                Email
              </Button>
            </Link>
          )
        )}

        {/* Sales Section - Admin & Surveyor */}
        {hasRole(user, 'admin', 'surveyor') && (
          <MenuGroup title="Sales" icon={BarChart3} section="sales">
            <NavLink href="/quotes" icon={FileText}>Quotes</NavLink>
            {hasRole(user, 'admin') && (
              <NavLink href="/invoices" icon={Receipt}>Invoices</NavLink>
            )}
          </MenuGroup>
        )}

        {/* Jobs Section (Quotes convert to Jobs) */}
        <MenuGroup title="Jobs" icon={Briefcase} section="jobs">
          <NavLink href="/jobs" icon={Briefcase}>Jobs List</NavLink>
          {hasRole(user, 'admin') && (
            <NavLink href="/completed-jobs" icon={CheckCircle2}>Completed Jobs</NavLink>
          )}
        </MenuGroup>

        {/* Schedule Section - Admin Only */}
        {hasRole(user, 'admin') && (
          <MenuGroup title="Schedule" icon={Calendar} section="schedule">
            <NavLink href="/schedule/calendar" icon={Calendar}>Calendar</NavLink>
            <NavLink href="/schedule/planner" icon={LayoutGrid}>Planner</NavLink>
            <NavLink href="/time-logs" icon={Clock}>Time Logs</NavLink>
          </MenuGroup>
        )}

        {/* Team Section - Admin Only */}
        {hasRole(user, 'admin') && (
          <MenuGroup title="Team" icon={Users} section="team">
            <NavLink href="/engineers" icon={UserIcon}>Engineers</NavLink>
            {user.superAdmin && (
              <NavLink href="/staff" icon={Users}>Staff Management</NavLink>
            )}
            <NavLink href="/map" icon={MapPin}>Live Map</NavLink>
          </MenuGroup>
        )}

        {/* Messages - All Users */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/messages">
                <Button
                  variant={location === "/messages" ? "secondary" : "ghost"}
                  size="icon"
                  className="w-10 h-10 relative"
                  data-testid="nav-messages"
                >
                  <MessageCircle className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Messages{unreadCount > 0 ? ` (${unreadCount})` : ""}</TooltipContent>
          </Tooltip>
        ) : (
          <Link href="/messages">
            <Button
              variant={location === "/messages" ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium relative"
              onClick={() => setIsOpen(false)}
              data-testid="nav-messages"
            >
              <MessageCircle className="mr-3 h-5 w-5" />
              Messages
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </Link>
        )}

        {/* Finance Section */}
        <MenuGroup title="Finance" icon={Wallet} section="finance">
          <NavLink href="/timesheets" icon={Timer}>Timesheets</NavLink>
          <NavLink href="/expenses" icon={Receipt}>Expenses</NavLink>
          {hasRole(user, 'admin') && (
            <>
              <NavLink href="/payments" icon={CreditCard}>Payments</NavLink>
              <NavLink href="/analytics" icon={PieChart}>Analytics</NavLink>
            </>
          )}
        </MenuGroup>

        {/* Fleet Section - All users see it, fleet managers & admins see all */}
        <MenuGroup title="Fleet" icon={Truck} section="fleet">
          <NavLink href="/fleet" icon={ClipboardCheck}>Dashboard</NavLink>
          <NavLink href="/fleet/vehicles" icon={Truck}>Vehicles</NavLink>
          <NavLink href="/fleet/walkaround" icon={ClipboardCheck}>Walkaround Check</NavLink>
          <NavLink href="/fleet/report-defect" icon={AlertTriangle}>Report Defect</NavLink>
        </MenuGroup>


        {/* Tools Section */}
        <MenuGroup title="Tools" icon={Wrench} section="tools">
          <NavLink href="/files" icon={FolderOpen}>Files</NavLink>
          <NavLink href="/user-guide" icon={BookOpen}>Help Guide</NavLink>
          <NavLink href="/voice-notes" icon={Mic}>Voice Notes</NavLink>
          <NavLink href="/document-scanner" icon={Scan}>Doc Scanner</NavLink>
          <NavLink href="/ai-advisors" icon={Bot}>Technical Advisor</NavLink>
          <NavLink href="/security" icon={Shield}>Security</NavLink>
          {hasRole(user, 'admin') && (
            <>
              <NavLink href="/settings" icon={Settings}>Settings</NavLink>
              <NavLink href="/admin/advisors" icon={Bot}>Advisor Settings</NavLink>
            </>
          )}
        </MenuGroup>
      </nav>

      <div className={cn("border-t pt-4 mt-auto", collapsed && "flex flex-col items-center")}>
        {!collapsed && (
          <div className="px-4 py-2 mb-2">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).join(' • ')}
            </p>
          </div>
        )}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                className="w-10 h-10 text-destructive hover:text-destructive" 
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign Out</TooltipContent>
          </Tooltip>
        ) : (
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
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
        {/* Desktop Sidebar */}
        <aside className={cn(
          "hidden md:flex flex-col border-r bg-background h-screen sticky top-0 transition-all duration-300 print:hidden",
          sidebarCollapsed ? "w-16" : "w-64 lg:w-72"
        )}>
          {/* Collapse Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-6 z-10 h-6 w-6 rounded-full border bg-background shadow-md hover:bg-accent"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            data-testid="button-toggle-sidebar"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
          
          <div className={cn(
            "flex-1 overflow-hidden flex flex-col",
            sidebarCollapsed ? "p-2" : "p-4"
          )}>
            <NavContent collapsed={sidebarCollapsed} />
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Mobile Header */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6 shadow-sm md:hidden print:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[350px] p-6">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <NavContent collapsed={false} />
              </SheetContent>
            </Sheet>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold leading-tight">Pro Main Solutions</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => window.location.reload()}
                data-testid="button-refresh-app-mobile"
              >
                <RefreshCw className="h-5 w-5" />
                <span className="sr-only">Refresh app</span>
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                Sign Out
              </Button>
            </div>
          </header>

          {(!isOnline || pendingActions > 0) && (
            <div className={cn(
              "px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 print:hidden",
              !isOnline ? "bg-red-500 text-white" : "bg-amber-500 text-white"
            )}>
              {!isOnline ? (
                <>
                  <WifiOff className="h-4 w-4" />
                  <span>You are offline. Changes will sync when reconnected.</span>
                </>
              ) : pendingActions > 0 ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>{pendingActions} pending action{pendingActions > 1 ? 's' : ''} syncing...</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-white hover:text-white hover:bg-white/20"
                    onClick={() => syncOfflineQueue()}
                  >
                    Sync Now
                  </Button>
                </>
              ) : null}
            </div>
          )}

          <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
          </main>
          
          <SnippetWidget />
          
          {/* Floating Refresh Button - Desktop */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-background hover:bg-accent hidden md:flex print:hidden z-40"
                onClick={() => window.location.reload()}
                data-testid="button-refresh-app-desktop"
              >
                <RefreshCw className="h-5 w-5" />
                <span className="sr-only">Refresh app</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Refresh app</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
