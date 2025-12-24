export type Role = 'admin' | 'engineer';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type JobStatus = 'Draft' | 'In Progress' | 'Awaiting Signatures' | 'Signed Off';

export type Material = {
  id: string;
  name: string;
  quantity: string;
};

export type Photo = {
  id: string;
  url: string;
  timestamp: string;
};

export type Signature = {
  id: string;
  type: 'engineer' | 'customer';
  name: string;
  url: string; // base64
  timestamp: string;
};

export type Job = {
  id: string;
  jobNo: string;
  customerName: string;
  address: string;
  postcode: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  date: string; // ISO string
  startTime: string;
  description: string;
  notes: string;
  status: JobStatus;
  assignedToId: string;
  materials: Material[];
  photos: Photo[];
  signatures: Signature[];
  createdAt: string;
  updatedAt: string;
};
