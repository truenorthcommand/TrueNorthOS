import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Job, Material, Photo, Signature, FurtherAction } from "./types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "./auth";

interface StoreContextType {
  jobs: Job[];
  isLoading: boolean;
  refreshJobs: () => Promise<void>;
  getJob: (id: string) => Job | undefined;
  addJob: (job: Partial<Job>) => Promise<Job | null>;
  updateJob: (id: string, updates: Partial<Job>) => Promise<void>;
  addMaterial: (jobId: string, material: Omit<Material, "id">) => Promise<void>;
  removeMaterial: (jobId: string, materialId: string) => Promise<void>;
  addPhoto: (jobId: string, url: string, source?: 'admin' | 'engineer') => Promise<void>;
  removePhoto: (jobId: string, photoId: string) => Promise<void>;
  addSignature: (jobId: string, signature: Omit<Signature, "id" | "timestamp">) => Promise<void>;
  addFurtherAction: (jobId: string, action: Omit<FurtherAction, "id" | "timestamp">) => Promise<void>;
  removeFurtherAction: (jobId: string, actionId: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  signOffJob: (id: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const refreshJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = user?.role === 'engineer' 
        ? `/api/jobs?engineerId=${user.id}` 
        : '/api/jobs';
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const normalizedJobs = data.map((job: any) => ({
          ...job,
          materials: job.materials || [],
          photos: job.photos || [],
          signatures: job.signatures || [],
          furtherActions: job.furtherActions || [],
        }));
        setJobs(normalizedJobs);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshJobs();
    }
  }, [user, refreshJobs]);

  const getJob = (id: string) => jobs.find((j) => j.id === id);

  const addJob = async (jobData: Partial<Job>): Promise<Job | null> => {
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(jobData),
      });
      if (response.ok) {
        const newJob = await response.json();
        await refreshJobs();
        toast({ title: "Job Created", description: `Job ${newJob.jobNo} has been created.` });
        return newJob;
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create job", variant: "destructive" });
    }
    return null;
  };

  const updateJob = async (id: string, updates: Partial<Job>) => {
    try {
      const response = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        await refreshJobs();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update job", variant: "destructive" });
    }
  };

  const deleteJob = async (id: string) => {
    try {
      const response = await fetch(`/api/jobs/${id}`, { method: "DELETE", credentials: 'include' });
      if (response.ok) {
        await refreshJobs();
        toast({ title: "Job Deleted", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete job", variant: "destructive" });
    }
  };

  const addMaterial = async (jobId: string, material: Omit<Material, "id">) => {
    const job = getJob(jobId);
    if (!job) return;
    const newMaterial: Material = { ...material, id: `mat-${Date.now()}` };
    await updateJob(jobId, {
      materials: [...(job.materials || []), newMaterial],
    });
  };

  const removeMaterial = async (jobId: string, materialId: string) => {
    const job = getJob(jobId);
    if (!job) return;
    await updateJob(jobId, {
      materials: (job.materials || []).filter((m) => m.id !== materialId),
    });
  };

  const addPhoto = async (jobId: string, url: string, source: 'admin' | 'engineer' = 'engineer') => {
    const job = getJob(jobId);
    if (!job) return;
    const newPhoto: Photo = {
      id: `p-${Date.now()}`,
      url,
      timestamp: new Date().toISOString(),
      source,
    };
    await updateJob(jobId, {
      photos: [...(job.photos || []), newPhoto],
    });
  };

  const removePhoto = async (jobId: string, photoId: string) => {
    const job = getJob(jobId);
    if (!job) return;
    await updateJob(jobId, {
      photos: (job.photos || []).filter((p) => p.id !== photoId),
    });
  };

  const addSignature = async (jobId: string, signature: Omit<Signature, "id" | "timestamp">) => {
    const job = getJob(jobId);
    if (!job) return;
    const newSig: Signature = {
      ...signature,
      id: `sig-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    await updateJob(jobId, {
      signatures: [...(job.signatures || []), newSig],
    });
  };

  const addFurtherAction = async (jobId: string, action: Omit<FurtherAction, "id" | "timestamp">) => {
    const job = getJob(jobId);
    if (!job) return;
    const newAction: FurtherAction = {
      ...action,
      id: `fa-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    await updateJob(jobId, {
      furtherActions: [...(job.furtherActions || []), newAction],
    });
  };

  const removeFurtherAction = async (jobId: string, actionId: string) => {
    const job = getJob(jobId);
    if (!job) return;
    await updateJob(jobId, {
      furtherActions: (job.furtherActions || []).filter((a) => a.id !== actionId),
    });
  };

  const signOffJob = async (id: string) => {
    try {
      const job = getJob(id);
      const response = await fetch(`/api/jobs/${id}/sign-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ 
          signatures: job?.signatures 
        }),
      });
      if (response.ok) {
        await refreshJobs();
        toast({
          title: "Job Signed Off",
          description: "Signatures recorded successfully.",
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to sign off job", variant: "destructive" });
    }
  };

  return (
    <StoreContext.Provider
      value={{
        jobs,
        isLoading,
        refreshJobs,
        getJob,
        addJob,
        updateJob,
        addMaterial,
        removeMaterial,
        addPhoto,
        removePhoto,
        addSignature,
        addFurtherAction,
        removeFurtherAction,
        deleteJob,
        signOffJob,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
