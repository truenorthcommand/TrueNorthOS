import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { useVersionCheck } from "@/hooks/use-version-check";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import SignOff from "@/pages/sign-off";
import Clients from "@/pages/clients";
import Engineers from "@/pages/engineers";
import CompletedJobs from "@/pages/completed-jobs";
import Staff from "@/pages/staff";
import Home from "@/pages/home";
import CalendarPage from "@/pages/schedule/calendar";
import PlannerPage from "@/pages/schedule/planner";
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
import Analytics from "@/pages/analytics";
import VoiceNotes from "@/pages/voice-notes";
import DocumentScanner from "@/pages/document-scanner";
import Proposal from "@/pages/proposal";
import UserGuide from "@/pages/user-guide";
import WorksManagerDashboard from "@/pages/works-manager-dashboard";
import WorksManagerJobs from "@/pages/works-manager-jobs";
import WorksManagerMap from "@/pages/works-manager-map";
import WorksManagerApprovals from "@/pages/works-manager-approvals";
import Inspections from "@/pages/inspections";
import InspectionDetail from "@/pages/inspection-detail";
import SnaggingSheets from "@/pages/snagging-sheets";
import SnaggingDetail from "@/pages/snagging-detail";
import AccountsDashboard from "@/pages/accounts-dashboard";
import OutlookInbox from "@/pages/outlook-inbox";
import Files from "@/pages/files";
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
      <Route path="/proposal" component={Proposal} />
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
      <Route path="/schedule/calendar">
        <PrivateRoute component={CalendarPage} />
      </Route>
      <Route path="/schedule/planner">
        <PrivateRoute component={PlannerPage} />
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
      <Route path="/analytics">
        <PrivateRoute component={Analytics} />
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
      <Route path="/voice-notes">
        <PrivateRoute component={VoiceNotes} />
      </Route>
      <Route path="/files">
        <PrivateRoute component={Files} />
      </Route>
      <Route path="/document-scanner">
        <PrivateRoute component={DocumentScanner} />
      </Route>
      <Route path="/user-guide">
        <PrivateRoute component={UserGuide} />
      </Route>
      <Route path="/admin/advisors">
        <PrivateRoute component={AdminAdvisors} />
      </Route>
      <Route path="/works-manager">
        <PrivateRoute component={WorksManagerDashboard} />
      </Route>
      <Route path="/works-manager/jobs">
        <PrivateRoute component={WorksManagerJobs} />
      </Route>
      <Route path="/works-manager/map">
        <PrivateRoute component={WorksManagerMap} />
      </Route>
      <Route path="/works-manager/approvals">
        <PrivateRoute component={WorksManagerApprovals} />
      </Route>
      <Route path="/inspections">
        <PrivateRoute component={Inspections} />
      </Route>
      <Route path="/inspections/:id">
        <PrivateRoute component={InspectionDetail} />
      </Route>
      <Route path="/snagging">
        <PrivateRoute component={SnaggingSheets} />
      </Route>
      <Route path="/snagging/:id">
        <PrivateRoute component={SnaggingDetail} />
      </Route>
      <Route path="/accounts">
        <PrivateRoute component={AccountsDashboard} />
      </Route>
      <Route path="/outlook-inbox">
        <PrivateRoute component={OutlookInbox} />
      </Route>
      <Route path="/">
        <PrivateRoute component={Dashboard} />
      </Route>
      <Route path="/jobs">
        <PrivateRoute component={Jobs} />
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
  useVersionCheck();
  
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
