"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, LoaderCircle, Palette, RotateCcw, Upload, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { DEFAULT_APPEARANCE, PALETTES, WALLPAPERS, presetAppearance, type Appearance } from "@/lib/appearance";
import { MAX_STICKER_BYTES, stickerFormat } from "@/lib/stickers";
import { useJournal } from "./journal-provider";
import { ThemeBackdrop, useThemePreview } from "./journal-theme";
import { StickerImage } from "./sticker-image";

function ThemeEditor({ onClose }: { onClose: () => void }) {
  const { appearance, saveAppearance, stickers, uploadSticker, demo } = useJournal();
  const setPreview = useThemePreview();
  const [draft, setDraft] = useState<Appearance>(appearance);
  const [pending, setPending] = useState<"save" | "upload" | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const id = useId();
  const reduceMotion = useReducedMotion();
  const selectedPalette = PALETTES.find((palette) => palette.id === draft.palette)!;
  const imageStickers = stickers.filter((sticker) => sticker.mime_type.startsWith("image/"));

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal(); closeButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { setPreview(null); element?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [setPreview]);

  function choose(value: Appearance) { setDraft(value); setPreview(value); setError(""); }
  function update(patch: Partial<Appearance>) { choose({ ...draft, ...patch }); }
  async function apply() {
    if (busy.current) return;
    busy.current = true; setPending("save"); setError("");
    try { await saveAppearance(draft); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "Couldn’t save your theme. Try again."); }
    finally { busy.current = false; setPending(null); }
  }
  async function upload(file: File) {
    if (busy.current) return;
    busy.current = true; setPending("upload"); setError("");
    try {
      if (file.size > MAX_STICKER_BYTES) throw new Error("Choose an image under 3 MB.");
      const format = stickerFormat(new Uint8Array(await file.slice(0, 4096).arrayBuffer()));
      if (!format?.mime.startsWith("image/")) throw new Error("Choose a PNG, JPG, WebP, or GIF image for your wallpaper.");
      const sticker = await uploadSticker(file);
      update({ wallpaper: "sticker", stickerId: sticker.id });
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn’t upload this sticker. Try again."); }
    finally { busy.current = false; setPending(null); if (fileInput.current) fileInput.current.value = ""; }
  }
  return <dialog ref={dialog} className="theme-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={(event) => { event.preventDefault(); if (!busy.current) onClose(); }}>
    <div className="theme-dialog-heading"><div><span className="eyebrow">MAKE YOURSELF AT HOME</span><h2 id={`${id}-title`}>Your space, your mood.</h2><p id={`${id}-description`}>A little color. A little you.</p></div><button type="button" ref={closeButton} className="theme-close" aria-label="Close theme settings" disabled={Boolean(pending)} onClick={onClose}><X size={21} /></button></div>
    <motion.div className="theme-layout" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <fieldset disabled={Boolean(pending)} className="theme-controls">
        <legend className="sr-only">Journal appearance</legend>
        <div><h3>Pick your palette</h3><div className="theme-palette-grid">{PALETTES.map((palette) => <button type="button" key={palette.id} aria-pressed={draft.palette === palette.id && !draft.background} onClick={() => choose(presetAppearance(palette.id))} className="theme-palette">
          <span className="theme-swatch" style={{ backgroundColor: palette.background }}><span>{palette.emoji}</span>{draft.palette === palette.id && !draft.background && <span className="theme-selected"><Check size={12} /></span>}</span><span>{palette.name}</span>
        </button>)}</div></div>
        <div className="theme-color-row"><label htmlFor={`${id}-color`}>Or make your own <span>{draft.background ?? selectedPalette.background}</span></label><input id={`${id}-color`} type="color" aria-label="Custom background color" value={draft.background ?? selectedPalette.background} onChange={(event) => update({ background: event.target.value })} /></div>
        <div><h3>Add a little something</h3><div className="theme-pattern-grid">{WALLPAPERS.map((pattern) => <button type="button" key={pattern.id} aria-pressed={draft.wallpaper === pattern.id} onClick={() => update({ wallpaper: pattern.id, stickerId: null })}><span aria-hidden="true">{pattern.emojis[0] ?? "○"}</span><span>{pattern.name}</span></button>)}</div></div>
        <div className="theme-personal-stickers"><h3>Your stickers</h3>{imageStickers.length > 0 && <div className="theme-sticker-grid">{imageStickers.map((sticker) => <button type="button" key={sticker.id} aria-label={`Use ${sticker.name} as wallpaper`} title={sticker.name} aria-pressed={draft.wallpaper === "sticker" && draft.stickerId === sticker.id} onClick={() => update({ wallpaper: "sticker", stickerId: sticker.id })}><StickerImage sticker={sticker} size={38} /></button>)}</div>}
          <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-label="Upload wallpaper sticker" accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
          <button type="button" className="theme-upload" onClick={() => fileInput.current?.click()}>{pending === "upload" ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />} {pending === "upload" ? "Uploading…" : "Upload a sticker"}<span>PNG, JPG, WebP, GIF · 3 MB</span></button>
        </div>
        <div className="theme-intensity"><label htmlFor={`${id}-opacity`}>Wallpaper visibility <output htmlFor={`${id}-opacity`}>{Math.round(draft.opacity * 100)}%</output></label><input id={`${id}-opacity`} type="range" min="0" max="40" step="1" value={Math.round(draft.opacity * 100)} disabled={draft.wallpaper === "none" || Boolean(pending)} onChange={(event) => update({ opacity: Number(event.target.value) / 100 })} /></div>
      </fieldset>
      <aside className="theme-preview-column"><div className="theme-mini-preview" aria-label="Live theme preview"><ThemeBackdrop appearance={draft} stickers={stickers} small /><div className="theme-preview-content"><span className="theme-preview-label">A PEEK AT YOUR JOURNAL</span><span className="theme-preview-emoji" aria-hidden="true">{selectedPalette.emoji}</span><h3>A space that feels<br />like you.</h3><div className="theme-mini-card"><span>Today’s little moment</span><strong>😊 &nbsp; Feeling good</strong><p>More of these days, please.</p><span className="theme-mini-tag">#littlejoys</span></div><div className="theme-preview-dots" aria-hidden="true">{["😌", "🌷", "😊", "✨", "💗"].map((emoji) => <span key={emoji}>{emoji}</span>)}</div></div></div><p>{demo ? "Demo changes last during this visit." : "Your theme is saved in your encrypted journal."}</p></aside>
    </motion.div>
    <div className="theme-dialog-footer">{error && <p className="error-message" role="alert">{error}</p>}<div className="theme-footer-actions"><button type="button" className="theme-reset" disabled={Boolean(pending)} onClick={() => choose(DEFAULT_APPEARANCE)}><RotateCcw size={14} />Reset</button><button type="button" className="button-secondary" disabled={Boolean(pending)} onClick={onClose}>Cancel</button><button type="button" className="button-primary" disabled={Boolean(pending)} onClick={() => void apply()}>{pending === "save" ? <><LoaderCircle size={16} className="animate-spin" />Saving…</> : <><Check size={16} />Apply theme</>}</button></div></div>
  </dialog>;
}

export function ThemeCustomizer() {
  const [open, setOpen] = useState(false);
  const setPreview = useThemePreview();
  return <><button type="button" className="theme-trigger" aria-label="Customize theme" title="Customize theme" onClick={() => setOpen(true)}><Palette size={20} /></button>{open && <ThemeEditor onClose={() => { setPreview(null); setOpen(false); }} />}</>;
}
