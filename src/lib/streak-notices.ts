import { addDays } from "./dates";
import { currentStreak } from "./insights";
import type { Entry } from "./types";

export type StreakNotice = { id: string; kind: "break" | "milestone"; days: number };
export const MAX_STREAK_RECEIPTS = 256;

export function mergeStreakReceipts(...groups: (string[] | undefined)[]): string[] {
  return [...new Set(groups.flatMap((group) => group ?? []))].slice(-MAX_STREAK_RECEIPTS);
}

export function getStreakNotice(entries: Entry[], today: string, seen: string[] = []): StreakNotice | null {
  const dates = new Set(entries.filter((entry) => entry.date <= today).map((entry) => entry.date));
  const streak = currentStreak(entries, today);
  if (streak >= 50) {
    const end = dates.has(today) ? today : addDays(today, -1);
    const start = addDays(end, 1 - streak);
    const days = Math.floor(streak / 50) * 50;
    const id = `milestone:${start}:${days}`;
    return seen.includes(id) ? null : { id, kind: "milestone", days };
  }

  // Today remains open. Only an unlogged day before today breaks a streak.
  // Looking before today also catches a return followed by a new check-in.
  const last = [...dates].filter((date) => date < today).sort().at(-1);
  if (!last || last >= addDays(today, -1)) return null;
  const id = `break:${last}`;
  if (seen.includes(id)) return null;
  let days = 0;
  for (let date = last; dates.has(date); date = addDays(date, -1)) days++;
  return { id, kind: "break", days };
}
