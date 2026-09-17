// Date-only arithmetic uses UTC noon to avoid DST and timezone rollover.
export function parseDate(date: string): Date { return new Date(`${date}T12:00:00Z`); }
export function addDays(date: string, days: number): string {
  const value = parseDate(date); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function todayInTimezone(timezone = "UTC", now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function isTimezone(value: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
}
export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseDate(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(parseDate(date));
}
export function yearStart(today: string): string {
  const date = parseDate(today);
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - 11);
  return date.toISOString().slice(0, 10);
}
export function calendarDays(today: string): string[] {
  const start = yearStart(today);
  const aligned = addDays(start, -parseDate(start).getUTCDay());
  const end = addDays(today, 6 - parseDate(today).getUTCDay());
  const result: string[] = [];
  for (let date = aligned; date <= end; date = addDays(date, 1)) result.push(date);
  return result;
}
