import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";

function getOpenAIClient(): OpenAI | null {
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return null;
}

const SYSTEM_PROMPT = `You are the TrueNorth OS website assistant. You help visitors learn about TrueNorth OS, a comprehensive field service management platform built specifically for UK trade and field service companies.

Your role is to answer questions about the product, pricing, features, and the sign-up process. Be friendly, concise, and helpful. Use British English.

KEY PRODUCT INFORMATION:

TrueNorth OS is an all-in-one ERP solution that digitises and streamlines operations for trade businesses — plumbers, electricians, HVAC engineers, gas engineers, and other field service companies across the UK.

PRICING PLANS:
- Free (£0/month): 1 user, job scheduling, client database, unlimited invoicing, basic mobile app
- Starter (£35/month): 1 user (+£15/additional user), everything in Free plus client portal, payment processing, basic AI assistant, integrations, basic analytics
- Pro (£60/month, most popular): 1 user (+£12/additional user), everything in Starter plus full AI assistant, auto-assign by postcode, full analytics. Branding removed included.
- Business (£150/month): 1 user (+£10/additional user), everything in Pro plus fleet management, API access, full suite analytics

All plans include: Secure UK cloud hosting, SSL encryption, GDPR compliance, two-factor authentication, regular updates, email support, and a 14-day free trial.

CORE MODULES:
1. Operations — Job management, scheduling, quoting, invoicing, client portal
2. Finance — Invoicing, expense tracking, payment processing (Stripe), VAT calculations
3. Fleet — Vehicle management, walkaround checks, defect tracking, mileage logging (HMRC rates)
4. Workforce — Engineer management, skills tracking, timesheets, clock in/out with GPS
5. Quality Control — Job sign-off with photos, signatures, geolocation verification
6. Compliance — Gas Safe support, BS 7671 regulations, GDPR compliance, audit trails
7. Intelligence — AI-powered job assignment, pricing advice, receipt OCR, analytics dashboards

KEY FEATURES:
- AI-powered assistant for pricing advice, job assignment, and business insights
- Real-time GPS tracking of engineers
- Client portal for customers to view quotes, invoices, and job updates
- Mobile-first progressive web app (works offline)
- Stripe payment integration for invoices
- Automated workflow rules engine
- Role-based access (Admin, Engineer, Super Admin)
- Two-factor authentication
- File management with smart AI assignment

SIGN-UP PROCESS:
1. Visit the registration page or click "Start Free Trial"
2. Create an account with company details
3. Choose a plan (all plans start with a 14-day free trial)
4. Start managing jobs immediately

COMPANY DETAILS:
- Company: TrueNorth Operations Group
- Email: info@truenorthoperationsgroup.com
- Address: Unit 2 Meadow View Industrial Estate, Ashford, Kent, TN26 2NR

GUIDELINES:
- Keep responses concise (2-4 sentences typically)
- If asked about technical implementation details you don't know, suggest contacting the team at info@truenorthoperationsgroup.com
- Always encourage visitors to start a free trial when appropriate
- Do not make up features or pricing that aren't listed above
- If asked about competitors, focus on TrueNorth OS strengths rather than criticising others
- You cannot access any user data, perform actions, or look up account information`;

const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: "Too many requests. Please wait a moment before sending another message." },
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerPublicChatbotRoutes(app: Express): void {
  app.post("/api/public-chatbot/chat", chatbotLimiter, async (req: Request, res: Response) => {
    let clientDisconnected = false;

    req.on("close", () => {
      clientDisconnected = true;
    });

    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "Chat service is currently unavailable." });
      }

      const { message, conversationHistory = [] } = req.body;

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "Message is required." });
      }

      if (message.length > 1000) {
        return res.status(400).json({ error: "Message is too long. Please keep it under 1000 characters." });
      }

      if (conversationHistory.length > 20) {
        return res.status(400).json({ error: "Conversation is too long. Please start a new chat." });
      }

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
      ];

      for (const msg of conversationHistory.slice(-10)) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: typeof msg.content === "string" ? msg.content.slice(0, 1000) : "",
          });
        }
      }

      messages.push({ role: "user", content: message.trim() });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Cache-Control", "no-cache");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        stream: true,
        max_completion_tokens: 512,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        if (clientDisconnected) break;
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          res.write(content);
        }
      }

      res.end();
    } catch (error) {
      console.error("[Public Chatbot] Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Something went wrong. Please try again." });
      } else {
        res.end();
      }
    }
  });
}
