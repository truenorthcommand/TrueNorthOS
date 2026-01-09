# TrueNorth Field View

A web-based job sheet application for field engineers with authentication, job management, photo uploads, signature capture, GPS tracking, AI assistants, and PDF generation.

## Overview

This application enables field service companies to manage job sheets digitally. Engineers can view assigned jobs, add materials, upload photos, capture signatures, and sign off jobs. Admins can manage all jobs and staff.

## Key Features

- **Role-based Authentication**: Admin, Engineer, and Super Admin roles with different access levels
- **Two-Factor Authentication (2FA)**: TOTP-based 2FA using authenticator apps (Google Authenticator, Authy, etc.)
- **Password Management**: Users can change their passwords (minimum 8 characters required)
- **Super Admin**: Only super admins can add/remove staff members (granted via /setup reset-admin)
- **Job Management**: Create, edit, track job progress and status
- **Photo Evidence**: Upload photos as job completion evidence (separated by admin reference and engineer evidence)
- **Digital Signatures**: Capture engineer and customer signatures
- **GPS Tracking**: Live engineer locations on map, geolocation-stamped sign-offs with reverse geocoding
- **AI Advisors**: Specialist AI assistants (Snagging Pro, Trade Parts Finder, Gas & Heating Expert, Electrical Expert) with photo analysis
- **AI Writing Assistant**: Accessibility feature for users with dyslexia or literacy challenges - includes spelling/grammar correction, text simplification, note expansion, professional rewriting, voice-to-text dictation, and text-to-speech read-aloud
- **Further Actions**: Flag issues with priority levels (low/medium/high/urgent)
- **Print-friendly Output**: Generate PDF-ready job sheets
- **PWA Support**: Installable as mobile app with offline caching
- **Quoting System**: Create quotes with line items, discounts, VAT calculations (0/5/20%), send to clients via unique link
- **Client Management**: Automatic client record creation/update when quotes are saved, with centralized client database
- **Quote-to-Job Workflow**: Saving a quote automatically creates a draft job sheet linked to both the quote and client
- **Client Quote Portal**: Clients can view, accept, or decline quotes with optional decline reason
- **Invoice Management**: Generate invoices with bank transfer payment details
- **Company Settings**: Configure company details, bank information, default VAT rates, and payment terms
- **Long-running Jobs**: Track multi-day projects with daily progress updates (max 2 per day), photo evidence per update, and update history grouped by date
- **Team Messaging**: WhatsApp-style internal messaging for real-time team communication with direct messages, group chats, typing indicators, and unread badges
- **GDPR Compliance**: Cookie consent banner, privacy policy page, terms of service, data export, and account deletion request features

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
- `users` - User accounts with roles, location tracking, 2FA settings (twoFactorSecret, twoFactorEnabled), GDPR consent tracking (gdprConsentDate, gdprConsentVersion, deletionRequestedAt)
- `jobs` - Job records with materials, photos, signatures
- `clients` - Client records (name, email, phone, address, postcode)
- `quotes` - Quote records with line items, linked to clients and jobs
- `invoices` - Invoice records with payment details
- `engineer_locations` - Location history
- `ai_advisors` - AI assistant configurations
- `company_settings` - Company details, bank info, VAT rates
- `job_updates` - Daily progress updates for long-running jobs (max 2 per day)
- `conversations` - Chat conversations (direct or group)
- `conversation_members` - Members of each conversation with read status
- `messages` - Chat messages with sender and timestamp

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
- `SETUP_KEY` - Required to enable the /setup password reset endpoint (set to disable after initial setup)

## Pricing Tiers

- **Starter**: Free for 2 users, +£10/user after
- **Professional**: £99/month, +£10/user up to 35
- **Business**: £300/month, +£10/user up to 35
- **Enterprise**: Custom pricing, unlimited users
