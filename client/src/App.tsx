import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import JobDetail from "@/pages/job-detail";
import SignOff from "@/pages/sign-off";
import Clients from "@/pages/clients";
import Engineers from "@/pages/engineers";
import CompletedJobs from "@/pages/completed-jobs";
import Staff from "@/pages/staff";
import Home from "@/pages/home";
import CalendarPage from "@/pages/calendar";
import MapPage from "@/pages/map";
import Pricing from "@/pages/pricing";
import AiAdvisors from "@/pages/ai-advisors";
import AdminAdvisors from "@/pages/admin-advisors";
import { Layout } from "@/components/layout";
import { LocationTracker } from "@/components/location-tracker";
import { Loader2 } from "lucide-react";

function PrivateRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    if (location !== "/auth") {
      setTimeout(() => setLocation("/auth"), 0);
    }
    return null;
  }

  return (
    <Layout>
      <Component {...rest} />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/home" component={Home} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/auth" component={Login} />
      <Route path="/clients">
        <PrivateRoute component={Clients} />
      </Route>
      <Route path="/engineers">
        <PrivateRoute component={Engineers} />
      </Route>
      <Route path="/completed-jobs">
        <PrivateRoute component={CompletedJobs} />
      </Route>
      <Route path="/staff">
        <PrivateRoute component={Staff} />
      </Route>
      <Route path="/calendar">
        <PrivateRoute component={CalendarPage} />
      </Route>
      <Route path="/map">
        <PrivateRoute component={MapPage} />
      </Route>
      <Route path="/ai-advisors">
        <PrivateRoute component={AiAdvisors} />
      </Route>
      <Route path="/admin/advisors">
        <PrivateRoute component={AdminAdvisors} />
      </Route>
      <Route path="/">
        <PrivateRoute component={Dashboard} />
      </Route>
      <Route path="/jobs/:id">
        <PrivateRoute component={JobDetail} />
      </Route>
      <Route path="/jobs/:id/sign-off">
        <PrivateRoute component={SignOff} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StoreProvider>
          <TooltipProvider>
            <LocationTracker />
            <Toaster />
            <Router />
          </TooltipProvider>
        </StoreProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
