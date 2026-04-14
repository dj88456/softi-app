export interface Team {
  id: number;
  name: string;
}

export interface Member {
  id: number;
  team_id: number | null;
  team_name?: string;
  name: string;
  role: 'member' | 'leader' | 'secretary';
}

export interface SOFTIData {
  successes: string[];
  opportunities: string[];
  failures: string[];
  threats: string[];
  issues: string[];
}

export const EMPTY_SOFTI: SOFTIData = {
  successes: [],
  opportunities: [],
  failures: [],
  threats: [],
  issues: [],
};

export interface WeeklyReport {
  id?: number;
  member_id: number;
  member_name?: string;
  team_id: number;
  week: string;
  data: SOFTIData;
  status: 'draft' | 'submitted';
  submitted_at?: string;
}

export interface ConsolidatedReport {
  id?: number;
  team_id: number;
  team_name?: string;
  week: string;
  data: SOFTIData;
  status: 'draft' | 'submitted' | 'published';
  submitted_at?: string;
}

export type UserRole = 'member' | 'leader' | 'secretary' | 'admin';

export interface CurrentUser {
  role: UserRole;
  team_id?: number;
  team_name?: string;
  member_id?: number;
  member_name?: string;
}
