import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { hasRole } from "@/lib/types";
import { LeafletMap, MapMarker } from "@/components/leaflet-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, Users, Briefcase, Clock, RefreshCw } from "lucide-react";
import { format, parseISO, isToday, isValid } from "date-fns";

interface EngineerLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lastUpdate?: string;
}

export default function MapPage() {
  const { user } = useAuth();
  const { jobs, refreshJobs } = useStore();
  const [, setLocation] = useLocation();
  const [engineerLocations, setEngineerLocations] = useState<EngineerLocation[]>([]);
  const [showEngineers, setShowEngineers] = useState(true);
  const [showJobs, setShowJobs] = useState(true);
  const [showTodayOnly, setShowTodayOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEngineerLocations = useCallback(async () => {
    try {
      const response = await fetch('/api/engineers/locations', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setEngineerLocations(data);
      }
    } catch {
      // Fail silently
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchEngineerLocations(), refreshJobs()]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchEngineerLocations, refreshJobs]);

  useEffect(() => {
    if (hasRole(user, 'admin')) {
      const loadInitialData = async () => {
        await fetchEngineerLocations();
        setIsLoading(false);
      };
      loadInitialData();
      const interval = setInterval(fetchEngineerLocations, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchEngineerLocations]);

  if (!user || !hasRole(user, 'admin')) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Access denied. Admin only.</p>
      </div>
    );
  }

  const filteredJobs = showTodayOnly 
    ? jobs.filter(job => {
        if (!job.date) return false;
        try {
          const jobDate = parseISO(job.date);
          return isValid(jobDate) && isToday(jobDate);
        } catch {
          return false;
        }
      })
    : jobs.filter(job => job.status !== 'Signed Off');

  const markers: MapMarker[] = [];

  if (showEngineers) {
    engineerLocations.forEach(engineer => {
      markers.push({
        id: `eng-${engineer.id}`,
        lat: engineer.lat,
        lng: engineer.lng,
        type: 'engineer',
        title: engineer.name,
        subtitle: engineer.lastUpdate 
          ? `Last seen: ${format(new Date(engineer.lastUpdate), "HH:mm dd/MM")}`
          : undefined,
      });
    });
  }

  if (showJobs) {
    filteredJobs.forEach(job => {
      if (job.signOffLat && job.signOffLng) {
        markers.push({
          id: `job-${job.id}`,
          lat: job.signOffLat,
          lng: job.signOffLng,
          type: 'job',
          title: job.customerName,
          subtitle: job.address || undefined,
          status: job.status,
        });
      }
    });
  }

  const handleMarkerClick = (marker: MapMarker) => {
    if (marker.id.startsWith('job-')) {
      const jobId = marker.id.replace('job-', '');
      setLocation(`/jobs/${jobId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-8 w-8 text-primary" />
            Live Map
          </h1>
          <p className="text-muted-foreground">
            Track engineers and job locations in real-time
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isLoading}
          className="cursor-pointer active:scale-95 transition-transform"
          data-testid="button-refresh-map"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              <LeafletMap 
                markers={markers} 
                height="500px"
                onMarkerClick={handleMarkerClick}
                showUserLocation={false}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-engineers" className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Engineers
                </Label>
                <Switch 
                  id="show-engineers" 
                  checked={showEngineers} 
                  onCheckedChange={setShowEngineers}
                  data-testid="switch-show-engineers"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-jobs" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-emerald-500" />
                  Jobs
                </Label>
                <Switch 
                  id="show-jobs" 
                  checked={showJobs} 
                  onCheckedChange={setShowJobs}
                  data-testid="switch-show-jobs"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="today-only" className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Today Only
                </Label>
                <Switch 
                  id="today-only" 
                  checked={showTodayOnly} 
                  onCheckedChange={setShowTodayOnly}
                  data-testid="switch-today-only"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Engineers ({engineerLocations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {engineerLocations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No engineers with location data
                </p>
              ) : (
                <div className="space-y-3">
                  {engineerLocations.map(engineer => (
                    <div 
                      key={engineer.id} 
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                      data-testid={`engineer-location-${engineer.id}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{engineer.name}</p>
                        {engineer.lastUpdate && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(engineer.lastUpdate), "HH:mm")}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Online
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Jobs ({filteredJobs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No jobs to display
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredJobs.slice(0, 10).map(job => (
                    <div 
                      key={job.id} 
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => setLocation(`/jobs/${job.id}`)}
                      data-testid={`job-map-item-${job.id}`}
                    >
                      <p className="font-medium text-sm truncate">{job.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">{job.address}</p>
                    </div>
                  ))}
                  {filteredJobs.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{filteredJobs.length - 10} more jobs
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex gap-4 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                <span>Engineer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rotate-180 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-emerald-500"></div>
                <span>Active Job</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rotate-180 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-slate-500"></div>
                <span>Draft</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
