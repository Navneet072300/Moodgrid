import test from "node:test";
import assert from "node:assert/strict";
import { addDays, todayInTimezone } from "../src/lib/dates";
import { assertCheckInDate, canCheckIn } from "../src/lib/check-in-policy";
import { getStreakNotice, mergeStreakReceipts, MAX_STREAK_RECEIPTS } from "../src/lib/streak-notices";
import type { Entry } from "../src/lib/types";

function entry(date: string): Entry {
  return { id: date, user_id: "test-user", date, emoji: "😊", note: null, created_at: `${date}T12:00:00Z`, tags: [] };
}
function run(end: string, days: number): Entry[] {
  return Array.from({ length: days }, (_, index) => entry(addDays(end, -index)));
}

test("new check-ins are today-only; existing past entries remain editable", () => {
  const today = "2026-09-18";
  const now = new Date("2026-09-18T12:00:00Z");
  assert.equal(canCheckIn(today, today, false), true);
  assert.equal(canCheckIn("2026-09-17", today, false), false);
  assert.equal(canCheckIn("2026-09-17", today, true), true);
  assert.equal(canCheckIn("2026-09-19", today, true), false);
  assert.equal(canCheckIn("2026-02-30", today, true), false);
  assert.doesNotThrow(() => assertCheckInDate(today, [], "UTC", now));
  assert.doesNotThrow(() => assertCheckInDate("2026-09-17", [entry("2026-09-17")], "UTC", now));
  assert.throws(() => assertCheckInDate("2026-09-17", [], "UTC", now), /Missed days are closed/);
  assert.throws(() => assertCheckInDate("2026-09-19", [], "UTC", now), /Missed days are closed/);
});

test("the save guard reads the current local date when a form crosses midnight", () => {
  const before = new Date("2026-09-17T18:29:59Z");
  const after = new Date("2026-09-17T18:30:00Z");
  assert.doesNotThrow(() => assertCheckInDate("2026-09-17", [], "Asia/Kolkata", before));
  assert.throws(() => assertCheckInDate("2026-09-17", [], "Asia/Kolkata", after), /Missed days are closed/);
  assert.doesNotThrow(() => assertCheckInDate("2026-09-18", [], "Asia/Kolkata", after));
  assert.doesNotThrow(() => assertCheckInDate("2026-09-17", [], "America/Los_Angeles", after));
});

test("a full missed local day triggers one gentle break notice, even after returning today", () => {
  const entries = run("2026-09-16", 7);
  assert.equal(getStreakNotice(entries, "2026-09-17"), null, "today is still open");
  const notice = getStreakNotice(entries, "2026-09-18");
  assert.deepEqual(notice, { id: "break:2026-09-16", kind: "break", days: 7 });
  assert.deepEqual(getStreakNotice([...entries, entry("2026-09-18")], "2026-09-18"), notice);
  assert.equal(getStreakNotice(entries, "2026-09-25", [notice!.id]), null, "no repeated reminder for the same gap");
  assert.equal(getStreakNotice([], "2026-09-18"), null, "first-time users have no lost streak");
  assert.equal(getStreakNotice([entry("2026-09-18")], "2026-09-18"), null);
});

test("break detection respects local midnight, month boundaries, and leap days", () => {
  const now = new Date("2024-03-01T00:30:00Z");
  const entries = run("2024-02-28", 3);
  assert.equal(getStreakNotice(entries, todayInTimezone("America/Los_Angeles", now)), null);
  assert.equal(getStreakNotice(entries, todayInTimezone("Asia/Kolkata", now))?.kind, "break");
  assert.equal(getStreakNotice(run("2025-12-31", 5), "2026-01-01"), null);
  assert.equal(getStreakNotice(run("2025-12-31", 5), "2026-01-02")?.days, 5);
});

test("achievements celebrate 50, 100, 150 and further multiples once per streak", () => {
  const start = "2025-01-01";
  for (const days of [50, 100, 150, 200, 500]) {
    const today = addDays(start, days - 1);
    const entries = run(today, days);
    const notice = getStreakNotice(entries, today);
    assert.deepEqual(notice, { id: `milestone:${start}:${days}`, kind: "milestone", days });
    assert.equal(getStreakNotice(entries, today, [notice!.id]), null);
    assert.equal(getStreakNotice([...entries, { ...entries[0], note: "edited" }], today, [notice!.id]), null);
    assert.equal(getStreakNotice([...entries, entry(addDays(today, 1))], addDays(today, 1), [notice!.id]), null);
  }
  assert.equal(getStreakNotice(run("2026-09-18", 49), "2026-09-18"), null);
});

test("milestones are based on consecutive unique dates, with a fresh celebration after a restart", () => {
  const today = "2026-09-18";
  const entries = run(today, 50);
  assert.equal(getStreakNotice([...entries, entries[0]], today)?.days, 50);
  assert.equal(getStreakNotice([...entries.slice(0, 49), entry("2099-01-01")], today), null);
  const old = getStreakNotice(run("2026-01-01", 50), "2026-01-01")!;
  assert.equal(getStreakNotice(entries, today, [old.id])?.days, 50);
  assert.equal(getStreakNotice(run(today, 125), today)?.days, 100, "show the latest earned milestone, not a backlog");
  assert.equal(getStreakNotice(run(addDays(today, -1), 50), today)?.days, 50, "an unacknowledged milestone survives until today's check-in");
});

test("encrypted receipt merging keeps recent notices bounded and deduplicated", () => {
  assert.deepEqual(mergeStreakReceipts(undefined, ["a", "b"], ["b", "c"]), ["a", "b", "c"]);
  const receipts = mergeStreakReceipts(Array.from({ length: 300 }, (_, index) => `event-${index}`));
  assert.equal(receipts.length, MAX_STREAK_RECEIPTS);
  assert.equal(receipts.at(-1), "event-299");
});
