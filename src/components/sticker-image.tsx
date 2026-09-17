"use client";
import Image from "next/image";
import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { Entry, Sticker } from "@/lib/types";

export function StickerImage({ sticker, size = 64 }: { sticker: Sticker; size?: number }) {
  const reduceMotion = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const src = sticker.preview_url;
  if (failed || !src) return <span role="img" aria-label={`${sticker.name} (preview unavailable)`} className="sticker-fallback">🏷️</span>;
  return sticker.mime_type === "video/webm"
    ? <video src={src} width={size} height={size} aria-label={sticker.name} autoPlay={!reduceMotion} loop={!reduceMotion} muted playsInline preload="metadata" className="sticker-image" onError={() => setFailed(true)} />
    : <Image src={src} alt={sticker.name} width={size} height={size} unoptimized className="sticker-image" onError={() => setFailed(true)} />;
}
export function EntryVisual({ entry, size = 40 }: { entry: Pick<Entry, "emoji" | "sticker">; size?: number }) {
  return entry.sticker ? <StickerImage sticker={entry.sticker} size={size} /> : <span>{entry.emoji || "🏷️"}</span>;
}
