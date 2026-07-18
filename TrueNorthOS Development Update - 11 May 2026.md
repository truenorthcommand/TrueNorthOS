# ReactPMS — Development Update

**Date:** 11th May 2026
**Session:** Platform cleanup, architecture improvements & new feature development

---

## Platform Cleanup & Code Quality

1. **Removed legacy Replit/AI code** — 327 files and 12,494 lines of dead code removed. Faster builds, smaller bundle size, cleaner codebase.

2. **Removed Enquiries module** — Pages, routes, API endpoints, and automation removed. Simplified workflow — everything now goes through Jobs.

3. **Removed Blog module** — Blog functionality moved to the Adapt Services Group website. Less clutter in the admin panel.

4. **Removed old survey system** — Legacy rooms, work-items, media and template endpoints removed. One clean job-based survey flow remains.

5. **Removed QR Scanner & Quick Scan icons** — Desktop, mobile, and floating buttons removed. Cleaner UI header.

6. **Removed Bookings system** — Separate bookings replaced by Job Visits. No more double-handling of scheduling.

**Net result:** Approximately 17,000 lines of dead code removed. Application is smaller, faster, and more maintainable.

---

## Bug Fixes

1. **Deploy failing** — Removed stale file reference that was causing the server build to fail.

2. **Surveys page blank** — Fixed route mismatch where the page was using a survey ID instead of a job ID. Rewrote to use job-centric navigation.

3. **Feedback page blank** — Fixed API response format mismatch and restricted access to admin only.

4. **Booking postcode error** — Fixed property ID type mismatch. The system was treating UUID strings as integers, which meant the selected property postcode was never being read.

5. **Property Intelligence errors** — Added database migration to create the required intelligence tables that were missing.

6. **Database migration error** — Fixed foreign key type mismatch on the survey_photos table.

---

## New Features

### Global Search Bar

- Search bar added to the top header (desktop)
- Keyboard shortcut: Ctrl+K to focus
- Searches across Jobs (name, number, address), Clients (name, email, phone), and Quotes (name, number, address)
- Instant results with categorised dropdown
- Click any result to navigate directly to that record

### Enhanced Per-Page Search

- Quotes page now searches by site address, postcode, and description
- Invoices page now searches by site address and description
- All pages can find records by client name, job number, or address

### Job Pricing (Reactive Works)

- Optional Agreed Price field on Create Job Sheet
- Supports pre-agreed spend limits (e.g. £250 fix without formal quote)
- VAT rate selector (0%, 5%, 20%)
- Auto-calculates total including VAT
- Editable until invoice is sent, then automatically locked
- Shows on Job Detail page with clear pricing breakdown

### Job Visits System (Replaces Bookings)

- New job_visits database table linked to jobs
- Create Job Sheet now creates a visit record automatically
- Job Detail page has a Visits tab showing all scheduled visits
- Add additional visits from Job Detail (survey, install, inspection sequence)
- Calendar and Planner now show job visits with colour-coded type badges
- Visit types: Survey, Job, Snagging, Inspection, Follow-up, General

### Visit Type Selector on Create Job Sheet

- New Visit Type dropdown on Step 3 (Job Details)
- Options: Survey, Job, Snagging, Inspection, Follow-up, General
- Default set to "Job" for most common use

### Role-Based Staff Assignment

- Step 4 now says "Assign Staff & Send" instead of "Assign Engineer & Send"
- Staff list filtered by visit type:
  - Survey — shows Surveyors
  - Job — shows Engineers
  - Snagging — shows Works Managers
  - Inspection — shows Works Managers
  - Follow-up — shows Engineers
  - General — shows everyone
- Each staff member shows their role tag (surveyor, engineer, works manager)
- Admins appear in all lists as a fallback

### Pricing Auto-Lock on Invoice

- When an invoice is generated from a job, the agreed price is automatically locked
- Prevents accidental changes after billing
- Clear "Locked" badge shown on Job Detail

---

## Architecture Improvements

| Area | Before | After |
|------|--------|-------|
| Workflow | Enquiry → Survey → Quote → Job → Invoice (fragmented) | Job → Visit → Quote → Invoice (single source of truth) |
| Scheduling | Separate Bookings system + Jobs system (double handling) | Job Visits only — one place for all scheduling |
| Survey flow | Enquiry-oriented with rooms/work-items | Job-centric — notes + photos on the job |
| Authentication | Duplicate Replit OIDC + custom auth | Custom auth only (username/password + Google OAuth ready) |
| File storage | Replit Object Storage service | Local disk storage |
| Search | Per-page only, limited fields | Global search + enhanced per-page search |

---

## Build Metrics

| Metric | Before | After |
|--------|--------|-------|
| JS bundle size | 3,297 KB | 3,162 KB |
| CSS bundle size | 204 KB | 188 KB |
| Dead code removed | — | ~17,000 lines |

---

## Deployment

All changes committed and deployed automatically via Railway. The application is live at adaptservicesgroup.app.

---

*Prepared by the development team — 11 May 2026*