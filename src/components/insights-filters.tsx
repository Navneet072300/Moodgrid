"use client";
import { useState, type FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { dateRangeError, INSIGHT_PRESETS, type DateRange, type InsightSelection } from "@/lib/insight-ranges";
import { formatDate } from "@/lib/dates";

export function InsightsFilters({ selection, range, today, onChange }: {
  selection: InsightSelection;
  range: DateRange;
  today: string;
  onChange: (selection: InsightSelection) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DateRange>(range);
  const [error, setError] = useState<string | null>(null);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = dateRangeError(draft, today);
    setError(message);
    if (!message) { onChange(draft); setEditing(false); }
  }
  const dateFormat = { month: "short", day: "numeric", year: "numeric" } as const;
  return <section className="insights-filters" aria-label="Filter insights by date">
    <div className="insights-filter-heading"><span className="eyebrow">YOUR TIME WINDOW</span><p role="status"><CalendarDays size={14} />{formatDate(range.from, dateFormat)} – {formatDate(range.to, dateFormat)}</p></div>
    <div className="insights-range" role="group" aria-label="Insights date range">
      {INSIGHT_PRESETS.map(({ value, label }) => <button key={value} type="button" className={selection === value ? "active" : ""} aria-pressed={selection === value} onClick={() => { onChange(value); setEditing(false); setError(null); }}>{label}</button>)}
      <button type="button" className={typeof selection === "object" ? "active" : ""} aria-pressed={typeof selection === "object"} aria-expanded={editing} aria-controls="custom-insights-range" onClick={() => { setDraft({ from: range.from, to: range.to }); setError(null); setEditing((value) => !value); }}>Custom dates</button>
    </div>
    {editing && <form id="custom-insights-range" className="insights-custom-range" onSubmit={apply} noValidate>
      <label htmlFor="insights-from">From<input id="insights-from" type="date" required min="0001-01-01" max={draft.to || today} value={draft.from} onChange={(event) => { setDraft((value) => ({ ...value, from: event.target.value })); setError(null); }} aria-invalid={Boolean(error)} aria-describedby={error ? "insights-range-error" : undefined} /></label>
      <label htmlFor="insights-to">To<input id="insights-to" type="date" required min={draft.from || "0001-01-01"} max={today} value={draft.to} onChange={(event) => { setDraft((value) => ({ ...value, to: event.target.value })); setError(null); }} aria-invalid={Boolean(error)} aria-describedby={error ? "insights-range-error" : undefined} /></label>
      <button type="submit" className="button-primary">Apply dates</button><button type="button" className="subtle-link" onClick={() => { setEditing(false); setError(null); }}>Cancel</button>
      {error && <p id="insights-range-error" className="error-message" role="alert">{error}</p>}
    </form>}
  </section>;
}
