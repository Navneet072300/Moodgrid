import test from "node:test";
import assert from "node:assert/strict";
import { EMOJIS, EMOJI_CATEGORIES, filterEmojis, isEmoji } from "../src/lib/emojis";
import { averageMood, moodDistribution } from "../src/lib/insights";
import { summaryPayload } from "../src/lib/summary";
import { stickerFormat, stickerFileName } from "../src/lib/stickers";
import { entrySchema, usernameSchema } from "../src/lib/validation";
import type { Entry, Sticker } from "../src/lib/types";

const sticker: Sticker = { id: "44444444-4444-4444-8444-444444444444", user_id: "private-owner", name: "Happy cat", storage_path: "private/storage/cat.webp", mime_type: "image/webp", size_bytes: 100, created_at: "2026-01-01T12:00:00Z" };
const entry: Entry = { id: "private-entry", user_id: "private-owner", date: "2026-01-01", emoji: null, sticker_id: sticker.id, sticker, mood_score: null, note: "Cat day", tags: [], created_at: "2026-01-01T12:00:00Z" };

test("full Unicode catalog is searchable across categories and accepts composed variants", () => {
  assert.ok(EMOJIS.length > 3900);
  assert.equal(new Set(EMOJIS.map((item) => item.emoji)).size, EMOJIS.length);
  assert.equal(EMOJI_CATEGORIES.length, 9);
  for (const emoji of ["🍕", "🇮🇳", "🧑🏽‍💻", "👨‍👩‍👧‍👦", "❤", "❤️"]) assert.ok(isEmoji(emoji));
  assert.ok(filterEmojis("india", "Flags").some((item) => item.emoji === "🇮🇳"));
  assert.ok(filterEmojis("medium skin tone", "All").some((item) => item.emoji === "🧑🏽‍💻"));
  assert.equal(filterEmojis("pizza", "Flags").length, 0);
  for (const value of ["hello", "😊😢", "", "<svg>"]) assert.equal(isEmoji(value), false);
});
test("entry accepts one emoji or owned sticker reference and optional bounded scores", () => {
  const input = { date: "2024-01-01", emoji: null, sticker_id: sticker.id, mood_score: 4, note: "", tags: [], timezone: "UTC" };
  assert.ok(entrySchema.safeParse(input).success);
  assert.ok(entrySchema.safeParse({ ...input, emoji: "🍕", sticker_id: null, mood_score: null }).success);
  assert.equal(entrySchema.safeParse({ ...input, emoji: "😊" }).success, false);
  assert.equal(entrySchema.safeParse({ ...input, sticker_id: null }).success, false);
  for (const score of [0, 6, 2.5]) assert.equal(entrySchema.safeParse({ ...input, mood_score: score }).success, false);
});
test("usernames normalize case and prevent unsupported or oversized names", () => {
  assert.equal(usernameSchema.parse(" Cosmic_Otter "), "cosmic_otter");
  for (const value of ["ab", "a".repeat(33), "123cat", "two words", "@cat", "<script>"]) assert.equal(usernameSchema.safeParse(value).success, false);
});
test("file signatures accept sticker image formats and reject renamed active content", () => {
  const samples = [
    { bytes: [137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82], mime: "image/png" },
    { bytes: [255,216,255,224,0,0,0,0,0,0,0,0,0,0,0,0], mime: "image/jpeg" },
    { bytes: [...Buffer.from("RIFF0000WEBPVP8X")], mime: "image/webp" },
    { bytes: [...Buffer.from("GIF89a0000000000")], mime: "image/gif" },
    { bytes: [26,69,223,163,...Buffer.from("000webm000000")], mime: "video/webm" },
  ];
  for (const sample of samples) assert.equal(stickerFormat(new Uint8Array(sample.bytes))?.mime, sample.mime);
  for (const value of ["<svg onload='alert(1)'></svg>", "<html>not a sticker</html>", "{\"tgs\":1}"]) assert.equal(stickerFormat(new TextEncoder().encode(value)), null);
  assert.equal(stickerFormat(new Uint8Array([137,80,78,71])), null);
  assert.equal(stickerFileName("happy_cat-wave.webp"), "happy cat wave");
  assert.equal(stickerFileName("a".repeat(100) + ".png").length, 60);
});
test("unscored expressions never distort averages and stickers have distinct distributions", () => {
  assert.equal(averageMood([entry, { ...entry, emoji: "🍕", sticker: null, sticker_id: null }]), null);
  assert.equal(averageMood([entry, { ...entry, mood_score: 5 }, { ...entry, mood_score: 1 }]), 3);
  assert.equal(averageMood([{ ...entry, emoji: "😊", sticker_id: null, sticker: null, mood_score: 2 }]), 2);
  const other = { ...entry, sticker_id: "another", sticker: { ...sticker, id: "another", name: "Sleepy cat" } };
  const distribution = moodDistribution([entry, entry, other]);
  assert.deepEqual(distribution.map(({ label, count }) => ({ label, count })), [{ label: "Happy cat", count: 2 }, { label: "Sleepy cat", count: 1 }]);
});
test("weekly reflections include sticker names and scores without image paths or account identifiers", () => {
  const payload = summaryPayload([{ ...entry, mood_score: 4 }], "2026-01-01", "2026-01-07");
  assert.equal(payload.entries[0].sticker, "Happy cat");
  assert.equal(payload.entries[0].mood_score, 4);
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(sticker.storage_path), false);
  assert.equal(serialized.includes(sticker.user_id), false);
  assert.equal(serialized.includes(sticker.id), false);
});
