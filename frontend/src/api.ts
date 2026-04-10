import type { Team, Member, WeeklyReport, ConsolidatedReport, SOFTIData } from './types';

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Teams ──────────────────────────────────────────────────────────────────────
export const getTeams = () => request<Team[]>('/api/teams');

export const createTeam = (name: string) =>
  request<Team>('/api/teams', { method: 'POST', body: JSON.stringify({ name }) });

export const deleteTeam = (id: number) =>
  request<{ success: boolean }>(`/api/teams/${id}`, { method: 'DELETE' });

// ── Members ────────────────────────────────────────────────────────────────────
export const getMembers = (team_id?: number) =>
  request<Member[]>(`/api/members${team_id ? `?team_id=${team_id}` : ''}`);

export const createMember = (data: { team_id?: number; name: string; role: string }) =>
  request<Member>('/api/members', { method: 'POST', body: JSON.stringify(data) });

export const updateMember = (id: number, data: Partial<Member>) =>
  request<{ success: boolean }>(`/api/members/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteMember = (id: number) =>
  request<{ success: boolean }>(`/api/members/${id}`, { method: 'DELETE' });

// ── Individual Reports ─────────────────────────────────────────────────────────
export const getReports = (params: { week?: string; team_id?: number; member_id?: number }) => {
  const q = new URLSearchParams(Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, String(v)]));
  return request<WeeklyReport[]>(`/api/reports?${q}`);
};

export const saveReport = (report: {
  member_id: number;
  team_id: number;
  week: string;
  data: SOFTIData;
  status: 'draft' | 'submitted';
}) => request<{ success: boolean }>('/api/reports', { method: 'POST', body: JSON.stringify(report) });

// ── Consolidated Reports ───────────────────────────────────────────────────────
export const getConsolidated = (params: { week?: string; team_id?: number }) => {
  const q = new URLSearchParams(Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, String(v)]));
  return request<ConsolidatedReport[]>(`/api/consolidated?${q}`);
};

export const saveConsolidated = (report: {
  team_id: number;
  week: string;
  data: SOFTIData;
  status: 'draft' | 'submitted';
}) => request<{ success: boolean }>('/api/consolidated', { method: 'POST', body: JSON.stringify(report) });

export const publishConsolidated = (team_id: number, week: string) =>
  request<{ success: boolean }>(`/api/consolidated/${team_id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ week }),
  });
