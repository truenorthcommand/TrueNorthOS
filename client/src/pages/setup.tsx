import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings, UserPlus, KeyRound } from "lucide-react";

export default function SetupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [setupKey, setSetupKey] = useState("");
  const [mode, setMode] = useState<'choose' | 'reset' | 'create'>('choose');
  
  const [resetForm, setResetForm] = useState({
    username: "admin",
    newPassword: "",
  });
  
  const [createForm, setCreateForm] = useState({
    name: "",
    username: "",
    password: "",
    email: "",
  });

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/setup/reset-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: resetForm.username,
          newPassword: resetForm.newPassword,
          setupKey: setupKey,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast({
          title: "Success!",
          description: "Password reset. Redirecting to dashboard...",
        });
        setTimeout(() => setLocation('/'), 1000);
      } else {
        toast({
          title: "Error",
          description: data.error || "Reset failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Connection failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/setup/first-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: createForm.name,
          username: createForm.username,
          password: createForm.password,
          email: createForm.email || null,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast({
          title: "Success!",
          description: "Admin account created. Redirecting...",
        });
        setTimeout(() => setLocation('/'), 1000);
      } else {
        toast({
          title: "Error",
          description: data.error || "Creation failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Connection failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">TrueNorth OS Setup</CardTitle>
            <p className="text-xs text-muted-foreground mb-2">Built For Trades By Trades</p>
            <CardDescription>
              Choose how to set up your admin access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full h-16" 
              variant="outline"
              onClick={() => setMode('reset')}
              data-testid="button-reset-mode"
            >
              <KeyRound className="mr-3 h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold">Reset Admin Password</div>
                <div className="text-xs text-muted-foreground">If you have an existing admin account</div>
              </div>
            </Button>
            
            <Button 
              className="w-full h-16" 
              variant="outline"
              onClick={() => setMode('create')}
              data-testid="button-create-mode"
            >
              <UserPlus className="mr-3 h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold">Create First Admin</div>
                <div className="text-xs text-muted-foreground">If no admin accounts exist yet</div>
              </div>
            </Button>
            
            <div className="pt-4 text-center">
              <Button variant="link" onClick={() => setLocation('/login')}>
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'reset') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
              <KeyRound className="h-8 w-8 text-orange-600" />
            </div>
            <CardTitle className="text-2xl">Reset Admin Password</CardTitle>
            <CardDescription>
              Enter the setup key and new password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-key">Setup Key</Label>
                <Input
                  id="setup-key"
                  type="password"
                  placeholder="Enter setup key"
                  value={setupKey}
                  onChange={(e) => setSetupKey(e.target.value)}
                  required
                  data-testid="input-setup-key"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="admin"
                  value={resetForm.username}
                  onChange={(e) => setResetForm({...resetForm, username: e.target.value})}
                  required
                  data-testid="input-reset-username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password (min 6 chars)"
                  value={resetForm.newPassword}
                  onChange={(e) => setResetForm({...resetForm, newPassword: e.target.value})}
                  required
                  minLength={6}
                  data-testid="input-reset-password"
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-reset-submit">
                {isLoading ? "Resetting..." : "Reset Password & Login"}
              </Button>
              
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode('choose')}>
                Back
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <UserPlus className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Create First Admin</CardTitle>
          <CardDescription>
            Set up your administrator account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Matthew Cottam"
                value={createForm.name}
                onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                required
                data-testid="input-create-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={createForm.email}
                onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                data-testid="input-create-email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="create-username">Username</Label>
              <Input
                id="create-username"
                placeholder="matthewcottam"
                value={createForm.username}
                onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                required
                data-testid="input-create-username"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Min 6 characters"
                value={createForm.password}
                onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                required
                minLength={6}
                data-testid="input-create-password"
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-create-submit">
              {isLoading ? "Creating..." : "Create Admin & Login"}
            </Button>
            
            <Button type="button" variant="ghost" className="w-full" onClick={() => setMode('choose')}>
              Back
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
