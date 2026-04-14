import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'bts.db'));

// WAL mode: allows concurrent reads while writing (big win for multi-user)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS members (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    name    TEXT NOT NULL,
    role    TEXT NOT NULL DEFAULT 'member'
  );

  CREATE TABLE IF NOT EXISTS weekly_reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id     INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    team_id       INTEGER REFERENCES teams(id) ON DELETE SET NULL,
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
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
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

export { db };
