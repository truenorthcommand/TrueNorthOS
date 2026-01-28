import { jsPDF } from "jspdf";
import type { FormField, FormSubmission, FormTemplateVersion } from "@shared/schema";

interface VersionSchema {
  fields?: FormField[];
}

interface PdfOptions {
  templateName: string;
  version: FormTemplateVersion;
  submission: FormSubmission;
  submittedBy?: string;
  entityInfo?: { type: string; name?: string };
}

export async function generateFormPdf(options: PdfOptions): Promise<Buffer> {
  const { templateName, version, submission, submittedBy, entityInfo } = options;
  const versionSchema = (version.schema || {}) as VersionSchema;
  const fields = (versionSchema.fields || []) as FormField[];
  const data = (submission.data || {}) as Record<string, any>;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let y = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(templateName, pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Submitted: ${new Date(submission.submittedAt || submission.createdAt || new Date()).toLocaleString("en-GB")}`, pageWidth / 2, y, { align: "center" });
  y += 6;

  if (submittedBy) {
    doc.text(`By: ${submittedBy}`, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  if (entityInfo) {
    doc.text(`${entityInfo.type}: ${entityInfo.name || "Unknown"}`, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  doc.setTextColor(0);
  y += 5;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  for (const field of fields) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    const value = data[field.key];
    
    const fieldType = field.type as string;
    if (fieldType === "header" || fieldType === "section") {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(field.label, margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      continue;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(field.label + (field.required ? " *" : ""), margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    
    let displayValue = "";
    if (value === undefined || value === null || value === "") {
      displayValue = "—";
    } else if (field.type === "checkbox") {
      displayValue = value ? "Yes" : "No";
    } else if (fieldType === "select" || fieldType === "radio") {
      const opt = field.options?.find(o => o.value === value);
      displayValue = opt?.label || String(value);
    } else if (field.type === "photo" || field.type === "signature") {
      displayValue = value ? "[Attached]" : "—";
    } else if (field.type === "calculated") {
      displayValue = value !== undefined ? String(value) : "—";
    } else if (Array.isArray(value)) {
      displayValue = value.map(v => {
        if (typeof v === "object" && v.label) return v.label;
        return String(v);
      }).join(", ");
    } else if (typeof value === "object") {
      displayValue = JSON.stringify(value);
    } else {
      displayValue = String(value);
    }

    const lines = doc.splitTextToSize(displayValue, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 8;
  }

  y += 10;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Form ID: ${submission.id} | Version: ${version.version}`, margin, 290);

  const pdfOutput = doc.output("arraybuffer");
  return Buffer.from(pdfOutput);
}
