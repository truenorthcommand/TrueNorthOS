import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PoundSterling, Briefcase, Receipt, Users, TrendingUp, TrendingDown } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type AnalyticsData = {
  summary: {
    totalRevenue: number;
    totalCompletedJobs: number;
    pendingExpenses: number;
    activeEngineers: number;
  };
  monthlyRevenue: { month: string; revenue: number }[];
  jobsByMonth: { month: string; completed: number }[];
  jobsByStatus: { name: string; value: number; fill: string }[];
  monthlyExpenses: { month: string; amount: number }[];
  expensesByCategory: { category: string; amount: number }[];
  teamPerformance: {
    id: string;
    name: string;
    completedJobs: number;
    inProgressJobs: number;
    totalJobs: number;
  }[];
};

const EXPENSE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Analytics() {
  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
  });

  if (isLoading) {
    return <AnalyticsLoading />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-analytics-title">Analytics</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Failed to load analytics data. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-analytics-title">Analytics</h1>
        <p className="text-muted-foreground">Business performance overview and insights</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-revenue">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <PoundSterling className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(data.summary.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-completed-jobs">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.totalCompletedJobs}</p>
                <p className="text-xs text-muted-foreground">Jobs Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-expenses">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Receipt className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(data.summary.pendingExpenses)}</p>
                <p className="text-xs text-muted-foreground">Pending Expenses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-engineers">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.activeEngineers}</p>
                <p className="text-xs text-muted-foreground">Active Engineers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card data-testid="card-revenue-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Monthly Revenue
            </CardTitle>
            <CardDescription>Revenue trend over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {data.monthlyRevenue.some(d => d.revenue > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.monthlyRevenue}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis 
                      className="text-xs" 
                      tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      labelClassName="font-medium"
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No revenue data for the last 6 months
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-jobs-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-500" />
              Jobs Completed
            </CardTitle>
            <CardDescription>Jobs completed per month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {data.jobsByMonth.some(d => d.completed > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.jobsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => [value, 'Jobs Completed']}
                      labelClassName="font-medium"
                    />
                    <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No completed jobs in the last 6 months
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card data-testid="card-job-status-chart">
          <CardHeader>
            <CardTitle>Job Status Distribution</CardTitle>
            <CardDescription>Current breakdown of jobs by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {data.jobsByStatus.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.jobsByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {data.jobsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [value, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No jobs found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-expenses-category-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Expenses by Category
            </CardTitle>
            <CardDescription>Total expenses breakdown by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {data.expensesByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.expensesByCategory} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number" 
                      className="text-xs"
                      tickFormatter={(value) => `£${value}`}
                    />
                    <YAxis type="category" dataKey="category" className="text-xs" width={80} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Amount']}
                      labelClassName="font-medium"
                    />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {data.expensesByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No expense data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-team-performance">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            Team Performance
          </CardTitle>
          <CardDescription>Jobs completed and in progress by team member</CardDescription>
        </CardHeader>
        <CardContent>
          {data.teamPerformance.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Engineer</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-center">In Progress</TableHead>
                    <TableHead className="text-center">Total Jobs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.teamPerformance.map((member) => (
                    <TableRow key={member.id} data-testid={`row-engineer-${member.id}`}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 text-sm font-medium bg-green-100 text-green-700 rounded-full dark:bg-green-900 dark:text-green-300">
                          {member.completedJobs}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full dark:bg-blue-900 dark:text-blue-300">
                          {member.inProgressJobs}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{member.totalJobs}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No team members found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Loading business insights...</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
