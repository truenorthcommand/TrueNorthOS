import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, MapPin, User, Calendar, Timer } from "lucide-react";
import { format, formatDistanceStrict, parseISO } from "date-fns";
import { Redirect } from "wouter";

interface TimeLog {
  id: string;
  engineerId: string;
  clockInTime: string;
  clockOutTime: string | null;
  clockInLat: number | null;
  clockInLng: number | null;
  clockInAddress: string | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  clockOutAddress: string | null;
  notes: string | null;
  createdAt: string;
}

interface Engineer {
  id: string;
  name: string;
  username: string;
}

export default function TimeLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [logsRes, usersRes] = await Promise.all([
          fetch("/api/time/logs/all", { credentials: "include" }),
          fetch("/api/users", { credentials: "include" }),
        ]);
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setLogs(logsData);
        }
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setEngineers(usersData.filter((u: any) => u.role === "engineer"));
        }
      } catch (error) {
        console.error("Failed to fetch time logs", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (!user || user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  const filteredLogs = selectedEngineer === "all" 
    ? logs 
    : logs.filter(log => log.engineerId === selectedEngineer);

  const getEngineerName = (engineerId: string) => {
    const engineer = engineers.find(e => e.id === engineerId);
    return engineer?.name || "Unknown";
  };

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "Ongoing";
    const start = parseISO(clockIn);
    const end = parseISO(clockOut);
    return formatDistanceStrict(start, end);
  };

  const formatTime = (dateStr: string) => {
    return format(parseISO(dateStr), "HH:mm");
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), "EEE, dd MMM yyyy");
  };

  const shortenAddress = (address: string | null) => {
    if (!address) return "Location not available";
    const parts = address.split(",").slice(0, 3);
    return parts.join(",");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading time logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time Logs</h1>
          <p className="text-muted-foreground">
            View engineer clock in/out records with location data
          </p>
        </div>
        
        <Select value={selectedEngineer} onValueChange={setSelectedEngineer}>
          <SelectTrigger className="w-[200px]" data-testid="select-engineer-filter">
            <SelectValue placeholder="Filter by engineer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engineers</SelectItem>
            {engineers.map(engineer => (
              <SelectItem key={engineer.id} value={engineer.id}>
                {engineer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No time logs found</p>
            <p className="text-sm">Engineers will appear here once they start clocking in.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <Card key={log.id} className={!log.clockOutTime ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : ""} data-testid={`time-log-${log.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${!log.clockOutTime ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                      <Timer className="h-5 w-5 text-white" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" data-testid={`engineer-name-${log.id}`}>
                          {getEngineerName(log.engineerId)}
                        </span>
                        {!log.clockOutTime && (
                          <Badge className="bg-emerald-500">Active</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDate(log.clockInTime)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Clock In</p>
                      <p className="font-medium">{formatTime(log.clockInTime)}</p>
                      {log.clockInAddress && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {shortenAddress(log.clockInAddress)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Clock Out</p>
                      <p className="font-medium">
                        {log.clockOutTime ? formatTime(log.clockOutTime) : "—"}
                      </p>
                      {log.clockOutAddress && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {shortenAddress(log.clockOutAddress)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Duration</p>
                      <p className="font-medium">
                        {calculateDuration(log.clockInTime, log.clockOutTime)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
