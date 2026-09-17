"use client";
import { EntryVisual } from "./sticker-image";
import { CalendarDays, Flame, Smile } from "lucide-react";
import { useJournal } from "./journal-provider";
import { CalendarCard } from "./calendar-card";
import { RecentEntries } from "./recent-entries";
import { currentStreak, entriesInYear, moodDistribution } from "@/lib/insights";
export function CalendarView() {
  const { entries, today } = useJournal();
  const year = entriesInYear(entries, today); const top = moodDistribution(year)[0];
  return <main className="page-shell"><div className="page-heading"><div><h1>Calendar</h1><p>Select a day to view or edit.</p></div></div>
    <div className="stats-grid"><div className="card stat-card"><CalendarDays size={19} /><span>Days captured</span><strong>{year.length}<small>in the last 12 months</small></strong></div><div className="card stat-card"><Flame size={19} /><span>Current streak</span><strong>{currentStreak(entries, today)}<small>consecutive days</small></strong></div><div className="card stat-card"><Smile size={19} /><span>Most familiar feeling</span><strong>{top ? <EntryVisual entry={top} size={40} /> : "○"}<small>{top?.label ?? "Waiting for your first check-in"}</small></strong></div></div><CalendarCard full /><div className="mt-6"><RecentEntries limit={10} /></div></main>;
}
