import React, { useState, useEffect } from 'react';
import { prevWeek, nextWeek, formatWeek, getWeekDateRange } from '../utils';

interface Props {
  week: string;
  onChange: (week: string) => void;
}

// Su Mo Tu We Th Fr Sa
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ISO week string → Monday Date (local time, midnight)
function weekToMonday(week: string): Date {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(y, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Date → ISO week string
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

export default function WeekSelector({ week, onChange }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selMonday = weekToMonday(week);
  const selFriday = new Date(selMonday);
  selFriday.setDate(selMonday.getDate() + 4);

  // Separately track the viewed month so the user can browse without changing selection
  const [viewYear,  setViewYear]  = useState(selMonday.getFullYear());
  const [viewMonth, setViewMonth] = useState(selMonday.getMonth());

  // When selected week changes externally, snap view to that month
  useEffect(() => {
    const m = weekToMonday(week);
    setViewYear(m.getFullYear());
    setViewMonth(m.getMonth());
  }, [week]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // Build grid: week starts Sunday (getDay() === 0)
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const firstDow = firstOfMonth.getDay(); // 0=Sun … 6=Sat
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstDow);
  gridStart.setHours(0, 0, 0, 0);

  const rows: Date[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: Date[] = [];
    for (let c = 0; c < 7; c++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + r * 7 + c);
      d.setHours(0, 0, 0, 0);
      row.push(d);
    }
    if (r >= 4 && row.every(d => d.getMonth() !== viewMonth)) break;
    rows.push(row);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm select-none" style={{ width: 232 }}>

      {/* ── Week nav (arrow selector) ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <button
          onClick={() => onChange(prevWeek(week))}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 text-base transition"
          title="Previous week"
        >‹</button>
        <div className="text-center">
          <div className="text-xs font-bold text-gray-800">{formatWeek(week)}</div>
          <div className="text-xs text-gray-400">{getWeekDateRange(week)}</div>
        </div>
        <button
          onClick={() => onChange(nextWeek(week))}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 text-base transition"
          title="Next week"
        >›</button>
      </div>

      {/* ── Month nav ── */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <button
          onClick={prevMonth}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 text-sm transition"
        >‹</button>
        <span className="text-xs font-semibold text-gray-600">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 text-sm transition"
        >›</button>
      </div>

      {/* ── Day-of-week headers ── */}
      <div className="grid grid-cols-7 px-2 mb-0.5">
        {DAY_LABELS.map((lbl, i) => (
          <div
            key={lbl}
            className={`text-center text-xs font-semibold ${i === 0 || i === 6 ? 'text-gray-300' : 'text-gray-400'}`}
          >
            {lbl}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div className="px-2 pb-2 space-y-px">
        {rows.map((rowDays, ri) => (
          <div key={ri} className="grid grid-cols-7">
            {rowDays.map((d, ci) => {
              const inMonth   = d.getMonth() === viewMonth;
              const isToday   = sameDay(d, today);
              // Mon–Fri band: columns 1–5 in Sunday-first layout
              const isWorkday = ci >= 1 && ci <= 5;
              const inSelBand = isWorkday && d >= selMonday && d <= selFriday;
              const isWeekend = ci === 0 || ci === 6;

              let textCls = inMonth
                ? isWeekend ? 'text-gray-300' : 'text-gray-600'
                : 'text-gray-200';
              if (inSelBand && inMonth) textCls = 'text-indigo-700 font-semibold';

              // Rounded band ends: Monday=col1, Friday=col5
              let bandCls = '';
              if (inSelBand) {
                bandCls = 'bg-indigo-100';
                if (ci === 1) bandCls += ' rounded-l-md';
                if (ci === 5) bandCls += ' rounded-r-md';
              }

              return (
                <div
                  key={ci}
                  onClick={() => onChange(dateToWeek(d))}
                  className={`flex items-center justify-center h-7 cursor-pointer ${bandCls}`}
                >
                  {isToday ? (
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center z-10">
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
  );
}
