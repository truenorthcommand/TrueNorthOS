# In-App Agent Zero Chat Panel — Architecture Plan

**Status:** PLANNED (not yet built)
**Date:** 2026-05-07

---

## Overview

A hidden admin-only chat panel inside the app that connects directly to Agent Zero on the VPS for 24/7 access. Allows the super-admin to make change requests from within the app, with preview/approval before deployment.

---

## Requirements Confirmed

- Agent Zero hosted on VPS (24/7 access)
- Show preview of changes before deploying
- Accessible from all devices
- Super-admin only access
- In-app floating chat widget

---

## Architecture

```
┌─────────────────────────────┐
│   Your App (Browser)        │
│   └─ Admin Chat Panel       │
│      └─ WebSocket/REST      │
└──────────┬──────────────────┘
           │ HTTPS (secured)
           ▼
┌─────────────────────────────┐
│   Your VPS                  │
│   └─ Agent Zero             │
│      └─ A2A / API endpoint  │
│      └─ Code changes        │
│      └─ Git push            │
└──────────┬──────────────────┘
           │ Git push
           ▼
┌─────────────────────────────┐
│   Railway (auto-deploy)     │
└─────────────────────────────┘
```

---

## Components to Build

| Component | Location | Purpose |
|-----------|----------|--------|
| **Chat Panel UI** | Frontend (app) | Super-admin-only floating chat widget |
| **Chat API Proxy** | Backend (app) | Securely forwards messages to Agent Zero VPS |
| **Agent Zero Connector** | Backend (app) | Handles auth + communication with VPS |
| **Preview System** | Frontend (app) | Shows proposed changes before approval |
| **Conversation History** | Database | Stores chat history for reference |

---

## Security Model

| Layer | Protection |
|-------|------------|
| **UI Access** | Super-admin only |
| **API Route** | `/api/agent-zero/*` — super_admin check on every request |
| **VPS Connection** | API key / secret token for authentication |
| **Network** | HTTPS only between app and VPS |
| **Rate Limiting** | Max 10 requests per minute |

---

## Chat Panel UI Design

```
┌──────────────────────────────────────┐
│ 🤖 Agent Zero            [−] [×]    │
├──────────────────────────────────────┤
│                                      │
│ You: Add a date filter to            │
│      the invoices page               │
│                                      │
│ 🤖: Working on it...                 │
│     ⏳ Analyzing codebase            │
│     ✅ Found invoices page           │
│     ⏳ Implementing changes...       │
│                                      │
│ 🤖: Changes ready for review:       │
│ ┌──────────────────────────────┐    │
│ │ 📄 client/src/pages/invoices │    │
│ │ + Added date range filter     │    │
│ │ + Added date picker component │    │
│ │ 12 lines added, 2 modified   │    │
│ └──────────────────────────────┘    │
│ [✅ Approve & Deploy] [❌ Reject]   │
│                                      │
├──────────────────────────────────────┤
│ [Type your request...     ] [Send]   │
└──────────────────────────────────────┘
```

---

## Workflow

1. **You type** a request in the chat panel
2. **App backend** forwards it to Agent Zero on VPS (via secure API)
3. **Agent Zero** processes it:
   - Analyzes the codebase
   - Makes code changes
   - Runs build verification
   - Generates a diff/summary
4. **Preview returned** to chat panel showing:
   - Files changed
   - Summary of changes
   - Build status (✅ passes / ❌ fails)
5. **You approve** → Agent Zero pushes to GitHub → Railway auto-deploys
6. **Or reject** → Agent Zero reverts changes, asks for clarification

---

## Connection Details Needed

| Detail | Status |
|--------|--------|
| **VPS URL/IP** | TBD - need from user |
| **Port** | TBD - need from user |
| **Auth method** | TBD - need from user |
| **Reverse proxy** | TBD - need from user |
| **Panel style** | Floating widget (bottom-right corner) |

---

## Build Phases

| Phase | What |
|-------|------|
| **1** | Database table for conversation history |
| **2** | Backend proxy route (`/api/agent-zero/chat`) with auth |
| **3** | Frontend chat panel component (floating widget) |
| **4** | Preview/approval UI for code changes |
| **5** | Connection to Agent Zero A2A endpoint |
| **6** | Conversation history + search |

---

## Questions Still Open

1. VPS IP/domain where Agent Zero runs
2. Port Agent Zero is running on
3. Is it already exposed to the internet?
4. Reverse proxy (nginx/caddy) setup?
5. Panel: floating widget confirmed
