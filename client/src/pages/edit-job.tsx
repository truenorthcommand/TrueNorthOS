import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, Lock } from 'lucide-react';

const STATUS_OPTIONS = ['Ready', 'Pending', 'In Progress', 'Completed', 'Invoiced', 'Cancelled'];
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];
const VISIT_TYPE_OPTIONS = ['survey', 'job', 'snagging', 'inspection', 'follow_up', 'general'];
const SESSION_OPTIONS = ['AM', 'PM'];

export default function EditJob() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute('/jobs/:id/edit');
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [form, setForm] = useState({
    customerName: '',
    address: '',
    postcode: '',
    description: '',
    notes: '',
    status: '',
    priority: '',
    visitType: '',
    session: '',
    scheduledDate: '',
    agreedPrice: '',
    vatRate: '20',
    nickname: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/jobs/${params.id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setJob(data);
        setForm({
          customerName: data.customerName || '',
          address: data.address || data.siteAddress || '',
          postcode: data.postcode || '',
          description: data.description || '',
          notes: data.notes || '',
          status: data.status || '',
          priority: data.priority || 'normal',
          visitType: data.visitType || 'job',
          session: data.session || 'AM',
          scheduledDate: data.date ? new Date(data.date).toISOString().split('T')[0] : '',
          agreedPrice: data.agreedPrice ? String(data.agreedPrice) : '',
          vatRate: data.vatRate ? String(data.vatRate) : '20',
          nickname: data.nickname || '',
          contactName: data.contactName || '',
          contactPhone: data.contactPhone || '',
          contactEmail: data.contactEmail || '',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params?.id]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const calculatedTotal = () => {
    const price = parseFloat(form.agreedPrice) || 0;
    const vat = parseFloat(form.vatRate) || 0;
    return (price * (1 + vat / 100)).toFixed(2);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${params!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerName: form.customerName,
          address: form.address,
          postcode: form.postcode,
          description: form.description,
          notes: form.notes,
          status: form.status,
          priority: form.priority,
          visitType: form.visitType,
          session: form.session,
          nickname: form.nickname,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
          agreedPrice: form.agreedPrice ? parseFloat(form.agreedPrice) : null,
          vatRate: form.vatRate ? parseFloat(form.vatRate) : 20,
        }),
      });
      if (res.ok) {
        toast({ title: 'Job Updated', description: 'Changes saved successfully.' });
        navigate(`/jobs/${params!.id}`);
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Failed to update job', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save changes', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return <div className="p-6">Job not found</div>;
  }

  const priceLocked = job.priceLocked === true;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/jobs/${params!.id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Job #{job.jobNo}</h1>
            <p className="text-sm text-muted-foreground">{job.customerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/jobs/${params!.id}`)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Card 1 - Client & Property */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client & Property</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Customer Name</Label>
            <Input value={form.customerName} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground mt-1">Customer cannot be changed after creation</p>
          </div>
          <div>
            <Label>Site Address</Label>
            <Input
              value={form.address}
              onChange={e => handleChange('address', e.target.value)}
              placeholder="Enter site address"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Postcode</Label>
              <Input
                value={form.postcode}
                onChange={e => handleChange('postcode', e.target.value)}
                placeholder="e.g. SW1A 1AA"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2 - Job Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nickname</Label>
            <Input
              value={form.nickname}
              onChange={e => handleChange('nickname', e.target.value)}
              placeholder="Short name for this job"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              placeholder="Job description"
              rows={4}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              placeholder="Additional notes"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Visit Type</Label>
              <Select value={form.visitType} onValueChange={v => handleChange('visitType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_TYPE_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>
                      {t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => handleChange('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => handleChange('priority', v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(p => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Card 3 - Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Scheduled Date</Label>
              <Input
                type="date"
                value={form.scheduledDate}
                onChange={e => handleChange('scheduledDate', e.target.value)}
              />
            </div>
            <div>
              <Label>Session</Label>
              <Select value={form.session} onValueChange={v => handleChange('session', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4 - Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Pricing
            {priceLocked && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                <Lock className="h-3 w-3 mr-1" /> Locked
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Agreed Price (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.agreedPrice}
                onChange={e => handleChange('agreedPrice', e.target.value)}
                placeholder="0.00"
                disabled={priceLocked}
              />
            </div>
            <div>
              <Label>VAT Rate (%)</Label>
              <Input
                type="number"
                value={form.vatRate}
                onChange={e => handleChange('vatRate', e.target.value)}
                placeholder="20"
                disabled={priceLocked}
              />
            </div>
            <div>
              <Label>Total (inc. VAT)</Label>
              <Input
                value={form.agreedPrice ? `£${calculatedTotal()}` : '—'}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 5 - Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Contact Name</Label>
            <Input
              value={form.contactName}
              onChange={e => handleChange('contactName', e.target.value)}
              placeholder="Contact person"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input
                value={form.contactPhone}
                onChange={e => handleChange('contactPhone', e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={e => handleChange('contactEmail', e.target.value)}
                placeholder="Email address"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => navigate(`/jobs/${params!.id}`)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
