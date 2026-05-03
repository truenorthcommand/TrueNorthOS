import { db } from "./db";
import { users, clients, clientProperties, clientContacts, jobs, quotes, invoices } from "@shared/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";

/**
 * Seeds the database with realistic B2B property management data
 * for testing Property Intelligence and all phases.
 */
export async function seedDatabase(): Promise<{ message: string; counts: Record<string, number> }> {
  const counts: Record<string, number> = {};

  try {
    // Check if data already exists
    const existingClients = await db.select().from(clients);
    if (existingClients.length > 0) {
      return { message: "Database already has data. Skipping seed.", counts: { existingClients: existingClients.length } };
    }

    // ============================================================
    // SEED USERS (Engineers + Admin)
    // ============================================================
    const hashedPassword = await bcrypt.hash("engineer123", 10);
    const adminPassword = await bcrypt.hash("admin123", 10);

    const seedUsers = [
      { username: "admin", password: adminPassword, name: "James Harrison", email: "james@adaptservicesgroup.co.uk", role: "admin", roles: ["admin", "director"], superAdmin: true },
      { username: "john.smith", password: hashedPassword, name: "John Smith", email: "john@adaptservicesgroup.co.uk", role: "engineer", roles: ["engineer"], superAdmin: false },
      { username: "sarah.williams", password: hashedPassword, name: "Sarah Williams", email: "sarah@adaptservicesgroup.co.uk", role: "engineer", roles: ["engineer"], superAdmin: false },
      { username: "mike.johnson", password: hashedPassword, name: "Mike Johnson", email: "mike@adaptservicesgroup.co.uk", role: "engineer", roles: ["engineer"], superAdmin: false },
      { username: "emma.brown", password: hashedPassword, name: "Emma Brown", email: "emma@adaptservicesgroup.co.uk", role: "engineer", roles: ["engineer", "surveyor"], superAdmin: false },
    ];

    const insertedUsers = await db.insert(users).values(seedUsers).returning();
    counts.users = insertedUsers.length;

    const adminUser = insertedUsers[0];
    const engineer1 = insertedUsers[1];
    const engineer2 = insertedUsers[2];
    const engineer3 = insertedUsers[3];
    const engineer4 = insertedUsers[4];

    // ============================================================
    // SEED CLIENTS (B2B Property Management Companies)
    // ============================================================
    const seedClients = [
      {
        name: "Regency Lettings Ltd",
        email: "office@regencylettings.co.uk",
        phone: "0161 234 5678",
        address: "45 King Street, Manchester, M2 4WQ",
        postcode: "M2 4WQ",
        contactName: "David Thompson",
        notes: "Large lettings agent. 35+ managed properties. Monthly maintenance contract. Premium service level.",
      },
      {
        name: "Northside Block Management",
        email: "enquiries@northsideblocks.co.uk",
        phone: "0161 876 5432",
        address: "Unit 12, Victoria Business Park, Salford, M3 6BX",
        postcode: "M3 6BX",
        contactName: "Rachel Green",
        notes: "Block management company. Manages 8 residential blocks (120+ units). Annual gas safety contract.",
      },
      {
        name: "Pinnacle Property Services",
        email: "maintenance@pinnacleproperty.co.uk",
        phone: "0161 456 7890",
        address: "2nd Floor, Exchange House, Deansgate, Manchester, M3 2QQ",
        postcode: "M3 2QQ",
        contactName: "Mark Stevens",
        notes: "High-end property management. Luxury apartments and penthouses. Premium response times required.",
      },
      {
        name: "HomeFirst Lettings",
        email: "repairs@homefirstlettings.co.uk",
        phone: "0161 333 4444",
        address: "88 Oxford Road, Manchester, M1 5NH",
        postcode: "M1 5NH",
        contactName: "Lisa Chen",
        notes: "Student and young professional lettings. High volume, quick turnaround expected. 50+ properties.",
      },
      {
        name: "Sterling Estates Management",
        email: "ops@sterlingestates.co.uk",
        phone: "0161 555 6666",
        address: "The Boardroom, 1 Spinningfields, Manchester, M3 3AP",
        postcode: "M3 3AP",
        contactName: "Andrew Palmer",
        notes: "Commercial and residential portfolio. Mixed use developments. Strict compliance requirements.",
      },
    ];

    const insertedClients = await db.insert(clients).values(seedClients).returning();
    counts.clients = insertedClients.length;

    // ============================================================
    // SEED PROPERTIES (Multiple per client)
    // ============================================================
    const allProperties: any[] = [];

    // Regency Lettings - 6 properties
    const regencyProps = [
      { clientId: insertedClients[0].id, name: "15 Oak Street", address: "15 Oak Street, Didsbury, Manchester", postcode: "M20 6RT", contactName: "Tenant: Mrs J. Smith", notes: "3-bed terrace. Gas boiler (2019). Last full service Oct 2025." },
      { clientId: insertedClients[0].id, name: "Flat 4, Willow Court", address: "Flat 4, Willow Court, 22 Maple Avenue, Chorlton", postcode: "M21 8PQ", contactName: "Tenant: Mr A. Patel", notes: "2-bed flat. Electric heating. EICR due March 2027." },
      { clientId: insertedClients[0].id, name: "7 Birch Lane", address: "7 Birch Lane, Sale, Manchester", postcode: "M33 4TH", contactName: "Tenant: Ms K. Williams", notes: "4-bed detached. Combi boiler. History of damp issues (north wall)." },
      { clientId: insertedClients[0].id, name: "28 Cedar Road", address: "28 Cedar Road, Stretford, Manchester", postcode: "M32 9AB", contactName: "Tenant: Mr P. O'Brien", notes: "2-bed semi. Recently renovated kitchen. New tenant Jan 2026." },
      { clientId: insertedClients[0].id, name: "Apt 12, The Pines", address: "Apt 12, The Pines, 5 Forest Way, Altrincham", postcode: "WA14 2EF", contactName: "Tenant: Dr S. Khan", notes: "1-bed apartment. Modern build 2020. All electric." },
      { clientId: insertedClients[0].id, name: "91 Elm Drive", address: "91 Elm Drive, Stockport", postcode: "SK4 3GH", contactName: "Tenant: Mrs R. Taylor", notes: "3-bed semi. Older property. Full rewire done 2023." },
    ];

    // Northside Block Management - 4 blocks
    const northsideProps = [
      { clientId: insertedClients[1].id, name: "Victoria Apartments (Block A)", address: "Victoria Apartments, Block A, 100 Chapel Street, Salford", postcode: "M3 5JF", contactName: "Block Manager: Tom Richards", notes: "24 units. Built 2015. Communal boiler system. Fire safety cert current." },
      { clientId: insertedClients[1].id, name: "Victoria Apartments (Block B)", address: "Victoria Apartments, Block B, 100 Chapel Street, Salford", postcode: "M3 5JF", contactName: "Block Manager: Tom Richards", notes: "18 units. Built 2015. Individual boilers. Lift maintenance due Q3 2026." },
      { clientId: insertedClients[1].id, name: "Riverside House", address: "Riverside House, 45 Quay Street, Manchester", postcode: "M3 3HN", contactName: "Site Manager: Helen Wright", notes: "36 units. Converted warehouse. Listed building restrictions apply." },
      { clientId: insertedClients[1].id, name: "Crescent Court", address: "Crescent Court, 8 The Crescent, Salford", postcode: "M5 4PF", contactName: "Site Manager: Dave Morris", notes: "42 units. 1970s build. Major works programme 2026-2027 planned." },
    ];

    // Pinnacle Property - 3 luxury properties
    const pinnacleProps = [
      { clientId: insertedClients[2].id, name: "Penthouse 1, Deansgate Square", address: "Penthouse 1, Deansgate Square Tower 2, Manchester", postcode: "M15 4QF", contactName: "Owner: Mr J. Whitfield", notes: "Premium penthouse. Smart home system. Emergency callout priority." },
      { clientId: insertedClients[2].id, name: "Apt 2301, Beetham Tower", address: "Apt 2301, Beetham Tower, 301 Deansgate, Manchester", postcode: "M3 4LX", contactName: "Owner: Mrs A. Goldstein", notes: "2-bed luxury apartment. Underfloor heating. Annual deep clean included." },
      { clientId: insertedClients[2].id, name: "The Loft, Northern Quarter", address: "The Loft, 15 Stevenson Square, Manchester", postcode: "M1 1FB", contactName: "Owner: Creative Space Ltd", notes: "Commercial/residential loft space. Industrial style. Bespoke fixtures." },
    ];

    // HomeFirst Lettings - 5 properties
    const homefirstProps = [
      { clientId: insertedClients[3].id, name: "42 Fallowfield Road", address: "42 Fallowfield Road, Fallowfield, Manchester", postcode: "M14 6PH", contactName: "HMO - 5 tenants", notes: "5-bed HMO. Student let. High wear & tear. Annual gas check due Sept." },
      { clientId: insertedClients[3].id, name: "18 Rusholme Gardens", address: "18 Rusholme Gardens, Rusholme, Manchester", postcode: "M14 5BT", contactName: "Tenant: Group Let", notes: "4-bed terrace. Young professionals. Recently converted from family home." },
      { clientId: insertedClients[3].id, name: "Flat 7, Student Village", address: "Flat 7, Student Village, Oxford Road, Manchester", postcode: "M13 9RD", contactName: "Tenant: Uni Accommodation Office", notes: "6-bed cluster flat. University managed. Rapid response required." },
      { clientId: insertedClients[3].id, name: "3 Moss Lane East", address: "3 Moss Lane East, Moss Side, Manchester", postcode: "M14 4PX", contactName: "Tenant: Ms D. Okafor", notes: "2-bed flat above shop. Separate entrance. Damp issues recurring." },
      { clientId: insertedClients[3].id, name: "55 Wilmslow Road", address: "55 Wilmslow Road, Withington, Manchester", postcode: "M20 3AW", contactName: "Tenant: Mr L. Garcia", notes: "3-bed semi. Good condition. Long-term tenant (4 years)." },
    ];

    // Sterling Estates - 4 properties
    const sterlingProps = [
      { clientId: insertedClients[4].id, name: "MediaCity Office Suite", address: "Suite 400, The Greenhouse, MediaCityUK, Salford", postcode: "M50 2EQ", contactName: "Facilities: Karen Hughes", notes: "Commercial office. 2000 sqft. Air conditioning system. Quarterly maintenance." },
      { clientId: insertedClients[4].id, name: "Exchange Court Apartments", address: "Exchange Court, 1 Exchange Street, Manchester", postcode: "M2 7EE", contactName: "Concierge: Michael Peters", notes: "12-unit luxury block. 24hr concierge. Premium specifications throughout." },
      { clientId: insertedClients[4].id, name: "Warehouse Unit 5", address: "Unit 5, Regent Trading Estate, Salford", postcode: "M5 3EX", contactName: "Tenant: FastFreight Ltd", notes: "Commercial warehouse. 5000 sqft. Industrial heating. Loading bay." },
      { clientId: insertedClients[4].id, name: "15 King Street Retail", address: "15 King Street, Manchester", postcode: "M2 4NH", contactName: "Tenant: Boutique & Co", notes: "Grade II listed retail unit. Heritage restrictions. Specialist contractors required." },
    ];

    const allPropsData = [...regencyProps, ...northsideProps, ...pinnacleProps, ...homefirstProps, ...sterlingProps];
    const insertedProperties = await db.insert(clientProperties).values(allPropsData).returning();
    counts.properties = insertedProperties.length;

    // ============================================================
    // SEED JOBS (Various statuses across clients)
    // ============================================================
    let jobCounter = 1;
    const makeJobNo = () => `JB${String(jobCounter++).padStart(5, '0')}`;

    const seedJobs = [
      // Regency Lettings jobs
      { jobNo: makeJobNo(), customerName: "Regency Lettings Ltd", client: insertedClients[0].id, propertyId: insertedProperties[0].id, propertyName: "15 Oak Street", address: "15 Oak Street, Didsbury", postcode: "M20 6RT", status: "In Progress", assignedToId: engineer1.id, date: new Date('2026-04-28'), session: "AM", description: "Kitchen refurbishment - Phase 2. Installing new cabinets and worktops.", worksCompleted: "Phase 1 complete: Demolished old kitchen, plumbing rough-in done, electrical first fix complete.", notes: "Client requested change to tile colour. Awaiting confirmation on grey vs white metro tiles." },
      { jobNo: makeJobNo(), customerName: "Regency Lettings Ltd", client: insertedClients[0].id, propertyId: insertedProperties[0].id, propertyName: "15 Oak Street", address: "15 Oak Street, Didsbury", postcode: "M20 6RT", status: "Signed Off", assignedToId: engineer2.id, date: new Date('2026-03-15'), session: "AM", description: "Annual gas safety inspection and certificate renewal.", worksCompleted: "Full gas safety check completed. All appliances tested and passed. Certificate issued.", notes: "Boiler showing early signs of wear on heat exchanger. Recommend monitoring." },
      { jobNo: makeJobNo(), customerName: "Regency Lettings Ltd", client: insertedClients[0].id, propertyId: insertedProperties[2].id, propertyName: "7 Birch Lane", address: "7 Birch Lane, Sale", postcode: "M33 4TH", status: "Awaiting Signatures", assignedToId: engineer1.id, date: new Date('2026-05-01'), session: "PM", description: "Damp investigation and treatment - north wall ground floor.", worksCompleted: "Injected DPC along full length of north wall (8m). Applied tanking slurry. Replastered affected areas.", notes: "Allow 4 weeks drying time before decoration. Recommend dehumidifier." },
      { jobNo: makeJobNo(), customerName: "Regency Lettings Ltd", client: insertedClients[0].id, propertyId: insertedProperties[3].id, propertyName: "28 Cedar Road", address: "28 Cedar Road, Stretford", postcode: "M32 9AB", status: "Ready", assignedToId: engineer3.id, date: new Date('2026-05-05'), session: "AM", description: "Pre-tenancy inspection and minor repairs. Check all fixtures, test smoke alarms, inspect for damage.", notes: "New tenant moving in 10th May. Must be completed by 8th." },
      // Northside Block Management jobs
      { jobNo: makeJobNo(), customerName: "Northside Block Management", client: insertedClients[1].id, propertyId: insertedProperties[6].id, propertyName: "Victoria Apartments (Block A)", address: "Victoria Apartments, Block A, Chapel Street", postcode: "M3 5JF", status: "In Progress", assignedToId: engineer2.id, date: new Date('2026-04-25'), session: "Full Day", description: "Annual gas safety inspections - Block A. 24 units to complete.", worksCompleted: "18/24 units inspected. All passed so far. 6 units remaining (access issues with 3 tenants).", notes: "Need to rearrange access for Units 5, 12, and 19. Lettings office contacting tenants." },
      { jobNo: makeJobNo(), customerName: "Northside Block Management", client: insertedClients[1].id, propertyId: insertedProperties[8].id, propertyName: "Riverside House", address: "Riverside House, 45 Quay Street", postcode: "M3 3HN", status: "Signed Off", assignedToId: engineer3.id, date: new Date('2026-04-10'), session: "AM", description: "Emergency repair - communal heating system failure affecting floors 3-5.", worksCompleted: "Replaced failed circulation pump. Bled all radiators on affected floors. System pressure restored to 1.5 bar.", notes: "Pump was original (2008). Recommend budgeting for full system overhaul 2027." },
      { jobNo: makeJobNo(), customerName: "Northside Block Management", client: insertedClients[1].id, propertyId: insertedProperties[9].id, propertyName: "Crescent Court", address: "Crescent Court, 8 The Crescent", postcode: "M5 4PF", status: "Draft", assignedToId: null, date: new Date('2026-06-01'), session: "Full Day", description: "Major works survey - assess all communal areas, roof condition, external fabric for 2026-2027 programme.", notes: "Quote to follow survey. Budget estimate £450,000 for full programme." },
      // Pinnacle Property jobs
      { jobNo: makeJobNo(), customerName: "Pinnacle Property Services", client: insertedClients[2].id, propertyId: insertedProperties[10].id, propertyName: "Penthouse 1, Deansgate Square", address: "Penthouse 1, Deansgate Square Tower 2", postcode: "M15 4QF", status: "Signed Off", assignedToId: engineer4.id, date: new Date('2026-04-20'), session: "AM", description: "Smart home system maintenance. Update firmware, test all automated systems.", worksCompleted: "Updated Crestron firmware. Tested lighting scenes, HVAC integration, security system. All operational.", notes: "Client wants additional zone added for new home office. Quote to follow." },
      { jobNo: makeJobNo(), customerName: "Pinnacle Property Services", client: insertedClients[2].id, propertyId: insertedProperties[11].id, propertyName: "Apt 2301, Beetham Tower", address: "Apt 2301, Beetham Tower, 301 Deansgate", postcode: "M3 4LX", status: "In Progress", assignedToId: engineer4.id, date: new Date('2026-05-02'), session: "PM", description: "Bathroom renovation - replace walk-in shower screen, retile, install heated mirror.", worksCompleted: "Old shower screen removed. Tiles stripped. Waterproofing membrane applied.", notes: "Specialist glass ordered - 10mm frameless, delivery expected 7th May." },
      // HomeFirst Lettings jobs
      { jobNo: makeJobNo(), customerName: "HomeFirst Lettings", client: insertedClients[3].id, propertyId: insertedProperties[13].id, propertyName: "42 Fallowfield Road", address: "42 Fallowfield Road, Fallowfield", postcode: "M14 6PH", status: "Signed Off", assignedToId: engineer1.id, date: new Date('2026-04-05'), session: "AM", description: "Emergency callout - burst pipe in upstairs bathroom flooding ground floor.", worksCompleted: "Isolated supply. Replaced failed compression fitting. Dried affected areas. Checked for water damage.", notes: "Minor ceiling damage in hallway below. Needs repainting once dry (7 days)." },
      { jobNo: makeJobNo(), customerName: "HomeFirst Lettings", client: insertedClients[3].id, propertyId: insertedProperties[16].id, propertyName: "3 Moss Lane East", address: "3 Moss Lane East, Moss Side", postcode: "M14 4PX", status: "In Progress", assignedToId: engineer2.id, date: new Date('2026-05-01'), session: "AM", description: "Damp treatment - recurring issue in bedroom 1. Third visit this year.", worksCompleted: "Identified source: failed pointing on external wall allowing water ingress. Repointed 3m section.", notes: "Previous treatments only addressed symptoms. Root cause now fixed. Monitor for 4 weeks." },
      // Sterling Estates jobs
      { jobNo: makeJobNo(), customerName: "Sterling Estates Management", client: insertedClients[4].id, propertyId: insertedProperties[18].id, propertyName: "MediaCity Office Suite", address: "Suite 400, The Greenhouse, MediaCityUK", postcode: "M50 2EQ", status: "Ready", assignedToId: engineer3.id, date: new Date('2026-05-06'), session: "AM", description: "Quarterly air conditioning service and filter replacement. All 4 units.", notes: "Access via main reception. Security pass required - collect from Karen Hughes." },
      { jobNo: makeJobNo(), customerName: "Sterling Estates Management", client: insertedClients[4].id, propertyId: insertedProperties[21].id, propertyName: "15 King Street Retail", address: "15 King Street, Manchester", postcode: "M2 4NH", status: "Awaiting Signatures", assignedToId: engineer4.id, date: new Date('2026-04-28'), session: "Full Day", description: "Listed building compliance: replace corroded cast iron rainwater goods with heritage-spec replacements.", worksCompleted: "Removed 12m of damaged cast iron guttering and 2 downpipes. Installed heritage-spec aluminium replacements (RAL 9005 black). All joints sealed and tested.", notes: "Conservation officer approved specification. Building control sign-off obtained." },
    ];

    const insertedJobs = await db.insert(jobs).values(seedJobs as any).returning();
    counts.jobs = insertedJobs.length;

    // ============================================================
    // SEED QUOTES
    // ============================================================
    const seedQuotes = [
      { customerId: insertedClients[0].id, customerName: insertedClients[0].name, quoteNo: "QT-2026-001", description: "Full kitchen renovation including units, worktops, tiling, electrical, and plumbing.", status: "accepted", total: 12500, quoteDate: new Date('2026-03-01') },
      { customerId: insertedClients[0].id, customerName: insertedClients[0].name, quoteNo: "QT-2026-002", description: "New bathroom suite, tiling, heated towel rail, and extractor fan.", status: "pending", total: 4800, quoteDate: new Date('2026-04-20') },
      { customerId: insertedClients[1].id, customerName: insertedClients[1].name, quoteNo: "QT-2026-003", description: "Replace aging communal heating system. New boiler plant, pipework, and controls for 36 units.", status: "sent", total: 85000, quoteDate: new Date('2026-04-15') },
      { customerId: insertedClients[1].id, customerName: insertedClients[1].name, quoteNo: "QT-2026-004", description: "Phase 1: Roof replacement, external redecoration, window overhaul. 42-unit block.", status: "pending", total: 450000, quoteDate: new Date('2026-04-25') },
      { customerId: insertedClients[2].id, customerName: insertedClients[2].name, quoteNo: "QT-2026-005", description: "Add Crestron zone for new home office. Automated blinds, lighting scenes, climate control.", status: "accepted", total: 8500, quoteDate: new Date('2026-04-22') },
      { customerId: insertedClients[3].id, customerName: insertedClients[3].name, quoteNo: "QT-2026-006", description: "Fire door replacements (5), emergency lighting, fire alarm panel upgrade.", status: "sent", total: 6200, quoteDate: new Date('2026-04-28') },
      { customerId: insertedClients[4].id, customerName: insertedClients[4].name, quoteNo: "QT-2026-007", description: "Replace 4x aging split systems with VRF system. Improved efficiency and zone control.", status: "pending", total: 22000, quoteDate: new Date('2026-05-01') },
    ];

    const insertedQuotes = await db.insert(quotes).values(seedQuotes as any).returning();
    counts.quotes = insertedQuotes.length;

    // ============================================================
    // SEED INVOICES
    // ============================================================
    const seedInvoices = [
      { customerId: insertedClients[0].id, customerName: insertedClients[0].name, invoiceNo: "INV-2026-001", status: "paid", total: 6250, dueDate: new Date('2026-04-01'), invoiceDate: new Date('2026-03-15'), notes: "Kitchen Refurbishment Deposit (50%) - 15 Oak Street" },
      { customerId: insertedClients[0].id, customerName: insertedClients[0].name, invoiceNo: "INV-2026-002", status: "sent", total: 6250, dueDate: new Date('2026-05-15'), invoiceDate: new Date('2026-05-01'), notes: "Kitchen Refurbishment Final Payment - 15 Oak Street" },
      { customerId: insertedClients[0].id, customerName: insertedClients[0].name, invoiceNo: "INV-2026-003", status: "paid", total: 180, dueDate: new Date('2026-04-15'), invoiceDate: new Date('2026-03-15'), notes: "Annual Gas Safety Inspection - 15 Oak Street" },
      { customerId: insertedClients[0].id, customerName: insertedClients[0].name, invoiceNo: "INV-2026-004", status: "sent", total: 1850, dueDate: new Date('2026-05-30'), invoiceDate: new Date('2026-05-01'), notes: "DPC Injection & Replastering - 7 Birch Lane" },
      { customerId: insertedClients[1].id, customerName: insertedClients[1].name, invoiceNo: "INV-2026-005", status: "paid", total: 4320, dueDate: new Date('2026-04-30'), invoiceDate: new Date('2026-04-10'), notes: "Gas Safety Inspections - Block A (18 units completed)" },
      { customerId: insertedClients[1].id, customerName: insertedClients[1].name, invoiceNo: "INV-2026-006", status: "overdue", total: 2800, dueDate: new Date('2026-04-20'), invoiceDate: new Date('2026-04-10'), notes: "Emergency Heating Repair - Riverside House" },
      { customerId: insertedClients[2].id, customerName: insertedClients[2].name, invoiceNo: "INV-2026-007", status: "paid", total: 450, dueDate: new Date('2026-05-01'), invoiceDate: new Date('2026-04-20'), notes: "Smart Home Maintenance - Penthouse 1, Deansgate Square" },
      { customerId: insertedClients[3].id, customerName: insertedClients[3].name, invoiceNo: "INV-2026-008", status: "paid", total: 380, dueDate: new Date('2026-04-20'), invoiceDate: new Date('2026-04-05'), notes: "Emergency Callout - Burst Pipe - 42 Fallowfield Road" },
      { customerId: insertedClients[3].id, customerName: insertedClients[3].name, invoiceNo: "INV-2026-009", status: "sent", total: 950, dueDate: new Date('2026-05-30'), invoiceDate: new Date('2026-05-01'), notes: "Damp Treatment & Repointing - 3 Moss Lane East" },
      { customerId: insertedClients[4].id, customerName: insertedClients[4].name, invoiceNo: "INV-2026-010", status: "sent", total: 3200, dueDate: new Date('2026-05-28'), invoiceDate: new Date('2026-04-28'), notes: "Heritage Rainwater Goods Replacement - 15 King Street" },
    ];

    const insertedInvoices = await db.insert(invoices).values(seedInvoices as any).returning();
    counts.invoices = insertedInvoices.length;

    // ============================================================
    // SEED CLIENT CONTACTS
    // ============================================================
    const seedContacts = [
      { clientId: insertedClients[0].id, name: "David Thompson", email: "david@regencylettings.co.uk", phone: "0161 234 5678", role: "Director", isPrimary: true },
      { clientId: insertedClients[0].id, name: "Jenny Morris", email: "jenny@regencylettings.co.uk", phone: "0161 234 5679", role: "Maintenance Coordinator" },
      { clientId: insertedClients[1].id, name: "Rachel Green", email: "rachel@northsideblocks.co.uk", phone: "0161 876 5432", role: "Operations Manager", isPrimary: true },
      { clientId: insertedClients[1].id, name: "Tom Richards", email: "tom@northsideblocks.co.uk", phone: "0161 876 5433", role: "Block Manager" },
      { clientId: insertedClients[2].id, name: "Mark Stevens", email: "mark@pinnacleproperty.co.uk", phone: "0161 456 7890", role: "Managing Director", isPrimary: true },
      { clientId: insertedClients[3].id, name: "Lisa Chen", email: "lisa@homefirstlettings.co.uk", phone: "0161 333 4444", role: "Property Manager", isPrimary: true },
      { clientId: insertedClients[4].id, name: "Andrew Palmer", email: "andrew@sterlingestates.co.uk", phone: "0161 555 6666", role: "Director", isPrimary: true },
      { clientId: insertedClients[4].id, name: "Karen Hughes", email: "karen@sterlingestates.co.uk", phone: "0161 555 6667", role: "Facilities Manager" },
    ];

    const insertedContacts = await db.insert(clientContacts).values(seedContacts).returning();
    counts.contacts = insertedContacts.length;

    return {
      message: `Database seeded successfully! Created ${counts.users} users, ${counts.clients} clients, ${counts.properties} properties, ${counts.jobs} jobs, ${counts.quotes} quotes, ${counts.invoices} invoices, ${counts.contacts} contacts.`,
      counts,
    };
  } catch (error: any) {
    console.error('[Seed] Error:', error.message);
    throw new Error(`Seed failed: ${error.message}`);
  }
}
