import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Zap, Building2, Users, Crown, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const tiers = [
  {
    name: "Starter",
    description: "Perfect for small teams getting started",
    price: "Free",
    priceNote: "for 2 users",
    additionalUsers: "+£10/user after",
    icon: Users,
    features: [
      "Up to 2 users included",
      "Job management",
      "Photo uploads",
      "Digital signatures",
      "Mobile-optimised interface",
      "Basic reporting",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Professional",
    description: "For growing field service teams",
    price: "£99",
    priceNote: "per month",
    additionalUsers: "+£10/user (up to 35)",
    icon: Zap,
    features: [
      "Everything in Starter",
      "Up to 35 users",
      "Live engineer tracking",
      "Geolocation sign-off",
      "Calendar scheduling",
      "Technical Advisor access",
      "Priority support",
    ],
    cta: "Start Professional",
    popular: true,
  },
  {
    name: "Business",
    description: "For established companies with larger teams",
    price: "£300",
    priceNote: "per month",
    additionalUsers: "+£10/user (up to 35)",
    icon: Building2,
    features: [
      "Everything in Professional",
      "Up to 35 users",
      "Advanced reporting",
      "Custom technical advisors",
      "Client portal access",
      "API access",
      "Dedicated account manager",
    ],
    cta: "Start Business",
    popular: false,
  },
  {
    name: "Enterprise",
    description: "Custom solutions for large organisations",
    price: "Custom",
    priceNote: "contact us",
    additionalUsers: "Unlimited users",
    icon: Crown,
    features: [
      "Everything in Business",
      "Unlimited users",
      "White-label options",
      "Custom integrations",
      "On-premise deployment",
      "SLA guarantee",
      "24/7 premium support",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <Link href="/home">
          <Button variant="ghost" className="mb-8" data-testid="link-back-home">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4" data-testid="text-pricing-title">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto" data-testid="text-pricing-subtitle">
            Choose the plan that fits your team. All plans include our core job management features.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {tiers.map((tier) => (
            <Card 
              key={tier.name}
              className={`relative flex flex-col ${
                tier.popular 
                  ? "border-blue-500 border-2 shadow-lg scale-105" 
                  : "border-slate-200"
              }`}
              data-testid={`card-pricing-${tier.name.toLowerCase()}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-sm font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <tier.icon className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl" data-testid={`text-tier-name-${tier.name.toLowerCase()}`}>
                  {tier.name}
                </CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold text-slate-900" data-testid={`text-tier-price-${tier.name.toLowerCase()}`}>
                    {tier.price}
                  </span>
                  <span className="text-slate-500 block text-sm">{tier.priceNote}</span>
                  <span className="text-blue-600 text-sm font-medium">{tier.additionalUsers}</span>
                </div>
                <ul className="space-y-3">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className={`w-full ${tier.popular ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                  variant={tier.popular ? "default" : "outline"}
                  data-testid={`button-cta-${tier.name.toLowerCase()}`}
                >
                  {tier.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Need help choosing?
          </h2>
          <p className="text-slate-600 mb-6">
            Our team is here to help you find the right plan for your business.
          </p>
          <Button size="lg" variant="outline" data-testid="button-contact-sales">
            Contact Sales
          </Button>
        </div>

        <div className="mt-16 bg-slate-100 rounded-2xl p-8 max-w-4xl mx-auto">
          <h3 className="text-xl font-semibold text-center mb-6">
            All Plans Include
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              "Secure cloud storage",
              "Mobile app access",
              "SSL encryption",
              "Regular updates",
              "Email support",
              "Data export",
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 justify-center">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-slate-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
