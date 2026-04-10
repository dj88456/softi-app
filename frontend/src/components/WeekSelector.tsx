import React from 'react';
import { formatWeek, getWeekDateRange, prevWeek, nextWeek, getCurrentWeek } from '../utils';

interface Props {
  week: string;
  onChange: (week: string) => void;
}

export default function WeekSelector({ week, onChange }: Props) {
  const isCurrentWeek = week === getCurrentWeek();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(prevWeek(week))}
        className="p-1.5 rounded hover:bg-gray-200 transition text-gray-600"
        title="Previous week"
      >
        &#8592;
      </button>

      <div className="text-center min-w-[180px]">
        <div className="font-semibold text-gray-800">{formatWeek(week)}</div>
        <div className="text-xs text-gray-500">{getWeekDateRange(week)}</div>
      </div>

      <button
        onClick={() => onChange(nextWeek(week))}
        className="p-1.5 rounded hover:bg-gray-200 transition text-gray-600"
        title="Next week"
      >
        &#8594;
      </button>

      {!isCurrentWeek && (
        <button
          onClick={() => onChange(getCurrentWeek())}
          className="ml-1 px-2 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
        >
          Today
        </button>
      )}
    </div>
  );
}
