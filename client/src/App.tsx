import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { hasRole, Role } from "@/lib/types";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme";
import { GoogleMapsProvider } from "@/components/google-maps-provider";
import { useVersionCheck } from "@/hooks/use-version-check";
import { SessionTimeoutWarning } from "@/components/session-timeout-warning";
import NotFound from "@/pages/not-found";
import WorkflowStudio from "@/pages/workflow-studio";
import WorkflowEditor from "@/pages/workflow-editor";
import Login from "@/pages/login";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import CreateJob from "@/pages/create-job";
import EditJob from "@/pages/edit-job";
import EngineerDashboard from "@/pages/engineer-dashboard";
import EngineerJobs from "@/pages/engineer-jobs";
import WalkaroundWizard from "@/pages/walkaround-wizard";
import JobCompleteWizard from "@/pages/job-complete-wizard";
import QuickReceipt from "@/pages/quick-receipt";
import QuickTimesheet from "@/pages/quick-timesheet";
import EngineerReport from "@/pages/engineer-report";
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
import Receipts from "@/pages/receipts";
import FlaggedReceipts from "@/pages/flagged-receipts";
import MaterialProfiles from "@/pages/material-profiles";
import VendorRules from "@/pages/vendor-rules";
import DeductionLedger from "@/pages/deduction-ledger";
import Payments from "@/pages/payments";
import Analytics from "@/pages/analytics";
import DirectorsSuite from "@/pages/directors-suite";
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
import SnagReviewQueue from "@/pages/snag-review-queue";
import AccountsDashboard from "@/pages/accounts-dashboard";
import Files from "@/pages/files";
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
import PropertyIntelligence from "@/pages/property-intelligence";
import Surveys from "@/pages/surveys";
import SurveyWizard from "@/pages/survey-wizard";
import AdminFeedback from "@/pages/admin-feedback";
import ResourcePlanner from "@/pages/resource-planner";
import QuoteAccept from "@/pages/quote-accept";
import { Layout } from "@/components/layout";
import { LocationTracker } from "@/components/location-tracker";
import { CookieConsent } from "@/components/cookie-consent";
import { CachePromptModal } from "@/components/cache-prompt-modal";
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

// Role-based route guard - redirects unauthorized users to their appropriate dashboard
function RoleGuard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  if (!user) return null;
  
  // Directors have full access to all areas (like admin)
  const userRoles = user.roles || [user.role];
  const isDirector = userRoles.includes('director');
  
  if (!isDirector && !hasRole(user, ...roles)) {
    // Redirect engineers to their dashboard
    if (user.role === 'engineer' || (user.roles && user.roles.length === 1 && user.roles[0] === 'engineer')) {
      setLocation('/my-day');
    } else {
      setLocation('/');
    }
    return null;
  }
  
  return <>{children}</>;
}

// HOC to wrap a component with role protection
function withRole(Component: React.ComponentType<any>, ...roles: Role[]) {
  return function RoleProtectedRoute(props: any) {
    return (
      <RoleGuard roles={roles}>
        <Component {...props} />
      </RoleGuard>
    );
  };
}

function AppRoutes() {
  return (
    <AuthGate>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/my-day" component={EngineerDashboard} />
        <Route path="/my-jobs" component={EngineerJobs} />
        <Route path="/walkaround" component={WalkaroundWizard} />
        <Route path="/receipt/new" component={QuickReceipt} />
        <Route path="/timesheet" component={QuickTimesheet} />
        <Route path="/jobs" component={withRole(Jobs, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/jobs/new" component={withRole(CreateJob, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/jobs/:id/edit" component={withRole(EditJob, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/jobs/:id/report" component={EngineerReport} />
        <Route path="/jobs/:id/complete" component={JobCompleteWizard} />
        <Route path="/clients" component={withRole(Clients, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/clients/new" component={withRole(AddClient, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/clients/:id" component={withRole(ClientDetail, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/create-job-sheet" component={withRole(Clients, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/engineers" component={withRole(Engineers, 'admin', 'works_manager')} />
        <Route path="/completed-jobs" component={withRole(CompletedJobs, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/staff" component={withRole(Staff, 'admin')} />
        <Route path="/calendar" component={withRole(CalendarPage, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/schedule/calendar" component={withRole(CalendarPage, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/schedule/planner" component={withRole(PlannerPage, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/map" component={withRole(MapPage, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/today" component={withRole(Today, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/time-logs" component={withRole(TimeLogs, 'admin', 'accounts')} />
        <Route path="/timesheets" component={withRole(Timesheets, 'admin', 'accounts')} />
        <Route path="/receipts" component={withRole(Receipts, 'admin', 'accounts')} />
        <Route path="/flagged-receipts" component={withRole(FlaggedReceipts, 'admin', 'accounts')} />
        <Route path="/material-profiles" component={withRole(MaterialProfiles, 'admin')} />
        <Route path="/vendor-rules" component={withRole(VendorRules, 'admin')} />
        <Route path="/deduction-ledger" component={withRole(DeductionLedger, 'admin', 'accounts')} />
        <Route path="/payments" component={withRole(Payments, 'admin', 'accounts')} />
        <Route path="/analytics" component={withRole(Analytics, 'admin', 'director')} />
        <Route path="/directors" component={withRole(DirectorsSuite, 'admin', 'director')} />
        <Route path="/subscription" component={withRole(Subscription, 'admin')} />
        <Route path="/referrals" component={withRole(Referrals, 'admin')} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/workflows" component={withRole(Workflows, 'admin')} />
        <Route path="/exceptions" component={withRole(Exceptions, 'admin', 'works_manager')} />
        <Route path="/assets" component={withRole(Assets, 'admin', 'works_manager')} />
        <Route path="/assets/new" component={withRole(AssetForm, 'admin', 'works_manager')} />
        <Route path="/assets/:id" component={withRole(AssetDetail, 'admin', 'works_manager')} />
        <Route path="/assets/:id/edit" component={withRole(AssetForm, 'admin', 'works_manager')} />
        <Route path="/quotes" component={withRole(Quotes, 'admin', 'surveyor')} />
        <Route path="/quotes/new" component={withRole(CreateQuote, 'admin', 'surveyor')} />
        <Route path="/quotes/:id" component={withRole(QuoteDetail, 'admin', 'surveyor')} />
        <Route path="/surveys" component={withRole(Surveys, 'admin', 'surveyor')} />
        <Route path="/surveys/:id" component={withRole(SurveyWizard, 'admin', 'surveyor')} />
        <Route path="/resource-planner" component={withRole(ResourcePlanner, 'admin', 'works_manager')} />
        <Route path="/invoices" component={withRole(Invoices, 'admin', 'accounts')} />
        <Route path="/invoices/:id" component={withRole(InvoiceDetail, 'admin', 'accounts')} />
        <Route path="/settings" component={withRole(Settings, 'admin')} />
        <Route path="/integrations" component={withRole(Integrations, 'admin')} />
        <Route path="/intelligence" component={withRole(PropertyIntelligence, 'admin', 'surveyor')} />
        <Route path="/security" component={withRole(Security, 'admin')} />
        <Route path="/messages" component={Messages} />
        <Route path="/fleet" component={withRole(Fleet, 'admin', 'fleet_manager')} />
        <Route path="/fleet/vehicles" component={withRole(FleetVehicles, 'admin', 'fleet_manager')} />
        <Route path="/fleet/vehicles/:id" component={withRole(VehicleDetail, 'admin', 'fleet_manager')} />
        <Route path="/fleet/walkaround" component={WalkaroundCheck} />
        <Route path="/fleet/report-defect" component={ReportDefect} />
        <Route path="/fleet/defects/:id" component={DefectDetail} />
        <Route path="/ai-advisors" component={withRole(AiAdvisors, 'admin')} />
        <Route path="/ai-tools" component={withRole(AITools, 'admin')} />
        <Route path="/voice-notes" component={VoiceNotes} />
        <Route path="/files" component={Files} />
        <Route path="/document-scanner" component={DocumentScanner} />
        <Route path="/scan" component={ScanPage} />
        <Route path="/user-guide" component={UserGuide} />
        <Route path="/admin/advisors" component={withRole(AdminAdvisors, 'admin')} />
        <Route path="/admin/merchants" component={withRole(AdminMerchants, 'admin')} />
        <Route path="/admin/feedback" component={withRole(AdminFeedback, 'admin')} />
        <Route path="/works-manager" component={withRole(WorksManagerDashboard, 'admin', 'works_manager')} />
        <Route path="/works-manager/jobs" component={withRole(WorksManagerJobs, 'admin', 'works_manager')} />
        <Route path="/works-manager/map" component={withRole(WorksManagerMap, 'admin', 'works_manager')} />
        <Route path="/works-manager/approvals" component={withRole(WorksManagerApprovals, 'admin', 'works_manager')} />
        <Route path="/snag-review" component={withRole(SnagReviewQueue, 'admin', 'works_manager')} />
        <Route path="/inspections" component={withRole(Inspections, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/inspections/:id" component={withRole(InspectionDetail, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/snagging" component={withRole(SnaggingSheets, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/snagging/:id" component={withRole(SnaggingDetail, 'admin', 'surveyor', 'works_manager')} />
        <Route path="/accounts" component={withRole(AccountsDashboard, 'admin', 'accounts')} />
        <Route path="/forms/templates" component={withRole(FormTemplates, 'admin')} />
        <Route path="/forms/builder/:id" component={withRole(FormBuilder, 'admin')} />
        <Route path="/forms/fill/:versionId" component={FormFill} />
        <Route path="/forms/submissions" component={withRole(FormSubmissions, 'admin', 'works_manager')} />
        <Route path="/system/workflows" component={withRole(WorkflowStudio, 'admin')} />
        <Route path="/system/workflows/:id" component={withRole(WorkflowEditor, 'admin')} />
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
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/setup" component={Setup} />
      <Route path="/guides" component={UserGuides} />

      <Route path="/quote/:token" component={ClientQuote} />
      <Route path="/quotes/accept/:token" component={QuoteAccept} />
      <Route path="/portal/:token/reset/:resetToken" component={CustomerPortal} />
      <Route path="/portal/:token" component={CustomerPortal} />
      <Route path="/invoice/:token" component={ClientInvoice} />

      <Route path="/proposal" component={Proposal} />
      <Route path="/pitch/investor" component={PitchInvestor} />
      <Route path="/pitch/sales" component={PitchSales} />
      <Route path="/pitch/onepager" component={PitchOnePager} />

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
          <GoogleMapsProvider>
            <StoreProvider>
              <TooltipProvider>
                <LocationTracker />
                <Toaster />
                <SessionTimeoutWarning />
                <CookieConsent />
                <CachePromptModal />
                <Router />
              </TooltipProvider>
            </StoreProvider>
          </GoogleMapsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
