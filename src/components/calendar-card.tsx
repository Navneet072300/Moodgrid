"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useJournal } from "./journal-provider";
import { MoodCalendar } from "./mood-calendar";
import { EntryDialog } from "./entry-dialog";
import { formatDate, yearStart } from "@/lib/dates";
import { entriesInYear } from "@/lib/insights";

export function CalendarCard({ full = false }: { full?: boolean }) {
  const { entries, today, demo } = useJournal();
  const [selected, setSelected] = useState<string | null>(null);
  const count = entriesInYear(entries, today).length;
  return <><section className="card calendar-card"><div className="section-heading"><div><div className="flex flex-wrap items-center gap-3"><h2>Your year in feelings</h2><span className="quiet-badge">{count} check-ins</span></div><p>Little moments add up to your story.</p></div>{full ? <span className="date-range">{formatDate(yearStart(today), { month: "short", year: "numeric" })} – {formatDate(today, { month: "short", year: "numeric" })}</span> : <Link className="subtle-link" href={demo ? "/demo/calendar" : "/calendar"}>Explore calendar <ArrowUpRight size={15} /></Link>}</div><MoodCalendar entries={entries} today={today} onSelect={setSelected} /></section><EntryDialog date={selected} onClose={() => setSelected(null)} /></>;
}
