import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from './database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'frontend', 'dist');

const app = express();
app.use(cors());
app.use(express.json());

// Serve built frontend (production)
app.use(express.static(DIST));

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseReport(r) {
  const parse = s => { try { return JSON.parse(s ?? '[]'); } catch { return []; } };
  return {
    ...r,
    data: {
      successes:     parse(r.successes),
      opportunities: parse(r.opportunities),
      failures:      parse(r.failures),
      threats:       parse(r.threats),
      issues:        parse(r.issues),
    },
  };
}

// ── Teams ─────────────────────────────────────────────────────────────────────

app.get('/api/teams', (_req, res) => {
  const teams = db.prepare('SELECT * FROM teams ORDER BY name').all();
  res.json(teams);
});

app.post('/api/teams', (req, res) => {
  const { name } = req.body;
  const existing = db.prepare('SELECT id FROM teams WHERE name = ?').get(name);
  if (existing) return res.status(400).json({ error: 'Team already exists' });
  const result = db.prepare('INSERT INTO teams (name) VALUES (?)').run(name);
  res.json({ id: result.lastInsertRowid, name });
});

app.delete('/api/teams/:id', (req, res) => {
  db.prepare('DELETE FROM teams WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

// ── Members ───────────────────────────────────────────────────────────────────

app.get('/api/members', (req, res) => {
  const { team_id } = req.query;
  let rows;
  if (team_id) {
    rows = db.prepare(`
      SELECT m.*, t.name AS team_name
      FROM members m LEFT JOIN teams t ON t.id = m.team_id
      WHERE m.team_id = ?
      ORDER BY m.name
    `).all(Number(team_id));
  } else {
    rows = db.prepare(`
      SELECT m.*, t.name AS team_name
      FROM members m LEFT JOIN teams t ON t.id = m.team_id
      ORDER BY m.name
    `).all();
  }
  res.json(rows);
});

app.post('/api/members', (req, res) => {
  const { team_id, name, role } = req.body;
  const result = db.prepare(
    'INSERT INTO members (team_id, name, role) VALUES (?, ?, ?)'
  ).run(team_id ?? null, name, role ?? 'member');
  res.json({ id: result.lastInsertRowid, team_id: team_id ?? null, name, role: role ?? 'member' });
});

app.put('/api/members/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { team_id, name, role } = { ...existing, ...req.body };
  db.prepare('UPDATE members SET team_id = ?, name = ?, role = ? WHERE id = ?')
    .run(team_id ?? null, name, role, id);
  res.json({ success: true });
});

app.delete('/api/members/:id', (req, res) => {
  db.prepare('DELETE FROM members WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

// ── Individual Weekly Reports ──────────────────────────────────────────────────

app.get('/api/reports', (req, res) => {
  const { week, team_id, member_id } = req.query;
  const conditions = [];
  const params     = [];

  if (week)      { conditions.push('r.week = ?');               params.push(week); }
  if (team_id)   { conditions.push('r.team_id = ?');            params.push(Number(team_id)); }
  if (member_id) { conditions.push('r.member_id = ?');          params.push(Number(member_id)); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT r.*, m.name AS member_name
    FROM weekly_reports r
    LEFT JOIN members m ON m.id = r.member_id
    ${where}
  `).all(...params);

  res.json(rows.map(parseReport));
});

app.post('/api/reports', (req, res) => {
  const { member_id, team_id, week, data, status } = req.body;
  const { successes, opportunities, failures, threats, issues } = data;
  const submitted_at = status === 'submitted' ? new Date().toISOString() : null;

  db.prepare(`
    INSERT INTO weekly_reports
      (member_id, team_id, week, successes, opportunities, failures, threats, issues, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(member_id, week) DO UPDATE SET
      team_id       = excluded.team_id,
      successes     = excluded.successes,
      opportunities = excluded.opportunities,
      failures      = excluded.failures,
      threats       = excluded.threats,
      issues        = excluded.issues,
      status        = excluded.status,
      submitted_at  = COALESCE(excluded.submitted_at, weekly_reports.submitted_at)
  `).run(
    member_id, team_id ?? null, week,
    JSON.stringify(successes     ?? []),
    JSON.stringify(opportunities ?? []),
    JSON.stringify(failures      ?? []),
    JSON.stringify(threats       ?? []),
    JSON.stringify(issues        ?? []),
    status,
    submitted_at,
  );
  res.json({ success: true });
});

app.delete('/api/reports', (req, res) => {
  const { member_id, week } = req.query;
  const result = db.prepare(
    'DELETE FROM weekly_reports WHERE member_id = ? AND week = ?'
  ).run(Number(member_id), week);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ── Consolidated Reports ───────────────────────────────────────────────────────

app.get('/api/consolidated', (req, res) => {
  const { week, team_id } = req.query;
  const conditions = [];
  const params     = [];

  if (week)    { conditions.push('r.week = ?');    params.push(week); }
  if (team_id) { conditions.push('r.team_id = ?'); params.push(Number(team_id)); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT r.*, t.name AS team_name
    FROM consolidated_reports r
    LEFT JOIN teams t ON t.id = r.team_id
    ${where}
    ORDER BY t.name
  `).all(...params);

  res.json(rows.map(parseReport));
});

app.post('/api/consolidated', (req, res) => {
  const { team_id, week, data, status } = req.body;
  const { successes, opportunities, failures, threats, issues } = data;
  const submitted_at = status !== 'draft' ? new Date().toISOString() : null;

  db.prepare(`
    INSERT INTO consolidated_reports
      (team_id, week, successes, opportunities, failures, threats, issues, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(team_id, week) DO UPDATE SET
      successes     = excluded.successes,
      opportunities = excluded.opportunities,
      failures      = excluded.failures,
      threats       = excluded.threats,
      issues        = excluded.issues,
      status        = excluded.status,
      submitted_at  = COALESCE(excluded.submitted_at, consolidated_reports.submitted_at)
  `).run(
    team_id, week,
    JSON.stringify(successes     ?? []),
    JSON.stringify(opportunities ?? []),
    JSON.stringify(failures      ?? []),
    JSON.stringify(threats       ?? []),
    JSON.stringify(issues        ?? []),
    status,
    submitted_at,
  );
  res.json({ success: true });
});

app.post('/api/consolidated/:team_id/publish', (req, res) => {
  const team_id = Number(req.params.team_id);
  const { week } = req.body;
  const result = db.prepare(`
    UPDATE consolidated_reports
    SET status = 'published', submitted_at = ?
    WHERE team_id = ? AND week = ?
  `).run(new Date().toISOString(), team_id, week);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ── SPA fallback (must be last) ────────────────────────────────────────────────

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`BTS SOFTI API → http://localhost:${PORT}`));
