"use client";
import { EntryVisual } from "./sticker-image";
import { useMemo, useRef, useState, type KeyboardEvent, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { calendarDays, formatDate, yearStart } from "@/lib/dates";
import { getEntryMood, MOODS } from "@/lib/moods";
import { canCheckIn } from "@/lib/check-in-policy";
import type { Entry } from "@/lib/types";

export type MoodCalendarProps = { entries: Entry[]; today: string; onSelect?: (date: string) => void; className?: string };
type Tooltip = { date: string; entry?: Entry; x: number; y: number; below: boolean };
export function MoodCalendar({ entries, today, onSelect, className = "" }: MoodCalendarProps) {
  const days = useMemo(() => calendarDays(today), [today]);
  const byDate = useMemo(() => new Map(entries.map((entry) => [entry.date, entry])), [entries]);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [active, setActive] = useState(today);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const columns = days.length / 7;
  function show(date: string, target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    setTooltip({ date, entry: byDate.get(date), x: Math.max(135, Math.min(window.innerWidth - 135, rect.left + rect.width / 2)), y: rect.top < 130 ? rect.bottom + 10 : rect.top - 10, below: rect.top < 130 });
  }
  function keydown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const movements: Record<string, number> = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
    let next = index;
    if (event.key in movements) next += movements[event.key];
    else if (event.key === "Home") next = days.indexOf(yearStart(today));
    else if (event.key === "End") next = days.indexOf(today);
    else if (event.key === "Escape") { setTooltip(null); return; }
    else return;
    event.preventDefault();
    const date = days[Math.max(days.indexOf(yearStart(today)), Math.min(days.indexOf(today), next))];
    setActive(date); refs.current.get(date)?.focus();
  }
  return <div className={`mood-calendar ${className}`}>
    <div className="calendar-scroll" onScroll={() => setTooltip(null)}>
      <div className="calendar-matrix" style={{ "--columns": columns } as CSSProperties}>
        <div className="calendar-months" aria-hidden="true">{days.map((date, index) => date.endsWith("-01") ? <span key={date} style={{ gridColumn: Math.floor(index / 7) + 1 }}>{formatDate(date, { month: "short" })}</span> : null)}</div>
        <div className="calendar-weekdays" aria-hidden="true"><span>Mon</span><span>Wed</span><span>Fri</span></div>
        <div className="calendar-cells" role="group" aria-label="Mood calendar for the last twelve months">
          {days.map((date, index) => {
            const entry = byDate.get(date);
            const outside = date < yearStart(today) || date > today;
            const writable = canCheckIn(date, today, Boolean(entry));
            const style = { backgroundColor: entry ? getEntryMood(entry).color : undefined, opacity: outside ? 0 : undefined };
            const description = `${formatDate(date, { month: "long", day: "numeric", year: "numeric" })}: ${entry ? `${getEntryMood(entry).label}. ${entry.note ?? ""}` : date < today ? "Missed day, closed" : "No check-in"}${date === today ? ", today" : ""}`;
            if (!onSelect) return <span key={date} className={`calendar-cell ${date === today ? "is-today" : ""}`} style={style} title={outside ? undefined : description} />;
            return <motion.button key={date} ref={(node) => { if (node) refs.current.set(date, node); else refs.current.delete(date); }}
              type="button" className={`calendar-cell ${date === today ? "is-today" : ""} ${!writable ? "is-closed" : ""}`} style={style} disabled={outside} aria-disabled={!writable || outside}
              tabIndex={date === active ? 0 : -1} aria-label={description} aria-describedby={tooltip?.date === date ? "calendar-tooltip" : undefined}
              onMouseEnter={(event) => show(date, event.currentTarget)} onMouseLeave={() => setTooltip(null)}
              onFocus={(event) => { setActive(date); show(date, event.currentTarget); }} onBlur={() => setTooltip(null)}
              onKeyDown={(event) => keydown(event, index)} onClick={() => { if (writable) { setTooltip(null); onSelect(date); } }}
              whileHover={writable ? { scale: 1.35, zIndex: 2 } : undefined} whileTap={writable ? { scale: 0.9 } : undefined} transition={{ type: "spring", stiffness: 500, damping: 20 }} />;
          })}
        </div>
      </div>
    </div>
    <div className="calendar-legend"><span>Every color, a feeling.</span><div><span>No entry <i className="legend-square" /></span><span className="legend-divider" />{[MOODS[0], MOODS[6], MOODS[15], MOODS[25], MOODS[32]].map((mood) => <span key={mood.emoji} title={mood.label}><i className="legend-square" style={{ backgroundColor: mood.color }} />{mood.emoji}</span>)}<span className="text-muted">+ more</span></div></div>
    {tooltip && <div id="calendar-tooltip" role="tooltip" className="calendar-tooltip" style={{ left: tooltip.x, top: tooltip.y, transform: `translate(-50%, ${tooltip.below ? "0" : "-100%"})` }}>
      <div className="flex items-center gap-3"><span className="text-3xl">{tooltip.entry ? <EntryVisual entry={tooltip.entry} size={40} /> : "○"}</span><div><strong>{tooltip.entry ? getEntryMood(tooltip.entry).label : tooltip.date < today ? "Missed day" : "Today is yours"}</strong><p className="mt-1 text-xs text-muted">{formatDate(tooltip.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p></div></div>
      {tooltip.entry?.note && <p className="mt-3 line-clamp-3 text-sm text-muted">{tooltip.entry.note}</p>}<p className="mt-3 text-xs text-mint">{tooltip.entry ? "Click to view or edit" : tooltip.date < today ? "Past days cannot be filled in." : "Click to check in"}</p>
    </div>}
  </div>;
}
