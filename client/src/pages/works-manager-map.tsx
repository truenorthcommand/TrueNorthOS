import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { GoogleMap, MapMarker } from "@/components/google-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, Users, Briefcase, Clock, RefreshCw } from "lucide-react";
import { format, parseISO, isToday, isValid } from "date-fns";

interface TeamMember {
  id: string;
  name: string;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationUpdate: string | null;
}

interface Job {
  id: string;
  jobNo: string;
  customerName: string;
  address: string | null;
  date: string | null;
  status: string;
  signOffLat: number | null;
  signOffLng: number | null;
}

export default function WorksManagerMap() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showEngineers, setShowEngineers] = useState(true);
  const [showJobs, setShowJobs] = useState(true);
  const [showTodayOnly, setShowTodayOnly] = useState(true);

  const { data: team, isLoading: teamLoading, refetch: refetchTeam } = useQuery<TeamMember[]>({
    queryKey: ["/api/works-manager/team"],
    refetchInterval: 30000,
  });

  const { data: jobs, refetch: refetchJobs } = useQuery<Job[]>({
    queryKey: ["/api/works-manager/jobs"],
    refetchInterval: 60000,
  });

  const handleRefresh = () => {
    refetchTeam();
    refetchJobs();
  };

  const isOnline = (member: TeamMember) => {
    if (!member.lastLocationUpdate) return false;
    const lastUpdate = new Date(member.lastLocationUpdate);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastUpdate > fiveMinutesAgo;
  };

  const engineersWithLocation = team?.filter(m => m.currentLat && m.currentLng) || [];

  const filteredJobs = showTodayOnly 
    ? (jobs || []).filter(job => {
        if (!job.date) return false;
        try {
          const jobDate = parseISO(job.date);
          return isValid(jobDate) && isToday(jobDate);
        } catch {
          return false;
        }
      })
    : (jobs || []).filter(job => job.status !== 'Signed Off');

  const markers: MapMarker[] = [];

  if (showEngineers) {
    engineersWithLocation.forEach(member => {
      if (member.currentLat && member.currentLng) {
        markers.push({
          id: `eng-${member.id}`,
          lat: member.currentLat,
          lng: member.currentLng,
          type: 'engineer',
          title: member.name,
          subtitle: member.lastLocationUpdate 
            ? `Last seen: ${format(new Date(member.lastLocationUpdate), "HH:mm dd/MM")}`
            : undefined,
        });
      }
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

  if (!user) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-8 w-8 text-primary" />
            Team Map
          </h1>
          <p className="text-muted-foreground">
            Track your team members and job locations in real-time
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={teamLoading}
          data-testid="button-refresh-map"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${teamLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              <GoogleMap 
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
                  Team Members
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
                Team ({engineersWithLocation.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {engineersWithLocation.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No team members with location data
                </p>
              ) : (
                <div className="space-y-3">
                  {engineersWithLocation.map(member => (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                      data-testid={`team-location-${member.id}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        {member.lastLocationUpdate && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(member.lastLocationUpdate), "HH:mm")}
                          </p>
                        )}
                      </div>
                      <Badge variant={isOnline(member) ? "default" : "secondary"} className={
                        isOnline(member) ? 'bg-green-100 text-green-800 dark:bg-green-900/30' : ''
                      }>
                        {isOnline(member) ? 'Online' : 'Offline'}
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
                <span>Team Member</span>
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
