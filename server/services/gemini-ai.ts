import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

interface ReceiptData {
  vendorName: string | null;
  vendorAddress: string | null;
  receiptDate: string | null;
  receiptNumber: string | null;
  items: { description: string; quantity: number; price: number }[];
  subtotal: number | null;
  vatAmount: number | null;
  total: number | null;
  paymentMethod: string | null;
  currency: string;
  suggestedCategory: string | null;
}

interface SitePhotoAnalysis {
  issuesFound: { issue: string; severity: "low" | "medium" | "high"; location: string }[];
  overallCondition: string;
  suggestedActions: string[];
  description: string;
  safetyNotes: string[];
}

interface JobSummary {
  summary: string;
  workCompleted: string[];
  materialsUsed: string[];
  recommendations: string[];
  timeSpent: string | null;
}

interface QuoteDescription {
  title: string;
  description: string;
  scopeOfWork: string[];
  estimatedDuration: string;
  termsAndConditions: string[];
}

interface CustomerMessage {
  subject: string;
  body: string;
  tone: "formal" | "friendly" | "urgent";
}

interface InspectionReport {
  title: string;
  summary: string;
  findings: { item: string; status: "pass" | "fail" | "na"; notes: string }[];
  overallResult: "pass" | "fail" | "conditional";
  recommendations: string[];
  nextInspectionDate: string | null;
}

interface VoiceTranscription {
  text: string;
  summary: string;
  actionItems: string[];
  keyPoints: string[];
}

export async function scanReceipt(imageBase64: string): Promise<ReceiptData> {
  const prompt = `You are an expert receipt scanner for UK businesses. Analyze this receipt image and extract all details.

Return a JSON object with:
- vendorName: Shop/vendor name
- vendorAddress: Address if visible
- receiptDate: Date in DD/MM/YYYY format
- receiptNumber: Receipt number if visible
- items: Array of {description, quantity, price} for each line item
- subtotal: Amount before VAT (as number)
- vatAmount: VAT amount if shown (as number)
- total: Total amount (as number)
- paymentMethod: How it was paid (cash, card, etc.)
- currency: Currency code (default "GBP")
- suggestedCategory: Suggest expense category (mileage, materials, tools, fuel, subsistence, other)

Return ONLY valid JSON. Use null for fields not found.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: imageBase64.replace(/^data:image\/\w+;base64,/, "") } }
        ]
      }
    ],
  });

  const text = response.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse receipt data");
  
  return JSON.parse(jsonMatch[0]);
}

export async function analyzeSitePhoto(imageBase64: string, jobContext?: string): Promise<SitePhotoAnalysis> {
  const context = jobContext ? `Job context: ${jobContext}\n\n` : "";
  const prompt = `${context}You are an expert UK trade inspector analyzing a job site photo. Identify any issues, assess condition, and provide recommendations.

Return a JSON object with:
- issuesFound: Array of {issue: description, severity: "low"|"medium"|"high", location: where in image}
- overallCondition: Brief assessment (e.g., "Good condition, minor wear visible")
- suggestedActions: Array of recommended actions
- description: Professional description suitable for a report
- safetyNotes: Array of any safety concerns observed

Consider UK building standards, Gas Safe regulations, and BS 7671 where applicable.
Return ONLY valid JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: imageBase64.replace(/^data:image\/\w+;base64,/, "") } }
        ]
      }
    ],
  });

  const text = response.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to analyze site photo");
  
  return JSON.parse(jsonMatch[0]);
}

export async function generateJobSummary(engineerNotes: string, jobDetails: any): Promise<JobSummary> {
  const prompt = `You are a professional UK field service report writer. Create a clear, professional summary from these engineer notes and job details.

Job Details:
- Title: ${jobDetails.title || "Not specified"}
- Type: ${jobDetails.type || "Not specified"}
- Client: ${jobDetails.clientName || "Not specified"}
- Address: ${jobDetails.address || "Not specified"}

Engineer Notes:
${engineerNotes}

Return a JSON object with:
- summary: Professional paragraph summarizing the work (2-3 sentences)
- workCompleted: Array of specific tasks completed
- materialsUsed: Array of materials/parts used (if mentioned)
- recommendations: Array of any follow-up recommendations
- timeSpent: Estimated time if mentioned (e.g., "2 hours")

Use UK English spelling. Be professional but concise.
Return ONLY valid JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to generate job summary");
  
  return JSON.parse(jsonMatch[0]);
}

export async function generateQuoteDescription(jobDetails: any, services: string[]): Promise<QuoteDescription> {
  const prompt = `You are a UK trade business quote writer. Create professional quote content for a potential customer.

Job Details:
- Type: ${jobDetails.type || "General works"}
- Client: ${jobDetails.clientName || "Customer"}
- Address: ${jobDetails.address || "Not specified"}
- Requirements: ${jobDetails.requirements || "As discussed"}

Services to include:
${services.map(s => `- ${s}`).join("\n")}

Return a JSON object with:
- title: Professional quote title
- description: Detailed description of proposed work (2-3 paragraphs)
- scopeOfWork: Array of specific items included
- estimatedDuration: Estimated time to complete
- termsAndConditions: Array of standard terms

Use UK English. Be professional and reassuring. Mention relevant standards/regulations where appropriate.
Return ONLY valid JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to generate quote description");
  
  return JSON.parse(jsonMatch[0]);
}

export async function generateCustomerMessage(
  messageType: "appointment_confirmation" | "job_complete" | "follow_up" | "quote_sent" | "invoice_reminder",
  customerName: string,
  details: any
): Promise<CustomerMessage> {
  const templates: Record<string, string> = {
    appointment_confirmation: `Customer: ${customerName}\nJob Date: ${details.date}\nTime: ${details.time}\nAddress: ${details.address}\nService: ${details.service}`,
    job_complete: `Customer: ${customerName}\nJob: ${details.jobTitle}\nCompleted: ${details.completedDate}\nEngineer: ${details.engineer}`,
    follow_up: `Customer: ${customerName}\nLast Job: ${details.lastJob}\nDate: ${details.date}\nService: ${details.service}`,
    quote_sent: `Customer: ${customerName}\nQuote Ref: ${details.quoteRef}\nAmount: £${details.amount}\nValid Until: ${details.validUntil}`,
    invoice_reminder: `Customer: ${customerName}\nInvoice: ${details.invoiceNumber}\nAmount: £${details.amount}\nDue Date: ${details.dueDate}`,
  };

  const prompt = `You are a professional UK trade business communicator. Write a ${messageType.replace(/_/g, " ")} message.

Context:
${templates[messageType]}

Return a JSON object with:
- subject: Email subject line
- body: Email body (professional, friendly, UK English)
- tone: "formal" | "friendly" | "urgent"

Keep it concise but complete. Include a call to action where appropriate.
Return ONLY valid JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to generate customer message");
  
  return JSON.parse(jsonMatch[0]);
}

export async function generateInspectionReport(checklistData: any[], inspectionType: string): Promise<InspectionReport> {
  const prompt = `You are a UK trade inspection report writer. Create a professional inspection report from this checklist data.

Inspection Type: ${inspectionType}
Checklist Items:
${checklistData.map((item, i) => `${i + 1}. ${item.item}: ${item.result} ${item.notes ? `(${item.notes})` : ""}`).join("\n")}

Return a JSON object with:
- title: Professional report title
- summary: Executive summary paragraph
- findings: Array of {item, status: "pass"|"fail"|"na", notes}
- overallResult: "pass" | "fail" | "conditional"
- recommendations: Array of recommended actions
- nextInspectionDate: Suggested next inspection if applicable (DD/MM/YYYY format)

Reference UK standards where appropriate (Gas Safe, BS 7671, Part P, etc).
Return ONLY valid JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to generate inspection report");
  
  return JSON.parse(jsonMatch[0]);
}

export async function transcribeVoiceNote(audioBase64: string, mimeType: string = "audio/webm"): Promise<VoiceTranscription> {
  const prompt = `Transcribe this audio recording from a UK field service engineer. Extract the spoken content and organize it.

Return a JSON object with:
- text: Full transcription of the audio
- summary: Brief summary in 1-2 sentences
- actionItems: Array of any action items or tasks mentioned
- keyPoints: Array of key points or important details

Use UK English spelling. Preserve any technical terms accurately.
Return ONLY valid JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: audioBase64.replace(/^data:audio\/\w+;base64,/, "") } }
        ]
      }
    ],
  });

  const text = response.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to transcribe voice note");
  
  return JSON.parse(jsonMatch[0]);
}

export async function generateImage(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: any) => part.inlineData
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  const mimeType = imagePart.inlineData.mimeType || "image/png";
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}
