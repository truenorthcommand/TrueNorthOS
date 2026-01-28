import Dexie, { type Table } from "dexie";

export interface OfflineFormDraft {
  id?: number;
  versionId: string;
  entityType: string;
  entityId: string;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineFormSubmission {
  id?: number;
  versionId: string;
  entityType: string;
  entityId: string;
  data: Record<string, any>;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  lastError?: string;
  createdAt: Date;
  syncedAt?: Date;
}

class OfflineFormsDB extends Dexie {
  drafts!: Table<OfflineFormDraft>;
  submissions!: Table<OfflineFormSubmission>;

  constructor() {
    super("ProMainOfflineForms");
    this.version(1).stores({
      drafts: "++id, [versionId+entityType+entityId]",
      submissions: "++id, status, [versionId+entityType+entityId]",
    });
  }
}

export const offlineFormsDB = new OfflineFormsDB();

export async function saveDraftOffline(
  versionId: string,
  entityType: string,
  entityId: string,
  data: Record<string, any>
): Promise<number> {
  const existing = await offlineFormsDB.drafts
    .where({ versionId, entityType, entityId })
    .first();

  if (existing) {
    await offlineFormsDB.drafts.update(existing.id!, {
      data,
      updatedAt: new Date(),
    });
    return existing.id!;
  }

  return await offlineFormsDB.drafts.add({
    versionId,
    entityType,
    entityId,
    data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getDraftOffline(
  versionId: string,
  entityType: string,
  entityId: string
): Promise<OfflineFormDraft | undefined> {
  return await offlineFormsDB.drafts
    .where({ versionId, entityType, entityId })
    .first();
}

export async function deleteDraftOffline(
  versionId: string,
  entityType: string,
  entityId: string
): Promise<void> {
  await offlineFormsDB.drafts
    .where({ versionId, entityType, entityId })
    .delete();
}

export async function queueSubmissionOffline(
  versionId: string,
  entityType: string,
  entityId: string,
  data: Record<string, any>
): Promise<number> {
  await deleteDraftOffline(versionId, entityType, entityId);
  
  return await offlineFormsDB.submissions.add({
    versionId,
    entityType,
    entityId,
    data,
    status: "pending",
    retryCount: 0,
    createdAt: new Date(),
  });
}

export async function getPendingSubmissions(): Promise<OfflineFormSubmission[]> {
  return await offlineFormsDB.submissions
    .where("status")
    .anyOf(["pending", "failed"])
    .toArray();
}

export async function markSubmissionSyncing(id: number): Promise<void> {
  await offlineFormsDB.submissions.update(id, { status: "syncing" });
}

export async function markSubmissionSynced(id: number): Promise<void> {
  await offlineFormsDB.submissions.delete(id);
}

export async function markSubmissionFailed(id: number, error: string): Promise<void> {
  const submission = await offlineFormsDB.submissions.get(id);
  if (submission) {
    await offlineFormsDB.submissions.update(id, {
      status: "failed",
      lastError: error,
      retryCount: submission.retryCount + 1,
    });
  }
}

export async function getPendingCount(): Promise<number> {
  return await offlineFormsDB.submissions
    .where("status")
    .anyOf(["pending", "failed"])
    .count();
}

export async function syncPendingSubmissions(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const pending = await getPendingSubmissions();
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const submission of pending) {
    if (submission.retryCount >= 5) {
      errors.push(`Submission ${submission.id} exceeded max retries`);
      failed++;
      continue;
    }

    await markSubmissionSyncing(submission.id!);

    try {
      const createRes = await fetch("/api/forms/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateVersionId: submission.versionId,
          entityType: submission.entityType,
          entityId: submission.entityId,
          data: submission.data,
        }),
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create submission: ${createRes.status}`);
      }

      const created = await createRes.json();

      const submitRes = await fetch(`/api/forms/submissions/${created.id}/submit`, {
        method: "POST",
        credentials: "include",
      });

      if (!submitRes.ok) {
        throw new Error(`Failed to submit: ${submitRes.status}`);
      }

      await markSubmissionSynced(submission.id!);
      success++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await markSubmissionFailed(submission.id!, errorMsg);
      errors.push(errorMsg);
      failed++;
    }
  }

  return { success, failed, errors };
}
