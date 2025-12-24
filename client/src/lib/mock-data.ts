import { Job, User } from "./types";

export const MOCK_USERS: User[] = [
  {
    id: "admin-1",
    name: "Dispatcher Dave",
    email: "admin@fieldflow.com",
    role: "admin",
  },
  {
    id: "eng-1",
    name: "John Smith",
    email: "john@fieldflow.com",
    role: "engineer",
  },
  {
    id: "eng-2",
    name: "Sarah Jones",
    email: "sarah@fieldflow.com",
    role: "engineer",
  },
];

export const MOCK_JOBS: Job[] = [
  {
    id: "job-101",
    jobNo: "J-2024-101",
    customerName: "Acme Corp",
    address: "123 Industrial Way, Tech Park",
    postcode: "TP1 2AB",
    contactName: "Mike Manager",
    contactPhone: "07700 900123",
    contactEmail: "mike@acme.com",
    date: new Date().toISOString(),
    startTime: "09:00",
    description: "Annual HVAC maintenance service. Filter replacement and system check.",
    notes: "Access code for gate: 1234. Park around back.",
    status: "In Progress",
    assignedToId: "eng-1",
    materials: [
      { id: "m-1", name: "Air Filter F5", quantity: "2" },
      { id: "m-2", name: "System Cleaner", quantity: "1 bottle" },
    ],
    photos: [],
    signatures: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "job-102",
    jobNo: "J-2024-102",
    customerName: "Residential Client",
    address: "42 Maple Drive",
    postcode: "MD4 5XY",
    contactName: "Mrs. Robinson",
    contactPhone: "07700 900456",
    contactEmail: "robinson@email.com",
    date: new Date(Date.now() + 86400000).toISOString(),
    startTime: "14:00",
    description: "Boiler repair - reported leaking.",
    notes: "Dog is friendly.",
    status: "Draft",
    assignedToId: "eng-1",
    materials: [],
    photos: [],
    signatures: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "job-103",
    jobNo: "J-2024-103",
    customerName: "TechHub Offices",
    address: "Unit 5, Innovation Centre",
    postcode: "IC9 9ZZ",
    contactName: "IT Support",
    contactPhone: "01632 960000",
    contactEmail: "support@techhub.com",
    date: new Date(Date.now() - 172800000).toISOString(),
    startTime: "10:00",
    description: "Install new data cabling points in meeting room.",
    notes: "",
    status: "Signed Off",
    assignedToId: "eng-2",
    materials: [
      { id: "m-3", name: "CAT6 Cable", quantity: "50m" },
      { id: "m-4", name: "Faceplates", quantity: "4" },
    ],
    photos: [
      { id: "p-1", url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=200", timestamp: new Date().toISOString() }
    ],
    signatures: [
      { id: "s-1", type: "engineer", name: "Sarah Jones", url: "mock_sig", timestamp: new Date().toISOString() },
      { id: "s-2", type: "customer", name: "IT Manager", url: "mock_sig", timestamp: new Date().toISOString() }
    ],
    createdAt: new Date(Date.now() - 200000000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
