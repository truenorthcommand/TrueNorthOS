import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, FilePlus, User as UserIcon, Menu, Building2 as Building2Icon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
          FF
        </div>
        <span className="text-xl font-bold tracking-tight">FieldFlow</span>
      </div>

      <nav className="flex flex-col gap-2 flex-1">
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
           <Button
            variant="ghost"
            className="w-full justify-start h-12 text-lg font-medium opacity-50 cursor-not-allowed"
          >
            <UserIcon className="mr-3 h-5 w-5" />
            Engineers
          </Button>
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
            <NavContent />
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-2 md:hidden">
           <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            FF
          </div>
          <span className="text-lg font-bold">FieldFlow</span>
        </div>

        <div className="hidden md:flex items-center gap-6 w-full">
           <div className="flex items-center gap-2 mr-8">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
              FF
            </div>
            <span className="text-xl font-bold tracking-tight">FieldFlow</span>
          </div>
          
          <nav className="flex items-center gap-4">
             <Link href="/clients">
              <Button variant={location === "/clients" ? "secondary" : "ghost"}>
                Clients
              </Button>
            </Link>
             <Link href="/">
              <Button variant={location === "/" ? "secondary" : "ghost"}>
                Jobs List
              </Button>
            </Link>
             {user.role === "admin" && (
              <Button variant="ghost" className="opacity-50 cursor-not-allowed">
                Engineers
              </Button>
            )}
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
