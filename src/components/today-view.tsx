"use client";
import { EntryVisual } from "./sticker-image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Flame, TrendingUp } from "lucide-react";
import { useJournal } from "./journal-provider";
import { EntryForm } from "./entry-form";
import { CalendarCard } from "./calendar-card";
import { RecentEntries } from "./recent-entries";
import { WeeklySummary } from "./weekly-summary";
import { addDays, formatDate } from "@/lib/dates";
import { currentStreak, averageMood } from "@/lib/insights";
import { getEntryMood } from "@/lib/moods";

export function TodayView() {
  const { today, entries, demo } = useJournal();
  const streak = currentStreak(entries, today);
  const week = entries.filter((entry) => entry.date >= addDays(today, -6) && entry.date <= today);
  const average = averageMood(week);
  return <main className="page-shell"><div className="page-heading"><div><h1>Today</h1></div><span className="today-date"><CalendarDays size={16} />{formatDate(today, { weekday: "short", month: "short", day: "numeric" })}</span></div>
    <div className="today-layout"><section className="card checkin-card"><EntryForm key={today} date={today} /></section><aside className="today-sidebar"><section className="card week-card"><div className="section-heading"><h2>Your streak</h2><Flame size={20} className="text-orange-300" /></div><div className="streak-number">{streak}<span>day{streak === 1 ? "" : "s"}</span><span className="streak-emoji" aria-hidden="true">🔥</span></div><div className="week-strip">{Array.from({ length: 7 }, (_, index) => { const date = addDays(today, index - 6); const entry = entries.find((item) => item.date === date); return <div key={date}><span>{formatDate(date, { weekday: "narrow" })}</span><span className={`${entry ? "logged" : ""} ${date === today ? "today" : ""}`} title={entry ? getEntryMood(entry).label : "Not logged"}>{entry ? <EntryVisual entry={entry} size={28} /> : (date === today ? "+" : "·")}</span></div>; })}</div><div className="week-bottom"><span><TrendingUp size={15} />This week</span><strong>{average === null ? "Your story awaits" : `${average.toFixed(1)} / 5 average`}</strong></div></section><WeeklySummary /></aside></div>
    <CalendarCard /><div className="bottom-layout"><RecentEntries /><section className="small-insight"><h2>Your patterns</h2><Link href={demo ? "/demo/insights" : "/insights"} className="text-link">Explore your insights <ArrowUpRight size={16} /></Link></section></div>
  </main>;
}
