import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import { getConsolidated } from '../api';
import { formatWeek, getWeekDateRange } from '../utils';
import type { ConsolidatedReport } from '../types';
import { SOFTISectionReadOnly } from '../components/SOFTISection';
import type { SectionKey } from '../components/SOFTISection';

const SECTIONS: SectionKey[] = ['successes', 'opportunities', 'failures', 'threats', 'issues'];

export default function ConsolidationDrafts() {
  const { user } = useUser();
  const navigate = useNavigate();

  const [allReports, setAllReports] = useState<ConsolidatedReport[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [filter, setFilter]         = useState<'draft' | 'all'>('draft');

  const load = useCallback(async () => {
    if (!user?.team_id) return;
    setLoading(true);
    try {
      const data = await getConsolidated({ team_id: user.team_id });
      // Sort newest week first
      data.sort((a, b) => (b.week > a.week ? 1 : -1));
      setAllReports(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.team_id]);

  useEffect(() => { load(); }, [load]);

  const visible = allReports.filter(r => {
    if (filter === 'draft' && r.status !== 'draft') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const inWeek = r.week.toLowerCase().includes(q);
      const inContent = SECTIONS.some(s =>
        r.data[s].some(item => item.toLowerCase().includes(q))
      );
      if (!inWeek && !inContent) return false;
    }
    return true;
  });

  function toggleExpand(week: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(week) ? next.delete(week) : next.add(week);
      return next;
    });
  }

  function openInEditor(week: string) {
    navigate(`/consolidation?week=${encodeURIComponent(week)}`);
  }

  const draftCount = allReports.filter(r => r.status === 'draft').length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-4 pt-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Consolidation Drafts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user?.team_name} · {draftCount} draft{draftCount !== 1 ? 's' : ''} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44 transition"
          />
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <FilterBtn active={filter === 'draft'} onClick={() => setFilter('draft')}>Drafts only</FilterBtn>
            <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterBtn>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white border border-gray-200 rounded-xl">
          <p className="text-lg font-medium mb-1">No {filter === 'draft' ? 'draft' : ''} reports found</p>
          <p className="text-sm">
            {search ? 'Try a different search term.' : 'Import All in Team Consolidation to create a draft.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(r => {
            const isExpanded = expanded.has(r.week);
            const totalItems = SECTIONS.reduce((n, s) => n + (r.data[s]?.length ?? 0), 0);
            return (
              <div key={r.week} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {/* Row header */}
                <div
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => toggleExpand(r.week)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800 text-base">{formatWeek(r.week)}</span>
                      <span className="text-xs text-gray-400">{getWeekDateRange(r.week)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        r.status === 'draft'
                          ? 'bg-amber-100 text-amber-700'
                          : r.status === 'submitted'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {r.status === 'draft' ? '◌ Draft' : r.status === 'submitted' ? '→ Submitted' : '✓ Published'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); openInEditor(r.week); }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                    >
                      ✎ Open in Editor
                    </button>
                    <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {SECTIONS.map(s => (
                        <SOFTISectionReadOnly
                          key={s}
                          section={s}
                          items={r.data[s] ?? []}
                          highlight={search}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
        active ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}
