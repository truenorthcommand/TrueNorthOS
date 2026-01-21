import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupNotifications } from "./notifications";
import { storage } from "./storage";

const app = express();
const httpServer = createServer(app);

setupNotifications(httpServer);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  const seedDefaultSkills = async () => {
    try {
      log("Ensuring default skills exist...");
      const defaultSkills = [
        { name: "Plumbing", category: "trade", icon: "Droplets" },
        { name: "Electrical", category: "trade", icon: "Zap" },
        { name: "Gas & Heating", category: "trade", icon: "Flame" },
        { name: "Carpentry", category: "trade", icon: "Hammer" },
        { name: "HVAC", category: "trade", icon: "Wind" },
        { name: "Roofing", category: "trade", icon: "Home" },
        { name: "Painting & Decorating", category: "trade", icon: "Paintbrush" },
        { name: "General Maintenance", category: "trade", icon: "Wrench" },
        { name: "Tiling", category: "trade", icon: "LayoutGrid" },
        { name: "Plastering", category: "trade", icon: "Brush" },
        { name: "Glazing", category: "trade", icon: "Square" },
        { name: "Locksmith", category: "trade", icon: "Key" },
        { name: "Drainage", category: "trade", icon: "Waves" },
        { name: "Fire Safety", category: "trade", icon: "Flame" },
        { name: "Security Systems", category: "trade", icon: "Shield" },
      ];
      let seededCount = 0;
      for (const skill of defaultSkills) {
        const result = await storage.upsertSkill(skill.name, skill.category, skill.icon);
        if (result) seededCount++;
      }
      log(`Verified ${seededCount} default skills exist`);
    } catch (error) {
      console.error("Failed to seed default skills:", error);
    }
  };
  
  await seedDefaultSkills();

  // Seed default sub-skills for each main skill
  const seedDefaultSubSkills = async () => {
    try {
      log("Ensuring default sub-skills exist...");
      
      // Define sub-skills for each main skill
      const subSkillsConfig: Record<string, string[]> = {
        "Gas & Heating": [
          "LPG",
          "Oil Boilers", 
          "Commercial Gas",
          "Domestic Gas",
          "Unvented Hot Water",
          "Warm Air Systems",
          "Gas Fire Servicing",
        ],
        "Electrical": [
          "18th Edition",
          "Solar PV Installation",
          "EV Charger Installation",
          "Emergency Lighting",
          "Fire Alarm Systems",
          "Data/Network Cabling",
          "Three Phase",
          "PAT Testing",
        ],
        "Plumbing": [
          "Bathroom Installation",
          "Kitchen Installation",
          "Underfloor Heating",
          "Water Treatment",
          "Rainwater Harvesting",
          "Mains Water Connection",
        ],
        "HVAC": [
          "Air Conditioning",
          "Ventilation Systems",
          "Heat Pumps",
          "Commercial Refrigeration",
          "Ductwork",
          "F-Gas Certified",
        ],
        "Roofing": [
          "Flat Roofing",
          "Pitched Roofing",
          "Slate & Tile",
          "Metal Roofing",
          "Green Roofs",
          "Fascia & Soffits",
        ],
        "Carpentry": [
          "First Fix",
          "Second Fix",
          "Kitchen Fitting",
          "Staircase Installation",
          "Door Hanging",
          "Sash Windows",
        ],
        "Fire Safety": [
          "Fire Door Installation",
          "Fire Stopping",
          "Passive Fire Protection",
          "Fire Risk Assessment",
          "Sprinkler Systems",
        ],
        "Security Systems": [
          "CCTV Installation",
          "Intruder Alarms",
          "Access Control",
          "Intercom Systems",
          "Safe Installation",
        ],
      };

      let seededCount = 0;
      for (const [skillName, subSkillNames] of Object.entries(subSkillsConfig)) {
        // Find the skill by name
        const skill = await storage.getSkillByName(skillName);
        if (!skill) continue;

        for (const subSkillName of subSkillNames) {
          const result = await storage.upsertSubSkill(skill.id, subSkillName);
          if (result) seededCount++;
        }
      }
      log(`Verified ${seededCount} default sub-skills exist`);
    } catch (error) {
      console.error("Failed to seed default sub-skills:", error);
    }
  };

  await seedDefaultSubSkills();

  // Seed default form templates
  const seedFormTemplates = async () => {
    try {
      const existingTemplates = await storage.getFormTemplates();
      if (existingTemplates.length > 0) {
        log(`Form templates already exist (${existingTemplates.length} found)`);
        return;
      }

      log("Seeding default form templates...");
      const defaultTemplates = [
        {
          name: "Job Sheet",
          type: "job_sheet" as const,
          schema: {
            name: "Job Sheet",
            style: "clean",
            fields: [
              { type: "text" as const, key: "job_ref", label: "Job Reference", required: true, prefill: "job.ref" },
              { type: "text" as const, key: "customer_name", label: "Customer Name", required: true, prefill: "client.name" },
              { type: "text" as const, key: "address", label: "Site Address", required: true, prefill: "job.address" },
              { type: "date" as const, key: "date", label: "Date", required: true },
              { type: "textarea" as const, key: "work_description", label: "Work Description", required: true },
              { type: "textarea" as const, key: "materials_used", label: "Materials Used", required: false },
              { type: "number" as const, key: "time_spent", label: "Time Spent (hours)", required: true },
              { type: "textarea" as const, key: "notes", label: "Additional Notes", required: false },
              { type: "photo" as const, key: "photos", label: "Site Photos", required: false, multiple: true },
            ]
          }
        },
        {
          name: "Client Creation Form",
          type: "client_form" as const,
          schema: {
            name: "Client Creation Form",
            style: "clean",
            fields: [
              { type: "text" as const, key: "company_name", label: "Company/Client Name", required: true },
              { type: "text" as const, key: "contact_name", label: "Primary Contact Name", required: true },
              { type: "text" as const, key: "email", label: "Email Address", required: true },
              { type: "text" as const, key: "phone", label: "Phone Number", required: true },
              { type: "textarea" as const, key: "address", label: "Address", required: true },
              { type: "text" as const, key: "postcode", label: "Postcode", required: true },
              { type: "select" as const, key: "client_type", label: "Client Type", required: true, options: [
                { label: "Domestic", value: "domestic" },
                { label: "Commercial", value: "commercial" },
                { label: "Industrial", value: "industrial" }
              ]},
              { type: "textarea" as const, key: "notes", label: "Notes", required: false },
            ]
          }
        },
        {
          name: "Quote Sheet",
          type: "quote_sheet" as const,
          schema: {
            name: "Quote Sheet",
            style: "clean",
            fields: [
              { type: "text" as const, key: "quote_ref", label: "Quote Reference", required: true, prefill: "quote.number" },
              { type: "text" as const, key: "client_name", label: "Client Name", required: true, prefill: "client.name" },
              { type: "date" as const, key: "date", label: "Quote Date", required: true },
              { type: "date" as const, key: "valid_until", label: "Valid Until", required: true },
              { type: "textarea" as const, key: "scope_of_work", label: "Scope of Work", required: true },
              { type: "number" as const, key: "labour_cost", label: "Labour Cost (£)", required: true },
              { type: "number" as const, key: "materials_cost", label: "Materials Cost (£)", required: true },
              { type: "number" as const, key: "total", label: "Total (£)", required: true },
              { type: "textarea" as const, key: "terms", label: "Terms & Conditions", required: false },
            ]
          }
        },
        {
          name: "Job Sign-off Form",
          type: "signoff" as const,
          schema: {
            name: "Job Sign-off Form",
            style: "clean",
            fields: [
              { type: "text" as const, key: "job_ref", label: "Job Reference", required: true, prefill: "job.ref" },
              { type: "text" as const, key: "customer_name", label: "Customer Name", required: true, prefill: "client.name" },
              { type: "date" as const, key: "completion_date", label: "Completion Date", required: true },
              { type: "yesno" as const, key: "work_completed", label: "All work completed satisfactorily?", required: true },
              { type: "yesno" as const, key: "site_clean", label: "Site left clean and tidy?", required: true },
              { type: "textarea" as const, key: "customer_comments", label: "Customer Comments", required: false },
              { type: "photo" as const, key: "completion_photos", label: "Completion Photos", required: true, multiple: true },
              { type: "signature" as const, key: "engineer_signature", label: "Engineer Signature", required: true },
              { type: "signature" as const, key: "customer_signature", label: "Customer Signature", required: true },
            ]
          }
        }
      ];

      for (const template of defaultTemplates) {
        const created = await storage.createFormTemplate({
          name: template.name,
          type: template.type,
          status: 'published',
          createdBy: null,
        });
        
        await storage.createFormTemplateVersion({
          templateId: created.id,
          version: 1,
          schema: template.schema,
          status: 'published',
          publishedAt: new Date(),
        });
      }

      log(`Seeded ${defaultTemplates.length} default form templates`);
    } catch (error) {
      console.error("Failed to seed form templates:", error);
    }
  };

  await seedFormTemplates();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
