import test from "node:test";
import assert from "node:assert/strict";
import { appearanceSchema, appearanceTokens, contrast, DEFAULT_APPEARANCE, PALETTES, presetAppearance } from "../src/lib/appearance";
import { parseDocument } from "../src/lib/vault/types";

test("theme preferences accept curated palettes and bounded custom colors without arbitrary CSS or URLs", () => {
  for (const palette of PALETTES) assert.equal(appearanceSchema.safeParse(presetAppearance(palette.id)).success, true);
  assert.equal(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, background: "#AbC123" }).success, true);
  assert.equal(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, wallpaper: "sticker", stickerId: "44444444-4444-4444-8444-444444444444" }).success, true);
  for (const patch of [
    { background: "url(https://example.com/tracker)" }, { background: "red; display:none" }, { background: "#fff" },
    { wallpaper: "external" }, { wallpaper: "sticker", stickerId: null }, { stickerId: "blob:private-file" },
    { palette: "unknown" }, { opacity: -0.1 }, { opacity: 0.41 }, { opacity: Number.NaN }, { externalUrl: "https://example.com" },
  ]) assert.equal(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, ...patch }).success, false, JSON.stringify(patch));
});

test("theme text, secondary text and accent stay readable on every surface for presets and custom colors", () => {
  const backgrounds: (string | null)[] = [null];
  // Includes extreme, saturated and midtone backgrounds on both sides of the light/dark threshold.
  for (const r of [0, 64, 118, 128, 192, 255]) for (const g of [0, 64, 118, 128, 192, 255]) for (const b of [0, 64, 118, 128, 192, 255]) backgrounds.push(`#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`);
  for (const palette of PALETTES) for (const background of backgrounds) {
    const { colors } = appearanceTokens({ ...presetAppearance(palette.id), background });
    for (const foreground of ["text", "muted", "accent", "danger"] as const) for (const surface of ["background", "surface", "raised", "field", "soft"] as const) {
      assert.ok(contrast(colors[foreground], colors[surface]) >= 4.5, `${palette.id}/${background}: ${foreground} on ${surface}`);
    }
    assert.ok(contrast(colors["on-accent"], colors.accent) >= 4.5);
    assert.ok(contrast(colors["strong-border"], colors.field) >= 3);
  }
});

test("old encrypted documents load without a theme and new preferences pass the storage whitelist", () => {
  const original = { version: 1, entries: [], tags: [], stickers: [], migration: { fingerprint: "test", legacyPaths: [] } };
  assert.equal(parseDocument(original).appearance, undefined);
  const appearance = { ...presetAppearance("lavender"), background: "#f0e3fa" };
  assert.deepEqual(parseDocument({ ...original, appearance }).appearance, appearance);
});
