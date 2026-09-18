import { isDate, todayInTimezone } from "./dates";
import type { Entry } from "./types";

export function canCheckIn(date: string, today: string, hasEntry: boolean): boolean {
  return isDate(date) && (date === today || (date < today && hasEntry));
}

export function assertCheckInDate(date: string, entries: Entry[], timezone: string, now = new Date()): void {
  // Read the clock at save time as well as in the UI, including across midnight.
  const today = todayInTimezone(timezone, now);
  if (!canCheckIn(date, today, entries.some((entry) => entry.date === date))) {
    throw new Error("Missed days are closed. Add a check-in for today instead.");
  }
}
