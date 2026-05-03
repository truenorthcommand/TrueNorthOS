import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Building2,
  User,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Home,
  Users,
  Settings,
  FileText,
  Edit2,
} from 'lucide-react';

interface Property {
  id: string;
  name: string;
  address: string;
  postcode: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

interface Contact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

interface ClientFormData {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  properties: Property[];
  contacts: Contact[];
  enablePortal: boolean;
  notes: string;
}

const STEPS = [
  { label: 'Basic Info', icon: Building2 },
  { label: 'Properties', icon: Home },
  { label: 'Contacts', icon: Users },
  { label: 'Settings', icon: Settings },
  { label: 'Review', icon: FileText },
];

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export default function AddClient() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    postcode: '',
    properties: [],
    contacts: [],
    enablePortal: false,
    notes: '',
  });

  // Property editing state
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [propertyForm, setPropertyForm] = useState<Property>({
    id: '',
    name: '',
    address: '',
    postcode: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });
  const [showPropertyForm, setShowPropertyForm] = useState(false);

  // Contact editing state
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState<Contact>({
    id: '',
    name: '',
    role: '',
    email: '',
    phone: '',
    isPrimary: false,
  });
  const [showContactForm, setShowContactForm] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Company/Client name is required';
    }
    if (!formData.postcode.trim()) {
      newErrors.postcode = 'Postcode is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 0 && !validateStep1()) {
      return;
    }
    setErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSkip = () => {
    setErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  // Property handlers
  const resetPropertyForm = () => {
    setPropertyForm({
      id: '',
      name: '',
      address: '',
      postcode: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
    });
    setEditingProperty(null);
    setShowPropertyForm(false);
  };

  const handleAddProperty = () => {
    if (!propertyForm.name.trim()) return;
    if (editingProperty) {
      setFormData((prev) => ({
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === editingProperty.id ? { ...propertyForm, id: editingProperty.id } : p
        ),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        properties: [...prev.properties, { ...propertyForm, id: generateId() }],
      }));
    }
    resetPropertyForm();
  };

  const handleEditProperty = (property: Property) => {
    setPropertyForm(property);
    setEditingProperty(property);
    setShowPropertyForm(true);
  };

  const handleDeleteProperty = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      properties: prev.properties.filter((p) => p.id !== id),
    }));
  };

  // Contact handlers
  const resetContactForm = () => {
    setContactForm({
      id: '',
      name: '',
      role: '',
      email: '',
      phone: '',
      isPrimary: false,
    });
    setEditingContact(null);
    setShowContactForm(false);
  };

  const handleAddContact = () => {
    if (!contactForm.name.trim()) return;
    if (editingContact) {
      setFormData((prev) => ({
        ...prev,
        contacts: prev.contacts.map((c) =>
          c.id === editingContact.id ? { ...contactForm, id: editingContact.id } : c
        ),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        contacts: [...prev.contacts, { ...contactForm, id: generateId() }],
      }));
    }
    resetContactForm();
  };

  const handleEditContact = (contact: Contact) => {
    setContactForm(contact);
    setEditingContact(contact);
    setShowContactForm(true);
  };

  const handleDeleteContact = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((c) => c.id !== id),
    }));
  };

  // Submit
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        postcode: formData.postcode,
        properties: formData.properties.map(({ id, ...rest }) => rest),
        contacts: formData.contacts.map(({ id, ...rest }) => rest),
        enablePortal: formData.enablePortal,
        notes: formData.notes,
      };

      const response = await apiRequest('POST', '/api/clients', payload);
      const newClient = await response.json();

      toast({
        title: 'Client created successfully',
        description: `${formData.name} has been added to your client list.`,
      });

      setLocation(`/clients/${newClient.id}`);
    } catch (error: any) {
      toast({
        title: 'Error creating client',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Progress indicator
  const ProgressIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, index) => {
        const StepIcon = step.icon;
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        return (
          <div key={index} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-[#0F2B4C] text-white shadow-lg scale-110'
                    : isCompleted
                    ? 'bg-[#E8A54B] text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <StepIcon className="w-5 h-5" />
                )}
              </div>
              <span
                className={`text-xs mt-1.5 font-medium hidden sm:block ${
                  isActive
                    ? 'text-[#0F2B4C]'
                    : isCompleted
                    ? 'text-[#E8A54B]'
                    : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`w-8 sm:w-16 h-0.5 mx-1 sm:mx-2 transition-colors duration-200 ${
                  index < currentStep ? 'bg-[#E8A54B]' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // Step 1: Basic Info
  const Step1BasicInfo = () => (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-[#0F2B4C]">
          <Building2 className="w-5 h-5" />
          Basic Information
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Enter the client's primary details. Fields marked with * are required.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="font-medium">
            Company / Client Name *
          </Label>
          <Input
            id="name"
            placeholder="e.g. Acme Property Management"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            className={errors.name ? 'border-red-500 focus:ring-red-500' : ''}
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactName" className="font-medium">
            Primary Contact Person
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="contactName"
              placeholder="e.g. John Smith"
              className="pl-10"
              value={formData.contactName}
              onChange={(e) => setFormData((prev) => ({ ...prev, contactName: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-medium">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                className="pl-10"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="font-medium">
              Phone
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                placeholder="07xxx xxxxxx"
                className="pl-10"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="font-medium">
            Address
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              id="address"
              placeholder="Street address"
              className="pl-10"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2 sm:w-1/3">
          <Label htmlFor="postcode" className="font-medium">
            Postcode *
          </Label>
          <Input
            id="postcode"
            placeholder="e.g. SW1A 1AA"
            value={formData.postcode}
            onChange={(e) => setFormData((prev) => ({ ...prev, postcode: e.target.value }))}
            className={errors.postcode ? 'border-red-500 focus:ring-red-500' : ''}
          />
          {errors.postcode && <p className="text-sm text-red-500">{errors.postcode}</p>}
        </div>
      </CardContent>
    </Card>
  );

  // Step 2: Properties
  const Step2Properties = () => (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-[#0F2B4C]">
          <Home className="w-5 h-5" />
          Properties
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Add properties or sites associated with this client. This step is optional.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Existing properties */}
        {formData.properties.length > 0 && (
          <div className="space-y-3">
            {formData.properties.map((property) => (
              <div
                key={property.id}
                className="border rounded-lg p-4 bg-gray-50 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Home className="w-4 h-4 text-[#0F2B4C]" />
                    <span className="font-medium text-[#0F2B4C] truncate">{property.name}</span>
                  </div>
                  {property.address && (
                    <p className="text-sm text-gray-600 ml-6">{property.address}</p>
                  )}
                  {property.postcode && (
                    <p className="text-sm text-gray-500 ml-6">{property.postcode}</p>
                  )}
                  {property.contactName && (
                    <p className="text-sm text-gray-500 ml-6 mt-1">
                      Site contact: {property.contactName}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-[#0F2B4C]"
                    onClick={() => handleEditProperty(property)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-500"
                    onClick={() => handleDeleteProperty(property.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Property form */}
        {showPropertyForm && (
          <div className="border rounded-lg p-4 space-y-4 bg-white">
            <div className="space-y-2">
              <Label className="font-medium">Property Name *</Label>
              <Input
                placeholder="e.g. Main Office, Unit 3B"
                value={propertyForm.name}
                onChange={(e) => setPropertyForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">Address</Label>
                <Input
                  placeholder="Property address"
                  value={propertyForm.address}
                  onChange={(e) => setPropertyForm((prev) => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Postcode</Label>
                <Input
                  placeholder="e.g. SW1A 1AA"
                  value={propertyForm.postcode}
                  onChange={(e) => setPropertyForm((prev) => ({ ...prev, postcode: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">Site Contact Name</Label>
                <Input
                  placeholder="Contact name"
                  value={propertyForm.contactName}
                  onChange={(e) => setPropertyForm((prev) => ({ ...prev, contactName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Site Contact Phone</Label>
                <Input
                  placeholder="Phone number"
                  value={propertyForm.contactPhone}
                  onChange={(e) => setPropertyForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Site Contact Email</Label>
                <Input
                  placeholder="Email address"
                  value={propertyForm.contactEmail}
                  onChange={(e) => setPropertyForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleAddProperty}
                disabled={!propertyForm.name.trim()}
                className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90"
              >
                <Check className="w-4 h-4 mr-1" />
                {editingProperty ? 'Update Property' : 'Add Property'}
              </Button>
              <Button variant="outline" onClick={resetPropertyForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!showPropertyForm && (
          <Button
            variant="outline"
            className="w-full border-dashed border-2 h-12 text-gray-500 hover:text-[#0F2B4C] hover:border-[#0F2B4C]"
            onClick={() => setShowPropertyForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add a Property
          </Button>
        )}
      </CardContent>
    </Card>
  );

  // Step 3: Additional Contacts
  const Step3Contacts = () => (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-[#0F2B4C]">
          <Users className="w-5 h-5" />
          Additional Contacts
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Add team members or site contacts for this client. This step is optional.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Existing contacts */}
        {formData.contacts.length > 0 && (
          <div className="space-y-3">
            {formData.contacts.map((contact) => (
              <div
                key={contact.id}
                className="border rounded-lg p-4 bg-gray-50 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-[#0F2B4C]" />
                    <span className="font-medium text-[#0F2B4C] truncate">{contact.name}</span>
                    {contact.isPrimary && (
                      <Badge className="bg-[#E8A54B] text-white text-xs">Primary</Badge>
                    )}
                  </div>
                  {contact.role && (
                    <p className="text-sm text-gray-600 ml-6">{contact.role}</p>
                  )}
                  <div className="flex flex-wrap gap-3 ml-6 mt-1">
                    {contact.email && (
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {contact.email}
                      </span>
                    )}
                    {contact.phone && (
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {contact.phone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-[#0F2B4C]"
                    onClick={() => handleEditContact(contact)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-500"
                    onClick={() => handleDeleteContact(contact.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contact form */}
        {showContactForm && (
          <div className="border rounded-lg p-4 space-y-4 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">Name *</Label>
                <Input
                  placeholder="Contact name"
                  value={contactForm.name}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Role</Label>
                <Input
                  placeholder="e.g. Site Manager, Accounts"
                  value={contactForm.role}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, role: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">Email</Label>
                <Input
                  placeholder="email@example.com"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Phone</Label>
                <Input
                  placeholder="Phone number"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={contactForm.isPrimary}
                onCheckedChange={(checked) =>
                  setContactForm((prev) => ({ ...prev, isPrimary: checked }))
                }
              />
              <Label className="font-medium cursor-pointer">Primary Contact</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleAddContact}
                disabled={!contactForm.name.trim()}
                className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90"
              >
                <Check className="w-4 h-4 mr-1" />
                {editingContact ? 'Update Contact' : 'Add Contact'}
              </Button>
              <Button variant="outline" onClick={resetContactForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!showContactForm && (
          <Button
            variant="outline"
            className="w-full border-dashed border-2 h-12 text-gray-500 hover:text-[#0F2B4C] hover:border-[#0F2B4C]"
            onClick={() => setShowContactForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add a Contact
          </Button>
        )}
      </CardContent>
    </Card>
  );

  // Step 4: Settings
  const Step4Settings = () => (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-[#0F2B4C]">
          <Settings className="w-5 h-5" />
          Client Settings
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Configure optional settings for this client. This step is optional.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label className="font-medium text-base">Client Portal Access</Label>
            <p className="text-sm text-gray-500 mt-0.5">
              Allow this client to view job progress and documents online
            </p>
          </div>
          <Switch
            checked={formData.enablePortal}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, enablePortal: checked }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="font-medium">
            Notes / Special Instructions
          </Label>
          <Textarea
            id="notes"
            placeholder="Any special requirements, access instructions, billing notes..."
            rows={5}
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>
      </CardContent>
    </Card>
  );

  // Step 5: Review
  const Step5Review = () => (
    <div className="space-y-4">
      {/* Basic Info Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[#0F2B4C] text-base">
            <Building2 className="w-4 h-4" />
            Client Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <dt className="text-xs text-gray-500 uppercase tracking-wide">Company Name</dt>
              <dd className="font-medium text-[#0F2B4C] mt-0.5">{formData.name}</dd>
            </div>
            {formData.contactName && (
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Primary Contact</dt>
                <dd className="mt-0.5">{formData.contactName}</dd>
              </div>
            )}
            {formData.email && (
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Email</dt>
                <dd className="mt-0.5">{formData.email}</dd>
              </div>
            )}
            {formData.phone && (
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Phone</dt>
                <dd className="mt-0.5">{formData.phone}</dd>
              </div>
            )}
            {formData.address && (
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Address</dt>
                <dd className="mt-0.5">{formData.address}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-gray-500 uppercase tracking-wide">Postcode</dt>
              <dd className="mt-0.5">{formData.postcode}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Properties Card */}
      {formData.properties.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[#0F2B4C] text-base">
              <Home className="w-4 h-4" />
              Properties ({formData.properties.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {formData.properties.map((property) => (
                <div key={property.id} className="flex items-center gap-3 p-2 rounded bg-gray-50">
                  <Home className="w-4 h-4 text-[#E8A54B] shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium text-sm">{property.name}</span>
                    {property.address && (
                      <span className="text-sm text-gray-500"> — {property.address}</span>
                    )}
                    {property.postcode && (
                      <span className="text-sm text-gray-400"> ({property.postcode})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts Card */}
      {formData.contacts.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[#0F2B4C] text-base">
              <Users className="w-4 h-4" />
              Additional Contacts ({formData.contacts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {formData.contacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 p-2 rounded bg-gray-50">
                  <User className="w-4 h-4 text-[#E8A54B] shrink-0" />
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-medium text-sm">{contact.name}</span>
                    {contact.role && (
                      <span className="text-sm text-gray-500">({contact.role})</span>
                    )}
                    {contact.isPrimary && (
                      <Badge className="bg-[#E8A54B] text-white text-xs">Primary</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[#0F2B4C] text-base">
            <Settings className="w-4 h-4" />
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Client Portal:</span>
              <Badge variant={formData.enablePortal ? 'default' : 'secondary'}>
                {formData.enablePortal ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            {formData.notes && (
              <div className="mt-3">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Notes</span>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{formData.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <Step1BasicInfo />;
      case 1:
        return <Step2Properties />;
      case 2:
        return <Step3Contacts />;
      case 3:
        return <Step4Settings />;
      case 4:
        return <Step5Review />;
      default:
        return null;
    }
  };

  const isOptionalStep = currentStep >= 1 && currentStep <= 3;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setLocation('/clients')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-[#0F2B4C]">Add New Client</h1>
              <p className="text-sm text-gray-500">
                Step {currentStep + 1} of {STEPS.length} — {STEPS[currentStep].label}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <ProgressIndicator />

        {/* Step Content */}
        <div className="mb-6">{renderStep()}</div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t bg-white -mx-4 px-4 pb-4 sticky bottom-0">
          <div>
            {currentStep > 0 && (
              <Button variant="outline" onClick={handleBack} className="gap-1">
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isOptionalStep && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-gray-500 hover:text-gray-700"
              >
                Skip this step
              </Button>
            )}

            {currentStep < STEPS.length - 1 ? (
              <Button
                onClick={handleNext}
                className="bg-[#0F2B4C] hover:bg-[#0F2B4C]/90 gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-[#E8A54B] hover:bg-[#E8A54B]/90 text-white gap-1 px-6"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create Client
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
