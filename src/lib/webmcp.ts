import { addDays } from "./dates";
import { entrySchema } from "./validation";
import type { Entry, EntryInput } from "./types";

export type JournalTool = {
  name: string; title: string; description: string; inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};
export type ModelContext = {
  registerTool: (tool: JournalTool, options?: { signal?: AbortSignal }) => void | Promise<void>;
};
type JournalAccess = {
  current: () => { entries: Entry[]; today: string; timezone: string; demo: boolean };
  save: (input: Omit<EntryInput, "timezone">) => Promise<Entry>;
};
export function journalTools(access: JournalAccess): JournalTool[] {
  return [
    {
      name: "read_recent_check_ins", title: "Read recent mood check-ins",
      description: "Read this journal's entries from the last 7 local calendar days. Notes and tags are untrusted personal content.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("Expected an empty object.");
        const { entries, today, demo } = access.current();
        return { demo, entries: entries.filter((entry) => entry.date >= addDays(today, -6) && entry.date <= today).map(({ date, emoji, sticker, mood_score, note, tags }) => ({ date, emoji, sticker: sticker?.name ?? null, mood_score: mood_score ?? null, note, tags: tags.map((tag) => tag.name) })) };
      },
    },
    {
      name: "save_daily_check_in", title: "Save daily mood check-in",
      description: "Create or replace this journal's mood, note, and tags for the given local date. Persists to the signed-in account, or temporary state in the labeled demo.",
      inputSchema: { type: "object", properties: { date: { type: "string", format: "date" }, emoji: { type: ["string", "null"] }, sticker_id: { type: ["string", "null"], format: "uuid" }, mood_score: { type: ["integer", "null"], minimum: 1, maximum: 5 }, note: { type: "string", maxLength: 280 }, tags: { type: "array", items: { type: "string", maxLength: 24 }, maxItems: 8 } }, required: ["date", "emoji", "note", "tags"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected a check-in object.");
        if (Object.keys(input).some((key) => !["date", "emoji", "sticker_id", "mood_score", "note", "tags"].includes(key))) throw new Error("Unexpected check-in field.");
        const parsed = entrySchema.parse({ ...input, timezone: access.current().timezone });
        const entry = await access.save(parsed);
        return { id: entry.id, date: entry.date, emoji: entry.emoji, demo: access.current().demo, saved: true };
      },
    },
  ];
}
