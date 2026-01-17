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

export default function GlassDashboardDemo() {
  return (
    <div 
      className="min-h-screen"
      style={{
        background: 'linear-gradient(145deg, #0a0a15 0%, #12121f 40%, #0d1a2d 70%, #0a0a15 100%)'
      }}
    >
      {/* Header */}
      <header className="p-6 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-white/60 text-sm">Welcome back, Dispatcher Dave. Here's your business overview.</p>
          </div>
          <div className="flex gap-3">
            <GlassCard className="glasscard--sm">
              <Plus className="w-4 h-4" />
              New Client
            </GlassCard>
            <GlassCard accent="blue" className="glasscard--sm">
              <FileText className="w-4 h-4" />
              New Quote
            </GlassCard>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        
        {/* Stats Row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard as="div" accent="blue" className="glasscard--card">
            <div className="flex items-start justify-between w-full">
              <div>
                <p className="text-3xl font-bold text-white">10</p>
                <p className="text-white/60 text-sm">Active Jobs</p>
              </div>
              <div className="p-2 rounded-xl bg-blue-500/20">
                <Briefcase className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </GlassCard>

          <GlassCard as="div" accent="orange" className="glasscard--card">
            <div className="flex items-start justify-between w-full">
              <div>
                <p className="text-3xl font-bold text-white">3</p>
                <p className="text-white/60 text-sm">Pending Quotes</p>
              </div>
              <div className="p-2 rounded-xl bg-orange-500/20">
                <FileText className="w-5 h-5 text-orange-400" />
              </div>
            </div>
          </GlassCard>

          <GlassCard as="div" accent="red" className="glasscard--card">
            <div className="flex items-start justify-between w-full">
              <div>
                <p className="text-3xl font-bold text-white">2</p>
                <p className="text-white/60 text-sm">Unpaid Invoices</p>
              </div>
              <div className="p-2 rounded-xl bg-red-500/20">
                <Receipt className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </GlassCard>

          <GlassCard as="div" accent="teal" className="glasscard--card">
            <div className="flex items-start justify-between w-full">
              <div>
                <p className="text-3xl font-bold text-white">5</p>
                <p className="text-white/60 text-sm">Team Members</p>
              </div>
              <div className="p-2 rounded-xl bg-teal-500/20">
                <Users className="w-5 h-5 text-teal-400" />
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Portal Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard 
            as="div" 
            accent="purple" 
            className="glasscard--card glasscard--lg"
            onClick={() => {}}
          >
            <div className="flex items-center gap-4 w-full">
              <div className="p-3 rounded-2xl bg-purple-500/20">
                <ClipboardCheck className="w-8 h-8 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white">Works Manager Portal</h3>
                <p className="text-white/60 text-sm">Manage your team, approvals, and quality oversight</p>
              </div>
              <GlassCard accent="purple" className="glasscard--sm">
                Open Portal
                <ArrowRight className="w-4 h-4" />
              </GlassCard>
            </div>
          </GlassCard>

          <GlassCard 
            as="div" 
            accent="orange" 
            className="glasscard--card glasscard--lg"
            onClick={() => {}}
          >
            <div className="flex items-center gap-4 w-full">
              <div className="p-3 rounded-2xl bg-orange-500/20">
                <Truck className="w-8 h-8 text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white">Fleet Manager Portal</h3>
                <p className="text-white/60 text-sm">Vehicles, walkarounds, and defect tracking</p>
              </div>
              <GlassCard accent="orange" className="glasscard--sm">
                Open Portal
                <ArrowRight className="w-4 h-4" />
              </GlassCard>
            </div>
          </GlassCard>
        </section>

        {/* Quick Actions + Recent Activity */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Quick Actions */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white/90">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <GlassCard accent="green" className="glasscard--card">
                <div className="text-center w-full space-y-2">
                  <div className="p-3 rounded-xl bg-green-500/20 inline-block">
                    <Calendar className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-sm text-white/80">Schedule</p>
                </div>
              </GlassCard>
              
              <GlassCard accent="blue" className="glasscard--card">
                <div className="text-center w-full space-y-2">
                  <div className="p-3 rounded-xl bg-blue-500/20 inline-block">
                    <MapPin className="w-6 h-6 text-blue-400" />
                  </div>
                  <p className="text-sm text-white/80">Live Map</p>
                </div>
              </GlassCard>
              
              <GlassCard accent="pink" className="glasscard--card">
                <div className="text-center w-full space-y-2">
                  <div className="p-3 rounded-xl bg-pink-500/20 inline-block">
                    <MessageSquare className="w-6 h-6 text-pink-400" />
                  </div>
                  <p className="text-sm text-white/80">Messages</p>
                </div>
              </GlassCard>
              
              <GlassCard accent="yellow" className="glasscard--card">
                <div className="text-center w-full space-y-2">
                  <div className="p-3 rounded-xl bg-yellow-500/20 inline-block">
                    <TrendingUp className="w-6 h-6 text-yellow-400" />
                  </div>
                  <p className="text-sm text-white/80">Analytics</p>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-white/90">Recent Jobs</h2>
            <div className="space-y-3">
              <GlassCard as="div" accent="green" className="glasscard--card">
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 rounded-xl bg-green-500/20">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Boiler Service - Smith Residence</p>
                    <p className="text-white/50 text-sm">Completed today at 14:30</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">Completed</span>
                </div>
              </GlassCard>

              <GlassCard as="div" accent="blue" className="glasscard--card">
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 rounded-xl bg-blue-500/20">
                    <Clock className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Electrical Rewire - Johnson Property</p>
                    <p className="text-white/50 text-sm">In progress - Day 3 of 5</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">In Progress</span>
                </div>
              </GlassCard>

              <GlassCard as="div" accent="orange" className="glasscard--card">
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 rounded-xl bg-orange-500/20">
                    <Wrench className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">HVAC Installation - Tech Office</p>
                    <p className="text-white/50 text-sm">Scheduled for tomorrow 09:00</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">Scheduled</span>
                </div>
              </GlassCard>

              <GlassCard as="div" accent="red" className="glasscard--card">
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 rounded-xl bg-red-500/20">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Emergency Repair - Water Leak</p>
                    <p className="text-white/50 text-sm">Requires immediate attention</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">Urgent</span>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>

        {/* Footer Link */}
        <div className="text-center pt-8 pb-4">
          <a href="/glass-demo" className="text-white/50 hover:text-white/80 text-sm underline">
            View Component Demo
          </a>
          <span className="text-white/30 mx-3">|</span>
          <a href="/" className="text-white/50 hover:text-white/80 text-sm underline">
            Back to App
          </a>
        </div>
      </main>
    </div>
  );
}
