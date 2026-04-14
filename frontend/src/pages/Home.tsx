import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import { getTeams, getMembers } from '../api';
import type { Team, Member, UserRole } from '../types';

type Step = 'role' | 'identity';

const ROLE_CARDS: { role: UserRole; label: string; desc: string; icon: string; color: string }[] = [
  { role: 'member',    label: 'Team Member',   desc: 'Submit your individual weekly SOFTI report', icon: '📝', color: 'border-blue-400 hover:bg-blue-50' },
  { role: 'leader',    label: 'Team Leader',   desc: 'Submit your report & consolidate team reports', icon: '👥', color: 'border-indigo-400 hover:bg-indigo-50' },
  { role: 'secretary', label: 'Secretary',     desc: 'View all team reports & publish department summary', icon: '📋', color: 'border-purple-400 hover:bg-purple-50' },
  { role: 'admin',     label: 'Admin',         desc: 'Manage teams and members', icon: '⚙️', color: 'border-gray-400 hover:bg-gray-50' },
];

export default function Home() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  const [step, setStep]           = useState<Step>('role');
  const [selectedRole, setRole]   = useState<UserRole | null>(null);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [members, setMembers]     = useState<Member[]>([]);
  const [selectedTeam, setTeam]   = useState<number | null>(null);
  const [selectedMember, setMember] = useState<number | null>(null);
  const [loading, setLoading]     = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    if (user) {
      if (user.role === 'secretary') navigate('/dashboard');
      else if (user.role === 'leader') navigate('/consolidation');
      else if (user.role === 'admin') navigate('/admin');
      else navigate('/report');
    }
  }, [user, navigate]);

  // Load teams when role is selected
  useEffect(() => {
    if (step !== 'identity') return;
    if (selectedRole === 'secretary' || selectedRole === 'admin') {
      getMembers().then(all => setMembers(all.filter(m => m.role === selectedRole))).catch(console.error);
    } else {
      getTeams().then(setTeams).catch(console.error);
    }
  }, [step, selectedRole]);

  // Load members when team is selected
  useEffect(() => {
    if (selectedTeam) {
      getMembers(selectedTeam).then(all =>
        setMembers(all.filter(m => m.role === selectedRole || (selectedRole === 'leader' && m.role === 'leader')))
      ).catch(console.error);
    }
  }, [selectedTeam, selectedRole]);

  function pickRole(role: UserRole) {
    setRole(role);
    setStep('identity');
    setTeam(null);
    setMember(null);
    setMembers([]);
  }

  async function handleEnter() {
    if (!selectedRole || !selectedMember) return;
    setLoading(true);
    try {
      const all = await getMembers();
      const m = all.find(x => x.id === selectedMember);
      if (!m) return;
      const team = teams.find(t => t.id === selectedTeam);
      setUser({
        role: selectedRole,
        member_id: m.id,
        member_name: m.name,
        team_id: m.team_id ?? undefined,
        team_name: team?.name,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-3 bg-indigo-700 text-white px-6 py-3 rounded-2xl shadow-lg mb-4">
          <span className="text-3xl font-bold">BTS</span>
          <div className="text-left">
            <div className="text-sm font-semibold leading-none">Department</div>
            <div className="text-indigo-200 text-xs">SOFTI Weekly Report</div>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Welcome</h1>
        <p className="text-gray-500 mt-1">Select your role to get started</p>
      </div>

      {/* Step 1: Role Selection */}
      {step === 'role' && (
        <div className="space-y-3">
          {ROLE_CARDS.map(({ role, label, desc, icon, color }) => (
            <button
              key={role}
              onClick={() => pickRole(role)}
              className={`w-full text-left border-2 rounded-xl p-4 flex items-center gap-4 transition ${color}`}
            >
              <span className="text-3xl">{icon}</span>
              <div>
                <div className="font-semibold text-gray-800">{label}</div>
                <div className="text-sm text-gray-500">{desc}</div>
              </div>
              <span className="ml-auto text-gray-400">›</span>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Identity Selection */}
      {step === 'identity' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <button onClick={() => setStep('role')} className="text-sm text-indigo-600 hover:underline mb-4 block">
            ← Back
          </button>
          <h2 className="text-lg font-semibold mb-4 text-gray-800">
            {selectedRole === 'secretary' || selectedRole === 'admin' ? 'Select your name' : 'Select your team & name'}
          </h2>

          {/* Team selector (not for secretary or admin) */}
          {selectedRole !== 'secretary' && selectedRole !== 'admin' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
              <select
                value={selectedTeam ?? ''}
                onChange={e => { setTeam(Number(e.target.value)); setMember(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">-- Select team --</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Member selector */}
          {(selectedTeam || selectedRole === 'secretary' || selectedRole === 'admin') && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <select
                value={selectedMember ?? ''}
                onChange={e => setMember(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">-- Select name --</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          <button
            onClick={handleEnter}
            disabled={!selectedMember || loading}
            className="w-full bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg transition"
          >
            {loading ? 'Loading…' : 'Enter'}
          </button>
        </div>
      )}
    </div>
  );
}
