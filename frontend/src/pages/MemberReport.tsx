import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../App';
import { getReports, saveReport } from '../api';
import { getCurrentWeek } from '../utils';
import { EMPTY_SOFTI, type SOFTIData } from '../types';
import WeekSelector from '../components/WeekSelector';
import { SOFTISectionEditable, SOFTISectionReadOnly } from '../components/SOFTISection';
import type { SectionKey } from '../components/SOFTISection';
import type { WeeklyReport } from '../types';

const SECTIONS: SectionKey[] = ['successes', 'opportunities', 'failures', 'threats', 'issues'];

const SECTION_LABELS: Record<SectionKey, string> = {
  successes: 'Successes',
  opportunities: 'Opportunities',
  failures: 'Failures',
  threats: 'Threats',
  issues: 'Issues',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type Tab = 'edit' | 'history';

export default function MemberReport() {
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const week = searchParams.get('week') || getCurrentWeek();

  const [data, setData]         = useState<SOFTIData>({ ...EMPTY_SOFTI });
  const [status, setStatus]     = useState<'draft' | 'submitted'>('draft');
  const [saveState, setSave]    = useState<SaveState>('idle');
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<Tab>('edit');

  // Track whether data changes came from the user (vs. initial load / copy)
  const isDirty  = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // History state
  const [history, setHistory]         = useState<WeeklyReport[]>([]);
  const [historyLoading, setHLoading] = useState(false);
  const [expandedWeek, setExpanded]   = useState<string | null>(null);
  const [copied, setCopied]           = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!user?.member_id) return;
    setLoading(true);
    try {
      const reports = await getReports({ week, member_id: user.member_id });
      if (reports.length > 0) {
        setData(reports[0].data);
        setStatus(reports[0].status);
      } else {
        setData({ successes: [], opportunities: [], failures: [], threats: [], issues: [] });
        setStatus('draft');
      }
      isDirty.current = false; // loaded from server, not a user edit
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [week, user?.member_id]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const loadHistory = useCallback(async () => {
    if (!user?.member_id) return;
    setHLoading(true);
    try {
      const all = await getReports({ member_id: user.member_id });
      // Sort newest first
      all.sort((a, b) => (b.week > a.week ? 1 : -1));
      setHistory(all);
    } catch (e) {
      console.error(e);
    } finally {
      setHLoading(false);
    }
  }, [user?.member_id]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  // Auto-save: 1.5s after last user edit, save as draft
  useEffect(() => {
    if (!isDirty.current) return;
    setSave('idle');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      isDirty.current = false;
      handleSave('draft');
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function setSection(section: SectionKey, items: string[]) {
    isDirty.current = true;
    setData(prev => ({ ...prev, [section]: items }));
  }

  async function handleSave(submitStatus: 'draft' | 'submitted') {
    if (!user?.member_id || !user?.team_id) return;
    setSave('saving');
    try {
      await saveReport({
        member_id: user.member_id,
        team_id: user.team_id,
        week,
        data,
        status: submitStatus,
      });
      setStatus(submitStatus);
      setSave('saved');
      setTimeout(() => setSave('idle'), 2000);
    } catch {
      setSave('error');
    }
  }

  function copyFromHistory(report: WeeklyReport) {
    isDirty.current = true;
    setData({
      successes:     [...report.data.successes],
      opportunities: [...report.data.opportunities],
      failures:      [...report.data.failures],
      threats:       [...report.data.threats],
      issues:        [...report.data.issues],
    });
    setSave('idle');
    setCopied(report.week);
    setTab('edit');
    setTimeout(() => setCopied(null), 3000);
  }

  const totalItems = SECTIONS.reduce((sum, s) => sum + data[s].length, 0);
  const isSubmitted = status === 'submitted';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">My Weekly Report</h1>
          <p className="text-base text-gray-500 font-semibold mt-1">
            {user?.member_name} · {user?.team_name}
          </p>
        </div>
        <WeekSelector week={week} onChange={w => setSearchParams({ week: w })} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        <button
          onClick={() => setTab('edit')}
          className={`px-4 py-2 text-base font-semibold rounded-t-lg border-b-2 transition ${
            tab === 'edit'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Edit Report
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${
            tab === 'history'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          History
        </button>
      </div>

      {/* Copied notification */}
      {copied && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-base font-semibold flex items-center gap-2">
          <span>✓</span>
          <span>Content from <strong>{copied}</strong> copied to the current week. Review and save.</span>
        </div>
      )}

      {/* ── EDIT TAB ── */}
      {tab === 'edit' && (
        <>
          {/* Status bar */}
          <div className={`rounded-xl px-5 py-3 mb-5 flex items-center justify-between text-base font-semibold ${
            isSubmitted ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                        : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}>
            <span>
              Status: <strong>{isSubmitted ? 'Submitted' : 'Draft'}</strong>
              {' · '}{totalItems} item{totalItems !== 1 ? 's' : ''} total
            </span>
            {saveState === 'idle'   && isDirty.current && <span className="text-gray-400 text-sm font-medium">Auto-saving…</span>}
            {saveState === 'saving' && <span className="text-gray-500 text-sm font-medium">Saving…</span>}
            {saveState === 'saved'  && <span className="text-emerald-600 text-sm font-semibold">✓ Auto-saved</span>}
            {saveState === 'error'  && <span className="text-red-600 text-sm font-semibold">✗ Save failed</span>}
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading…</div>
          ) : (
            <>
              {/* SOFTI Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
                {SECTIONS.map(s => (
                  <SOFTISectionEditable
                    key={s}
                    section={s}
                    items={data[s]}
                    onChange={items => setSection(s, items)}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-5 justify-end">
                <button
                  onClick={() => handleSave('draft')}
                  disabled={saveState === 'saving'}
                  className="px-6 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-100 text-base font-semibold transition disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleSave('submitted')}
                  disabled={saveState === 'saving' || isSubmitted}
                  className="px-6 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white text-base font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitted ? '✓ Submitted' : 'Submit Report'}
                </button>
              </div>

              {isSubmitted && (
                <p className="text-sm text-gray-400 font-medium text-right mt-2">
                  Report submitted. You can still edit and re-submit.
                </p>
              )}
            </>
          )}
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div>
          {historyLoading ? (
            <div className="text-center py-12 text-gray-400">Loading history…</div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No reports found.</div>
          ) : (
            <div className="space-y-3">
              {history.map(r => {
                const isCurrentWeek = r.week === week;
                const isExpanded = expandedWeek === r.week;
                const itemCount = SECTIONS.reduce((n, s) => n + (r.data[s]?.length ?? 0), 0);

                return (
                  <div
                    key={r.week}
                    className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
                      isCurrentWeek ? 'border-indigo-300' : 'border-gray-200'
                    }`}
                  >
                    {/* Row header */}
                    <div
                      className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
                      onClick={() => setExpanded(isExpanded ? null : r.week)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800 text-base">{r.week}</span>
                          {isCurrentWeek && (
                            <span className="text-sm bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-semibold">
                              Current week
                            </span>
                          )}
                          <span className={`text-sm px-2.5 py-0.5 rounded-full font-semibold ${
                            r.status === 'submitted'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {r.status === 'submitted' ? '✓ Submitted' : '◌ Draft'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 font-medium mt-0.5">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); copyFromHistory(r); }}
                          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition"
                          title="Copy this week's content to the current week"
                        >
                          {isCurrentWeek ? 'Load to editor' : 'Copy to current week'}
                        </button>
                        <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {SECTIONS.map(s => (
                            <SOFTISectionReadOnly
                              key={s}
                              section={s}
                              items={r.data[s] ?? []}
                            />
                          ))}
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => copyFromHistory(r)}
                            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
                          >
                            {isCurrentWeek ? 'Load to editor' : `Copy to current week (${week})`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
