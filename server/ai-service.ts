import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { Job } from "@shared/schema";
import * as aiService from "./services/ai-service";

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

interface JobNotesResponse {
  summary: string;
  workCompleted: string[];
  materialsUsed: string[];
  recommendations: string[];
  professionalNotes: string;
}

interface ComplianceGap {
  regulation: string;
  issue: string;
  severity: "low" | "medium" | "high" | "critical";
  action: string;
}

interface PartSuggestion {
  partName: string;
  quantity: number;
  reasoning: string;
  category: string;
}

export function registerAiRoutes(app: Express): void {
  app.post("/api/ai/job-notes", requireAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: "jobId is required" });
    }

    try {
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const materials = (job.materials as Array<{ name: string; quantity: string }>) || [];
      const photos = (job.photos as Array<{ url: string; timestamp: string }>) || [];

      const prompt = `You are a professional field service assistant for UK trade workers. Generate structured completion notes for a job.

Job Details:
- Job Number: ${job.jobNo}
- Customer: ${job.customerName}
- Address: ${job.address || "Not specified"}
- Description: ${job.description || "No description provided"}
- Works Completed: ${job.worksCompleted || "Not yet documented"}
- Materials Used: ${materials.length > 0 ? materials.map(m => `${m.name} (qty: ${m.quantity})`).join(", ") : "None recorded"}
- Photos Taken: ${photos.length} photo(s)
- Notes: ${job.notes || "None"}

Generate professional completion notes in JSON format:
{
  "summary": "Brief professional summary of the work",
  "workCompleted": ["List of completed work items"],
  "materialsUsed": ["List of materials with quantities"],
  "recommendations": ["Any follow-up recommendations"],
  "professionalNotes": "Detailed professional notes suitable for customer records"
}

Respond ONLY with valid JSON.`;

      const completion = await gemini.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const responseText = completion.choices[0]?.message?.content || "{}";
      const durationMs = Date.now() - startTime;

      let parsedOutput: JobNotesResponse;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsedOutput = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch {
        parsedOutput = {
          summary: responseText,
          workCompleted: [],
          materialsUsed: [],
          recommendations: [],
          professionalNotes: responseText,
        };
      }

      const promptTokens = completion.usage?.prompt_tokens || 0;
      const completionTokens = completion.usage?.completion_tokens || 0;
      const totalTokens = completion.usage?.total_tokens || 0;

      const aiRequest = await storage.createAiRequest({
        provider: PROVIDER,
        model: MODEL,
        endpoint: "/api/ai/job-notes",
        promptVersion: "v1.0",
        inputRefsJson: { jobId },
        promptTokens,
        completionTokens,
        totalTokens,
        outputJson: parsedOutput,
        confidence: 0.85,
        sourcesUsed: ["job_data"],
        approvalStatus: "pending",
        requestedById: req.session.userId!,
        durationMs,
      });

      res.json({
        aiRequestId: aiRequest.id,
        data: parsedOutput,
        tokens: { promptTokens, completionTokens, totalTokens },
        approvalStatus: "pending",
      });
    } catch (error: any) {
      console.error("AI job-notes error:", error);

      await storage.createAiRequest({
        provider: PROVIDER,
        model: MODEL,
        endpoint: "/api/ai/job-notes",
        promptVersion: "v1.0",
        inputRefsJson: { jobId },
        approvalStatus: "pending",
        requestedById: req.session.userId!,
        durationMs: Date.now() - startTime,
        errorMessage: error.message,
      });

      res.status(500).json({ error: "Failed to generate job notes" });
    }
  });

  app.post("/api/ai/compliance-gap", requireAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: "jobId is required" });
    }

    try {
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const materials = (job.materials as Array<{ name: string; quantity: string }>) || [];

      const prompt = `You are a UK trade compliance expert. Analyze this job for potential compliance gaps against UK regulations.

Job Details:
- Job Number: ${job.jobNo}
- Description: ${job.description || "No description provided"}
- Works Completed: ${job.worksCompleted || "Not documented"}
- Materials Used: ${materials.length > 0 ? materials.map(m => `${m.name} (qty: ${m.quantity})`).join(", ") : "None recorded"}
- Notes: ${job.notes || "None"}

Relevant UK Regulations to check:
- Gas Safe Register (for gas work)
- BS 7671 (IET Wiring Regulations for electrical work)
- Building Regulations Part P (electrical work in dwellings)
- Building Regulations Part J (combustion appliances)
- Water Regulations (WRAS compliance)
- F-Gas Regulations (refrigeration/air conditioning)

Analyze and return compliance gaps in JSON format:
{
  "gaps": [
    {
      "regulation": "Name of regulation",
      "issue": "Description of potential compliance issue",
      "severity": "low|medium|high|critical",
      "action": "Recommended action to resolve"
    }
  ],
  "overallRisk": "low|medium|high",
  "notes": "General compliance notes"
}

If no compliance issues are detected, return empty gaps array.
Respond ONLY with valid JSON.`;

      const completion = await gemini.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });

      const responseText = completion.choices[0]?.message?.content || "{}";
      const durationMs = Date.now() - startTime;

      let parsedOutput: { gaps: ComplianceGap[]; overallRisk: string; notes: string };
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsedOutput = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch {
        parsedOutput = {
          gaps: [],
          overallRisk: "unknown",
          notes: responseText,
        };
      }

      const promptTokens = completion.usage?.prompt_tokens || 0;
      const completionTokens = completion.usage?.completion_tokens || 0;
      const totalTokens = completion.usage?.total_tokens || 0;

      const aiRequest = await storage.createAiRequest({
        provider: PROVIDER,
        model: MODEL,
        endpoint: "/api/ai/compliance-gap",
        promptVersion: "v1.0",
        inputRefsJson: { jobId },
        promptTokens,
        completionTokens,
        totalTokens,
        outputJson: parsedOutput,
        confidence: parsedOutput.gaps.length > 0 ? 0.75 : 0.9,
        sourcesUsed: ["job_data", "uk_regulations"],
        approvalStatus: "pending",
        requestedById: req.session.userId!,
        durationMs,
      });

      res.json({
        aiRequestId: aiRequest.id,
        data: parsedOutput,
        tokens: { promptTokens, completionTokens, totalTokens },
        approvalStatus: "pending",
      });
    } catch (error: any) {
      console.error("AI compliance-gap error:", error);

      await storage.createAiRequest({
        provider: PROVIDER,
        model: MODEL,
        endpoint: "/api/ai/compliance-gap",
        promptVersion: "v1.0",
        inputRefsJson: { jobId },
        approvalStatus: "pending",
        requestedById: req.session.userId!,
        durationMs: Date.now() - startTime,
        errorMessage: error.message,
      });

      res.status(500).json({ error: "Failed to analyze compliance gaps" });
    }
  });

  app.post("/api/ai/parts-suggest", requireAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: "jobId is required" });
    }

    try {
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const requiredSkills = (job.requiredSkills as string[]) || [];

      const prompt = `You are a UK trade parts specialist. Suggest parts that may be needed for this job.

Job Details:
- Job Number: ${job.jobNo}
- Description: ${job.description || "No description provided"}
- Works Completed: ${job.worksCompleted || "Not started"}
- Required Skills: ${requiredSkills.length > 0 ? requiredSkills.join(", ") : "General trade work"}
- Notes: ${job.notes || "None"}

Based on the job type and description, suggest commonly needed parts in JSON format:
{
  "suggestions": [
    {
      "partName": "Name of the part",
      "quantity": 1,
      "reasoning": "Why this part might be needed",
      "category": "Category (electrical/plumbing/gas/hvac/general)"
    }
  ],
  "notes": "General notes about parts requirements"
}

Only suggest parts that are commonly needed for this type of work. Be practical and cost-effective.
Respond ONLY with valid JSON.`;

      const completion = await gemini.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      });

      const responseText = completion.choices[0]?.message?.content || "{}";
      const durationMs = Date.now() - startTime;

      let parsedOutput: { suggestions: PartSuggestion[]; notes: string };
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsedOutput = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch {
        parsedOutput = {
          suggestions: [],
          notes: responseText,
        };
      }

      const promptTokens = completion.usage?.prompt_tokens || 0;
      const completionTokens = completion.usage?.completion_tokens || 0;
      const totalTokens = completion.usage?.total_tokens || 0;

      const aiRequest = await storage.createAiRequest({
        provider: PROVIDER,
        model: MODEL,
        endpoint: "/api/ai/parts-suggest",
        promptVersion: "v1.0",
        inputRefsJson: { jobId },
        promptTokens,
        completionTokens,
        totalTokens,
        outputJson: parsedOutput,
        confidence: 0.7,
        sourcesUsed: ["job_data", "parts_knowledge"],
        approvalStatus: "pending",
        requestedById: req.session.userId!,
        durationMs,
      });

      res.json({
        aiRequestId: aiRequest.id,
        data: parsedOutput,
        tokens: { promptTokens, completionTokens, totalTokens },
        approvalStatus: "pending",
      });
    } catch (error: any) {
      console.error("AI parts-suggest error:", error);

      await storage.createAiRequest({
        provider: PROVIDER,
        model: MODEL,
        endpoint: "/api/ai/parts-suggest",
        promptVersion: "v1.0",
        inputRefsJson: { jobId },
        approvalStatus: "pending",
        requestedById: req.session.userId!,
        durationMs: Date.now() - startTime,
        errorMessage: error.message,
      });

      res.status(500).json({ error: "Failed to suggest parts" });
    }
  });
}
