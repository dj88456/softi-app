import express from 'express';
import cors from 'cors';
import { db, nextId } from './database.js';

const app = express();
app.use(cors());
app.use(express.json());

// ── Persist helper ────────────────────────────────────────────────────────────
const save = () => db.write();

// ─── Teams ────────────────────────────────────────────────────────────────────

app.get('/api/teams', (_req, res) => {
  res.json([...db.data.teams].sort((a, b) => a.name.localeCompare(b.name)));
});

app.post('/api/teams', async (req, res) => {
  const { name } = req.body;
  if (db.data.teams.find(t => t.name === name))
    return res.status(400).json({ error: 'Team already exists' });
  const team = { id: nextId('teams'), name };
  db.data.teams.push(team);
  await save();
  res.json(team);
});

app.delete('/api/teams/:id', async (req, res) => {
  const id = Number(req.params.id);
  db.data.teams = db.data.teams.filter(t => t.id !== id);
  await save();
  res.json({ success: true });
});

// ─── Members ──────────────────────────────────────────────────────────────────

app.get('/api/members', (req, res) => {
  const team_id = req.query.team_id ? Number(req.query.team_id) : null;
  let members = db.data.members;
  if (team_id) members = members.filter(m => m.team_id === team_id);
  const withTeam = members.map(m => ({
    ...m,
    team_name: db.data.teams.find(t => t.id === m.team_id)?.name ?? null,
  }));
  res.json(withTeam.sort((a, b) => a.name.localeCompare(b.name)));
});

app.post('/api/members', async (req, res) => {
  const { team_id, name, role } = req.body;
  const member = { id: nextId('members'), team_id: team_id ?? null, name, role: role ?? 'member' };
  db.data.members.push(member);
  await save();
  res.json(member);
});

app.put('/api/members/:id', async (req, res) => {
  const id = Number(req.params.id);
  const idx = db.data.members.findIndex(m => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.data.members[idx] = { ...db.data.members[idx], ...req.body, id };
  await save();
  res.json({ success: true });
});

app.delete('/api/members/:id', async (req, res) => {
  const id = Number(req.params.id);
  db.data.members = db.data.members.filter(m => m.id !== id);
  await save();
  res.json({ success: true });
});

// ─── Individual Weekly Reports ─────────────────────────────────────────────────

function parseReport(r) {
  return {
    ...r,
    data: {
      successes:     r.successes     ?? [],
      opportunities: r.opportunities ?? [],
      failures:      r.failures      ?? [],
      threats:       r.threats       ?? [],
      issues:        r.issues        ?? [],
    },
  };
}

app.get('/api/reports', (req, res) => {
  const { week, team_id, member_id } = req.query;
  let reports = db.data.weekly_reports;
  if (week)      reports = reports.filter(r => r.week      === week);
  if (team_id)   reports = reports.filter(r => r.team_id   === Number(team_id));
  if (member_id) reports = reports.filter(r => r.member_id === Number(member_id));
  const withName = reports.map(r => ({
    ...parseReport(r),
    member_name: db.data.members.find(m => m.id === r.member_id)?.name ?? '',
  }));
  res.json(withName);
});

app.delete('/api/reports', async (req, res) => {
  const { member_id, week } = req.query;
  const mid = Number(member_id);
  const idx = db.data.weekly_reports.findIndex(r => r.member_id === mid && r.week === week);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.data.weekly_reports.splice(idx, 1);
  await save();
  res.json({ success: true });
});

app.post('/api/reports', async (req, res) => {
  const { member_id, team_id, week, data, status } = req.body;
  const { successes, opportunities, failures, threats, issues } = data;
  const existing = db.data.weekly_reports.findIndex(
    r => r.member_id === member_id && r.week === week
  );
  const record = {
    member_id, team_id, week,
    successes, opportunities, failures, threats, issues,
    status,
    submitted_at: status === 'submitted' ? new Date().toISOString() : null,
  };
  if (existing >= 0) {
    db.data.weekly_reports[existing] = { ...db.data.weekly_reports[existing], ...record };
  } else {
    db.data.weekly_reports.push({ id: nextId('weekly_reports'), ...record });
  }
  await save();
  res.json({ success: true });
});

// ─── Consolidated Reports ──────────────────────────────────────────────────────

app.get('/api/consolidated', (req, res) => {
  const { week, team_id } = req.query;
  let reports = db.data.consolidated_reports;
  if (week)    reports = reports.filter(r => r.week    === week);
  if (team_id) reports = reports.filter(r => r.team_id === Number(team_id));
  const withTeam = reports.map(r => ({
    ...parseReport(r),
    team_name: db.data.teams.find(t => t.id === r.team_id)?.name ?? '',
  }));
  res.json(withTeam.sort((a, b) => (a.team_name ?? '').localeCompare(b.team_name ?? '')));
});

app.post('/api/consolidated', async (req, res) => {
  const { team_id, week, data, status } = req.body;
  const { successes, opportunities, failures, threats, issues } = data;
  const existing = db.data.consolidated_reports.findIndex(
    r => r.team_id === team_id && r.week === week
  );
  const record = {
    team_id, week,
    successes, opportunities, failures, threats, issues,
    status,
    submitted_at: status !== 'draft' ? new Date().toISOString() : null,
  };
  if (existing >= 0) {
    db.data.consolidated_reports[existing] = { ...db.data.consolidated_reports[existing], ...record };
  } else {
    db.data.consolidated_reports.push({ id: nextId('consolidated_reports'), ...record });
  }
  await save();
  res.json({ success: true });
});

app.post('/api/consolidated/:team_id/publish', async (req, res) => {
  const team_id = Number(req.params.team_id);
  const { week } = req.body;
  const idx = db.data.consolidated_reports.findIndex(r => r.team_id === team_id && r.week === week);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.data.consolidated_reports[idx].status = 'published';
  db.data.consolidated_reports[idx].submitted_at = new Date().toISOString();
  await save();
  res.json({ success: true });
});

// ─── Start ─────────────────────────────────────────────────────────────────────

const PORT = 3001;
app.listen(PORT, () => console.log(`BTS SOFTI API → http://localhost:${PORT}`));
