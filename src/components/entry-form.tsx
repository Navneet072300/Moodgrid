"use client";
import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, LoaderCircle } from "lucide-react";
import { EmojiPicker } from "./emoji-picker";
import { StickerLibrary } from "./sticker-library";
import { EntryVisual } from "./sticker-image";
import { TagInput } from "./tag-input";
import { DeleteMomentButton } from "./delete-button";
import { useJournal } from "./journal-provider";
import { getMood } from "@/lib/moods";
import { formatDate } from "@/lib/dates";
import { canCheckIn } from "@/lib/check-in-policy";

export function EntryForm({ date, onSaved, onDeleted }: { date: string; onSaved?: () => void; onDeleted?: () => void }) {
  const { entries, tags: suggestions, save, demo, today, stickers } = useJournal();
  const entry = entries.find((item) => item.date === date);
  const [emoji, setEmoji] = useState(entry?.emoji ?? "");
  const [stickerId, setStickerId] = useState(entry?.sticker_id ?? null);
  const [mode, setMode] = useState<"emoji" | "sticker">(entry?.sticker_id ? "sticker" : "emoji");
  const [score, setScore] = useState<number | null>(entry?.mood_score ?? getMood(entry?.emoji ?? null).score);
  const sticker = stickers.find((item) => item.id === stickerId) ?? entry?.sticker ?? null;
  const [note, setNote] = useState(entry?.note ?? "");
  const [tags, setTags] = useState(entry?.tags.map((tag) => tag.name) ?? []);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const savedEmoji = entry?.emoji ?? "";
  const savedSticker = entry?.sticker_id ?? null;
  const savedScore = entry?.mood_score ?? getMood(entry?.emoji ?? null).score;
  const savedNote = entry?.note ?? "";
  const savedTags = JSON.stringify(entry?.tags.map((tag) => tag.name) ?? []);
  const savedId = entry?.id;
  useEffect(() => {
    setEmoji(savedEmoji); setStickerId(savedSticker); setMode(savedSticker ? "sticker" : "emoji"); setScore(savedScore); setNote(savedNote); setTags(JSON.parse(savedTags) as string[]);
  }, [date, savedEmoji, savedSticker, savedScore, savedNote, savedTags]);
  useEffect(() => { if (!savedId) { setStatus("idle"); setError(""); } }, [savedId]);
  const charCount = Array.from(note).length;
  const pending = status === "saving";
  function changed() { setStatus("idle"); setError(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if ((!emoji && !stickerId) || pending) return;
    setStatus("saving"); setError("");
    try { await save({ date, emoji: emoji || null, sticker_id: stickerId, mood_score: score, note, tags }); setStatus("saved"); onSaved?.(); }
    catch (error) { setStatus("idle"); setError(error instanceof Error ? error.message : "Couldn't save. Please try again."); }
  }
  if (!canCheckIn(date, today, Boolean(entry))) return <div className="missed-day-message"><span aria-hidden="true">🌙</span><h2>This day has passed</h2><p>New check-ins can only be added for today.</p></div>;
  return <form onSubmit={submit} className="entry-form">
    <div className="entry-heading"><div><span className="eyebrow">{date === today ? "CHECK-IN" : formatDate(date, { month: "long", day: "numeric", year: "numeric" })}</span><h2>{date === today ? "How are you feeling?" : "How did this day feel?"}</h2></div><AnimatePresence mode="wait"><motion.span key={stickerId || emoji || "default"} initial={{ scale: 0.4, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 350, damping: 13 }} className="mood-orb" aria-label={stickerId ? sticker?.name : emoji ? getMood(emoji).label : "Your mood"}>{emoji || stickerId ? <EntryVisual entry={{ emoji: emoji || null, sticker: stickerId ? sticker : null }} size={52} /> : "✺"}</motion.span></AnimatePresence></div>
    <div className="expression-tabs" role="group" aria-label="Choose expression type"><button type="button" aria-pressed={mode === "emoji"} onClick={() => setMode("emoji")}>😊 Emojis</button><button type="button" aria-pressed={mode === "sticker"} onClick={() => setMode("sticker")}>✦ Stickers {stickers.length > 0 && <span>{stickers.length}</span>}</button></div>
    {mode === "emoji" ? <EmojiPicker value={emoji} disabled={pending} onChange={(value) => { setEmoji(value); setStickerId(null); setScore(getMood(value).score); changed(); }} /> : <StickerLibrary value={stickerId} disabled={pending} onRemoved={(id) => { if (id === stickerId) { setStickerId(null); setScore(null); changed(); } }} onSelect={(value) => { setStickerId(value.id); setEmoji(""); setScore(null); changed(); }} />}
    {(emoji || stickerId) && <fieldset disabled={pending} className="score-field"><legend className="field-label">How did it feel? <span>optional</span></legend><div className="score-options">{["Very low", "Low", "Okay", "Good", "Great"].map((label, index) => <button type="button" key={label} aria-pressed={score === index + 1} onClick={() => { setScore(score === index + 1 && !getMood(emoji).score ? null : index + 1); changed(); }}><span>{["😞", "🙁", "😐", "🙂", "😊"][index]}</span>{label}</button>)}</div><p className="text-xs text-muted">{getMood(emoji).score ? "Adjust your score if needed." : "Add a score to include this in your mood trend."}</p></fieldset>}
    <div className="note-field"><div className="flex items-center justify-between"><label className="field-label" htmlFor={`note-${date}`}>Note <span>optional</span></label><span className="text-xs text-muted" aria-live={charCount > 260 ? "polite" : "off"}>{charCount}/280</span></div><textarea id={`note-${date}`} rows={3} disabled={pending} placeholder="Add a note…" value={note} onChange={(event) => { setNote(Array.from(event.target.value).slice(0, 280).join("")); changed(); }} /></div>
    <TagInput value={tags} disabled={pending} onChange={(value) => { setTags(value); changed(); }} suggestions={suggestions} />
    {error && <p role="alert" className="error-message">{error}</p>}
    <motion.button type="submit" className={`button-primary save-button ${status === "saved" ? "saved" : ""}`} disabled={(!emoji && !stickerId) || pending} whileTap={{ scale: 0.98 }}>
      {pending ? <><LoaderCircle size={17} className="animate-spin" />Saving…</> : status === "saved" ? <><motion.span key="saved-emoji" initial={{ scale: 0.3 }} animate={{ scale: [0.3, 1.5, 1] }} transition={{ duration: 0.45 }}><EntryVisual entry={{ emoji: emoji || null, sticker: stickerId ? sticker : null }} size={24} /></motion.span>{demo ? "Saved in demo" : "Saved"}<Check size={17} /></> : <>{entry ? "Update" : "Save"}<ArrowUpRight size={18} /></>}
    </motion.button><span role="status" className="sr-only">{status === "saved" ? "Your check-in has been saved." : ""}</span>
    {entry && <DeleteMomentButton entry={entry} disabled={pending} onDeleted={() => { changed(); onDeleted?.(); }} />}

  </form>;
}
