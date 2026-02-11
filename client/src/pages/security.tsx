import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Shield, Key, Loader2, Check, X, Eye, EyeOff, Download, Trash2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Security() {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [setup2FAData, setSetup2FAData] = useState<{ secret: string; qrCode: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [isDisabling, setIsDisabling] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [isExportingData, setIsExportingData] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const exportData = async () => {
    setIsExportingData(true);
    try {
      const res = await fetch("/api/user/export-data", {
        method: "GET",
        credentials: "include",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to export data");
      }
      
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Your data has been exported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setIsExportingData(false);
    }
  };

  const requestAccountDeletion = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/user/request-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: deletePassword }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to request deletion");
      }
      
      toast({
        title: "Deletion Requested",
        description: "Your account deletion request has been submitted. An admin will process your request.",
      });
      
      setShowDeleteDialog(false);
      setDeletePassword("");
      setDeleteConfirmText("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request account deletion",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const setup2FA = async () => {
    setIsSettingUp2FA(true);
    try {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        credentials: "include",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to set up 2FA");
      }
      
      const data = await res.json();
      setSetup2FAData(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to set up two-factor authentication",
        variant: "destructive",
      });
    } finally {
      setIsSettingUp2FA(false);
    }
  };

  const verify2FA = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: verificationCode }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Verification failed");
      }
      
      toast({
        title: "Success",
        description: "Two-factor authentication is now enabled",
      });
      
      setSetup2FAData(null);
      setVerificationCode("");
      await refreshUser();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to verify code",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const disable2FA = async () => {
    setIsDisabling(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: disablePassword }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disable 2FA");
      }
      
      toast({
        title: "Success",
        description: "Two-factor authentication has been disabled",
      });
      
      setShowDisableDialog(false);
      setDisablePassword("");
      await refreshUser();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to disable two-factor authentication",
        variant: "destructive",
      });
    } finally {
      setIsDisabling(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    
    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }
      
      toast({
        title: "Success",
        description: "Your password has been changed",
      });
      
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const cancelSetup = () => {
    setSetup2FAData(null);
    setVerificationCode("");
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
        <p className="text-muted-foreground">Manage your account security and authentication</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using an authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.twoFactorEnabled ? (
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-900">Two-factor authentication is enabled</p>
                  <p className="text-sm text-green-700">Your account is protected with an authenticator app</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowDisableDialog(true)}
                data-testid="button-disable-2fa"
              >
                Disable
              </Button>
            </div>
          ) : setup2FAData ? (
            <div className="space-y-6">
              <Alert>
                <AlertDescription>
                  Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)
                </AlertDescription>
              </Alert>
              
              <div className="flex justify-center">
                <img 
                  src={setup2FAData.qrCode} 
                  alt="2FA QR Code" 
                  className="border rounded-lg p-2 bg-white"
                  data-testid="img-qr-code"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Can't scan? Enter this code manually:
                </Label>
                <code className="block p-3 bg-muted rounded font-mono text-sm break-all text-center" data-testid="text-secret-key">
                  {setup2FAData.secret}
                </code>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input
                    id="verification-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="text-center text-xl tracking-widest font-mono"
                    data-testid="input-verification-code"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={verify2FA} 
                    disabled={verificationCode.length !== 6 || isVerifying}
                    className="flex-1"
                    data-testid="button-verify-2fa"
                  >
                    {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify and Enable
                  </Button>
                  <Button variant="outline" onClick={cancelSetup} data-testid="button-cancel-2fa">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full">
                  <X className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Two-factor authentication is not enabled</p>
                  <p className="text-sm text-muted-foreground">Protect your account with an authenticator app</p>
                </div>
              </div>
              <Button onClick={setup2FA} disabled={isSettingUp2FA} data-testid="button-setup-2fa">
                {isSettingUp2FA && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set Up
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  data-testid="input-current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 8 characters)"
                  required
                  minLength={8}
                  data-testid="input-new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                data-testid="input-confirm-password"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-destructive">Passwords do not match</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
              data-testid="button-change-password"
            >
              {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator className="my-8" />
      
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        Data Privacy (GDPR)
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a copy of all your personal data in JSON format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Under GDPR, you have the right to receive a copy of your personal data. 
            This includes your profile information, job history, and any data associated with your account.
          </p>
          <Button 
            onClick={exportData} 
            disabled={isExportingData}
            variant="outline"
            data-testid="button-export-data"
          >
            {isExportingData && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Download className="mr-2 h-4 w-4" />
            Download My Data
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Request permanent deletion of your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              Account deletion is permanent and cannot be undone. All your data including job history, 
              messages, and personal information will be permanently removed.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => setShowDeleteDialog(true)}
            variant="destructive"
            data-testid="button-request-deletion"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Request Account Deletion
          </Button>
        </CardContent>
      </Card>


      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your password to confirm disabling two-factor authentication. This will make your account less secure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="disable-password">Password</Label>
              <Input
                id="disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter your password"
                data-testid="input-disable-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={disable2FA}
              disabled={!disablePassword || isDisabling}
              data-testid="button-confirm-disable-2fa"
            >
              {isDisabling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All your data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertDescription>
                Your account, job history, messages, and all associated data will be permanently removed.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="delete-password">Enter your password to confirm</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
                data-testid="input-delete-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
              <Input
                id="delete-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                data-testid="input-delete-confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setDeletePassword("");
              setDeleteConfirmText("");
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={requestAccountDeletion}
              disabled={!deletePassword || deleteConfirmText !== "DELETE" || isDeleting}
              data-testid="button-confirm-deletion"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete My Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
