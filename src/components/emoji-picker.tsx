"use client";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { getMood, MOODS, searchMoods } from "@/lib/moods";
import { EMOJIS, EMOJI_CATEGORIES, filterEmojis } from "@/lib/emojis";

export type EmojiPickerProps = { value: string | null; onChange: (emoji: string) => void; disabled?: boolean };
export function EmojiPicker({ value, onChange, disabled = false }: EmojiPickerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Quick moods");
  const [limit, setLimit] = useState(96);
  const [focused, setFocused] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const results = useMemo(() => {
    if (!query.trim() && category === "Quick moods") return MOODS;
    const catalog = filterEmojis(query, category === "Quick moods" ? "All" : category);
    return category === "Quick moods" || category === "All" ? [...new Map([...searchMoods(query), ...catalog].map((item) => [item.emoji, item])).values()] : catalog;
  }, [query, category]);
  const moods = results.slice(0, limit);
  function reset() { setFocused(0); setLimit(96); }
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const top = refs.current[0]?.offsetTop;
    const columns = refs.current.slice(0, moods.length).findIndex((button) => button && button.offsetTop !== top);
    const cols = columns > 0 ? columns : moods.length;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % moods.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + moods.length) % moods.length;
    else if (event.key === "ArrowDown") next = Math.min(index + cols, moods.length - 1);
    else if (event.key === "ArrowUp") next = Math.max(index - cols, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = moods.length - 1;
    else return;
    event.preventDefault(); setFocused(next); refs.current[next]?.focus();
  }
  return <fieldset disabled={disabled} className="min-w-0">
    <legend className="sr-only">Choose an emoji</legend>
    <div className="input-icon emoji-search"><Search size={16} /><input aria-label="Search all emojis" placeholder="Search emojis, feelings, flags…" value={query} onChange={(event) => { setQuery(event.target.value); reset(); }} onKeyDown={(event) => { if (event.key === "ArrowDown" && moods.length) { event.preventDefault(); refs.current[0]?.focus(); } }} />{query && <button type="button" onClick={() => { setQuery(""); reset(); }} aria-label="Clear emoji search"><X size={15} /></button>}</div>
    <div className="picker-toolbar"><select aria-label="Emoji category" value={category} onChange={(event) => { setCategory(event.target.value); reset(); }}><option>Quick moods</option><option value="All">All {EMOJIS.length.toLocaleString("en-US")} emojis</option>{EMOJI_CATEGORIES.map((name) => <option key={name}>{name}</option>)}</select><span>{results.length.toLocaleString("en-US")} {query ? "matches" : "emojis"}</span></div>
    <div className="emoji-scroll"><div className="emoji-grid" role="group" aria-label="Emoji choices" aria-describedby={`${id}-help`}>
      {moods.map((mood, index) => <motion.button key={mood.emoji} ref={(element) => { refs.current[index] = element; }} type="button" tabIndex={index === focused ? 0 : -1} aria-label={mood.label} aria-pressed={value === mood.emoji} title={mood.label} onFocus={() => setFocused(index)} onKeyDown={(event) => move(event, index)} onClick={() => onChange(mood.emoji)} className={`emoji-option ${value === mood.emoji ? "selected" : ""}`} whileHover={{ scale: 1.16, y: -3 }} whileTap={{ scale: 0.85 }} transition={{ type: "spring", stiffness: 420, damping: 17 }}><span aria-hidden="true">{mood.emoji}</span></motion.button>)}
    </div>{limit < results.length && <button className="load-emojis" type="button" onClick={() => setLimit((current) => current + 96)}>Show more · {results.length - limit} remaining</button>}</div>
    {moods.length === 0 && <p className="py-6 text-center text-sm text-muted">No matches. Try “happy”, “cat”, or “India”.</p>}
    <div className="picker-help" id={`${id}-help`}><span>{value ? <><span className="text-mint">●</span> {getMood(value).label}</> : "Every feeling belongs here."}</span><span className="hidden shrink-0 sm:block">↑ ↓ ← → to explore</span></div>
  </fieldset>;
}
