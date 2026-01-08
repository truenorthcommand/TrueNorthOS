import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, FilePlus, User as UserIcon, Menu, Building2 as Building2Icon, CheckCircle2, Users, Home, Calendar, MapPin, Bot, Clock, FileText, Receipt, Settings, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  const NavContent = () => (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2 mb-6 px-2">
        <img src="/logo.png" alt="TrueNorth Logo" className="w-8 h-8 rounded-md" />
        <span className="text-xl font-bold tracking-tight">Field View</span>
      </div>

      <nav className="flex flex-col gap-2 flex-1">
        <Link href="/home">
          <Button
            variant={location === "/home" ? "secondary" : "ghost"}
            className="w-full justify-start h-12 text-lg font-medium"
            onClick={() => setIsOpen(false)}
          >
            <Home className="mr-3 h-5 w-5" />
            Home
          </Button>
        </Link>

        {user.role === "admin" && (
          <Link href="/clients">
            <Button
              variant={location === "/clients" ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium"
              onClick={() => setIsOpen(false)}
            >
              <Building2Icon className="mr-3 h-5 w-5" />
              Clients
            </Button>
          </Link>
        )}
        
        <Link href="/">
          <Button
            variant={location === "/" ? "secondary" : "ghost"}
            className="w-full justify-start h-12 text-lg font-medium"
            onClick={() => setIsOpen(false)}
          >
            <LayoutDashboard className="mr-3 h-5 w-5" />
            Jobs List
          </Button>
        </Link>

        {user.role === "admin" && (
          <Link href="/engineers">
            <Button
              variant={location === "/engineers" ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium"
              onClick={() => setIsOpen(false)}
            >
              <UserIcon className="mr-3 h-5 w-5" />
              Engineers
            </Button>
          </Link>
        )}

        {user.role === "admin" && (
          <Link href="/completed-jobs">
            <Button
              variant={location === "/completed-jobs" ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium"
              onClick={() => setIsOpen(false)}
            >
              <CheckCircle2 className="mr-3 h-5 w-5" />
              Completed Jobs
            </Button>
          </Link>
        )}

        {user.superAdmin && (
          <Link href="/staff">
            <Button
              variant={location === "/staff" ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium"
              onClick={() => setIsOpen(false)}
            >
              <Users className="mr-3 h-5 w-5" />
              Staff Management
            </Button>
          </Link>
        )}

        {user.role === "admin" && (
          <Link href="/calendar">
            <Button
              variant={location === "/calendar" ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium"
              onClick={() => setIsOpen(false)}
            >
              <Calendar className="mr-3 h-5 w-5" />
              Calendar
            </Button>
          </Link>
        )}

        {user.role === "admin" && (
          <Link href="/map">
            <Button
              variant={location === "/map" ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium"
              onClick={() => setIsOpen(false)}
            >
              <MapPin className="mr-3 h-5 w-5" />
              Live Map
            </Button>
          </Link>
        )}

        {user.role === "admin" && (
          <Link href="/time-logs">
            <Button
              variant={location === "/time-logs" ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium"
              onClick={() => setIsOpen(false)}
            >
              <Clock className="mr-3 h-5 w-5" />
              Time Logs
            </Button>
          </Link>
        )}

        {user.role === "admin" && (
          <Link href="/quotes">
            <Button
              variant={location.startsWith("/quotes") ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium"
              onClick={() => setIsOpen(false)}
            >
              <FileText className="mr-3 h-5 w-5" />
              Quotes
            </Button>
          </Link>
        )}

        {user.role === "admin" && (
          <Link href="/invoices">
            <Button
              variant={location.startsWith("/invoices") ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium"
              onClick={() => setIsOpen(false)}
            >
              <Receipt className="mr-3 h-5 w-5" />
              Invoices
            </Button>
          </Link>
        )}

        {user.role === "admin" && (
          <Link href="/settings">
            <Button
              variant={location === "/settings" ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="mr-3 h-5 w-5" />
              Settings
            </Button>
          </Link>
        )}

        <Link href="/ai-advisors">
          <Button
            variant={location === "/ai-advisors" ? "secondary" : "ghost"}
            className="w-full justify-start h-12 text-lg font-medium"
            onClick={() => setIsOpen(false)}
          >
            <Bot className="mr-3 h-5 w-5" />
            Technical Advisor
          </Button>
        </Link>

        {user.role === "admin" && (
          <Link href="/admin/advisors">
            <Button
              variant={location === "/admin/advisors" ? "secondary" : "ghost"}
              className="w-full justify-start h-12 text-lg font-medium text-muted-foreground"
              onClick={() => setIsOpen(false)}
            >
              <Bot className="mr-3 h-5 w-5" />
              AI Settings
            </Button>
          </Link>
        )}
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
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6 shadow-sm">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[350px] p-6">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <NavContent />
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-2 md:hidden">
          <img src="/logo.png" alt="TrueNorth Logo" className="w-8 h-8 rounded-md" />
          <span className="text-lg font-bold">Field View</span>
        </div>

        <div className="hidden md:flex items-center gap-6 w-full">
           <div className="flex items-center gap-2 mr-8">
            <img src="/logo.png" alt="TrueNorth Logo" className="w-8 h-8 rounded-md" />
            <span className="text-xl font-bold tracking-tight">Field View</span>
          </div>
          
          <nav className="flex items-center gap-1">
            <Link href="/home">
              <Button variant={location === "/home" ? "secondary" : "ghost"} size="sm">
                Home
              </Button>
            </Link>

            <Link href="/">
              <Button variant={location === "/" ? "secondary" : "ghost"} size="sm">
                Jobs
              </Button>
            </Link>

            {user.role === "admin" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant={["/completed-jobs", "/calendar", "/time-logs"].some(p => location === p) ? "secondary" : "ghost"} 
                    size="sm"
                  >
                    Schedule <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <Link href="/completed-jobs">
                    <DropdownMenuItem className="cursor-pointer">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Completed Jobs
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/calendar">
                    <DropdownMenuItem className="cursor-pointer">
                      <Calendar className="mr-2 h-4 w-4" />
                      Calendar
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/time-logs">
                    <DropdownMenuItem className="cursor-pointer">
                      <Clock className="mr-2 h-4 w-4" />
                      Time Logs
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {user.role === "admin" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant={["/clients", "/quotes", "/invoices"].some(p => location.startsWith(p)) ? "secondary" : "ghost"} 
                    size="sm"
                  >
                    Sales <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <Link href="/clients">
                    <DropdownMenuItem className="cursor-pointer">
                      <Building2Icon className="mr-2 h-4 w-4" />
                      Clients
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/quotes">
                    <DropdownMenuItem className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      Quotes
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/invoices">
                    <DropdownMenuItem className="cursor-pointer">
                      <Receipt className="mr-2 h-4 w-4" />
                      Invoices
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {user.role === "admin" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant={["/engineers", "/staff", "/map"].some(p => location === p) ? "secondary" : "ghost"} 
                    size="sm"
                  >
                    Team <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <Link href="/engineers">
                    <DropdownMenuItem className="cursor-pointer">
                      <UserIcon className="mr-2 h-4 w-4" />
                      Engineers
                    </DropdownMenuItem>
                  </Link>
                  {user.superAdmin && (
                    <Link href="/staff">
                      <DropdownMenuItem className="cursor-pointer">
                        <Users className="mr-2 h-4 w-4" />
                        Staff Management
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <Link href="/map">
                    <DropdownMenuItem className="cursor-pointer">
                      <MapPin className="mr-2 h-4 w-4" />
                      Live Map
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant={["/ai-advisors", "/settings", "/admin/advisors"].some(p => location === p) ? "secondary" : "ghost"} 
                  size="sm"
                >
                  More <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <Link href="/ai-advisors">
                  <DropdownMenuItem className="cursor-pointer">
                    <Bot className="mr-2 h-4 w-4" />
                    Technical Advisor
                  </DropdownMenuItem>
                </Link>
                {user.role === "admin" && (
                  <Link href="/settings">
                    <DropdownMenuItem className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                  </Link>
                )}
                {user.role === "admin" && (
                  <Link href="/admin/advisors">
                    <DropdownMenuItem className="cursor-pointer">
                      <Bot className="mr-2 h-4 w-4" />
                      AI Settings
                    </DropdownMenuItem>
                  </Link>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <div className="text-right hidden lg:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full no-print">
        {children}
      </main>
    </div>
  );
}
