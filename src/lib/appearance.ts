import { z } from "zod";

export const appearanceSchema = z.object({
  palette: z.enum(["forest", "strawberry", "lavender", "matcha", "peach", "cloud", "midnight", "buttercup"]),
  background: z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
  wallpaper: z.enum(["none", "hearts", "flowers", "stars", "clouds", "bows", "fruit", "mushrooms", "sticker"]),
  stickerId: z.string().uuid().nullable(),
  opacity: z.number().min(0).max(0.4),
}).strict().refine((value) => value.wallpaper !== "sticker" || Boolean(value.stickerId), "Choose a sticker for your wallpaper.");
export type Appearance = z.infer<typeof appearanceSchema>;
export const DEFAULT_APPEARANCE: Appearance = { palette: "forest", background: null, wallpaper: "none", stickerId: null, opacity: 0.2 };
export const PALETTES: { id: Appearance["palette"]; name: string; emoji: string; background: string; accent: string; wallpaper: Appearance["wallpaper"] }[] = [
  { id: "forest", name: "Forest night", emoji: "🌿", background: "#101411", accent: "#bcf7a2", wallpaper: "none" },
  { id: "strawberry", name: "Strawberry milk", emoji: "🍓", background: "#ffe5ed", accent: "#a72f59", wallpaper: "hearts" },
  { id: "lavender", name: "Lavender dream", emoji: "🦋", background: "#eee4ff", accent: "#7540ad", wallpaper: "bows" },
  { id: "matcha", name: "Matcha break", emoji: "🍵", background: "#e4efd9", accent: "#476630", wallpaper: "flowers" },
  { id: "peach", name: "Peach picnic", emoji: "🍑", background: "#ffe7d5", accent: "#a74d28", wallpaper: "fruit" },
  { id: "cloud", name: "Cloud nine", emoji: "☁️", background: "#e0efff", accent: "#306699", wallpaper: "clouds" },
  { id: "midnight", name: "Midnight wishes", emoji: "🌙", background: "#1c1832", accent: "#d6bcff", wallpaper: "stars" },
  { id: "buttercup", name: "Buttercup", emoji: "🌼", background: "#fff3cc", accent: "#83601a", wallpaper: "flowers" },
];
export const WALLPAPERS: { id: Exclude<Appearance["wallpaper"], "sticker">; name: string; emojis: string[] }[] = [
  { id: "none", name: "Plain", emojis: [] },
  { id: "hearts", name: "Sweet hearts", emojis: ["💕", "♡", "🍓", "💌", "✧", "♡"] },
  { id: "flowers", name: "Little garden", emojis: ["🌼", "🌷", "🍃", "✿", "🌸", "🦋"] },
  { id: "stars", name: "Starry sky", emojis: ["✨", "🌙", "✦", "🪐", "⭐", "✧"] },
  { id: "clouds", name: "Daydream", emojis: ["☁️", "🫧", "🌈", "☁️", "✨", "🦋"] },
  { id: "bows", name: "Ribbon club", emojis: ["🎀", "♡", "🧸", "✧", "🎀", "🦋"] },
  { id: "fruit", name: "Fruit picnic", emojis: ["🍑", "🍒", "🍓", "✿", "🍋", "🍊"] },
  { id: "mushrooms", name: "Cozy woods", emojis: ["🍄", "🌿", "🐌", "☘️", "🍄", "🌼"] },
];
export function presetAppearance(id: Appearance["palette"]): Appearance {
  const palette = PALETTES.find((item) => item.id === id)!;
  return { ...DEFAULT_APPEARANCE, palette: id, wallpaper: palette.wallpaper };
}
function channels(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}
export function blend(color: string, target: string, amount: number): string {
  const second = channels(target);
  return `#${channels(color).map((value, index) => Math.round(value + (second[index] - value) * amount).toString(16).padStart(2, "0")).join("")}`;
}
function luminance(color: string): number {
  const values = channels(color).map((value) => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
export function contrast(first: string, second: string): number {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function readable(color: string, backgrounds: string[], target: string, minimum = 4.5): string {
  for (let step = 0; step <= 20; step++) {
    const candidate = blend(color, target, step / 20);
    if (backgrounds.every((background) => contrast(candidate, background) >= minimum)) return candidate;
  }
  return target;
}
export function appearanceTokens(appearance: Appearance) {
  const palette = PALETTES.find((item) => item.id === appearance.palette)!;
  const background = appearance.background ?? palette.background;
  const dark = contrast(background, "#ffffff") > contrast(background, "#000000");
  const ink = dark ? "#ffffff" : "#000000";
  let surface = blend(background, "#ffffff", dark ? 0.055 : 0.8);
  let raised = blend(background, "#ffffff", dark ? 0.09 : 0.94);
  if (dark && luminance(surface) > 0.14) surface = blend(background, "#000000", 0.25);
  if (dark && luminance(raised) > 0.16) raised = blend(background, "#000000", 0.18);
  const field = blend(background, dark ? "#000000" : "#ffffff", dark ? 0.15 : 0.45);
  let soft = blend(surface, palette.accent, 0.09);
  if (dark && luminance(soft) > 0.16) soft = blend(surface, "#000000", 0.06);
  const backgrounds = [background, surface, raised, field, soft];
  const text = readable(dark ? "#f3f2f6" : "#29222e", backgrounds, ink);
  const muted = readable(blend(surface, text, 0.65), backgrounds, ink);
  const accent = readable(palette.accent, backgrounds, ink);
  return {
    scheme: dark ? "dark" as const : "light" as const,
    colors: { background, surface, raised, field, soft, text, muted, accent,
      "on-accent": contrast(accent, "#ffffff") > contrast(accent, "#000000") ? "#ffffff" : "#000000",
      border: blend(surface, text, 0.22), "strong-border": readable(blend(surface, text, 0.4), [surface, field], ink, 3),
      danger: readable(dark ? "#f4b3a8" : "#a9263d", backgrounds, ink),
    },
  };
}
