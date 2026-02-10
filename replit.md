# TrueNorth OS

*Field Service ERP - Built For Trades By Trades*

## Overview

TrueNorth OS is a comprehensive business management platform designed for UK trade and field service companies. It aims to digitise and streamline all operational aspects, from job management, quoting, and invoicing to financial tracking, fleet management, workforce coordination, quality control, and compliance. The platform integrates seven core modules and leverages AI-powered tools to enhance efficiency, reduce costs, and improve customer experience, providing an all-in-one ERP solution tailored for the UK market.

## Company Details

-   **Contact Email**: info@truenorthoperationsgroup.com
-   **Address**: Unit 2 Meadow View Industrial Estate, Ashford, Kent, TN26 2NR
-   **Phone**: Not displayed publicly (user preference)
-   **Logo**: `/client/public/logo-truenorth-os.png` — used in sidebar, login page, public header, mobile header

## User Preferences

- I prefer clear and concise communication.
- I appreciate detailed explanations when technical decisions are made.
- I prefer an iterative development approach.
- I expect the agent to ask for confirmation before making significant architectural changes.
- Ensure all AI-powered features are highlighted and explained clearly.
- No phone number displayed in public-facing contact sections.

## System Architecture

TrueNorth OS is built with a modern web stack.

### Frontend
-   **Technology**: React with TypeScript.
-   **Structure**: Organised into pages for main views, `lib` for core functionalities like authentication and state management, and `components` for reusable UI elements.
-   **UI/UX**: Focus on a clean, intuitive interface specific to UK trade workflows.

### Backend
-   **Technology**: Express.js with TypeScript.
-   **Structure**: `routes.ts` handles API endpoints and authentication, `storage.ts` manages database interactions, and `db.ts` establishes PostgreSQL connections.
-   **Authentication**: Session cookie-based authentication with role-based access control (Admin, Engineer, Super Admin). Engineers have restricted access to their assigned jobs.
-   **Validation**: Job sign-off requires evidence photos, engineer and customer signatures, and geolocation capture.

### Database
-   **Type**: PostgreSQL.
-   **Key Schemas**:
    -   `users`: User accounts, roles, location tracking, 2FA, GDPR consent.
    -   `jobs`, `quotes`, `invoices`, `clients`: Core operational data.
    -   `timesheets`, `expenses`, `payments`: Financial tracking and approval workflows.
    -   `engineer_locations`: GPS tracking history.
    -   `ai_advisors`: AI configuration.
    -   `company_settings`: Business configuration.
    -   `job_updates`, `conversations`, `messages`: Communication and collaboration.
    -   `vehicles`, `walkaround_checks`, `defects`: Fleet management.
    -   `skills`, `user_skills`: Workforce skill management.

### Routing Architecture (Feb 2026)
-   **Public Marketing Site**: Public-facing pages at root level (`/`, `/pricing`, `/about`, `/contact`, `/register`, `/checkout`, `/checkout/success`, `/privacy`, `/terms`). Uses `PublicLayout` component with shared header (nav, login/register buttons) and footer.
-   **Authenticated App**: All private routes nested under `/app/` prefix using wouter v3's `nest` prop. Dashboard at `/app`, jobs at `/app/jobs`, etc.
-   **Auth Flow**: Login redirects to `/app`. Logout uses `window.location.href` to navigate to `/login` (escapes nested router context). Unauthenticated access to `/app/*` redirects to `/login`.
-   **Client-Facing Pages**: Public pages with tokens (`/quote/:token`, `/portal/:token`, `/invoice/:token`) remain at root level.
-   **Sidebar Navigation**: Uses relative paths (`/jobs`, `/clients`, etc.) which resolve correctly under the nested `/app` base via wouter v3.

### Key Features and Design Choices
-   **Modular Design**: Seven integrated modules for Operations, Finance, Fleet, Workforce, Quality Control, Compliance, and Intelligence.
-   **AI Integration**: Extensive use of AI for features like job assignment, pricing advice, receipt OCR, web search, conversation memory, quality assessment, and client document scanning.
-   **UK Specific Compliance**: Built-in support for HMRC mileage rates, UK VAT calculations, Gas Safe, and BS 7671 regulations.
-   **Role-Based Access Control**: Granular permissions based on user roles (Admin, Engineer, Super Admin).
-   **Two-Factor Authentication (2FA)**: TOTP-based for enhanced security.
-   **Progressive Web App (PWA)**: Mobile-first design with offline capabilities.
-   **File Storage**: Centralized file browser with AI-powered smart assignment and integration with Replit Object Storage.
-   **Unified Clock In/Out System**: Dashboard-based time tracking that logs to both `time_logs` (for tracking) and `timesheets` (for finance) tables with geolocation capture.
-   **Workflow Automation Engine**: Rules engine with typed conditions (job_status, time_elapsed, field_missing, priority, field_value) and actions (EscalateJob, NotifyUser, BlockCompletion, CreateTask, SendNotification, UpdateEntityField, CallWebhook, EmitEvent). Multi-condition builder UI, test-against-job functionality, execution log viewer with step details. Domain events queue worker processes rules automatically.
-   **Blog Management System**: Admin CRUD interface at `/app/blog` for creating, editing, and publishing blog posts. Supports cover image upload via Object Storage, HTML content, categories, and draft/published workflow. Public blog page at `/blog` displays published posts. Database-backed with `blog_posts` table.

### Global AI Assistant Architecture (Jan 2026)
The Global AI Assistant has been optimized for production readiness:

-   **Modular Structure**: Split into focused modules under `server/globalAssistant/`:
    -   `routes.ts`: API endpoints
    -   `context.ts`: Intent-based context building with bounded queries
    -   `tokenBudget.ts`: Token budgeting (12k char cap, entity limits)
    -   `cache.ts`: TTL-based caching (24h summary, 6h insights, 30m suggestions)
    -   `config.ts`: Centralized model configuration with fallback
    -   `retry.ts`: Exponential backoff for reliability
    -   `search.ts`: Web search with improved trigger detection
    -   `insights.ts`: Smart insights and suggestions
    -   `prompts.ts`: System prompts
    -   `openai.ts`: OpenAI client management

-   **Performance Optimizations**:
    -   Intent-based queries (bounded: 25 jobs, 25 clients, 50 quotes/invoices)
    -   SQL aggregates instead of full record fetching
    -   Postgres-backed ai_cache table for derived context
    -   Token budgeting prevents context overflow

-   **Reliability Features**:
    -   Retry with exponential backoff (429/5xx/timeouts)
    -   Model fallback (gpt-4o → gpt-4-turbo-preview)
    -   Clean client disconnect handling
    -   User-friendly error messages

-   **Frontend Enhancements**:
    -   Markdown rendering for AI responses
    -   Per-message copy button
    -   Retry button for error states

## External Dependencies

-   **OpenAI API**: For various AI Advisors and intelligent features.
-   **Google Maps API**: For live GPS tracking, geocoding, and location-based services.
-   **Stripe**: For secure card payment processing, supporting invoice payments directly from the client portal.
-   **Replit Object Storage**: For scalable file storage and management.