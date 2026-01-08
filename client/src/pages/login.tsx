import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    const result = await login(username, password, requires2FA ? totpToken : undefined);
    
    if (result.success) {
      setLocation("/");
    } else if (result.requiresTwoFactor) {
      setRequires2FA(true);
      setTotpToken("");
    } else {
      setError(result.error || "Invalid username or password");
    }
    setLoading(false);
  };

  const handleBack = () => {
    setRequires2FA(false);
    setTotpToken("");
    setPassword("");
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src="/logo.png" alt="TrueNorth Logo" className="w-12 h-12 rounded-lg" />
          </div>
          <CardTitle className="text-2xl">TrueNorth</CardTitle>
          <CardDescription>
            {requires2FA ? "Enter your authentication code" : "Field View - Sign in to manage your jobs"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {!requires2FA ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input 
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    data-testid="input-username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    data-testid="input-password"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground mb-4">
                  Open your authenticator app and enter the 6-digit code
                </p>
                <div className="space-y-2">
                  <Label htmlFor="totp">Authentication Code</Label>
                  <Input 
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={totpToken}
                    onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-widest font-mono"
                    autoFocus
                    required
                    data-testid="input-totp"
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base" disabled={loading} data-testid="button-login">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {requires2FA ? "Verify" : "Sign In"}
            </Button>
            
            {requires2FA && (
              <Button type="button" variant="ghost" className="w-full" onClick={handleBack} data-testid="button-back">
                Back to login
              </Button>
            )}
            
            {!requires2FA && (
              <div className="text-xs text-center text-muted-foreground mt-4 bg-slate-50 p-3 rounded border">
                <p className="font-semibold mb-1">Demo Credentials:</p>
                <p>Admin: admin / admin123</p>
                <p>Engineer: john / john123</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
