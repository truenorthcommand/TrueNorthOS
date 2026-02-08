import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Zap, Building2, Users, Crown, X, Gift, Star, Share2 } from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";
import { Badge } from "@/components/ui/badge";

const tiers = [
  {
    name: "Free",
    description: "Get started with the essentials",
    price: "£0",
    priceNote: "/month",
    additionalInfo: "1 user included",
    extraUsers: null,
    icon: Users,
    features: [
      { name: "Job scheduling", included: true },
      { name: "Client database", included: true },
      { name: "Unlimited invoicing", included: true },
      { name: "Basic mobile app", included: true },
      { name: "Client portal", included: false },
      { name: "Payment processing", included: false },
      { name: "AI assistant", included: false },
      { name: "Auto-assign postcode", included: false },
      { name: "Integrations", included: false },
      { name: "Analytics", included: false },
      { name: "Fleet management", included: false },
      { name: "API access", included: false },
    ],
    branding: "TrueNorth branding",
    whiteLabel: null,
    cta: "Get Started Free",
    ctaLink: "/register",
    popular: false,
  },
  {
    name: "Starter",
    description: "For solo tradespeople growing their business",
    price: "£35",
    priceNote: "/month",
    additionalInfo: "1 user included",
    extraUsers: "+£15/additional user",
    icon: Zap,
    features: [
      { name: "Job scheduling", included: true },
      { name: "Client database", included: true },
      { name: "Unlimited invoicing", included: true },
      { name: "Full mobile app", included: true },
      { name: "Client portal", included: true },
      { name: "Payment processing", included: true },
      { name: "Basic AI assistant", included: true },
      { name: "Auto-assign postcode", included: false },
      { name: "Integrations", included: true },
      { name: "Basic analytics", included: true },
      { name: "Fleet management", included: false },
      { name: "API access", included: false },
    ],
    branding: "Remove branding (+£10/mo)",
    whiteLabel: "+£10/mo",
    cta: "Start Free Trial",
    ctaLink: "/checkout?plan=starter",
    popular: false,
  },
  {
    name: "Pro",
    description: "For growing field service teams",
    price: "£60",
    priceNote: "/month",
    additionalInfo: "1 user included",
    extraUsers: "+£12/additional user",
    icon: Building2,
    features: [
      { name: "Job scheduling", included: true },
      { name: "Client database", included: true },
      { name: "Unlimited invoicing", included: true },
      { name: "Full mobile app", included: true },
      { name: "Client portal", included: true },
      { name: "Payment processing", included: true },
      { name: "Full AI assistant", included: true },
      { name: "Auto-assign postcode", included: true },
      { name: "Integrations", included: true },
      { name: "Full analytics", included: true },
      { name: "Fleet management", included: false },
      { name: "API access", included: false },
    ],
    branding: "Branding removed",
    whiteLabel: "+£20/mo",
    cta: "Start Free Trial",
    ctaLink: "/checkout?plan=pro",
    popular: true,
  },
  {
    name: "Business",
    description: "For established companies and larger teams",
    price: "£150",
    priceNote: "/month",
    additionalInfo: "1 user included",
    extraUsers: "+£10/additional user",
    icon: Crown,
    features: [
      { name: "Job scheduling", included: true },
      { name: "Client database", included: true },
      { name: "Unlimited invoicing", included: true },
      { name: "Full mobile app", included: true },
      { name: "Client portal", included: true },
      { name: "Payment processing", included: true },
      { name: "Full AI assistant", included: true },
      { name: "Auto-assign postcode", included: true },
      { name: "Integrations", included: true },
      { name: "Full suite analytics", included: true },
      { name: "Fleet management", included: true },
      { name: "API access", included: true },
    ],
    branding: "Branding removed",
    whiteLabel: "+£30/mo",
    cta: "Start Free Trial",
    ctaLink: "/checkout?plan=business",
    popular: false,
  },
];

const featureComparison = [
  { feature: "Users", free: "1", starter: "1 (+£15/user)", pro: "1 (+£12/user)", business: "1 (+£10/user)" },
  { feature: "Job scheduling", free: "Included", starter: "Included", pro: "Included", business: "Included" },
  { feature: "Client database", free: "Included", starter: "Included", pro: "Included", business: "Included" },
  { feature: "Invoicing", free: "Unlimited", starter: "Included", pro: "Included", business: "Included" },
  { feature: "Mobile app", free: "Basic", starter: "Full", pro: "Full", business: "Full" },
  { feature: "Client portal", free: "—", starter: "Included", pro: "Included", business: "Included" },
  { feature: "Payment processing", free: "—", starter: "Included", pro: "Included", business: "Included" },
  { feature: "AI assistant", free: "—", starter: "Basic", pro: "Full", business: "Full" },
  { feature: "Auto-assign postcode", free: "—", starter: "—", pro: "Included", business: "Included" },
  { feature: "Integrations", free: "—", starter: "Included", pro: "Included", business: "Included" },
  { feature: "Analytics", free: "—", starter: "Basic", pro: "Included", business: "Full Suite" },
  { feature: "Fleet management", free: "—", starter: "—", pro: "—", business: "Included" },
  { feature: "API access", free: "—", starter: "—", pro: "—", business: "Included" },
  { feature: "Branding", free: "TrueNorth", starter: "Remove (+£10)", pro: "Removed", business: "Removed" },
  { feature: "White-label", free: "—", starter: "+£10/mo", pro: "+£20/mo", business: "+£30/mo" },
];

const allIncluded = [
  "Secure UK cloud hosting",
  "SSL encryption",
  "GDPR compliance",
  "Two-factor authentication",
  "Regular updates",
  "Email support",
  "Data export",
  "14-day free trial",
];

export default function Pricing() {
  return (
    <PublicLayout>
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" data-testid="text-pricing-title">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="text-pricing-subtitle">
            Start free, then scale as you grow. Add team members at a simple per-user rate — no hidden fees, no lock-in contracts.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
          {tiers.map((tier) => (
            <Card 
              key={tier.name}
              className={`relative flex flex-col ${
                tier.popular 
                  ? "border-primary border-2 shadow-lg scale-105" 
                  : "border-slate-200 dark:border-slate-800"
              }`}
              data-testid={`card-pricing-${tier.name.toLowerCase()}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <tier.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl" data-testid={`text-tier-name-${tier.name.toLowerCase()}`}>
                  {tier.name}
                </CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold" data-testid={`text-tier-price-${tier.name.toLowerCase()}`}>
                    {tier.price}
                  </span>
                  <span className="text-muted-foreground block text-sm">{tier.priceNote}</span>
                  <span className="text-primary text-sm font-medium block">{tier.additionalInfo}</span>
                  {tier.extraUsers && (
                    <span className="text-muted-foreground text-xs block mt-1">{tier.extraUsers}</span>
                  )}
                </div>
                <ul className="space-y-2">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                      )}
                      <span className={`text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
                {tier.branding && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">{tier.branding}</p>
                  </div>
                )}
                {tier.whiteLabel && (
                  <p className="text-xs text-muted-foreground mt-1">White-label: {tier.whiteLabel}</p>
                )}
              </CardContent>
              <CardFooter>
                <Link href={tier.ctaLink} className="w-full">
                  <Button 
                    className="w-full"
                    variant={tier.popular ? "default" : "outline"}
                    data-testid={`button-cta-${tier.name.toLowerCase()}`}
                  >
                    {tier.cta}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="max-w-6xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8" data-testid="text-feature-comparison">
            Feature Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Feature</th>
                  <th className="text-center py-3 px-4 font-semibold">Free</th>
                  <th className="text-center py-3 px-4 font-semibold">Starter</th>
                  <th className="text-center py-3 px-4 font-semibold text-primary">Pro</th>
                  <th className="text-center py-3 px-4 font-semibold">Business</th>
                </tr>
              </thead>
              <tbody>
                {featureComparison.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-3 px-4 text-sm font-medium">{row.feature}</td>
                    <td className="text-center py-3 px-4 text-sm text-muted-foreground">{row.free}</td>
                    <td className="text-center py-3 px-4 text-sm text-muted-foreground">{row.starter}</td>
                    <td className="text-center py-3 px-4 text-sm bg-primary/5">{row.pro}</td>
                    <td className="text-center py-3 px-4 text-sm text-muted-foreground">{row.business}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl p-8 max-w-5xl mx-auto mb-16 border border-emerald-200 dark:border-emerald-800" data-testid="section-referral-programme">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <Gift className="h-4 w-4" />
              Referral Programme
            </div>
            <h2 className="text-2xl font-bold mb-2">Save Up to 50% on Your Subscription</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Refer other trade businesses to TrueNorth OS and earn discounts on your monthly bill. Stack referral and review rewards for maximum savings.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 text-center shadow-sm" data-testid="card-referral-earn">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                <Share2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold mb-2">5% Off Per Referral</h3>
              <p className="text-sm text-muted-foreground">
                Share your unique referral link. For each business that signs up, you get 5% off your monthly bill — up to 50%.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 text-center shadow-sm" data-testid="card-referral-reviews">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                <Star className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-semibold mb-2">Review Rewards</h3>
              <p className="text-sm text-muted-foreground">
                Leave reviews on Google, Trustpilot, G2, or LinkedIn and earn up to an additional 20% discount that stacks with referrals.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 text-center shadow-sm" data-testid="card-referral-credit">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Gift className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold mb-2">£25 Credit Overflow</h3>
              <p className="text-sm text-muted-foreground">
                Already at the 50% cap? Each additional referral earns you £25 account credit instead. Your loyalty always pays off.
              </p>
            </div>
          </div>

          <div className="bg-white/60 dark:bg-slate-900/60 rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">1 referral = 5% off</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">5 referrals = 25% off</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">10 referrals = 50% off</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">11+ = £25 credit each</Badge>
            </div>
          </div>

          <div className="text-center">
            <Link href="/register">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-join-referral">
                Sign Up &amp; Start Referring
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground mt-2">Combined referral + review discount capped at 50%</p>
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-8 max-w-4xl mx-auto mb-16">
          <h3 className="text-xl font-semibold text-center mb-6">
            All Plans Include
          </h3>
          <div className="grid md:grid-cols-4 gap-4">
            {allIncluded.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 justify-center">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mb-16">
          <h2 className="text-2xl font-bold mb-4">
            Need help choosing?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Our team can help you find the right plan for your business. 
            Start with a 14-day free trial on any paid plan — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" data-testid="button-start-trial">
                Start 14-Day Free Trial
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" data-testid="button-contact-sales">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          <h3 className="text-xl font-semibold text-center mb-6">
            Frequently Asked Questions
          </h3>
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <h4 className="font-medium mb-2">Can I switch plans later?</h4>
              <p className="text-sm text-muted-foreground">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect at your next billing cycle.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <h4 className="font-medium mb-2">How does per-user pricing work?</h4>
              <p className="text-sm text-muted-foreground">
                Each plan includes 1 user. Additional team members can be added at the per-user rate shown — £15/user on Starter, £12/user on Pro, and £10/user on Business.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <h4 className="font-medium mb-2">Is there a contract?</h4>
              <p className="text-sm text-muted-foreground">
                No long-term contracts. All plans are billed monthly and you can cancel anytime.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <h4 className="font-medium mb-2">What payment methods do you accept?</h4>
              <p className="text-sm text-muted-foreground">
                We accept all major credit cards, debit cards, and bank transfers for annual plans.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <h4 className="font-medium mb-2">How does the referral programme work?</h4>
              <p className="text-sm text-muted-foreground">
                Once you sign up, you'll get a unique referral link. Share it with other trade businesses — each one that signs up earns you 5% off your bill. You can also earn review rewards by leaving reviews on Google, Trustpilot, and more. Discounts stack up to a 50% cap.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <h4 className="font-medium mb-2">Do you offer discounts for annual billing?</h4>
              <p className="text-sm text-muted-foreground">
                Yes, annual billing saves you 20% compared to monthly payments. Contact sales for a quote.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </PublicLayout>
  );
}
