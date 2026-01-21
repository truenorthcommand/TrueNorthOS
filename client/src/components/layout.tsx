import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, User as UserIcon, Menu, Building2 as Building2Icon, CheckCircle2, Users, Calendar, MapPin, Bot, Clock, FileText, Receipt, Settings, ChevronDown, ChevronLeft, ChevronRight, Briefcase, BarChart3, Wrench, MessageCircle, Truck, ClipboardCheck, AlertTriangle, Wallet, Timer, CreditCard, PieChart, WifiOff, RefreshCw, Mic, BookOpen, Mail, LayoutGrid, FolderOpen, Shield, Crown, Link2, Gift, Sparkles, ClipboardList } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useNotifications, Notification } from "@/hooks/use-notifications";
import { useOffline } from "@/hooks/use-offline";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { GlobalAIAssistant } from "@/components/GlobalAIAssistant";

type MenuSection = 'jobs' | 'schedule' | 'sales' | 'team' | 'tools' | 'fleet' | 'finance' | 'clients' | 'files' | 'settings';

const NAVY_PRIMARY = "#0F2B4C";
const NAVY_LIGHT = "#1a3a5c";
const NAVY_HOVER = "#163352";

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
              <button
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                  isActive 
                    ? "bg-white/15 text-white" 
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
                onClick={onClick}
                data-testid={`nav-link-${href.replace(/\//g, '-').slice(1) || 'home'}`}
              >
                <Icon className="h-4 w-4" />
              </button>
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
        <button
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-left",
            isActive 
              ? "bg-white/15 text-white" 
              : "text-slate-300 hover:bg-white/10 hover:text-white"
          )}
          onClick={() => {
            setIsOpen(false);
            onClick?.();
          }}
          data-testid={`nav-link-${href.replace(/\//g, '-').slice(1) || 'home'}`}
        >
          <Icon className="h-4 w-4" />
          {linkChildren}
        </button>
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
            <button
              className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              onClick={() => setSidebarCollapsed(false)}
              data-testid={`menu-group-${section}`}
            >
              <Icon className="h-5 w-5" />
            </button>
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
          <button
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
            data-testid={`menu-group-${section}`}
          >
            <Icon className="h-5 w-5" />
            {title}
            <ChevronDown className={cn(
              "ml-auto h-4 w-4 transition-transform duration-200",
              isExpanded(section) ? "rotate-180" : ""
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pl-6">
          {groupChildren}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const NavContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="flex flex-col gap-2 h-full">
      <div className={cn(
        "flex items-center gap-2 mb-6 pb-4 border-b border-white/20",
        collapsed ? "justify-center" : "px-2"
      )}>
        {!collapsed && (
          <img 
            src="/logo-foreman.png" 
            alt="FOREMAN - Keeping operations on track" 
            className="h-12 w-auto object-contain"
          />
        )}
        {collapsed && (
          <img 
            src="/logo-foreman.png" 
            alt="FOREMAN" 
            className="h-8 w-auto object-contain"
          />
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
                <button
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                    location === "/" 
                      ? "bg-white/15 text-white" 
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                  data-testid="nav-dashboard"
                >
                  <LayoutDashboard className="h-5 w-5" />
                </button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Dashboard</TooltipContent>
          </Tooltip>
        ) : (
          <Link href="/">
            <button
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                location === "/" 
                  ? "bg-white/15 text-white" 
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              onClick={() => setIsOpen(false)}
              data-testid="nav-dashboard"
            >
              <LayoutDashboard className="h-5 w-5" />
              Dashboard
            </button>
          </Link>
        )}

        {/* Clients - Admin & Surveyor */}
        {hasRole(user, 'admin', 'surveyor') && (
          <MenuGroup title="Clients" icon={Building2Icon} section="clients">
            <NavLink href="/clients" icon={Building2Icon}>Manage Clients</NavLink>
          </MenuGroup>
        )}

        {/* Email - Admin Only */}
        {hasRole(user, 'admin') && (
          collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/outlook-inbox">
                  <button
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                      location === "/outlook-inbox" 
                        ? "bg-white/15 text-white" 
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    )}
                    data-testid="nav-email"
                  >
                    <Mail className="h-5 w-5" />
                  </button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Email</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/outlook-inbox">
              <button
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  location === "/outlook-inbox" 
                    ? "bg-white/15 text-white" 
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
                onClick={() => setIsOpen(false)}
                data-testid="nav-email"
              >
                <Mail className="h-5 w-5" />
                Email
              </button>
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
          {hasRole(user, 'admin', 'surveyor') && (
            <NavLink href="/create-job-sheet" icon={FileText}>Create Job Sheet</NavLink>
          )}
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
                <button
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative",
                    location === "/messages" 
                      ? "bg-white/15 text-white" 
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                  data-testid="nav-messages"
                >
                  <MessageCircle className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-xs rounded-full">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Messages{unreadCount > 0 ? ` (${unreadCount})` : ""}</TooltipContent>
          </Tooltip>
        ) : (
          <Link href="/messages">
            <button
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                location === "/messages" 
                  ? "bg-white/15 text-white" 
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              onClick={() => setIsOpen(false)}
              data-testid="nav-messages"
            >
              <MessageCircle className="h-5 w-5" />
              Messages
              {unreadCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
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
              {(user?.superAdmin || user?.hasDirectorsSuite) && (
                <NavLink href="/directors" icon={Crown}>Directors Suite</NavLink>
              )}
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


        {/* Tools Section - AI tools only */}
        <MenuGroup title="Tools" icon={Wrench} section="tools">
          <NavLink href="/ai-tools" icon={Sparkles}>AI Assistant</NavLink>
          <NavLink href="/ai-advisors" icon={Bot}>Technical Advisers</NavLink>
          <NavLink href="/voice-notes" icon={Mic}>Voice Notes</NavLink>
        </MenuGroup>

        {/* File Storage Section - Admin and above */}
        {hasRole(user, 'admin') && (
          <MenuGroup title="File Storage" icon={FolderOpen} section="files">
            <NavLink href="/files" icon={FolderOpen}>Files</NavLink>
          </MenuGroup>
        )}

        {/* Settings Section */}
        <MenuGroup title="Settings" icon={Settings} section="settings">
          <NavLink href="/security" icon={Shield}>Security</NavLink>
          {hasRole(user, 'admin') && (
            <>
              <NavLink href="/forms/templates" icon={ClipboardList}>Form Templates</NavLink>
              <NavLink href="/forms/submissions" icon={FileText}>Form Submissions</NavLink>
            </>
          )}
          {user?.superAdmin && (
            <>
              <NavLink href="/integrations" icon={Link2}>Integrations</NavLink>
              <NavLink href="/admin/advisors" icon={Bot}>Advisor Settings</NavLink>
            </>
          )}
          <NavLink href="/subscription" icon={CreditCard}>Subscription & Billing</NavLink>
          <NavLink href="/referrals" icon={Gift}>Referrals</NavLink>
          {user?.superAdmin && (
            <NavLink href="/settings" icon={Settings}>Business Settings</NavLink>
          )}
          <NavLink href="/user-guide" icon={BookOpen}>Help Guide</NavLink>
        </MenuGroup>
      </nav>

      <div className={cn("border-t border-white/20 pt-2 mt-auto", collapsed && "flex flex-col items-center")}>
        {!collapsed && (
          <div className="px-4 py-1 mb-1 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-medium shrink-0">
              {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 capitalize truncate">
                {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).join(' • ')}
              </p>
            </div>
          </div>
        )}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition-colors" 
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign Out</TooltipContent>
          </Tooltip>
        ) : (
          <button 
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-red-600 hover:text-white rounded-lg transition-colors" 
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            data-testid="button-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen flex bg-gray-100">
        {/* Desktop Sidebar - Navy Theme */}
        <aside 
          className={cn(
            "hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 print:hidden",
            sidebarCollapsed ? "w-16" : "w-64"
          )}
          style={{ backgroundColor: NAVY_PRIMARY }}
        >
          {/* Collapse Toggle Button */}
          <button
            className="absolute -right-3 top-6 z-10 h-6 w-6 rounded-full border border-slate-300 bg-white shadow-md hover:bg-gray-50 flex items-center justify-center"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            data-testid="button-toggle-sidebar"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4 text-slate-600" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            )}
          </button>
          
          <div className={cn(
            "flex-1 overflow-hidden flex flex-col",
            sidebarCollapsed ? "p-2" : "p-4"
          )}>
            <NavContent collapsed={sidebarCollapsed} />
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen bg-gray-100">
          {/* Mobile Header - Navy Theme */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 px-4 shadow-md md:hidden print:hidden" style={{ backgroundColor: NAVY_PRIMARY }}>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <button className="p-2 text-white hover:bg-white/10 rounded-lg">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle menu</span>
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[350px] p-6 border-white/20" style={{ backgroundColor: NAVY_PRIMARY }}>
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <NavContent collapsed={false} />
              </SheetContent>
            </Sheet>
            
            <img 
              src="/logo-foreman.png" 
              alt="FOREMAN - Keeping operations on track" 
              className="h-10 w-auto object-contain"
            />

            <div className="ml-auto flex items-center gap-2">
              <button 
                className="p-2 text-white hover:bg-white/10 rounded-lg"
                onClick={() => window.location.reload()}
                data-testid="button-refresh-app-mobile"
              >
                <RefreshCw className="h-5 w-5" />
                <span className="sr-only">Refresh app</span>
              </button>
              <button 
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                onClick={logout}
              >
                Sign Out
              </button>
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

          <main className="flex-1 p-4 md:p-6 lg:p-8 w-full bg-gray-100">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
          
          <GlobalAIAssistant />
          
          {/* Floating Refresh Button - Desktop */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-white hover:bg-gray-50 border border-gray-200 hidden md:flex items-center justify-center print:hidden z-40"
                onClick={() => window.location.reload()}
                data-testid="button-refresh-app-desktop"
              >
                <RefreshCw className="h-5 w-5 text-gray-600" />
                <span className="sr-only">Refresh app</span>
              </button>
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
