import { GlassCard } from "@/components/GlassCard";
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

export default function GlassDashboardDemo() {
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
            <button className="glass-light glass-light--sm">
              <Plus className="w-4 h-4" />
              New Client
            </button>
            <button className="glass-light glass-light--sm glass-light--accent-blue">
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
              <div className="p-2 rounded-xl bg-blue-100">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="glass-light glass-light--card glass-light--accent-orange">
            <div className="flex items-start justify-between w-full">
              <div>
                <p className="text-3xl font-bold text-gray-900">3</p>
                <p className="text-gray-500 text-sm">Pending Quotes</p>
              </div>
              <div className="p-2 rounded-xl bg-orange-100">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="glass-light glass-light--card glass-light--accent-red">
            <div className="flex items-start justify-between w-full">
              <div>
                <p className="text-3xl font-bold text-gray-900">2</p>
                <p className="text-gray-500 text-sm">Unpaid Invoices</p>
              </div>
              <div className="p-2 rounded-xl bg-red-100">
                <Receipt className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>

          <div className="glass-light glass-light--card glass-light--accent-teal">
            <div className="flex items-start justify-between w-full">
              <div>
                <p className="text-3xl font-bold text-gray-900">5</p>
                <p className="text-gray-500 text-sm">Team Members</p>
              </div>
              <div className="p-2 rounded-xl bg-teal-100">
                <Users className="w-5 h-5 text-teal-600" />
              </div>
            </div>
          </div>
        </section>

        {/* Portal Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-light glass-light--card glass-light--lg glass-light--accent-purple">
            <div className="flex items-center gap-4 w-full">
              <div className="p-3 rounded-2xl bg-purple-100">
                <ClipboardCheck className="w-8 h-8 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">Works Manager Portal</h3>
                <p className="text-gray-500 text-sm">Manage your team, approvals, and quality oversight</p>
              </div>
              <button className="glass-light glass-light--sm glass-light--accent-purple">
                Open Portal
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="glass-light glass-light--card glass-light--lg glass-light--accent-orange">
            <div className="flex items-center gap-4 w-full">
              <div className="p-3 rounded-2xl bg-orange-100">
                <Truck className="w-8 h-8 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">Fleet Manager Portal</h3>
                <p className="text-gray-500 text-sm">Vehicles, walkarounds, and defect tracking</p>
              </div>
              <button className="glass-light glass-light--sm glass-light--accent-orange">
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
              <button className="glass-light glass-light--card glass-light--accent-green">
                <div className="text-center w-full space-y-2">
                  <div className="p-3 rounded-xl bg-green-100 inline-block">
                    <Calendar className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-700">Schedule</p>
                </div>
              </button>
              
              <button className="glass-light glass-light--card glass-light--accent-blue">
                <div className="text-center w-full space-y-2">
                  <div className="p-3 rounded-xl bg-blue-100 inline-block">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-700">Live Map</p>
                </div>
              </button>
              
              <button className="glass-light glass-light--card glass-light--accent-pink">
                <div className="text-center w-full space-y-2">
                  <div className="p-3 rounded-xl bg-pink-100 inline-block">
                    <MessageSquare className="w-6 h-6 text-pink-600" />
                  </div>
                  <p className="text-sm text-gray-700">Messages</p>
                </div>
              </button>
              
              <button className="glass-light glass-light--card glass-light--accent-yellow">
                <div className="text-center w-full space-y-2">
                  <div className="p-3 rounded-xl bg-yellow-100 inline-block">
                    <TrendingUp className="w-6 h-6 text-yellow-600" />
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
                  <div className="p-2 rounded-xl bg-green-100">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">Boiler Service - Smith Residence</p>
                    <p className="text-gray-400 text-sm">Completed today at 14:30</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Completed</span>
                </div>
              </div>

              <div className="glass-light glass-light--card glass-light--accent-blue">
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 rounded-xl bg-blue-100">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">Electrical Rewire - Johnson Property</p>
                    <p className="text-gray-400 text-sm">In progress - Day 3 of 5</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">In Progress</span>
                </div>
              </div>

              <div className="glass-light glass-light--card glass-light--accent-orange">
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 rounded-xl bg-orange-100">
                    <Wrench className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">HVAC Installation - Tech Office</p>
                    <p className="text-gray-400 text-sm">Scheduled for tomorrow 09:00</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700">Scheduled</span>
                </div>
              </div>

              <div className="glass-light glass-light--card glass-light--accent-red">
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 rounded-xl bg-red-100">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
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
