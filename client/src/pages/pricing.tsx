import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Zap, Building2, Users, Crown, ArrowLeft, X } from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";

const tiers = [
  {
    name: "Starter",
    description: "For solo tradespeople and small teams",
    price: "£99",
    priceNote: "/month",
    additionalInfo: "1–5 users included",
    icon: Users,
    features: [
      { name: "Job management", included: true },
      { name: "Quoting & invoicing", included: true },
      { name: "Client CRM", included: true },
      { name: "Photo evidence", included: true },
      { name: "Digital signatures", included: true },
      { name: "Mobile PWA", included: true },
      { name: "Basic timesheets", included: true },
      { name: "Auto-assign by postcode", included: true },
      { name: "Expense tracking", included: false },
      { name: "Fleet management", included: false },
      { name: "Team messaging", included: false },
      { name: "AI Technical Advisors", included: false },
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Professional",
    description: "For growing field service teams",
    price: "£149",
    priceNote: "/month",
    additionalInfo: "6–10 users included",
    icon: Zap,
    features: [
      { name: "Everything in Starter", included: true },
      { name: "Expense tracking with mileage", included: true },
      { name: "Payment collection", included: true },
      { name: "Team messaging", included: true },
      { name: "Live GPS tracking", included: true },
      { name: "Weekly planner", included: true },
      { name: "Long-running jobs", included: true },
      { name: "AI Technical Advisors", included: true },
      { name: "AI Writing Assistant", included: true },
      { name: "AI Quality Gatekeeper", included: true },
      { name: "Fleet management", included: false },
      { name: "API access", included: false },
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Business",
    description: "For established companies",
    price: "£199",
    priceNote: "/month",
    additionalInfo: "11–15 users included",
    icon: Building2,
    features: [
      { name: "Everything in Professional", included: true },
      { name: "Fleet management", included: true },
      { name: "Vehicle walkaround checks", included: true },
      { name: "Defect tracking workflow", included: true },
      { name: "Advanced reporting", included: true },
      { name: "Custom AI advisors", included: true },
      { name: "Client portal access", included: true },
      { name: "API access", included: true },
      { name: "Priority support", included: true },
      { name: "White-label options", included: false },
      { name: "Custom integrations", included: false },
      { name: "Dedicated account manager", included: false },
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Enterprise",
    description: "Custom solutions for large organisations",
    price: "Custom",
    priceNote: "contact us",
    additionalInfo: "Unlimited users",
    icon: Crown,
    features: [
      { name: "Everything in Business", included: true },
      { name: "Unlimited users", included: true },
      { name: "White-label options", included: true },
      { name: "Custom integrations", included: true },
      { name: "On-premise deployment", included: true },
      { name: "SSO / SAML", included: true },
      { name: "Dedicated account manager", included: true },
      { name: "SLA guarantee", included: true },
      { name: "24/7 premium support", included: true },
      { name: "Custom training", included: true },
      { name: "Data migration support", included: true },
      { name: "Bespoke development", included: true },
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const allIncluded = [
  "Secure UK cloud hosting",
  "SSL encryption",
  "GDPR compliance",
  "Two-factor authentication",
  "Regular updates",
  "Email support",
  "Data export",
  "Mobile app access",
];

const moduleComparison = [
  { module: "Operations", starter: true, professional: true, business: true, enterprise: true },
  { module: "Auto-assign by Postcode", starter: true, professional: true, business: true, enterprise: true },
  { module: "Finance - Basic", starter: true, professional: true, business: true, enterprise: true },
  { module: "Finance - Advanced", starter: false, professional: true, business: true, enterprise: true },
  { module: "Fleet Management", starter: false, professional: false, business: true, enterprise: true },
  { module: "Workforce - Basic", starter: true, professional: true, business: true, enterprise: true },
  { module: "Workforce - GPS & Messaging", starter: false, professional: true, business: true, enterprise: true },
  { module: "Compliance", starter: true, professional: true, business: true, enterprise: true },
  { module: "AI Intelligence", starter: false, professional: true, business: true, enterprise: true },
  { module: "AI Quality Gatekeeper", starter: false, professional: true, business: true, enterprise: true },
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
            Fixed monthly pricing based on team size — no per-user fees. 
            Choose the band that fits your business and scale as you grow.
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
                  <span className="text-primary text-sm font-medium">{tier.additionalInfo}</span>
                </div>
                <ul className="space-y-2">
                  {tier.features.slice(0, 9).map((feature, idx) => (
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
              </CardContent>
              <CardFooter>
                <Link href={tier.name === "Enterprise" ? "/contact" : `/checkout?plan=${tier.name.toLowerCase()}`} className="w-full">
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

        <div className="max-w-5xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8" data-testid="text-module-comparison">
            Module Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Module</th>
                  <th className="text-center py-3 px-4 font-semibold">Starter</th>
                  <th className="text-center py-3 px-4 font-semibold text-primary">Professional</th>
                  <th className="text-center py-3 px-4 font-semibold">Business</th>
                  <th className="text-center py-3 px-4 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {moduleComparison.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-3 px-4 text-sm">{row.module}</td>
                    <td className="text-center py-3 px-4">
                      {row.starter ? <Check className="h-4 w-4 text-green-500 inline" /> : <X className="h-4 w-4 text-slate-300 inline" />}
                    </td>
                    <td className="text-center py-3 px-4 bg-primary/5">
                      {row.professional ? <Check className="h-4 w-4 text-green-500 inline" /> : <X className="h-4 w-4 text-slate-300 inline" />}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.business ? <Check className="h-4 w-4 text-green-500 inline" /> : <X className="h-4 w-4 text-slate-300 inline" />}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.enterprise ? <Check className="h-4 w-4 text-green-500 inline" /> : <X className="h-4 w-4 text-slate-300 inline" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            We offer a 14-day free trial on all plans — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" data-testid="button-start-trial">
              Start 14-Day Free Trial
            </Button>
            <Button size="lg" variant="outline" data-testid="button-contact-sales">
              Contact Sales
            </Button>
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
