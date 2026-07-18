import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Shield, Key, Download, Printer, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

type Step = "password" | "2fa" | "verify" | "backup" | "complete";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Password step
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 2FA step
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");

  // Verify step
  const [totpCode, setTotpCode] = useState("");

  // Backup codes step
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [codesDownloaded, setCodesDownloaded] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to change password");
        setLoading(false);
        return;
      }

      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setStep("2fa");
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-2fa-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totpCode }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid code");
        setLoading(false);
        return;
      }

      setStep("backup");
      // Auto-generate backup codes
      handleGenerateBackupCodes();
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBackupCodes = async () => {
    try {
      const response = await fetch("/api/auth/generate-backup-codes", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setBackupCodes(data.backupCodes);
      }
    } catch (error) {
      console.error("Failed to generate backup codes:", error);
    }
  };

  const handleDownloadBackupCodes = () => {
    const userData = localStorage.getItem('reactpms_user');
    const user = userData ? JSON.parse(userData) : null;
    const username = user?.username || 'user';

    const text = `ReactPMS Backup Codes\n\nUsername: ${username}\nGenerated: ${new Date().toLocaleDateString()}\n\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\n⚠️ IMPORTANT:\n- Each code can only be used once\n- Store these codes in a secure location\n- Do not share these codes with anyone\n- You can regenerate new codes from your settings`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reactpms-backup-codes-${username}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    setCodesDownloaded(true);
    toast({
      title: "Backup Codes Downloaded",
      description: "Store these codes in a secure location.",
    });
  };

  const handlePrintBackupCodes = () => {
    const userData = localStorage.getItem('reactpms_user');
    const user = userData ? JSON.parse(userData) : null;
    const username = user?.username || 'user';

    const printWindow = window.open('', '', 'width=600,height=800');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>ReactPMS Backup Codes</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; }
              h1 { color: #1a73e8; }
              .code { font-size: 18px; font-weight: bold; margin: 10px 0; font-family: monospace; }
              .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h1>ReactPMS Backup Codes</h1>
            <p><strong>Username:</strong> ${username}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
            <div>
              ${backupCodes.map((code, i) => `<div class="code">${i + 1}. ${code}</div>`).join('')}
            </div>
            <div class="warning">
              <strong>⚠️ IMPORTANT:</strong><br>
              • Each code can only be used once<br>
              • Store these codes in a secure location<br>
              • Do not share these codes with anyone<br>
              • You can regenerate new codes from your settings
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      
      setCodesDownloaded(true);
    }
  };

  const handleCompleteOnboarding = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to complete onboarding",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Setup Complete!",
        description: "Your account is now fully secured.",
      });

      // Save user data and redirect
      if (data.user) {
        localStorage.setItem('reactpms_user', JSON.stringify(data.user));
        
        // Redirect based on role
        if (data.user.role === 'engineer' && !data.user.superAdmin) {
          setLocation('/app/my-day');
        } else {
          setLocation('/app');
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to ReactPMS</CardTitle>
          <CardDescription>
            Let's secure your account in a few quick steps
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className={`flex items-center gap-2 ${
              step === "password" ? "text-blue-600" : "text-green-600"
            }`}>
              {step === "password" ? (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">1</div>
              ) : (
                <CheckCircle2 className="w-8 h-8" />
              )}
              <span className="hidden sm:inline font-medium text-sm">Password</span>
            </div>
            <div className="w-8 h-1 bg-gray-200"></div>
            <div className={`flex items-center gap-2 ${
              step === "password" ? "text-gray-400" : 
              step === "2fa" || step === "verify" ? "text-blue-600" : "text-green-600"
            }`}>
              {["password"].includes(step) ? (
                <div className="w-8 h-8 rounded-full bg-gray-300 text-white flex items-center justify-center font-bold text-sm">2</div>
              ) : ["2fa", "verify"].includes(step) ? (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">2</div>
              ) : (
                <CheckCircle2 className="w-8 h-8" />
              )}
              <span className="hidden sm:inline font-medium text-sm">2FA</span>
            </div>
            <div className="w-8 h-1 bg-gray-200"></div>
            <div className={`flex items-center gap-2 ${
              !["backup", "complete"].includes(step) ? "text-gray-400" : 
              step === "backup" ? "text-blue-600" : "text-green-600"
            }`}>
              {!["backup", "complete"].includes(step) ? (
                <div className="w-8 h-8 rounded-full bg-gray-300 text-white flex items-center justify-center font-bold text-sm">3</div>
              ) : step === "backup" ? (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">3</div>
              ) : (
                <CheckCircle2 className="w-8 h-8" />
              )}
              <span className="hidden sm:inline font-medium text-sm">Backup</span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Change Password */}
          {step === "password" && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Key className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900">Create Your Secure Password</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Your temporary password is no longer valid. Choose a strong, unique password you'll remember.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11"
                />
                <p className="text-xs text-slate-600">
                  Must be at least 12 characters with uppercase, lowercase, number, and special character
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11"
                />
              </div>

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Continue to 2FA Setup"
                )}
              </Button>
            </form>
          )}

          {/* Step 2: Setup 2FA */}
          {step === "2fa" && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900">Setup Two-Factor Authentication</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Scan this QR code with Google Authenticator or Microsoft Authenticator on your phone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center">
                {qrCodeDataUrl && (
                  <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-64 h-64 border-4 border-slate-200 rounded-lg" />
                )}
                <p className="text-sm text-slate-600 mt-4">Can't scan? Enter this code manually:</p>
                <code className="mt-2 px-4 py-2 bg-slate-100 rounded font-mono text-sm">{secret}</code>
              </div>

              <Button onClick={() => setStep("verify")} className="w-full h-11">
                I've Scanned the QR Code
              </Button>
            </div>
          )}

          {/* Step 3: Verify 2FA */}
          {step === "verify" && (
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-green-900">Almost Done!</h3>
                    <p className="text-sm text-green-700 mt-1">
                      Enter the 6-digit code from your authenticator app to complete setup.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totpCode">6-Digit Code</Label>
                <Input
                  id="totpCode"
                  type="text"
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  autoFocus
                  className="h-11 text-center text-2xl tracking-widest"
                />
              </div>

              <div className="space-y-2">
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Code"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => setStep("2fa")}
                >
                  Back to QR Code
                </Button>
              </div>
            </form>
          )}

          {/* Step 4: Save Backup Codes */}
          {step === "backup" && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900">Save Your Backup Codes</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      If you lose your phone, these codes will be your only way to regain access.
                      Each code can be used exactly once.
                    </p>
                  </div>
                </div>
              </div>

              {backupCodes.length > 0 && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((code, i) => (
                        <div key={i} className="font-mono text-sm bg-white p-2 rounded border text-center">
                          {i + 1}. {code}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleDownloadBackupCodes}
                      variant="outline"
                      className="h-11"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      onClick={handlePrintBackupCodes}
                      variant="outline"
                      className="h-11"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print
                    </Button>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="codes-saved"
                      checked={codesDownloaded}
                      onChange={(e) => setCodesDownloaded(e.target.checked)}
                      className="mt-1"
                    />
                    <label htmlFor="codes-saved" className="text-sm text-blue-900">
                      I have downloaded or printed my backup codes and stored them securely
                    </label>
                  </div>

                  <Button
                    onClick={handleCompleteOnboarding}
                    className="w-full h-11 bg-green-600 hover:bg-green-700"
                    disabled={!codesDownloaded || loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      "Complete Setup"
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
