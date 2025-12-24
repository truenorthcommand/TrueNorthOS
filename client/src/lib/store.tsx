import React, { createContext, useContext, useState, useEffect } from "react";
import { Job, Material, Photo, Signature, JobStatus } from "./types";
import { MOCK_JOBS } from "./mock-data";
import { useToast } from "@/hooks/use-toast";

interface StoreContextType {
  jobs: Job[];
  getJob: (id: string) => Job | undefined;
  addJob: (job: Omit<Job, "id" | "createdAt" | "updatedAt">) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  addMaterial: (jobId: string, material: Omit<Material, "id">) => void;
  removeMaterial: (jobId: string, materialId: string) => void;
  addPhoto: (jobId: string, url: string) => void;
  removePhoto: (jobId: string, photoId: string) => void;
  addSignature: (jobId: string, signature: Omit<Signature, "id" | "timestamp">) => void;
  deleteJob: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const { toast } = useToast();

  // Load from local storage on mount (if we wanted persistence across reloads)
  // For now, we stick to memory + MOCK_JOBS init
  
  const getJob = (id: string) => jobs.find((j) => j.id === id);

  const addJob = (newJobData: Omit<Job, "id" | "createdAt" | "updatedAt">) => {
    const newJob: Job = {
      ...newJobData,
      id: `job-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setJobs((prev) => [newJob, ...prev]);
    toast({ title: "Job Created", description: `Job ${newJob.jobNo} has been created.` });
  };

  const updateJob = (id: string, updates: Partial<Job>) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === id ? { ...job, ...updates, updatedAt: new Date().toISOString() } : job
      )
    );
  };

  const deleteJob = (id: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== id));
    toast({ title: "Job Deleted", variant: "destructive" });
  };

  const addMaterial = (jobId: string, material: Omit<Material, "id">) => {
    const newMaterial: Material = { ...material, id: `mat-${Date.now()}` };
    updateJob(jobId, {
      materials: [...(getJob(jobId)?.materials || []), newMaterial],
    });
  };

  const removeMaterial = (jobId: string, materialId: string) => {
    const job = getJob(jobId);
    if (!job) return;
    updateJob(jobId, {
      materials: job.materials.filter((m) => m.id !== materialId),
    });
  };

  const addPhoto = (jobId: string, url: string) => {
    const newPhoto: Photo = {
      id: `p-${Date.now()}`,
      url,
      timestamp: new Date().toISOString(),
    };
    updateJob(jobId, {
      photos: [...(getJob(jobId)?.photos || []), newPhoto],
    });
  };

  const removePhoto = (jobId: string, photoId: string) => {
    const job = getJob(jobId);
    if (!job) return;
    updateJob(jobId, {
      photos: job.photos.filter((p) => p.id !== photoId),
    });
  };

  const addSignature = (jobId: string, signature: Omit<Signature, "id" | "timestamp">) => {
    const newSig: Signature = {
      ...signature,
      id: `sig-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    updateJob(jobId, {
      signatures: [...(getJob(jobId)?.signatures || []), newSig],
    });
  };

  return (
    <StoreContext.Provider
      value={{
        jobs,
        getJob,
        addJob,
        updateJob,
        addMaterial,
        removeMaterial,
        addPhoto,
        removePhoto,
        addSignature,
        deleteJob
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
