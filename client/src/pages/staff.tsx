import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, User, Shield, Wrench, AlertCircle, Eye, EyeOff, Lock, KeyRound, Pencil, MapPin, Truck, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

type Role = 'admin' | 'engineer' | 'surveyor' | 'fleet_manager';
type Skill = { id: string; name: string; category: string; icon?: string; };

interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  username: string;
  role: Role;
  roles?: Role[];
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  county?: string | null;
  homePostcode?: string | null;
  skills?: Skill[];
  managerId?: string | null;
}

interface WorksManager {
  id: string;
  name: string;
  email: string | null;
}

const ALL_ROLES: { value: Role; label: string; color: string }[] = [
  { value: 'admin', label: 'Administrator', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'engineer', label: 'Engineer', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'surveyor', label: 'Surveyor', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'fleet_manager', label: 'Fleet Manager', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
];

const getRoleBadgeColor = (role: Role): string => {
  const found = ALL_ROLES.find(r => r.value === role);
  return found?.color || 'bg-gray-100 text-gray-700';
};

const getRoleLabel = (role: Role): string => {
  const found = ALL_ROLES.find(r => r.value === role);
  return found?.label || role;
};

export default function Staff() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [worksManagers, setWorksManagers] = useState<WorksManager[]>([]);
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
    roles: ["engineer"] as Role[],
    contactMethod: "email" as 'email' | 'phone',
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    homePostcode: "",
  });
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    roles: ["engineer"] as Role[],
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    homePostcode: "",
    managerId: "" as string | null,
  });
  const [editSkills, setEditSkills] = useState<Skill[]>([]);
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
        fetchSkills();
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

  const fetchSkills = async () => {
    try {
      const res = await fetch('/api/skills', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAvailableSkills(data);
      }
    } catch (error) {
      console.error('Failed to fetch skills:', error);
    }
  };

  const fetchWorksManagers = async () => {
    try {
      const res = await fetch('/api/works-managers', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWorksManagers(data);
      }
    } catch (error) {
      console.error('Failed to fetch works managers:', error);
    }
  };

  const fetchUserSkills = async (userId: string): Promise<Skill[]> => {
    try {
      const res = await fetch(`/api/users/${userId}/skills`, { credentials: 'include' });
      if (res.ok) {
        return await res.json();
      }
    } catch (error) {
      console.error('Failed to fetch user skills:', error);
    }
    return [];
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const staffWithSkills = await Promise.all(
          data.map(async (member: StaffMember) => {
            const skills = await fetchUserSkills(member.id);
            return { ...member, skills };
          })
        );
        setStaff(staffWithSkills);
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
      fetchSkills();
      fetchWorksManagers();
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

  const handleRoleToggle = (role: Role, checked: boolean, isEdit: boolean) => {
    if (isEdit) {
      if (checked) {
        setEditForm({ ...editForm, roles: [...editForm.roles, role] });
      } else {
        setEditForm({ ...editForm, roles: editForm.roles.filter(r => r !== role) });
      }
    } else {
      if (checked) {
        setNewStaff({ ...newStaff, roles: [...newStaff.roles, role] });
      } else {
        setNewStaff({ ...newStaff, roles: newStaff.roles.filter(r => r !== role) });
      }
    }
  };

  const handleAddSkill = async (skillId: string) => {
    if (!editingStaff) return;
    try {
      const res = await fetch(`/api/users/${editingStaff.id}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skillId }),
      });
      if (res.ok) {
        const skill = availableSkills.find(s => s.id === skillId);
        if (skill) {
          setEditSkills([...editSkills, skill]);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add skill",
        variant: "destructive",
      });
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    if (!editingStaff) return;
    try {
      const res = await fetch(`/api/users/${editingStaff.id}/skills/${skillId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setEditSkills(editSkills.filter(s => s.id !== skillId));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove skill",
        variant: "destructive",
      });
    }
  };

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

    if (newStaff.roles.length === 0) {
      toast({
        title: "Missing Role",
        description: "Please select at least one role.",
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
        role: newStaff.roles[0],
        roles: newStaff.roles,
        addressLine1: newStaff.addressLine1 || null,
        addressLine2: newStaff.addressLine2 || null,
        city: newStaff.city || null,
        county: newStaff.county || null,
        homePostcode: newStaff.homePostcode || null,
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

      setStaff([...staff, { ...data, skills: [] }]);
      setNewStaff({ 
        name: "", email: "", phone: "", username: "", password: "", 
        roles: ["engineer"], contactMethod: "email",
        addressLine1: "", addressLine2: "", city: "", county: "", homePostcode: ""
      });
      setShowPassword(false);

      toast({
        title: "Staff Added",
        description: `${data.name} has been added.`,
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

  const handleEditStaff = async (member: StaffMember) => {
    setEditingStaff(member);
    const userRoles = member.roles || [member.role];
    setEditForm({
      name: member.name,
      email: member.email || "",
      phone: member.phone || "",
      username: member.username,
      password: "",
      roles: userRoles as Role[],
      addressLine1: member.addressLine1 || "",
      addressLine2: member.addressLine2 || "",
      city: member.city || "",
      county: member.county || "",
      homePostcode: member.homePostcode || "",
      managerId: member.managerId || null,
    });
    const skills = await fetchUserSkills(member.id);
    setEditSkills(skills);
    setShowEditPassword(false);
  };

  const handleUpdateManager = async (userId: string, managerId: string | null) => {
    try {
      const res = await fetch(`/api/users/${userId}/manager`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ managerId }),
      });
      if (!res.ok) throw new Error('Failed to update manager');
      const updated = await res.json();
      setStaff(staff.map(s => s.id === userId ? { ...s, managerId: updated.managerId } : s));
      toast({ title: "Manager Updated", description: "The user's manager has been updated." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update manager", variant: "destructive" });
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    if (editForm.roles.length === 0) {
      toast({
        title: "Missing Role",
        description: "Please select at least one role.",
        variant: "destructive",
      });
      return;
    }

    setIsEditing(true);
    try {
      const updateData: any = {
        name: editForm.name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        username: editForm.username,
        role: editForm.roles[0],
        roles: editForm.roles,
        addressLine1: editForm.addressLine1 || null,
        addressLine2: editForm.addressLine2 || null,
        city: editForm.city || null,
        county: editForm.county || null,
        homePostcode: editForm.homePostcode || null,
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

      setStaff(staff.map(s => s.id === editingStaff.id ? { ...data, skills: editSkills } : s));
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

  const getRoleIcon = (roles: Role[]) => {
    if (roles.includes('admin')) return <Shield className="h-5 w-5 text-blue-600" />;
    if (roles.includes('fleet_manager')) return <Truck className="h-5 w-5 text-purple-600" />;
    if (roles.includes('surveyor')) return <MapPin className="h-5 w-5 text-orange-600" />;
    return <Wrench className="h-5 w-5 text-green-600" />;
  };

  const getIconBgColor = (roles: Role[]) => {
    if (roles.includes('admin')) return 'bg-blue-100 dark:bg-blue-900/30';
    if (roles.includes('fleet_manager')) return 'bg-purple-100 dark:bg-purple-900/30';
    if (roles.includes('surveyor')) return 'bg-orange-100 dark:bg-orange-900/30';
    return 'bg-green-100 dark:bg-green-900/30';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading staff...</p>
      </div>
    );
  }

  const renderStaffCard = (member: StaffMember) => {
    const memberRoles = (member.roles || [member.role]) as Role[];
    return (
      <div
        key={member.id}
        className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
        data-testid={`staff-member-${member.id}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full ${getIconBgColor(memberRoles)} flex items-center justify-center`}>
              {getRoleIcon(memberRoles)}
            </div>
            <div>
              <p className="font-medium">{member.name}</p>
              <p className="text-sm text-muted-foreground">@{member.username}</p>
              <p className="text-xs text-muted-foreground">{member.email || member.phone || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleEditStaff(member)}
              data-testid={`button-edit-${member.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {member.id !== user.id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDeleteStaff(member.id, member.name)}
                data-testid={`button-delete-${member.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 ml-13">
          {memberRoles.map(role => (
            <Badge key={role} variant="secondary" className={`text-xs ${getRoleBadgeColor(role)}`}>
              {getRoleLabel(role)}
            </Badge>
          ))}
        </div>
        {member.skills && member.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 ml-13 mt-1">
            {member.skills.map(skill => (
              <Badge key={skill.id} variant="outline" className="text-xs bg-slate-100 dark:bg-slate-800">
                {skill.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  };

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
                <Label>Roles</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_ROLES.map(role => (
                    <div key={role.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`new-role-${role.value}`}
                        checked={newStaff.roles.includes(role.value)}
                        onCheckedChange={(checked) => handleRoleToggle(role.value, !!checked, false)}
                        data-testid={`checkbox-role-${role.value}`}
                      />
                      <Label htmlFor={`new-role-${role.value}`} className="text-sm cursor-pointer">
                        {role.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4 mt-4">
              <Label className="text-base font-medium mb-3 block">Address (Optional)</Label>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Address Line 1</Label>
                  <Input
                    placeholder="123 Main Street"
                    value={newStaff.addressLine1}
                    onChange={(e) => setNewStaff({ ...newStaff, addressLine1: e.target.value })}
                    data-testid="input-staff-address1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address Line 2</Label>
                  <Input
                    placeholder="Apartment 4B"
                    value={newStaff.addressLine2}
                    onChange={(e) => setNewStaff({ ...newStaff, addressLine2: e.target.value })}
                    data-testid="input-staff-address2"
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    placeholder="London"
                    value={newStaff.city}
                    onChange={(e) => setNewStaff({ ...newStaff, city: e.target.value })}
                    data-testid="input-staff-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label>County</Label>
                  <Input
                    placeholder="Greater London"
                    value={newStaff.county}
                    onChange={(e) => setNewStaff({ ...newStaff, county: e.target.value })}
                    data-testid="input-staff-county"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postcode</Label>
                  <Input
                    placeholder="SW1A 1AA"
                    value={newStaff.homePostcode}
                    onChange={(e) => setNewStaff({ ...newStaff, homePostcode: e.target.value })}
                    data-testid="input-staff-postcode"
                  />
                </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            All Staff ({staff.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <p className="text-muted-foreground text-sm">No staff members</p>
          ) : (
            <div className="space-y-3">
              {staff.map(member => renderStaffCard(member))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
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
                <Label>Roles</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_ROLES.map(role => (
                    <div key={role.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-role-${role.value}`}
                        checked={editForm.roles.includes(role.value)}
                        onCheckedChange={(checked) => handleRoleToggle(role.value, !!checked, true)}
                        data-testid={`checkbox-edit-role-${role.value}`}
                      />
                      <Label htmlFor={`edit-role-${role.value}`} className="text-sm cursor-pointer">
                        {role.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-medium mb-3 block">Address</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="edit-address1">Address Line 1</Label>
                    <Input
                      id="edit-address1"
                      value={editForm.addressLine1}
                      onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })}
                      placeholder="123 Main Street"
                      data-testid="input-edit-address1"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="edit-address2">Address Line 2</Label>
                    <Input
                      id="edit-address2"
                      value={editForm.addressLine2}
                      onChange={(e) => setEditForm({ ...editForm, addressLine2: e.target.value })}
                      placeholder="Apartment 4B"
                      data-testid="input-edit-address2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-city">City</Label>
                    <Input
                      id="edit-city"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      placeholder="London"
                      data-testid="input-edit-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-county">County</Label>
                    <Input
                      id="edit-county"
                      value={editForm.county}
                      onChange={(e) => setEditForm({ ...editForm, county: e.target.value })}
                      placeholder="Greater London"
                      data-testid="input-edit-county"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-postcode">Postcode</Label>
                    <Input
                      id="edit-postcode"
                      value={editForm.homePostcode}
                      onChange={(e) => setEditForm({ ...editForm, homePostcode: e.target.value })}
                      placeholder="SW1A 1AA"
                      data-testid="input-edit-postcode"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-medium mb-3 block">Works Manager</Label>
                <Select
                  value={editForm.managerId || "none"}
                  onValueChange={(value) => {
                    const newManagerId = value === "none" ? null : value;
                    setEditForm({ ...editForm, managerId: newManagerId });
                    if (editingStaff) {
                      handleUpdateManager(editingStaff.id, newManagerId);
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-manager">
                    <SelectValue placeholder="Select a manager..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {worksManagers
                      .filter(m => m.id !== editingStaff?.id)
                      .map(manager => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Assign a Works Manager who can oversee this user's jobs and approvals
                </p>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-medium mb-3 block">Skills</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {editSkills.map(skill => (
                    <Badge 
                      key={skill.id} 
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {skill.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill.id)}
                        className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                        data-testid={`button-remove-skill-${skill.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {editSkills.length === 0 && (
                    <span className="text-sm text-muted-foreground">No skills assigned</span>
                  )}
                </div>
                {availableSkills.length > 0 && (
                  <div className="space-y-2">
                    <Label>Add Skill</Label>
                    <Select
                      onValueChange={(value) => handleAddSkill(value)}
                    >
                      <SelectTrigger data-testid="select-add-skill">
                        <SelectValue placeholder="Select a skill to add..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSkills
                          .filter(skill => !editSkills.some(es => es.id === skill.id))
                          .map(skill => (
                            <SelectItem key={skill.id} value={skill.id}>
                              {skill.name} ({skill.category})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setEditingStaff(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isEditing} data-testid="button-update-staff">
                  {isEditing ? "Updating..." : "Update Staff"}
                </Button>
              </DialogFooter>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
