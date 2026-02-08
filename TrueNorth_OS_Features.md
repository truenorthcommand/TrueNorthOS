# TrueNorth OS - Full Features & Functions List

*Field Service Management For The Trades*

---

## Core Platform

- Progressive Web App (PWA) - installable on mobile/tablet/desktop with offline support
- Role-based access control (Super Admin, Admin, Engineer)
- Session-based authentication with secure login
- Two-Factor Authentication (2FA) via TOTP
- GDPR consent management and cookie preferences
- Dark mode / light mode toggle
- Accordion-style sidebar navigation
- Real-time notifications

---

## 1. Operations Module

### Job Management

- Create, edit, and manage job sheets
- Drag-and-drop job planner/scheduler
- Support for up to 5 jobs per engineer per day
- Job statuses (pending, scheduled, in progress, completed, invoiced)
- Job notes and description fields
- Job sign-off with evidence photos, engineer signature, customer signature, and geolocation capture
- Job updates and activity feed
- Completed jobs archive

### Client Management

- Full client database (name, email, phone, address)
- Client history and linked jobs/quotes/invoices
- Client portal with email-based authentication
- Client document scanning (AI-powered)

### Quoting

- Create and manage quotes
- Quote line items with quantities and pricing
- Quote-to-job conversion
- Quote statuses (draft, sent, accepted, rejected)
- PDF quote generation

---

## 2. Finance Module

### Invoicing

- Create and manage invoices
- Invoice line items with UK VAT calculations
- Invoice statuses (draft, sent, paid, overdue)
- PDF invoice generation
- Invoice-to-payment tracking
- Client portal invoice payments via Stripe

### Expenses

- Expense submission with receipt upload
- AI-powered receipt OCR (auto-reads receipt details)
- Expense approval workflow
- Expense categories and tracking

### Payments

- Payment recording and tracking
- Stripe card payment integration
- Payment history per client/invoice

### Timesheets & Time Tracking

- Unified clock in/out system from dashboard (all roles)
- Geolocation capture on clock in and clock out
- Dual logging to time_logs (tracking) and timesheets (finance)
- Timesheet approval workflow
- Elapsed time display while on shift
- HMRC mileage rate support

---

## 3. Fleet Module

### Vehicle Management

- Vehicle database (registration, make, model, MOT, insurance)
- Vehicle assignment to engineers

### Walkaround Checks

- Digital daily vehicle walkaround check forms
- Photo evidence capture
- Defect reporting and tracking
- Defect resolution workflow

---

## 4. Workforce Module

### Team Management

- Engineer/staff directory
- Role and permission assignment
- Live GPS location tracking on map (Google Maps)
- Location history

### Skills Management

- Skills database with 15 default trade skills
- Sub-skills (49 defaults) for granular competency tracking
- Assign skills to engineers
- Skill-based job matching

### Scheduling

- Drag-and-drop job planner
- Engineer availability view
- Daily schedule view per engineer

---

## 5. Quality Control Module

### Job Sign-Off

- Mandatory evidence photo capture
- Engineer digital signature
- Customer digital signature
- Geolocation verification at sign-off
- AI-powered quality assessment of completed work

### Form Templates

- 12 built-in form templates for trade workflows
- Custom form creation
- Digital form completion and storage

---

## 6. Compliance Module

### Regulatory Support

- Gas Safe regulation references
- BS 7671 (Wiring Regulations) support
- Part P compliance tracking
- Building regulations guidance
- UK-specific terminology throughout

### Audit Logging

- Comprehensive audit trail with checksum validation
- Tamper-evident logging
- User action tracking

---

## 7. Intelligence Module (AI-Powered)

### Global AI Assistant

- Natural language chat interface
- Conversation memory (remembers previous chats)
- Web search for products, suppliers, regulations
- Clickable links to UK trade suppliers (Screwfix, Toolstation, City Plumbing, etc.)
- Business data queries (jobs, clients, quotes, invoices)
- Proactive suggestions and insights
- Markdown-formatted responses with copy button
- Retry on error with model fallback (GPT-4o to GPT-4 Turbo)
- Token budgeting and response caching

### AI Advisors

- AI-powered job assignment recommendations
- Pricing advice based on historical data
- Smart file assignment
- Client document scanning and analysis

---

## 8. Communication

### Messaging

- Internal conversations and messaging
- Job-linked communication threads
- Team collaboration tools

### Email Integration

- Outlook email integration
- Email notifications

---

## 9. Portals

- **Works Manager Portal** - Team management, approvals, quality oversight
- **Fleet Manager Portal** - Vehicle checks, defect management, fleet oversight
- **Surveyor Portal** - Quotes, client management, site surveys
- **Accounts Portal** - Invoices, receipts, costs, financial overview
- **Director's Suite** - Executive dashboards and business analytics
- **Client Portal** - Secure client access for invoices and job updates

---

## 10. File Management

- Centralised file browser
- AI-powered smart file assignment to jobs/clients
- Replit Object Storage integration
- Photo and document upload

---

## 11. Dashboard & Reporting

- Business overview dashboard (active jobs, pending quotes, unpaid invoices, team count)
- Today's schedule view
- Pending approvals widget
- Clock in/out status card
- Quick actions (New Client, New Quote)
