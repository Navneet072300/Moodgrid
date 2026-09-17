"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { EntryForm } from "./entry-form";
export function EntryDialog({ date, onClose }: { date: string | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!date || !element) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [date]);
  return <dialog ref={dialog} className="entry-dialog" aria-label="View or edit daily check-in" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="relative"><button type="button" className="dialog-close" onClick={onClose} aria-label="Close check-in"><X size={19} /></button>{date && <EntryForm key={date} date={date} onDeleted={onClose} />}</div></dialog>;
}
