import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  saveDraftOffline,
  getDraftOffline,
  queueSubmissionOffline,
  getPendingCount,
  syncPendingSubmissions,
  type OfflineFormDraft,
} from "@/lib/offline-forms";

export function useOfflineForms() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
    return count;
  }, []);

  const saveDraft = useCallback(
    async (
      versionId: string,
      entityType: string,
      entityId: string,
      data: Record<string, any>
    ) => {
      await saveDraftOffline(versionId, entityType, entityId, data);
    },
    []
  );

  const getDraft = useCallback(
    async (
      versionId: string,
      entityType: string,
      entityId: string
    ): Promise<OfflineFormDraft | undefined> => {
      return await getDraftOffline(versionId, entityType, entityId);
    },
    []
  );

  const queueSubmission = useCallback(
    async (
      versionId: string,
      entityType: string,
      entityId: string,
      data: Record<string, any>
    ) => {
      await queueSubmissionOffline(versionId, entityType, entityId, data);
      await refreshPendingCount();

      if (!navigator.onLine) {
        toast({
          title: "Saved for Sync",
          description: "Form will be submitted when you're back online.",
        });
      }
    },
    [refreshPendingCount, toast]
  );

  const syncPending = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await syncPendingSubmissions();
      await refreshPendingCount();

      if (result.success > 0) {
        toast({
          title: "Forms Synced",
          description: `${result.success} form${result.success > 1 ? "s" : ""} submitted successfully.`,
        });
      }

      if (result.failed > 0 && result.errors.length > 0) {
        toast({
          title: "Sync Issues",
          description: `${result.failed} form${result.failed > 1 ? "s" : ""} failed to sync.`,
          variant: "destructive",
        });
      }

      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount, toast]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPending();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    refreshPendingCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncPending, refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    saveDraft,
    getDraft,
    queueSubmission,
    syncPending,
    refreshPendingCount,
  };
}
