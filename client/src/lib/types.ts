export type Role = 'admin' | 'engineer';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  username?: string;
  currentLat?: number;
  currentLng?: number;
  lastLocationUpdate?: string;
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
  url: string;
  timestamp: string;
};

export type ActionPriority = 'low' | 'medium' | 'high' | 'urgent';

export type FurtherAction = {
  id: string;
  description: string;
  priority: ActionPriority;
  timestamp: string;
};

export type Job = {
  id: string;
  jobNo: string;
  client: string | null;
  customerName: string;
  address: string | null;
  postcode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  date: string | null;
  startTime: string | null;
  description: string | null;
  notes: string | null;
  status: JobStatus;
  assignedToId: string | null;
  materials: Material[];
  photos: Photo[];
  signatures: Signature[];
  furtherActions: FurtherAction[];
  signOffLat?: number | null;
  signOffLng?: number | null;
  signOffAddress?: string | null;
  signOffTimestamp?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
