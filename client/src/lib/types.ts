export type Role = 'admin' | 'engineer' | 'surveyor' | 'fleet_manager' | 'works_manager';

export type Skill = {
  id: string;
  name: string;
  category: string;
  icon?: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  roles?: Role[];
  username?: string;
  superAdmin?: boolean;
  hasDirectorsSuite?: boolean;
  twoFactorEnabled?: boolean;
  currentLat?: number;
  currentLng?: number;
  lastLocationUpdate?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  homePostcode?: string;
  homeLat?: number;
  homeLng?: number;
  licencePhotoUrl?: string;
  licenceUploadedAt?: string;
  skills?: Skill[];
  managerId?: string;
};

export const hasRole = (user: User | null, ...requiredRoles: Role[]): boolean => {
  if (!user) return false;
  if (user.superAdmin) return true;
  const userRoles = user.roles || [user.role];
  return requiredRoles.some(role => userRoles.includes(role));
};

export type JobStatus = 'Ready' | 'Draft' | 'In Progress' | 'Awaiting Signatures' | 'Signed Off';

export type Material = {
  id: string;
  name: string;
  quantity: string;
};

export type Photo = {
  id: string;
  url: string;
  timestamp: string;
  source: 'admin' | 'engineer';
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
  nickname: string | null;
  client: string | null;
  customerName: string;
  propertyId: string | null;
  propertyName: string | null;
  address: string | null;
  postcode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  date: string | null;
  session: string | null;
  orderNumber: number | null;
  description: string | null;
  worksCompleted: string | null;
  notes: string | null;
  status: JobStatus;
  assignedToId: string | null;
  assignedToIds: string[];
  materials: Material[];
  photos: Photo[];
  signatures: Signature[];
  furtherActions: FurtherAction[];
  signOffLat?: number | null;
  signOffLng?: number | null;
  signOffAddress?: string | null;
  signOffTimestamp?: string | null;
  orderIndex?: number;
  isLongRunning?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type JobUpdate = {
  id: string;
  jobId: string;
  workDate: string;
  sequence: number;
  notes: string | null;
  photos: Photo[];
  engineerId: string | null;
  createdAt: string;
};
