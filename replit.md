# Applied Intelligence Solutions Field View

A web-based job sheet application for field engineers with authentication, job management, photo uploads, signature capture, GPS tracking, and PDF generation.

## Overview

This application enables field service companies to manage job sheets digitally. Engineers can view assigned jobs, add materials, upload photos, capture signatures, and sign off jobs with GPS location verification. Admins can manage all jobs and track engineer locations.

## Key Features

- **Role-based Authentication**: Admin and Engineer roles with different access levels
- **Job Management**: Create, edit, track job progress and status
- **Photo Evidence**: Upload photos as job completion evidence
- **Digital Signatures**: Capture engineer and customer signatures
- **GPS Tracking**: Location-stamped sign-offs with reverse geocoding
- **Further Actions**: Flag issues with priority levels (low/medium/high/urgent)
- **Print-friendly Output**: Generate PDF-ready job sheets

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
- `users` - User accounts with roles and location
- `jobs` - Job records with materials, photos, signatures
- `engineer_locations` - GPS tracking history

## Sign-off Validation Rules

Before a job can be signed off:
1. At least one photo must be uploaded
2. Engineer signature must be captured
3. Customer signature must be captured
4. GPS location must be captured

## API Authentication

All API routes (except login and seed) require authentication via session cookies. Engineers can only access their assigned jobs; admins have full access.
