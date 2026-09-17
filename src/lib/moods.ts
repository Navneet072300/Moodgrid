import { emojiColor, emojiName } from "./emojis";
import type { Entry } from "./types";
export type Mood = { emoji: string; label: string; score: number | null; color: string; keywords: string };
const definitions: [string, string, number, string][] = [
  ["😊", "Happy", 5, "smile good joy"], ["😄", "Joyful", 5, "happy cheerful laugh"],
  ["🥰", "Loved", 5, "love grateful heart"], ["🤩", "Inspired", 5, "excited star amazed"],
  ["😎", "Confident", 5, "cool proud"], ["🥳", "Celebrating", 5, "party birthday"],
  ["😌", "Peaceful", 4, "calm relief relaxed"], ["🥹", "Grateful", 4, "touched thankful"],
  ["😁", "Delighted", 5, "grin smile"], ["🤗", "Connected", 4, "hug warm friends"],
  ["🙂", "Good", 4, "fine content smile"], ["😇", "Blessed", 4, "angel hopeful"],
  ["🤠", "Adventurous", 4, "cowboy fun"], ["🤓", "Focused", 4, "nerd productive learning"],
  ["🧘", "Grounded", 4, "meditate calm yoga"], ["😐", "Okay", 3, "neutral meh"],
  ["😶", "Quiet", 3, "silent blank"], ["🤔", "Thoughtful", 3, "thinking unsure"],
  ["😴", "Sleepy", 3, "tired sleep rest"], ["🥱", "Low energy", 3, "yawn bored tired"],
  ["🙃", "Mixed", 3, "upside down conflicted"], ["😅", "Relieved", 3, "sweat nervous"],
  ["😬", "Awkward", 2, "tense uncomfortable"], ["🫠", "Overwhelmed", 2, "melting stress"],
  ["😵‍💫", "Scattered", 2, "dizzy confused"], ["😔", "Low", 2, "sad down"],
  ["😢", "Sad", 2, "cry tear unhappy"], ["🥺", "Vulnerable", 2, "pleading sensitive"],
  ["😞", "Disappointed", 2, "let down"], ["😓", "Drained", 2, "sweat exhausted"],
  ["😟", "Worried", 2, "anxious concern"], ["😰", "Anxious", 2, "nervous panic"],
  ["😤", "Frustrated", 2, "annoyed work steam"], ["😠", "Angry", 1, "mad grumpy"],
  ["😩", "Exhausted", 1, "weary burnout"], ["😭", "Heartbroken", 1, "cry sob grief"],
  ["😡", "Furious", 1, "rage anger"], ["🤯", "Stressed", 1, "exploding mind"],
  ["😨", "Scared", 1, "fear afraid"], ["🤒", "Unwell", 2, "sick ill fever"],
];
// Individual colors identify emojis; scores are a separate, approximate scale.
export const MOODS: Mood[] = definitions.map(([emoji, label, score, keywords], i) => ({
  emoji, label, score, keywords,
  color: `hsl(${[103, 91, 327, 46, 168, 280, 154, 35, 74, 190, 121, 203, 27, 223, 177, 218, 236, 253, 244, 263, 300, 54, 22, 16, 285, 210, 201, 321, 258, 232, 40, 185, 31, 5, 18, 338, 354, 291, 270, 61][i]} ${55 + (i % 4) * 7}% ${60 + (i % 3) * 5}%)`,
}));
export function getMood(emoji: string | null): Mood {
  if (!emoji) return { emoji: "🏷️", label: "Sticker", score: null, color: "#b8a1e6", keywords: "sticker" };
  return MOODS.find((mood) => mood.emoji === emoji) ?? { emoji, label: emojiName(emoji), score: null, color: emojiColor(emoji), keywords: "" };
}
export function getEntryMood(entry: Entry): Mood {
  const mood = getMood(entry.emoji);
  return { ...mood, score: entry.mood_score ?? mood.score,
    label: entry.sticker?.name ?? mood.label,
    color: entry.sticker_id ? emojiColor(entry.sticker_id) : mood.color };
}
export function searchMoods(query: string): Mood[] {
  const search = query.trim().toLowerCase();
  return MOODS.filter((m) => `${m.emoji} ${m.label} ${m.keywords}`.toLowerCase().includes(search));
}
