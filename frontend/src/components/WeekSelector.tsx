import React from 'react';
import { prevWeek, nextWeek, formatWeek, getWeekDateRange, getCurrentWeek } from '../utils';

interface Props {
  week: string;
  onChange: (week: string) => void;
}

const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function weekToMonday(week: string): Date {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(y, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Returns the Sunday that starts the calendar row for a given Monday
function rowSunday(monday: Date): Date {
  const sun = new Date(monday);
  sun.setDate(monday.getDate() - 1); // Monday − 1 = Sunday
  sun.setHours(0, 0, 0, 0);
  return sun;
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

export default function WeekSelector({ week, onChange }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentWeek = getCurrentWeek();

  // The two weeks to display: selected (report) week + current week
  // If they're the same, show only one row
  const weeks = week === currentWeek ? [week] : [week, currentWeek];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm select-none" style={{ width: 232 }}>

      {/* Arrow nav */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <button
          onClick={() => onChange(prevWeek(week))}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 transition"
          title="Previous week"
        >‹</button>
        <div className="text-center">
          <div className="text-xs font-bold text-gray-800">{formatWeek(week)}</div>
          <div className="text-xs text-gray-400">{getWeekDateRange(week)}</div>
        </div>
        <button
          onClick={() => onChange(nextWeek(week))}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 transition"
          title="Next week"
        >›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 px-2 pt-2 mb-0.5">
        {DAY_LABELS.map((lbl, i) => (
          <div
            key={lbl}
            className={`text-center text-xs font-semibold ${i === 0 || i === 6 ? 'text-gray-300' : 'text-gray-400'}`}
          >
            {lbl}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="px-2 pb-2 space-y-0.5">
        {weeks.map(w => {
          const monday = weekToMonday(w);
          const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
          const sunday = rowSunday(monday);
          const isSelWeek = w === week;

          // Build the 7 days: Sun Mon Tue Wed Thu Fri Sat
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(sunday);
            d.setDate(sunday.getDate() + i);
            d.setHours(0, 0, 0, 0);
            return d;
          });

          return (
            <div key={w} className="grid grid-cols-7">
              {days.map((d, ci) => {
                const isToday    = sameDay(d, today);
                const inSelBand  = isSelWeek && ci >= 1 && ci <= 5; // Mon–Fri cols
                const isWeekend  = ci === 0 || ci === 6;

                let textCls = isWeekend ? 'text-gray-300' : 'text-gray-600';
                if (inSelBand) textCls = 'text-indigo-700 font-semibold';

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
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
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
          );
        })}
      </div>
    </div>
  );
}
