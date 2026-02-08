import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Copy, Users, TrendingUp, Download, DollarSign, Check, Percent
} from "lucide-react";
import QRCode from "qrcode";

interface ReferralStats {
  code: string;
  totalScans: number;
  totalSignups: number;
  qualifiedReferrals: number;
  currentDiscount: number;
  monthlySavings: number;
  discount: {
    reviewDiscount: number;
    referralDiscount: number;
    fixedMonthlyCredit: number;
    totalPercentDiscount: number;
    effectiveDiscount: number;
    monthlySavings: number;
    cappedReferrals: number;
    creditPerCappedReferral: number;
    totalPostCapCredit: number;
  };
}

interface ReviewReward {
  id: string;
  user_id: string;
  type: string;
  value_type: string;
  value: number;
  active: boolean;
  verified_at: string | null;
  created_at: string;
}

export default function ReferralsPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [rewards, setRewards] = useState<ReviewReward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, rewardsRes] = await Promise.all([
        fetch("/api/referrals/stats", { credentials: "include" }),
        fetch("/api/review-rewards", { credentials: "include" }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      } else if (statsRes.status === 404) {
        const createRes = await fetch("/api/referrals/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ownerType: "customer", landingType: "customer" }),
        });
        if (createRes.ok) {
          const retryStats = await fetch("/api/referrals/stats", { credentials: "include" });
          if (retryStats.ok) setStats(await retryStats.json());
        }
      }

      if (rewardsRes.ok) {
        setRewards(await rewardsRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch referral data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const referralUrl = stats ? `${window.location.origin}/r/${stats.code}` : "";

  useEffect(() => {
    if (!referralUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, referralUrl, { width: 200, margin: 2 });
    QRCode.toDataURL(referralUrl, { width: 400 }).then(setQrDataUrl);
  }, [referralUrl]);

  const copyLink = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      toast({ title: "Link Copied", description: "Your referral link has been copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "truenorth-referral-qr.png";
    a.click();
    toast({ title: "QR Downloaded", description: "Your QR code has been saved." });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="referrals-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="referrals-error">
        <p className="text-muted-foreground">Unable to load referral data. Please try again later.</p>
      </div>
    );
  }

  const reviewTypeLabels: Record<string, string> = {
    google: "Google Review",
    trustpilot: "Trustpilot Review",
    g2: "G2 Review",
    linkedin: "LinkedIn Post",
    video: "Video Testimonial",
    case_study: "Case Study",
  };

  return (
    <div className="space-y-6 p-6" data-testid="referrals-page">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-page-title">Referral Dashboard</h2>
        <p className="text-muted-foreground mt-1">
          Earn discounts by referring other trade businesses to TrueNorth OS. Each qualified referral gives you 5% off your subscription.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-scans">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-scans">{stats.totalScans}</div>
            <p className="text-xs text-muted-foreground">People who scanned your QR/link</p>
          </CardContent>
        </Card>

        <Card data-testid="card-signups">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sign-ups</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-signups">{stats.totalSignups}</div>
            <p className="text-xs text-muted-foreground">People who registered</p>
          </CardContent>
        </Card>

        <Card data-testid="card-qualified">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified Referrals</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-qualified">{stats.qualifiedReferrals}</div>
            <p className="text-xs text-muted-foreground">Verified paying customers</p>
          </CardContent>
        </Card>

        <Card data-testid="card-savings">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Savings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600" data-testid="text-savings">
              £{stats.monthlySavings.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">{stats.currentDiscount}% total discount</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Referral Link & QR */}
        <Card data-testid="card-referral-link">
          <CardHeader>
            <CardTitle>Your Referral Link</CardTitle>
            <CardDescription>Share this link or QR code with other trade businesses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm break-all" data-testid="text-referral-url">
                {referralUrl}
              </code>
              <Button onClick={copyLink} variant="outline" size="sm" data-testid="button-copy-link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className="border rounded-lg p-2 bg-white">
                <canvas ref={canvasRef} data-testid="qr-code-canvas" />
              </div>
              <div className="space-y-2">
                <Button onClick={downloadQR} variant="outline" size="sm" data-testid="button-download-qr">
                  <Download className="mr-1 h-4 w-4" /> Download QR
                </Button>
                <p className="text-xs text-muted-foreground">
                  Print this QR code on business cards, van stickers, or invoices.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discount Breakdown */}
        <Card data-testid="card-discount-breakdown">
          <CardHeader>
            <CardTitle>Your Discount Breakdown</CardTitle>
            <CardDescription>How your subscription discount is calculated</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Referral Discount</span>
                </div>
                <span className="text-sm font-semibold" data-testid="text-referral-discount">
                  {stats.discount.referralDiscount}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Review Discount</span>
                </div>
                <span className="text-sm font-semibold" data-testid="text-review-discount">
                  {stats.discount.reviewDiscount}%
                </span>
              </div>
              {stats.discount.fixedMonthlyCredit > 0 && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Fixed Monthly Credit</span>
                  </div>
                  <span className="text-sm font-semibold">
                    £{stats.discount.fixedMonthlyCredit.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Effective Discount</span>
                  <span className="text-sm font-bold text-green-600" data-testid="text-effective-discount">
                    {stats.discount.effectiveDiscount}% (capped at 50%)
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm font-medium">Monthly Savings</span>
                  <span className="text-sm font-bold text-green-600" data-testid="text-monthly-savings">
                    £{stats.discount.monthlySavings.toFixed(2)}
                  </span>
                </div>
              </div>

              {stats.discount.cappedReferrals > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 mt-2">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    You have {stats.discount.cappedReferrals} referral(s) beyond the 50% cap.
                    Each earns you £{stats.discount.creditPerCappedReferral} account credit.
                    Total credit: <strong>£{stats.discount.totalPostCapCredit.toFixed(2)}</strong>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card data-testid="card-how-it-works">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-sm">Share Your Link</h4>
                <p className="text-xs text-muted-foreground">
                  Share your unique referral link or QR code with other trade businesses.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-sm">They Sign Up</h4>
                <p className="text-xs text-muted-foreground">
                  When they register and subscribe, the referral is tracked automatically.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-sm">You Save</h4>
                <p className="text-xs text-muted-foreground">
                  Get 5% off per qualified referral, up to 50%. Beyond that, earn £25 account credit per referral.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Rewards */}
      <Card data-testid="card-review-rewards">
        <CardHeader>
          <CardTitle>Review Rewards</CardTitle>
          <CardDescription>
            Earn extra discounts by leaving reviews on popular platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rewards.length > 0 ? (
            <div className="space-y-3">
              {rewards.map((reward) => (
                <div key={reward.id} className="flex items-center justify-between border rounded-lg p-3" data-testid={`review-reward-${reward.id}`}>
                  <div>
                    <p className="font-medium text-sm">
                      {reviewTypeLabels[reward.type] || reward.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reward.verified_at ? "Verified" : "Pending verification"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-green-600">
                      {reward.value_type === "percent" ? `${reward.value}% off` : `£${reward.value}`}
                    </span>
                    {reward.active && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">
                No review rewards yet. Leave a review on Google, Trustpilot, G2, or LinkedIn to earn extra discounts!
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {["Google", "Trustpilot", "G2", "LinkedIn"].map((platform) => (
                  <span key={platform} className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-muted">
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
