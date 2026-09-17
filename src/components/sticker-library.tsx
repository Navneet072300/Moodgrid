"use client";
import { useRef, useState } from "react";
import { LoaderCircle, Search, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { useJournal } from "./journal-provider";
import { StickerImage } from "./sticker-image";
import { STICKER_ACCEPT } from "@/lib/stickers";
import type { Sticker } from "@/lib/types";

export function StickerLibrary({ value, onSelect, disabled = false }: { value?: string | null; onSelect?: (sticker: Sticker) => void; disabled?: boolean }) {
  const { stickers, uploadSticker, demo } = useJournal();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const choices = stickers.filter((sticker) => sticker.name.toLowerCase().includes(query.toLowerCase().trim()));
  async function upload(files: File[]) {
    if (busy || disabled || !files.length) return;
    setBusy(true); setErrors([]); let count = 0; const failures: string[] = [];
    for (const file of files.slice(0, 20)) {
      setMessage(`Uploading ${file.name}…`);
      try { const sticker = await uploadSticker(file); count++; if (files.length === 1) onSelect?.(sticker); }
      catch (error) { failures.push(`${file.name}: ${error instanceof Error ? error.message : "Upload failed."}`); }
    }
    if (files.length > 20) failures.push("Upload up to 20 stickers at a time. Add the remaining files in another batch.");
    setErrors(failures); setMessage(count ? `${count} sticker${count === 1 ? "" : "s"} added to your library.` : ""); setBusy(false);
    if (input.current) input.current.value = "";
  }
  return <div className="sticker-library" aria-busy={busy}>
    <input ref={input} className="sr-only" type="file" accept={STICKER_ACCEPT} multiple disabled={busy || disabled} onChange={(event) => void upload(Array.from(event.target.files ?? []))} aria-label="Upload sticker files" />
    <button type="button" className="sticker-upload" disabled={busy || disabled} onClick={() => input.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); }}>
      {busy ? <LoaderCircle size={24} className="animate-spin" /> : <Upload size={24} />}<strong>{busy ? "Adding your stickers…" : "Upload stickers"}</strong><span>Choose files or drop them here</span><small>PNG, JPG, WebP, GIF or WebM · up to 3 MB each</small>
    </button>
    <p className="sticker-hint">Export .tgs files and sticker packs to supported files first.{demo ? " Demo uploads last only during this visit." : " Files are encrypted on your device before upload."}</p>
    {message && <p role="status" className="text-sm text-mint">{message}</p>}{errors.length > 0 && <div role="alert" className="error-message">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
    {stickers.length > 0 && <div className="input-icon emoji-search"><Search size={16} /><input aria-label="Search your stickers" placeholder="Find a sticker…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>}
    <div className="sticker-grid">{choices.map((sticker) => onSelect ? <motion.button type="button" key={sticker.id} disabled={disabled || busy} aria-pressed={value === sticker.id} onClick={() => onSelect(sticker)} className={`sticker-tile ${value === sticker.id ? "selected" : ""}`} title={sticker.name} whileHover={{ y: -3 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}><StickerImage sticker={sticker} size={80} /><span>{sticker.name}</span></motion.button> : <div key={sticker.id} className="sticker-tile"><StickerImage sticker={sticker} size={80} /><span>{sticker.name}</span></div>)}</div>
    {stickers.length > 0 && !choices.length && <p className="text-sm text-muted">No stickers match this search.</p>}
  </div>;
}
export function StickersView() {
  return <main className="page-shell"><div className="page-heading"><div><h1>Stickers</h1></div></div><section className="card library-card"><StickerLibrary /></section></main>;
}
