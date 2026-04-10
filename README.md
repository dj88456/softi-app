# BTS SOFTI Weekly Report App

A web application for the BTS department to manage weekly SOFTI reports.

**SOFTI** = Success, Opportunities, Failures, Threats, Issues

## Quick Start

Double-click `start.bat` to launch both the backend and frontend.

Or manually:

```bash
# Terminal 1 - Backend
cd backend
node server.js

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## User Roles & Workflow

1. **Team Member** → selects team + name → submits individual SOFTI report
2. **Team Leader** → submits own report + consolidates team reports → submits to secretary
3. **Secretary** → reviews all team consolidated reports → publishes

## Managing Teams & Members

Go to **Admin** (top nav) to add/remove teams and members.
Default seed data includes: Engineering, Marketing, Operations teams with sample members.

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS (Vite)
- **Backend**: Node.js + Express
- **Storage (POC)**: `lowdb` JSON file (`backend/db.json`)
- **Storage (Production)**: Replace lowdb with `mssql` / `tedious` for SQL Server

## Migrating to SQL Server

The backend uses a simple data layer in `server.js`. To migrate:
1. Replace `import { db } from './database.js'` with a SQL Server connection
2. Replace array operations with SQL queries
3. The REST API contract stays identical — no frontend changes needed
