import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Check, Crown, Zap, Building2, Loader2, AlertCircle, Calendar, Users, Briefcase, HardDrive } from "lucide-react";
import { format, differenceInDays } from "date-fns";

type SubscriptionPlan = {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  limits: {
    maxUsers: number;
    maxJobs: number;
    maxClients: number;
    maxStorageGb: number;
    aiAssistantEnabled: boolean;
    apiAccess: boolean;
    customBranding: boolean;
    prioritySupport: boolean;
  };
};

type CurrentSubscription = {
  id: string;
  planId: string;
  planName: string;
  status: string;
  billingCycle: string;
  trialEndDate: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

type UsageData = {
  users: { current: number; limit: number };
  jobs: { current: number; limit: number };
  clients: { current: number; limit: number };
  storage: { current: number; limit: number };
};

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, subRes, usageRes] = await Promise.all([
        fetch("/api/subscription/plans"),
        fetch("/api/subscription/current"),
        fetch("/api/subscription/usage"),
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData);
      }

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData);
      }

      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData);
      }
    } catch (error) {
      console.error("Failed to fetch subscription data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(true);
    try {
      const res = await fetch("/api/subscription/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle }),
      });

      if (res.ok) {
        toast({
          title: "Plan Updated",
          description: "Your subscription has been updated successfully.",
        });
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: "Upgrade Failed",
          description: data.error || "Please configure Stripe to enable billing.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upgrade subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case "starter":
        return <Zap className="h-6 w-6" />;
      case "professional":
        return <Crown className="h-6 w-6" />;
      case "enterprise":
        return <Building2 className="h-6 w-6" />;
      default:
        return <Zap className="h-6 w-6" />;
    }
  };

  const getUsagePercent = (current: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const formatLimit = (value: number) => {
    return value === -1 ? "Unlimited" : value.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F2B4C]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-[#0F2B4C]" data-testid="text-page-title">Subscription & Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription plan and billing</p>
      </div>

      {subscription && (
        <Card className="border-[#0F2B4C]/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[#0F2B4C]">Current Plan</CardTitle>
                <CardDescription>Your active subscription details</CardDescription>
              </div>
              <Badge 
                variant={subscription.status === "active" ? "default" : "secondary"}
                className={subscription.status === "active" ? "bg-green-500" : subscription.status === "trial" ? "bg-amber-500" : ""}
              >
                {subscription.status === "trial" ? "Trial" : subscription.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0F2B4C]/10">
                  <Crown className="h-5 w-5 text-[#0F2B4C]" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="font-semibold text-[#0F2B4C]">{subscription.planName}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0F2B4C]/10">
                  <Calendar className="h-5 w-5 text-[#0F2B4C]" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Billing Cycle</p>
                  <p className="font-semibold text-[#0F2B4C] capitalize">{subscription.billingCycle}</p>
                </div>
              </div>

              {subscription.status === "trial" && subscription.trialEndDate && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Trial Ends</p>
                    <p className="font-semibold text-amber-600">
                      {differenceInDays(new Date(subscription.trialEndDate), new Date())} days left
                    </p>
                  </div>
                </div>
              )}

              {subscription.currentPeriodEnd && subscription.status === "active" && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#0F2B4C]/10">
                    <Calendar className="h-5 w-5 text-[#0F2B4C]" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Next Billing</p>
                    <p className="font-semibold text-[#0F2B4C]">
                      {format(new Date(subscription.currentPeriodEnd), "d MMM yyyy")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {usage && (
        <Card className="border-[#0F2B4C]/20">
          <CardHeader>
            <CardTitle className="text-[#0F2B4C]">Usage</CardTitle>
            <CardDescription>Current usage against your plan limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#0F2B4C]" />
                    <span className="text-sm font-medium">Users</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {usage.users.current} / {formatLimit(usage.users.limit)}
                  </span>
                </div>
                <Progress value={getUsagePercent(usage.users.current, usage.users.limit)} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-[#0F2B4C]" />
                    <span className="text-sm font-medium">Jobs (this month)</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {usage.jobs.current} / {formatLimit(usage.jobs.limit)}
                  </span>
                </div>
                <Progress value={getUsagePercent(usage.jobs.current, usage.jobs.limit)} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#0F2B4C]" />
                    <span className="text-sm font-medium">Clients</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {usage.clients.current} / {formatLimit(usage.clients.limit)}
                  </span>
                </div>
                <Progress value={getUsagePercent(usage.clients.current, usage.clients.limit)} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-[#0F2B4C]" />
                    <span className="text-sm font-medium">Storage</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {usage.storage.current.toFixed(1)} GB / {formatLimit(usage.storage.limit)} GB
                  </span>
                </div>
                <Progress value={getUsagePercent(usage.storage.current, usage.storage.limit)} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#0F2B4C]">Available Plans</h2>
          <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as "monthly" | "yearly")}>
            <TabsList>
              <TabsTrigger value="monthly" data-testid="tab-monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly" data-testid="tab-yearly">
                Yearly <Badge variant="secondary" className="ml-1 text-xs">Save 17%</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.planId === plan.id;
            const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
            
            return (
              <Card 
                key={plan.id} 
                className={`relative ${isCurrentPlan ? "border-[#0F2B4C] border-2" : "border-[#0F2B4C]/20"} ${plan.slug === "professional" ? "shadow-lg" : ""}`}
                data-testid={`card-plan-${plan.slug}`}
              >
                {plan.slug === "professional" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[#0F2B4C]">Most Popular</Badge>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-green-500">Current Plan</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-2 p-3 rounded-full bg-[#0F2B4C]/10 w-fit">
                    {getPlanIcon(plan.slug)}
                  </div>
                  <CardTitle className="text-[#0F2B4C]">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-[#0F2B4C]">£{price}</span>
                    <span className="text-muted-foreground">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  <ul className="space-y-2 text-sm text-left">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className={`w-full ${plan.slug === "professional" ? "bg-[#0F2B4C] hover:bg-[#0F2B4C]/90" : ""}`}
                    variant={plan.slug === "professional" ? "default" : "outline"}
                    disabled={isCurrentPlan || isUpgrading}
                    onClick={() => handleUpgrade(plan.id)}
                    data-testid={`button-select-${plan.slug}`}
                  >
                    {isUpgrading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {isCurrentPlan ? "Current Plan" : plan.slug === "enterprise" ? "Contact Sales" : "Upgrade"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="border-[#0F2B4C]/20 bg-[#0F2B4C]/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-5 w-5 text-[#0F2B4C] mt-0.5" />
            <div>
              <h3 className="font-semibold text-[#0F2B4C]">Need help choosing?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Contact our sales team for a personalised recommendation based on your business needs.
                We offer custom Enterprise plans with dedicated support, custom integrations, and volume discounts.
              </p>
              <Button variant="link" className="px-0 mt-2 text-[#0F2B4C]">
                Contact Sales →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
