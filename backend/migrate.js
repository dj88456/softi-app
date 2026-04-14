// One-time migration: db.json → bts.db (SQLite)
// Run with: node migrate.js

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath  = join(__dirname, 'bts.db');
const jsonPath = join(__dirname, 'db.json');

if (!existsSync(jsonPath)) {
  console.error('db.json not found — nothing to migrate.');
  process.exit(1);
}

const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
const db   = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // off during bulk insert

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS members (
    id      INTEGER PRIMARY KEY,
    team_id INTEGER,
    name    TEXT NOT NULL,
    role    TEXT NOT NULL DEFAULT 'member'
  );
  CREATE TABLE IF NOT EXISTS weekly_reports (
    id            INTEGER PRIMARY KEY,
    member_id     INTEGER NOT NULL,
    team_id       INTEGER,
    week          TEXT NOT NULL,
    successes     TEXT NOT NULL DEFAULT '[]',
    opportunities TEXT NOT NULL DEFAULT '[]',
    failures      TEXT NOT NULL DEFAULT '[]',
    threats       TEXT NOT NULL DEFAULT '[]',
    issues        TEXT NOT NULL DEFAULT '[]',
    status        TEXT NOT NULL DEFAULT 'draft',
    submitted_at  TEXT,
    UNIQUE(member_id, week)
  );
  CREATE TABLE IF NOT EXISTS consolidated_reports (
    id            INTEGER PRIMARY KEY,
    team_id       INTEGER NOT NULL,
    week          TEXT NOT NULL,
    successes     TEXT NOT NULL DEFAULT '[]',
    opportunities TEXT NOT NULL DEFAULT '[]',
    failures      TEXT NOT NULL DEFAULT '[]',
    threats       TEXT NOT NULL DEFAULT '[]',
    issues        TEXT NOT NULL DEFAULT '[]',
    status        TEXT NOT NULL DEFAULT 'draft',
    submitted_at  TEXT,
    UNIQUE(team_id, week)
  );
`);

const migrate = db.transaction(() => {
  const stmts = {
    team: db.prepare('INSERT OR IGNORE INTO teams (id, name) VALUES (?, ?)'),
    member: db.prepare('INSERT OR IGNORE INTO members (id, team_id, name, role) VALUES (?, ?, ?, ?)'),
    report: db.prepare(`
      INSERT OR IGNORE INTO weekly_reports
        (id, member_id, team_id, week, successes, opportunities, failures, threats, issues, status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    consolidated: db.prepare(`
      INSERT OR IGNORE INTO consolidated_reports
        (id, team_id, week, successes, opportunities, failures, threats, issues, status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
  };

  for (const t of json.teams ?? []) {
    stmts.team.run(t.id, t.name);
  }

  for (const m of json.members ?? []) {
    stmts.member.run(m.id, m.team_id ?? null, m.name, m.role ?? 'member');
  }

  for (const r of json.weekly_reports ?? []) {
    stmts.report.run(
      r.id, r.member_id, r.team_id ?? null, r.week,
      JSON.stringify(r.successes     ?? []),
      JSON.stringify(r.opportunities ?? []),
      JSON.stringify(r.failures      ?? []),
      JSON.stringify(r.threats       ?? []),
      JSON.stringify(r.issues        ?? []),
      r.status ?? 'draft',
      r.submitted_at ?? null,
    );
  }

  for (const r of json.consolidated_reports ?? []) {
    stmts.consolidated.run(
      r.id, r.team_id, r.week,
      JSON.stringify(r.successes     ?? []),
      JSON.stringify(r.opportunities ?? []),
      JSON.stringify(r.failures      ?? []),
      JSON.stringify(r.threats       ?? []),
      JSON.stringify(r.issues        ?? []),
      r.status ?? 'draft',
      r.submitted_at ?? null,
    );
  }
});

migrate();

db.pragma('foreign_keys = ON');
db.close();

console.log('Migration complete:');
console.log(`  Teams:                ${(json.teams ?? []).length}`);
console.log(`  Members:              ${(json.members ?? []).length}`);
console.log(`  Weekly reports:       ${(json.weekly_reports ?? []).length}`);
console.log(`  Consolidated reports: ${(json.consolidated_reports ?? []).length}`);
