# BTS SOFTI Weekly Report — Technical Documentation

> Generated: April 2026

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Directory Structure](#3-directory-structure)
4. [Backend Files](#4-backend-files)
5. [Frontend Files](#5-frontend-files)
6. [Data Models](#6-data-models)
7. [API Reference](#7-api-reference)
8. [Process Flow Diagrams](#8-process-flow-diagrams)
9. [Role & Permission Matrix](#9-role--permission-matrix)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                           │
│                                                                     │
│   React 18 + TypeScript                                             │
│   Tailwind CSS v3          ◄──── localhost:5174 (Vite dev server)  │
│   React Router v6                                                   │
│   localStorage (user session)                                       │
└────────────────────────┬────────────────────────────────────────────┘
                         │  HTTP/JSON  (/api/*)
                         │  proxied by Vite → localhost:3001
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Backend (Node.js)                             │
│                                                                     │
│   Express 4                ◄──── localhost:3001                     │
│   CORS middleware                                                   │
│   lowdb (JSON file DB)                                              │
└────────────────────────┬────────────────────────────────────────────┘
                         │  read / write
                         ▼
                 ┌───────────────┐
                 │  backend/     │
                 │  db.json      │  ← NOT in Git (sensitive data)
                 └───────────────┘
```

**Key design decisions:**
- No real authentication — role and identity are client-side only (localStorage)
- Single JSON file as database — suitable for small team internal tool
- Vite proxies all `/api` requests to backend, no CORS issues in development
- Frontend and backend are independent processes, started by PowerShell/batch scripts

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend framework | React | 18.3.1 | UI component library |
| Language | TypeScript | 5.x | Type safety |
| Build tool | Vite | 5.x | Dev server + production bundler |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| Routing | React Router | 6.22.3 | Client-side navigation |
| Word export | docx | 9.6.1 | Generate `.docx` files |
| Backend framework | Express | 4.18.3 | REST API server |
| Database | lowdb | 7.0.1 | JSON file storage |
| CORS | cors | 2.8.5 | Cross-origin middleware |

---

## 3. Directory Structure

```
bts-softi/
├── README.md                    # Project overview & quick start
├── TECHNICAL.md                 # This document
├── start.bat                    # Launch both servers (visible windows)
├── start-silent.ps1             # Launch both servers (background)
├── stop.ps1                     # Kill all node processes
│
├── backend/
│   ├── package.json             # Backend dependencies
│   ├── server.js                # Express app + all API routes
│   ├── database.js              # lowdb init, schema, seed data
│   └── db.json                  # ⚠ Data file — NOT in Git
│
└── frontend/
    ├── package.json             # Frontend dependencies
    ├── vite.config.ts           # Vite + proxy config
    ├── tailwind.config.js       # Tailwind custom theme
    ├── tsconfig.json            # TypeScript config
    ├── postcss.config.js        # PostCSS (Tailwind plugin)
    ├── index.html               # HTML entry point
    └── src/
        ├── main.tsx             # React entry point
        ├── App.tsx              # Router + UserContext
        ├── types.ts             # All TypeScript interfaces
        ├── api.ts               # HTTP client (all API calls)
        ├── utils.ts             # Date/week utility functions
        ├── exportWord.ts        # Word (.docx) export logic
        ├── index.css            # Tailwind base styles
        │
        ├── components/
        │   ├── Layout.tsx       # App shell (header, nav, footer)
        │   ├── SOFTISection.tsx # Core SOFTI editor + viewer
        │   ├── WeekSelector.tsx # Calendar week picker
        │   └── ConfirmDialog.tsx# Reusable confirm modal
        │
        └── pages/
            ├── Home.tsx                 # Login / role selection
            ├── MemberReport.tsx         # Individual report editor
            ├── TeamConsolidation.tsx    # Team leader consolidation
            ├── ConsolidationDrafts.tsx  # Saved drafts browser
            ├── SecretaryDashboard.tsx   # Publish management
            ├── PublicDashboard.tsx      # Public read-only view
            └── Admin.tsx               # Teams & members CRUD
```

---

## 4. Backend Files

### `backend/database.js`

Initializes and exposes the lowdb JSON database.

```
Exports:
  db        — lowdb instance (read/write JSON)
  nextId()  — auto-increment ID generator per table

Database schema (db.json):
  {
    teams:                 Team[]
    members:               Member[]
    weekly_reports:        WeeklyReport[]
    consolidated_reports:  ConsolidatedReport[]
    _nextId: {
      teams, members, weekly_reports, consolidated_reports
    }
  }

Seed data (first run only):
  Teams:   Engineering, Marketing, Operations
  Members: sample member, leader, secretary per team
```

### `backend/server.js`

Express application with all REST API routes.

```
Middleware:
  cors()          — allow all origins (dev/internal use)
  express.json()  — parse JSON request bodies

Helper:
  parseReport(row) — normalizes a DB row into ConsolidatedReport shape,
                     deserializing each SOFTI section from stored JSON strings

Routes: see Section 7 (API Reference)
```

---

## 5. Frontend Files

### `src/types.ts`

Central TypeScript type definitions. All interfaces shared across the app.

| Type | Description |
|------|-------------|
| `Team` | `{ id, name }` |
| `Member` | `{ id, team_id, team_name?, name, role }` |
| `SOFTIData` | Five string arrays: successes, opportunities, failures, threats, issues |
| `WeeklyReport` | Individual member submission: member_id, team_id, week, data, status |
| `ConsolidatedReport` | Team-level report: team_id, team_name, week, data, status |
| `CurrentUser` | Active session: role, member_id, team_id, member_name, team_name |
| `UserRole` | `'member' \| 'leader' \| 'secretary' \| 'admin'` |
| `EMPTY_SOFTI` | Constant — empty SOFTIData for initializing new reports |

### `src/api.ts`

HTTP client wrapping all backend API calls. Uses `fetch` with JSON headers.

```
Internal:
  request<T>(method, path, body?) → T    generic fetch wrapper

Teams:
  getTeams()                            GET /api/teams
  createTeam(name)                      POST /api/teams
  deleteTeam(id)                        DELETE /api/teams/:id

Members:
  getMembers(team_id?)                  GET /api/members
  createMember(data)                    POST /api/members
  updateMember(id, data)                PUT /api/members/:id
  deleteMember(id)                      DELETE /api/members/:id

Reports:
  getReports(params)                    GET /api/reports
  saveReport(report)                    POST /api/reports
  deleteReport(member_id, week)         DELETE /api/reports

Consolidated:
  getConsolidated(params)               GET /api/consolidated
  saveConsolidated(report)              POST /api/consolidated
  publishConsolidated(team_id, week)    POST /api/consolidated/:id/publish
```

### `src/utils.ts`

ISO week arithmetic utilities.

```
getCurrentWeek()              → "2026-W15"
prevWeek("2026-W15")          → "2026-W14"
nextWeek("2026-W15")          → "2026-W16"
formatWeek("2026-W15")        → "Week 15, 2026"
getWeekDateRange("2026-W15")  → "Apr 6 – Apr 10"
```

### `src/App.tsx`

Root component. Provides `UserContext` (global login state) and defines all routes.

```
Context:
  UserContext — { user: CurrentUser | null, setUser, logout }
  useUser()   — hook to consume context

Routes:
  /           → Home
  /report     → MemberReport      (members + leaders)
  /consolidation → TeamConsolidation  (leaders only)
  /drafts     → ConsolidationDrafts   (leaders only)
  /dashboard  → SecretaryDashboard   (secretary only)
  /admin      → Admin               (admin only)
  /view       → PublicDashboard     (everyone, no login required)
  *           → redirect to /
```

### `src/exportWord.ts`

Generates a formatted Microsoft Word `.docx` file from a SOFTI report.

```
exportToWord({ week, memberName, teamName, data }) → downloads file

Document structure:
  Header:     "EA SOFTI — April 6 to April 10, 2026"
  Per section: heading (14pt Arial, bold, underlined)
               items: first line bold, sub-lines as Word bullets
               n/a entries shown as plain italic text

Markdown support:
  **bold**   → TextRun bold
  _italic_   → TextRun italic
  Typed bullet prefixes (•, →, ✓, ⚠) stripped (Word handles bullets natively)

File name:  SOFTI_{MemberName}_{Week}.docx
```

---

### `src/components/Layout.tsx`

App shell rendered around all pages (except `/view` which uses its own full-page layout).

```
Structure:
  <header>
    Logo + app name
    Navigation links (role-dependent)
    User info (name, role, team)
    Sign Out button  OR  Exit button (on /view when not logged in)
  </header>
  <main>{children}</main>
  <footer>BTS Department · copyright</footer>

Navigation visibility:
  member     → My Report
  leader     → My Report, Team Consolidation, Drafts
  secretary  → Secretary Dashboard
  admin      → Admin
  all roles  → (common links)
```

### `src/components/SOFTISection.tsx`

Core reusable component for rendering SOFTI data — either editable or read-only.

```
Exports:
  SOFTISectionReadOnly({ sectionKey, items, ... })
    — Numbered item list
    — Multi-line support (bold first line, dot sub-bullets)
    — Optional "Copy to consolidated" button

  SOFTISectionEditable({ sectionKey, items, onChange, ... })
    — Add / edit / delete items
    — Drag to reorder
    — Auto-expanding textarea
    — Smart bullet continuation on Enter
    — Number badge aligned at mt-2.5 (matches textarea baseline)
    — Preview badge for next item

  RichTextInput({ value, onChange, ... })
    — Auto-expanding textarea
    — Smart bullet handling

  RenderText({ text })
    — Renders inline **bold** and _italic_ markdown in display mode

  applyHighlight(text, query)
    — Wraps matched text in <mark> for search highlighting
```

### `src/components/WeekSelector.tsx`

Calendar-style week picker dropdown.

```
Props: { week: string, onChange: (week) => void }

Features:
  Trigger button shows current week + date range
  Calendar grid: month view, Mon–Sun columns
  Selected week highlighted as Mon–Fri band (indigo tint)
  Today marked with filled dot
  Month prev/next navigation
  "Back to last week" shortcut
  ISO week calculation (Week 1 = week containing Jan 4)
```

### `src/components/ConfirmDialog.tsx`

Modal confirmation dialog for destructive actions. Shared by Admin, TeamConsolidation.

```
Props:
  title         string          — Dialog heading
  message       React.ReactNode — Body text (supports JSX)
  confirmLabel  string          — Button label (default: "Delete")
  onConfirm     () => void
  onCancel      () => void

Renders:
  Fixed full-screen overlay (black/30 opacity)
  Centered white card (max-w-sm)
  Cancel (gray) + Confirm (red) buttons
```

---

### `src/pages/Home.tsx`

Two-step login page.

```
Step 1 — Role selection:
  Click a role card: Member | Leader | Secretary | Admin

Step 2 — Identity selection:
  Secretary / Admin: select member name only
  Member / Leader:   select team → then member name

On submit:
  Saves to UserContext + localStorage
  Redirects:
    member    → /report
    leader    → /report
    secretary → /dashboard
    admin     → /admin
```

### `src/pages/MemberReport.tsx`

Individual weekly SOFTI report editor.

```
Tabs:
  Edit     — Full SOFTI section editors
  History  — Read-only view of past weeks

Features:
  Auto-save to draft (1.5s debounce after edit)
  Save Draft   — explicit save
  Submit Report — locks status to 'submitted'
  Copy Last Week — populates from previous week's report
  Export Word — downloads .docx
  Week navigation via WeekSelector
  Search bar highlights matches across all sections

State:
  data: SOFTIData    — current content
  status             — 'draft' | 'submitted'
  isDirty            — tracks unsaved changes
  saveState          — 'idle' | 'saving' | 'saved' | 'error'
```

### `src/pages/TeamConsolidation.tsx`

Team leader consolidates all member reports into one team report.

```
Layout:
  Left/Top:   Member Reports (list of submitted members with SOFTI data)
  Right/Main: Consolidated Editor (the team's final report)

Key operations:
  Copy to Consolidated     — copy one item from a member to team report
  Import All               — merge all member reports automatically
  Clear                    — reset consolidated report (confirm dialog)
  Paste Import             — paste email/text and auto-parse SOFTI sections
  Export Word              — download consolidated .docx
  Submit                   — mark consolidated as 'submitted' → visible to secretary

Auto-import logic:
  1. Collect all items from all members per section
  2. Remove exact duplicates
  3. Remove "Learning" prefixed items (learnings belong in member reports only)
  4. Remove N/A if section has real content
  5. Merge "Documents Reviewed/Approved" items into one

SOFTI text parser (parseSOFTI):
  Detects section headers: flexible matching (English, Chinese, abbreviations)
  Bullet handling:
    Solid bullets (•, -, *) → new item
    Hollow bullets (○, ◦)   → continuation of previous item
  Strips: leading numbers, symbols, excess whitespace
```

### `src/pages/ConsolidationDrafts.tsx`

Browse and manage saved consolidation drafts.

```
Features:
  Lists all ConsolidatedReports for the logged-in team
  Filter: All | Drafts only
  Search by week number or content keywords
  Expandable detail view per week
  "Open in Editor" link → /consolidation?week=YYYY-WNN
  Status badges: Draft | Submitted | Published
```

### `src/pages/SecretaryDashboard.tsx`

Secretary reviews and publishes team reports.

```
Tabs:
  Awaiting Publish — consolidated reports with status 'submitted'
  Published        — reports already published

Stats bar:
  Total Submitted | Published | Pending

Actions:
  Publish All     — publish every submitted report at once
  Publish (per team) — publish individual team report

Report cards:
  Expandable per team, shows all 5 SOFTI sections
  Section item count shown in header
```

### `src/pages/PublicDashboard.tsx`

Read-only public view of published reports. No login required.

```
Layout:
  Hero header:  title, date range, week nav (prev/next), stats pills
  Sticky nav:   jump-to-section buttons (S / O / F / T / I)
  Content:      one card per SOFTI section
                  each card has sub-cards per team
                  items shown with numbered badges

Features:
  Filters to published reports only
  Cross-team grouping by section (not by team)
  Item count + team count per section
  Smooth scroll to section on nav click
  Week navigation (prev/next buttons)
  Max width: max-w-7xl
```

### `src/pages/Admin.tsx`

Teams and members management (admin role only).

```
Teams panel:
  Add team (name input + Add button, Enter to submit)
  List all teams
  Delete team (with ConfirmDialog)

Members panel:
  Add member (name, role selector, optional team selector)
  Role options: member | leader | secretary | admin
  Team selector hidden for secretary/admin roles
  List all members with role badge + team name
  Delete member (with ConfirmDialog)

Warning banner:
  Shown when no secretary exists
  (Secretary required to enable Secretary Dashboard)
```

---

## 6. Data Models

### Team
```json
{
  "id": 1,
  "name": "Engineering"
}
```

### Member
```json
{
  "id": 3,
  "team_id": 1,
  "name": "Alice Tan",
  "role": "leader"
}
```
`role` values: `"member"` | `"leader"` | `"secretary"` | `"admin"`

### WeeklyReport (individual member submission)
```json
{
  "id": 12,
  "member_id": 3,
  "team_id": 1,
  "week": "2026-W15",
  "successes":     ["Item text...", "Another item\n- sub-point"],
  "opportunities": ["..."],
  "failures":      ["..."],
  "threats":       ["..."],
  "issues":        ["..."],
  "status": "submitted",
  "submitted_at": "2026-04-11T08:32:00.000Z"
}
```
`status` values: `"draft"` | `"submitted"`

### ConsolidatedReport (team-level report)
```json
{
  "id": 5,
  "team_id": 1,
  "team_name": "Engineering",
  "week": "2026-W15",
  "successes":     ["Merged item...", "..."],
  "opportunities": ["..."],
  "failures":      ["..."],
  "threats":       ["..."],
  "issues":        ["..."],
  "status": "published",
  "submitted_at": "2026-04-12T10:00:00.000Z"
}
```
`status` values: `"draft"` | `"submitted"` | `"published"`

---

## 7. API Reference

Base URL: `http://localhost:3001`

### Teams

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/teams` | List all teams (sorted by name) |
| POST | `/api/teams` | Create team. Body: `{ name }` |
| DELETE | `/api/teams/:id` | Delete team by ID |

### Members

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/members?team_id=X` | List members (optional team filter) |
| POST | `/api/members` | Create member. Body: `{ name, team_id?, role }` |
| PUT | `/api/members/:id` | Update member fields |
| DELETE | `/api/members/:id` | Delete member |

### Weekly Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports?week=X&team_id=X&member_id=X` | Query reports (any filter combo) |
| POST | `/api/reports` | Upsert report. Body: WeeklyReport shape |
| DELETE | `/api/reports?member_id=X&week=X` | Delete a specific report |

### Consolidated Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/consolidated?week=X&team_id=X&status=X` | Query consolidated reports |
| POST | `/api/consolidated` | Upsert consolidated report |
| POST | `/api/consolidated/:team_id/publish` | Set status to `"published"`. Body: `{ week }` |

---

## 8. Process Flow Diagrams

### 8.1 Overall Weekly Reporting Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Team Members │     │ Team Leader  │     │  Secretary   │     │   Manager /  │
│              │     │              │     │              │     │   Public     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ 1. Fill SOFTI      │                    │                    │
       │    (My Report)     │                    │                    │
       │                    │                    │                    │
       │ 2. Submit          │                    │                    │
       │─────────────────►  │                    │                    │
       │                    │                    │                    │
       │                    │ 3. View member      │                    │
       │                    │    submissions      │                    │
       │                    │                    │                    │
       │                    │ 4. Consolidate      │                    │
       │                    │    (merge/edit)     │                    │
       │                    │                    │                    │
       │                    │ 5. Submit team      │                    │
       │                    │    report           │                    │
       │                    │─────────────────►   │                    │
       │                    │                    │                    │
       │                    │                    │ 6. Review all       │
       │                    │                    │    team reports     │
       │                    │                    │                    │
       │                    │                    │ 7. Publish          │
       │                    │                    │─────────────────►   │
       │                    │                    │                    │
       │                    │                    │                    │ 8. View at /view
       │                    │                    │                    │ (PublicDashboard)
```

---

### 8.2 Member Report — State Machine

```
                     ┌──────────────────────────────┐
                     │         NEW WEEK              │
                     │   (no report in DB yet)       │
                     └──────────────┬───────────────┘
                                    │
                                    │ user starts typing
                                    ▼
                     ┌──────────────────────────────┐
                     │           DRAFT               │◄────────── auto-save
                     │   (status = "draft")          │            (1.5s debounce)
                     └──────────────┬───────────────┘
                                    │
                                    │ click "Submit Report"
                                    ▼
                     ┌──────────────────────────────┐
                     │         SUBMITTED             │
                     │   (status = "submitted")      │
                     │   visible to team leader      │
                     └──────────────────────────────┘
```

---

### 8.3 Team Consolidation — Data Flow

```
  member_1/report  ──┐
  member_2/report  ──┤
  member_3/report  ──┤──► Import All ──► Deduplicate ──► Filter N/A ──► Merge similar
  member_4/report  ──┤                                                        │
  member_5/report  ──┘                                                        │
                                                                              ▼
                                                              ┌───────────────────────┐
                                                              │  Consolidated Editor   │
                                                              │  (leader edits/curates)│
                                                              └───────────────────────┘
                                                                              │
                            ┌─────────────────────────────────────────────────┤
                            │  Also accepts:                                   │
                            │  • Manual copy from individual member items      │
                            │  • Paste from email / Word text (auto-parsed)    │
                            └─────────────────────────────────────────────────┘
                                                                              │
                                                                   click "Submit"
                                                                              │
                                                                              ▼
                                                              ┌───────────────────────┐
                                                              │  status = "submitted"  │
                                                              │  visible to secretary  │
                                                              └───────────────────────┘
```

---

### 8.4 Secretary Publish Flow

```
  Secretary Dashboard
  ┌─────────────────────────────────────────────────────────┐
  │  Week: 2026-W15                                         │
  │                                                         │
  │  [3 Submitted]  [1 Published]  [2 Pending]              │
  │                                                         │
  │  Tab: Awaiting Publish         Tab: Published           │
  │  ┌─────────────┐                                        │
  │  │ Team A  [▶] │ ── Expand ──► view all 5 sections      │
  │  │             │               [Publish] button         │
  │  ├─────────────┤                    │                   │
  │  │ Team B  [▶] │                    │ POST /publish      │
  │  │             │                    │                   │
  │  ├─────────────┤                    ▼                   │
  │  │ Team C  [▶] │         status = "published"           │
  │  │             │         moves to Published tab         │
  │  └─────────────┘         visible at /view               │
  │                                                         │
  │  [Publish All]  ──► publishes every submitted report    │
  └─────────────────────────────────────────────────────────┘
```

---

### 8.5 Public Dashboard — Rendering Logic

```
  GET /api/consolidated?week=2026-W15
        │
        ▼
  filter: status === "published"
        │
        ▼
  For each SOFTI section (S → O → F → T → I):
    ┌──────────────────────────────────────────┐
    │  Section: Successes                      │
    │  ┌─────────────┐  ┌─────────────┐        │
    │  │ Team A      │  │ Team B      │        │
    │  │ 1. item ... │  │ 1. item ... │        │
    │  │ 2. item ... │  │ 2. item ... │        │
    │  └─────────────┘  └─────────────┘        │
    └──────────────────────────────────────────┘
    (teams with all-NA entries are hidden)
```

---

### 8.6 Login Flow

```
  /  (Home page)
       │
       ▼
  ┌────────────────────────────┐
  │  Step 1: Select Role       │
  │  [Member] [Leader]         │
  │  [Secretary] [Admin]       │
  └────────────┬───────────────┘
               │
               ▼
  ┌────────────────────────────────────────────────────┐
  │  Step 2: Select Identity                           │
  │                                                    │
  │  Role = member/leader?                             │
  │    → pick Team → pick Name                         │
  │                                                    │
  │  Role = secretary/admin?                           │
  │    → pick Name only                                │
  └────────────────────┬───────────────────────────────┘
                       │
                       ▼
              Save to UserContext
              + localStorage
                       │
           ┌───────────┴────────────┐
           │ redirect by role:       │
           │  member   → /report     │
           │  leader   → /report     │
           │  secretary→ /dashboard  │
           │  admin    → /admin      │
           └────────────────────────┘
```

---

## 9. Role & Permission Matrix

| Page / Feature | Member | Leader | Secretary | Admin |
|---|:---:|:---:|:---:|:---:|
| View own report (`/report`) | ✓ | ✓ | — | — |
| Submit own report | ✓ | ✓ | — | — |
| View team members' reports | — | ✓ | — | — |
| Consolidate team report | — | ✓ | — | — |
| View drafts history | — | ✓ | — | — |
| Secretary Dashboard (`/dashboard`) | — | — | ✓ | — |
| Publish reports | — | — | ✓ | — |
| Admin panel (`/admin`) | — | — | — | ✓ |
| Add / delete teams & members | — | — | — | ✓ |
| Public Dashboard (`/view`) | ✓ | ✓ | ✓ | ✓ |
| View without login (`/view`) | ✓ (anon) | ✓ (anon) | ✓ (anon) | ✓ (anon) |
| Export Word (.docx) | ✓ | ✓ | — | — |

> Note: Role enforcement is client-side only (route guards in `App.tsx`). The backend has no authentication — any request to any API endpoint is accepted.
