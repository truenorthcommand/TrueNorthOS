import { GlassCard } from "@/components/GlassCard";
import { ArrowRight, Star, Heart, ExternalLink, Settings, Mail, Calendar, Zap, Bell } from "lucide-react";

export default function GlassDemoPage() {
  return (
    <div 
      className="min-h-screen p-8"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
      }}
    >
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">GlassCard Component</h1>
          <p className="text-white/70">Dark glass cards with glowing accent borders</p>
        </div>

        {/* Accent Colors */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Accent Colors (Glowing Borders)</h2>
          <div className="flex flex-wrap gap-4">
            <GlassCard accent="pink" onClick={() => alert('Pink!')}>
              <Mail className="w-4 h-4" />
              Pink Accent
            </GlassCard>
            
            <GlassCard accent="purple" onClick={() => alert('Purple!')}>
              <Star className="w-4 h-4" />
              Purple Accent
            </GlassCard>
            
            <GlassCard accent="teal" onClick={() => alert('Teal!')}>
              <Zap className="w-4 h-4" />
              Teal Accent
            </GlassCard>
            
            <GlassCard accent="green" onClick={() => alert('Green!')}>
              <Calendar className="w-4 h-4" />
              Green Accent
            </GlassCard>
            
            <GlassCard accent="orange" onClick={() => alert('Orange!')}>
              <Bell className="w-4 h-4" />
              Orange Accent
            </GlassCard>
            
            <GlassCard accent="blue" onClick={() => alert('Blue!')}>
              <Settings className="w-4 h-4" />
              Blue Accent
            </GlassCard>
            
            <GlassCard accent="red" onClick={() => alert('Red!')}>
              <Heart className="w-4 h-4" />
              Red Accent
            </GlassCard>
            
            <GlassCard accent="yellow" onClick={() => alert('Yellow!')}>
              <Star className="w-4 h-4" />
              Yellow Accent
            </GlassCard>
          </div>
        </section>

        {/* Card Examples with Accents */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Card Containers with Accents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassCard as="div" accent="pink" className="glasscard--card">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-pink-400" />
                  <h3 className="text-lg font-semibold">Re: Product strategy</h3>
                </div>
                <p className="text-sm text-white/70">
                  Discussion about Q2 roadmap and feature priorities...
                </p>
                <p className="text-xs text-white/50">09:00 - 21:00</p>
              </div>
            </GlassCard>
            
            <GlassCard as="div" accent="teal" className="glasscard--card">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-400" />
                  <h3 className="text-lg font-semibold">Flight - Hotel booking</h3>
                </div>
                <p className="text-sm text-white/70">
                  Personal travel arrangements for next month...
                </p>
                <p className="text-xs text-white/50">10:00 - 22:00</p>
              </div>
            </GlassCard>
            
            <GlassCard as="div" accent="purple" className="glasscard--card">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-semibold">New metrics for you!</h3>
                </div>
                <p className="text-sm text-white/70">
                  Your weekly analytics report is ready to view...
                </p>
                <p className="text-xs text-white/50">11:00 - 23:00</p>
              </div>
            </GlassCard>
            
            <GlassCard as="div" accent="green" className="glasscard--card">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-green-400" />
                  <h3 className="text-lg font-semibold">Task completed</h3>
                </div>
                <p className="text-sm text-white/70">
                  Your scheduled task has been marked as done...
                </p>
                <p className="text-xs text-white/50">12:00 - 00:00</p>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* No Accent (Default) */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Default (No Accent)</h2>
          <div className="flex flex-wrap gap-4">
            <GlassCard onClick={() => alert('Default!')}>
              <Star className="w-4 h-4" />
              Default Button
            </GlassCard>
            
            <GlassCard variant="subtle" onClick={() => alert('Subtle!')}>
              <Heart className="w-4 h-4" />
              Subtle Variant
            </GlassCard>
            
            <GlassCard variant="strong" onClick={() => alert('Strong!')}>
              <Settings className="w-4 h-4" />
              Strong Variant
            </GlassCard>
          </div>
        </section>

        {/* Sizes */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Sizes with Accents</h2>
          <div className="flex flex-wrap items-center gap-4">
            <GlassCard accent="purple" className="glasscard--sm">
              Small
            </GlassCard>
            
            <GlassCard accent="teal">
              Default
            </GlassCard>
            
            <GlassCard accent="pink" className="glasscard--lg">
              Large
            </GlassCard>
            
            <GlassCard accent="orange" className="glasscard--xl">
              Extra Large
            </GlassCard>
          </div>
        </section>

        {/* Links */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Links with Accents</h2>
          <div className="flex flex-wrap gap-4">
            <GlassCard as="a" href="#demo" accent="blue">
              Internal Link
              <ArrowRight className="w-4 h-4" />
            </GlassCard>
            
            <GlassCard as="a" href="https://replit.com" target="_blank" accent="green">
              External Link
              <ExternalLink className="w-4 h-4" />
            </GlassCard>
          </div>
        </section>

        {/* Disabled */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Disabled State</h2>
          <div className="flex flex-wrap gap-4">
            <GlassCard disabled>
              Disabled Default
            </GlassCard>
            
            <GlassCard accent="pink" disabled>
              Disabled Pink
            </GlassCard>
            
            <GlassCard accent="teal" disabled>
              Disabled Teal
            </GlassCard>
          </div>
        </section>

        {/* Full Width */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Full Width</h2>
          <GlassCard accent="purple" className="glasscard--full glasscard--lg">
            Full Width Button
            <ArrowRight className="w-5 h-5" />
          </GlassCard>
        </section>

        <div className="text-center pt-8">
          <a href="/" className="text-white/50 hover:text-white/80 text-sm underline">
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
