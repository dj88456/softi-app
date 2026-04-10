import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getConsolidated, publishConsolidated } from '../api';
import { getCurrentWeek } from '../utils';
import type { ConsolidatedReport } from '../types';
import WeekSelector from '../components/WeekSelector';
import { SOFTISectionReadOnly } from '../components/SOFTISection';
import type { SectionKey } from '../components/SOFTISection';

const SECTIONS: SectionKey[] = ['successes', 'opportunities', 'failures', 'threats', 'issues'];

type Tab = 'submitted' | 'published';

export default function SecretaryDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const week = searchParams.get('week') || getCurrentWeek();

  const [reports, setReports]     = useState<ConsolidatedReport[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());
  const [publishing, setPublishing] = useState<number | null>(null);
  const [tab, setTab]             = useState<Tab>('submitted');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConsolidated({ week });
      setReports(data);
      // Auto-expand all
      setExpanded(new Set(data.map(r => r.team_id)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => { load(); }, [load]);

  async function handlePublish(teamId: number) {
    setPublishing(teamId);
    try {
      await publishConsolidated(teamId, week);
      setReports(prev => prev.map(r =>
        r.team_id === teamId ? { ...r, status: 'published' } : r
      ));
    } catch (e) {
      console.error(e);
    } finally {
      setPublishing(null);
    }
  }

  async function handlePublishAll() {
    const toPublish = reports.filter(r => r.status === 'submitted');
    for (const r of toPublish) await handlePublish(r.team_id);
  }

  const submittedReports = reports.filter(r => r.status === 'submitted');
  const publishedReports = reports.filter(r => r.status === 'published');
  const activeReports = tab === 'submitted' ? submittedReports : publishedReports;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Department Summary</h1>
          <p className="text-sm text-gray-500 mt-0.5">All teams · SOFTI Weekly Reports</p>
        </div>
        <WeekSelector week={week} onChange={w => setSearchParams({ week: w })} />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Teams Submitted" value={submittedReports.length} total={reports.length} color="indigo" />
        <StatCard label="Teams Published" value={publishedReports.length} total={reports.length} color="emerald" />
        <StatCard label="Pending Review" value={submittedReports.length} color="amber" />
      </div>

      {/* Tabs + Publish All */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <TabBtn active={tab === 'submitted'} onClick={() => setTab('submitted')}>
            Awaiting Publish ({submittedReports.length})
          </TabBtn>
          <TabBtn active={tab === 'published'} onClick={() => setTab('published')}>
            Published ({publishedReports.length})
          </TabBtn>
        </div>
        {tab === 'submitted' && submittedReports.length > 0 && (
          <button
            onClick={handlePublishAll}
            disabled={publishing !== null}
            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
          >
            Publish All ({submittedReports.length})
          </button>
        )}
      </div>

      {/* Reports */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : activeReports.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-xl">
          <p className="text-lg mb-1">No {tab} reports</p>
          <p className="text-sm">
            {tab === 'submitted'
              ? 'No team reports are awaiting publication this week.'
              : 'No reports have been published for this week yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeReports.map(report => (
            <TeamReportCard
              key={report.team_id}
              report={report}
              isExpanded={expanded.has(report.team_id)}
              onToggle={() => setExpanded(prev => {
                const next = new Set(prev);
                next.has(report.team_id) ? next.delete(report.team_id) : next.add(report.team_id);
                return next;
              })}
              onPublish={() => handlePublish(report.team_id)}
              publishing={publishing === report.team_id}
            />
          ))}
        </div>
      )}

      {/* All reports not yet submitted */}
      {!loading && reports.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-xl">
          <p className="text-lg mb-1">No reports for this week</p>
          <p className="text-sm">Team leaders haven't submitted their consolidated reports yet.</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, total, color }: { label: string; value: number; total?: number; color: 'indigo' | 'emerald' | 'amber' }) {
  const colors = {
    indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200'  },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  }[color];
  return (
    <div className={`${colors.bg} border ${colors.border} rounded-xl p-4 text-center`}>
      <div className={`text-3xl font-bold ${colors.text}`}>
        {value}{total !== undefined ? <span className="text-lg font-normal text-gray-400">/{total}</span> : ''}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
        active ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function TeamReportCard({
  report, isExpanded, onToggle, onPublish, publishing
}: {
  report: ConsolidatedReport;
  isExpanded: boolean;
  onToggle: () => void;
  onPublish: () => void;
  publishing: boolean;
}) {
  const totalItems = SECTIONS.reduce((sum, s) => sum + report.data[s].length, 0);
  const isPublished = report.status === 'published';

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-sm">
            {report.team_name?.[0]}
          </div>
          <div>
            <div className="font-semibold text-gray-800">{report.team_name}</div>
            <div className="text-xs text-gray-400">{totalItems} items</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isPublished ? (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
              ✓ Published
            </span>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onPublish(); }}
              disabled={publishing}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-medium transition disabled:opacity-50"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
          <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* SOFTI content */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SECTIONS.map(s => (
              <SOFTISectionReadOnly key={s} section={s} items={report.data[s]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
