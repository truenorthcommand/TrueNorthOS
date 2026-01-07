import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, User, Shield, Wrench, AlertCircle, Eye, EyeOff, Lock, KeyRound, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  username: string;
  role: 'admin' | 'engineer';
}

export default function Staff() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    role: "engineer" as 'admin' | 'engineer',
    contactMethod: "email" as 'email' | 'phone',
  });
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    role: "engineer" as 'admin' | 'engineer',
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verifyPassword) {
      toast({
        title: "Password Required",
        description: "Please enter your password to access staff management.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: verifyPassword }),
      });

      if (res.ok) {
        setIsVerified(true);
        setVerifyPassword("");
        fetchStaff();
      } else {
        const data = await res.json();
        toast({
          title: "Access Denied",
          description: data.error || "Invalid password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify password",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStaff(data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load staff members",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.superAdmin) {
      setIsVerified(true);
      fetchStaff();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  if (!user || !user.superAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">Only super administrators can manage staff.</p>
      </div>
    );
  }

  // Password verification screen
  if (!isVerified) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Staff Management</CardTitle>
            <CardDescription>
              This area is password protected. Please enter your password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-password">Your Password</Label>
                <div className="relative">
                  <Input
                    id="verify-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={verifyPassword}
                    onChange={(e) => setVerifyPassword(e.target.value)}
                    data-testid="input-verify-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={isVerifying}
                data-testid="button-verify-password"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {isVerifying ? "Verifying..." : "Unlock Staff Management"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const contactValue = newStaff.contactMethod === 'email' ? newStaff.email : newStaff.phone;
    
    if (!newStaff.name || !contactValue || !newStaff.username || !newStaff.password) {
      toast({
        title: "Missing Information",
        description: `Please fill in name, ${newStaff.contactMethod === 'email' ? 'email' : 'phone number'}, username, and password.`,
        variant: "destructive",
      });
      return;
    }

    if (newStaff.password.length < 6) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: newStaff.name,
        email: newStaff.contactMethod === 'email' ? newStaff.email : null,
        phone: newStaff.contactMethod === 'phone' ? newStaff.phone : null,
        username: newStaff.username,
        password: newStaff.password,
        role: newStaff.role,
      };

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create staff member');
      }

      setStaff([...staff, data]);
      setNewStaff({ name: "", email: "", phone: "", username: "", password: "", role: "engineer", contactMethod: "email" });
      setShowPassword(false);

      toast({
        title: "Staff Added",
        description: `${data.name} has been added as ${data.role}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add staff member",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setEditForm({
      name: member.name,
      email: member.email || "",
      phone: member.phone || "",
      username: member.username,
      password: "",
      role: member.role,
    });
    setShowEditPassword(false);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setIsEditing(true);
    try {
      const updateData: any = {
        name: editForm.name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        username: editForm.username,
        role: editForm.role,
      };
      
      if (editForm.password) {
        if (editForm.password.length < 6) {
          toast({
            title: "Weak Password",
            description: "Password must be at least 6 characters.",
            variant: "destructive",
          });
          setIsEditing(false);
          return;
        }
        updateData.password = editForm.password;
      }

      const res = await fetch(`/api/users/${editingStaff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update staff member');
      }

      setStaff(staff.map(s => s.id === editingStaff.id ? data : s));
      setEditingStaff(null);

      toast({
        title: "Staff Updated",
        description: `${data.name} has been updated.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update staff member",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete staff member');
      }

      setStaff(staff.filter(s => s.id !== id));
      
      toast({
        title: "Staff Removed",
        description: `${name} has been removed.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove staff member",
        variant: "destructive",
      });
    }
  };

  const admins = staff.filter(s => s.role === 'admin');
  const engineers = staff.filter(s => s.role === 'engineer');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading staff...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground">
            Add and remove administrators and engineers
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Lock className="h-3 w-3" />
          Protected
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Staff Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="John Smith"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  data-testid="input-staff-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Method</Label>
                <Select
                  value={newStaff.contactMethod}
                  onValueChange={(value: 'email' | 'phone') => setNewStaff({ ...newStaff, contactMethod: value })}
                >
                  <SelectTrigger data-testid="select-contact-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email Address</SelectItem>
                    <SelectItem value="phone">Phone Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                {newStaff.contactMethod === 'email' ? (
                  <>
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="john@company.com"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                      data-testid="input-staff-email"
                    />
                  </>
                ) : (
                  <>
                    <Label>Phone Number</Label>
                    <Input
                      type="tel"
                      placeholder="07123 456789"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                      data-testid="input-staff-phone"
                    />
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label>Username (for login)</Label>
                <Input
                  placeholder="johnsmith"
                  value={newStaff.username}
                  onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  data-testid="input-staff-username"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 characters"
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    data-testid="input-staff-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={newStaff.role}
                  onValueChange={(value: 'admin' | 'engineer') => setNewStaff({ ...newStaff, role: value })}
                >
                  <SelectTrigger data-testid="select-staff-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="engineer">Engineer</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              type="submit" 
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={isSubmitting}
              data-testid="button-add-staff"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isSubmitting ? "Adding..." : "Add Staff Member"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Administrators ({admins.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {admins.length === 0 ? (
              <p className="text-muted-foreground text-sm">No administrators</p>
            ) : (
              <div className="space-y-3">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
                    data-testid={`staff-admin-${admin.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{admin.name}</p>
                        <p className="text-sm text-muted-foreground">@{admin.username}</p>
                        <p className="text-xs text-muted-foreground">{admin.email || admin.phone || ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        Admin
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditStaff(admin)}
                        data-testid={`button-edit-${admin.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {admin.id !== user.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteStaff(admin.id, admin.name)}
                          data-testid={`button-delete-${admin.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="h-5 w-5 text-emerald-600" />
              Engineers ({engineers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {engineers.length === 0 ? (
              <p className="text-muted-foreground text-sm">No engineers</p>
            ) : (
              <div className="space-y-3">
                {engineers.map((engineer) => (
                  <div
                    key={engineer.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
                    data-testid={`staff-engineer-${engineer.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <User className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium">{engineer.name}</p>
                        <p className="text-sm text-muted-foreground">@{engineer.username}</p>
                        <p className="text-xs text-muted-foreground">{engineer.email || engineer.phone || ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Engineer
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditStaff(engineer)}
                        data-testid={`button-edit-${engineer.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteStaff(engineer.id, engineer.name)}
                        data-testid={`button-delete-${engineer.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateStaff} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email (optional)</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="john@company.com"
                data-testid="input-edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone (optional)</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="07123 456789"
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                required
                data-testid="input-edit-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showEditPassword ? "text" : "password"}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Enter new password..."
                  data-testid="input-edit-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                >
                  {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {editForm.password && editForm.password.length < 6 && (
                <p className="text-xs text-destructive">Password must be at least 6 characters</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: 'admin' | 'engineer') => setEditForm({ ...editForm, role: value })}
              >
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="engineer">Engineer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingStaff(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isEditing} data-testid="button-update-staff">
                {isEditing ? "Updating..." : "Update Staff"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
