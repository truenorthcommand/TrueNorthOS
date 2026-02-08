import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files with proper cache headers for PWA
  app.use(express.static(distPath, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      // Set correct MIME types for PWA files
      if (filePath.endsWith('manifest.json')) {
        res.setHeader('Content-Type', 'application/manifest+json');
      }
      if (filePath.endsWith('sw.js') || filePath.endsWith('service-worker.js')) {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Service-Worker-Allowed', '/');
      }
    }
  }));

  // fall through to index.html if the file doesn't exist
  // but NOT for API routes - those should return 404
  app.use("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api")) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
