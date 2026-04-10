import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../App';
import { getReports, getConsolidated, saveConsolidated } from '../api';
import { getCurrentWeek } from '../utils';
import type { WeeklyReport, SOFTIData } from '../types';
import WeekSelector from '../components/WeekSelector';
import { SOFTISectionEditable, SOFTISectionReadOnly } from '../components/SOFTISection';
import type { SectionKey } from '../components/SOFTISection';

const SECTIONS: SectionKey[] = ['successes', 'opportunities', 'failures', 'threats', 'issues'];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function TeamConsolidation() {
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const week = searchParams.get('week') || getCurrentWeek();

  const [memberReports, setMemberReports] = useState<WeeklyReport[]>([]);
  const [consolidated, setConsolidated]   = useState<SOFTIData>({ successes: [], opportunities: [], failures: [], threats: [], issues: [] });
  const [conStatus, setConStatus]         = useState<'draft' | 'submitted'>('draft');
  const [expanded, setExpanded]           = useState<Set<number>>(new Set());
  const [saveState, setSave]              = useState<SaveState>('idle');
  const [loading, setLoading]             = useState(true);

  const load = useCallback(async () => {
    if (!user?.team_id) return;
    setLoading(true);
    try {
      const [reports, cons] = await Promise.all([
        getReports({ week, team_id: user.team_id }),
        getConsolidated({ week, team_id: user.team_id }),
      ]);
      setMemberReports(reports);
      if (cons.length > 0) {
        setConsolidated(cons[0].data);
        setConStatus(cons[0].status as 'draft' | 'submitted');
      } else {
        setConsolidated({ successes: [], opportunities: [], failures: [], threats: [], issues: [] });
        setConStatus('draft');
      }
      // Auto-expand members with submitted reports
      setExpanded(new Set(reports.filter(r => r.status === 'submitted').map(r => r.member_id)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [week, user?.team_id]);

  useEffect(() => { load(); }, [load]);

  function setSection(section: SectionKey, items: string[]) {
    setConsolidated(prev => ({ ...prev, [section]: items }));
    setSave('idle');
  }

  function copyToConsolidated(section: SectionKey, item: string) {
    setConsolidated(prev => {
      if (prev[section].includes(item)) return prev; // avoid duplicates
      return { ...prev, [section]: [...prev[section], item] };
    });
    setSave('idle');
  }

  async function handleSave(status: 'draft' | 'submitted') {
    if (!user?.team_id) return;
    setSave('saving');
    try {
      await saveConsolidated({ team_id: user.team_id, week, data: consolidated, status });
      setConStatus(status);
      setSave('saved');
      setTimeout(() => setSave('idle'), 2000);
    } catch {
      setSave('error');
    }
  }

  const submittedCount = memberReports.filter(r => r.status === 'submitted').length;
  const totalCount = memberReports.length;
  const isSubmitted = conStatus === 'submitted';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Team Consolidation</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user?.team_name} · {user?.member_name}
          </p>
        </div>
        <WeekSelector week={week} onChange={w => setSearchParams({ week: w })} />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="flex gap-5 flex-col lg:flex-row">

          {/* Left: Member Reports */}
          <div className="lg:w-[42%] flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-700">Member Reports</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  submittedCount === totalCount && totalCount > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {submittedCount}/{totalCount} submitted
                </span>
              </div>

              {memberReports.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-6">No reports submitted yet for this week.</p>
              ) : (
                <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                  {memberReports.map(report => (
                    <div key={report.member_id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Member header */}
                      <button
                        onClick={() => setExpanded(prev => {
                          const next = new Set(prev);
                          next.has(report.member_id) ? next.delete(report.member_id) : next.add(report.member_id);
                          return next;
                        })}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition text-left"
                      >
                        <span className="font-medium text-sm text-gray-700">{report.member_name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            report.status === 'submitted'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-200 text-gray-500'
                          }`}>
                            {report.status}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {expanded.has(report.member_id) ? '▲' : '▼'}
                          </span>
                        </div>
                      </button>

                      {/* Member report content */}
                      {expanded.has(report.member_id) && (
                        <div className="p-3 bg-white">
                          {SECTIONS.map(s => (
                            <SOFTISectionReadOnly
                              key={s}
                              section={s}
                              items={report.data[s]}
                              onCopy={item => copyToConsolidated(s, item)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Consolidated Editor */}
          <div className="flex-1 min-w-0">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-700">Consolidated Report</h2>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isSubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isSubmitted ? 'Submitted' : 'Draft'}
                  </span>
                  {saveState === 'saved' && <span className="text-emerald-600 text-xs font-medium">✓ Saved</span>}
                  {saveState === 'error' && <span className="text-red-600 text-xs font-medium">✗ Error</span>}
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-4 bg-blue-50 border border-blue-100 rounded p-2">
                Tip: Click <strong>+ Add</strong> next to any member bullet point to copy it here.
                Use ▲▼ to reorder items.
              </p>

              <div className="max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {SECTIONS.map(s => (
                  <SOFTISectionEditable
                    key={s}
                    section={s}
                    items={consolidated[s]}
                    onChange={items => setSection(s, items)}
                    canReorder
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4 justify-end border-t border-gray-100 pt-4">
                <button
                  onClick={() => handleSave('draft')}
                  disabled={saveState === 'saving'}
                  className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium transition disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleSave('submitted')}
                  disabled={saveState === 'saving'}
                  className="px-5 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {isSubmitted ? 'Re-submit' : 'Submit to Secretary'}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
