import { 
  Briefcase, 
  FileText, 
  Receipt, 
  Users, 
  Plus, 
  ArrowRight, 
  Truck, 
  ClipboardCheck,
  MessageSquare,
  MapPin,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Wrench
} from "lucide-react";
import "@/components/GlassCard.css";

function GlowIcon({ Icon, color }: { Icon: React.ComponentType<{ className?: string }>, color: string }) {
  const colorMap: Record<string, { bg: string, glow: string, text: string }> = {
    blue: { bg: 'from-blue-400 to-blue-600', glow: 'bg-blue-400', text: 'text-blue-600' },
    orange: { bg: 'from-orange-400 to-orange-600', glow: 'bg-orange-400', text: 'text-orange-600' },
    red: { bg: 'from-red-400 to-red-600', glow: 'bg-red-400', text: 'text-red-600' },
    teal: { bg: 'from-teal-400 to-teal-600', glow: 'bg-teal-400', text: 'text-teal-600' },
    purple: { bg: 'from-purple-400 to-purple-600', glow: 'bg-purple-400', text: 'text-purple-600' },
    green: { bg: 'from-green-400 to-green-600', glow: 'bg-green-400', text: 'text-green-600' },
    pink: { bg: 'from-pink-400 to-pink-600', glow: 'bg-pink-400', text: 'text-pink-600' },
    yellow: { bg: 'from-yellow-400 to-yellow-600', glow: 'bg-yellow-400', text: 'text-yellow-600' },
  };
  
  const colors = colorMap[color] || colorMap.blue;
  
  return (
    <div className="relative">
      <div className={`absolute inset-0 rounded-full ${colors.glow} blur-md opacity-50`}></div>
      <div className={`relative w-11 h-11 rounded-full bg-gradient-to-br ${colors.bg} p-0.5`}>
        <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>
      </div>
    </div>
  );
}

function GlowIconLarge({ Icon, color }: { Icon: React.ComponentType<{ className?: string }>, color: string }) {
  const colorMap: Record<string, { bg: string, glow: string, text: string }> = {
    blue: { bg: 'from-blue-400 to-blue-600', glow: 'bg-blue-400', text: 'text-blue-600' },
    orange: { bg: 'from-orange-400 to-orange-600', glow: 'bg-orange-400', text: 'text-orange-600' },
    red: { bg: 'from-red-400 to-red-600', glow: 'bg-red-400', text: 'text-red-600' },
    teal: { bg: 'from-teal-400 to-teal-600', glow: 'bg-teal-400', text: 'text-teal-600' },
    purple: { bg: 'from-purple-400 to-purple-600', glow: 'bg-purple-400', text: 'text-purple-600' },
    green: { bg: 'from-green-400 to-green-600', glow: 'bg-green-400', text: 'text-green-600' },
    pink: { bg: 'from-pink-400 to-pink-600', glow: 'bg-pink-400', text: 'text-pink-600' },
    yellow: { bg: 'from-yellow-400 to-yellow-600', glow: 'bg-yellow-400', text: 'text-yellow-600' },
  };
  
  const colors = colorMap[color] || colorMap.blue;
  
  return (
    <div className="relative">
      <div className={`absolute inset-0 rounded-full ${colors.glow} blur-lg opacity-40`}></div>
      <div className={`relative w-16 h-16 rounded-full bg-gradient-to-br ${colors.bg} p-0.5`}>
        <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
          <Icon className={`w-8 h-8 ${colors.text}`} />
        </div>
      </div>
    </div>
  );
}

export default function GlowDashboardDemo() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="p-6 border-b border-gray-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm">Welcome back, Dispatcher Dave. Here's your business overview.</p>
          </div>
          <div className="flex gap-3">
            <button className="glass-light glass-light--sm" data-testid="button-new-client">
              <Plus className="w-4 h-4" />
              New Client
            </button>
            <button className="glass-light glass-light--sm glass-light--accent-blue" data-testid="button-new-quote">
              <FileText className="w-4 h-4" />
              New Quote
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        
        {/* Stats Row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-light glass-light--card glass-light--accent-blue">
            <div className="flex items-start justify-between w-full">
              <div>
                <p className="text-3xl font-bold text-gray-900">10</p>
                <p className="text-gray-500 text-sm">Active Jobs</p>
              </div>
              <GlowIcon Icon={Briefcase} color="blue" />
            </div>
          </div>

          <div className="glass-light glass-light--card glass-light--accent-orange">
            <div className="flex items-start justify-between w-full">
              <div>
                <p className="text-3xl font-bold text-gray-900">3</p>
                <p className="text-gray-500 text-sm">Pending Quotes</p>
              </div>
              <GlowIcon Icon={FileText} color="orange" />
            </div>
          </div>

          <div className="glass-light glass-light--card glass-light--accent-red">
            <div className="flex items-start justify-between w-full">
              <div>
                <p className="text-3xl font-bold text-gray-900">2</p>
                <p className="text-gray-500 text-sm">Unpaid Invoices</p>
              </div>
              <GlowIcon Icon={Receipt} color="red" />
            </div>
          </div>

          <div className="glass-light glass-light--card glass-light--accent-teal">
            <div className="flex items-start justify-between w-full">
              <div>
                <p className="text-3xl font-bold text-gray-900">5</p>
                <p className="text-gray-500 text-sm">Team Members</p>
              </div>
              <GlowIcon Icon={Users} color="teal" />
            </div>
          </div>
        </section>

        {/* Portal Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-light glass-light--card glass-light--lg glass-light--accent-purple">
            <div className="flex items-center gap-4 w-full">
              <GlowIconLarge Icon={ClipboardCheck} color="purple" />
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">Works Manager Portal</h3>
                <p className="text-gray-500 text-sm">Manage your team, approvals, and quality oversight</p>
              </div>
              <button className="glass-light glass-light--sm glass-light--accent-purple" data-testid="button-works-portal">
                Open Portal
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="glass-light glass-light--card glass-light--lg glass-light--accent-orange">
            <div className="flex items-center gap-4 w-full">
              <GlowIconLarge Icon={Truck} color="orange" />
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">Fleet Manager Portal</h3>
                <p className="text-gray-500 text-sm">Vehicles, walkarounds, and defect tracking</p>
              </div>
              <button className="glass-light glass-light--sm glass-light--accent-orange" data-testid="button-fleet-portal">
                Open Portal
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Quick Actions + Recent Activity */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Quick Actions */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <button className="glass-light glass-light--card glass-light--accent-green" data-testid="button-schedule">
                <div className="text-center w-full space-y-2 py-2">
                  <div className="flex justify-center">
                    <GlowIcon Icon={Calendar} color="green" />
                  </div>
                  <p className="text-sm text-gray-700">Schedule</p>
                </div>
              </button>
              
              <button className="glass-light glass-light--card glass-light--accent-blue" data-testid="button-live-map">
                <div className="text-center w-full space-y-2 py-2">
                  <div className="flex justify-center">
                    <GlowIcon Icon={MapPin} color="blue" />
                  </div>
                  <p className="text-sm text-gray-700">Live Map</p>
                </div>
              </button>
              
              <button className="glass-light glass-light--card glass-light--accent-pink" data-testid="button-messages">
                <div className="text-center w-full space-y-2 py-2">
                  <div className="flex justify-center">
                    <GlowIcon Icon={MessageSquare} color="pink" />
                  </div>
                  <p className="text-sm text-gray-700">Messages</p>
                </div>
              </button>
              
              <button className="glass-light glass-light--card glass-light--accent-yellow" data-testid="button-analytics">
                <div className="text-center w-full space-y-2 py-2">
                  <div className="flex justify-center">
                    <GlowIcon Icon={TrendingUp} color="yellow" />
                  </div>
                  <p className="text-sm text-gray-700">Analytics</p>
                </div>
              </button>
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
            <div className="space-y-3">
              <div className="glass-light glass-light--card glass-light--accent-green">
                <div className="flex items-center gap-4 w-full">
                  <GlowIcon Icon={CheckCircle} color="green" />
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">Boiler Service - Smith Residence</p>
                    <p className="text-gray-400 text-sm">Completed today at 14:30</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Completed</span>
                </div>
              </div>

              <div className="glass-light glass-light--card glass-light--accent-blue">
                <div className="flex items-center gap-4 w-full">
                  <GlowIcon Icon={Clock} color="blue" />
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">Electrical Rewire - Johnson Property</p>
                    <p className="text-gray-400 text-sm">In progress - Day 3 of 5</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">In Progress</span>
                </div>
              </div>

              <div className="glass-light glass-light--card glass-light--accent-orange">
                <div className="flex items-center gap-4 w-full">
                  <GlowIcon Icon={Wrench} color="orange" />
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">HVAC Installation - Tech Office</p>
                    <p className="text-gray-400 text-sm">Scheduled for tomorrow 09:00</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700">Scheduled</span>
                </div>
              </div>

              <div className="glass-light glass-light--card glass-light--accent-red">
                <div className="flex items-center gap-4 w-full">
                  <GlowIcon Icon={AlertTriangle} color="red" />
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">Emergency Repair - Water Leak</p>
                    <p className="text-gray-400 text-sm">Requires immediate attention</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Urgent</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer Link */}
        <div className="text-center pt-8 pb-4">
          <a href="/icon-styles" className="text-gray-400 hover:text-gray-600 text-sm underline">
            View Icon Styles
          </a>
          <span className="text-gray-300 mx-3">|</span>
          <a href="/glass-demo" className="text-gray-400 hover:text-gray-600 text-sm underline">
            View Component Demo
          </a>
          <span className="text-gray-300 mx-3">|</span>
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm underline">
            Back to App
          </a>
        </div>
      </main>
    </div>
  );
}
