import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../App';
import { getReports, getConsolidated, saveConsolidated, saveReport, deleteReport, getMembers } from '../api';
import { getCurrentWeek, prevWeek } from '../utils';
import type { WeeklyReport, SOFTIData, Member } from '../types';
import WeekSelector from '../components/WeekSelector';
import { SOFTISectionEditable, SOFTISectionReadOnly } from '../components/SOFTISection';
import type { SectionKey } from '../components/SOFTISection';
import { exportToWord } from '../exportWord';

const SECTIONS: SectionKey[] = ['successes', 'opportunities', 'failures', 'threats', 'issues'];

// Custom sort order for team members (case-insensitive first-name match)
const MEMBER_ORDER = ['greg', 'tim', 'ben', 'shankara', 'alex', 'srujan'];
function memberSortKey(name: string): number {
  const first = (name ?? '').split(' ')[0].toLowerCase();
  const idx = MEMBER_ORDER.indexOf(first);
  return idx === -1 ? MEMBER_ORDER.length : idx;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface DroppedItem {
  member_name: string;
  section: SectionKey;
  item: string;
  reason: 'learnings' | 'na_replaced' | 'duplicate' | 'doc_merged';
}

const DROPPED_REASON_LABEL: Record<DroppedItem['reason'], string> = {
  learnings:   'Learnings (skipped)',
  na_replaced: 'N/A (removed — section has real content)',
  duplicate:   'Duplicate (already imported from another member)',
  doc_merged:  'Merged into Documents Reviewed / Approved summary',
};

// ── Paste parser ───────────────────────────────────────────────────────────────

// Match a line as a SOFTI section header — very permissive, handles:
// "Successes", "Successes:", "## Successes", "S:", "[S]", "成功:", etc.
const HEADER_MAP: [SectionKey, string[]][] = [
  ['successes',     ['success', 'successes', '成功', 'wins', 'win', 'achievement']],
  ['opportunities', ['opportunity', 'opportunities', 'opportunit', '机会', 'opp', 'opps']],
  ['failures',      ['failure', 'failures', 'fail', 'fails', 'failed', '失败', 'miss', 'missed']],
  ['threats',       ['threat', 'threats', '威胁', 'risk', 'risks']],
  ['issues',        ['issue', 'issues', '问题', 'problem', 'problems', 'concern', 'concerns', 'blocker', 'blockers']],
];

// Single-letter abbreviations S/O/F/T/I
const LETTER_MAP: Record<string, SectionKey> = { s: 'successes', o: 'opportunities', f: 'failures', t: 'threats', i: 'issues' };

function detectHeader(line: string): SectionKey | null {
  const t = line.trim().toLowerCase();
  // Strip markdown heading markers and punctuation
  const clean = t.replace(/^#+\s*/, '').replace(/[：:\-\[\]]/g, '').trim();

  // Single letter: S / O / F / T / I (standalone)
  if (/^[softi]$/.test(clean) && LETTER_MAP[clean]) return LETTER_MAP[clean];

  // Full word match
  for (const [key, words] of HEADER_MAP) {
    if (words.some(w => clean === w || clean.startsWith(w + ' ') || t.startsWith(w + ':') || t.startsWith(w + '：'))) {
      return key;
    }
  }
  return null;
}

// Solid filled bullets → new separate item
function isSolidBullet(line: string): boolean {
  return /^\s*[•●▪■◆◉⬛⚫]/.test(line);
}

// Hollow/open bullets → continuation of the previous item
// Includes Word "o\t" hollow bullet style
function isHollowBullet(line: string): boolean {
  return /^\s*[○◦□▷◇☐]/.test(line) || /^\s*o\t/.test(line);
}

// Strip any leading symbols/bullets/numbers from a line of text
function stripLeading(line: string): string {
  return line
    // numbered lists: "1.", "1)", "1:", "(1)"
    .replace(/^\s*\(?\d+[.):\s]\s*/, '')
    // single letter/symbol bullet followed by tab (e.g. Word "o" bullets: "o\tContent")
    .replace(/^\s*[a-zA-Z•·]\t/, '')
    // any non-alphanumeric, non-CJK, non-letter prefix characters (bullets, dashes, arrows, etc.)
    .replace(/^\s*[^\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}("""]+/u, '')
    .trim();
}

function parseSOFTI(raw: string): SOFTIData {
  const result: SOFTIData = { successes: [], opportunities: [], failures: [], threats: [], issues: [] };
  const lines = raw.split('\n');

  // Find header positions
  const sectionStarts: { key: SectionKey; lineIdx: number }[] = [];
  lines.forEach((line, idx) => {
    const key = detectHeader(line);
    if (key) sectionStarts.push({ key, lineIdx: idx });
  });

  if (sectionStarts.length === 0) {
    // No headers — treat each non-empty line as an individual item in Issues
    result.issues = lines.map(stripLeading).filter(Boolean);
    return result;
  }

  sectionStarts.forEach(({ key, lineIdx }, si) => {
    const end = sectionStarts[si + 1]?.lineIdx ?? lines.length;
    const sectionLines = lines.slice(lineIdx + 1, end);

    const items: string[] = [];
    let current: string[] = [];

    for (const line of sectionLines) {
      const stripped = stripLeading(line);
      if (stripped === '') {
        if (current.length > 0) { items.push(current.join('\n')); current = []; }
      } else if (isSolidBullet(line)) {
        // Solid bullet → always starts a new item
        if (current.length > 0) { items.push(current.join('\n')); current = []; }
        current.push(stripped);
      } else if (isHollowBullet(line)) {
        // Hollow bullet → continuation of the current item
        if (current.length > 0) {
          current.push(stripped);
        } else if (items.length > 0) {
          items[items.length - 1] += '\n' + stripped;
        } else {
          current.push(stripped);
        }
      } else {
        current.push(stripped);
      }
    }
    if (current.length > 0) items.push(current.join('\n'));

    // Deduplicate N/A variants — keep only the first occurrence per section
    const seen = new Set<string>();
    result[key] = items.filter(item => {
      const norm = item.trim().toLowerCase().replace(/[\s/]/g, '');
      if (norm === 'na' || norm === 'none' || norm === 'nil') {
        if (seen.has(norm)) return false;
        seen.add(norm);
      }
      return Boolean(item);
    });
  });

  return result;
}

export default function TeamConsolidation() {
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const week = searchParams.get('week') || prevWeek(getCurrentWeek());

  const [search, setSearch] = useState('');
  const [droppedItems, setDroppedItems] = useState<DroppedItem[]>([]);
  const [showDropped, setShowDropped] = useState(false);
  const [memberReports, setMemberReports] = useState<WeeklyReport[]>([]);
  const [allMembers,    setAllMembers]    = useState<Member[]>([]);
  const [consolidated, setConsolidated]   = useState<SOFTIData>({ successes: [], opportunities: [], failures: [], threats: [], issues: [] });
  const [conStatus, setConStatus]         = useState<'draft' | 'submitted'>('draft');
  const [expanded, setExpanded]           = useState<Set<number>>(new Set());
  const [saveState, setSave]              = useState<SaveState>('idle');
  const [loading, setLoading]             = useState(true);
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  const load = useCallback(async () => {
    if (!user?.team_id) return;
    setLoading(true);
    try {
      const [reports, cons, members] = await Promise.all([
        getReports({ week, team_id: user.team_id }),
        getConsolidated({ week, team_id: user.team_id }),
        getMembers(user.team_id),
      ]);
      setAllMembers(members
        .filter(m => m.role === 'member' || m.role === 'leader')
        .sort((a, b) => memberSortKey(a.name) - memberSortKey(b.name)));
      setMemberReports([...reports].sort((a, b) =>
        memberSortKey(a.member_name ?? '') - memberSortKey(b.member_name ?? '')));
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

  // ── Paste-import modal state ──────────────────────────────────────────────────
  const [pasteTarget, setPasteTarget] = useState<{ member_id: number; member_name: string } | null>(null);
  const [pasteText,   setPasteText]   = useState('');
  const [parsed,      setParsed]      = useState<SOFTIData | null>(null);
  const [pasteStatus, setPasteStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  function openPasteModal(member_id: number, member_name: string) {
    setPasteTarget({ member_id, member_name });
    setPasteText('');
    setParsed(null);
    setPasteStatus('idle');
  }
  function closePasteModal() { setPasteTarget(null); setShowMemberPicker(false); }

  async function handleDeleteReport(member_id: number, member_name: string) {
    if (!confirm(`Delete ${member_name}'s report for ${week}?`)) return;
    try {
      await deleteReport(member_id, week);
      load();
    } catch (e) {
      console.error(e);
    }
  }

  function handleParse() { setParsed(parseSOFTI(pasteText)); }

  async function handleSaveForMember() {
    if (!pasteTarget || !parsed || !user?.team_id) return;
    setPasteStatus('saving');
    try {
      await saveReport({
        member_id: pasteTarget.member_id,
        team_id: user.team_id,
        week,
        data: parsed,
        status: 'submitted',
      });
      setPasteStatus('saved');
      setTimeout(() => { closePasteModal(); load(); }, 1000);
    } catch {
      setPasteStatus('error');
    }
  }

  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    setExporting(true);
    try {
      await exportToWord({
        week,
        memberName: user?.team_name ?? 'Team',
        teamName: user?.team_name ?? '',
        data: consolidated,
      });
    } finally {
      setExporting(false);
    }
  }

  function isNA(item: string) {
    const norm = item.trim().toLowerCase().replace(/[\s/]/g, '');
    return norm === 'na' || norm === 'none' || norm === 'nil';
  }

  function importAllReports() {
    const merged: SOFTIData = { successes: [], opportunities: [], failures: [], threats: [], issues: [] };
    const dropped: DroppedItem[] = [];

    // Step 1: collect items, track learnings + duplicates
    for (const report of memberReports) {
      const memberName = report.member_name ?? '';
      for (const s of SECTIONS) {
        for (const item of report.data[s] ?? []) {
          if (/^learnings?/i.test(item.trim())) {
            dropped.push({ member_name: memberName, section: s, item, reason: 'learnings' });
            continue;
          }
          if (merged[s].includes(item)) {
            dropped.push({ member_name: memberName, section: s, item, reason: 'duplicate' });
          } else {
            merged[s].push(item);
          }
        }
      }
    }

    // Step 2: N/A — drop if section has real content
    for (const s of SECTIONS) {
      const hasReal = merged[s].some(item => !isNA(item));
      if (hasReal) {
        const naItems = merged[s].filter(isNA);
        naItems.forEach(item => dropped.push({ member_name: '(any)', section: s, item, reason: 'na_replaced' }));
        merged[s] = merged[s].filter(item => !isNA(item));
      } else {
        // All N/A — keep just one
        const naItem = merged[s].find(isNA);
        merged[s] = naItem ? [naItem] : [];
      }
    }

    // Step 3: Merge Documents Reviewed / Approved
    // Each member's content stays on its own line; dedup full lines
    function extractLine(text: string, pat: RegExp): string {
      return text.replace(pat, '').replace(/^[:\s]+/, '').trim();
    }
    function dedupLines(lines: string[]): string[] {
      const seen = new Set<string>();
      return lines.filter(l => { const k = l.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    }

    const reviewedLines: string[] = [];
    const approvedLines: string[] = [];

    merged.successes = merged.successes.filter(item => {
      const hasReviewed = /documents?\s+reviewed/i.test(item);
      const hasApproved = /documents?\s+approved/i.test(item);
      if (!hasReviewed && !hasApproved) return true;
      if (hasReviewed) { const l = extractLine(item, /documents?\s+reviewed/i); if (l) reviewedLines.push(l); }
      if (hasApproved) { const l = extractLine(item, /documents?\s+approved/i); if (l) approvedLines.push(l); }
      dropped.push({ member_name: '(merged)', section: 'successes', item, reason: 'doc_merged' });
      return false;
    });

    const dedupedReviewed = dedupLines(reviewedLines);
    const dedupedApproved = dedupLines(approvedLines);
    if (dedupedReviewed.length > 0) merged.successes.push(`Documents Reviewed\n${dedupedReviewed.join('\n')}`);
    if (dedupedApproved.length > 0) merged.successes.push(`Documents Approved\n${dedupedApproved.join('\n')}`);

    setConsolidated(merged);
    setSave('idle');
    setDroppedItems(dropped);
    if (dropped.length > 0) setShowDropped(true);

    // Auto-save as draft immediately
    if (user?.team_id) {
      saveConsolidated({ team_id: user.team_id, week, data: merged, status: 'draft' })
        .catch(e => console.error('Auto-save draft failed:', e));
    }
  }

  function restoreDropped(d: DroppedItem) {
    setConsolidated(prev => ({
      ...prev,
      [d.section]: prev[d.section].includes(d.item)
        ? prev[d.section]
        : [...prev[d.section], d.item],
    }));
    setDroppedItems(prev => prev.filter(x => x !== d));
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
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-40 transition"
          />
          <WeekSelector week={week} onChange={w => setSearchParams({ week: w })} />
        </div>
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
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    submittedCount === totalCount && totalCount > 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {submittedCount}/{totalCount} submitted
                  </span>
                  <div className="relative">
                    <button
                      onClick={() => setShowMemberPicker(v => !v)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                      title="Enter report for any member"
                    >
                      + Enter Report
                    </button>
                    {showMemberPicker && (
                      <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
                        {allMembers.map(m => (
                          <button
                            key={m.id}
                            onClick={() => { setShowMemberPicker(false); openPasteModal(m.id, m.name); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {memberReports.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-6">No reports submitted yet for this week.</p>
              ) : (
                <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                  {memberReports.map(report => (
                    <div key={report.member_id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Member header */}
                      <div className="flex items-center bg-gray-50 hover:bg-gray-100 transition">
                        <button
                          onClick={() => setExpanded(prev => {
                            const next = new Set(prev);
                            next.has(report.member_id) ? next.delete(report.member_id) : next.add(report.member_id);
                            return next;
                          })}
                          className="flex-1 flex items-center justify-between px-3 py-2 text-left"
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
                        <div className="mr-2 flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); openPasteModal(report.member_id, report.member_name ?? ''); }}
                            className="px-2 py-1 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
                            title="Paste & auto-classify report for this member"
                          >
                            ✎ Enter
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteReport(report.member_id, report.member_name ?? ''); }}
                            className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition"
                            title="Delete this member's report"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Member report content */}
                      {expanded.has(report.member_id) && (
                        <div className="p-3 bg-white">
                          {SECTIONS.map(s => (
                            <SOFTISectionReadOnly
                              key={s}
                              section={s}
                              items={report.data[s]}
                              onCopy={item => copyToConsolidated(s, item)}
                              highlight={search}
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
                  <button
                    onClick={() => { if (confirm('Clear all consolidated content?')) { setConsolidated({ successes: [], opportunities: [], failures: [], threats: [], issues: [] }); setSave('idle'); } }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-semibold transition"
                    title="Clear all consolidated content"
                  >
                    ✕ Clear
                  </button>
                  {memberReports.length > 0 && (
                    <button
                      onClick={importAllReports}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition"
                      title="Import all member reports into consolidated (skips duplicates)"
                    >
                      ↙ Import All
                    </button>
                  )}
                  {droppedItems.length > 0 && !showDropped && (
                    <button
                      onClick={() => setShowDropped(true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-700 text-xs font-semibold transition"
                      title="Review items filtered during import"
                    >
                      ⚠ {droppedItems.length} dropped
                    </button>
                  )}
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
                Drag <strong>⠿</strong> to reorder items.
              </p>

              <div className="max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {SECTIONS.map(s => (
                  <SOFTISectionEditable
                    key={s}
                    section={s}
                    items={consolidated[s]}
                    onChange={items => setSection(s, items)}
                    canReorder
                    highlight={search}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4 justify-end border-t border-gray-100 pt-4 flex-wrap">
                <button
                  onClick={handleExport}
                  disabled={exporting || SECTIONS.every(s => consolidated[s].length === 0)}
                  className="px-5 py-2 rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {exporting ? 'Exporting…' : '↓ Export to Word'}
                </button>
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

      {/* ── Paste-import modal ── */}
      {pasteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Enter Report for {pasteTarget.member_name}</h2>
                <p className="text-sm text-gray-400 mt-0.5">Paste their report below — the app will auto-classify into SOFTI sections.</p>
              </div>
              <button onClick={closePasteModal} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Paste area */}
              {!parsed && (
                <div>
                  <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Paste report content</label>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder={"Paste the member's report here.\n\nWorks best with clearly labeled sections, e.g.:\n\nSuccesses:\n- Item A\n- Item B\n\nIssues:\n- Item C"}
                    rows={12}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none font-mono"
                    autoFocus
                  />
                </div>
              )}

              {/* Parsed preview */}
              {parsed && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">Preview — adjust if needed</span>
                    <button onClick={() => setParsed(null)} className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold">← Re-paste</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SECTIONS.map(s => (
                      <SOFTISectionReadOnly key={s} section={s} items={parsed[s]} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closePasteModal} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              {!parsed ? (
                <button
                  onClick={handleParse}
                  disabled={!pasteText.trim()}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition disabled:opacity-40"
                >
                  Parse →
                </button>
              ) : (
                <button
                  onClick={handleSaveForMember}
                  disabled={pasteStatus === 'saving'}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {pasteStatus === 'saving' ? 'Saving…' : pasteStatus === 'saved' ? '✓ Saved!' : pasteStatus === 'error' ? '✗ Error' : 'Save as Submitted'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Dropped-items review modal ── */}
      {showDropped && droppedItems.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Review Dropped Items</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {droppedItems.length} item{droppedItems.length !== 1 ? 's' : ''} were filtered during import. Restore any you'd like to keep.
                </p>
              </div>
              <button onClick={() => setShowDropped(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {droppedItems.map((d, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{d.section}</span>
                      {d.member_name !== '(any)' && d.member_name !== '(merged)' && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{d.member_name}</span>
                      )}
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{DROPPED_REASON_LABEL[d.reason]}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{d.item}</p>
                  </div>
                  <button
                    onClick={() => restoreDropped(d)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                  >
                    ↩ Restore
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <span className="text-sm text-gray-400">{droppedItems.length} item{droppedItems.length !== 1 ? 's' : ''} remaining</span>
              <button
                onClick={() => setShowDropped(false)}
                className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
