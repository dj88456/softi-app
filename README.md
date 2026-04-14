# BTS SOFTI Weekly Report App

A web application for the BTS department to collect, consolidate, and publish weekly SOFTI reports.

**SOFTI** = Successes · Opportunities · Failures · Threats · Issues

---

## Quick Start

**Option A — Background (no terminal windows):**

Right-click `start-silent.ps1` → Run with PowerShell

**Option B — Foreground:**

Double-click `start.bat`

**Option C — Manual:**

```bash
# Terminal 1 - Backend
cd backend
node server.js

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open **http://localhost:5174** in your browser.  
Backend API runs on **http://localhost:3001**.

To stop background servers, run `stop.ps1`.

---

## User Roles & Workflow

| Role | What they do |
|------|-------------|
| **Team Member** | Select team + name → fill in SOFTI report → submit |
| **Team Leader** | Submit own report + open Team Consolidation → merge all member entries → submit consolidated report |
| **Secretary** | Review all team consolidated reports in Secretary Dashboard → publish selected reports |
| **Public / Manager** | Open the public Weekly Report view (`/view`) to read all published reports |

---

## Pages

| Route | Page | Access |
|-------|------|--------|
| `/` | Home — select role/name | Everyone |
| `/report` | My Weekly Report | Members & Leaders |
| `/consolidation` | Team Consolidation | Leaders |
| `/drafts` | Consolidation Drafts | Leaders |
| `/secretary` | Secretary Dashboard | Secretary |
| `/view` | Public Weekly Report | Everyone (read-only) |
| `/admin` | Admin — manage teams & members | Admin |

---

## Features

- **SOFTI sections** with numbered items for easy reference
- **Team Consolidation** — merge individual member submissions into one report
- **Secretary Dashboard** — review and publish consolidated reports per week
- **Public Dashboard** — read-only view of all published reports, grouped by SOFTI section, with week navigation
- **Word Export** — export any report as a formatted `.docx` file
- **Confirmation dialogs** — styled modals for destructive actions (delete, clear)
- **Week selector** — navigate any page to any ISO week

---

## Managing Teams & Members

Go to **Admin** (top nav) to add/remove teams and members.

Roles available: `member`, `leader`, `secretary`, `admin`.  
A `secretary` role is required to enable the Secretary Dashboard.

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS v3 (Vite)
- **Backend**: Node.js + Express
- **Storage**: `lowdb` JSON file (`backend/db.json`)
- **Word export**: `docx` library

---

## Migrating Storage

The backend uses a thin data layer in `backend/server.js` and `backend/database.js`.  
To migrate to SQL Server or another database:

1. Replace `database.js` with a SQL Server / `mssql` connection
2. Replace array operations in `server.js` with SQL queries
3. The REST API contract stays identical — no frontend changes needed
