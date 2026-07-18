import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListBucketsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

// ─── S3 Client Configuration (MinIO-compatible) ─────────────────────────

// Validate required S3 environment variables in production
if (process.env.NODE_ENV === "production") {
  const requiredVars = ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY"];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required object storage environment variables: ${missing.join(", ")}. ` +
      "Application cannot start without proper S3/MinIO configuration."
    );
  }
}

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
  },
  forcePathStyle: true, // REQUIRED for MinIO
});

// ─── Bucket Names ───────────────────────────────────────────────────────

export const BUCKETS = {
  RECEIPTS: "receipts",
  FILES: "files",
  PHOTOS: "photos",
  SNAGS: "snags",
} as const;

type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// ─── Bucket Initialization ──────────────────────────────────────────────

async function ensureBucketExists(bucket: string): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      console.log(`[ObjectStorage] Creating bucket: ${bucket}`);
      await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`[ObjectStorage] Bucket created: ${bucket}`);
    } else {
      throw err;
    }
  }
}

export async function initBuckets(): Promise<void> {
  for (const bucket of Object.values(BUCKETS)) {
    await ensureBucketExists(bucket);
  }
}

// ─── Upload / Download / Delete ─────────────────────────────────────────

/**
 * Generate a unique object key for a file.
 * Format: prefix/YYYY/MM/uuid-originalname
 */
function generateObjectKey(prefix: string, originalName: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${prefix}/${year}/${month}/${uuid}-${safeName}`;
}

/**
 * Upload a file buffer directly to MinIO.
 */
export async function uploadFile(
  bucket: BucketName,
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string = "application/octet-stream"
): Promise<{ bucket: string; key: string; url: string }> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return {
    bucket,
    key,
    url: `${process.env.S3_ENDPOINT || "http://localhost:9000"}/${bucket}/${key}`,
  };
}

/**
 * Upload a base64 data URL to MinIO (used for receipt images).
 * Returns the object path for storage in the database.
 */
export async function uploadBase64Image(
  bucket: BucketName,
  base64DataUrl: string,
  prefix: string = "receipt"
): Promise<{ key: string; url: string }> {
  // Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
  const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid base64 data URL");
  }

  const contentType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  const ext = contentType.split("/")[1] || "jpg";
  const key = generateObjectKey(prefix, `receipt.${ext}`);

  await uploadFile(bucket, key, buffer, contentType);

  return {
    key,
    url: `${process.env.S3_ENDPOINT || "http://localhost:9000"}/${bucket}/${key}`,
  };
}

/**
 * Get a presigned URL for uploading a file directly from the client.
 * Valid for 15 minutes.
 */
export async function getPresignedUploadUrl(
  bucket: BucketName,
  originalName: string,
  contentType: string,
  prefix: string = "upload"
): Promise<{ uploadURL: string; objectPath: string; key: string }> {
  const key = generateObjectKey(prefix, originalName);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadURL = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  return {
    uploadURL,
    objectPath: `${bucket}/${key}`,
    key,
  };
}

/**
 * Get a presigned URL for downloading/viewing a file.
 * Valid for 1 hour.
 */
export async function getPresignedDownloadUrl(
  bucket: BucketName,
  key: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Delete a file from MinIO.
 */
export async function deleteFile(
  bucket: BucketName,
  key: string
): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * Get a file as a buffer from MinIO.
 */
export async function getFile(
  bucket: BucketName,
  key: string
): Promise<{ body: Buffer; contentType: string }> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const bodyBytes = await response.Body?.transformToByteArray();
  if (!bodyBytes) throw new Error("Empty file body");

  return {
    body: Buffer.from(bodyBytes),
    contentType: response.ContentType || "application/octet-stream",
  };
}

// ─── Connection Test ────────────────────────────────────────────────────

/**
 * Test the MinIO connection by uploading, verifying, and deleting a dummy file.
 * Called on server startup.
 */
export async function testConnection(): Promise<boolean> {
  const testBucket = BUCKETS.RECEIPTS;
  const testKey = "_connection_test/ping.txt";
  const testBody = `ReactPMS MinIO connection test - ${new Date().toISOString()}`;

  try {
    console.log(`[ObjectStorage] Testing connection to ${process.env.S3_ENDPOINT || "http://localhost:9000"}...`);

    // Ensure buckets exist
    await initBuckets();
    console.log("[ObjectStorage] ✅ All buckets verified/created");

    // Upload dummy file
    await s3Client.send(
      new PutObjectCommand({
        Bucket: testBucket,
        Key: testKey,
        Body: testBody,
        ContentType: "text/plain",
      })
    );
    console.log(`[ObjectStorage] ✅ Dummy file uploaded to ${testBucket}/${testKey}`);

    // Verify it exists by reading it back
    const getResponse = await s3Client.send(
      new GetObjectCommand({
        Bucket: testBucket,
        Key: testKey,
      })
    );
    const bodyText = await getResponse.Body?.transformToString();
    if (bodyText !== testBody) {
      throw new Error("Uploaded content does not match retrieved content");
    }
    console.log("[ObjectStorage] ✅ Dummy file verified (content matches)");

    // Delete dummy file
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: testBucket,
        Key: testKey,
      })
    );
    console.log("[ObjectStorage] ✅ Dummy file deleted");

    // List buckets for confirmation
    const bucketList = await s3Client.send(new ListBucketsCommand({}));
    const bucketNames = bucketList.Buckets?.map((b) => b.Name).join(", ") || "none";
    console.log(`[ObjectStorage] ✅ Connection successful! Available buckets: ${bucketNames}`);

    return true;
  } catch (err: any) {
    console.error("[ObjectStorage] ❌ Connection test FAILED:", err.message);
    console.error(
      "[ObjectStorage] Check S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY environment variables"
    );
    return false;
  }
}

// ─── Export client for advanced usage ───────────────────────────────────

export { s3Client };
