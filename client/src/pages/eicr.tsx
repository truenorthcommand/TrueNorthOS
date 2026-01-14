import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, Trash2, Download, Save, Zap, ChevronDown, ChevronRight, 
  CalendarIcon, Search, Edit, Loader2, FileText, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import type { 
  EicrReport, 
  EicrReportWithDetails, 
  DistributionBoard, 
  EicrCircuit, 
  EicrObservation 
} from "@shared/schema";

const getOutcomeBadge = (outcome: string | null) => {
  if (outcome === "SATISFACTORY") {
    return <Badge className="bg-green-500 hover:bg-green-600" data-testid="badge-outcome-satisfactory">Satisfactory</Badge>;
  }
  if (outcome === "UNSATISFACTORY") {
    return <Badge variant="destructive" data-testid="badge-outcome-unsatisfactory">Unsatisfactory</Badge>;
  }
  return <Badge variant="outline" data-testid="badge-outcome-pending">Pending</Badge>;
};

const getObservationCodeColor = (code: string) => {
  switch (code) {
    case "C1":
      return "bg-red-100 border-red-500 text-red-800";
    case "C2":
      return "bg-amber-100 border-amber-500 text-amber-800";
    case "C3":
      return "bg-yellow-100 border-yellow-500 text-yellow-800";
    case "FI":
      return "bg-blue-100 border-blue-500 text-blue-800";
    default:
      return "bg-gray-100 border-gray-500 text-gray-800";
  }
};

const defaultReport = {
  reference: "",
  clientName: "",
  clientAddress: "",
  installationAddress: "",
  installationPostcode: "",
  occupierName: "",
  occupierPhone: "",
  maxDemand: "",
  supplyType: "",
  zeValue: undefined as number | undefined,
  inspectorName: "",
  inspectorRegistration: "",
  inspectionDate: undefined as Date | undefined,
  nextInspectionDate: undefined as Date | undefined,
  outcome: "" as "SATISFACTORY" | "UNSATISFACTORY" | "",
};

const defaultBoard: Omit<DistributionBoard, "id" | "reportId" | "createdAt"> = {
  dbRef: "",
  location: "",
  designation: null,
  supplyType: null,
  earthingArrangement: null,
  mainSwitchRating: null,
  mainSwitchBs: null,
  rcdProtected: false,
  rcdType: null,
  rcdRating: null,
  sortOrder: 0,
};

const defaultCircuit: Omit<EicrCircuit, "id" | "boardId" | "createdAt"> = {
  circuitRef: "",
  description: "",
  breakerType: "MCB",
  breakerRating: null,
  curve: null,
  rcdProtected: false,
  rcdType: null,
  rcdIdeltaMa: null,
  rcdTripTime: null,
  lineMm2: null,
  cpcMm2: null,
  r1PlusR2: null,
  zs: null,
  maxZs: null,
  irLn: null,
  irLe: null,
  irNe: null,
  polarityOk: true,
  limitationCode: null,
  remarks: null,
  sortOrder: 0,
};

const defaultObservation: Omit<EicrObservation, "id" | "reportId" | "createdAt"> = {
  code: "C3",
  location: null,
  circuitRef: null,
  item: null,
  description: "",
  recommendation: null,
  sortOrder: 0,
};

export default function EICRPage() {
  const queryClient = useQueryClient();
  const signatureRef = useRef<SignatureCanvas>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReport, setSelectedReport] = useState<EicrReportWithDetails | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("client");

  const [newReport, setNewReport] = useState({ ...defaultReport });
  const [editingReport, setEditingReport] = useState({ ...defaultReport });

  const { data: reports = [], isLoading } = useQuery<EicrReport[]>({
    queryKey: ["/api/eicr/reports"],
  });

  const { data: reportDetails, isLoading: detailsLoading } = useQuery<EicrReportWithDetails>({
    queryKey: ["/api/eicr/reports", selectedReport?.id],
    enabled: !!selectedReport?.id,
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: typeof newReport) => {
      const res = await apiRequest("POST", "/api/eicr/reports", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports"] });
      setCreateDialogOpen(false);
      setNewReport({ ...defaultReport });
      toast.success("EICR Report created successfully");
      setSelectedReport(data);
      setDetailDialogOpen(true);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create report");
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof editingReport> }) => {
      const res = await apiRequest("PATCH", `/api/eicr/reports/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports", selectedReport?.id] });
      toast.success("Report updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update report");
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/eicr/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports"] });
      setDetailDialogOpen(false);
      setSelectedReport(null);
      toast.success("Report deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete report");
    },
  });

  const createBoardMutation = useMutation({
    mutationFn: async ({ reportId, data }: { reportId: string; data: typeof defaultBoard }) => {
      const res = await apiRequest("POST", `/api/eicr/reports/${reportId}/boards`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports", selectedReport?.id] });
      toast.success("Distribution board added");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add board");
    },
  });

  const updateBoardMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DistributionBoard> }) => {
      const res = await apiRequest("PATCH", `/api/eicr/boards/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports", selectedReport?.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update board");
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/eicr/boards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports", selectedReport?.id] });
      toast.success("Board deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete board");
    },
  });

  const createCircuitMutation = useMutation({
    mutationFn: async ({ boardId, data }: { boardId: string; data: typeof defaultCircuit }) => {
      const res = await apiRequest("POST", `/api/eicr/boards/${boardId}/circuits`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports", selectedReport?.id] });
      toast.success("Circuit added");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add circuit");
    },
  });

  const updateCircuitMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EicrCircuit> }) => {
      const res = await apiRequest("PATCH", `/api/eicr/circuits/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports", selectedReport?.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update circuit");
    },
  });

  const deleteCircuitMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/eicr/circuits/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports", selectedReport?.id] });
      toast.success("Circuit deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete circuit");
    },
  });

  const createObservationMutation = useMutation({
    mutationFn: async ({ reportId, data }: { reportId: string; data: typeof defaultObservation }) => {
      const res = await apiRequest("POST", `/api/eicr/reports/${reportId}/observations`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports", selectedReport?.id] });
      toast.success("Observation added");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add observation");
    },
  });

  const updateObservationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EicrObservation> }) => {
      const res = await apiRequest("PATCH", `/api/eicr/observations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports", selectedReport?.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update observation");
    },
  });

  const deleteObservationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/eicr/observations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eicr/reports", selectedReport?.id] });
      toast.success("Observation deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete observation");
    },
  });

  const handleDownloadPDF = async (reportId: string) => {
    try {
      const res = await fetch(`/api/eicr/reports/${reportId}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `EICR-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to download PDF");
    }
  };

  const openReportDetail = (report: EicrReport) => {
    setSelectedReport(report as EicrReportWithDetails);
    setEditingReport({
      reference: report.reference,
      clientName: report.clientName,
      clientAddress: report.clientAddress || "",
      installationAddress: report.installationAddress,
      installationPostcode: report.installationPostcode || "",
      occupierName: report.occupierName || "",
      occupierPhone: report.occupierPhone || "",
      maxDemand: report.maxDemand || "",
      supplyType: report.supplyType || "",
      zeValue: report.zeValue ?? undefined,
      inspectorName: report.inspectorName || "",
      inspectorRegistration: report.inspectorRegistration || "",
      inspectionDate: report.inspectionDate ? new Date(report.inspectionDate) : undefined,
      nextInspectionDate: report.nextInspectionDate ? new Date(report.nextInspectionDate) : undefined,
      outcome: (report.outcome as "SATISFACTORY" | "UNSATISFACTORY" | "") || "",
    });
    setDetailDialogOpen(true);
    setActiveTab("client");
  };

  const toggleBoardExpanded = (boardId: string) => {
    const newExpanded = new Set(expandedBoards);
    if (newExpanded.has(boardId)) {
      newExpanded.delete(boardId);
    } else {
      newExpanded.add(boardId);
    }
    setExpandedBoards(newExpanded);
  };

  const handleSaveReport = () => {
    if (!selectedReport?.id) return;
    const signatureData = signatureRef.current?.isEmpty() ? undefined : signatureRef.current?.toDataURL();
    updateReportMutation.mutate({
      id: selectedReport.id,
      data: {
        reference: editingReport.reference,
        clientName: editingReport.clientName,
        clientAddress: editingReport.clientAddress,
        installationAddress: editingReport.installationAddress,
        installationPostcode: editingReport.installationPostcode,
        occupierName: editingReport.occupierName,
        occupierPhone: editingReport.occupierPhone,
        maxDemand: editingReport.maxDemand,
        supplyType: editingReport.supplyType,
        zeValue: editingReport.zeValue,
        inspectorName: editingReport.inspectorName,
        inspectorRegistration: editingReport.inspectorRegistration,
        inspectionDate: editingReport.inspectionDate,
        nextInspectionDate: editingReport.nextInspectionDate,
        outcome: editingReport.outcome,
        ...(signatureData && { inspectorSignature: signatureData }),
      },
    });
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.installationAddress.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold">EICR Reports</h1>
            <p className="text-muted-foreground">Electrical Installation Condition Reports</p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-new-eicr">
          <Plus className="h-4 w-4 mr-2" />
          New EICR Report
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by reference, client, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-eicr"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No EICR reports found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Installation Address</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Inspection Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow
                    key={report.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openReportDetail(report)}
                    data-testid={`row-eicr-${report.id}`}
                  >
                    <TableCell className="font-medium">{report.reference}</TableCell>
                    <TableCell>{report.clientName}</TableCell>
                    <TableCell>{report.installationAddress}</TableCell>
                    <TableCell>{getOutcomeBadge(report.outcome)}</TableCell>
                    <TableCell>
                      {report.inspectionDate
                        ? format(new Date(report.inspectionDate), "dd MMM yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPDF(report.id);
                        }}
                        data-testid={`button-download-pdf-${report.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              New EICR Report
            </DialogTitle>
            <DialogDescription>
              Create a new Electrical Installation Condition Report
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                value={newReport.clientName}
                onChange={(e) => setNewReport({ ...newReport, clientName: e.target.value })}
                placeholder="Client name"
                data-testid="input-new-clientName"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installationAddress">Installation Address *</Label>
              <Input
                id="installationAddress"
                value={newReport.installationAddress}
                onChange={(e) => setNewReport({ ...newReport, installationAddress: e.target.value })}
                placeholder="Full installation address"
                data-testid="input-new-installationAddress"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="installationPostcode">Postcode</Label>
                <Input
                  id="installationPostcode"
                  value={newReport.installationPostcode}
                  onChange={(e) => setNewReport({ ...newReport, installationPostcode: e.target.value })}
                  placeholder="AB1 2CD"
                  data-testid="input-new-installationPostcode"
                />
              </div>
              <div className="space-y-2">
                <Label>Inspection Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newReport.inspectionDate
                        ? format(newReport.inspectionDate, "PPP")
                        : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={newReport.inspectionDate}
                      onSelect={(date) => setNewReport({ ...newReport, inspectionDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createReportMutation.mutate(newReport)}
              disabled={!newReport.clientName || !newReport.installationAddress || createReportMutation.isPending}
              data-testid="button-create-eicr"
            >
              {createReportMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              EICR Report: {selectedReport?.reference}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="client">A. Client Details</TabsTrigger>
              <TabsTrigger value="supply">B. Supply Details</TabsTrigger>
              <TabsTrigger value="boards">C. Distribution Boards</TabsTrigger>
              <TabsTrigger value="observations">D. Observations</TabsTrigger>
              <TabsTrigger value="declaration">E. Declaration</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="client" className="m-0 p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Client Name</Label>
                    <Input
                      value={editingReport.clientName}
                      onChange={(e) => setEditingReport({ ...editingReport, clientName: e.target.value })}
                      data-testid="input-edit-clientName"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Address</Label>
                    <Input
                      value={editingReport.clientAddress}
                      onChange={(e) => setEditingReport({ ...editingReport, clientAddress: e.target.value })}
                      data-testid="input-edit-clientAddress"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Installation Address</Label>
                    <Input
                      value={editingReport.installationAddress}
                      onChange={(e) => setEditingReport({ ...editingReport, installationAddress: e.target.value })}
                      data-testid="input-edit-installationAddress"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Installation Postcode</Label>
                    <Input
                      value={editingReport.installationPostcode}
                      onChange={(e) => setEditingReport({ ...editingReport, installationPostcode: e.target.value })}
                      data-testid="input-edit-installationPostcode"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Occupier Name</Label>
                    <Input
                      value={editingReport.occupierName}
                      onChange={(e) => setEditingReport({ ...editingReport, occupierName: e.target.value })}
                      data-testid="input-edit-occupierName"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Occupier Phone</Label>
                    <Input
                      value={editingReport.occupierPhone}
                      onChange={(e) => setEditingReport({ ...editingReport, occupierPhone: e.target.value })}
                      data-testid="input-edit-occupierPhone"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="supply" className="m-0 p-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Max Demand (A)</Label>
                    <Input
                      value={editingReport.maxDemand}
                      onChange={(e) => setEditingReport({ ...editingReport, maxDemand: e.target.value })}
                      placeholder="e.g., 100A"
                      data-testid="input-edit-maxDemand"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Supply Type</Label>
                    <Select
                      value={editingReport.supplyType}
                      onValueChange={(value) => setEditingReport({ ...editingReport, supplyType: value })}
                    >
                      <SelectTrigger data-testid="select-edit-supplyType">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TN-C-S">TN-C-S</SelectItem>
                        <SelectItem value="TN-S">TN-S</SelectItem>
                        <SelectItem value="TT">TT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ze Value (Ω)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingReport.zeValue ?? ""}
                      onChange={(e) => setEditingReport({ ...editingReport, zeValue: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="e.g., 0.35"
                      data-testid="input-edit-zeValue"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="boards" className="m-0 p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Distribution Boards</h3>
                  <Button
                    onClick={() => {
                      if (selectedReport?.id) {
                        createBoardMutation.mutate({
                          reportId: selectedReport.id,
                          data: {
                            ...defaultBoard,
                            dbRef: `DB${(reportDetails?.boards?.length || 0) + 1}`,
                            location: "Main Location",
                          },
                        });
                      }
                    }}
                    disabled={createBoardMutation.isPending}
                    data-testid="button-add-board"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Board
                  </Button>
                </div>

                {detailsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : !reportDetails?.boards?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No distribution boards added yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reportDetails.boards.map((board) => (
                      <Collapsible
                        key={board.id}
                        open={expandedBoards.has(board.id)}
                        onOpenChange={() => toggleBoardExpanded(board.id)}
                      >
                        <Card>
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="p-0 h-auto hover:bg-transparent">
                                  {expandedBoards.has(board.id) ? (
                                    <ChevronDown className="h-5 w-5 mr-2" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5 mr-2" />
                                  )}
                                  <span className="font-semibold">{board.dbRef}</span>
                                  <span className="text-muted-foreground ml-2">- {board.location}</span>
                                  {board.designation && (
                                    <span className="text-muted-foreground ml-2">({board.designation})</span>
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  {board.mainSwitchRating}A Main Switch
                                </span>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteBoardMutation.mutate(board.id)}
                                  data-testid={`button-delete-board-${board.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent className="pt-0 space-y-4">
                              <div className="grid grid-cols-4 gap-4">
                                <div className="space-y-2">
                                  <Label>DB Reference</Label>
                                  <Input
                                    value={board.dbRef}
                                    onChange={(e) => updateBoardMutation.mutate({ id: board.id, data: { dbRef: e.target.value } })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Location</Label>
                                  <Input
                                    value={board.location}
                                    onChange={(e) => updateBoardMutation.mutate({ id: board.id, data: { location: e.target.value } })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Designation</Label>
                                  <Input
                                    value={board.designation || ""}
                                    onChange={(e) => updateBoardMutation.mutate({ id: board.id, data: { designation: e.target.value } })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Main Switch Rating (A)</Label>
                                  <Input
                                    type="number"
                                    value={board.mainSwitchRating || ""}
                                    onChange={(e) => updateBoardMutation.mutate({ id: board.id, data: { mainSwitchRating: e.target.value ? parseInt(e.target.value) : undefined } })}
                                  />
                                </div>
                              </div>

                              <div className="border-t pt-4">
                                <div className="flex justify-between items-center mb-4">
                                  <h4 className="font-semibold">Circuit Schedule</h4>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      createCircuitMutation.mutate({
                                        boardId: board.id,
                                        data: {
                                          ...defaultCircuit,
                                          circuitRef: `${(board.circuits?.length || 0) + 1}`,
                                          description: "New Circuit",
                                        },
                                      });
                                    }}
                                    data-testid={`button-add-circuit-${board.id}`}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Circuit
                                  </Button>
                                </div>

                                {!board.circuits?.length ? (
                                  <p className="text-muted-foreground text-center py-4">No circuits added</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="w-16">Cct</TableHead>
                                          <TableHead>Description</TableHead>
                                          <TableHead className="w-24">Type</TableHead>
                                          <TableHead className="w-16">Rating</TableHead>
                                          <TableHead className="w-16">Curve</TableHead>
                                          <TableHead className="w-16">RCD</TableHead>
                                          <TableHead className="w-20">RCD Type</TableHead>
                                          <TableHead className="w-20">RCD mA</TableHead>
                                          <TableHead className="w-20">Trip (ms)</TableHead>
                                          <TableHead className="w-20">Line mm²</TableHead>
                                          <TableHead className="w-20">CPC mm²</TableHead>
                                          <TableHead className="w-20">R1+R2</TableHead>
                                          <TableHead className="w-16">Zs</TableHead>
                                          <TableHead className="w-20">Max Zs</TableHead>
                                          <TableHead className="w-20">IR L-N</TableHead>
                                          <TableHead className="w-20">IR L-E</TableHead>
                                          <TableHead className="w-20">IR N-E</TableHead>
                                          <TableHead className="w-16">Pol OK</TableHead>
                                          <TableHead>Remarks</TableHead>
                                          <TableHead className="w-12"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {board.circuits.map((circuit) => (
                                          <TableRow key={circuit.id}>
                                            <TableCell>
                                              <Input
                                                value={circuit.circuitRef}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { circuitRef: e.target.value } })}
                                                className="h-8 w-12"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                value={circuit.description}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { description: e.target.value } })}
                                                className="h-8 min-w-[100px]"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Select
                                                value={circuit.breakerType}
                                                onValueChange={(value) => updateCircuitMutation.mutate({ id: circuit.id, data: { breakerType: value } })}
                                              >
                                                <SelectTrigger className="h-8 w-20">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="MCB">MCB</SelectItem>
                                                  <SelectItem value="RCBO">RCBO</SelectItem>
                                                  <SelectItem value="FUSE">Fuse</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                value={circuit.breakerRating || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { breakerRating: e.target.value ? parseInt(e.target.value) : undefined } })}
                                                className="h-8 w-14"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Select
                                                value={circuit.curve || ""}
                                                onValueChange={(value) => updateCircuitMutation.mutate({ id: circuit.id, data: { curve: value } })}
                                              >
                                                <SelectTrigger className="h-8 w-14">
                                                  <SelectValue placeholder="-" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="B">B</SelectItem>
                                                  <SelectItem value="C">C</SelectItem>
                                                  <SelectItem value="D">D</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </TableCell>
                                            <TableCell>
                                              <Checkbox
                                                checked={circuit.rcdProtected || false}
                                                onCheckedChange={(checked) => updateCircuitMutation.mutate({ id: circuit.id, data: { rcdProtected: !!checked } })}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Select
                                                value={circuit.rcdType || ""}
                                                onValueChange={(value) => updateCircuitMutation.mutate({ id: circuit.id, data: { rcdType: value } })}
                                              >
                                                <SelectTrigger className="h-8 w-16">
                                                  <SelectValue placeholder="-" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="AC">AC</SelectItem>
                                                  <SelectItem value="A">A</SelectItem>
                                                  <SelectItem value="F">F</SelectItem>
                                                  <SelectItem value="B">B</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                value={circuit.rcdIdeltaMa || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { rcdIdeltaMa: e.target.value ? parseInt(e.target.value) : undefined } })}
                                                className="h-8 w-16"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                step="0.1"
                                                value={circuit.rcdTripTime || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { rcdTripTime: e.target.value ? parseFloat(e.target.value) : undefined } })}
                                                className="h-8 w-16"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                step="0.5"
                                                value={circuit.lineMm2 || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { lineMm2: e.target.value ? parseFloat(e.target.value) : undefined } })}
                                                className="h-8 w-16"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                step="0.5"
                                                value={circuit.cpcMm2 || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { cpcMm2: e.target.value ? parseFloat(e.target.value) : undefined } })}
                                                className="h-8 w-16"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={circuit.r1PlusR2 || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { r1PlusR2: e.target.value ? parseFloat(e.target.value) : undefined } })}
                                                className="h-8 w-16"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={circuit.zs || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { zs: e.target.value ? parseFloat(e.target.value) : undefined } })}
                                                className="h-8 w-14"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={circuit.maxZs || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { maxZs: e.target.value ? parseFloat(e.target.value) : undefined } })}
                                                className="h-8 w-16"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                step="0.1"
                                                value={circuit.irLn || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { irLn: e.target.value ? parseFloat(e.target.value) : undefined } })}
                                                className="h-8 w-16"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                step="0.1"
                                                value={circuit.irLe || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { irLe: e.target.value ? parseFloat(e.target.value) : undefined } })}
                                                className="h-8 w-16"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                step="0.1"
                                                value={circuit.irNe || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { irNe: e.target.value ? parseFloat(e.target.value) : undefined } })}
                                                className="h-8 w-16"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Checkbox
                                                checked={circuit.polarityOk || false}
                                                onCheckedChange={(checked) => updateCircuitMutation.mutate({ id: circuit.id, data: { polarityOk: !!checked } })}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                value={circuit.remarks || ""}
                                                onChange={(e) => updateCircuitMutation.mutate({ id: circuit.id, data: { remarks: e.target.value } })}
                                                className="h-8 min-w-[80px]"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteCircuitMutation.mutate(circuit.id)}
                                              >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="observations" className="m-0 p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Observations & Recommendations</h3>
                    <p className="text-sm text-muted-foreground">
                      Record any observations found during the inspection
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      if (selectedReport?.id) {
                        createObservationMutation.mutate({
                          reportId: selectedReport.id,
                          data: {
                            ...defaultObservation,
                            sortOrder: (reportDetails?.observations?.length || 0) + 1,
                          },
                        });
                      }
                    }}
                    disabled={createObservationMutation.isPending}
                    data-testid="button-add-observation"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Observation
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500"></div>
                    <span>C1 - Danger present</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-amber-500"></div>
                    <span>C2 - Potentially dangerous</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-400"></div>
                    <span>C3 - Improvement recommended</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-500"></div>
                    <span>FI - Further investigation</span>
                  </div>
                </div>

                {!reportDetails?.observations?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No observations recorded</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reportDetails.observations.map((observation) => (
                      <Card key={observation.id} className={`border-l-4 ${getObservationCodeColor(observation.code)}`}>
                        <CardContent className="py-4">
                          <div className="grid grid-cols-6 gap-4">
                            <div className="space-y-2">
                              <Label>Code</Label>
                              <Select
                                value={observation.code}
                                onValueChange={(value) => updateObservationMutation.mutate({ id: observation.id, data: { code: value } })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="C1">C1 - Danger present</SelectItem>
                                  <SelectItem value="C2">C2 - Potentially dangerous</SelectItem>
                                  <SelectItem value="C3">C3 - Improvement recommended</SelectItem>
                                  <SelectItem value="FI">FI - Further investigation</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Location</Label>
                              <Input
                                value={observation.location || ""}
                                onChange={(e) => updateObservationMutation.mutate({ id: observation.id, data: { location: e.target.value } })}
                                placeholder="e.g., Kitchen"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Circuit Ref</Label>
                              <Input
                                value={observation.circuitRef || ""}
                                onChange={(e) => updateObservationMutation.mutate({ id: observation.id, data: { circuitRef: e.target.value } })}
                                placeholder="e.g., 3"
                              />
                            </div>
                            <div className="col-span-2 space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                value={observation.description}
                                onChange={(e) => updateObservationMutation.mutate({ id: observation.id, data: { description: e.target.value } })}
                                placeholder="Describe the observation..."
                                rows={2}
                              />
                            </div>
                            <div className="flex items-end">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteObservationMutation.mutate(observation.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3">
                            <Label>Recommendation</Label>
                            <Input
                              value={observation.recommendation || ""}
                              onChange={(e) => updateObservationMutation.mutate({ id: observation.id, data: { recommendation: e.target.value } })}
                              placeholder="Recommended action..."
                              className="mt-1"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="declaration" className="m-0 p-4 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Inspector Name</Label>
                    <Input
                      value={editingReport.inspectorName}
                      onChange={(e) => setEditingReport({ ...editingReport, inspectorName: e.target.value })}
                      data-testid="input-edit-inspectorName"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Registration Number</Label>
                    <Input
                      value={editingReport.inspectorRegistration}
                      onChange={(e) => setEditingReport({ ...editingReport, inspectorRegistration: e.target.value })}
                      placeholder="e.g., NICEIC/ECA number"
                      data-testid="input-edit-inspectorRegistration"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Inspection Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editingReport.inspectionDate
                            ? format(editingReport.inspectionDate, "PPP")
                            : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={editingReport.inspectionDate}
                          onSelect={(date) => setEditingReport({ ...editingReport, inspectionDate: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Next Inspection Due</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editingReport.nextInspectionDate
                            ? format(editingReport.nextInspectionDate, "PPP")
                            : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={editingReport.nextInspectionDate}
                          onSelect={(date) => setEditingReport({ ...editingReport, nextInspectionDate: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Overall Outcome</Label>
                  <div className="flex gap-4">
                    <Button
                      variant={editingReport.outcome === "SATISFACTORY" ? "default" : "outline"}
                      className={editingReport.outcome === "SATISFACTORY" ? "bg-green-500 hover:bg-green-600" : ""}
                      onClick={() => setEditingReport({ ...editingReport, outcome: "SATISFACTORY" })}
                      data-testid="button-outcome-satisfactory"
                    >
                      Satisfactory
                    </Button>
                    <Button
                      variant={editingReport.outcome === "UNSATISFACTORY" ? "destructive" : "outline"}
                      onClick={() => setEditingReport({ ...editingReport, outcome: "UNSATISFACTORY" })}
                      data-testid="button-outcome-unsatisfactory"
                    >
                      Unsatisfactory
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Inspector Signature</Label>
                  <div className="border rounded-md p-2 bg-white">
                    <SignatureCanvas
                      ref={signatureRef}
                      penColor="black"
                      canvasProps={{
                        width: 500,
                        height: 150,
                        className: "w-full border rounded cursor-crosshair",
                      }}
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleClearSignature}>
                    Clear Signature
                  </Button>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="border-t pt-4">
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedReport?.id && confirm("Are you sure you want to delete this report?")) {
                  deleteReportMutation.mutate(selectedReport.id);
                }
              }}
              data-testid="button-delete-report"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Report
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => handleDownloadPDF(selectedReport?.id || "")}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              onClick={handleSaveReport}
              disabled={updateReportMutation.isPending}
              data-testid="button-save-report"
            >
              {updateReportMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
