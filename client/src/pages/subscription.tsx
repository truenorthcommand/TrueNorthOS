import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Check, Crown, Zap, Building2, Loader2, AlertCircle, Calendar, Users, 
  Briefcase, HardDrive, Truck, BarChart3, Brain, Link, MessageSquare,
  Plus, Minus, Sparkles, Gift
} from "lucide-react";
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
    additionalUserPrice?: number;
    upgradeDiscount?: number;
  };
};

type AddOn = {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  icon: string;
  category: string;
  features: string[];
};

type SubscribedAddOn = {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  icon: string;
  status: string;
  startDate: string;
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

const iconMap: Record<string, React.ReactNode> = {
  Truck: <Truck className="h-5 w-5" />,
  Zap: <Zap className="h-5 w-5" />,
  BarChart3: <BarChart3 className="h-5 w-5" />,
  Brain: <Brain className="h-5 w-5" />,
  Link: <Link className="h-5 w-5" />,
  HardDrive: <HardDrive className="h-5 w-5" />,
  MessageSquare: <MessageSquare className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
};

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [subscribedAddOns, setSubscribedAddOns] = useState<SubscribedAddOn[]>([]);
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [processingAddOn, setProcessingAddOn] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, subRes, usageRes, addOnsRes, subscribedRes] = await Promise.all([
        fetch("/api/subscription/plans"),
        fetch("/api/subscription/current"),
        fetch("/api/subscription/usage"),
        fetch("/api/addons"),
        fetch("/api/addons/subscribed", { credentials: "include" }),
      ]);

      if (plansRes.ok) setPlans(await plansRes.json());
      if (subRes.ok) setSubscription(await subRes.json());
      if (usageRes.ok) setUsage(await usageRes.json());
      if (addOnsRes.ok) setAddOns(await addOnsRes.json());
      if (subscribedRes.ok) setSubscribedAddOns(await subscribedRes.json());
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

  const handleAddOnToggle = async (addOnId: string, isSubscribed: boolean) => {
    setProcessingAddOn(addOnId);
    try {
      const endpoint = isSubscribed ? "/api/addons/unsubscribe" : "/api/addons/subscribe";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ addOnId }),
      });

      if (res.ok) {
        toast({
          title: isSubscribed ? "Add-on Removed" : "Add-on Added",
          description: isSubscribed 
            ? "The add-on has been removed from your subscription." 
            : "The add-on has been added to your subscription.",
        });
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.error || "Failed to update add-on.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update add-on. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingAddOn(null);
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

  const isAddOnSubscribed = (addOnId: string) => {
    return subscribedAddOns.some(a => a.id === addOnId || subscribedAddOns.some(s => s.slug === addOns.find(ao => ao.id === addOnId)?.slug));
  };

  const calculateMonthlyTotal = () => {
    const corePlan = plans.find(p => p.slug === "starter");
    const basePrice = corePlan?.monthlyPrice || 50;
    const addOnsTotal = subscribedAddOns.reduce((sum, a) => sum + a.monthlyPrice, 0);
    return basePrice + addOnsTotal;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F2B4C]" />
      </div>
    );
  }

  const corePlan = plans.find(p => p.slug === "starter");
  const upgradePlans = plans.filter(p => p.slug !== "starter");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-[#0F2B4C]" data-testid="text-page-title">Subscription & Billing</h1>
        <p className="text-muted-foreground mt-1">Build your perfect plan with Core CRM + bolt-ons</p>
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
                {subscription.status === "trial" ? "14-Day Trial" : subscription.status}
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
                  <Sparkles className="h-5 w-5 text-[#0F2B4C]" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Add-ons</p>
                  <p className="font-semibold text-[#0F2B4C]">{subscribedAddOns.length}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0F2B4C]/10">
                  <Calendar className="h-5 w-5 text-[#0F2B4C]" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Total</p>
                  <p className="font-semibold text-[#0F2B4C]">£{calculateMonthlyTotal()}</p>
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
                <p className="text-xs text-muted-foreground">+£10/user after limit</p>
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

      {corePlan && (
        <Card className="border-[#0F2B4C] border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-[#0F2B4C]/10">
                  <Zap className="h-6 w-6 text-[#0F2B4C]" />
                </div>
                <div>
                  <CardTitle className="text-[#0F2B4C]">{corePlan.name}</CardTitle>
                  <CardDescription>{corePlan.description}</CardDescription>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-[#0F2B4C]">£{corePlan.monthlyPrice}</span>
                <span className="text-muted-foreground">/mo</span>
                <p className="text-xs text-muted-foreground">Up to {corePlan.limits.maxUsers} users included</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-3">
              {corePlan.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#0F2B4C]">Bolt-On Features</h2>
            <p className="text-sm text-muted-foreground">Add extra capabilities to your Core CRM</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {addOns.map((addOn) => {
            const isSubscribed = subscribedAddOns.some(s => s.slug === addOn.slug);
            const isProcessing = processingAddOn === addOn.id;
            
            return (
              <Card 
                key={addOn.id} 
                className={`relative transition-all ${isSubscribed ? "border-green-500 border-2 bg-green-50/50" : "border-[#0F2B4C]/20 hover:border-[#0F2B4C]/40"}`}
                data-testid={`card-addon-${addOn.slug}`}
              >
                {isSubscribed && (
                  <div className="absolute -top-2 -right-2">
                    <Badge className="bg-green-500">Active</Badge>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSubscribed ? "bg-green-100" : "bg-[#0F2B4C]/10"}`}>
                      {iconMap[addOn.icon] || <Sparkles className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{addOn.name}</CardTitle>
                      <p className="text-lg font-bold text-[#0F2B4C]">+£{addOn.monthlyPrice}/mo</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <p className="text-sm text-muted-foreground mb-3">{addOn.description}</p>
                  <ul className="space-y-1">
                    {(addOn.features as string[]).slice(0, 3).map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-1.5 text-xs">
                        <Check className="h-3 w-3 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isSubscribed ? "outline" : "default"}
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => handleAddOnToggle(addOn.id, isSubscribed)}
                    data-testid={`button-addon-${addOn.slug}`}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : isSubscribed ? (
                      <Minus className="h-4 w-4 mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    {isSubscribed ? "Remove" : "Add"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#0F2B4C]">Full Plans</h2>
            <p className="text-sm text-muted-foreground">Upgrade to get everything included</p>
          </div>
          <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as "monthly" | "yearly")}>
            <TabsList>
              <TabsTrigger value="monthly" data-testid="tab-monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly" data-testid="tab-yearly">
                Yearly <Badge variant="secondary" className="ml-1 text-xs">Save 17%</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {upgradePlans.map((plan) => {
            const isCurrentPlan = subscription?.planId === plan.id;
            const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
            const discountedPrice = plan.limits.upgradeDiscount 
              ? Math.round(price * (1 - plan.limits.upgradeDiscount / 100))
              : null;
            
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
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-[#0F2B4C]/10">
                      {getPlanIcon(plan.slug)}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-[#0F2B4C]">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                    <div className="text-right">
                      {discountedPrice && !isCurrentPlan && (
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <Gift className="h-3 w-3 mr-1" />
                            30% off first month
                          </Badge>
                        </div>
                      )}
                      <span className="text-3xl font-bold text-[#0F2B4C]">£{price}</span>
                      <span className="text-muted-foreground">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                      <p className="text-xs text-muted-foreground">
                        Up to {plan.limits.maxUsers} users • +£10/user after
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
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
                    {isCurrentPlan ? "Current Plan" : plan.slug === "enterprise" ? "Contact Sales" : "Upgrade Now"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="border-[#0F2B4C]/20 bg-gradient-to-r from-[#0F2B4C]/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-[#0F2B4C]/10">
              <Gift className="h-5 w-5 text-[#0F2B4C]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0F2B4C]">Refer & Earn</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Earn rewards by referring other trade businesses. Get discounts, free upgrades, and even recurring commissions.
              </p>
              <Button variant="link" className="px-0 mt-2 text-[#0F2B4C]" onClick={() => window.location.href = '/referrals'}>
                View Referral Programme →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
