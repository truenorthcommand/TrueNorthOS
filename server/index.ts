import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupNotifications } from "./notifications";
import { storage } from "./storage";
import { ensureSessionTable } from "./session";
import path from "path";
import fs from "fs";

const app = express();
app.set('trust proxy', 1);

// Serve PWA files - use client/public in dev, dist/public in prod
const cwd = process.cwd();
const devPublicPath = path.resolve(cwd, "client/public");
const prodPublicPath = path.resolve(cwd, "dist/public");
const publicPath = process.env.NODE_ENV === "production" && fs.existsSync(prodPublicPath) ? prodPublicPath : devPublicPath;

if (fs.existsSync(publicPath)) {
  app.use("/manifest.json", express.static(path.join(publicPath, "manifest.json"), {
    setHeaders: (res) => res.setHeader('Content-Type', 'application/manifest+json')
  }));
  app.use("/sw.js", express.static(path.join(publicPath, "sw.js"), {
    setHeaders: (res) => {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  }));
  app.use("/icons", express.static(path.join(publicPath, "icons")));
}

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
  await ensureSessionTable();
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
        // JOB SHEETS - 3 styles
        {
          name: "Job Sheet - Clean",
          type: "job_sheet" as const,
          schema: {
            name: "Job Sheet - Clean",
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
          name: "Job Sheet - Professional",
          type: "job_sheet" as const,
          schema: {
            name: "Job Sheet - Professional",
            style: "professional",
            fields: [
              { type: "text" as const, key: "job_ref", label: "Job Reference Number", required: true, prefill: "job.ref" },
              { type: "text" as const, key: "customer_name", label: "Customer/Client Name", required: true, prefill: "client.name" },
              { type: "text" as const, key: "contact_phone", label: "Contact Phone", required: true, prefill: "client.phone" },
              { type: "textarea" as const, key: "address", label: "Site Address (Full)", required: true, prefill: "job.address" },
              { type: "text" as const, key: "postcode", label: "Postcode", required: true },
              { type: "date" as const, key: "date", label: "Date of Visit", required: true },
              { type: "text" as const, key: "arrival_time", label: "Arrival Time", required: true },
              { type: "text" as const, key: "departure_time", label: "Departure Time", required: true },
              { type: "textarea" as const, key: "work_requested", label: "Work Requested by Customer", required: true },
              { type: "textarea" as const, key: "work_completed", label: "Work Completed", required: true },
              { type: "textarea" as const, key: "materials_used", label: "Materials & Parts Used", required: false },
              { type: "number" as const, key: "labour_hours", label: "Labour Hours", required: true },
              { type: "yesno" as const, key: "follow_up_required", label: "Follow-up Visit Required?", required: true },
              { type: "textarea" as const, key: "follow_up_notes", label: "Follow-up Details", required: false },
              { type: "textarea" as const, key: "engineer_notes", label: "Engineer Notes", required: false },
              { type: "photo" as const, key: "before_photos", label: "Before Photos", required: false, multiple: true },
              { type: "photo" as const, key: "after_photos", label: "After Photos", required: false, multiple: true },
              { type: "signature" as const, key: "engineer_signature", label: "Engineer Signature", required: true },
            ]
          }
        },
        {
          name: "Job Sheet - Compact",
          type: "job_sheet" as const,
          schema: {
            name: "Job Sheet - Compact",
            style: "compact",
            fields: [
              { type: "text" as const, key: "job_ref", label: "Job Ref", required: true, prefill: "job.ref" },
              { type: "text" as const, key: "customer", label: "Customer", required: true, prefill: "client.name" },
              { type: "date" as const, key: "date", label: "Date", required: true },
              { type: "textarea" as const, key: "work_done", label: "Work Done", required: true },
              { type: "number" as const, key: "hours", label: "Hours", required: true },
              { type: "photo" as const, key: "photo", label: "Photo", required: false, multiple: false },
            ]
          }
        },
        
        // CLIENT FORMS - 3 styles
        {
          name: "Client Form - Clean",
          type: "client_form" as const,
          schema: {
            name: "Client Form - Clean",
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
          name: "Client Form - Professional",
          type: "client_form" as const,
          schema: {
            name: "Client Form - Professional",
            style: "professional",
            fields: [
              { type: "text" as const, key: "company_name", label: "Company/Organisation Name", required: true },
              { type: "text" as const, key: "trading_name", label: "Trading Name (if different)", required: false },
              { type: "text" as const, key: "company_reg", label: "Company Registration Number", required: false },
              { type: "text" as const, key: "vat_number", label: "VAT Number", required: false },
              { type: "text" as const, key: "primary_contact", label: "Primary Contact Name", required: true },
              { type: "text" as const, key: "primary_email", label: "Primary Email", required: true },
              { type: "text" as const, key: "primary_phone", label: "Primary Phone", required: true },
              { type: "text" as const, key: "secondary_contact", label: "Secondary Contact Name", required: false },
              { type: "text" as const, key: "secondary_phone", label: "Secondary Phone", required: false },
              { type: "textarea" as const, key: "site_address", label: "Site Address", required: true },
              { type: "text" as const, key: "site_postcode", label: "Site Postcode", required: true },
              { type: "textarea" as const, key: "billing_address", label: "Billing Address (if different)", required: false },
              { type: "text" as const, key: "billing_postcode", label: "Billing Postcode", required: false },
              { type: "select" as const, key: "client_type", label: "Client Type", required: true, options: [
                { label: "Domestic", value: "domestic" },
                { label: "Commercial", value: "commercial" },
                { label: "Industrial", value: "industrial" },
                { label: "Public Sector", value: "public_sector" }
              ]},
              { type: "select" as const, key: "payment_terms", label: "Payment Terms", required: true, options: [
                { label: "Immediate", value: "immediate" },
                { label: "Net 14", value: "net14" },
                { label: "Net 30", value: "net30" },
                { label: "Net 60", value: "net60" }
              ]},
              { type: "textarea" as const, key: "special_requirements", label: "Special Requirements/Access Notes", required: false },
              { type: "textarea" as const, key: "notes", label: "Additional Notes", required: false },
            ]
          }
        },
        {
          name: "Client Form - Compact",
          type: "client_form" as const,
          schema: {
            name: "Client Form - Compact",
            style: "compact",
            fields: [
              { type: "text" as const, key: "name", label: "Name", required: true },
              { type: "text" as const, key: "phone", label: "Phone", required: true },
              { type: "text" as const, key: "email", label: "Email", required: false },
              { type: "textarea" as const, key: "address", label: "Address", required: true },
            ]
          }
        },
        
        // QUOTE SHEETS - 3 styles
        {
          name: "Quote Sheet - Clean",
          type: "quote_sheet" as const,
          schema: {
            name: "Quote Sheet - Clean",
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
          name: "Quote Sheet - Professional",
          type: "quote_sheet" as const,
          schema: {
            name: "Quote Sheet - Professional",
            style: "professional",
            fields: [
              { type: "text" as const, key: "quote_ref", label: "Quote Reference Number", required: true, prefill: "quote.number" },
              { type: "text" as const, key: "client_name", label: "Client/Company Name", required: true, prefill: "client.name" },
              { type: "text" as const, key: "contact_name", label: "Contact Person", required: true },
              { type: "textarea" as const, key: "site_address", label: "Site Address", required: true },
              { type: "date" as const, key: "survey_date", label: "Survey/Assessment Date", required: false },
              { type: "date" as const, key: "quote_date", label: "Quote Date", required: true },
              { type: "date" as const, key: "valid_until", label: "Quote Valid Until", required: true },
              { type: "textarea" as const, key: "project_description", label: "Project Description", required: true },
              { type: "textarea" as const, key: "scope_of_work", label: "Detailed Scope of Work", required: true },
              { type: "textarea" as const, key: "materials_breakdown", label: "Materials Breakdown", required: true },
              { type: "number" as const, key: "materials_cost", label: "Materials Cost (£)", required: true },
              { type: "number" as const, key: "labour_hours", label: "Estimated Labour Hours", required: true },
              { type: "number" as const, key: "labour_rate", label: "Labour Rate (£/hour)", required: true },
              { type: "number" as const, key: "labour_cost", label: "Labour Cost (£)", required: true },
              { type: "number" as const, key: "subtotal", label: "Subtotal (£)", required: true },
              { type: "number" as const, key: "vat", label: "VAT (£)", required: true },
              { type: "number" as const, key: "total", label: "Total inc. VAT (£)", required: true },
              { type: "text" as const, key: "estimated_duration", label: "Estimated Duration", required: true },
              { type: "textarea" as const, key: "exclusions", label: "Exclusions", required: false },
              { type: "textarea" as const, key: "payment_terms", label: "Payment Terms", required: true },
              { type: "textarea" as const, key: "terms_conditions", label: "Terms & Conditions", required: true },
              { type: "textarea" as const, key: "warranty", label: "Warranty Information", required: false },
            ]
          }
        },
        {
          name: "Quote Sheet - Compact",
          type: "quote_sheet" as const,
          schema: {
            name: "Quote Sheet - Compact",
            style: "compact",
            fields: [
              { type: "text" as const, key: "quote_ref", label: "Quote #", required: true, prefill: "quote.number" },
              { type: "text" as const, key: "client", label: "Client", required: true, prefill: "client.name" },
              { type: "date" as const, key: "date", label: "Date", required: true },
              { type: "textarea" as const, key: "work", label: "Work", required: true },
              { type: "number" as const, key: "total", label: "Total (£)", required: true },
            ]
          }
        },
        
        // SIGN-OFF FORMS - 3 styles
        {
          name: "Sign-off Form - Clean",
          type: "signoff" as const,
          schema: {
            name: "Sign-off Form - Clean",
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
        },
        {
          name: "Sign-off Form - Professional",
          type: "signoff" as const,
          schema: {
            name: "Sign-off Form - Professional",
            style: "professional",
            fields: [
              { type: "text" as const, key: "job_ref", label: "Job Reference Number", required: true, prefill: "job.ref" },
              { type: "text" as const, key: "customer_name", label: "Customer/Client Name", required: true, prefill: "client.name" },
              { type: "text" as const, key: "site_address", label: "Site Address", required: true, prefill: "job.address" },
              { type: "date" as const, key: "completion_date", label: "Date of Completion", required: true },
              { type: "text" as const, key: "completion_time", label: "Time of Completion", required: true },
              { type: "textarea" as const, key: "work_summary", label: "Summary of Work Completed", required: true },
              { type: "yesno" as const, key: "work_completed", label: "All work completed as per specification?", required: true },
              { type: "yesno" as const, key: "tested_working", label: "All systems tested and working?", required: true },
              { type: "yesno" as const, key: "site_clean", label: "Site left clean and tidy?", required: true },
              { type: "yesno" as const, key: "waste_removed", label: "All waste removed from site?", required: true },
              { type: "yesno" as const, key: "customer_shown", label: "Customer shown how to operate equipment?", required: false },
              { type: "textarea" as const, key: "outstanding_items", label: "Outstanding Items (if any)", required: false },
              { type: "textarea" as const, key: "customer_comments", label: "Customer Comments/Feedback", required: false },
              { type: "select" as const, key: "customer_rating", label: "Customer Satisfaction Rating", required: false, options: [
                { label: "Excellent", value: "excellent" },
                { label: "Good", value: "good" },
                { label: "Satisfactory", value: "satisfactory" },
                { label: "Needs Improvement", value: "needs_improvement" }
              ]},
              { type: "photo" as const, key: "before_photos", label: "Before Photos", required: false, multiple: true },
              { type: "photo" as const, key: "after_photos", label: "After/Completion Photos", required: true, multiple: true },
              { type: "text" as const, key: "engineer_name", label: "Engineer Name (Print)", required: true, prefill: "user.name" },
              { type: "signature" as const, key: "engineer_signature", label: "Engineer Signature", required: true },
              { type: "text" as const, key: "customer_name_print", label: "Customer Name (Print)", required: true },
              { type: "signature" as const, key: "customer_signature", label: "Customer Signature", required: true },
            ]
          }
        },
        {
          name: "Sign-off Form - Compact",
          type: "signoff" as const,
          schema: {
            name: "Sign-off Form - Compact",
            style: "compact",
            fields: [
              { type: "text" as const, key: "job_ref", label: "Job Ref", required: true, prefill: "job.ref" },
              { type: "date" as const, key: "date", label: "Date", required: true },
              { type: "yesno" as const, key: "complete", label: "Work Complete?", required: true },
              { type: "signature" as const, key: "engineer_sig", label: "Engineer", required: true },
              { type: "signature" as const, key: "customer_sig", label: "Customer", required: true },
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
          publishedAt: new Date(),
        });
      }

      log(`Seeded ${defaultTemplates.length} default form templates`);
    } catch (error) {
      console.error("Failed to seed form templates:", error);
    }
  };

  await seedFormTemplates();

  // Ensure a super admin exists
  const seedSuperAdmin = async () => {
    try {
      const bcrypt = await import("bcryptjs");
      const allUsers = await storage.getAllUsers();
      const superAdmins = allUsers.filter(u => u.role === "super_admin");
      
      if (superAdmins.length === 0) {
        log("No super admin found. Creating default super admin...");
        const hashedPassword = bcrypt.hashSync("TrueNorth2024!", 10);
        
        await storage.createUser({
          username: "superadmin",
          password: hashedPassword,
          name: "Super Admin",
          email: "admin@truenorth.com",
          role: "super_admin",
          status: "active",
          superAdmin: true,
          hasDirectorsSuite: true,
        });
        
        log("Default super admin created: username='superadmin'");
      } else {
        log(`Super admin already exists (${superAdmins.length} found)`);
      }
    } catch (error) {
      console.error("Failed to seed super admin:", error);
    }
  };
  
  await seedSuperAdmin();

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
