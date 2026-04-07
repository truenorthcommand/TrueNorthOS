import OpenAI from "openai";

// OpenRouter configuration - uses OpenAI-compatible API
const openai = process.env.OPENROUTER_API_KEY ? new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://truenorthos.co.uk",
    "X-Title": "TrueNorthOS"
  }
}) : null;

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

function cleanupJsonResponse(text: string): string {
  // Remove markdown code blocks if present
  const codeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  // Try to find JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : text;
}

function checkApiKey() {
  if (!openai) {
    throw new Error("OpenRouter API key not configured");
  }
}

export async function scanReceipt(imageBase64: string): Promise<ReceiptData> {
  checkApiKey();
  
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

  const response = await openai!.chat.completions.create({
    model: "openai/gpt-4o-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      }
    ]
  });

  const text = response.choices[0].message.content || "";
  const jsonStr = cleanupJsonResponse(text);
  
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to parse receipt data: " + text);
  }
}

export async function analyzeSitePhoto(imageBase64: string, jobContext?: string): Promise<SitePhotoAnalysis> {
  checkApiKey();
  
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

  const response = await openai!.chat.completions.create({
    model: "openai/gpt-4o-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      }
    ]
  });

  const text = response.choices[0].message.content || "";
  const jsonStr = cleanupJsonResponse(text);
  
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to analyze site photo: " + text);
  }
}

export async function generateJobSummary(engineerNotes: string, jobDetails: any): Promise<JobSummary> {
  checkApiKey();
  
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

  const response = await openai!.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  const text = response.choices[0].message.content || "";
  const jsonStr = cleanupJsonResponse(text);
  
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to generate job summary: " + text);
  }
}

export async function generateQuoteDescription(jobDetails: any, services: string[]): Promise<QuoteDescription> {
  checkApiKey();
  
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

  const response = await openai!.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  const text = response.choices[0].message.content || "";
  const jsonStr = cleanupJsonResponse(text);
  
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to generate quote description: " + text);
  }
}

export async function generateCustomerMessage(context: any, tone: "formal" | "friendly" | "urgent"): Promise<CustomerMessage> {
  checkApiKey();
  
  const prompt = `You are a professional customer relations writer for a UK trade business. Write a customer message based on this context:

Context: ${JSON.stringify(context)}

Tone requested: ${tone}

Return a JSON object with:
- subject: Professional email subject line
- body: The message body (appropriate for email or SMS)
- tone: The tone used ("formal", "friendly", or "urgent")

Use UK English. Be professional but approachable. Include placeholders like [Customer Name] where appropriate.
Return ONLY valid JSON.`;

  const response = await openai!.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  const text = response.choices[0].message.content || "";
  const jsonStr = cleanupJsonResponse(text);
  
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to generate customer message: " + text);
  }
}

export async function generateInspectionReport(inspectionData: any): Promise<InspectionReport> {
  checkApiKey();
  
  const prompt = `You are a certified UK safety inspector. Generate a professional inspection report based on this data:

Inspection Data: ${JSON.stringify(inspectionData)}

Return a JSON object with:
- title: Report title
- summary: Executive summary of findings
- findings: Array of {item: description, status: "pass"|"fail"|"na", notes: additional notes}
- overallResult: "pass"|"fail"|"conditional"
- recommendations: Array of recommended actions
- nextInspectionDate: Suggested next inspection date (ISO format) or null

Focus on UK safety standards and regulations relevant to trades/building work.
Return ONLY valid JSON.`;

  const response = await openai!.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  const text = response.choices[0].message.content || "";
  const jsonStr = cleanupJsonResponse(text);
  
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to generate inspection report: " + text);
  }
}

export async function transcribeVoice(audioBase64: string, format: string = "audio/mp3"): Promise<VoiceTranscription> {
  checkApiKey();
  
  // Note: OpenRouter doesn't have Whisper, so we'll use the text model with a prompt
  // In production, you'd want to use a proper transcription service
  const prompt = `You are a voice transcription assistant. A user has provided audio that couldn't be transcribed by the system.

Please generate a helpful response explaining that voice transcription is temporarily unavailable, and suggest alternatives like typing notes or using a mobile device with speech-to-text capability.

Return a JSON object with:
- text: "Voice transcription unavailable. Please type your notes or use device speech-to-text."
- summary: "System temporarily unable to transcribe voice audio."
- actionItems: []
- keyPoints: []

Return ONLY valid JSON.`;

  const response = await openai!.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  const text = response.choices[0].message.content || "";
  const jsonStr = cleanupJsonResponse(text);
  
  try {
    return JSON.parse(jsonStr);
  } catch {
    return {
      text: "Voice transcription unavailable. Please type your notes.",
      summary: "System temporarily unable to transcribe voice audio.",
      actionItems: [],
      keyPoints: []
    };
  }
}
