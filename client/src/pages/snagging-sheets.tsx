import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, AlertTriangle, Calendar, MapPin, Eye } from "lucide-react";
import { format } from "date-fns";
import type { SnaggingSheet } from "@shared/schema";

const statusColors: Record<string, string> = {
  open: "bg-orange-100 text-orange-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  signed_off: "bg-purple-100 text-purple-800",
};

export default function SnaggingSheets() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: sheets = [], isLoading } = useQuery<SnaggingSheet[]>({
    queryKey: ["/api/snagging"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snagging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          siteAddress: "New Site",
          status: "open",
        }),
      });
      if (!res.ok) throw new Error("Failed to create snagging sheet");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/snagging"] });
      setLocation(`/snagging/${data.id}`);
    },
  });

  const filteredSheets = sheets.filter((sheet) => {
    const matchesSearch = 
      sheet.siteAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sheet.sheetNo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || sheet.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getProgressPercent = (sheet: SnaggingSheet) => {
    if (!sheet.totalSnags || sheet.totalSnags === 0) return 0;
    return Math.round(((sheet.resolvedSnags || 0) / sheet.totalSnags) * 100);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Snagging Sheets</h1>
          <p className="text-muted-foreground">Track and resolve site defects and punch list items</p>
        </div>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          data-testid="button-create-snagging"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Snagging Sheet
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            All Snagging Sheets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by address or number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-snagging"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="signed_off">Signed Off</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredSheets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No snagging sheets found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sheet No</TableHead>
                    <TableHead>Site Address</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSheets.map((sheet) => (
                    <TableRow key={sheet.id} data-testid={`row-snagging-${sheet.id}`}>
                      <TableCell className="font-medium">{sheet.sheetNo}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{sheet.siteAddress}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[150px]">
                          <Progress value={getProgressPercent(sheet)} className="h-2 flex-1" />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {sheet.resolvedSnags || 0}/{sheet.totalSnags || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {sheet.createdAt
                            ? format(new Date(sheet.createdAt), "dd MMM yyyy")
                            : "Not set"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[sheet.status] || "bg-gray-100"}>
                          {sheet.status?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/snagging/${sheet.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-snagging-${sheet.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
