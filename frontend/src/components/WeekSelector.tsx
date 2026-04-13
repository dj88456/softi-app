import React, { useState, useEffect, useRef } from 'react';
import { prevWeek, nextWeek, formatWeek, getWeekDateRange, getCurrentWeek } from '../utils';

interface Props {
  week: string;
  onChange: (week: string) => void;
}

const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function weekToMonday(isoWeek: string): Date {
  const [y, w] = isoWeek.split('-W').map(Number);
  const jan4 = new Date(y, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function dateToWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

function buildMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const lastDay = new Date(year, month + 1, 0);
  const rows: Date[][] = [];
  let cur = new Date(start);
  while (cur <= lastDay) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()));
      cur.setDate(cur.getDate() + 1);
    }
    rows.push(row);
  }
  return rows;
}

export default function WeekSelector({ week, onChange }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selMonday = weekToMonday(week);
  const selFriday = new Date(selMonday);
  selFriday.setDate(selMonday.getDate() + 4);

  const [open, setOpen] = useState(false);
  const [viewYear,  setViewYear]  = useState(selMonday.getFullYear());
  const [viewMonth, setViewMonth] = useState(selMonday.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync view month when week changes externally
  useEffect(() => {
    const m = weekToMonday(week);
    setViewYear(m.getFullYear());
    setViewMonth(m.getMonth());
  }, [week]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleDayClick(d: Date) {
    onChange(dateToWeek(d));
    setOpen(false);
  }

  function handleWeekNav(newWeek: string) {
    onChange(newWeek);
    const m = weekToMonday(newWeek);
    setViewYear(m.getFullYear());
    setViewMonth(m.getMonth());
  }

  const grid = buildMonthGrid(viewYear, viewMonth);
  const defaultWeek = prevWeek(getCurrentWeek());
  const isDefault = week === defaultWeek;

  return (
    <div ref={containerRef} className="relative select-none">

      {/* Compact trigger — looks like the original week selector */}
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-sm px-1 py-1">
        <button
          onClick={e => { e.stopPropagation(); handleWeekNav(prevWeek(week)); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
        >‹</button>

        <button
          onClick={() => setOpen(o => !o)}
          className="flex flex-col items-center px-2 py-0.5 rounded-lg hover:bg-gray-50 transition min-w-[140px]"
        >
          <span className="text-xs font-bold text-gray-800">{formatWeek(week)}</span>
          <span className="text-xs text-gray-400">{getWeekDateRange(week)}</span>
        </button>

        <button
          onClick={e => { e.stopPropagation(); handleWeekNav(nextWeek(week)); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
        >›</button>
      </div>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl border border-gray-200 shadow-lg" style={{ width: 240 }}>

          {/* Month nav */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <button onClick={prevMonth}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 transition">‹</button>
            <span className="text-xs font-bold text-gray-700">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 transition">›</button>
          </div>

          {/* Back to default */}
          {!isDefault && (
            <div className="flex justify-center px-3 py-1 border-b border-gray-100">
              <button
                onClick={() => { onChange(defaultWeek); setOpen(false); }}
                className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition"
              >
                ↩ Back to last week
              </button>
            </div>
          )}

          {/* Day headers */}
          <div className="grid grid-cols-7 px-2 pt-1.5 mb-0.5">
            {DAY_LABELS.map((lbl, i) => (
              <div key={lbl}
                className={`text-center text-xs font-semibold ${i === 0 || i === 6 ? 'text-gray-300' : 'text-gray-400'}`}>
                {lbl}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="px-2 pb-2 space-y-0.5">
            {grid.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7">
                {row.map((d, ci) => {
                  const isToday     = sameDay(d, today);
                  const isThisMonth = d.getMonth() === viewMonth;
                  const inSelBand   = d >= selMonday && d <= selFriday;
                  const isWeekend   = ci === 0 || ci === 6;

                  let textCls = '';
                  if (!isThisMonth) textCls = 'text-gray-200';
                  else if (inSelBand) textCls = 'text-indigo-700 font-semibold';
                  else if (isWeekend) textCls = 'text-gray-300';
                  else textCls = 'text-gray-600';

                  let bandCls = '';
                  if (inSelBand) {
                    bandCls = 'bg-indigo-100';
                    if (d.getTime() === selMonday.getTime()) bandCls += ' rounded-l-md';
                    if (d.getTime() === selFriday.getTime()) bandCls += ' rounded-r-md';
                  }

                  return (
                    <div key={ci} onClick={() => handleDayClick(d)}
                      className={`flex items-center justify-center h-6 cursor-pointer ${bandCls}`}>
                      {isToday ? (
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                          {d.getDate()}
                        </span>
                      ) : (
                        <span className={`text-xs ${textCls} hover:text-indigo-500 transition`}>
                          {d.getDate()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
