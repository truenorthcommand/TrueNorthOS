import { GoogleGenAI, Modality } from "@google/genai";

// Lazy initialization to prevent startup crash when API key is missing
let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured. Please set AI_INTEGRATIONS_GEMINI_API_KEY environment variable.');
    }
    ai = new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
      },
    });
  }
  return ai;
}

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

// === Receipt Validation Types ===

interface VendorRule {
  vendorType: string;
  permittedCategories: string[];
  flaggedCategories: string[];
  notes?: string;
}

interface MaterialProfile {
  jobType: string;
  expectedMaterials: string[];
  commonConsumables: string[];
  notes?: string;
}

interface ValidatedLineItem {
  description: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number;
  status: "clean" | "flagged";
  flagReason: string | null;
  flagCategory: string | null;
}

interface ReceiptValidationResult {
  overallStatus: "clean" | "flagged";
  confidence: number;
  vendorType: string;
  summary: string;
  lineItems: ValidatedLineItem[];
}

function cleanupJsonResponse(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : text;
}

function buildConservativeResult(
  receiptData: ReceiptData,
  vendorType: string = "unknown"
): ReceiptValidationResult {
  return {
    overallStatus: "flagged",
    confidence: 0,
    vendorType,
    summary: "AI validation failed — all items conservatively flagged for manual review.",
    lineItems: (receiptData.items || []).map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
      status: "flagged" as const,
      flagReason: "Unable to validate automatically — requires manual review",
      flagCategory: "other",
    })),
  };
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

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
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
  } catch (error) {
    console.error('[gemini-ai.ts] scanReceipt failed:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to scan receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
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
  } catch (error) {
    console.error('[gemini-ai.ts] analyzeSitePhoto failed:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to analyze site photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to generate job summary");
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[gemini-ai.ts] generateJobSummary failed:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to generate job summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to generate quote description");
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[gemini-ai.ts] generateQuoteDescription failed:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to generate quote description: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to generate customer message");
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[gemini-ai.ts] generateCustomerMessage failed:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to generate customer message: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to generate inspection report");
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[gemini-ai.ts] generateInspectionReport failed:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to generate inspection report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
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
  } catch (error) {
    console.error('[gemini-ai.ts] transcribeVoiceNote failed:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to transcribe voice note: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateImage(prompt: string): Promise<string> {
  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
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
  } catch (error) {
    console.error('[gemini-ai.ts] generateImage failed:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// === Receipt Validation Functions ===

export async function validateGeneralReceipt(
  receiptData: ReceiptData,
  vendorRules: VendorRule[]
): Promise<ReceiptValidationResult> {
  const vendorRulesContext = vendorRules.length > 0
    ? `\n\nVendor Rules:\n${vendorRules.map((r) => `- Vendor type "${r.vendorType}": Permitted=[${r.permittedCategories.join(", ")}], Flagged=[${r.flaggedCategories.join(", ")}]${r.notes ? " Notes: " + r.notes : ""}`).join("\n")}`
    : "";

  const prompt = `You are a company credit card abuse prevention analyst for a UK trades business. Your job is to analyse receipt line items and flag suspicious purchases.

RECEIPT INFORMATION:
- Vendor: ${receiptData.vendorName || "Unknown"}
- Date: ${receiptData.receiptDate || "Unknown"}
- Total: ${receiptData.currency} ${receiptData.total ?? "Unknown"}
${vendorRulesContext}

LINE ITEMS TO ANALYSE:
${(receiptData.items || []).map((item, i) => `${i + 1}. "${item.description}" — Qty: ${item.quantity}, Price: ${item.price}`).join("\n")}

RULES — You MUST follow these strictly:
1. Identify the vendor type from the vendor name (petrol_station, builders_merchant, hardware_store, cleaning_supplier, general_retailer, or other).
2. For EACH line item, determine if it should be "clean" or "flagged".
3. ALWAYS FLAG these categories regardless of vendor:
   - Food and drinks (sandwiches, crisps, sweets, energy drinks, coffee, water bottles, meal deals, etc.)
   - Household items (cleaning products for home, air fresheners, bin bags for personal use, etc.)
   - Tobacco and alcohol (cigarettes, beer, wine, spirits, vapes, etc.)
   - Personal items (phone chargers, clothing, toiletries, sunglasses, etc.)
   - Electronics (headphones, speakers, USB drives, etc.)
   - ANY tools of ANY description (power tools, hand tools, drill bits, saw blades, spanners, screwdrivers, paintbrushes, rollers, tool kits, etc.)
4. Items that are CLEAN for general receipts:
   - Vehicle consumables at petrol stations (fuel, screenwash, AdBlue, oil)
   - Trade consumables that are NOT tools (WD-40, silicone sealant, adhesives, tape, fixings like screws/nails/bolts, cable ties, sandpaper)
   - PPE (gloves, safety glasses, masks, ear defenders, hi-vis)
   - Legitimate trade materials (timber, plasterboard, pipe, wire, fittings, paint, cement)
5. Use common-sense reasoning. For example:
   - "Monster Energy" or "Red Bull" at BP → flagged as food_drink
   - "Screenwash" at BP → clean (vehicle maintenance)
   - "DeWalt drill" at Toolstation → flagged as tools
   - "WD-40" at Toolstation → clean (consumable, NOT a tool)
   - "Paintbrush set" on a general receipt → flagged as tools
   - "Sandwich" → flagged as food_drink

RESPONSE FORMAT — Return ONLY a valid JSON object:
{
  "overallStatus": "clean" or "flagged" (flagged if ANY item is flagged),
  "confidence": 0.0 to 1.0,
  "vendorType": "identified vendor type",
  "summary": "Brief explanation of findings",
  "lineItems": [
    {
      "description": "original item description",
      "quantity": number,
      "unitPrice": number or null,
      "totalPrice": number,
      "status": "clean" or "flagged",
      "flagReason": "reason if flagged, null if clean",
      "flagCategory": "food_drink | household | tools | personal | tobacco_alcohol | electronics | other | null"
    }
  ]
}

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
      },
    });

    const text = response.text || "";
    const jsonStr = cleanupJsonResponse(text);
    const result: ReceiptValidationResult = JSON.parse(jsonStr);

    // Ensure overallStatus is consistent with line items
    const hasFlagged = result.lineItems.some((item) => item.status === "flagged");
    if (hasFlagged) {
      result.overallStatus = "flagged";
    }

    return result;
  } catch (error) {
    console.error("validateGeneralReceipt Gemini error:", error);
    return buildConservativeResult(receiptData, "unknown");
  }
}

export async function validateJobReceipt(
  receiptData: ReceiptData,
  jobDescription: string,
  jobType: string,
  materialProfile: MaterialProfile | null,
  vendorRules: VendorRule[]
): Promise<ReceiptValidationResult> {
  const vendorRulesContext = vendorRules.length > 0
    ? `\nVendor Rules:\n${vendorRules.map((r) => `- Vendor type "${r.vendorType}": Permitted=[${r.permittedCategories.join(", ")}], Flagged=[${r.flaggedCategories.join(", ")}]${r.notes ? " Notes: " + r.notes : ""}`).join("\n")}`
    : "";

  const materialContext = materialProfile
    ? `\nMATERIAL PROFILE FOR "${materialProfile.jobType}":\n- Expected materials: ${materialProfile.expectedMaterials.join(", ")}\n- Common consumables: ${materialProfile.commonConsumables.join(", ")}${materialProfile.notes ? "\n- Notes: " + materialProfile.notes : ""}`
    : "";

  const prompt = `You are a company credit card abuse prevention analyst for a UK trades business. Your job is to analyse receipt line items for a SPECIFIC JOB and flag suspicious or unrelated purchases.

JOB CONTEXT:
- Job Type: ${jobType}
- Job Description: ${jobDescription}
${materialContext}

RECEIPT INFORMATION:
- Vendor: ${receiptData.vendorName || "Unknown"}
- Date: ${receiptData.receiptDate || "Unknown"}
- Total: ${receiptData.currency} ${receiptData.total ?? "Unknown"}
${vendorRulesContext}

LINE ITEMS TO ANALYSE:
${(receiptData.items || []).map((item, i) => `${i + 1}. "${item.description}" — Qty: ${item.quantity}, Price: ${item.price}`).join("\n")}

RULES — You MUST follow these strictly:
1. Identify the vendor type from the vendor name (petrol_station, builders_merchant, hardware_store, cleaning_supplier, general_retailer, or other).
2. For EACH line item, determine if it is appropriate for the specified job.
3. ALWAYS FLAG these categories regardless of job type:
   - Food and drinks (sandwiches, crisps, sweets, energy drinks, coffee, water bottles, meal deals, etc.)
   - Household items (cleaning products for home, air fresheners, bin bags for personal use, etc.)
   - Tobacco and alcohol (cigarettes, beer, wine, spirits, vapes, etc.)
   - Personal items (phone chargers, clothing, toiletries, sunglasses, etc.)
   - Electronics (headphones, speakers, USB drives, etc.)
   - ANY tools of ANY description (power tools, hand tools, drill bits, saw blades, spanners, screwdrivers, tool kits, etc.)
4. ADDITIONALLY FLAG materials that don't match the job type:
   - E.g., copper pipe for a painting job → flagged as unrelated_material
   - E.g., electrical cable for a plumbing job → flagged as unrelated_material
5. Items that are CLEAN for job receipts:
   - Materials that match the job's material profile and expected materials
   - Trade consumables that are NOT tools (WD-40, silicone sealant, adhesives, tape, fixings, cable ties, sandpaper)
   - PPE (gloves, safety glasses, masks, ear defenders, hi-vis)
   - Vehicle consumables at petrol stations (fuel, screenwash, AdBlue, oil)
   - Job-specific consumables (e.g., paintbrush for a painting job is a consumable FOR the job, NOT a tool — mark as CLEAN)
6. IMPORTANT DISTINCTION for job receipts:
   - Items like paintbrushes, rollers, sandpaper pads ARE consumables when they match the job type — mark CLEAN
   - The same items on a general receipt (no job context) would be flagged as tools
   - Power tools and durable tools are ALWAYS flagged even if related to the job
7. Use common-sense reasoning about whether materials are appropriate for the job type.

RESPONSE FORMAT — Return ONLY a valid JSON object:
{
  "overallStatus": "clean" or "flagged" (flagged if ANY item is flagged),
  "confidence": 0.0 to 1.0,
  "vendorType": "identified vendor type",
  "summary": "Brief explanation of findings including job relevance assessment",
  "lineItems": [
    {
      "description": "original item description",
      "quantity": number,
      "unitPrice": number or null,
      "totalPrice": number,
      "status": "clean" or "flagged",
      "flagReason": "reason if flagged, null if clean",
      "flagCategory": "food_drink | household | tools | personal | tobacco_alcohol | electronics | unrelated_material | other | null"
    }
  ]
}

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
      },
    });

    const text = response.text || "";
    const jsonStr = cleanupJsonResponse(text);
    const result: ReceiptValidationResult = JSON.parse(jsonStr);

    // Ensure overallStatus is consistent with line items
    const hasFlagged = result.lineItems.some((item) => item.status === "flagged");
    if (hasFlagged) {
      result.overallStatus = "flagged";
    }

    return result;
  } catch (error) {
    console.error("validateJobReceipt Gemini error:", error);
    return buildConservativeResult(receiptData, "unknown");
  }
}
