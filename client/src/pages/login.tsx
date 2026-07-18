import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Shield, User, Lock, Key } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Form state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  
  // UI state
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = useBackupCode ? "/api/auth/login-backup-code" : "/api/auth/login";
      const body = useBackupCode
        ? { username, password, backupCode }
        : { username, password, totpCode: requiresTwoFactor ? totpCode : undefined };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 423) {
          // Account locked
          setError(`Account locked. Try again in ${data.remainingMinutes} minutes.`);
        } else if (data.remainingAttempts !== undefined) {
          setError(`Invalid credentials. ${data.remainingAttempts} attempts remaining.`);
        } else {
          setError(data.error || "Login failed");
        }
        setLoading(false);
        return;
      }

      // Handle 2FA requirement
      if (data.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setLoading(false);
        return;
      }

      // Handle onboarding requirement
      if (data.requiresOnboarding) {
        toast({
          title: "Welcome!",
          description: "Please complete your account setup.",
        });
        setLocation("/onboarding");
        return;
      }

      // Handle password change requirement
      if (data.requiresPasswordChange) {
        toast({
          title: "Password Change Required",
          description: data.reason === "password_expired" 
            ? "Your password has expired. Please set a new one."
            : "Please change your temporary password.",
        });
        setLocation("/change-password");
        return;
      }

      // Show warning if backup codes are low
      if (data.warning) {
        toast({
          title: "Warning",
          description: data.warning,
          variant: "destructive",
        });
      }

      // Successful login - save user data and redirect
      if (data.user) {
        localStorage.setItem('reactpms_user', JSON.stringify(data.user));
        
        // Redirect based on role
        // Use window.location.href for full page reload so AuthProvider re-initializes
        if (data.user.role === 'engineer' && !data.user.superAdmin) {
          window.location.href = '/app/my-day';
        } else {
          window.location.href = '/app';
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setRequiresTwoFactor(false);
    setUseBackupCode(false);
    setTotpCode("");
    setBackupCode("");
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <img
              src="/logo-pms.png"
              alt="ReactPMS"
              className="h-20 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            React Property Maintenance
          </CardTitle>
          <CardDescription className="text-slate-600">
            {requiresTwoFactor
              ? "Enter your authentication code"
              : "Professional Field Service Management"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Error alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username field */}
            {!requiresTwoFactor && (
              <div className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-2 text-slate-700">
                  <User className="w-4 h-4" />
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="sarah.jones"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
                  className="h-11"
                />
              </div>
            )}

            {/* Password field */}
            {!requiresTwoFactor && (
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-slate-700">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>
            )}

            {/* 2FA or Backup Code input */}
            {requiresTwoFactor && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    Logged in as <strong>{username}</strong>
                  </p>
                </div>

                {!useBackupCode ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="totpCode" className="flex items-center gap-2 text-slate-700">
                        <Shield className="w-4 h-4" />
                        Authentication Code
                      </Label>
                      <Input
                        id="totpCode"
                        type="text"
                        placeholder="000000"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        required
                        disabled={loading}
                        autoComplete="one-time-code"
                        autoFocus
                        className="h-11 text-center text-2xl tracking-widest"
                      />
                      <p className="text-xs text-slate-600">
                        Enter the 6-digit code from your authenticator app
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setUseBackupCode(true)}
                      className="w-full text-sm text-slate-600 hover:text-slate-900"
                    >
                      Lost your phone? Use a backup code instead
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="backupCode" className="flex items-center gap-2 text-slate-700">
                        <Key className="w-4 h-4" />
                        Backup Code
                      </Label>
                      <Input
                        id="backupCode"
                        type="text"
                        placeholder="A3K9-7M2P"
                        value={backupCode}
                        onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                        maxLength={9}
                        required
                        disabled={loading}
                        autoFocus
                        className="h-11 text-center text-xl font-mono tracking-wider"
                      />
                      <p className="text-xs text-slate-600">
                        Enter one of your backup codes (8 characters)
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setUseBackupCode(false)}
                      className="w-full text-sm text-slate-600 hover:text-slate-900"
                    >
                      Use authenticator app instead
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2 pt-2">
              {requiresTwoFactor && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={loading}
                  className="w-full h-11"
                >
                  Back to Login
                </Button>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : requiresTwoFactor ? (
                  "Verify & Sign In"
                ) : (
                  "Sign In"
                )}
              </Button>
            </div>
          </form>

          {/* Help text */}
          {!requiresTwoFactor && (
            <div className="mt-6 text-center space-y-1">
              <p className="text-sm text-slate-600">Forgot your password?</p>
              <p className="text-sm text-slate-800 font-medium">
                Contact your system administrator for assistance.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-500">
              Powered by <span className="font-semibold">ReactPMS</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
