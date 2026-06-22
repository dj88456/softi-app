import React, { useState, useEffect } from 'react';
import { getTeams, getMembers, createTeam, createMember, updateMember, deleteMember, deleteTeam } from '../api';
import type { Team, Member } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';

type ConfirmState =
  | { type: 'team';   id: number; name: string }
  | { type: 'member'; id: number; name: string }
  | null;

export default function Admin() {
  const [teams, setTeams]     = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newTeam, setNewTeam] = useState('');
  const [newMember, setNewMember] = useState({ name: '', team_id: '', role: 'member' as string });
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [editingName, setEditingName] = useState<{ id: number; value: string } | null>(null);

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

  async function handleRenameMember() {
    if (!editingName || !editingName.value.trim()) return;
    await updateMember(editingName.id, { name: editingName.value.trim() });
    setEditingName(null);
    load();
  }

  async function handleConfirmed() {
    if (!confirm) return;
    if (confirm.type === 'team')   await deleteTeam(confirm.id);
    if (confirm.type === 'member') await deleteMember(confirm.id);
    setConfirm(null);
    load();
  }

  const secretaries = members.filter(m => m.role === 'secretary');

  return (
    <div className="max-w-7xl mx-auto">
      {confirm && (
        <ConfirmDialog
          title={`Delete ${confirm.type === 'team' ? 'Team' : 'Member'}`}
          message={<>Are you sure you want to delete <span className="font-medium text-gray-700">"{confirm.name}"</span>? This cannot be undone.</>}
          onConfirm={handleConfirmed}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="flex items-center gap-3 mb-6 pt-4">
        <h1 className="text-2xl font-bold text-gray-800">Admin</h1>
        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">Manage Teams & Members</span>
      </div>

      {loading ? <div className="text-gray-400">Loading…</div> : (
        <div className="grid grid-cols-2 gap-8">

          {/* Teams */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-10">
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
                  <button
                    onClick={() => setConfirm({ type: 'team', id: t.id, name: t.name })}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Members */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-10">
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
                  <option value="consolidator">Consolidator</option>
                  <option value="secretary">BTS Report Publisher</option>
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
            <ul className="space-y-2 max-h-[32rem] overflow-y-auto">
              {members.map(m => (
                <li key={m.id} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl text-sm">
                  {editingName?.id === m.id ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                      <input
                        autoFocus
                        type="text"
                        value={editingName.value}
                        onChange={e => setEditingName(prev => prev && ({ ...prev, value: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameMember();
                          if (e.key === 'Escape') setEditingName(null);
                        }}
                        className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-0"
                      />
                      <button onClick={handleRenameMember} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold">Save</button>
                      <button onClick={() => setEditingName(null)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium text-gray-700 truncate">{m.name}</span>
                      {m.team_name && <span className="text-xs text-gray-400 truncate">{m.team_name}</span>}
                      <button
                        onClick={() => setEditingName({ id: m.id, value: m.name })}
                        className="text-gray-400 hover:text-indigo-500 text-xs ml-1"
                        title="Rename"
                      >✏️</button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={m.role}
                      onChange={async e => {
                        await updateMember(m.id, { role: e.target.value as Member['role'] });
                        load();
                      }}
                      className={`text-xs px-1.5 py-0.5 rounded border-0 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                        m.role === 'consolidator' ? 'bg-teal-100 text-teal-700' :
                        m.role === 'leader'       ? 'bg-indigo-100 text-indigo-700' :
                        m.role === 'secretary'    ? 'bg-purple-100 text-purple-700' :
                        m.role === 'admin'        ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-200 text-gray-500'
                      }`}
                    >
                      <option value="member">member</option>
                      <option value="consolidator">consolidator</option>
                      <option value="secretary">BTS Report Publisher</option>
                      <option value="admin">admin</option>
                    </select>
                    <button
                      onClick={() => setConfirm({ type: 'member', id: m.id, name: m.name })}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {secretaries.length === 0 && !loading && (
        <div className="mt-4 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          No BTS Report Publisher found. Add one with role "BTS Report Publisher" to enable the Department Summary view.
        </div>
      )}
    </div>
  );
}
