import { addDays, isDate, parseDate } from "./dates";
import type { Entry } from "./types";

export const INSIGHT_PRESETS = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "1 year" },
  { value: "all", label: "All time" },
] as const;
export type InsightPreset = typeof INSIGHT_PRESETS[number]["value"];
export type DateRange = { from: string; to: string };
export type InsightSelection = InsightPreset | DateRange;

export function dateRangeError({ from, to }: DateRange, today: string): string | null {
  if (!isDate(from) || !isDate(to) || from < "0001-01-01" || to < "0001-01-01") return "Choose a valid start and end date.";
  if (from > to) return "The start date must be on or before the end date.";
  if (to > today) return "Choose today or an earlier date.";
  return null;
}

export function insightRange(selection: InsightSelection, entries: Entry[], today: string): DateRange & { days: number } {
  const range = typeof selection === "object" ? selection : {
    from: selection === "all"
      ? entries.reduce((earliest, entry) => entry.date < earliest ? entry.date : earliest, today)
      : addDays(today, 1 - selection),
    to: today,
  };
  return { ...range, days: Math.round((parseDate(range.to).getTime() - parseDate(range.from).getTime()) / 86_400_000) + 1 };
}
