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
import UserGuides from "@/pages/user-guides";
import Setup from "@/pages/setup";
import TimeLogs from "@/pages/time-logs";
import Quotes from "@/pages/quotes";
import QuoteDetail from "@/pages/quote-detail";
import ClientQuote from "@/pages/client-quote";
import Invoices from "@/pages/invoices";
import InvoiceDetail from "@/pages/invoice-detail";
import ClientInvoice from "@/pages/client-invoice";
import Settings from "@/pages/settings";
import Security from "@/pages/security";
import Messages from "@/pages/messages";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Fleet from "@/pages/fleet";
import FleetVehicles from "@/pages/fleet-vehicles";
import VehicleDetail from "@/pages/vehicle-detail";
import WalkaroundCheck from "@/pages/walkaround-check";
import ReportDefect from "@/pages/report-defect";
import DefectDetail from "@/pages/defect-detail";
import Timesheets from "@/pages/timesheets";
import Expenses from "@/pages/expenses";
import Payments from "@/pages/payments";
import { Layout } from "@/components/layout";
import { LocationTracker } from "@/components/location-tracker";
import { CookieConsent } from "@/components/cookie-consent";
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
      <Route path="/guides" component={UserGuides} />
      <Route path="/auth" component={Login} />
      <Route path="/setup" component={Setup} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
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
      <Route path="/time-logs">
        <PrivateRoute component={TimeLogs} />
      </Route>
      <Route path="/timesheets">
        <PrivateRoute component={Timesheets} />
      </Route>
      <Route path="/expenses">
        <PrivateRoute component={Expenses} />
      </Route>
      <Route path="/payments">
        <PrivateRoute component={Payments} />
      </Route>
      <Route path="/quotes">
        <PrivateRoute component={Quotes} />
      </Route>
      <Route path="/quotes/:id">
        <PrivateRoute component={QuoteDetail} />
      </Route>
      <Route path="/quote/:token" component={ClientQuote} />
      <Route path="/invoices">
        <PrivateRoute component={Invoices} />
      </Route>
      <Route path="/invoices/:id">
        <PrivateRoute component={InvoiceDetail} />
      </Route>
      <Route path="/invoice/:token" component={ClientInvoice} />
      <Route path="/settings">
        <PrivateRoute component={Settings} />
      </Route>
      <Route path="/security">
        <PrivateRoute component={Security} />
      </Route>
      <Route path="/messages">
        <PrivateRoute component={Messages} />
      </Route>
      <Route path="/fleet">
        <PrivateRoute component={Fleet} />
      </Route>
      <Route path="/fleet/vehicles">
        <PrivateRoute component={FleetVehicles} />
      </Route>
      <Route path="/fleet/vehicles/:id">
        <PrivateRoute component={VehicleDetail} />
      </Route>
      <Route path="/fleet/walkaround">
        <PrivateRoute component={WalkaroundCheck} />
      </Route>
      <Route path="/fleet/report-defect">
        <PrivateRoute component={ReportDefect} />
      </Route>
      <Route path="/fleet/defects/:id">
        <PrivateRoute component={DefectDetail} />
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
            <CookieConsent />
            <Router />
          </TooltipProvider>
        </StoreProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
