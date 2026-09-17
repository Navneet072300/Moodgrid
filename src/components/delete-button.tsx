"use client";
import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useJournal } from "./journal-provider";
import { formatDate } from "@/lib/dates";
import type { Entry } from "@/lib/types";

type DeleteButtonProps = {
  label: string;
  title: string;
  description: string;
  onDelete: () => Promise<void>;
  disabled?: boolean;
  iconOnly?: boolean;
  blockedReason?: string;
};

function DeleteConfirmation({ title, description, onDelete, onClose, blockedReason }: Omit<DeleteButtonProps, "label" | "disabled" | "iconOnly"> & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal(); cancel.current?.focus();
    const overflow = document.body.style.overflow;
    if (overflow !== "hidden") document.body.style.overflow = "hidden";
    return () => { element?.close(); if (overflow !== "hidden") document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  async function confirm() {
    if (submitting.current || blockedReason) return;
    submitting.current = true; setPending(true); setError("");
    try { await onDelete(); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "Couldn't delete. Please try again."); }
    finally { submitting.current = false; setPending(false); }
  }
  return <dialog ref={dialog} className="delete-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!pending) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <h2 id={`${id}-title`}>{title}</h2>
    <p id={`${id}-description`}>{blockedReason || description}</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="delete-dialog-actions">
      <button ref={cancel} type="button" className="button-secondary" disabled={pending} onClick={onClose}>{blockedReason ? "Got it" : "Cancel"}</button>
      {!blockedReason && <button type="button" className="button-danger" disabled={pending} onClick={() => void confirm()}>{pending ? <><LoaderCircle size={16} className="animate-spin" />Deleting…</> : <><Trash2 size={16} />Delete</>}</button>}
    </div>
  </dialog>;
}

export function DeleteButton({ label, disabled = false, iconOnly = false, ...confirmation }: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={iconOnly ? "delete-icon" : "delete-text"} aria-label={label} title={label} disabled={disabled} onClick={() => setOpen(true)}><Trash2 size={16} aria-hidden="true" />{!iconOnly && label}</button>
    {open && <DeleteConfirmation {...confirmation} onClose={() => setOpen(false)} />}
  </>;
}

export function DeleteMomentButton({ entry, iconOnly, disabled, onDeleted }: { entry: Entry; iconOnly?: boolean; disabled?: boolean; onDeleted?: () => void }) {
  const { deleteEntry } = useJournal();
  const date = formatDate(entry.date, { month: "long", day: "numeric", year: "numeric" });
  return <DeleteButton label={iconOnly ? `Delete moment for ${date}` : "Delete moment"} title="Delete this moment?" description={`Your check-in for ${date}, including its note and tags, will be removed. This cannot be undone.`} iconOnly={iconOnly} disabled={disabled} onDelete={async () => { await deleteEntry(entry.id); onDeleted?.(); }} />;
}
