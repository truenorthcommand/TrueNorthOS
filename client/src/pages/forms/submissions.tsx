import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Search, Eye, Download, Plus, ClipboardList } from "lucide-react";
import type { FormSchemaDefinition } from "@shared/schema";

interface FormSubmission {
  id: string;
  templateVersionId: string;
  entityType: string;
  entityId: string;
  submittedBy: string | null;
  status: string;
  data: Record<string, unknown>;
  createdAt: string;
  submittedAt: string | null;
}

interface PublishedTemplate {
  id: string;
  name: string;
  type: string;
  latestVersion: {
    id: string;
    version: number;
    schema: FormSchemaDefinition;
  };
}

const statusColors: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  submitted: "bg-emerald-100 text-emerald-800",
};

const entityTypeLabels: Record<string, string> = {
  job: "Job",
  client: "Client",
  quote: "Quote",
};

export default function FormSubmissions() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [isNewFormOpen, setIsNewFormOpen] = useState(false);

  const { data: submissions = [], isLoading } = useQuery<FormSubmission[]>({
    queryKey: ["/api/forms/submissions"],
  });

  const { data: publishedTemplates = [] } = useQuery<PublishedTemplate[]>({
    queryKey: ["/api/forms/published-templates"],
  });

  const { data: version } = useQuery({
    queryKey: ["/api/forms/versions", selectedSubmission?.templateVersionId, "schema"],
    queryFn: async () => {
      const res = await fetch(`/api/forms/versions/${selectedSubmission?.templateVersionId}/schema`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch schema");
      return res.json() as Promise<FormSchemaDefinition>;
    },
    enabled: !!selectedSubmission?.templateVersionId,
  });

  const filteredSubmissions = submissions.filter((sub) => {
    const matchesSearch = sub.entityId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    const matchesType = entityTypeFilter === "all" || sub.entityType === entityTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleStartForm = (template: PublishedTemplate) => {
    setIsNewFormOpen(false);
    setLocation(`/forms/fill/${template.latestVersion.id}?entityType=job&entityId=`);
  };

  const generatePDF = async (submission: FormSubmission) => {
    const schemaRes = await fetch(`/api/forms/versions/${submission.templateVersionId}/schema`, { credentials: "include" });
    if (!schemaRes.ok) return;
    const schema = await schemaRes.json() as FormSchemaDefinition;
    if (!schema) return;

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    let y = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("PRO MAIN", 20, y);
    y += 10;

    doc.setFontSize(14);
    doc.text(schema.name, 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Submitted: ${submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "Draft"}`, 20, y);
    y += 6;
    doc.text(`Entity: ${entityTypeLabels[submission.entityType]} - ${submission.entityId}`, 20, y);
    y += 15;

    schema.fields.forEach((field) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(field.label, 20, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const value = submission.data[field.key];
      let displayValue = "";

      if (value === undefined || value === null || value === "") {
        displayValue = "—";
      } else if (field.type === "photo") {
        displayValue = `${(value as string[]).length} photo(s)`;
      } else if (field.type === "signature") {
        displayValue = value ? "[Signature captured]" : "—";
      } else if (Array.isArray(value)) {
        displayValue = value.join(", ");
      } else if (typeof value === "boolean") {
        displayValue = value ? "Yes" : "No";
      } else {
        displayValue = String(value);
      }

      const lines = doc.splitTextToSize(displayValue, 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 8;
    });

    doc.save(`form-${submission.id.slice(0, 8)}.pdf`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Form Submissions</h1>
          <p className="text-slate-500 mt-1">View and manage submitted forms</p>
        </div>
        <Dialog open={isNewFormOpen} onOpenChange={setIsNewFormOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-form">
              <Plus className="h-4 w-4 mr-2" />
              Fill New Form
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Form Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {publishedTemplates.length === 0 ? (
                <p className="text-center text-slate-500 py-4">No published templates available</p>
              ) : (
                publishedTemplates.map((template) => (
                  <button
                    key={template.id}
                    className="w-full p-4 text-left border rounded-lg hover:bg-slate-50 transition-colors"
                    onClick={() => handleStartForm(template)}
                    data-testid={`button-select-template-${template.id}`}
                  >
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-slate-500">Version {template.latestVersion.version}</p>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by entity ID..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-submissions"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-entity-filter">
            <SelectValue placeholder="Entity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="job">Job</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="quote">Quote</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No submissions found</h3>
            <p className="text-slate-500 mt-1">
              {submissions.length === 0 ? "Fill out a form to see submissions here" : "Try adjusting your filters"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((submission) => (
            <Card key={submission.id} className="hover:shadow-md transition-shadow" data-testid={`card-submission-${submission.id}`}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="font-medium">{entityTypeLabels[submission.entityType]} Form</span>
                    <Badge className={statusColors[submission.status]}>
                      {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    Entity: {submission.entityId.slice(0, 8)}... •{" "}
                    {submission.submittedAt
                      ? `Submitted ${new Date(submission.submittedAt).toLocaleDateString()}`
                      : `Created ${new Date(submission.createdAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSubmission(submission)}
                    data-testid={`button-view-${submission.id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  {submission.status === "submitted" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSubmission(submission);
                        setTimeout(() => generatePDF(submission), 100);
                      }}
                      data-testid={`button-pdf-${submission.id}`}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  )}
                  {submission.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => setLocation(`/forms/fill/${submission.templateVersionId}?entityType=${submission.entityType}&entityId=${submission.entityId}&submissionId=${submission.id}`)}
                      data-testid={`button-continue-${submission.id}`}
                    >
                      Continue
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {version?.name || "Form Submission"}
              <Badge className={`ml-2 ${statusColors[selectedSubmission?.status || "draft"]}`}>
                {selectedSubmission?.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedSubmission && version && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Entity Type:</span>
                  <span className="ml-2 font-medium">{entityTypeLabels[selectedSubmission.entityType]}</span>
                </div>
                <div>
                  <span className="text-slate-500">Entity ID:</span>
                  <span className="ml-2 font-medium">{selectedSubmission.entityId.slice(0, 12)}...</span>
                </div>
                {selectedSubmission.submittedAt && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Submitted:</span>
                    <span className="ml-2 font-medium">{new Date(selectedSubmission.submittedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
              <hr />
              {version.fields.map((field) => {
                const value = selectedSubmission.data[field.key];
                let displayValue: React.ReactNode = "—";

                if (value !== undefined && value !== null && value !== "") {
                  if (field.type === "photo") {
                    displayValue = (
                      <div className="flex flex-wrap gap-2">
                        {(value as string[]).map((photo, i) => (
                          <img key={i} src={photo} alt="" className="w-20 h-20 object-cover rounded" />
                        ))}
                      </div>
                    );
                  } else if (field.type === "signature") {
                    displayValue = <img src={value as string} alt="Signature" className="h-16" />;
                  } else if (Array.isArray(value)) {
                    displayValue = value.join(", ");
                  } else if (typeof value === "boolean") {
                    displayValue = value ? "Yes" : "No";
                  } else {
                    displayValue = String(value);
                  }
                }

                return (
                  <div key={field.key} className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">{field.label}</p>
                    <div className="text-sm text-slate-900">{displayValue}</div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
