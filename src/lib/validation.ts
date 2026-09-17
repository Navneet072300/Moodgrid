import { z } from "zod";
import { isDate, isTimezone, todayInTimezone } from "./dates";
import { isEmoji } from "./emojis";

export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,31}$/, "Use 3–32 lowercase letters, numbers, or underscores, starting with a letter.");

export const entrySchema = z.object({
  date: z.string().refine(isDate, "Choose a valid date."),
  emoji: z.string().refine(isEmoji, "Choose an emoji from the picker.").nullable(),
  sticker_id: z.string().uuid("Choose a sticker from your library.").nullable().optional(),
  mood_score: z.number().int().min(1).max(5).nullable().optional(),
  note: z.string().refine((value) => Array.from(value).length <= 280, "Notes can be up to 280 characters."),
  tags: z.array(z.string().trim().min(1).max(24).transform((value) => value.toLowerCase())).max(8)
    .transform((tags) => [...new Set(tags)]),
  timezone: z.string().max(100).refine(isTimezone, "Invalid timezone."),
}).refine((value) => Boolean(value.emoji) !== Boolean(value.sticker_id), { message: "Choose one emoji or sticker.", path: ["emoji"] })
  .refine((value) => !isTimezone(value.timezone) || value.date <= todayInTimezone(value.timezone), { message: "Choose today or an earlier date.", path: ["date"] });
