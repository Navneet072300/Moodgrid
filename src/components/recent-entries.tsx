"use client";
import { EntryVisual } from "./sticker-image";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useJournal } from "./journal-provider";
import { EntryDialog } from "./entry-dialog";
import { getEntryMood } from "@/lib/moods";
import { formatDate } from "@/lib/dates";

export function RecentEntries({ limit = 3 }: { limit?: number }) {
  const { entries, today } = useJournal();
  const [selected, setSelected] = useState<string | null>(null);
  const recent = entries.filter((entry) => entry.date <= today).slice(0, limit);
  return <><section className="card recent-card"><div className="section-heading"><h2>Recent moments</h2><span className="text-xs text-muted">A little look back</span></div>{recent.length ? <div className="recent-list">{recent.map((entry) => <button type="button" key={entry.id} className="recent-entry" onClick={() => setSelected(entry.date)}><span className="recent-emoji" style={{ backgroundColor: `color-mix(in srgb, ${getEntryMood(entry).color} 10%, transparent)` }}><EntryVisual entry={entry} size={36} /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong>{getEntryMood(entry).label}</strong><span className="shrink-0 text-xs text-muted">{entry.date === today ? "Today" : formatDate(entry.date)}</span></span><span className="recent-note">{entry.note || "A feeling, captured."}</span>{entry.tags.length > 0 && <span className="recent-tags">{entry.tags.slice(0, 3).map((tag) => <span key={tag.id}>#{tag.name}</span>)}</span>}</span><ArrowUpRight size={14} className="shrink-0 text-muted" /></button>)}</div> : <div className="empty-state"><span>🌱</span><h3>Your story starts here</h3><p>Check in with one emoji. Your moments will appear here.</p></div>}</section><EntryDialog date={selected} onClose={() => setSelected(null)} /></>;
}
