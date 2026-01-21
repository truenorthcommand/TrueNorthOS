import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  PoundSterling, TrendingUp, TrendingDown, Briefcase, Users, Receipt, 
  ArrowUpRight, ArrowDownRight, Target, AlertTriangle, CheckCircle,
  Calendar, Clock, Building2, Wallet, BarChart3, PieChart, Activity,
  ChevronRight, FileText, CreditCard, Percent
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

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

export default function DirectorsSuite() {
  const [activeTab, setActiveTab] = useState("overview");
  const [, setLocation] = useLocation();
  
  const { data, isLoading, error } = useQuery<DirectorsDashboardData>({
    queryKey: ["/api/directors/dashboard"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return <DirectorsSuiteLoading />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-bold text-[#0F2B4C]">Directors Suite</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Failed to load dashboard data. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F2B4C]" data-testid="text-directors-title">
            Directors Suite
          </h1>
          <p className="text-muted-foreground">Executive business intelligence and strategic insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            <Calendar className="w-3 h-3 mr-1" />
            {format(new Date(), 'MMMM yyyy')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(data.summary.totalRevenue)}
          change={data.summary.revenueGrowth}
          icon={PoundSterling}
          color={COLORS.success}
          testId="metric-revenue"
          onClick={() => setLocation('/invoices')}
        />
        <MetricCard
          title="Profit Margin"
          value={`${data.summary.profitMargin.toFixed(1)}%`}
          subtitle={formatCurrency(data.summary.totalProfit)}
          icon={Percent}
          color={COLORS.primary}
          testId="metric-profit"
          onClick={() => setLocation('/invoices')}
        />
        <MetricCard
          title="Outstanding Invoices"
          value={formatCurrency(data.summary.outstandingInvoices)}
          subtitle={`${data.summary.overdueInvoices} overdue`}
          icon={Receipt}
          color={data.summary.overdueInvoices > 0 ? COLORS.warning : COLORS.info}
          testId="metric-outstanding"
          onClick={() => setLocation('/invoices')}
        />
        <MetricCard
          title="Active Jobs"
          value={data.summary.activeJobs.toString()}
          subtitle={`${data.summary.completedJobsThisMonth} completed this month`}
          icon={Briefcase}
          color={COLORS.info}
          testId="metric-jobs"
          onClick={() => setLocation('/jobs')}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#0F2B4C] data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="financial" className="data-[state=active]:bg-[#0F2B4C] data-[state=active]:text-white">
            <Wallet className="w-4 h-4 mr-2" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="operations" className="data-[state=active]:bg-[#0F2B4C] data-[state=active]:text-white">
            <Activity className="w-4 h-4 mr-2" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-[#0F2B4C] data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" />
            Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card 
              className="lg:col-span-2 cursor-pointer hover:shadow-md transition-shadow" 
              onClick={() => setLocation('/invoices')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setLocation('/invoices')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#0F2B4C]" />
                  Revenue & Profit Trends
                </CardTitle>
                <CardDescription>Monthly financial performance over the past 12 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
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

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/jobs')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-[#0F2B4C]" />
                  Job Status
                </CardTitle>
                <CardDescription>Current job distribution</CardDescription>
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
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {data.jobMetrics.jobsByStatus.map((status) => (
                    <div key={status.status} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                        <span>{status.status}</span>
                      </div>
                      <span className="font-medium">{status.count}</span>
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
              onClick={() => setLocation('/clients')}
            />
            <QuickStatCard
              title="Team Size"
              value={data.summary.totalEngineers}
              subtitle="Active engineers"
              icon={Users}
              onClick={() => setLocation('/staff')}
            />
            <QuickStatCard
              title="Avg Job Value"
              value={formatCurrency(data.summary.avgJobValue)}
              subtitle="Per completed job"
              icon={Target}
              onClick={() => setLocation('/jobs')}
            />
            <QuickStatCard
              title="Completion Rate"
              value={`${data.jobMetrics.completionRate}%`}
              subtitle="Jobs completed on time"
              icon={CheckCircle}
              onClick={() => setLocation('/jobs')}
            />
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/invoices')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Cash Flow</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(data.financialHealth.cashFlow)}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/invoices')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Receivables</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(data.financialHealth.receivables)}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Receipt className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/expenses')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Payables</p>
                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(data.financialHealth.payables)}</p>
                  </div>
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <CreditCard className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/invoices')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#0F2B4C]" />
                Invoice Ageing
              </CardTitle>
              <CardDescription>Outstanding invoices by age</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.financialHealth.invoiceAgeing.map((range) => (
                  <div key={range.range} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{range.range}</span>
                      <span className="font-medium">{formatCurrency(range.amount)}</span>
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

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/clients')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0F2B4C]" />
                Top Clients by Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.topClients.map((client, index) => (
                  <div key={client.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#0F2B4C] text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-sm text-muted-foreground">{client.jobCount} jobs</p>
                      </div>
                    </div>
                    <p className="font-bold text-[#0F2B4C]">{formatCurrency(client.revenue)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/jobs')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#0F2B4C]" />
                  Operational KPIs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Job Completion Rate</span>
                    <span className="font-medium">{data.jobMetrics.completionRate}%</span>
                  </div>
                  <Progress value={data.jobMetrics.completionRate} className="h-3" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Completion Time</span>
                    <span className="font-medium">{data.jobMetrics.avgCompletionTime} days</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Target: 7 days</span>
                    {data.jobMetrics.avgCompletionTime <= 7 ? (
                      <Badge className="bg-green-500 ml-auto">On Target</Badge>
                    ) : (
                      <Badge variant="destructive" className="ml-auto">Above Target</Badge>
                    )}
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3">Jobs by Status</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {data.jobMetrics.jobsByStatus.map((status) => (
                      <div key={status.status} className="p-3 bg-slate-50 rounded-lg text-center">
                        <p className="text-2xl font-bold" style={{ color: status.color }}>{status.count}</p>
                        <p className="text-xs text-muted-foreground">{status.status}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#0F2B4C]" />
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
                  target={5}
                  format={(v) => v.toString()}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/staff')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0F2B4C]" />
                Engineer Performance
              </CardTitle>
              <CardDescription>Top performing team members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.engineerPerformance.map((engineer, index) => (
                  <div key={engineer.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 bg-[#0F2B4C] text-white rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{engineer.name}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{engineer.completedJobs} jobs</span>
                        <span>{formatCurrency(engineer.revenue)} revenue</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${i < engineer.rating ? 'bg-amber-400' : 'bg-slate-200'}`}
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
  testId,
  onClick
}: { 
  title: string; 
  value: string; 
  change?: number; 
  subtitle?: string;
  icon: any; 
  color: string;
  testId: string;
  onClick?: () => void;
}) {
  return (
    <Card 
      data-testid={testId} 
      className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          {change !== undefined && (
            <Badge variant={change >= 0 ? "default" : "destructive"} className="text-xs">
              {change >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
              {Math.abs(change).toFixed(1)}%
            </Badge>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{subtitle || title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickStatCard({ title, value, subtitle, icon: Icon, onClick }: { title: string; value: string | number; subtitle: string; icon: any; onClick?: () => void }) {
  return (
    <Card 
      className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#0F2B4C]/10 rounded-lg">
            <Icon className="h-5 w-5 text-[#0F2B4C]" />
          </div>
          <div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TargetProgress({ label, current, target, format }: { label: string; current: number; target: number; format: (v: number) => string }) {
  const percentage = Math.min((current / target) * 100, 100);
  const isOnTrack = percentage >= 80;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{format(current)} / {format(target)}</span>
      </div>
      <Progress value={percentage} className="h-3" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{percentage.toFixed(0)}% achieved</span>
        {isOnTrack ? (
          <span className="text-green-600 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> On track
          </span>
        ) : (
          <span className="text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Needs attention
          </span>
        )}
      </div>
    </div>
  );
}

function DirectorsSuiteLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-10 w-10 rounded-lg mb-3" />
              <Skeleton className="h-8 w-24 mb-1" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
