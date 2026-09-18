"use client";
import { useEffect, useId, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useJournal } from "./journal-provider";
import type { StreakNotice } from "@/lib/streak-notices";

function StreakDialog({ notice, onDismiss }: { notice: StreakNotice; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const id = useId();
  const celebration = notice.kind === "milestone";
  useEffect(() => {
    const element = dialog.current;
    let previous: HTMLElement | null = null;
    let overflow: string | undefined;
    // Wait for an edit/delete dialog to close instead of stacking popups.
    const open = () => {
      if (!element || element.open || document.hidden || document.querySelector("dialog[open]")) return;
      previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      overflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      element.showModal(); action.current?.focus();
    };
    const observer = new MutationObserver(open);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    document.addEventListener("visibilitychange", open); open();
    return () => {
      observer.disconnect(); document.removeEventListener("visibilitychange", open);
      element?.close();
      if (overflow !== undefined) document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={dialog} className={`streak-dialog ${celebration ? "streak-celebration" : "streak-pause"}`} aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} onCancel={(event) => { event.preventDefault(); onDismiss(); }} onClick={(event) => { if (event.target === event.currentTarget) onDismiss(); }}>
    <button type="button" className="dialog-close" aria-label="Dismiss streak message" onClick={onDismiss}><X size={19} /></button>
    <motion.div className="streak-dialog-art" aria-hidden="true" initial={reducedMotion ? false : { scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 14 }}>{celebration ? "🏆" : "🥺"}</motion.div>
    <span className="streak-dialog-kicker">{celebration ? `${notice.days}-DAY STREAK` : "A FRESH START"}</span>
    <h2 id={`${id}-title`}>{celebration ? `${notice.days} days of showing up!` : "Your streak took a pause"}</h2>
    <p id={`${id}-message`}>{celebration ? `${notice.days} days of making time for yourself. Every feeling counted. Look how far you’ve come!` : `Your ${notice.days}-day streak ended after a missed day. That progress still matters. Take a breath—today is a fresh start.`}</p>
    <button ref={action} type="button" className="button-primary" onClick={onDismiss}>{celebration ? "Here’s to the next chapter ✨" : "One day at a time 🌱"}</button>
  </dialog>;
}

export function StreakPopup() {
  const { streakNotice, dismissStreakNotice } = useJournal();
  return streakNotice ? <StreakDialog key={streakNotice.id} notice={streakNotice} onDismiss={() => void dismissStreakNotice(streakNotice.id)} /> : null;
}
