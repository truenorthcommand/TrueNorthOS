import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Clock, Plus, ChevronLeft, ChevronRight, Check, Edit2, Calendar, Loader2, X, Briefcase, Car, BookOpen, Building
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, isToday } from 'date-fns';

interface TimesheetEntry {
  id: string;
  type: 'job' | 'travel' | 'training' | 'office' | 'other';
  jobId?: number;
  jobName?: string;
  clientName?: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hours: number;
  description?: string;
  source: 'auto' | 'manual';
}

interface EditingEntry {
  id: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  notes: string;
}

function calculateHours(start: string, end: string, breakMins: number): number {
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM) - breakMins;
  return Math.max(0, totalMinutes / 60);
}

function getEntryIcon(type: string) {
  switch (type) {
    case 'job': return <Briefcase className="w-4 h-4" />;
    case 'travel': return <Car className="w-4 h-4" />;
    case 'training': return <BookOpen className="w-4 h-4" />;
    case 'office': return <Building className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
}

function getEntryBorderColor(type: string): string {
  switch (type) {
    case 'job': return 'border-l-blue-500';
    case 'travel': return 'border-l-purple-500';
    case 'training': return 'border-l-amber-500';
    case 'office': return 'border-l-green-500';
    default: return 'border-l-gray-400';
  }
}

function formatHoursMinutes(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function QuickTimesheet() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedDays, setSubmittedDays] = useState<string[]>([]);

  // Manual entry form state
  const [newEntryType, setNewEntryType] = useState<string>('travel');
  const [newEntryStart, setNewEntryStart] = useState('09:00');
  const [newEntryEnd, setNewEntryEnd] = useState('10:00');
  const [newEntryDescription, setNewEntryDescription] = useState('');

  // Manual entries stored locally
  const [manualEntries, setManualEntries] = useState<TimesheetEntry[]>([]);

  const { data: jobs } = useQuery({
    queryKey: ['/api/jobs'],
  });

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const getJobsForDate = (date: Date): TimesheetEntry[] => {
    return ((jobs as any[]) || []).filter((j: any) => {
      const jobDate = new Date(j.scheduledDate).toDateString();
      return jobDate === date.toDateString() && (j.startedAt || j.completedAt);
    }).map((j: any) => {
      const startTime = j.startedAt ? format(new Date(j.startedAt), 'HH:mm') : '09:00';
      const endTime = j.completedAt ? format(new Date(j.completedAt), 'HH:mm') : '17:00';
      const hours = calculateHours(startTime, endTime, 0);
      return {
        id: `job-${j.id}`,
        type: 'job' as const,
        jobId: j.id,
        jobName: j.title || `Job #${j.id}`,
        clientName: j.clientName || j.client?.name || 'Unknown Client',
        startTime,
        endTime,
        breakMinutes: 0,
        hours,
        source: 'auto' as const,
      };
    });
  };

  const getManualEntriesForDate = (date: Date): TimesheetEntry[] => {
    return manualEntries.filter((e) => {
      const entryDate = e.description?.includes(date.toDateString());
      return entryDate || isSameDay(date, selectedDate);
    });
  };

  const jobEntries = useMemo(() => getJobsForDate(selectedDate), [jobs, selectedDate]);
  const dayManualEntries = useMemo(() => {
    return manualEntries.filter((e) => e.id.includes(selectedDate.toDateString()));
  }, [manualEntries, selectedDate]);

  const allDayEntries = useMemo(() => [...jobEntries, ...dayManualEntries], [jobEntries, dayManualEntries]);

  const totalHours = useMemo(() => {
    return allDayEntries.reduce((sum, e) => sum + e.hours, 0);
  }, [allDayEntries]);

  const weeklyHours = useMemo(() => {
    return weekDays.map((day) => {
      const dayJobs = getJobsForDate(day);
      const dayManual = manualEntries.filter((e) => e.id.includes(day.toDateString()));
      return [...dayJobs, ...dayManual].reduce((sum, e) => sum + e.hours, 0);
    });
  }, [weekDays, jobs, manualEntries]);

  const totalWeekHours = useMemo(() => weeklyHours.reduce((sum, h) => sum + h, 0), [weeklyHours]);

  const weeklyBreakdown = useMemo(() => {
    let jobTime = 0, travelTime = 0, otherTime = 0;
    weekDays.forEach((day) => {
      const dayJobs = getJobsForDate(day);
      const dayManual = manualEntries.filter((e) => e.id.includes(day.toDateString()));
      dayJobs.forEach((e) => { jobTime += e.hours; });
      dayManual.forEach((e) => {
        if (e.type === 'travel') travelTime += e.hours;
        else otherTime += e.hours;
      });
    });
    return { jobTime, travelTime, otherTime };
  }, [weekDays, jobs, manualEntries]);

  const isDaySubmitted = (date: Date) => submittedDays.includes(date.toDateString());

  const handlePreviousWeek = () => setWeekStart(subWeeks(weekStart, 1));
  const handleNextWeek = () => setWeekStart(addWeeks(weekStart, 1));

  const handleAddManualEntry = () => {
    const hours = calculateHours(newEntryStart, newEntryEnd, 0);
    const entry: TimesheetEntry = {
      id: `manual-${selectedDate.toDateString()}-${Date.now()}`,
      type: newEntryType as any,
      startTime: newEntryStart,
      endTime: newEntryEnd,
      breakMinutes: 0,
      hours,
      description: newEntryDescription || `${newEntryType} - ${selectedDate.toDateString()}`,
      source: 'manual',
    };
    setManualEntries((prev) => [...prev, entry]);
    setShowAddEntry(false);
    setNewEntryDescription('');
    setNewEntryStart('09:00');
    setNewEntryEnd('10:00');
    toast({ title: 'Entry Added', description: `${formatHoursMinutes(hours)} ${newEntryType} added` });
  };

  const handleEditSave = () => {
    if (!editingEntry) return;
    const hours = calculateHours(editingEntry.startTime, editingEntry.endTime, editingEntry.breakMinutes);
    setManualEntries((prev) =>
      prev.map((e) =>
        e.id === editingEntry.id
          ? { ...e, startTime: editingEntry.startTime, endTime: editingEntry.endTime, breakMinutes: editingEntry.breakMinutes, hours }
          : e
      )
    );
    setEditingEntry(null);
    toast({ title: 'Entry Updated' });
  };

  const handleSubmitDay = async () => {
    setSubmitting(true);
    try {
      const entries = [
        ...jobEntries.map((e) => ({
          type: 'job',
          jobId: e.jobId,
          startTime: e.startTime,
          endTime: e.endTime,
          breakMinutes: e.breakMinutes,
          hours: e.hours,
        })),
        ...dayManualEntries.map((e) => ({
          type: e.type,
          startTime: e.startTime,
          endTime: e.endTime,
          description: e.description,
          hours: e.hours,
        })),
      ];

      await fetch('/api/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: selectedDate.toISOString(),
          entries,
          totalHours,
        }),
      });

      setSubmittedDays((prev) => [...prev, selectedDate.toDateString()]);
      toast({ title: 'Timesheet Submitted', description: `${totalHours.toFixed(1)} hours logged for ${format(selectedDate, 'EEEE d MMMM')}` });
    } catch (error: any) {
      toast({ title: 'Submit failed', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitWeek = async () => {
    setSubmitting(true);
    try {
      for (const day of weekDays) {
        if (isDaySubmitted(day)) continue;
        const dayJobs = getJobsForDate(day);
        const dayManual = manualEntries.filter((e) => e.id.includes(day.toDateString()));
        const allEntries = [...dayJobs, ...dayManual];
        if (allEntries.length === 0) continue;

        const dayTotal = allEntries.reduce((sum, e) => sum + e.hours, 0);
        await fetch('/api/timesheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            date: day.toISOString(),
            entries: allEntries.map((e) => ({
              type: e.type,
              jobId: e.jobId,
              startTime: e.startTime,
              endTime: e.endTime,
              breakMinutes: e.breakMinutes,
              description: e.description,
              hours: e.hours,
            })),
            totalHours: dayTotal,
          }),
        });
        setSubmittedDays((prev) => [...prev, day.toDateString()]);
      }
      toast({ title: 'Week Submitted', description: `${totalWeekHours.toFixed(1)} hours submitted for the week` });
    } catch (error: any) {
      toast({ title: 'Submit failed', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-[#0F2B4C] text-white px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold mb-3">My Timesheet</h1>

        {/* Week Selector */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handlePreviousWeek}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-sm font-medium px-2">
            Week of {format(weekStart, 'd MMM')} - {format(weekEnd, 'd MMM')}
          </span>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleNextWeek}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Day Selector Row */}
        <div className="flex justify-between mt-3 gap-1">
          {weekDays.map((day) => (
            <button
              key={day.toISOString()}
              onClick={() => { setSelectedDate(day); setViewMode('daily'); }}
              className={`flex flex-col items-center rounded-lg px-2 py-1.5 transition-all min-w-[40px] ${
                isSameDay(day, selectedDate)
                  ? 'bg-[#E8A54B] text-[#0F2B4C] font-bold'
                  : isToday(day)
                  ? 'border border-[#E8A54B] text-white'
                  : 'text-white/70 hover:bg-white/10'
              }`}
            >
              <span className="text-[10px] uppercase">{format(day, 'EEE')}</span>
              <span className="text-sm font-semibold">{format(day, 'd')}</span>
              {isDaySubmitted(day) && <Check className="w-3 h-3 text-green-400 mt-0.5" />}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex justify-center mt-3 gap-2">
          <Button
            size="sm"
            variant={viewMode === 'daily' ? 'secondary' : 'ghost'}
            className={viewMode === 'daily' ? 'bg-white text-[#0F2B4C]' : 'text-white/70 hover:text-white'}
            onClick={() => setViewMode('daily')}
          >
            Daily
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'weekly' ? 'secondary' : 'ghost'}
            className={viewMode === 'weekly' ? 'bg-white text-[#0F2B4C]' : 'text-white/70 hover:text-white'}
            onClick={() => setViewMode('weekly')}
          >
            Weekly
          </Button>
        </div>
      </div>

      {/* Daily View */}
      {viewMode === 'daily' && (
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0F2B4C]">
              {format(selectedDate, 'EEEE, d MMMM')}
            </h2>
            {isDaySubmitted(selectedDate) && (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <Check className="w-3 h-3 mr-1" /> Submitted
              </Badge>
            )}
          </div>

          {/* Entry Cards */}
          {allDayEntries.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-gray-500">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No time entries for this day</p>
                <p className="text-xs mt-1">Job timer entries appear automatically, or add manual entries below</p>
              </CardContent>
            </Card>
          )}

          {allDayEntries.map((entry) => (
            <Card key={entry.id} className={`border-l-4 ${getEntryBorderColor(entry.type)}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {getEntryIcon(entry.type)}
                      <span className="font-medium text-sm text-[#0F2B4C]">
                        {entry.jobName || entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {entry.source === 'auto' ? 'Auto' : 'Manual'}
                      </Badge>
                    </div>
                    {entry.clientName && (
                      <p className="text-xs text-gray-500 mt-0.5 ml-6">{entry.clientName}</p>
                    )}
                    {entry.description && entry.type !== 'job' && (
                      <p className="text-xs text-gray-500 mt-0.5 ml-6">{entry.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 ml-6">
                      <span className="text-xs text-gray-600">{entry.startTime} → {entry.endTime}</span>
                      {entry.breakMinutes > 0 && (
                        <span className="text-xs text-gray-400">({entry.breakMinutes}m break)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#0F2B4C]">{formatHoursMinutes(entry.hours)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingEntry({
                        id: entry.id,
                        startTime: entry.startTime,
                        endTime: entry.endTime,
                        breakMinutes: entry.breakMinutes,
                        notes: '',
                      })}
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add Entry Button */}
          {!showAddEntry && (
            <Button
              variant="outline"
              className="w-full border-dashed border-[#E8A54B] text-[#E8A54B] hover:bg-[#E8A54B]/5"
              onClick={() => setShowAddEntry(true)}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Entry
            </Button>
          )}

          {/* Add Entry Form */}
          {showAddEntry && (
            <Card className="border-[#E8A54B]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Add Manual Entry</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowAddEntry(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={newEntryType} onValueChange={setNewEntryType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="travel"><div className="flex items-center gap-2"><Car className="w-4 h-4" /> Travel</div></SelectItem>
                      <SelectItem value="training"><div className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Training</div></SelectItem>
                      <SelectItem value="office"><div className="flex items-center gap-2"><Building className="w-4 h-4" /> Office</div></SelectItem>
                      <SelectItem value="other"><div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Other</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Start Time</Label>
                    <Input type="time" value={newEntryStart} onChange={(e) => setNewEntryStart(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">End Time</Label>
                    <Input type="time" value={newEntryEnd} onChange={(e) => setNewEntryEnd(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input
                    placeholder="Optional description..."
                    value={newEntryDescription}
                    onChange={(e) => setNewEntryDescription(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button className="w-full bg-[#E8A54B] hover:bg-[#d4943f] text-white" onClick={handleAddManualEntry}>
                  Add Entry ({formatHoursMinutes(calculateHours(newEntryStart, newEntryEnd, 0))})
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Daily Total */}
          {allDayEntries.length > 0 && (
            <Card className="bg-[#0F2B4C]">
              <CardContent className="py-4 flex items-center justify-between">
                <span className="text-white/80 text-sm">Daily Total</span>
                <span className="text-2xl font-bold text-white">{formatHoursMinutes(totalHours)}</span>
              </CardContent>
            </Card>
          )}

          {/* Submit Day Button */}
          {allDayEntries.length > 0 && !isDaySubmitted(selectedDate) && (
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base font-semibold"
              onClick={handleSubmitDay}
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                <><Check className="w-5 h-5 mr-2" /> Submit Day</>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Weekly Summary View */}
      {viewMode === 'weekly' && (
        <div className="px-4 py-4 space-y-4">
          {/* Weekly Hours Grid */}
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-7 gap-1 text-center">
                {weekDays.map((day, i) => (
                  <div key={day.toISOString()} className="flex flex-col items-center">
                    <span className="text-[10px] uppercase text-gray-500">{format(day, 'EEE')}</span>
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center mt-1 text-sm font-semibold ${
                        isToday(day)
                          ? 'bg-[#E8A54B] text-white'
                          : weeklyHours[i] > 0
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {weeklyHours[i] > 0 ? weeklyHours[i].toFixed(1) : '-'}
                    </div>
                    {isDaySubmitted(day) && <Check className="w-3 h-3 text-green-500 mt-1" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Total Week Hours */}
          <Card className="bg-[#0F2B4C]">
            <CardContent className="py-6 text-center">
              <p className="text-white/60 text-sm mb-1">Total Week Hours</p>
              <p className="text-4xl font-bold text-white">{totalWeekHours.toFixed(1)}</p>
              <p className="text-white/50 text-xs mt-1">hours logged</p>
            </CardContent>
          </Card>

          {/* Breakdown by Category */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">Breakdown by Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-blue-500" />
                  <span className="text-sm">Job Time</span>
                </div>
                <span className="font-semibold text-sm">{formatHoursMinutes(weeklyBreakdown.jobTime)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-purple-500" />
                  <span className="text-sm">Travel</span>
                </div>
                <span className="font-semibold text-sm">{formatHoursMinutes(weeklyBreakdown.travelTime)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-gray-400" />
                  <span className="text-sm">Other</span>
                </div>
                <span className="font-semibold text-sm">{formatHoursMinutes(weeklyBreakdown.otherTime)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Submit Week Button */}
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base font-semibold"
            onClick={handleSubmitWeek}
            disabled={submitting}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting Week...</>
            ) : (
              <><Check className="w-5 h-5 mr-2" /> Submit Week</>
            )}
          </Button>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-6 space-y-4 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#0F2B4C]">Edit Entry</h3>
              <Button variant="ghost" size="icon" onClick={() => setEditingEntry(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Start Time</Label>
                <Input
                  type="time"
                  value={editingEntry.startTime}
                  onChange={(e) => setEditingEntry({ ...editingEntry, startTime: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">End Time</Label>
                <Input
                  type="time"
                  value={editingEntry.endTime}
                  onChange={(e) => setEditingEntry({ ...editingEntry, endTime: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">Break Time (minutes)</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={editingEntry.breakMinutes}
                onChange={(e) => setEditingEntry({ ...editingEntry, breakMinutes: parseInt(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm">Notes (optional)</Label>
              <Input
                placeholder="Any additional notes..."
                value={editingEntry.notes}
                onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingEntry(null)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-[#0F2B4C] hover:bg-[#1a3d63] text-white" onClick={handleEditSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
