import { GlassCard } from "@/components/GlassCard";
import { ArrowRight, Star, Heart, ExternalLink, Settings } from "lucide-react";

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
          <p className="text-white/70">iOS-style frosted glass UI components</p>
        </div>

        {/* Button Examples */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <GlassCard onClick={() => alert('Clicked!')}>
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

        {/* Size Variants */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Sizes</h2>
          <div className="flex flex-wrap items-center gap-4">
            <GlassCard className="glasscard--sm">
              Small
            </GlassCard>
            
            <GlassCard>
              Default
            </GlassCard>
            
            <GlassCard className="glasscard--lg">
              Large
            </GlassCard>
            
            <GlassCard className="glasscard--xl">
              Extra Large
            </GlassCard>
          </div>
        </section>

        {/* Link Examples */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Links</h2>
          <div className="flex flex-wrap gap-4">
            <GlassCard as="a" href="#demo">
              Internal Link
              <ArrowRight className="w-4 h-4" />
            </GlassCard>
            
            <GlassCard as="a" href="https://replit.com" target="_blank">
              External Link
              <ExternalLink className="w-4 h-4" />
            </GlassCard>
          </div>
        </section>

        {/* Container Examples */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Containers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassCard as="div" className="glasscard--card">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Non-Interactive Card</h3>
                <p className="text-sm text-white/70">
                  This is a container variant with no click handler.
                  Perfect for displaying content.
                </p>
              </div>
            </GlassCard>
            
            <GlassCard 
              as="div" 
              className="glasscard--card"
              onClick={() => alert('Card clicked!')}
            >
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Clickable Card</h3>
                <p className="text-sm text-white/70">
                  This card has a click handler and is keyboard accessible.
                  Try pressing Enter or Space.
                </p>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Disabled State */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Disabled State</h2>
          <div className="flex flex-wrap gap-4">
            <GlassCard disabled>
              Disabled Button
            </GlassCard>
            
            <GlassCard variant="strong" disabled>
              Disabled Strong
            </GlassCard>
          </div>
        </section>

        {/* Full Width */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Full Width</h2>
          <GlassCard className="glasscard--full glasscard--lg">
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
