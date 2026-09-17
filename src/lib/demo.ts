import { addDays, yearStart } from "./dates";
import type { Entry, Tag } from "./types";

export const DEMO_TAGS: Tag[] = ["work", "friends", "family", "self-care", "outside", "exercise", "creative", "rest"].map((name) => ({ id: `demo-tag-${name}`, name }));
const moments = [
  { emoji: "😌", note: "A slow morning, good coffee, and nowhere to rush.", tags: ["self-care", "rest"] },
  { emoji: "😊", note: "A walk after work made all the difference.", tags: ["outside", "exercise"] },
  { emoji: "🥰", note: "Dinner with my favorite people. Needed this.", tags: ["friends"] },
  { emoji: "🤓", note: "Finally made progress on that project.", tags: ["work", "creative"] },
  { emoji: "😴", note: "An early night sounds pretty perfect.", tags: ["rest"] },
  { emoji: "😤", note: "Back-to-back meetings. Taking a breath and letting today go.", tags: ["work"] },
  { emoji: "🤩", note: "Tried something new and surprised myself.", tags: ["creative"] },
  { emoji: "😐", note: "An ordinary day. That's okay too.", tags: [] },
  { emoji: "🥹", note: "A little check-in from family went a long way.", tags: ["family"] },
  { emoji: "😔", note: "A quieter day. Made some space for myself.", tags: ["self-care"] },
];
export function demoEntries(today: string): Entry[] {
  const entries: Entry[] = [];
  let index = 0;
  for (let date = yearStart(today); date < today; date = addDays(date, 1), index++) {
    const seed = (index * 73 + 29) % 101;
    if (seed > 78 && date < addDays(today, -7)) continue;
    const moment = moments[(index * 7 + Math.floor(index / 9)) % moments.length];
    entries.push({
      id: `demo-${date}`, user_id: "demo", date, emoji: moment.emoji, note: moment.note,
      created_at: `${date}T18:00:00Z`, tags: DEMO_TAGS.filter((tag) => moment.tags.includes(tag.name)),
    });
  }
  return entries.reverse();
}
