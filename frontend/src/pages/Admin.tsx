import React, { useState, useEffect } from 'react';
import { getTeams, getMembers, createTeam, createMember, deleteMember, deleteTeam } from '../api';
import type { Team, Member } from '../types';

export default function Admin() {
  const [teams, setTeams]     = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newTeam, setNewTeam] = useState('');
  const [newMember, setNewMember] = useState({ name: '', team_id: '', role: 'member' as string });
  const [loading, setLoading] = useState(true);

  async function load() {
    const [t, m] = await Promise.all([getTeams(), getMembers()]);
    setTeams(t);
    setMembers(m);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAddTeam() {
    if (!newTeam.trim()) return;
    await createTeam(newTeam.trim());
    setNewTeam('');
    load();
  }

  async function handleAddMember() {
    if (!newMember.name.trim()) return;
    await createMember({
      name: newMember.name.trim(),
      team_id: newMember.team_id ? Number(newMember.team_id) : undefined,
      role: newMember.role,
    });
    setNewMember({ name: '', team_id: '', role: 'member' });
    load();
  }

  async function handleDeleteTeam(id: number) {
    if (!confirm('Delete this team?')) return;
    await deleteTeam(id);
    load();
  }

  async function handleDeleteMember(id: number) {
    if (!confirm('Delete this member?')) return;
    await deleteMember(id);
    load();
  }

  const secretaries = members.filter(m => m.role === 'secretary');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6 pt-4">
        <h1 className="text-2xl font-bold text-gray-800">Admin</h1>
        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">Manage Teams & Members</span>
      </div>

      {loading ? <div className="text-gray-400">Loading…</div> : (
        <div className="grid grid-cols-2 gap-8">

          {/* Teams */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <h2 className="font-semibold text-gray-700 mb-5 text-base">Teams</h2>

            {/* Add team */}
            <div className="flex gap-3 mb-5">
              <input
                type="text"
                value={newTeam}
                onChange={e => setNewTeam(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTeam()}
                placeholder="New team name…"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={handleAddTeam}
                disabled={!newTeam.trim()}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition"
              >
                Add
              </button>
            </div>

            {/* Team list */}
            <ul className="space-y-2">
              {teams.map(t => (
                <li key={t.id} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl text-sm">
                  <span className="font-medium text-gray-700">{t.name}</span>
                  <button onClick={() => handleDeleteTeam(t.id)} className="text-red-400 hover:text-red-600 text-xs">
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Members */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <h2 className="font-semibold text-gray-700 mb-5 text-base">Members</h2>

            {/* Add member */}
            <div className="space-y-3 mb-5">
              <input
                type="text"
                value={newMember.name}
                onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))}
                placeholder="Full name…"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <div className="flex gap-3">
                <select
                  value={newMember.role}
                  onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="member">Member</option>
                  <option value="leader">Leader</option>
                  <option value="secretary">Secretary</option>
                  <option value="admin">Admin</option>
                </select>
                {newMember.role !== 'secretary' && newMember.role !== 'admin' && (
                  <select
                    value={newMember.team_id}
                    onChange={e => setNewMember(p => ({ ...p, team_id: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">-- Team --</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                <button
                  onClick={handleAddMember}
                  disabled={!newMember.name.trim()}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Member list */}
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {members.map(m => (
                <li key={m.id} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl text-sm">
                  <div>
                    <span className="font-medium text-gray-700">{m.name}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                      m.role === 'leader'    ? 'bg-indigo-100 text-indigo-700' :
                      m.role === 'secretary' ? 'bg-purple-100 text-purple-700' :
                                               'bg-gray-200 text-gray-500'
                    }`}>{m.role}</span>
                    {m.team_name && <span className="ml-1 text-xs text-gray-400">{m.team_name}</span>}
                  </div>
                  <button onClick={() => handleDeleteMember(m.id)} className="text-red-400 hover:text-red-600 text-xs">
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {secretaries.length === 0 && !loading && (
        <div className="mt-4 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          No secretary member found. Add one with role "Secretary" to enable the Department Summary view.
        </div>
      )}
    </div>
  );
}
