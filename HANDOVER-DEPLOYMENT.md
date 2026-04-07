# TrueNorthOS - Railway Deployment Handover

**Date:** 2026-04-07  
**Prepared by:** Agent Zero (Profile: agent0)  
**Target:** Railway App Platform (https://railway.app)  
**Repository:** https://github.com/truenorthcommand/TrueNorthOS

---

## Project Overview

TrueNorthOS is a comprehensive Field Service ERP platform for UK trade companies, built with:
- **Frontend:** React + TypeScript + Vite
- **Backend:** Express + TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **AI:** OpenRouter (migrated from Google Gemini)
- **Key Features:** Job management, invoicing, fleet tracking, AI assistant, compliance

---

## Current Status

### ✅ Completed Changes

1. **Database Configuration**
   - File: `server/db.ts`
   - Uses `process.env.DATABASE_URL` for PostgreSQL connection
   - Pool configuration ready for Railway

2. **AI Service Migration**
   - **NEW FILE:** `server/services/ai-service.ts` (OpenRouter compatible)
   - **UPDATED:** `server/ai-service.ts` (uses new service)
   - All AI features now use OpenRouter instead of Google Gemini
   - Models: `openai/gpt-4o-vision-preview` (vision), `openai/gpt-4o-mini` (text)

3. **Environment Template**
   - File: `.env.example`
   - Documents all required and optional environment variables

4. **GitHub Push**
   - Commit: "Prepare for Railway deployment - add OpenRouter AI service and env config"
   - Branch: `main`

---

## Deployment Instructions for Developer Agent

### Phase 1: Railway Project Setup

1. **Sign Up / Log In to Railway**
   - Use GitHub OAuth: https://railway.app

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose: `truenorthcommand/TrueNorthOS`

3. **Add PostgreSQL Database**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Wait for provisioning (30 seconds)
   - Note: Railway auto-creates `DATABASE_URL` variable

### Phase 2: Environment Variables

Configure in Railway: Project → Variables

**CRITICAL (Required for basic operation):**
```
DATABASE_URL=<auto-provided-by-railway-postgres>
SESSION_SECRET=<generate-random-64-char-string>
OPENROUTER_API_KEY=<get-from-user>
OPENROUTER_REFERER=https://truenorthos.co.uk
```


**GENERATE SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Additional Environment Variables (for full features):**
```
GMAIL_USER=user@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
OTP_SECRET=<base32-encoded-secret>
OUTLOOK_CLIENT_ID=...
OUTLOOK_CLIENT_SECRET=...
SENDGRID_API_KEY=...
STORAGE_BUCKET=truenorthos-uploads
STORAGE_ENDPOINT=...
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
```

### Phase 3: Build Configuration

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Health Check Endpoint:**
```
GET /health
```

### Phase 4: Database Migrations

**IMPORTANT:** Database must be migrated before first run

1. **Access Railway Console**
   - Project → Your PostgreSQL Database → "Connect" tab
   - Copy Connection URL

2. **Run Migrations Locally or via Railway Shell**
```bash
cd /a0/usr/workdir/TrueNorthOS
export DATABASE_URL=<railway-database-url>
npm run db:push
```

**Alternative:** Check if drizzle migrations run automatically in `index.ts`

### Phase 5: Verify Deployment

1. **Check Build Logs**
   - Look for TypeScript compilation errors
   - Ensure Vite build succeeds

2. **Check Runtime Logs**
   - Verify database connection
   - Confirm server starts on Railway's dynamic port

3. **Test Endpoints:**
   - `GET /health` → should return 200
   - `GET /api/events` → should return events (if any)
   - Check that static files (React app) are served

### Phase 6: Custom Domain (truenorthos.co.uk)

1. **Get Railway IP Address**
   - Railway Dashboard → Service → Settings → Domains
   - Or: `dig <your-app>.railway.app`

2. **Update Fasthosts DNS**
   - Log into: https://www.fasthosts.co.uk
   - Domain: truenorthos.co.uk
   - Add A records:
     - Host: `@` → Points to: [RAILWAY_IP]
     - Host: `www` → Points to: [RAILWAY_IP]

3. **Add Custom Domain in Railway**
   - Project → Service → Settings → Domains
   - Add: `truenorthos.co.uk`
   - Add: `www.truenorthos.co.uk`
   - Railway auto-provisions SSL certificates

---

## Technical Details

### Build System
- **Build Tool:** Custom script (`script/build.ts`)
- **Bundles:** Express server + Vite client
- **Output:** `dist/index.cjs` + `dist/client/`

### Database Schema
- **ORM:** Drizzle ORM
- **Migration Command:** `npm run db:push`
- **Connection:** Pool-based via `pg` library

### File Structure for Deployment
```
TrueNorthOS/
├── server/          # Express API routes
├── client/          # React frontend (builds to dist/client)
├── shared/          # Schema definitions
├── drizzle/         # Migration files (auto-generated)
└── dist/            # Build output
```

---

## Required User Input

The developer must obtain these from the user:

1. **OpenRouter API Key**
   - Get from: https://openrouter.ai/keys
   - Format: `sk-or-v1-...`

2. **Optional: Email credentials** for notifications
3. **Optional: Storage credentials** for file uploads

---

## Troubleshooting Guide

### "Cannot find module" errors
- Ensure `npm install` runs during build
- Check that all dependencies are in `package.json`

### Database connection fails
- Verify `DATABASE_URL` is set
- Check PostgreSQL is running
- Ensure migrations have run

### Build fails
```bash
# Test locally before deploying:
export DATABASE_URL=<test-db>
npm install
npm run build
npm start
```

### Client-side routing issues
- Express serves built client from `dist/client`
- Ensure `server/static.ts` routes are working

---

## Post-Deployment Checklist

- [ ] Railway project created
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] Database migrations executed
- [ ] Build succeeds (green checkmark)
- [ ] App accessible at Railway URL
- [ ] Database persistence verified (add test data, refresh)
- [ ] Custom domain connected (truenorthos.co.uk)
- [ ] SSL certificate active
- [ ] User can register/login
- [ ] AI features work (if OpenRouter key provided)

---

## Quick Reference

| Service | URL | Status |
|---------|-----|--------|
| Railway | https://railway.app | TO SETUP |
| GitHub Repo | https://github.com/truenorthcommand/TrueNorthOS | ✅ Ready |
| Target Domain | https://truenorthos.co.uk | TO CONFIGURE |
| Database | Railway PostgreSQL | TO CREATE |
| AI Provider | OpenRouter | ✅ Configured |

---

## Contact

**Application Owner:** truenorthcommand  
**Domain:** truenorthos.co.uk  
**Hosting Target:** Railway App Platform

---

**END OF HANDOVER**

*This document was automatically generated for Agent Zero developer deployment.*
