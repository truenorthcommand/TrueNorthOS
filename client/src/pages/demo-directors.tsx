import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { GoogleMap, MapMarker } from "@/components/google-map";
import { 
  PoundSterling, TrendingUp, TrendingDown, Briefcase, Users, Receipt, 
  ArrowUpRight, ArrowDownRight, Target, AlertTriangle, CheckCircle,
  Calendar, Clock, Building2, Wallet, BarChart3, PieChart, Activity,
  ChevronRight, FileText, CreditCard, Percent, MapPin, Sparkles
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart
} from "recharts";
import { format } from "date-fns";

interface DirectorsDashboardData {
  summary: {
    totalRevenue: number;
    revenueGrowth: number;
    totalProfit: number;
    profitMargin: number;
    outstandingInvoices: number;
    overdueInvoices: number;
    activeJobs: number;
    completedJobsThisMonth: number;
    totalClients: number;
    newClientsThisMonth: number;
    totalEngineers: number;
    avgJobValue: number;
  };
  monthlyTrends: {
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }[];
  jobMetrics: {
    completionRate: number;
    avgCompletionTime: number;
    jobsByStatus: { status: string; count: number; color: string }[];
  };
  financialHealth: {
    cashFlow: number;
    receivables: number;
    payables: number;
    invoiceAgeing: { range: string; amount: number; color: string }[];
  };
  topClients: {
    id: string;
    name: string;
    revenue: number;
    jobCount: number;
  }[];
  engineerPerformance: {
    id: string;
    name: string;
    completedJobs: number;
    revenue: number;
    rating: number;
  }[];
}

const NAVY = "#0F2B4C";
const COLORS = {
  primary: NAVY,
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  purple: "#8b5cf6",
};

export default function DemoDirectorsSuite() {
  const [activeTab, setActiveTab] = useState("overview");
  
  const { data, isLoading, error } = useQuery<DirectorsDashboardData>({
    queryKey: ["/api/demo/directors/dashboard"],
  });

  const mapMarkers = useMemo<MapMarker[]>(() => {
    if (!data) return [];
    const markers: MapMarker[] = [];
    
    data.engineerPerformance.forEach((eng, index) => {
      const baseLat = 51.5074 + (index * 0.02) - 0.05;
      const baseLng = -0.1278 + (index * 0.015) - 0.04;
      markers.push({
        id: `eng-${eng.id}`,
        lat: baseLat,
        lng: baseLng,
        type: 'engineer',
        title: eng.name,
        subtitle: `${eng.completedJobs} jobs completed`,
        status: 'Active'
      });
    });
    
    data.jobMetrics.jobsByStatus.forEach((statusGroup, idx) => {
      if (statusGroup.status !== 'Signed Off' && statusGroup.count > 0) {
        const baseLat = 51.52 + (idx * 0.018);
        const baseLng = -0.11 + (idx * 0.02);
        markers.push({
          id: `job-status-${idx}`,
          lat: baseLat,
          lng: baseLng,
          type: 'job',
          title: `${statusGroup.count} ${statusGroup.status}`,
          subtitle: 'Active Jobs',
          status: statusGroup.status
        });
      }
    });
    
    return markers;
  }, [data]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return <DemoLoading />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a1929] text-white p-6 space-y-6">
        <h1 className="text-3xl font-bold text-white">Directors Suite Demo</h1>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <p className="text-slate-400">Failed to load demo data. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1929] text-white p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-white" data-testid="text-demo-directors-title">
                Directors Suite
              </h1>
              <Badge className="bg-amber-600 text-white">
                <Sparkles className="w-3 h-3 mr-1" />
                Demo
              </Badge>
            </div>
            <p className="text-slate-400">Executive business intelligence and strategic insights</p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm bg-slate-800 text-white border-slate-600">
          <Calendar className="w-3 h-3 mr-1" />
          {format(new Date(), 'MMMM yyyy')}
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(data.summary.totalRevenue)}
          change={data.summary.revenueGrowth}
          icon={PoundSterling}
          color={COLORS.success}
          testId="metric-revenue"
        />
        <MetricCard
          title="Profit Margin"
          value={`${data.summary.profitMargin.toFixed(1)}%`}
          subtitle={formatCurrency(data.summary.totalProfit)}
          icon={Percent}
          color={COLORS.primary}
          testId="metric-profit"
        />
        <MetricCard
          title="Outstanding Invoices"
          value={formatCurrency(data.summary.outstandingInvoices)}
          subtitle={`${data.summary.overdueInvoices} overdue`}
          icon={Receipt}
          color={data.summary.overdueInvoices > 0 ? COLORS.warning : COLORS.info}
          testId="metric-outstanding"
        />
        <MetricCard
          title="Active Jobs"
          value={data.summary.activeJobs.toString()}
          subtitle={`${data.summary.completedJobsThisMonth} completed this month`}
          icon={Briefcase}
          color={COLORS.info}
          testId="metric-jobs"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="overview" className="text-slate-400 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="financial" className="text-slate-400 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Wallet className="w-4 h-4 mr-2" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="operations" className="text-slate-400 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Activity className="w-4 h-4 mr-2" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="team" className="text-slate-400 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" />
            Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  Revenue & Profit Trends
                </CardTitle>
                <CardDescription className="text-slate-400">Monthly financial performance over the past 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="#64748b" />
                      <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="#64748b" tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="profit" name="Profit" stroke={COLORS.success} strokeWidth={2} dot={{ fill: COLORS.success }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <PieChart className="w-5 h-5 text-purple-400" />
                  Job Status
                </CardTitle>
                <CardDescription className="text-slate-400">Current job distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={data.jobMetrics.jobsByStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {data.jobMetrics.jobsByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {data.jobMetrics.jobsByStatus.map((status) => (
                    <div key={status.status} className="flex items-center justify-between text-sm text-slate-300">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                        <span>{status.status}</span>
                      </div>
                      <span className="font-medium text-white">{status.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickStatCard
              title="Total Clients"
              value={data.summary.totalClients}
              subtitle={`+${data.summary.newClientsThisMonth} this month`}
              icon={Building2}
            />
            <QuickStatCard
              title="Team Size"
              value={data.summary.totalEngineers}
              subtitle="Active engineers"
              icon={Users}
            />
            <QuickStatCard
              title="Avg Job Value"
              value={formatCurrency(data.summary.avgJobValue)}
              subtitle="Per completed job"
              icon={Target}
            />
            <QuickStatCard
              title="Completion Rate"
              value={`${data.jobMetrics.completionRate}%`}
              subtitle="Jobs completed on time"
              icon={CheckCircle}
            />
          </div>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-white">
                <MapPin className="w-5 h-5 text-blue-400" />
                Live Team Tracker
              </CardTitle>
              <CardDescription className="text-slate-400">
                Real-time view of engineers and active jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border border-slate-700">
                <GoogleMap
                  markers={mapMarkers}
                  height="350px"
                  zoom={11}
                  center={{ lat: 51.5074, lng: -0.1278 }}
                />
              </div>
              <div className="mt-4 flex items-center gap-6 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Engineers ({mapMarkers.filter(m => m.type === 'engineer').length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span>Active Jobs ({mapMarkers.filter(m => m.type === 'job').length})</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500 bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Cash Flow</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(data.financialHealth.cashFlow)}</p>
                  </div>
                  <div className="p-3 bg-green-500/20 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500 bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Receivables</p>
                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(data.financialHealth.receivables)}</p>
                  </div>
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <Receipt className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500 bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Payables</p>
                    <p className="text-2xl font-bold text-amber-400">{formatCurrency(data.financialHealth.payables)}</p>
                  </div>
                  <div className="p-3 bg-amber-500/20 rounded-lg">
                    <CreditCard className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Clock className="w-5 h-5 text-blue-400" />
                Invoice Ageing
              </CardTitle>
              <CardDescription className="text-slate-400">Outstanding invoices by age</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.financialHealth.invoiceAgeing.map((range) => (
                  <div key={range.range} className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span>{range.range}</span>
                      <span className="font-medium text-white">{formatCurrency(range.amount)}</span>
                    </div>
                    <Progress 
                      value={(range.amount / Math.max(...data.financialHealth.invoiceAgeing.map(r => r.amount))) * 100} 
                      className="h-2"
                      style={{ '--progress-background': range.color } as any}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Building2 className="w-5 h-5 text-amber-400" />
                Top Clients by Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.topClients.map((client, index) => (
                  <div key={client.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-white">{client.name}</p>
                        <p className="text-sm text-slate-400">{client.jobCount} jobs</p>
                      </div>
                    </div>
                    <p className="font-bold text-amber-400">{formatCurrency(client.revenue)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Activity className="w-5 h-5 text-purple-400" />
                  Operational KPIs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Job Completion Rate</span>
                    <span className="font-medium text-white">{data.jobMetrics.completionRate}%</span>
                  </div>
                  <Progress value={data.jobMetrics.completionRate} className="h-3" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Average Completion Time</span>
                    <span className="font-medium text-white">{data.jobMetrics.avgCompletionTime} days</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Clock className="w-4 h-4" />
                    <span>Target: 7 days</span>
                    {data.jobMetrics.avgCompletionTime <= 7 ? (
                      <Badge className="bg-green-500 ml-auto">On Target</Badge>
                    ) : (
                      <Badge variant="destructive" className="ml-auto">Above Target</Badge>
                    )}
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-700">
                  <h4 className="font-medium mb-3 text-white">Jobs by Status</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {data.jobMetrics.jobsByStatus.map((status) => (
                      <div key={status.status} className="p-3 bg-slate-700/50 rounded-lg text-center">
                        <p className="text-2xl font-bold" style={{ color: status.color }}>{status.count}</p>
                        <p className="text-xs text-slate-400">{status.status}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Target className="w-5 h-5 text-emerald-400" />
                  Monthly Targets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <TargetProgress
                  label="Revenue Target"
                  current={data.summary.totalRevenue}
                  target={data.summary.totalRevenue * 1.1}
                  format={formatCurrency}
                />
                <TargetProgress
                  label="Jobs Completed"
                  current={data.summary.completedJobsThisMonth}
                  target={Math.ceil(data.summary.completedJobsThisMonth * 1.2)}
                  format={(v) => v.toString()}
                />
                <TargetProgress
                  label="New Clients"
                  current={data.summary.newClientsThisMonth}
                  target={10}
                  format={(v) => v.toString()}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="w-5 h-5 text-blue-400" />
                Engineer Performance
              </CardTitle>
              <CardDescription className="text-slate-400">Top performing team members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.engineerPerformance.map((engineer, index) => (
                  <div key={engineer.id} className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg">
                    <div className="w-10 h-10 bg-amber-600 text-white rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{engineer.name}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span>{engineer.completedJobs} jobs</span>
                        <span>{formatCurrency(engineer.revenue)} revenue</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${i < engineer.rating ? 'bg-amber-400' : 'bg-slate-600'}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="text-center pt-8 border-t border-slate-700">
        <p className="text-slate-500 text-sm">
          This is a demonstration of the Foreman Directors Suite with sample data.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  change, 
  subtitle, 
  icon: Icon, 
  color,
  testId
}: { 
  title: string; 
  value: string; 
  change?: number; 
  subtitle?: string;
  icon: any; 
  color: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId} className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 text-sm ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
              </div>
            )}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickStatCard({ title, value, subtitle, icon: Icon }: { title: string; value: string | number; subtitle: string; icon: any }) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-700 rounded-lg">
            <Icon className="w-5 h-5 text-slate-300" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-sm text-slate-400">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TargetProgress({ label, current, target, format }: { label: string; current: number; target: number; format: (v: number) => string }) {
  const percentage = Math.min((current / target) * 100, 100);
  const isOnTarget = percentage >= 90;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span className="font-medium text-white">{format(current)} / {format(target)}</span>
      </div>
      <Progress value={percentage} className="h-2" />
      <div className="flex justify-between text-xs text-slate-500">
        <span>{percentage.toFixed(0)}% achieved</span>
        {isOnTarget ? (
          <span className="text-green-400">On track</span>
        ) : (
          <span className="text-amber-400">{format(target - current)} to go</span>
        )}
      </div>
    </div>
  );
}

function DemoLoading() {
  return (
    <div className="min-h-screen bg-[#0a1929] text-white p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-xl bg-slate-700" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 bg-slate-700" />
          <Skeleton className="h-4 w-48 bg-slate-700" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-24 bg-slate-700" />
              <Skeleton className="h-8 w-32 bg-slate-700" />
              <Skeleton className="h-3 w-20 bg-slate-700" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-[400px] w-full rounded-lg bg-slate-700" />
    </div>
  );
}
