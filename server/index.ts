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
