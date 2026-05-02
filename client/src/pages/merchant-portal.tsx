import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Users, TrendingUp, DollarSign, LogOut
} from "lucide-react";

interface MerchantUser {
  id: string;
  name: string;
  slug: string;
  email: string;
  payout_method: string;
  active: boolean;
  created_at: string;
}

interface MerchantStats {
  code: string;
  totalScans: number;
  activeCustomers: number;
  lifetimeEarnings: number;
  unpaidEarnings: number;
}

function MerchantLogin({ onLogin }: { onLogin: (merchant: MerchantUser) => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/merchants/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const merchant = await res.json();
        onLogin(merchant);
      } else {
        const err = await res.json();
        toast({ title: "Login Failed", description: err.error || "Invalid credentials", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Connection failed. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md" data-testid="card-merchant-login">
        <CardHeader className="text-center">
          <img src="/logo-truenorth-os.png" alt="Adapt Services Group" className="h-12 mx-auto mb-4" />
          <CardTitle className="text-2xl">Merchant Portal</CardTitle>
          <CardDescription>Sign in to view your referral earnings and stats</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="merchant@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-merchant-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-merchant-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-merchant-login">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function MerchantDashboard({ merchant, onLogout }: { merchant: MerchantUser; onLogout: () => void }) {
  const { toast } = useToast();
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/merchants/stats", { credentials: "include" });
      if (res.ok) setStats(await res.json());
    } catch (error) {
      console.error("Failed to fetch merchant stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/merchants/logout", { method: "POST", credentials: "include" });
    onLogout();
  };

  const requestPayout = async () => {
    try {
      const res = await fetch("/api/merchants/request-payout", { method: "POST", credentials: "include" });
      if (res.ok) {
        toast({ title: "Payout Requested", description: "Your payout request has been submitted for admin review." });
      }
    } catch {
      toast({ title: "Error", description: "Failed to submit payout request.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const partnerUrl = `${window.location.origin}/partners/${merchant.slug}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-truenorth-os.png" alt="Adapt Services Group" className="h-8" />
            <div>
              <h1 className="text-lg font-bold" data-testid="text-merchant-name">{merchant.name}</h1>
              <p className="text-xs text-muted-foreground">Merchant Partner</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-merchant-logout">
            <LogOut className="h-4 w-4 mr-1" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Merchant Dashboard</h2>
          <p className="text-muted-foreground mt-1">Track your referral performance and earnings</p>
        </div>

        {stats ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card data-testid="card-merchant-scans">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-merchant-scans">{stats.totalScans}</div>
                </CardContent>
              </Card>

              <Card data-testid="card-merchant-customers">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-merchant-customers">{stats.activeCustomers}</div>
                </CardContent>
              </Card>

              <Card data-testid="card-merchant-earnings">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lifetime Earnings</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-merchant-earnings">
                    £{stats.lifetimeEarnings.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-merchant-unpaid">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unpaid Balance</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600" data-testid="text-merchant-unpaid">
                    £{stats.unpaidEarnings.toFixed(2)}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    disabled={stats.unpaidEarnings <= 0}
                    onClick={requestPayout}
                    data-testid="button-request-payout"
                  >
                    Request Payout
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-merchant-partner-link">
              <CardHeader>
                <CardTitle>Your Partner Link</CardTitle>
                <CardDescription>Share this link with potential Adapt Services Group customers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm break-all" data-testid="text-partner-url">
                    {partnerUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(partnerUrl);
                      toast({ title: "Copied", description: "Partner link copied to clipboard." });
                    }}
                    data-testid="button-copy-partner-link"
                  >
                    Copy
                  </Button>
                </div>
                {stats.code && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Referral Code: <strong>{stats.code}</strong>
                  </p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-merchant-info">
              <CardHeader>
                <CardTitle>Commission Structure</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-1">Sign-up Bonus</h4>
                    <p className="text-2xl font-bold text-green-600">£10.00</p>
                    <p className="text-xs text-muted-foreground">Per qualified customer sign-up</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-1">Recurring Commission</h4>
                    <p className="text-2xl font-bold text-green-600">5%</p>
                    <p className="text-xs text-muted-foreground">Of each referred customer's subscription, monthly</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Payout method: {merchant.payout_method === "bank" ? "Bank Transfer" : "Account Credit"}
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Unable to load stats. Please try again later.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function MerchantPortal() {
  const [merchant, setMerchant] = useState<MerchantUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch("/api/merchants/me", { credentials: "include" });
      if (res.ok) {
        setMerchant(await res.json());
      }
    } catch {
      // Not logged in
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!merchant) {
    return <MerchantLogin onLogin={setMerchant} />;
  }

  return <MerchantDashboard merchant={merchant} onLogout={() => setMerchant(null)} />;
}
