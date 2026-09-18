"use client";
import { createContext, useContext, useMemo, useState, type CSSProperties } from "react";
import { appearanceTokens, WALLPAPERS, type Appearance } from "@/lib/appearance";
import type { Sticker } from "@/lib/types";
import { useJournal } from "./journal-provider";
import { StickerImage } from "./sticker-image";

const PreviewContext = createContext<((appearance: Appearance | null) => void) | null>(null);
export function useThemePreview() {
  const value = useContext(PreviewContext);
  if (!value) throw new Error("Theme preview must be inside JournalTheme.");
  return value;
}

export function ThemeBackdrop({ appearance, stickers, small = false }: { appearance: Appearance; stickers: Sticker[]; small?: boolean }) {
  const emojis = WALLPAPERS.find((pattern) => pattern.id === appearance.wallpaper)?.emojis ?? [];
  const sticker = appearance.wallpaper === "sticker" ? stickers.find((item) => item.id === appearance.stickerId && item.mime_type.startsWith("image/")) : undefined;
  if ((!emojis.length && !sticker) || appearance.opacity === 0) return null;
  return <div className={`theme-backdrop${small ? " theme-backdrop-small" : ""}`} style={{ opacity: appearance.opacity }} aria-hidden="true">
    {Array.from({ length: small ? 24 : 120 }, (_, index) => <span key={index} style={{ transform: `translate(${index % 2 ? 14 : -10}px, ${index % 3 * 7}px) rotate(${index % 2 ? 15 : -15}deg)` }}>
      {sticker ? <StickerImage key={sticker.id} sticker={sticker} size={small ? 29 : 43} /> : emojis[(index * 5 + Math.floor(index / 7)) % emojis.length]}
    </span>)}
  </div>;
}

export function JournalTheme({ children }: { children: React.ReactNode }) {
  const { appearance, stickers } = useJournal();
  const [preview, setPreview] = useState<Appearance | null>(null);
  const active = preview ?? appearance;
  const tokens = useMemo(() => appearanceTokens(active), [active]);
  const style = { ...Object.fromEntries(Object.entries(tokens.colors).map(([key, value]) => [`--${key}`, value])), colorScheme: tokens.scheme } as CSSProperties;
  return <PreviewContext.Provider value={setPreview}><div className="journal-theme" style={style} data-palette={active.palette} data-color-scheme={tokens.scheme} data-wallpaper={active.wallpaper}>
    <ThemeBackdrop appearance={active} stickers={stickers} />{children}
  </div></PreviewContext.Provider>;
}
