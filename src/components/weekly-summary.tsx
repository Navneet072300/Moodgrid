"use client";
import { useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useJournal } from "./journal-provider";
import { addDays } from "@/lib/dates";
import { moodDistribution, tagDistribution } from "@/lib/insights";

export function WeeklySummary() {
  const { entries, today } = useJournal();
  const [summary, setSummary] = useState("");
  function summarize() {
    const week = entries.filter((entry) => entry.date >= addDays(today, -6) && entry.date <= today);
    if (!week.length) { setSummary("No check-ins in the past seven days."); return; }
    const mood = moodDistribution(week)[0]; const tag = tagDistribution(week)[0];
    const linked = tag ? week.filter((entry) => (entry.sticker_id || entry.emoji) === mood.key && entry.tags.some((value) => value.name === tag.name)).length : 0;
    setSummary(`${week.length} check-ins in the past 7 days. ${mood.emoji} ${mood.label} appeared ${mood.count} ${mood.count === 1 ? "time" : "times"}.${tag ? ` #${tag.name} appeared in ${tag.count} check-ins${linked ? `, including ${linked} with ${mood.label}` : ""}.` : ""}`);
  }
  return <section className="card summary-card"><div className="flex items-center gap-2"><Sparkles size={18} className="text-mint" /><h2 className="!mt-0">Weekly reflection</h2></div>
    {summary && <div className="summary-text" role="status">{summary}</div>}
    <button className="summary-button" onClick={summarize}>Summarize my week<ArrowUpRight size={16} /></button>
    <p className="summary-disclosure">Computed on your device. Nothing is sent to an AI service.</p>
  </section>;
}
