import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../App';
import { getReports, saveReport } from '../api';
import { getCurrentWeek } from '../utils';
import { EMPTY_SOFTI, type SOFTIData } from '../types';
import WeekSelector from '../components/WeekSelector';
import { SOFTISectionEditable } from '../components/SOFTISection';
import type { SectionKey } from '../components/SOFTISection';

const SECTIONS: SectionKey[] = ['successes', 'opportunities', 'failures', 'threats', 'issues'];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function MemberReport() {
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const week = searchParams.get('week') || getCurrentWeek();

  const [data, setData]         = useState<SOFTIData>({ ...EMPTY_SOFTI, successes: [], opportunities: [], failures: [], threats: [], issues: [] });
  const [status, setStatus]     = useState<'draft' | 'submitted'>('draft');
  const [saveState, setSave]    = useState<SaveState>('idle');
  const [loading, setLoading]   = useState(true);

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [week, user?.member_id]);

  useEffect(() => { loadReport(); }, [loadReport]);

  function setSection(section: SectionKey, items: string[]) {
    setData(prev => ({ ...prev, [section]: items }));
    setSave('idle');
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

  const totalItems = SECTIONS.reduce((sum, s) => sum + data[s].length, 0);
  const isSubmitted = status === 'submitted';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Weekly Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user?.member_name} · {user?.team_name}
          </p>
        </div>
        <WeekSelector week={week} onChange={w => setSearchParams({ week: w })} />
      </div>

      {/* Status bar */}
      <div className={`rounded-lg px-4 py-2.5 mb-5 flex items-center justify-between text-sm ${
        isSubmitted ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border border-amber-200 text-amber-700'
      }`}>
        <span>
          Status: <strong>{isSubmitted ? 'Submitted' : 'Draft'}</strong>
          {' · '}{totalItems} item{totalItems !== 1 ? 's' : ''} total
        </span>
        {saveState === 'saved' && <span className="text-emerald-600 font-medium">✓ Saved</span>}
        {saveState === 'error' && <span className="text-red-600 font-medium">✗ Error saving</span>}
        {saveState === 'saving' && <span className="text-gray-500">Saving…</span>}
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
          <div className="flex gap-3 mt-4 justify-end">
            <button
              onClick={() => handleSave('draft')}
              disabled={saveState === 'saving'}
              className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium transition disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSave('submitted')}
              disabled={saveState === 'saving' || isSubmitted}
              className="px-5 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitted ? '✓ Submitted' : 'Submit Report'}
            </button>
          </div>

          {isSubmitted && (
            <p className="text-xs text-gray-400 text-right mt-2">
              Report submitted. You can still edit and re-submit.
            </p>
          )}
        </>
      )}
    </div>
  );
}
