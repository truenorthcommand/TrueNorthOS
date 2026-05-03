import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { hasRole } from '@/lib/types';
import { LeafletMap, MapMarker } from '@/components/leaflet-map';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  MapPin, Users, Briefcase, Clock, RefreshCw, Maximize2, Minimize2,
  Navigation, AlertTriangle, CheckCircle2, Circle, Radio, Eye, EyeOff,
  Activity, Loader2, Car, Timer
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GpsPosition {
  user_id: number;
  full_name?: string;
  name?: string;
  latitude: number;
  longitude: number;
  status: string;
  action?: string;
  last_seen?: string;
  current_job?: string;
}

interface GpsStats {
  activeEngineers: number;
  totalEngineers: number;
  jobsCompleted: number;
  jobsTotal: number;
  walkaroundsCompleted: number;
  walkaroundsTotal: number;
  avgJobTime?: number;
}

interface MapAlert {
  type: 'geofence' | 'idle';
  message: string;
  time: Date;
}

// ─── Helper Functions (defined outside component) ────────────────────────────

function getJobStatusColor(status: string): string {
  switch (status) {
    case 'Ready': return '#3b82f6';
    case 'In Progress': return '#f59e0b';
    case 'Signed Off':
    case 'Completed': return '#10b981';
    case 'Draft': return '#6b7280';
    default: return '#6b7280';
  }
}

function getJobStatusEmoji(status: string): string {
  switch (status) {
    case 'Ready': return '🔵';
    case 'In Progress': return '🟡';
    case 'Signed Off':
    case 'Completed': return '🟢';
    case 'Draft': return '⚪';
    default: return '🔴';
  }
}

function getEngineerStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'online': return '#10b981';
    case 'idle': return '#f59e0b';
    case 'offline':
    default: return '#ef4444';
  }
}

function getEngineerStatusEmoji(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'online': return '🟢';
    case 'idle': return '🟡';
    case 'offline':
    default: return '🔴';
  }
}

function formatTimeAgo(dateStr: string | undefined): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return format(date, 'dd/MM HH:mm');
}

function formatAvgJobTime(minutes: number | undefined): string {
  if (!minutes) return '--';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function isJobOverdue(job: any): boolean {
  if (!job.scheduledDate) return false;
  if (job.status === 'Signed Off' || job.status === 'Completed' || job.status === 'In Progress') return false;
  const scheduled = new Date(job.scheduledDate);
  return scheduled < new Date() && (job.status === 'Ready' || job.status === 'Draft');
}

function buildMarkers(
  positions: GpsPosition[] | undefined,
  todayJobs: any[],
  showEngineers: boolean,
  showJobs: boolean
): MapMarker[] {
  const markers: MapMarker[] = [];

  if (showEngineers && positions) {
    positions.forEach((pos) => {
      if (pos.latitude && pos.longitude) {
        markers.push({
          id: `eng-${pos.user_id}`,
          lat: pos.latitude,
          lng: pos.longitude,
          type: 'engineer',
          title: pos.full_name || pos.name || 'Engineer',
          subtitle: `${pos.status} • ${pos.action || 'No activity'}`,
          status: pos.status,
        });
      }
    });
  }

  if (showJobs && todayJobs) {
    todayJobs.forEach((job: any) => {
      const lat = job.signOffLat || job.siteLat;
      const lng = job.signOffLng || job.siteLng;
      if (lat && lng) {
        markers.push({
          id: `job-${job.id}`,
          lat,
          lng,
          type: 'job',
          title: job.customerName || 'Job',
          subtitle: job.siteAddress || job.address,
          status: job.status,
        });
      }
    });
  }

  return markers;
}

function computeAlerts(positions: GpsPosition[] | undefined): MapAlert[] {
  if (!positions) return [];
  const newAlerts: MapAlert[] = [];

  positions.forEach((pos) => {
    if (pos.action === 'job-start' && pos.status === 'idle') {
      newAlerts.push({
        type: 'geofence',
        message: `${pos.full_name || pos.name} may have left job site`,
        time: new Date(),
      });
    }
    // Idle alert: check last_seen > 15 min
    if (pos.last_seen && pos.status === 'active') {
      const lastSeen = new Date(pos.last_seen);
      const diffMs = new Date().getTime() - lastSeen.getTime();
      if (diffMs > 15 * 60 * 1000) {
        newAlerts.push({
          type: 'idle',
          message: `${pos.full_name || pos.name} has been idle for ${Math.floor(diffMs / 60000)}min`,
          time: new Date(),
        });
      }
    }
  });

  return newAlerts;
}

function renderStatCard(
  icon: React.ReactNode,
  label: string,
  value: string,
  color: string
): React.ReactNode {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 flex items-center gap-2">
        <div className="p-1.5 rounded-md" style={{ backgroundColor: `${color}15` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function renderEngineerCard(
  pos: GpsPosition,
  onClickEngineer: (pos: GpsPosition) => void
): React.ReactNode {
  const statusColor = getEngineerStatusColor(pos.status);
  const statusEmoji = getEngineerStatusEmoji(pos.status);

  return (
    <div
      key={`eng-card-${pos.user_id}`}
      className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
      style={{ borderLeft: `3px solid ${statusColor}` }}
      onClick={() => onClickEngineer(pos)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm truncate">
          {pos.full_name || pos.name || 'Engineer'}
        </span>
        <span className="text-xs">{statusEmoji} {pos.status}</span>
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {pos.action ? `On: ${pos.current_job || pos.action}` : 'No current activity'}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        Last seen: {formatTimeAgo(pos.last_seen)}
      </p>
    </div>
  );
}

function renderJobCard(
  job: any,
  onClickJob: (job: any) => void
): React.ReactNode {
  const overdue = isJobOverdue(job);
  const displayStatus = overdue ? 'Overdue' : job.status;
  const statusColor = overdue ? '#ef4444' : getJobStatusColor(job.status);
  const statusEmoji = overdue ? '🔴' : getJobStatusEmoji(job.status);

  return (
    <div
      key={`job-card-${job.id}`}
      className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
      style={{ borderLeft: `3px solid ${statusColor}` }}
      onClick={() => onClickJob(job)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm truncate">
          {job.customerName || 'Unknown Client'}
        </span>
        <span className="text-xs">{statusEmoji} {displayStatus}</span>
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {job.siteAddress || job.address || 'No address'}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {job.assignedEngineerName || 'Unassigned'}
      </p>
    </div>
  );
}

function renderAlertCard(alert: MapAlert, index: number): React.ReactNode {
  const isGeofence = alert.type === 'geofence';
  return (
    <div
      key={`alert-${index}`}
      className={`p-3 rounded-lg border ${
        isGeofence ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className={`h-3.5 w-3.5 ${isGeofence ? 'text-red-600' : 'text-amber-600'}`} />
        <span className={`text-xs font-medium ${isGeofence ? 'text-red-700' : 'text-amber-700'}`}>
          {isGeofence ? 'Geofence Alert' : 'Idle Alert'}
        </span>
      </div>
      <p className={`text-xs ${isGeofence ? 'text-red-600' : 'text-amber-600'}`}>
        {alert.message}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {format(alert.time, 'HH:mm:ss')}
      </p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MapPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // State
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showEngineers, setShowEngineers] = useState(true);
  const [showJobs, setShowJobs] = useState(true);
  const [alerts, setAlerts] = useState<MapAlert[]>([]);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);

  // Access control
  if (!hasRole(user, 'admin', 'works_manager')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              The Live Map is only available to administrators and works managers.
            </p>
            <Button className="mt-4" onClick={() => setLocation('/')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Data fetching
  const { data: positions, isLoading: positionsLoading, refetch: refetchPositions } = useQuery<GpsPosition[]>({
    queryKey: ['/api/gps/live-positions'],
    refetchInterval: 15000,
  });

  const { data: stats, refetch: refetchStats } = useQuery<GpsStats>({
    queryKey: ['/api/gps/stats'],
    refetchInterval: 30000,
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
  });

  // Filter today's jobs
  const todayJobs = useMemo(() => {
    if (!jobs) return [];
    const todayStr = new Date().toDateString();
    return jobs.filter((j: any) => {
      if (!j.scheduledDate) return false;
      return new Date(j.scheduledDate).toDateString() === todayStr;
    });
  }, [jobs]);

  // Build markers
  const markers = useMemo(
    () => buildMarkers(positions, todayJobs, showEngineers, showJobs),
    [positions, todayJobs, showEngineers, showJobs]
  );

  // Compute alerts when positions change
  useEffect(() => {
    if (!positions) return;
    const newAlerts = computeAlerts(positions);
    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 10));
    }
  }, [positions]);

  // Computed stats
  const activeEngineers = stats?.activeEngineers ?? (positions?.filter((p) => p.status === 'active').length ?? 0);
  const totalEngineers = stats?.totalEngineers ?? (positions?.length ?? 0);
  const completedJobs = stats?.jobsCompleted ?? todayJobs.filter((j) => j.status === 'Signed Off' || j.status === 'Completed').length;
  const totalJobs = stats?.jobsTotal ?? todayJobs.length;
  const walkarounds = stats?.walkaroundsCompleted ?? 0;
  const walkaroundsTotal = stats?.walkaroundsTotal ?? 0;

  // Handlers
  function handleRefresh() {
    refetchPositions();
    refetchStats();
    toast({ title: 'Map refreshed', description: 'Latest positions loaded' });
  }

  const [geocoding, setGeocoding] = useState(false);
  async function handleGeocodeAll() {
    setGeocoding(true);
    try {
      const res = await fetch('/api/gps/geocode-all-jobs', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Geocoding Complete', description: data.message });
      } else {
        toast({ title: 'Geocoding Failed', description: data.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Geocoding Failed', description: error.message, variant: 'destructive' });
    } finally {
      setGeocoding(false);
    }
  }

  function handleMarkerClick(marker: MapMarker) {
    setMapCenter({ lat: marker.lat, lng: marker.lng });
    toast({
      title: marker.title,
      description: marker.subtitle || 'No details',
    });
  }

  function handleEngineerClick(pos: GpsPosition) {
    if (pos.latitude && pos.longitude) {
      setMapCenter({ lat: pos.latitude, lng: pos.longitude });
    }
  }

  function handleJobClick(job: any) {
    const lat = job.signOffLat || job.siteLat;
    const lng = job.signOffLng || job.siteLng;
    if (lat && lng) {
      setMapCenter({ lat, lng });
    }
  }

  function handleFullScreenToggle() {
    setIsFullScreen((prev) => !prev);
  }

  // Loading state
  if (positionsLoading && jobsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading live map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" style={{ color: '#0F2B4C' }} />
            <h1 className="text-lg font-semibold" style={{ color: '#0F2B4C' }}>Live Map</h1>
          </div>

          {/* Stats Badges */}
          <div className="hidden md:flex items-center gap-2">
            <Badge variant="secondary" className="text-xs gap-1">
              <Users className="h-3 w-3" />
              {activeEngineers}/{totalEngineers} Engineers
            </Badge>
            <Badge variant="secondary" className="text-xs gap-1">
              <Briefcase className="h-3 w-3" />
              {completedJobs}/{totalJobs} Jobs
            </Badge>
            <Badge variant="secondary" className="text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {walkarounds} Walkarounds
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-xs font-medium text-green-600">Live</span>
          </div>

          {/* Toggle filters */}
          <div className="hidden lg:flex items-center gap-3 border-l pl-3 ml-1">
            <div className="flex items-center gap-1.5">
              <Switch
                id="show-engineers"
                checked={showEngineers}
                onCheckedChange={setShowEngineers}
                className="scale-75"
              />
              <Label htmlFor="show-engineers" className="text-xs cursor-pointer">
                Engineers
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch
                id="show-jobs"
                checked={showJobs}
                onCheckedChange={setShowJobs}
                className="scale-75"
              />
              <Label htmlFor="show-jobs" className="text-xs cursor-pointer">
                Jobs
              </Label>
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGeocodeAll} 
            disabled={geocoding}
            className="h-8 text-xs"
          >
            {geocoding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
            {geocoding ? 'Geocoding...' : 'Geocode All Jobs'}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleRefresh} className="h-8 w-8">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleFullScreenToggle} className="h-8 w-8">
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 grid overflow-hidden ${
        isFullScreen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-4'
      }`}>
        {/* Map Section */}
        <div className={`relative ${isFullScreen ? 'col-span-1' : 'lg:col-span-3'}`}>
          <LeafletMap
            markers={markers}
            height="100%"
            center={mapCenter}
            onMarkerClick={handleMarkerClick}
            showUserLocation={false}
          />

          {/* Map legend overlay */}
          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg border p-2 shadow-sm z-[1000]">
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <Circle className="h-3 w-3 fill-blue-500 text-blue-500" />
                <span>Engineer</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-blue-500" />
                <span>Ready</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-amber-500" />
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-green-500" />
                <span>Complete</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-red-500" />
                <span>Overdue</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {!isFullScreen && (
          <div className="hidden lg:flex flex-col border-l overflow-y-auto bg-muted/20">
            <div className="p-4 space-y-4">
              {/* Quick Stats */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Quick Stats
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {renderStatCard(
                    <Car className="h-4 w-4" />,
                    'On Road',
                    `${activeEngineers}/${totalEngineers}`,
                    activeEngineers === totalEngineers ? '#10b981' : '#f59e0b'
                  )}
                  {renderStatCard(
                    <Briefcase className="h-4 w-4" />,
                    'Jobs Today',
                    `${completedJobs}/${totalJobs}`,
                    '#3b82f6'
                  )}
                  {renderStatCard(
                    <CheckCircle2 className="h-4 w-4" />,
                    'Walkarounds',
                    `${walkarounds}/${walkaroundsTotal}`,
                    '#8b5cf6'
                  )}
                  {renderStatCard(
                    <Timer className="h-4 w-4" />,
                    'Avg Job Time',
                    formatAvgJobTime(stats?.avgJobTime),
                    '#0F2B4C'
                  )}
                </div>
              </div>

              {/* Engineer List */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  Engineers ({positions?.length || 0})
                </h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {positions && positions.length > 0 ? (
                    positions.map((pos) => renderEngineerCard(pos, handleEngineerClick))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No engineer positions available
                    </p>
                  )}
                </div>
              </div>

              {/* Today's Jobs */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  Today's Jobs ({todayJobs.length})
                </h3>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {todayJobs.length > 0 ? (
                    todayJobs.map((job) => renderJobCard(job, handleJobClick))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No jobs scheduled for today
                    </p>
                  )}
                </div>
              </div>

              {/* Alerts */}
              {alerts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Alerts ({alerts.length})
                  </h3>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                    {alerts.map((alert, i) => renderAlertCard(alert, i))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Sheet (visible on small screens when not fullscreen) */}
      {!isFullScreen && (
        <div className="lg:hidden border-t bg-background">
          <div className="p-3">
            {/* Mobile stats row */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
              <Badge variant="secondary" className="text-xs gap-1 whitespace-nowrap">
                <Users className="h-3 w-3" />
                {activeEngineers}/{totalEngineers}
              </Badge>
              <Badge variant="secondary" className="text-xs gap-1 whitespace-nowrap">
                <Briefcase className="h-3 w-3" />
                {completedJobs}/{totalJobs}
              </Badge>
              <Badge variant="secondary" className="text-xs gap-1 whitespace-nowrap">
                <CheckCircle2 className="h-3 w-3" />
                {walkarounds}
              </Badge>
              {alerts.length > 0 && (
                <Badge variant="destructive" className="text-xs gap-1 whitespace-nowrap">
                  <AlertTriangle className="h-3 w-3" />
                  {alerts.length} Alert{alerts.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Mobile filter toggles */}
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-1.5">
                <Switch
                  id="show-engineers-mobile"
                  checked={showEngineers}
                  onCheckedChange={setShowEngineers}
                  className="scale-75"
                />
                <Label htmlFor="show-engineers-mobile" className="text-xs">
                  Engineers
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch
                  id="show-jobs-mobile"
                  checked={showJobs}
                  onCheckedChange={setShowJobs}
                  className="scale-75"
                />
                <Label htmlFor="show-jobs-mobile" className="text-xs">
                  Jobs
                </Label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
