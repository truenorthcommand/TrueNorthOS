# TrueNorth OS — End-to-End Workflow Specification

**Status:** APPROVED  
**Version:** 1.0  
**Date:** 2026-05-07  
**Author:** Agent Zero + Admin  

---

## Overview

This document defines the complete business workflow from initial customer enquiry through to payment receipt. Every feature, automation, and UI in TrueNorth OS should align to this pipeline.

---

## Pipeline Summary

```
ENQUIRY → [SURVEY] → QUOTE → JOB → SIGN-OFF → INVOICE → PAYMENT
```

---

## Entity Lifecycle

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  ENQUIRY    │────▶│   SURVEY     │────▶│    QUOTE     │────▶│     JOB      │────▶│  SIGN-OFF    │────▶│   INVOICE    │────▶│   PAYMENT    │
│  (Lead)     │ or  │  (Optional)  │     │  (Proposal)  │     │  (Execution) │     │  (QA)        │     │  (Billing)   │     │  (Complete)  │
│             │skip │              │     │              │     │              │     │              │     │              │     │              │
│ Admin       │────▶│ Surveyor     │     │ Admin/       │     │ Engineers/   │     │ Works Mgr    │     │ Admin/       │     │ Auto/        │
│ creates     │     │ captures     │     │ Surveyor     │     │ Trades       │     │ inspects     │     │ Accounts     │     │ Stripe       │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

---

## 1. ENQUIRY (Lead Capture)

### Purpose
Capture incoming work requests from customers. This is the entry point for ALL work.

### Created By
- Admin (from phone call, email, walk-in)
- Website chatbot (auto-creates from conversation)
- Client portal (customer self-service request)

### Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Auto | |
| `client_id` | FK → clients | Yes | Existing or create new |
| `property_id` | FK → properties | Yes | Which property is the work for |
| `source` | Enum | Yes | phone, email, website, referral, repeat_customer |
| `description` | Text | Yes | Brief description of work wanted |
| `client_requirements` | Text | No | Specific requests from customer |
| `budget_indication` | Text | No | Customer's budget if mentioned |
| `urgency` | Enum | Yes | emergency, urgent, standard, flexible |
| `preferred_dates` | Text | No | When customer wants it done |
| `assigned_to` | FK → users | No | Who's handling this enquiry |
| `status` | Enum | Yes | See below |
| `created_at` | Timestamp | Auto | |
| `updated_at` | Timestamp | Auto | |

### Statuses
```
new → survey_booked → survey_complete → quote_sent → won → lost → cancelled
         │                                              │
         └──────── (skip survey) ───────────────────────┘
```

### Actions
| Action | Trigger | Result |
|--------|---------|--------|
| Send to Survey | Admin clicks "Book Survey" | Creates Survey entity linked to enquiry, assigns surveyor, status → `survey_booked` |
| Send to Quote | Admin clicks "Create Quote" | Opens quote wizard pre-filled with enquiry data, status → `quote_sent` |
| Mark Won | Quote accepted | Status → `won`, auto-creates Job |
| Mark Lost | Admin marks lost | Status → `lost`, captures reason |

---

## 2. SURVEY (Site Inspection)

### Purpose
On-site data capture by surveyor. Captures everything needed to produce an accurate quote.

### Created By
- Auto-created when admin sends enquiry to survey
- Surveyor can also create ad-hoc from mobile

### Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Auto | |
| `enquiry_id` | FK → enquiries | No | Links back to original request |
| `client_id` | FK → clients | Yes | |
| `property_id` | FK → properties | Yes | |
| `surveyor_id` | FK → users | Yes | Assigned surveyor |
| `survey_type` | Enum | Yes | bathroom, kitchen, full, electrical, roofing, external, custom |
| `status` | Enum | Yes | draft, in_progress, complete |
| `condition_rating` | Enum | No | excellent, good, fair, poor, urgent |
| `general_notes` | Text | No | Overall observations |
| `access_notes` | Text | No | Parking, key access, etc |
| `safety_notes` | Text | No | Hazards, asbestos, etc |
| `client_preferences` | Text | No | What client specifically wants |
| `timeline` | Text | No | Customer's timeline expectations |
| `gps_lat` | Decimal | No | Property GPS |
| `gps_lng` | Decimal | No | |
| `created_at` | Timestamp | Auto | |
| `completed_at` | Timestamp | No | When marked complete |

### Sub-entities

#### Survey Rooms
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `survey_id` | FK | |
| `room_name` | Text | e.g., "Master Bathroom" |
| `room_type` | Enum | bathroom, kitchen, bedroom, living, hallway, external, utility, etc |
| `notes` | Text | Room-specific observations |
| `length_m` | Decimal | Room length in metres |
| `width_m` | Decimal | Room width in metres |
| `height_m` | Decimal | Ceiling height in metres |
| `condition` | Enum | excellent, good, fair, poor |
| `checklist_ref` | JSONB | Reference checklist items for this room type |

#### Survey Work Items
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `survey_room_id` | FK | |
| `description` | Text | What work is needed |
| `type` | Enum | material, labour, both |
| `priority` | Enum | essential, recommended, optional |
| `quantity` | Decimal | |
| `unit` | Text | sqm, lm, each, hours, etc |
| `length_m` | Decimal | Item-specific measurement |
| `width_m` | Decimal | |
| `height_m` | Decimal | |
| `notes` | Text | Additional detail |

#### Survey Media
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `survey_id` | FK | |
| `survey_room_id` | FK (optional) | |
| `file_url` | Text | Path to uploaded file |
| `file_type` | Enum | photo, video, document |
| `caption` | Text | Description of what's shown |

### Statuses
```
draft → in_progress → complete
```

### Actions
| Action | Trigger | Result |
|--------|---------|--------|
| Start Survey | Surveyor opens on-site | Status → `in_progress` |
| Mark Complete | Surveyor finishes | Status → `complete`, notifies admin |
| Create Quote | Admin/surveyor clicks | Opens Quote wizard pre-filled from survey data |

---

## 3. QUOTE (Commercial Proposal)

### Purpose
Formal proposal sent to customer with pricing, scope, T&Cs.

### Pre-fill Logic
When created from a survey, the quote wizard auto-populates:
- Client & property from survey
- Line items generated from survey work items:
  - Description → line item description
  - Quantity + unit → line item quantity
  - Measurements → area/volume calculations
  - Priority → included (essential) or optional extras section
- Room grouping preserved
- Surveyor just adds: **unit prices, markup, T&Cs, validity**

### Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Auto | |
| `quote_no` | Text | Auto | Sequential: QUO-001, QUO-002 |
| `enquiry_id` | FK | No | |
| `survey_id` | FK | No | |
| `client_id` | FK | Yes | |
| `property_id` | FK | Yes | |
| `status` | Enum | Yes | See below |
| `version` | Integer | Yes | For revisions (v1, v2, v3) |
| `subtotal` | Decimal | Auto | Sum of line items |
| `vat_rate` | Decimal | Yes | Default 20% |
| `vat_amount` | Decimal | Auto | |
| `total` | Decimal | Auto | |
| `valid_until` | Date | Yes | Quote expiry date |
| `payment_terms` | Text | No | e.g., "50% deposit, 50% on completion" |
| `terms_conditions` | Text | No | Standard T&Cs |
| `notes` | Text | No | Additional notes for customer |
| `sent_at` | Timestamp | No | When sent to customer |
| `accepted_at` | Timestamp | No | When customer accepted |
| `rejected_at` | Timestamp | No | |
| `rejection_reason` | Text | No | Why rejected |

### Quote Line Items
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `quote_id` | FK | |
| `room_name` | Text | For grouping display |
| `description` | Text | Work description |
| `quantity` | Decimal | |
| `unit` | Text | sqm, lm, each, hours |
| `unit_price` | Decimal | Price per unit (ex VAT) |
| `total` | Decimal | quantity × unit_price |
| `category` | Enum | material, labour, both |
| `is_optional` | Boolean | Optional extras shown separately |
| `sort_order` | Integer | Display ordering |

### Statuses
```
draft → sent → accepted → rejected → revised → expired
                  │           │
                  │           └── reason captured, can create v2
                  └── auto-creates Job
```

### Actions
| Action | Trigger | Result |
|--------|---------|--------|
| Send to Customer | Admin clicks send | Status → `sent`, customer gets email/portal link |
| Customer Accepts | Portal click or admin marks | Status → `accepted`, auto-creates Job |
| Customer Rejects | Portal click or admin marks | Status → `rejected`, captures reason |
| Revise Quote | Admin creates revision | New quote (version +1) linked to same enquiry |
| Expired | Past valid_until date | Status → `expired` (automated) |

---

## 4. JOB (Work Execution)

### Purpose
The actual work being done. Created automatically when a quote is accepted.

### Auto-creation from Quote
When quote accepted, system creates:
- Job entity with client, property, scope from quote
- If simple job (single trade, ≤1 day): single job, single assignment
- If complex job (multi-trade or multi-day): creates **Job Phases**

### Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Auto | |
| `job_no` | Text | Auto | Sequential: JOB-001 |
| `quote_id` | FK | No | |
| `client_id` | FK | Yes | |
| `property_id` | FK | Yes | |
| `status` | Enum | Yes | See below |
| `is_complex` | Boolean | No | Multi-trade or multi-day |
| `description` | Text | Yes | |
| `scheduled_start` | Date | No | |
| `scheduled_end` | Date | No | |
| `actual_start` | Timestamp | No | |
| `actual_end` | Timestamp | No | |
| `assigned_to` | FK → users | No | Primary engineer (simple jobs) |
| `priority` | Enum | No | low, normal, high, urgent |

### Job Phases (Complex Jobs)
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `job_id` | FK | |
| `phase_number` | Integer | Sequential order |
| `title` | Text | e.g., "First Fix Plumbing" |
| `trade_type` | Enum | plumber, electrician, plasterer, tiler, labourer, etc |
| `assigned_to` | FK → users | Which tradesperson |
| `status` | Enum | pending, ready, in_progress, complete |
| `estimated_duration` | Text | e.g., "2 days" |
| `depends_on` | FK → phases | Which phase must complete first |
| `scheduled_date` | Date | |
| `completed_at` | Timestamp | |
| `sign_off_notes` | Text | |

### Phase Dependencies & Triggers
```
Phase 1 (Strip-out) COMPLETE
    ↓ auto-triggers
Phase 2 (First Fix) status → READY, notifies assigned tradesperson
    ↓ when complete
Phase 3 (Plastering) status → READY
    ↓ ... and so on
Final Phase COMPLETE
    ↓ auto-triggers
Sign-off Request → Works Manager notified
```

### Statuses
```
scheduled → in_progress → phases_complete → sign_off_pending → complete → invoiced
```

### Variation Orders (Scope Changes)
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `job_id` | FK | |
| `description` | Text | What changed |
| `reason` | Text | Why (customer request, unforeseen issue) |
| `additional_cost` | Decimal | |
| `status` | Enum | proposed, approved, rejected |
| `approved_by` | Text | Customer name/signature |
| `approved_at` | Timestamp | |

---

## 5. SIGN-OFF (Quality Assurance)

### Purpose
Final inspection before invoicing. For complex jobs: works manager snag check. For simple jobs: engineer self-certifies or works manager spot-checks.

### Trigger
- Simple job: Engineer marks complete → optional sign-off
- Complex job: All phases complete → **mandatory** works manager sign-off

### Fields
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `job_id` | FK | |
| `inspector_id` | FK → users | Works manager / senior |
| `status` | Enum | pending, passed, failed, snagged |
| `inspection_date` | Timestamp | |
| `overall_rating` | Enum | excellent, satisfactory, needs_work |
| `notes` | Text | |
| `photos` | JSONB | Before/after evidence |
| `customer_signature` | Text | Base64 or URL |
| `signed_at` | Timestamp | |

### Snag Items (if issues found)
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `sign_off_id` | FK | |
| `description` | Text | What's wrong |
| `severity` | Enum | critical, minor, cosmetic |
| `photo_url` | Text | Evidence |
| `assigned_to` | FK | Who fixes it |
| `status` | Enum | open, in_progress, resolved |
| `resolved_at` | Timestamp | |

### Flow
```
Inspection
    ├── PASSED → triggers Invoice creation
    └── SNAGGED → snag items created → assigned for fix
                      └── all resolved → re-inspection → PASSED
```

---

## 6. INVOICE (Billing)

### Purpose
Bill the customer for completed work.

### Trigger
- Sign-off PASSED → auto-creates invoice
- Or: staged invoices created at milestones (deposit, progress, final)

### Invoice Types
| Type | When | Amount |
|------|------|--------|
| Deposit | Quote accepted | % of total (configurable, e.g., 25%) |
| Progress | Phase milestone | % of total |
| Final | Job complete + sign-off | Remaining balance + variation orders |
| Full | Simple jobs | 100% on completion |

### Fields
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `invoice_no` | Text | Sequential: INV-001 |
| `job_id` | FK | |
| `quote_id` | FK | |
| `client_id` | FK | |
| `type` | Enum | deposit, progress, final, full |
| `subtotal` | Decimal | |
| `vat_rate` | Decimal | |
| `vat_amount` | Decimal | |
| `total` | Decimal | |
| `status` | Enum | draft, sent, viewed, paid, overdue, cancelled |
| `due_date` | Date | |
| `sent_at` | Timestamp | Admin manually sends |
| `paid_at` | Timestamp | |
| `payment_method` | Text | Stripe, bank transfer, cash, etc |
| `stripe_payment_id` | Text | If paid via Stripe |

### Statuses
```
draft → sent → viewed → paid
                  │
                  └── overdue (past due_date, auto-status)
```

### Actions
| Action | Trigger | Result |
|--------|---------|--------|
| Create | Sign-off passed | Auto-creates with line items from quote + variations |
| Send | Admin clicks send | Email/portal to customer, status → `sent` |
| Mark Paid | Stripe webhook or admin | Status → `paid`, triggers payment confirmation |
| Chase | Overdue + admin action | Sends reminder email |

---

## 7. PAYMENT (Completion)

### Purpose
Final step — money received, everyone happy.

### Trigger
- Stripe webhook confirms payment
- Or admin manually marks as paid

### Actions on Payment
1. Invoice status → `paid`
2. Customer receives:
   - Payment confirmation email
   - Receipt/thank you message
   - Request for review (optional)
3. Job status → `invoiced` (all invoices paid)
4. Accounts updated (revenue tracking)
5. Enquiry status → fully closed

---

## Automation Rules

| Trigger | Automation |
|---------|------------|
| Enquiry created | Notify assigned admin |
| Survey marked complete | Notify admin "ready for quoting" |
| Quote accepted | Auto-create Job (with phases if complex) |
| Quote expired | Notify admin, update status |
| Phase completed | Trigger next dependent phase, notify tradesperson |
| All phases complete | Trigger sign-off request to works manager |
| Sign-off passed | Auto-create invoice |
| Invoice overdue | Auto-send reminder (configurable: 3, 7, 14 days) |
| Payment received | Confirm to customer, update accounts |
| Quote rejected | Notify admin with reason |

---

## Role Permissions

| Entity | Admin | Surveyor | Engineer | Works Mgr | Accounts | Client Portal |
|--------|-------|----------|----------|-----------|----------|---------------|
| Enquiry | CRUD | View | — | View | — | Create (own) |
| Survey | CRUD | CRUD (own) | — | View | — | — |
| Quote | CRUD | Create/View | — | View | View | View/Accept/Reject |
| Job | CRUD | View | Update (own) | CRUD | View | View status |
| Sign-off | View | — | Self-certify | CRUD | — | Sign |
| Invoice | CRUD | — | — | View | CRUD | View/Pay |

---

## UI Pages Required

| Page | Purpose | Priority |
|------|---------|----------|
| `/enquiries` | Enquiry list + pipeline view | P1 |
| `/enquiries/new` | Create enquiry | P1 |
| `/enquiries/:id` | Enquiry detail | P1 |
| `/surveys` | Survey list | P1 (exists ✅) |
| `/surveys/new` | Survey wizard (4-step) | P1 (needs rebuild) |
| `/surveys/:id` | Survey detail/edit | P1 (exists ✅) |
| `/quotes` | Quote list | P1 (exists ✅) |
| `/quotes/new` | Quote wizard | P1 (exists ✅, needs pre-fill) |
| `/quotes/:id` | Quote detail | P1 (exists ✅) |
| `/jobs` | Job list | P1 (exists ✅) |
| `/jobs/new` | Create job | P1 (exists ✅) |
| `/jobs/:id` | Job detail + phases | P1 (exists ✅, needs phases) |
| `/jobs/:id/sign-off` | Sign-off wizard | P2 |
| `/invoices` | Invoice list | P1 (exists ✅) |
| `/invoices/:id` | Invoice detail | P1 (exists ✅) |

---

## What Exists vs What Needs Building

### ✅ Already Built
- Client management (CRUD + properties)
- Survey wizard (needs rebuild with new flow)
- Quote creation (needs pre-fill from survey)
- Job management (needs phases + dependencies)
- Invoice management (needs auto-creation trigger)
- Sign-off / Snagging (basic version exists)
- User roles + permissions
- Stripe integration

### 🔨 Needs Building
- **Enquiry system** (new entity, pages, pipeline view)
- **Survey wizard rebuild** (4-step, measurements, template→rooms)
- **Quote pre-fill from survey** (auto-populate line items)
- **Job Phases** (dependencies, sequential triggering)
- **Auto-job creation** from accepted quote
- **Variation Orders** (scope changes during job)
- **Sign-off trigger** (phases complete → works manager)
- **Invoice auto-creation** (sign-off passed → invoice)
- **Payment confirmation flow** (Stripe webhook → customer email)
- **Automation engine** (trigger → action system) — partially exists via workflow-routes

### 🔧 Needs Modification
- Survey routes (add measurements, link to enquiry)
- Quote wizard (pre-fill from survey data)
- Job detail page (add phases view)
- Invoice creation (trigger from sign-off)

---

## Implementation Priority

| Phase | Scope | Entities |
|-------|-------|----------|
| **Phase 1** | Core pipeline | Enquiry → Survey (rebuild) → Quote (pre-fill) |
| **Phase 2** | Job execution | Auto-job creation → Phases → Dependencies |
| **Phase 3** | Completion | Sign-off trigger → Invoice auto-create → Payment flow |
| **Phase 4** | Advanced | Variation orders, staged invoicing, analytics |

---

*This document is the source of truth for TrueNorth OS workflow. All features should reference this spec.*
