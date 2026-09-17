import test from "node:test";
import assert from "node:assert/strict";
import { dateRangeError, insightRange } from "../src/lib/insight-ranges";
import { moodTrend } from "../src/lib/insights";
import type { Entry } from "../src/lib/types";

function entry(date: string, mood_score = 5): Entry {
  return { id: date, user_id: "test", date, emoji: "😊", mood_score, note: null, tags: [], created_at: `${date}T12:00:00Z` };
}

test("preset and custom windows include both endpoints across leap days and DST", () => {
  assert.deepEqual(insightRange(7, [], "2024-03-02"), { from: "2024-02-25", to: "2024-03-02", days: 7 });
  assert.deepEqual(insightRange({ from: "2024-02-28", to: "2024-03-01" }, [], "2026-09-17"), { from: "2024-02-28", to: "2024-03-01", days: 3 });
  assert.equal(insightRange({ from: "2026-03-07", to: "2026-03-09" }, [], "2026-09-17").days, 3);
  assert.equal(insightRange({ from: "2026-09-17", to: "2026-09-17" }, [], "2026-09-17").days, 1);
});

test("all time starts with the earliest check-in and works for an empty journal", () => {
  assert.deepEqual(insightRange("all", [entry("2026-09-16"), entry("2026-09-01"), entry("2026-09-30")], "2026-09-17"), { from: "2026-09-01", to: "2026-09-17", days: 17 });
  assert.deepEqual(insightRange("all", [], "2026-09-17"), { from: "2026-09-17", to: "2026-09-17", days: 1 });
});

test("custom date validation rejects missing, impossible, reversed and future dates", () => {
  const today = "2026-09-17";
  assert.equal(dateRangeError({ from: today, to: today }, today), null);
  for (const range of [
    { from: "", to: today }, { from: today, to: "" },
    { from: "2026-02-30", to: today }, { from: "0000-01-01", to: today },
    { from: today, to: "2026-09-16" }, { from: today, to: "2026-09-18" },
  ]) assert.ok(dateRangeError(range, today));
});

test("historical trends use the selected end date and exclude observations outside the window", () => {
  const points = moodTrend([entry("2024-02-27", 1), entry("2024-02-28", 2), entry("2024-03-01", 4), entry("2026-09-17", 5)], "2024-03-01", 3);
  assert.deepEqual(points.map(({ date, score, count }) => ({ date, score, count })), [
    { date: "2024-02-28", score: 2, count: 1 },
    { date: "2024-02-29", score: null, count: 0 },
    { date: "2024-03-01", score: 4, count: 1 },
  ]);
});

test("long ranges stay bounded and include the final partial averaging period", () => {
  const entries = [entry("1926-01-01", 1), entry("2026-09-17", 5)];
  const range = insightRange("all", entries, "2026-09-17");
  const points = moodTrend(entries, range.to, range.days);
  assert.ok(points.length <= 156);
  assert.equal(points[0].date, range.from);
  assert.equal(points[0].score, 1);
  assert.equal(points.at(-1)?.score, 5);
  assert.equal(points.reduce((sum, point) => sum + point.count, 0), 2);
  assert.ok(points.some((point) => point.score === null));
});
