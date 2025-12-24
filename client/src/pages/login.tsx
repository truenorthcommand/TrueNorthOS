import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_USERS } from "@/lib/mock-data";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [selectedUserEmail, setSelectedUserEmail] = useState(MOCK_USERS[0].email);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(selectedUserEmail);
    if (success) {
      setLocation("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold text-xl">FF</span>
          </div>
          <CardTitle className="text-2xl">Welcome to FieldFlow</CardTitle>
          <CardDescription>Sign in to manage your jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label>Select User Role (Demo Mode)</Label>
              <Select 
                value={selectedUserEmail} 
                onValueChange={setSelectedUserEmail}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_USERS.map((u) => (
                    <SelectItem key={u.id} value={u.email}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
            
            <div className="text-xs text-center text-muted-foreground mt-4 bg-slate-50 p-3 rounded border">
              <p className="font-semibold mb-1">Demo Credentials:</p>
              <p>Admin: admin@fieldflow.com</p>
              <p>Engineer: john@fieldflow.com</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
