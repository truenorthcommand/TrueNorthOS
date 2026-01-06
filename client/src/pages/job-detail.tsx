import { useEffect, useRef, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Save, Printer, Trash2, Plus, 
  MapPin, Phone, Mail, Calendar, Upload, X, FileCheck,
  AlertCircle, AlertTriangle, AlertOctagon, Users
} from "lucide-react";
import { ActionPriority } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function JobDetail() {
  const { user } = useAuth();
  const [match, params] = useRoute("/jobs/:id");
  const [, setLocation] = useLocation();
  const { getJob, updateJob, addMaterial, removeMaterial, addPhoto, removePhoto, deleteJob, jobs, refreshJobs } = useStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const [actionDescription, setActionDescription] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<ActionPriority>("medium");
  const [engineers, setEngineers] = useState<{id: string; name: string}[]>([]);
  
  const [formData, setFormData] = useState<{
    client: string;
    customerName: string;
    address: string;
    postcode: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    date: string;
    session: string;
    description: string;
    worksCompleted: string;
    notes: string;
  }>({
    client: "",
    customerName: "",
    address: "",
    postcode: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    date: "",
    session: "AM",
    description: "",
    worksCompleted: "",
    notes: "",
  });
  const [formInitialized, setFormInitialized] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetch('/api/users', { credentials: 'include' })
        .then(res => res.json())
        .then(data => setEngineers(data.map((u: any) => ({ id: u.id, name: u.name }))))
        .catch(() => {});
    }
  }, [user]);

  const jobId = params?.id;
  const job = jobId ? getJob(jobId) : undefined;
  
  useEffect(() => {
    if (jobId) {
      refreshJobs();
    }
  }, [jobId]);
  
  useEffect(() => {
    if (job) {
      setFormData({
        client: job.client || "",
        customerName: job.customerName || "",
        address: job.address || "",
        postcode: job.postcode || "",
        contactName: job.contactName || "",
        contactPhone: job.contactPhone || "",
        contactEmail: job.contactEmail || "",
        date: job.date ? format(new Date(job.date), "yyyy-MM-dd") : "",
        session: job.session || "AM",
        description: job.description || "",
        worksCompleted: job.worksCompleted || "",
        notes: job.notes || "",
      });
      setFormInitialized(true);
    }
  }, [job?.id]);

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldBlur = async (field: keyof typeof formData) => {
    if (!job) return;
    let valueToSave: string | Date = formData[field];
    if (field === 'date' && formData.date) {
      valueToSave = new Date(formData.date).toISOString();
    }
    await updateJob(job.id, { [field]: valueToSave });
  };

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold mb-4">Job Not Found</h2>
        <Link href="/">
          <Button>Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleUpdateJob = async () => {
    if (!job) return;
    await updateJob(job.id, {
      client: formData.client,
      customerName: formData.customerName,
      address: formData.address,
      postcode: formData.postcode,
      contactName: formData.contactName,
      contactPhone: formData.contactPhone,
      contactEmail: formData.contactEmail,
      date: formData.date ? new Date(formData.date).toISOString() : undefined,
      session: formData.session,
      description: formData.description,
      worksCompleted: formData.worksCompleted,
      notes: formData.notes,
    });
    toast({ title: "Job Updated", description: "All changes have been saved." });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, source: 'admin' | 'engineer' = 'engineer') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        addPhoto(job.id, reader.result as string, source);
        toast({ 
          title: "Photo Uploaded", 
          description: source === 'admin' ? "Reference photo added." : "Evidence photo added." 
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const isReadOnly = job.status === "Signed Off";

  const handleAddAction = () => {
    if (!actionDescription.trim()) {
      toast({
        title: "Empty Description",
        description: "Please enter a description for the action.",
        variant: "destructive"
      });
      return;
    }

    const newAction = {
      id: `action-${Date.now()}`,
      description: actionDescription,
      priority: selectedPriority,
      timestamp: new Date().toISOString()
    };

    updateJob(job.id, {
      furtherActions: [...(job.furtherActions || []), newAction]
    });

    toast({
      title: "Action Added",
      description: `New ${selectedPriority} priority action recorded.`
    });

    setActionDescription("");
    setSelectedPriority("medium");
  };

  const handleRemoveAction = (actionId: string) => {
    updateJob(job.id, {
      furtherActions: (job.furtherActions || []).filter(a => a.id !== actionId)
    });
    toast({
      title: "Action Removed",
      variant: "default"
    });
  };

  const getPriorityColor = (priority: ActionPriority) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300";
      case "high":
        return "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300";
      case "medium":
        return "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300";
      case "low":
        return "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300";
      default:
        return "bg-slate-100 dark:bg-slate-800";
    }
  };

  const getPriorityIcon = (priority: ActionPriority) => {
    switch (priority) {
      case "urgent":
        return <AlertOctagon className="w-4 h-4" />;
      case "high":
        return <AlertTriangle className="w-4 h-4" />;
      case "medium":
      case "low":
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{job.jobNo}</h1>
              <Badge variant={job.status === "Signed Off" ? "default" : "secondary"}>
                {job.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{job.customerName}</p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          {!isReadOnly && (
            <Button variant="outline" onClick={handleUpdateJob} className="flex-1 sm:flex-none" data-testid="button-update-job">
              <Save className="mr-2 h-4 w-4" />
              Update
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none">
            <Printer className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>
          
          {job.status !== "Signed Off" && (
            <Link href={`/jobs/${job.id}/sign-off`}>
              <Button className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700">
                <FileCheck className="mr-2 h-4 w-4" />
                Sign Off
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 print:block">
        {/* Customer & Site Info */}
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="bg-slate-50 dark:bg-slate-900/50 print:bg-transparent print:p-0 print:mb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Site & Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6 pt-6 print:pt-0">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client/Service Provider</Label>
                <Input 
                  value={formData.client} 
                  onChange={(e) => handleFieldChange('client', e.target.value)}
                  onBlur={() => handleFieldBlur('client')}
                  disabled={isReadOnly}
                  className="print:border-none print:p-0 print:font-semibold"
                  placeholder="Your company name"
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input 
                  value={formData.customerName} 
                  onChange={(e) => handleFieldChange('customerName', e.target.value)}
                  onBlur={() => handleFieldBlur('customerName')}
                  disabled={isReadOnly}
                  className="print:border-none print:p-0 print:font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea 
                  value={formData.address} 
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  onBlur={() => handleFieldBlur('address')}
                  disabled={isReadOnly}
                  className="min-h-[80px] print:border-none print:p-0"
                />
              </div>
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input 
                  value={formData.postcode} 
                  onChange={(e) => handleFieldChange('postcode', e.target.value)}
                  onBlur={() => handleFieldBlur('postcode')}
                  disabled={isReadOnly}
                  className="print:border-none print:p-0"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Site Contact</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground print:hidden" />
                  <Input 
                    value={formData.contactName} 
                    onChange={(e) => handleFieldChange('contactName', e.target.value)}
                    onBlur={() => handleFieldBlur('contactName')}
                    disabled={isReadOnly}
                    className="pl-9 print:pl-0 print:border-none"
                    placeholder="Contact Name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground print:hidden" />
                  <Input 
                    value={formData.contactPhone} 
                    onChange={(e) => handleFieldChange('contactPhone', e.target.value)}
                    onBlur={() => handleFieldBlur('contactPhone')}
                    disabled={isReadOnly}
                    className="pl-9 print:pl-0 print:border-none"
                    placeholder="Phone Number"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground print:hidden" />
                  <Input 
                    value={formData.contactEmail} 
                    onChange={(e) => handleFieldChange('contactEmail', e.target.value)}
                    onBlur={() => handleFieldBlur('contactEmail')}
                    disabled={isReadOnly}
                    className="pl-9 print:pl-0 print:border-none"
                    placeholder="Email Address"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="space-y-2 flex-1">
                  <Label>Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground print:hidden" />
                    <Input 
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleFieldChange('date', e.target.value)}
                      onBlur={() => handleFieldBlur('date')}
                      disabled={isReadOnly}
                      className="pl-9 print:pl-0 print:border-none"
                    />
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Session</Label>
                  <Select 
                    value={formData.session} 
                    onValueChange={(value) => {
                      handleFieldChange('session', value);
                      if (job) updateJob(job.id, { session: value });
                    }}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="print:border-none print:p-0">
                      <SelectValue placeholder="Select session..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {user?.role === "admin" && (
                  <div className="space-y-2 flex-1">
                    <Label>Job Order</Label>
                    <Input 
                      type="number"
                      min="1"
                      max="999"
                      placeholder="Auto"
                      value={job.orderNumber ?? ""}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : null;
                        updateJob(job.id, { orderNumber: value });
                      }}
                      disabled={isReadOnly}
                      className="print:border-none print:p-0"
                      data-testid="input-order-number"
                    />
                    <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
                  </div>
                )}
              </div>
            </div>

            {/* Engineer Assignment (Admin Only) */}
            {user?.role === "admin" && (
              <div className="space-y-2 border-t pt-6 mt-6">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assign to Engineer
                </Label>
                <Select 
                  value={job.assignedToId || ""} 
                  onValueChange={(value) => updateJob(job.id, { assignedToId: value })}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an engineer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {engineers.map((engineer) => (
                      <SelectItem key={engineer.id} value={engineer.id}>
                        {engineer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {job.assignedToId && (
                  <p className="text-xs text-muted-foreground">
                    Currently assigned to {engineers.find(e => e.id === job.assignedToId)?.name || "Unknown"}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Details */}
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="bg-slate-50 dark:bg-slate-900/50 print:bg-transparent print:p-0 print:mb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Work Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 print:pt-0">
            <div className="space-y-2">
              <Label>Description of Works</Label>
              <Textarea 
                value={formData.description} 
                onChange={(e) => handleFieldChange('description', e.target.value)}
                onBlur={() => handleFieldBlur('description')}
                disabled={isReadOnly}
                className="min-h-[120px] text-base print:border-none print:p-0"
                placeholder="Describe the work to be carried out..."
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Works Completed
                <Badge variant="outline" className="text-xs font-normal">Engineer</Badge>
              </Label>
              <Textarea 
                value={formData.worksCompleted} 
                onChange={(e) => handleFieldChange('worksCompleted', e.target.value)}
                onBlur={() => handleFieldBlur('worksCompleted')}
                disabled={isReadOnly}
                className="min-h-[120px] text-base print:border-none print:p-0 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                placeholder="Describe the work that has been completed..."
                data-testid="input-works-completed"
              />
              <p className="text-xs text-muted-foreground">Enter details of all work completed on this job</p>
            </div>
            
            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea 
                value={formData.notes} 
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                onBlur={() => handleFieldBlur('notes')}
                disabled={isReadOnly}
                className="min-h-[80px] print:hidden"
                placeholder="Access codes, parking info, etc."
              />
              <div className="hidden print:block text-sm italic text-muted-foreground">
                {job.notes}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Materials */}
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="bg-slate-50 dark:bg-slate-900/50 print:bg-transparent print:p-0 print:mb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Materials & Parts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 print:pt-0">
            <div className="space-y-4">
              {(job.materials || []).length > 0 && (
                <div className="border rounded-md overflow-hidden print:border-none">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-muted-foreground print:bg-transparent print:border-b">
                      <tr>
                        <th className="p-3 font-medium">Item Name</th>
                        <th className="p-3 font-medium w-32">Quantity</th>
                        {!isReadOnly && <th className="p-3 w-16 text-center no-print">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y print:divide-y-0">
                      {(job.materials || []).map((item) => (
                        <tr key={item.id}>
                          <td className="p-3">{item.name}</td>
                          <td className="p-3">{item.quantity}</td>
                          {!isReadOnly && (
                            <td className="p-3 text-center no-print">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeMaterial(job.id, item.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!isReadOnly && (
                <div className="flex gap-2 items-end no-print">
                   <form 
                    className="flex gap-2 w-full"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const nameInput = form.elements.namedItem('matName') as HTMLInputElement;
                      const qtyInput = form.elements.namedItem('matQty') as HTMLInputElement;
                      if (nameInput.value && qtyInput.value) {
                        addMaterial(job.id, { name: nameInput.value, quantity: qtyInput.value });
                        form.reset();
                        nameInput.focus();
                      }
                    }}
                   >
                    <div className="grid gap-2 flex-1">
                      <Label className="sr-only">Item Name</Label>
                      <Input name="matName" placeholder="Item Name (e.g., Copper Pipe 15mm)" />
                    </div>
                    <div className="grid gap-2 w-24">
                       <Label className="sr-only">Quantity</Label>
                       <Input name="matQty" placeholder="Qty" />
                    </div>
                    <Button type="submit" variant="secondary">
                      <Plus className="h-4 w-4" />
                    </Button>
                   </form>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Admin Reference Photos */}
        <Card className="print:shadow-none print:border-none border-2 border-blue-200 dark:border-blue-900">
          <CardHeader className="bg-blue-50 dark:bg-blue-900/20 print:bg-transparent print:p-0 print:mb-4">
             <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Reference Photos (Admin)</CardTitle>
              {user?.role === 'admin' && !isReadOnly && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="no-print"
                  onClick={() => adminFileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Add Reference Photo
                </Button>
              )}
              <input 
                type="file" 
                ref={adminFileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleFileUpload(e, 'admin')}
              />
            </div>
            <p className="text-sm text-muted-foreground">Reference images, instructions, or site photos provided by admin</p>
          </CardHeader>
          <CardContent className="pt-6 print:pt-0">
             {(job.photos || []).filter(p => p.source === 'admin').length === 0 ? (
               <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground bg-blue-50/50">
                 <p>No reference photos added.</p>
               </div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {(job.photos || []).filter(p => p.source === 'admin').map((photo) => (
                   <div key={photo.id} className="relative group aspect-square bg-slate-100 rounded-md overflow-hidden border">
                     <img src={photo.url} alt="Reference photo" className="w-full h-full object-cover" />
                     {user?.role === 'admin' && !isReadOnly && (
                       <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity no-print"
                        onClick={() => removePhoto(job.id, photo.id)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     )}
                     <div className="absolute bottom-0 left-0 right-0 bg-blue-600/70 text-white text-[10px] p-1 px-2 truncate">
                       {format(new Date(photo.timestamp), "dd/MM/yy HH:mm")}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </CardContent>
        </Card>

        {/* Engineer Evidence Photos */}
        <Card className="print:shadow-none print:border-none border-2 border-emerald-200 dark:border-emerald-900">
          <CardHeader className="bg-emerald-50 dark:bg-emerald-900/20 print:bg-transparent print:p-0 print:mb-4">
             <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Evidence Photos (Engineer)</CardTitle>
              {!isReadOnly && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="no-print"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Add Evidence Photo
                </Button>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleFileUpload(e, 'engineer')}
              />
            </div>
            <p className="text-sm text-muted-foreground">Photos taken by engineers as proof of work completed</p>
          </CardHeader>
          <CardContent className="pt-6 print:pt-0">
             {(job.photos || []).filter(p => !p.source || p.source === 'engineer').length === 0 ? (
               <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground bg-emerald-50/50">
                 <p>No evidence photos uploaded yet.</p>
               </div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {(job.photos || []).filter(p => !p.source || p.source === 'engineer').map((photo) => (
                   <div key={photo.id} className="relative group aspect-square bg-slate-100 rounded-md overflow-hidden border">
                     <img src={photo.url} alt="Evidence photo" className="w-full h-full object-cover" />
                     {!isReadOnly && (
                       <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity no-print"
                        onClick={() => removePhoto(job.id, photo.id)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     )}
                     <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/70 text-white text-[10px] p-1 px-2 truncate">
                       {format(new Date(photo.timestamp), "dd/MM/yy HH:mm")}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </CardContent>
        </Card>

        {/* Signatures Preview (if signed off) */}
        {(job.signatures || []).length > 0 && (
          <Card className="print:shadow-none print:border-none break-inside-avoid">
            <CardHeader className="bg-slate-50 dark:bg-slate-900/50 print:bg-transparent print:p-0 print:mb-4">
              <CardTitle className="text-lg">Signatures</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 print:pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {(job.signatures || []).map((sig) => (
                  <div key={sig.id} className="border rounded-md p-4 bg-slate-50/50 print:border-black print:bg-transparent">
                    <p className="text-sm font-medium mb-2 capitalize text-muted-foreground">{sig.type} Signature</p>
                    <div className="bg-white border-b-2 border-dashed border-slate-300 h-24 mb-2 flex items-center justify-center print:bg-transparent print:border-black">
                      <img src={sig.url} alt="Signature" className="max-h-full max-w-full" />
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="font-semibold">{sig.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sig.timestamp), "dd MMM yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sign-off Location (if signed off) */}
        {job.status === "Signed Off" && (job.signOffLat || job.signOffAddress) && (
          <Card className="print:shadow-none print:border-none break-inside-avoid border-2 border-emerald-200 dark:border-emerald-900">
            <CardHeader className="bg-emerald-50 dark:bg-emerald-900/20 print:bg-transparent print:p-0 print:mb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-600" />
                Sign-off Location
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 print:pt-0">
              <div className="space-y-2">
                {job.signOffAddress && (
                  <p className="text-sm">{job.signOffAddress}</p>
                )}
                {job.signOffLat && job.signOffLng && (
                  <p className="text-xs text-muted-foreground">
                    Coordinates: {job.signOffLat.toFixed(6)}, {job.signOffLng.toFixed(6)}
                  </p>
                )}
                {job.signOffTimestamp && (
                  <p className="text-xs text-muted-foreground">
                    Signed off: {format(new Date(job.signOffTimestamp), "dd MMM yyyy HH:mm")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Further Actions / Revisit Section */}
        <Card className="print:shadow-none print:border-none border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10">
          <CardHeader className="bg-blue-100 dark:bg-blue-900/40 print:bg-transparent print:p-0 print:mb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Further Actions / Revisit
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Alert admins of follow-up work or issues requiring attention</p>
          </CardHeader>
          <CardContent className="pt-6 print:pt-0">
            {!isReadOnly && (
              <div className="space-y-4 mb-6 p-4 bg-white dark:bg-slate-900/50 rounded-lg border">
                <div className="space-y-2">
                  <Label>Action Description</Label>
                  <Textarea
                    placeholder="Describe any further actions needed, issues found, or follow-up work required..."
                    value={actionDescription}
                    onChange={(e) => setActionDescription(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Priority Level</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(['low', 'medium', 'high', 'urgent'] as ActionPriority[]).map((priority) => (
                      <button
                        key={priority}
                        onClick={() => setSelectedPriority(priority)}
                        className={`px-3 py-2 rounded text-sm font-medium capitalize border-2 transition-all ${
                          selectedPriority === priority
                            ? getPriorityColor(priority) + ' border-current'
                            : 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-current'
                        }`}
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleAddAction} className="w-full bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Action Alert
                </Button>
              </div>
            )}

            {job.furtherActions && job.furtherActions.length > 0 ? (
              <div className="space-y-3">
                {job.furtherActions.map((action) => (
                  <div
                    key={action.id}
                    className={`p-4 rounded-lg border-l-4 ${getPriorityColor(action.priority)}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        {getPriorityIcon(action.priority)}
                        <div className="flex-1">
                          <p className="font-medium capitalize text-sm">{action.priority} Priority</p>
                          <p className="text-sm mt-1">{action.description}</p>
                        </div>
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleRemoveAction(action.id)}
                          className="text-current hover:opacity-70 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs opacity-75">
                      {format(new Date(action.timestamp), "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-white dark:bg-slate-900/30 rounded-lg border border-dashed">
                <p>No further actions recorded.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

       {!isReadOnly && (
         <div className="mt-8 flex justify-center no-print">
            <Button 
              variant="ghost" 
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                if(confirm("Are you sure you want to delete this job?")) {
                  deleteJob(job.id);
                  setLocation("/");
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Job
            </Button>
         </div>
       )}

      {/* User Icon for imports */}
      <div className="hidden">
        <UserIcon />
      </div>
    </div>
  );
}

// Helper to fix missing import
function UserIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
