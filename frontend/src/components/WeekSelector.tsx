import React, { useState, useEffect } from 'react';

interface Props {
  week: string;
  onChange: (week: string) => void;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

// ISO week string → Monday Date
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

  // View month — track separately so user can browse without changing selected week
  const [viewYear,  setViewYear]  = useState(selMonday.getFullYear());
  const [viewMonth, setViewMonth] = useState(selMonday.getMonth());

  // When selected week changes externally, jump view to that month
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

  // Build 6×7 day grid starting from Monday of the week containing 1st of the month
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const firstDow = firstOfMonth.getDay() || 7; // 1=Mon … 7=Sun
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - (firstDow - 1));

  const rows: Date[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: Date[] = [];
    for (let c = 0; c < 7; c++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + r * 7 + c);
      d.setHours(0, 0, 0, 0);
      row.push(d);
    }
    // Stop if the whole row is outside the current month and we've passed it
    if (r >= 4 && row.every(d => d.getMonth() !== viewMonth)) break;
    rows.push(row);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 select-none" style={{ width: 224 }}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={prevMonth}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 text-base leading-none transition"
        >‹</button>
        <span className="text-sm font-semibold text-gray-800">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 text-base leading-none transition"
        >›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((lbl, i) => (
          <div
            key={lbl}
            className={`text-center text-xs font-semibold ${i >= 5 ? 'text-gray-300' : 'text-gray-400'}`}
          >
            {lbl}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="space-y-px">
        {rows.map((rowDays, ri) => (
          <div key={ri} className="grid grid-cols-7">
            {rowDays.map((d, ci) => {
              const inMonth   = d.getMonth() === viewMonth;
              const isToday   = sameDay(d, today);
              const isWeekend = ci >= 5; // Sa / Su columns
              const inSelBand = d >= selMonday && d <= selFriday; // Mon–Fri highlight

              // Base text colour
              let textCls = inMonth
                ? isWeekend ? 'text-gray-300' : 'text-gray-700'
                : 'text-gray-200';

              if (inSelBand && inMonth) textCls = 'text-indigo-700 font-semibold';

              // Band background: first / middle / last of the Mon–Fri strip
              let bandCls = '';
              if (inSelBand) {
                bandCls = 'bg-indigo-100';
                if (ci === 0) bandCls += ' rounded-l-md';      // Monday
                if (ci === 4) bandCls += ' rounded-r-md';      // Friday
              }

              return (
                <div
                  key={ci}
                  onClick={() => onChange(dateToWeek(d))}
                  className={`relative flex items-center justify-center h-7 cursor-pointer ${bandCls}`}
                >
                  {isToday ? (
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center z-10">
                      {d.getDate()}
                    </span>
                  ) : (
                    <span className={`text-xs ${textCls} hover:text-indigo-600 transition`}>
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
