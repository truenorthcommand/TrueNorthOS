# TrueNorth Field View

A comprehensive Field Service ERP Suite for UK field engineers and tradespeople. Run your entire business from one platform — jobs, quotes, invoices, timesheets, expenses, fleet, team messaging, and AI-powered tools.

## Overview

TrueNorth Field View is a "business in a box" platform that enables field service companies to manage all aspects of their operation digitally. From job management and quoting to financial tracking and fleet maintenance, everything is integrated and built specifically for UK tradespeople.

## Platform Classification

**Field Service ERP / All-in-One Operations Suite** — comparable to ServiceTitan, Simpro, and Jobber Pro.

## Six Integrated Modules

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
- Role-based access (Admin, Engineer, Super Admin)
- Weekly planner
- Engineer assignment and workload management

### 5. Compliance
- Two-Factor Authentication (TOTP-based 2FA)
- GDPR compliance (consent tracking, data export, deletion requests)
- Geo-verified sign-offs with reverse geocoding
- Full audit trails
- Cookie consent and privacy controls

### 6. Intelligence (AI-Powered)
- Snagging Pro - Quality assessment specialist
- Trade Parts Finder - UK parts sourcing
- Gas & Heating Expert - Boiler diagnostics & Gas Safe
- Electrical Expert - BS 7671 wiring regulations
- AI Writing Assistant - Spelling, grammar, voice-to-text, read-aloud
- Photo analysis capabilities

## Key Features Summary

- **Role-based Authentication**: Admin, Engineer, and Super Admin roles
- **Two-Factor Authentication (2FA)**: TOTP-based using authenticator apps
- **PWA Support**: Installable mobile app with offline caching
- **UK-Focused**: HMRC mileage rates, UK VAT, Gas Safe, BS 7671 built in

## User Credentials (Demo)

- Admin: `admin` / `admin123`
- Engineer: `john` / `john123`
- Engineer: `sarah` / `sarah123`

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

## Pricing Tiers

- **Starter**: £29/user/month - Core operations and basic finance
- **Professional**: £49/user/month - Full finance, team messaging, GPS, AI advisors
- **Business**: £79/user/month - Everything plus fleet management and advanced features
- **Enterprise**: Custom pricing - Unlimited users, white-label, custom integrations
