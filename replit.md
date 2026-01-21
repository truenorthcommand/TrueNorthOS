# Foreman

*Keeping operations on track - Powered by TrueNorth OS*

## Overview

Foreman is a comprehensive business management platform designed for UK trade and field service companies. It aims to digitise and streamline all operational aspects, from job management, quoting, and invoicing to financial tracking, fleet management, workforce coordination, quality control, and compliance. The platform integrates seven core modules and leverages AI-powered tools to enhance efficiency, reduce costs, and improve customer experience, providing an all-in-one ERP solution tailored for the UK market.

## User Preferences

- I prefer clear and concise communication.
- I appreciate detailed explanations when technical decisions are made.
- I prefer an iterative development approach.
- I expect the agent to ask for confirmation before making significant architectural changes.
- Ensure all AI-powered features are highlighted and explained clearly.

## System Architecture

Foreman is built with a modern web stack.

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

### Key Features and Design Choices
-   **Modular Design**: Seven integrated modules for Operations, Finance, Fleet, Workforce, Quality Control, Compliance, and Intelligence.
-   **AI Integration**: Extensive use of AI for features like job assignment, pricing advice, receipt OCR, web search, conversation memory, and quality assessment.
-   **UK Specific Compliance**: Built-in support for HMRC mileage rates, UK VAT calculations, Gas Safe, and BS 7671 regulations.
-   **Role-Based Access Control**: Granular permissions based on user roles (Admin, Engineer, Super Admin).
-   **Two-Factor Authentication (2FA)**: TOTP-based for enhanced security.
-   **Progressive Web App (PWA)**: Mobile-first design with offline capabilities.
-   **File Storage**: Centralized file browser with AI-powered smart assignment and integration with Replit Object Storage.

## External Dependencies

-   **OpenAI API**: For various AI Advisors and intelligent features.
-   **Google Maps API**: For live GPS tracking, geocoding, and location-based services.
-   **Stripe**: For secure card payment processing, supporting invoice payments directly from the client portal.
-   **Replit Object Storage**: For scalable file storage and management.