import { addDays, formatDate, parseDate, yearStart } from "./dates";
import { getEntryMood } from "./moods";
import type { Entry } from "./types";

export function currentStreak(entries: Entry[], today: string): number {
  const dates = new Set(entries.map((entry) => entry.date));
  let date = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(date)) { streak++; date = addDays(date, -1); }
  return streak;
}
export function moodDistribution(entries: Entry[]) {
  const groups = new Map<string, { entry: Entry; count: number }>();
  for (const entry of entries) {
    const key = entry.sticker_id || entry.emoji || "unknown";
    const group = groups.get(key);
    groups.set(key, { entry, count: (group?.count ?? 0) + 1 });
  }
  return [...groups].map(([key, { entry, count }]) => ({ ...getEntryMood(entry), key, sticker: entry.sticker ?? null, count })).sort((a, b) => b.count - a.count);
}
export function tagDistribution(entries: Entry[]) {
  const counts = new Map<string, number>();
  entries.forEach((entry) => new Set(entry.tags.map((tag) => tag.name)).forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1)));
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
export function averageMood(entries: Entry[]): number | null {
  const scores = entries.map((entry) => getEntryMood(entry).score).filter((score): score is number => score !== null);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}
export function moodTrendBucket(days: number): number {
  // Keep long all-time/custom ranges readable with at most 156 chart points.
  return days > 60 ? Math.max(7, Math.ceil(days / 156)) : 1;
}
export function moodTrend(entries: Entry[], end: string, days: number) {
  const bucket = moodTrendBucket(days);
  const start = addDays(end, 1 - days);
  const startTime = parseDate(start).getTime();
  const groups = new Map<number, Entry[]>();
  for (const entry of entries) {
    if (entry.date < start || entry.date > end) continue;
    const offset = Math.round((parseDate(entry.date).getTime() - startTime) / 86_400_000);
    const index = Math.floor(offset / bucket);
    const group = groups.get(index) ?? [];
    group.push(entry); groups.set(index, group);
  }
  const points: { date: string; label: string; score: number | null; count: number }[] = [];
  for (let offset = 0; offset < days; offset += bucket) {
    const date = addDays(start, offset);
    const values = groups.get(offset / bucket) ?? [];
    const mean = averageMood(values);
    points.push({ date, label: formatDate(date, days > 365 ? { month: "short", day: "numeric", year: "numeric" } : undefined), score: mean === null ? null : Number(mean.toFixed(2)), count: values.length });
  }
  return points;
}
export function entriesInYear(entries: Entry[], today: string) {
  return entries.filter((entry) => entry.date >= yearStart(today) && entry.date <= today);
}
