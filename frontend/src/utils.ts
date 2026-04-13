export function getCurrentWeek(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function prevWeek(week: string): string {
  const [y, w] = week.split('-W').map(Number);
  if (w === 1) return `${y - 1}-W52`;
  return `${y}-W${String(w - 1).padStart(2, '0')}`;
}

export function nextWeek(week: string): string {
  const [y, w] = week.split('-W').map(Number);
  if (w >= 52) return `${y + 1}-W01`;
  return `${y}-W${String(w + 1).padStart(2, '0')}`;
}

export function formatWeek(week: string): string {
  const [y, w] = week.split('-W');
  return `Week ${w}, ${y}`;
}

export function getWeekDateRange(week: string): string {
  const [y, w] = week.split('-W').map(Number);
  // ISO week: week 1 contains Jan 4
  const jan4 = new Date(y, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (w - 1) * 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(friday)}`;
}
