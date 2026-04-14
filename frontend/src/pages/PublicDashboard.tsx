import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getConsolidated } from '../api';
import { prevWeek, nextWeek, getCurrentWeek, getWeekDateRange, formatWeek } from '../utils';
import type { ConsolidatedReport } from '../types';
import type { SectionKey } from '../components/SOFTISection';

// ─── Section config ────────────────────────────────────────────────────────────

const SECTIONS: {
  key: SectionKey;
  label: string;
  short: string;
  icon: string;
  header: string;
  badge: string;
  border: string;
  dot: string;
  teamBg: string;
  teamText: string;
}[] = [
  {
    key: 'successes',
    label: 'Successes',
    short: 'S',
    icon: '✓',
    header:   'bg-emerald-600',
    badge:    'bg-emerald-100 text-emerald-700',
    border:   'border-emerald-200',
    dot:      'bg-emerald-400',
    teamBg:   'bg-emerald-50',
    teamText: 'text-emerald-800',
  },
  {
    key: 'opportunities',
    label: 'Opportunities',
    short: 'O',
    icon: '→',
    header:   'bg-sky-600',
    badge:    'bg-sky-100 text-sky-700',
    border:   'border-sky-200',
    dot:      'bg-sky-400',
    teamBg:   'bg-sky-50',
    teamText: 'text-sky-800',
  },
  {
    key: 'failures',
    label: 'Failures',
    short: 'F',
    icon: '✕',
    header:   'bg-rose-600',
    badge:    'bg-rose-100 text-rose-700',
    border:   'border-rose-200',
    dot:      'bg-rose-400',
    teamBg:   'bg-rose-50',
    teamText: 'text-rose-800',
  },
  {
    key: 'threats',
    label: 'Threats',
    short: 'T',
    icon: '⚠',
    header:   'bg-amber-500',
    badge:    'bg-amber-100 text-amber-700',
    border:   'border-amber-200',
    dot:      'bg-amber-400',
    teamBg:   'bg-amber-50',
    teamText: 'text-amber-800',
  },
  {
    key: 'issues',
    label: 'Issues',
    short: 'I',
    icon: '!',
    header:   'bg-violet-600',
    badge:    'bg-violet-100 text-violet-700',
    border:   'border-violet-200',
    dot:      'bg-violet-400',
    teamBg:   'bg-violet-50',
    teamText: 'text-violet-800',
  },
];

// ─── Item renderer ─────────────────────────────────────────────────────────────

function ItemBlock({ text, index, badgeClass }: { text: string; index: number; badgeClass: string }) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0 flex items-start gap-2">
      <span className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 ${badgeClass} text-white text-xs font-bold flex items-center justify-center`}>
        {index + 1}
      </span>
      <div className="flex-1">
        <div className="font-semibold text-gray-800 leading-snug">{lines[0]}</div>
        {lines.slice(1).map((line, i) => (
          <div key={i} className="flex items-start gap-1.5 mt-1 pl-1">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
            <span className="text-gray-600 text-sm leading-snug">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PublicDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const week = searchParams.get('week') || prevWeek(getCurrentWeek());
  const dateRange = getWeekDateRange(week);
  const [reports, setReports] = useState<ConsolidatedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConsolidated({ week });
      setReports(data.filter(r => r.status === 'published'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => { load(); }, [load]);

  function scrollTo(key: SectionKey) {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Count items across all teams for a section
  function sectionCount(key: SectionKey) {
    return reports.reduce((n, r) => {
      const items = r.data[key] ?? [];
      const hasReal = items.some(i => !isNA(i));
      return n + (hasReal ? items.filter(i => !isNA(i)).length : 0);
    }, 0);
  }

  function isNA(item: string) {
    const n = item.trim().toLowerCase().replace(/[\s/]/g, '');
    return n === 'na' || n === 'none' || n === 'nil';
  }

  const totalItems = SECTIONS.reduce((n, s) => n + sectionCount(s.key), 0);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero header ───────────────────────────────────────────────────────── */}
      <div className="bg-indigo-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-wrap items-center gap-4">
            {/* Title */}
            <div>
              <div className="font-black text-2xl tracking-tight">BTS EA SOFTI Weekly Report</div>
              <div className="text-white font-bold text-base mt-1">{dateRange}</div>
            </div>

            {/* Week navigation — centered */}
            <div className="flex items-center gap-2 mx-auto">
              <button
                onClick={() => setSearchParams({ week: prevWeek(week) })}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition"
              >
                ◄ Prev
              </button>
              <span className="px-3 py-1.5 rounded-lg bg-indigo-800 text-sm font-bold tabular-nums min-w-[90px] text-center">
                {formatWeek(week)}
              </span>
              <button
                onClick={() => setSearchParams({ week: nextWeek(week) })}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition"
              >
                Next ►
              </button>
            </div>

          </div>

          {/* Stats row */}
          {!loading && (
            <div className="mt-5 flex flex-wrap gap-3">
              <Pill label="Teams" value={reports.length} bg="bg-indigo-500" />
              <Pill label="Total items" value={totalItems} bg="bg-indigo-500" />
              {SECTIONS.map(s => (
                <Pill
                  key={s.key}
                  label={s.label}
                  value={sectionCount(s.key)}
                  bg="bg-indigo-500"
                  onClick={() => scrollTo(s.key)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section jump nav ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1 py-2 overflow-x-auto">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => scrollTo(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${s.badge} hover:opacity-80`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
                <span className="opacity-60">({sectionCount(s.key)})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {loading ? (
          <div className="text-center py-24 text-gray-400 text-lg">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-200">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-xl font-bold text-gray-700 mb-1">No published reports</div>
            <div className="text-gray-400 text-sm">
              No reports have been published for {formatWeek(week)} yet.
            </div>
          </div>
        ) : (
          SECTIONS.map(s => {
            const teamsWithContent = reports.filter(r => {
              const items = r.data[s.key] ?? [];
              return items.some(i => !isNA(i));
            });
            const allNA = reports.length > 0 && teamsWithContent.length === 0;

            return (
              <div
                key={s.key}
                ref={el => { sectionRefs.current[s.key] = el; }}
                className={`rounded-2xl border ${s.border} overflow-hidden shadow-sm`}
              >
                {/* Section header */}
                <div className={`${s.header} text-white px-6 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                      {s.short}
                    </span>
                    <span className="font-bold text-lg tracking-tight">{s.label}</span>
                  </div>
                  <span className="text-white/70 text-sm font-medium">
                    {sectionCount(s.key)} item{sectionCount(s.key) !== 1 ? 's' : ''}
                    {' · '}{teamsWithContent.length} team{teamsWithContent.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Section body */}
                <div className="bg-white px-6 py-5">
                  {allNA ? (
                    <p className="text-gray-400 text-sm italic">n/a</p>
                  ) : teamsWithContent.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No submissions yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {teamsWithContent.map(r => {
                        const items = (r.data[s.key] ?? []).filter(i => !isNA(i));
                        return (
                          <div key={r.team_id} className={`rounded-xl border ${s.border} overflow-hidden`}>
                            {/* Team label */}
                            <div className={`${s.teamBg} px-4 py-2 flex items-center gap-2 border-b ${s.border}`}>
                              <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-black ${s.header} text-white`}>
                                {(r.team_name ?? 'T')[0]}
                              </span>
                              <span className={`font-semibold text-sm ${s.teamText}`}>{r.team_name}</span>
                              <span className="ml-auto text-xs text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                            </div>
                            {/* Items */}
                            <div className="px-4 py-3">
                              {items.map((item, i) => <ItemBlock key={i} text={item} index={i} badgeClass={s.header} />)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 py-6">
        BTS Department · EA SOFTI Weekly Report System
      </div>
    </div>
  );
}

// ─── Pill stat ─────────────────────────────────────────────────────────────────

function Pill({ label, value, bg, onClick }: {
  label: string; value: number; bg: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`${bg} text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition`}
    >
      <span className="font-bold text-sm">{value}</span>
      <span className="opacity-80">{label}</span>
    </button>
  );
}
