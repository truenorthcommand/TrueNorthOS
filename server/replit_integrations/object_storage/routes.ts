import type { Express, RequestHandler } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

/**
 * Register object storage routes for file uploads.
 *
 * @param app - Express application
 * @param requireAuth - Optional authentication middleware for protected uploads
 */
export function registerObjectStorageRoutes(app: Express, requireAuth?: RequestHandler): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   * Requires authentication when requireAuth middleware is provided.
   */
  const uploadMiddleware: RequestHandler[] = requireAuth ? [requireAuth] : [];
  app.post("/api/uploads/request-url", ...uploadMiddleware, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      console.error("PRIVATE_OBJECT_DIR:", process.env.PRIVATE_OBJECT_DIR || 'NOT SET');
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ 
        error: "Failed to generate upload URL",
        detail: process.env.NODE_ENV !== 'production' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

