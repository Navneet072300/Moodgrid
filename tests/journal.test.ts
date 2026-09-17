import test from "node:test";
import assert from "node:assert/strict";
import { addDays, calendarDays, isDate, todayInTimezone, yearStart } from "../src/lib/dates";
import { averageMood, currentStreak, moodDistribution, moodTrend, tagDistribution } from "../src/lib/insights";
import { getMood, MOODS, searchMoods } from "../src/lib/moods";
import { entrySchema } from "../src/lib/validation";
import { summaryPayload } from "../src/lib/summary";
import type { Entry } from "../src/lib/types";

function entry(date: string, emoji = "😊", tags: string[] = []): Entry {
  return { id: date, user_id: "test-user", date, emoji, note: "A small moment.", created_at: `${date}T12:00:00Z`, tags: tags.map((name) => ({ id: name, name })) };
}

test("calendar arithmetic respects leap days, month boundaries and DST", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2025-02-28", 1), "2025-03-01");
  assert.equal(addDays("2026-03-08", 1), "2026-03-09");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(yearStart("2026-09-16"), "2025-10-01");
  assert.equal(isDate("2026-02-30"), false);
  assert.equal(isDate("2024-02-29"), true);
});
test("a user's local day can differ from UTC in either direction", () => {
  const moment = new Date("2026-09-16T20:00:00Z");
  assert.equal(todayInTimezone("Asia/Kolkata", moment), "2026-09-17");
  assert.equal(todayInTimezone("America/Los_Angeles", new Date("2026-09-16T02:00:00Z")), "2026-09-15");
});
test("the contribution grid aligns on Sunday and includes today exactly once", () => {
  const days = calendarDays("2026-09-16");
  assert.equal(days.length % 7, 0);
  assert.equal(new Date(`${days[0]}T12:00:00Z`).getUTCDay(), 0);
  assert.equal(days.filter((date) => date === "2026-09-16").length, 1);
  assert.ok(days.includes("2025-10-01"));
  assert.equal(new Set(days).size, days.length);
});
test("streak permits today's check-in to be pending and stops at gaps", () => {
  const entries = [entry("2026-09-15"), entry("2026-09-14"), entry("2026-09-13")];
  assert.equal(currentStreak(entries, "2026-09-16"), 3);
  assert.equal(currentStreak([...entries, entry("2026-09-16")], "2026-09-16"), 4);
  assert.equal(currentStreak(entries, "2026-09-17"), 0);
  assert.equal(currentStreak([entry("2026-09-16"), entry("2026-09-14")], "2026-09-16"), 1);
});
test("all forty moods have unique colors and a score from one to five", () => {
  assert.equal(MOODS.length, 40);
  assert.equal(new Set(MOODS.map((mood) => mood.emoji)).size, 40);
  assert.equal(new Set(MOODS.map((mood) => mood.color)).size, 40);
  assert.ok(MOODS.every((mood) => mood.score !== null && mood.score >= 1 && mood.score <= 5));
  assert.ok(searchMoods(" CALM ").some((mood) => mood.emoji === "😌"));
  assert.equal(searchMoods("not-a-mood").length, 0);
  assert.equal(searchMoods("😤")[0].label, "Frustrated");
});
test("insights count observations without treating missing days as zero", () => {
  const entries = [entry("2026-09-14", "😊", ["work"]), entry("2026-09-16", "😠", ["work", "rest"])];
  assert.equal(averageMood(entries), 3);
  assert.equal(averageMood([]), null);
  assert.deepEqual(tagDistribution(entries), [{ name: "work", count: 2 }, { name: "rest", count: 1 }]);
  assert.equal(moodDistribution(entries).reduce((sum, mood) => sum + mood.count, 0), 2);
  assert.deepEqual(moodTrend(entries, "2026-09-16", 3).map((point) => point.score), [5, null, 1]);
  assert.equal(getMood("😠").score, 1);
});
test("entry validation normalizes tags and enforces date, mood and Unicode note limits", () => {
  const base = { date: "2024-01-01", emoji: "😊", note: "🙂".repeat(280), tags: [" Work ", "work"], timezone: "UTC" };
  const result = entrySchema.safeParse(base);
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data.tags, ["work"]);
  assert.equal(entrySchema.safeParse({ ...base, note: "🙂".repeat(281) }).success, false);
  assert.equal(entrySchema.safeParse({ ...base, emoji: "not-emoji" }).success, false);
  assert.equal(entrySchema.safeParse({ ...base, date: "2099-01-01" }).success, false);
  assert.equal(entrySchema.safeParse({ ...base, date: "2024-02-30" }).success, false);
  assert.equal(entrySchema.safeParse({ ...base, tags: Array.from({ length: 9 }, (_, index) => `tag${index}`) }).success, false);
  assert.equal(entrySchema.safeParse({ ...base, timezone: "Invalid/Timezone" }).success, false);
});
test("weekly summary payload contains only journal content and accurate counts", () => {
  const entries = [entry("2026-09-15", "😤", ["work"]), entry("2026-09-16", "😤", ["work"])];
  const result = summaryPayload(entries, "2026-09-10", "2026-09-16");
  assert.equal(result.logged_days, 2);
  assert.deepEqual(result.mood_counts, [{ emoji: "😤", label: "Frustrated", count: 2 }]);
  assert.equal(JSON.stringify(result).includes("test-user"), false);
  assert.deepEqual(Object.keys(result.entries[0]).sort(), ["date", "emoji", "mood_score", "note", "sticker", "tags"]);
});
