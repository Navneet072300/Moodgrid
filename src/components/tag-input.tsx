"use client";
import { useId, useState } from "react";
import { Hash, Plus, X } from "lucide-react";
import type { Tag } from "@/lib/types";

export function TagInput({ value, onChange, suggestions, disabled }: { value: string[]; onChange: (value: string[]) => void; suggestions: Tag[]; disabled?: boolean }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const normalized = query.trim().toLowerCase().replace(/^#+/, "");
  const matches = suggestions.filter((tag) => !value.includes(tag.name) && tag.name.includes(normalized)).slice(0, 5).map((tag) => tag.name);
  if (normalized && !value.includes(normalized) && !matches.includes(normalized)) matches.push(normalized);
  function add(name: string) { if (value.length < 8 && !value.includes(name)) onChange([...value, name]); setQuery(""); setOpen(false); setActive(0); }
  return <div className="relative">
    <label className="field-label" htmlFor={id}>Add a little context <span>optional</span></label>
    <div className="tag-field">{value.map((name) => <span className="tag" key={name}>#{name}<button type="button" disabled={disabled} onClick={() => onChange(value.filter((tag) => tag !== name))} aria-label={`Remove ${name} tag`}><X size={12} /></button></span>)}
      {value.length < 8 && <div className="flex min-w-24 flex-1 items-center gap-2"><Hash size={14} className="text-muted" /><input
        id={id} value={query} maxLength={24} disabled={disabled} placeholder={value.length ? "Add tag…" : "work, friends, a little me-time…"}
        role="combobox" aria-autocomplete="list" aria-expanded={open && matches.length > 0} aria-controls={`${id}-list`} aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((current) => Math.min(current + 1, matches.length - 1)); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)); }
          else if (event.key === "Enter" || event.key === ",") { event.preventDefault(); const name = open ? matches[active] : normalized; if (name) add(name); }
          else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
          else if (event.key === "Backspace" && !query) onChange(value.slice(0, -1));
        }} /></div>}
    </div>
    {open && matches.length > 0 && value.length < 8 && <ul id={`${id}-list`} role="listbox" className="tag-suggestions">{matches.map((name, index) => <li id={`${id}-option-${index}`} key={name} role="option" aria-selected={active === index} onMouseDown={(event) => { event.preventDefault(); add(name); }} className={active === index ? "active" : ""}><Hash size={13} />{name}{!suggestions.some((tag) => tag.name === name) && <span className="ml-auto flex items-center gap-1 text-xs text-muted"><Plus size={12} />Create tag</span>}</li>)}</ul>}
    <p className="mt-2 text-xs text-muted">{value.length >= 8 ? "8 of 8 tags added." : "Choose a suggestion or press Enter to add a tag."}</p>
  </div>;
}
