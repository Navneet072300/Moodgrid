import test from "node:test";
import assert from "node:assert/strict";
import { journalTools } from "../src/lib/webmcp";
import type { Entry } from "../src/lib/types";

test("optional agent actions share journal state and validate before mutating", async () => {
  let entries: Entry[] = [];
  const tools = journalTools({
    current: () => ({ entries, today: "2026-09-16", timezone: "UTC", demo: true }),
    async save(input) {
      const entry: Entry = { id: input.date, user_id: "demo", created_at: `${input.date}T12:00:00Z`, date: input.date, emoji: input.emoji, note: input.note, tags: input.tags.map((name) => ({ id: name, name })) };
      entries = [entry]; return entry;
    },
  });
  assert.deepEqual(tools.map((tool) => tool.name), ["read_recent_check_ins", "save_daily_check_in"]);
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[1].annotations.readOnlyHint, false);
  const result = await tools[1].execute({ date: "2026-09-16", emoji: "😊", note: "A good walk", tags: ["Outside"] });
  assert.deepEqual(result, { id: "2026-09-16", date: "2026-09-16", emoji: "😊", demo: true, saved: true });
  assert.equal(entries[0].tags[0].name, "outside");
  assert.deepEqual(await tools[0].execute({}), { demo: true, entries: [{ date: "2026-09-16", emoji: "😊", sticker: null, mood_score: null, note: "A good walk", tags: ["outside"] }] });
  await assert.rejects(async () => tools[1].execute({ date: "2026-09-16", emoji: "not-emoji", note: "", tags: [] }));
  assert.equal(entries[0].emoji, "😊");
  await assert.rejects(async () => tools[1].execute({ date: "2026-09-16", emoji: "😢", note: "", tags: [], user_id: "someone-else" }));
  assert.equal(entries[0].emoji, "😊");
});
