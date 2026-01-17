import { 
  Briefcase, 
  FileText, 
  Receipt, 
  Users, 
  Truck, 
  ClipboardCheck,
  MessageSquare,
  MapPin,
  Calendar,
  Settings,
  Home,
  Clock,
  CheckCircle,
  AlertTriangle,
  Wrench,
  ChevronRight,
  Bell,
  Search,
  User,
  BarChart3,
  FolderOpen
} from "lucide-react";

const navItems = [
  { icon: Home, label: 'Dashboard', active: true },
  { icon: Briefcase, label: 'Jobs', badge: 10 },
  { icon: FileText, label: 'Quotes', badge: 3 },
  { icon: Receipt, label: 'Invoices', badge: 2 },
  { icon: Users, label: 'Clients' },
  { icon: Calendar, label: 'Schedule' },
  { icon: MapPin, label: 'Live Map' },
  { icon: Truck, label: 'Fleet' },
  { icon: ClipboardCheck, label: 'Quality' },
  { icon: MessageSquare, label: 'Messages' },
  { icon: FolderOpen, label: 'Files' },
  { icon: BarChart3, label: 'Reports' },
  { icon: Settings, label: 'Settings' },
];

export default function BigChangeDashboardDemo() {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold text-white">TrueNorth</h1>
          <p className="text-slate-400 text-xs">Trade OS</p>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item, index) => (
            <a
              key={index}
              href="#"
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                item.active 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </nav>
        
        {/* User Section */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Dave Admin</p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="input-search"
              />
            </div>
            <button className="relative p-2 text-gray-500 hover:text-gray-700" data-testid="button-notifications">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Stats Row */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-5" data-testid="stat-active-jobs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Jobs</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">10</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className="text-green-600 font-medium">+2</span>
                <span className="text-gray-400 ml-1">from yesterday</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5" data-testid="stat-pending-quotes">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending Quotes</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">3</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className="text-gray-500">£12,450</span>
                <span className="text-gray-400 ml-1">total value</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5" data-testid="stat-unpaid-invoices">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Unpaid Invoices</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">2</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className="text-red-600 font-medium">£3,200</span>
                <span className="text-gray-400 ml-1">overdue</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5" data-testid="stat-team-members">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Team Active</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">5</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className="text-green-600 font-medium">All online</span>
              </div>
            </div>
          </section>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Jobs List */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Today's Jobs</h3>
                <a href="#" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1" data-testid="link-view-all-jobs">
                  View all <ChevronRight className="w-4 h-4" />
                </a>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50" data-testid="job-row-1">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Boiler Service - Smith Residence</p>
                    <p className="text-sm text-gray-500">123 High Street, London • John Engineer</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Completed
                  </span>
                </div>

                <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50" data-testid="job-row-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Electrical Rewire - Johnson Property</p>
                    <p className="text-sm text-gray-500">45 Oak Avenue, Manchester • Sarah Engineer</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    In Progress
                  </span>
                </div>

                <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50" data-testid="job-row-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">HVAC Installation - Tech Office</p>
                    <p className="text-sm text-gray-500">78 Business Park, Leeds • Mike Engineer</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    Scheduled
                  </span>
                </div>

                <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50" data-testid="job-row-4">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Emergency Repair - Water Leak</p>
                    <p className="text-sm text-gray-500">12 River Road, Birmingham • Unassigned</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    Urgent
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors" data-testid="button-new-job">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">New Job</span>
                  </button>
                  <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors" data-testid="button-new-quote">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-orange-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">New Quote</span>
                  </button>
                  <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors" data-testid="button-new-client">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">New Client</span>
                  </button>
                  <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors" data-testid="button-schedule">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Schedule</span>
                  </button>
                </div>
              </div>

              {/* Team Status */}
              <div className="bg-white rounded-lg shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Team Status</h3>
                  <a href="#" className="text-sm text-blue-600 hover:text-blue-700" data-testid="link-view-map">
                    View Map
                  </a>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="px-5 py-3 flex items-center gap-3" data-testid="team-member-1">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                      JE
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">John Engineer</p>
                      <p className="text-xs text-gray-500">On job • Smith Residence</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  </div>
                  <div className="px-5 py-3 flex items-center gap-3" data-testid="team-member-2">
                    <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center text-white text-sm font-medium">
                      SE
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Sarah Engineer</p>
                      <p className="text-xs text-gray-500">On job • Johnson Property</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  </div>
                  <div className="px-5 py-3 flex items-center gap-3" data-testid="team-member-3">
                    <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-medium">
                      ME
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Mike Engineer</p>
                      <p className="text-xs text-gray-500">Travelling • ETA 10 mins</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
