import { JSONFilePreset } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'db.json');

const defaultData = {
  teams: [],
  members: [],
  weekly_reports: [],
  consolidated_reports: [],
  _nextId: { teams: 1, members: 1, weekly_reports: 1, consolidated_reports: 1 },
};

const db = await JSONFilePreset(dbPath, defaultData);

// ── Helper: auto-increment ID ────────────────────────────────────────────────
function nextId(table) {
  const id = db.data._nextId[table];
  db.data._nextId[table] = id + 1;
  return id;
}

// ── Seed sample data if empty ────────────────────────────────────────────────
if (db.data.teams.length === 0) {
  const addTeam = (name) => {
    const id = nextId('teams');
    db.data.teams.push({ id, name });
    return id;
  };
  const addMember = (team_id, name, role) => {
    const id = nextId('members');
    db.data.members.push({ id, team_id: team_id ?? null, name, role });
    return id;
  };

  const t1 = addTeam('Engineering');
  const t2 = addTeam('Marketing');
  const t3 = addTeam('Operations');

  addMember(t1, 'Alice Chen',  'leader');
  addMember(t1, 'Bob Wang',    'member');
  addMember(t1, 'Carol Liu',   'member');

  addMember(t2, 'David Zhang', 'leader');
  addMember(t2, 'Emma Li',     'member');
  addMember(t2, 'Frank Wu',    'member');

  addMember(t3, 'Grace Zhao',  'leader');
  addMember(t3, 'Henry Sun',   'member');

  addMember(null, 'Sarah (Secretary)', 'secretary');

  await db.write();
}

export { db, nextId };
