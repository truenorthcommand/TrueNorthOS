# TrueNorth Trade OS

The complete operating system for UK trade and field service businesses. Run your entire operation from one platform — jobs, quotes, invoices, timesheets, expenses, fleet, team messaging, quality control, and AI-powered tools.

## Overview

TrueNorth Trade OS is a comprehensive business management platform that enables trade and field service companies to digitise and streamline every aspect of their operation. From initial enquiry to final payment, everything is integrated and built specifically for UK tradespeople.

## Platform Classification

**Trade Business Operating System** — an all-in-one ERP suite comparable to ServiceTitan, Simpro, and BigChange, but purpose-built for UK compliance and trade workflows.

## Seven Integrated Modules

### 1. Operations
- Job management with full lifecycle tracking
- Quoting with VAT calculations (0/5/20%)
- Invoice generation with bank transfer details
- Client CRM with automatic record creation
- Quote-to-job workflow automation
- Client portal for quote acceptance
- Photo evidence (admin reference & engineer evidence)
- Digital signatures for sign-off
- Long-running job tracking with daily updates

### 2. Finance
- Timesheets with clock in/out
- Expense tracking with receipt upload
- Mileage calculator (HMRC rates: 45p/25p per mile)
- Payment collection and tracking
- Financial reporting
- Approval workflows for timesheets and expenses

### 3. Fleet
- Vehicle registry management
- Daily walkaround checks (pre/post use)
- Defect reporting and tracking
- Defect workflow (open → in progress → resolved → closed)
- Vehicle status tracking (active/off-road/maintenance)
- Compliance record keeping

### 4. Workforce
- Team messaging (WhatsApp-style)
- Live GPS tracking with map view
- **Multi-role system**: Users can have multiple roles (admin, engineer, surveyor, fleet_manager, works_manager)
- **Staff skills management**: Assign trade skills to staff (plumbing, electrical, HVAC, etc.)
- **AI-powered job assignment**: Smart engineer suggestions based on skills, workload, and location
- **Works Manager Portal**: Team oversight with dashboard, job management, team map, and approvals
- Role-based access with flexible permissions
- Weekly planner
- Engineer assignment and workload management

### 5. Quality Control
- **Site Inspections** - Pre-start, progress, final, and handover inspections
- Inspection checklists with pass/fail/N/A for each item
- Categories: Structure, Electrical, Plumbing, Safety, Finishes, External
- Inspector and client signature capture
- Photo evidence for each inspection item
- **Snagging Sheets** - Punch lists for tracking defects
- Snag items with priority (low, medium, high, critical)
- Status workflow: open → in progress → resolved → verified
- Progress tracking (X/Y snags resolved)
- Completion photos and client sign-off

### 6. Compliance
- Two-Factor Authentication (TOTP-based 2FA)
- GDPR compliance (consent tracking, data export, deletion requests)
- Geo-verified sign-offs with reverse geocoding
- Full audit trails
- Cookie consent and privacy controls

### 7. Intelligence (AI-Powered)
- Snagging Pro - Quality assessment specialist
- Trade Parts Finder - UK parts sourcing
- Gas & Heating Expert - Boiler diagnostics & Gas Safe
- Electrical Expert - BS 7671 wiring regulations
- AI Writing Assistant - Spelling, grammar, voice-to-text, read-aloud
- Photo analysis capabilities
- **Voice Notes** - Speech-to-text transcription with AI summarization for job updates
- **Quote Pricing Advisor** - AI-powered pricing suggestions based on historical data
- **Receipt OCR** - Automatic data extraction from expense receipts

## Future AI Enhancements (Planned)

### Operational Efficiency
- **Smart Job Scheduling** - AI that optimizes engineer routes and schedules based on location, traffic, skills, and job duration estimates
- **Automated Report Generation** - Generate professional job completion reports from photos, notes, and job data
- **Document Scanner** - Extract data from supplier invoices, contracts, and certificates automatically

### Financial
- **Automated Invoice Chasing** - AI-generated follow-up messages for overdue payments
- **Cash Flow Forecasting** - Predict income based on scheduled jobs, quotes, and payment patterns

### Quality & Compliance
- **Safety Risk Assessment** - Analyze site photos to identify potential hazards before work begins
- **Compliance Checker** - Verify completed work meets Gas Safe, BS 7671, and other UK regulations

### Customer Experience
- **Smart Customer Communications** - Auto-generate appointment reminders, job updates, and thank-you messages
- **Sentiment Analysis** - Analyze customer feedback to flag potential issues

### Workforce
- **Training Recommendations** - Suggest certifications based on job types and skill gaps

## Key Features Summary

- **Role-based Authentication**: Admin, Engineer, and Super Admin roles
- **Two-Factor Authentication (2FA)**: TOTP-based using authenticator apps
- **PWA Support**: Installable mobile app with offline caching
- **UK-Focused**: HMRC mileage rates, UK VAT, Gas Safe, BS 7671 built in

## User Credentials (Demo)

- Admin: `admin` / `admin123`
- Engineer: `john` / `john123`
- Engineer: `sarah` / `sarah123`

## Pricing & Implementation

### Pricing Structure

All plans include professional implementation with setup, testing, data migration, and training.

| Tier | Implementation Fee | Monthly per User | Minimum Term |
|------|-------------------|------------------|--------------|
| **Starter** | £500 | £39 | 12 months |
| **Professional** | £1,500 | £69 | 12 months |
| **Business** | £3,500 | £99 | 12 months |
| **Enterprise** | £7,500+ | £149 | 24 months |

### What's Included

**Starter - £500 setup + £39/user/month**
- Core operations (jobs, quotes, invoices)
- Basic finance (timesheets, expenses)
- Client CRM
- Mobile app access
- Remote setup and configuration
- 2-hour video training session
- Email support

**Professional - £1,500 setup + £69/user/month**
- Everything in Starter
- Full finance module with approvals
- Team messaging
- Live GPS tracking
- AI advisors (Trade Parts, Gas Expert, Electrical Expert)
- Quality control (inspections, snagging)
- Weekly planner/calendar
- Full-day on-site or remote training
- Priority email support

**Business - £3,500 setup + £99/user/month**
- Everything in Professional
- Fleet management (vehicles, walkaround checks, defects)
- Works Manager portal
- Advanced reporting and analytics
- Multi-engineer job assignment with AI suggestions
- Staff skills management
- Voice notes with AI transcription
- 2-day implementation and training
- Phone and email support

**Enterprise - £7,500+ setup + £149/user/month**
- Everything in Business
- Unlimited users
- White-label branding (your logo, colours, domain)
- Custom integrations (Xero, Sage, QuickBooks)
- Dedicated implementation manager
- Full week of on-site implementation
- SLA guarantees
- Dedicated account manager
- Priority phone support

### Target Customers by Tier

- **Starter**: Solo traders and micro-businesses (1-2 users)
- **Professional**: Growing trade companies (3-10 users)
- **Business**: Established firms with fleet and compliance needs (10-25 users)
- **Enterprise**: Large operations wanting white-label solution (25+ users)

### Example Annual Values

| Company Size | Tier | Year 1 Total | Year 2+ Annual |
|--------------|------|--------------|----------------|
| 2 engineers | Starter | £1,436 | £936 |
| 5 engineers | Professional | £5,640 | £4,140 |
| 15 engineers | Business | £21,320 | £17,820 |
| 30 engineers | Enterprise | £61,060+ | £53,640 |

## Architecture

### Frontend (React + TypeScript)
- `/client/src/pages/` - Page components
- `/client/src/lib/` - Auth, store, types
- `/client/src/components/` - Reusable UI components

### Backend (Express + TypeScript)
- `/server/routes.ts` - API endpoints with authentication
- `/server/storage.ts` - Database operations
- `/server/db.ts` - PostgreSQL connection

### Database (PostgreSQL)
- `users` - User accounts with roles, location tracking, 2FA settings, GDPR consent
- `jobs` - Job records with materials, photos, signatures
- `clients` - Client records (name, email, phone, address, postcode)
- `quotes` - Quote records with line items, linked to clients and jobs
- `invoices` - Invoice records with payment details
- `timesheets` - Clock in/out records with approval workflow
- `expenses` - Expense claims with mileage, receipts, approval workflow
- `payments` - Payment records linked to invoices
- `engineer_locations` - Location history for GPS tracking
- `ai_advisors` - AI assistant configurations
- `company_settings` - Company details, bank info, VAT rates
- `job_updates` - Daily progress updates for long-running jobs
- `conversations` - Chat conversations (direct or group)
- `conversation_members` - Members with read status
- `messages` - Chat messages with sender and timestamp
- `vehicles` - Fleet vehicles (registration, make, model, status)
- `walkaround_checks` - Daily vehicle checks (pre/post use)
- `check_items` - Individual check items (tyres, lights, brakes, etc.)
- `defects` - Vehicle defects with severity and workflow status
- `defect_updates` - Comment/update history for defects
- `skills` - Trade skills (plumbing, electrical, HVAC, etc.)
- `user_skills` - Junction table linking users to their skills

## Sign-off Validation Rules

Before a job can be signed off:
1. At least one evidence photo must be uploaded
2. Engineer signature must be captured
3. Customer signature must be captured
4. Geolocation must be captured

## API Authentication

All API routes (except login and seed) require authentication via session cookies. Engineers can only access their assigned jobs; admins have full access.

## Environment Variables

- `OPENAI_API_KEY` - Required for AI Advisors functionality
- `GOOGLE_MAPS_API_KEY` - Required for live map and geocoding
- `SETUP_KEY` - Required to enable the /setup password reset endpoint
- `STRIPE_SECRET_KEY` - Required for Stripe card payments (server-side)
- `STRIPE_PUBLISHABLE_KEY` - Required for Stripe card payments (client-side)
- `STRIPE_WEBHOOK_SECRET` - Required to verify Stripe webhook signatures

## Payment Integration

### Stripe Card Payments
The client invoice portal supports card payments via Stripe. When configured:
- Customers can pay invoices directly by card from the client portal
- Payments are processed in GBP with proper pence conversion
- Webhook handlers automatically record payments and update invoice status
- Payment intent creation requires valid invoice access token or session auth
- Duplicate webhook deliveries are handled idempotently
