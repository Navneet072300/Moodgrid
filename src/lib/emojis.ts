import data from "@/data/emojis.json";
import variants from "@/data/emoji-variants.json";

export type Emoji = { emoji: string; label: string; category: string };
export const EMOJI_VERSION = data.version;
export const EMOJIS: Emoji[] = data.emojis.map(([emoji, label, category]) => ({ emoji, label, category }));
export const EMOJI_CATEGORIES = [...new Set(EMOJIS.map((emoji) => emoji.category))];
const names = new Map(variants.map(([emoji, label]) => [emoji, label]));
export function isEmoji(value: string): boolean { return names.has(value); }
export function emojiName(value: string): string { return names.get(value) ?? "Emoji"; }
export function emojiColor(value: string): string {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return `hsl(${hash % 360} ${55 + hash % 25}% ${56 + hash % 17}%)`;
}
export function filterEmojis(query: string, category: string): Emoji[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return EMOJIS.filter((item) => (category === "All" || item.category === category) && words.every((word) => `${item.emoji} ${item.label} ${item.category}`.toLowerCase().includes(word)));
}
