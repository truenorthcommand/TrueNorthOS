import { useState } from "react";
import { Link, useSearch } from "wouter";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, ShieldCheck, CheckCircle2 } from "lucide-react";

const plans: Record<
  string,
  { name: string; price: string; period: string; features: string[] }
> = {
  starter: {
    name: "Starter",
    price: "£99",
    period: "/month",
    features: [
      "1–5 users included",
      "Job management",
      "Quoting & invoicing",
      "Auto-assign by postcode",
      "Mobile PWA",
    ],
  },
  professional: {
    name: "Professional",
    price: "£149",
    period: "/month",
    features: [
      "6–10 users included",
      "Everything in Starter",
      "GPS tracking & team messaging",
      "AI Technical Advisors",
      "AI Quality Gatekeeper",
    ],
  },
  business: {
    name: "Business",
    price: "£199",
    period: "/month",
    features: [
      "11–15 users included",
      "Everything in Professional",
      "Fleet management",
      "Client portal access",
      "Priority support & API access",
    ],
  },
};

export default function PublicCheckout() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const planKey = params.get("plan") || "starter";
  const plan = plans[planKey] || plans.starter;

  const [formData, setFormData] = useState({
    companyName: "",
    fullName: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    country: "United Kingdom",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <PublicLayout>
      <section className="py-12 md:py-20 px-4 bg-slate-50 min-h-[calc(100vh-8rem)]">
        <div className="max-w-5xl mx-auto">
          <h1
            className="text-3xl font-bold tracking-tight mb-8 text-center"
            data-testid="text-checkout-heading"
          >
            Complete Your Purchase
          </h1>

          <div className="grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3">
              <Card data-testid="card-billing-form">
                <CardContent className="pt-6">
                  <h2 className="text-xl font-semibold mb-6">
                    Billing Details
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        name="companyName"
                        placeholder="Your company name"
                        value={formData.companyName}
                        onChange={handleChange}
                        required
                        data-testid="input-company-name"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          name="fullName"
                          placeholder="John Smith"
                          value={formData.fullName}
                          onChange={handleChange}
                          required
                          data-testid="input-full-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="john@company.com"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          data-testid="input-email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="addressLine1">Address Line 1</Label>
                      <Input
                        id="addressLine1"
                        name="addressLine1"
                        placeholder="123 High Street"
                        value={formData.addressLine1}
                        onChange={handleChange}
                        required
                        data-testid="input-address-line-1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="addressLine2">Address Line 2</Label>
                      <Input
                        id="addressLine2"
                        name="addressLine2"
                        placeholder="Suite / Unit (optional)"
                        value={formData.addressLine2}
                        onChange={handleChange}
                        data-testid="input-address-line-2"
                      />
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          name="city"
                          placeholder="Manchester"
                          value={formData.city}
                          onChange={handleChange}
                          required
                          data-testid="input-city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postcode">Postcode</Label>
                        <Input
                          id="postcode"
                          name="postcode"
                          placeholder="M1 1AA"
                          value={formData.postcode}
                          onChange={handleChange}
                          required
                          data-testid="input-postcode"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          name="country"
                          value={formData.country}
                          onChange={handleChange}
                          required
                          data-testid="input-country"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-6 mt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">Payment</h3>
                      </div>
                      <div className="bg-slate-100 rounded-lg p-6 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <ShieldCheck className="h-5 w-5 text-primary" />
                          <span className="font-medium text-sm">
                            Payment powered by Stripe
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Stripe integration handles the actual payment
                          processing securely. Your card details are never stored
                          on our servers.
                        </p>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                      data-testid="button-complete-purchase"
                    >
                      Complete Purchase
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="sticky top-24" data-testid="card-plan-summary">
                <CardContent className="pt-6">
                  <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
                  <div className="border-b pb-4 mb-4">
                    <p
                      className="text-lg font-bold"
                      data-testid="text-plan-name"
                    >
                      {plan.name} Plan
                    </p>
                    <p className="text-3xl font-bold mt-1" data-testid="text-plan-price">
                      {plan.price}
                      <span className="text-base font-normal text-muted-foreground">
                        {plan.period}
                      </span>
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t mt-6 pt-4">
                    <div className="flex items-center justify-between font-semibold">
                      <span>Total</span>
                      <span data-testid="text-total-price">
                        {plan.price}/month
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Cancel anytime. 14-day money-back guarantee.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
