import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Copy, Users, Gift, TrendingUp, CheckCircle, Clock, 
  QrCode, Share2, Download, ExternalLink, Trophy, Star
} from "lucide-react";
import { format } from "date-fns";

type ReferralDashboard = {
  code: string;
  qrCodeUrl: string | null;
  companyName: string;
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalEarnings: number;
  referrals: Array<{
    id: string;
    referredEmail: string;
    status: string;
    convertedAt: string | null;
    commissionEarned: number | null;
    createdAt: string;
  }>;
  rewards: Array<{
    id: string;
    rewardType: string;
    rewardValue: number;
    description: string;
    status: string;
    expiresAt: string | null;
    claimedAt: string | null;
  }>;
  nextTier: {
    name: string;
    requiredReferrals: number;
    rewardType: string;
    rewardDescription: string;
  } | null;
  allTiers: Array<{
    name: string;
    requiredReferrals: number;
    rewardType: string;
    rewardDescription: string;
  }>;
};

export default function ReferralsPage() {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingReward, setClaimingReward] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/referrals/dashboard", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error("Failed to fetch referral dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (dashboard?.code) {
      const link = `${window.location.origin}/signup?ref=${dashboard.code}`;
      navigator.clipboard.writeText(link);
      toast({
        title: "Link Copied",
        description: "Your referral link has been copied to clipboard.",
      });
    }
  };

  const copyReferralCode = () => {
    if (dashboard?.code) {
      navigator.clipboard.writeText(dashboard.code);
      toast({
        title: "Code Copied",
        description: "Your referral code has been copied to clipboard.",
      });
    }
  };

  const claimReward = async (rewardId: string) => {
    setClaimingReward(rewardId);
    try {
      const res = await fetch(`/api/referrals/rewards/${rewardId}/claim`, {
        method: "POST",
        credentials: "include",
      });
      
      if (res.ok) {
        toast({
          title: "Reward Claimed",
          description: "Your reward has been applied to your account.",
        });
        fetchDashboard();
      } else {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.error || "Failed to claim reward.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to claim reward. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClaimingReward(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "converted":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Converted</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRewardTypeBadge = (type: string) => {
    switch (type) {
      case "percentage_discount":
        return <Badge className="bg-blue-500">Discount</Badge>;
      case "free_month":
        return <Badge className="bg-purple-500">Free Month</Badge>;
      case "free_addon":
        return <Badge className="bg-indigo-500">Free Add-on</Badge>;
      case "tier_upgrade":
        return <Badge className="bg-amber-500">Upgrade</Badge>;
      case "commission":
        return <Badge className="bg-green-500">Commission</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const generateQRCodeUrl = (code: string) => {
    const link = encodeURIComponent(`${window.location.origin}/signup?ref=${code}`);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${link}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F2B4C]" />
      </div>
    );
  }

  const progressToNextTier = dashboard?.nextTier 
    ? (dashboard.successfulReferrals / dashboard.nextTier.requiredReferrals) * 100
    : 100;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-[#0F2B4C]" data-testid="text-page-title">Referral Programme</h1>
        <p className="text-muted-foreground mt-1">Earn rewards by referring other trade businesses</p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-[#0F2B4C]/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
                <p className="text-2xl font-bold text-[#0F2B4C]">{dashboard?.totalReferrals || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F2B4C]/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-green-600">{dashboard?.successfulReferrals || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F2B4C]/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{dashboard?.pendingReferrals || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F2B4C]/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold text-emerald-600">£{(dashboard?.totalEarnings || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-[#0F2B4C] border-2">
          <CardHeader>
            <CardTitle className="text-[#0F2B4C] flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Your Referral Code
            </CardTitle>
            <CardDescription>Share this code with other trade businesses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#0F2B4C]/5 rounded-lg p-4 text-center">
                <p className="text-2xl font-mono font-bold text-[#0F2B4C] tracking-wider">
                  {dashboard?.code || "Loading..."}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyReferralCode}
                data-testid="button-copy-code"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-[#0F2B4C] hover:bg-[#0F2B4C]/90"
                onClick={copyReferralLink}
                data-testid="button-copy-link"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Referral Link
              </Button>
              <Button variant="outline" size="icon">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F2B4C]/20">
          <CardHeader>
            <CardTitle className="text-[#0F2B4C] flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code
            </CardTitle>
            <CardDescription>Scan to access your referral link</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {dashboard?.code && (
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <img 
                  src={generateQRCodeUrl(dashboard.code)} 
                  alt="Referral QR Code"
                  className="w-40 h-40"
                />
              </div>
            )}
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download QR Code
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#0F2B4C]/20">
        <CardHeader>
          <CardTitle className="text-[#0F2B4C] flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Reward Tiers
          </CardTitle>
          <CardDescription>Unlock rewards as you refer more businesses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboard?.nextTier && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progress to {dashboard.nextTier.name}</span>
                <span className="text-sm text-muted-foreground">
                  {dashboard.successfulReferrals} / {dashboard.nextTier.requiredReferrals} referrals
                </span>
              </div>
              <Progress value={progressToNextTier} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1">
                {dashboard.nextTier.requiredReferrals - dashboard.successfulReferrals} more referrals to unlock: {dashboard.nextTier.rewardDescription}
              </p>
            </div>
          )}

          <div className="grid gap-3">
            {dashboard?.allTiers?.map((tier, idx) => {
              const isUnlocked = (dashboard.successfulReferrals || 0) >= tier.requiredReferrals;
              const isCurrent = (dashboard.successfulReferrals || 0) >= tier.requiredReferrals && 
                              (dashboard.allTiers[idx + 1] ? (dashboard.successfulReferrals || 0) < dashboard.allTiers[idx + 1].requiredReferrals : true);
              
              return (
                <div 
                  key={tier.name}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    isCurrent 
                      ? "bg-[#0F2B4C]/10 border-[#0F2B4C]" 
                      : isUnlocked 
                        ? "bg-green-50 border-green-200" 
                        : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      isCurrent ? "bg-[#0F2B4C] text-white" : isUnlocked ? "bg-green-500 text-white" : "bg-gray-300"
                    }`}>
                      {isUnlocked ? <CheckCircle className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className={`font-semibold ${isCurrent ? "text-[#0F2B4C]" : ""}`}>{tier.name}</p>
                      <p className="text-sm text-muted-foreground">{tier.requiredReferrals} referrals</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getRewardTypeBadge(tier.rewardType)}
                    <p className="text-sm text-muted-foreground mt-1">{tier.rewardDescription}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {dashboard?.rewards && dashboard.rewards.length > 0 && (
        <Card className="border-[#0F2B4C]/20">
          <CardHeader>
            <CardTitle className="text-[#0F2B4C] flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Your Rewards
            </CardTitle>
            <CardDescription>Rewards you've earned from referrals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard.rewards.map((reward) => (
                <div 
                  key={reward.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-amber-50 to-transparent"
                >
                  <div className="flex items-center gap-3">
                    <Gift className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium">{reward.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getRewardTypeBadge(reward.rewardType)}
                        <Badge variant={reward.status === "claimed" ? "secondary" : "outline"}>
                          {reward.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {reward.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => claimReward(reward.id)}
                      disabled={claimingReward === reward.id}
                    >
                      {claimingReward === reward.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Claim"
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {dashboard?.referrals && dashboard.referrals.length > 0 && (
        <Card className="border-[#0F2B4C]/20">
          <CardHeader>
            <CardTitle className="text-[#0F2B4C]">Recent Referrals</CardTitle>
            <CardDescription>People who signed up using your code</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard.referrals.map((referral) => (
                <div 
                  key={referral.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{referral.referredEmail || "Anonymous"}</p>
                    <p className="text-sm text-muted-foreground">
                      Signed up {format(new Date(referral.createdAt), "d MMM yyyy")}
                    </p>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(referral.status)}
                    {referral.commissionEarned && (
                      <p className="text-sm text-green-600 mt-1">+£{referral.commissionEarned.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-[#0F2B4C]/20 bg-gradient-to-r from-[#0F2B4C]/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-[#0F2B4C]/10">
              <Loader2 className="h-5 w-5 text-[#0F2B4C]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0F2B4C]">Marketing Materials</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Want van stickers, business cards, or A-frame signs with your referral QR code? 
                Contact us to order your branded marketing kit.
              </p>
              <Button variant="link" className="px-0 mt-2 text-[#0F2B4C]">
                Order Marketing Kit →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
