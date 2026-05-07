import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme";
import { useVersionCheck } from "@/hooks/use-version-check";
import NotFound from "@/pages/not-found";
import WorkflowStudio from "@/pages/workflow-studio";
import WorkflowEditor from "@/pages/workflow-editor";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import CreateJob from "@/pages/create-job";
import EngineerDashboard from "@/pages/engineer-dashboard";
import WalkaroundWizard from "@/pages/walkaround-wizard";
import JobCompleteWizard from "@/pages/job-complete-wizard";
import QuickExpense from "@/pages/quick-expense";
import QuickTimesheet from "@/pages/quick-timesheet";
import SignOff from "@/pages/sign-off";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import AddClient from "@/pages/add-client";
import Engineers from "@/pages/engineers";
// Force rebuild - client detail route fix
import CompletedJobs from "@/pages/completed-jobs";
import Staff from "@/pages/staff";
import CalendarPage from "@/pages/schedule/calendar";
import PlannerPage from "@/pages/schedule/planner";
import MapPage from "@/pages/map";
import AiAdvisors from "@/pages/ai-advisors";
import AdminAdvisors from "@/pages/admin-advisors";
import AITools from "@/pages/ai-tools";
import UserGuides from "@/pages/user-guides";
import Setup from "@/pages/setup";
import TimeLogs from "@/pages/time-logs";
import Quotes from "@/pages/quotes";
import QuoteDetail from "@/pages/quote-detail";
import ClientQuote from "@/pages/client-quote";
import CreateQuote from "@/pages/create-quote";
import CustomerPortal from "@/pages/customer-portal";
import Invoices from "@/pages/invoices";
import InvoiceDetail from "@/pages/invoice-detail";
import ClientInvoice from "@/pages/client-invoice";
import Settings from "@/pages/settings";
import Integrations from "@/pages/integrations";
import Security from "@/pages/security";
import Messages from "@/pages/messages";
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
import DirectorsSuite from "@/pages/directors-suite";
import DemoDirectorsSuite from "@/pages/demo-directors";
import Subscription from "@/pages/subscription";
import Referrals from "@/pages/referrals";
import NotificationsPage from "@/pages/notifications";
import Workflows from "@/pages/workflows";
import VoiceNotes from "@/pages/voice-notes";
import DocumentScanner from "@/pages/document-scanner";
import ScanPage from "@/pages/scan";
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
import Files from "@/pages/files";
import GlassDemo from "@/pages/glass-demo";
import GlassDashboardDemo from "@/pages/glass-dashboard-demo";
import IconStylesDemo from "@/pages/icon-styles-demo";
import GlowDashboardDemo from "@/pages/glow-dashboard-demo";
import BigChangeDashboardDemo from "@/pages/bigchange-dashboard-demo";
import PitchInvestor from "@/pages/pitch-investor";
import PitchSales from "@/pages/pitch-sales";
import PitchOnePager from "@/pages/pitch-onepager";
import FormTemplates from "@/pages/forms/templates";
import FormBuilder from "@/pages/forms/builder";
import FormFill from "@/pages/forms/fill";
import FormSubmissions from "@/pages/forms/submissions";
import Today from "@/pages/today";
import Exceptions from "@/pages/exceptions";
import Assets from "@/pages/assets";
import AssetDetail from "@/pages/asset-detail";
import AssetForm from "@/pages/asset-form";
import MerchantPortal from "@/pages/merchant-portal";
import AdminMerchants from "@/pages/admin-merchants";
import AdminBlog from "@/pages/admin-blog";
import PropertyIntelligence from "@/pages/property-intelligence";
import { Layout } from "@/components/layout";
import { LocationTracker } from "@/components/location-tracker";
import { CookieConsent } from "@/components/cookie-consent";
import { Loader2 } from "lucide-react";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    window.location.replace('/login');
    return null;
  }

  return (
    <Layout>
      {children}
    </Layout>
  );
}

function AppRoutes() {
  return (
    <AuthGate>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/my-day" component={EngineerDashboard} />
        <Route path="/walkaround" component={WalkaroundWizard} />
        <Route path="/expense/new" component={QuickExpense} />
        <Route path="/timesheet" component={QuickTimesheet} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/jobs/new" component={CreateJob} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/jobs/:id/sign-off" component={SignOff} />
        <Route path="/jobs/:id/complete" component={JobCompleteWizard} />
        <Route path="/clients" component={Clients} />
        <Route path="/clients/new" component={AddClient} />
        <Route path="/clients/:id" component={ClientDetail} />
        <Route path="/create-job-sheet" component={Clients} />
        <Route path="/engineers" component={Engineers} />
        <Route path="/completed-jobs" component={CompletedJobs} />
        <Route path="/staff" component={Staff} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/schedule/calendar" component={CalendarPage} />
        <Route path="/schedule/planner" component={PlannerPage} />
        <Route path="/map" component={MapPage} />
        <Route path="/today" component={Today} />
        <Route path="/time-logs" component={TimeLogs} />
        <Route path="/timesheets" component={Timesheets} />
        <Route path="/expenses" component={Expenses} />
        <Route path="/payments" component={Payments} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/directors" component={DirectorsSuite} />
        <Route path="/subscription" component={Subscription} />
        <Route path="/referrals" component={Referrals} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/workflows" component={Workflows} />
        <Route path="/exceptions" component={Exceptions} />
        <Route path="/assets" component={Assets} />
        <Route path="/assets/new" component={AssetForm} />
        <Route path="/assets/:id" component={AssetDetail} />
        <Route path="/assets/:id/edit" component={AssetForm} />
        <Route path="/quotes" component={Quotes} />
        <Route path="/quotes/new" component={CreateQuote} />
        <Route path="/quotes/:id" component={QuoteDetail} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/invoices/:id" component={InvoiceDetail} />
        <Route path="/settings" component={Settings} />
        <Route path="/integrations" component={Integrations} />
        <Route path="/intelligence" component={PropertyIntelligence} />
        <Route path="/security" component={Security} />
        <Route path="/messages" component={Messages} />
        <Route path="/fleet" component={Fleet} />
        <Route path="/fleet/vehicles" component={FleetVehicles} />
        <Route path="/fleet/vehicles/:id" component={VehicleDetail} />
        <Route path="/fleet/walkaround" component={WalkaroundCheck} />
        <Route path="/fleet/report-defect" component={ReportDefect} />
        <Route path="/fleet/defects/:id" component={DefectDetail} />
        <Route path="/ai-advisors" component={AiAdvisors} />
        <Route path="/ai-tools" component={AITools} />
        <Route path="/voice-notes" component={VoiceNotes} />
        <Route path="/files" component={Files} />
        <Route path="/document-scanner" component={DocumentScanner} />
        <Route path="/scan" component={ScanPage} />
        <Route path="/user-guide" component={UserGuide} />
        <Route path="/admin/advisors" component={AdminAdvisors} />
        <Route path="/admin/merchants" component={AdminMerchants} />
        <Route path="/blog" component={AdminBlog} />
        <Route path="/works-manager" component={WorksManagerDashboard} />
        <Route path="/works-manager/jobs" component={WorksManagerJobs} />
        <Route path="/works-manager/map" component={WorksManagerMap} />
        <Route path="/works-manager/approvals" component={WorksManagerApprovals} />
        <Route path="/inspections" component={Inspections} />
        <Route path="/inspections/:id" component={InspectionDetail} />
        <Route path="/snagging" component={SnaggingSheets} />
        <Route path="/snagging/:id" component={SnaggingDetail} />
        <Route path="/accounts" component={AccountsDashboard} />
        <Route path="/forms/templates" component={FormTemplates} />
        <Route path="/forms/builder/:id" component={FormBuilder} />
        <Route path="/forms/fill/:versionId" component={FormFill} />
        <Route path="/forms/submissions" component={FormSubmissions} />
        <Route path="/system/workflows" component={WorkflowStudio} />
        <Route path="/system/workflows/:id" component={WorkflowEditor} />
        <Route component={NotFound} />
      </Switch>
    </AuthGate>
  );
}

function RedirectToLogin() {
  window.location.replace('/login');
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RedirectToLogin} />
      <Route path="/login" component={Login} />
      <Route path="/setup" component={Setup} />
      <Route path="/guides" component={UserGuides} />

      <Route path="/quote/:token" component={ClientQuote} />
      <Route path="/portal/:token/reset/:resetToken" component={CustomerPortal} />
      <Route path="/portal/:token" component={CustomerPortal} />
      <Route path="/invoice/:token" component={ClientInvoice} />

      <Route path="/proposal" component={Proposal} />
      <Route path="/demo/directors" component={DemoDirectorsSuite} />
      <Route path="/pitch/investor" component={PitchInvestor} />
      <Route path="/pitch/sales" component={PitchSales} />
      <Route path="/pitch/onepager" component={PitchOnePager} />
      <Route path="/glass-demo" component={GlassDemo} />
      <Route path="/glass-dashboard" component={GlassDashboardDemo} />
      <Route path="/icon-styles" component={IconStylesDemo} />
      <Route path="/glow-dashboard" component={GlowDashboardDemo} />
      <Route path="/bigchange-dashboard" component={BigChangeDashboardDemo} />

      <Route path="/merchant" component={MerchantPortal} />

      <Route path="/app" nest>
        <AppRoutes />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useVersionCheck();
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
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
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
