"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LockKeyhole, LoaderCircle, Download } from "lucide-react";
import { Brand } from "./brand";
import { newRecoveryKey, validatePassphrase } from "@/lib/vault/crypto";
import { createClient } from "@/lib/supabase/client";

export function VaultGate({ stage, busy, error, progress, username, onSetup, onUnlock, onRecover, onRetry }: {
  stage: "loading" | "setup" | "locked" | "error";
  busy: boolean; error: string; progress: string; username: string;
  onSetup: (passphrase: string, recovery: string) => Promise<void>;
  onUnlock: (passphrase: string) => Promise<void>;
  onRecover: (recovery: string, passphrase: string) => Promise<void>;
  onRetry: () => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recovery, setRecovery] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [generated, setGenerated] = useState("");
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setLocalError("");
    try {
      if (stage === "setup" || recovering) {
        validatePassphrase(passphrase);
        if (passphrase !== confirmation) throw new Error("Passphrases do not match.");
      }
      if (stage === "setup") {
        if (!generated) { setGenerated(newRecoveryKey()); return; }
        if (!saved) throw new Error("Save your recovery key before continuing.");
        await onSetup(passphrase, generated);
      } else if (recovering) await onRecover(recovery, passphrase);
      else await onUnlock(passphrase);
      setPassphrase(""); setConfirmation(""); setRecovery("");
    } catch (error) { setLocalError(error instanceof Error ? error.message : "Unable to unlock."); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([`MoodGrid recovery key\nAccount: @${username}\n\n${generated}\n\nKeep this offline or in your password manager. Anyone with your key and account access can unlock your journal.\n`], { type: "text/plain" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "moodgrid-recovery-key.txt"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="vault-page"><div className="login-top"><Brand /><button className="subtle-link" onClick={async () => { const { error } = await createClient().auth.signOut(); if (!error) window.location.assign("/login"); else setLocalError("Could not sign out. Try again."); }}>Sign out</button></div><section className="card vault-card"><LockKeyhole size={30} className="text-mint" /><h1>{stage === "setup" ? "Protect your journal" : "Unlock your journal"}</h1><p className="text-muted">@{username}</p>
    {stage === "loading" ? <p role="status"><LoaderCircle className="animate-spin" size={18} /> Loading encrypted storage…</p> : stage === "error" ? <button onClick={onRetry} className="button-primary">Retry connection</button> : <form onSubmit={submit}>
      {(stage === "setup" || recovering) && <p className="vault-help">Your passphrase stays on this device. Save your recovery key; email login alone cannot recover an encrypted journal.</p>}
      {recovering && <label>Recovery key<input type="password" autoComplete="off" value={recovery} onChange={(event) => setRecovery(event.target.value)} disabled={busy} required /></label>}
      <label>{recovering ? "New passphrase" : "Vault passphrase"}<input type="password" autoComplete={stage === "setup" || recovering ? "new-password" : "current-password"} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} disabled={busy} required maxLength={256} minLength={stage === "setup" || recovering ? 16 : undefined} /></label>
      {(stage === "setup" || recovering) && <label>Confirm passphrase<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} required maxLength={256} /></label>}
      {stage === "setup" && generated && <div className="recovery-panel"><strong>Save your recovery key</strong><code>{generated}</code><button type="button" className="button-secondary" onClick={download}><Download size={16} />Download key</button><label className="recovery-check"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} required disabled={busy} />I saved this key somewhere safe.</label><p>Existing entries and stickers will be encrypted and verified before live plaintext copies are removed.</p></div>}
      <button className="button-primary" disabled={busy}>{busy ? <><LoaderCircle size={17} className="animate-spin" />{progress || "Unlocking…"}</> : stage === "setup" ? generated ? "Encrypt my journal" : "Create recovery key" : recovering ? "Recover and unlock" : "Unlock"}</button>
      {stage === "locked" && <button type="button" className="subtle-link" disabled={busy} onClick={() => { setRecovering((value) => !value); setLocalError(""); setPassphrase(""); setConfirmation(""); setRecovery(""); }}>{recovering ? "Use passphrase" : "Use recovery key"}</button>}
    </form>}
    {(error || localError) && <p role="alert" className="error-message">{localError || error}</p>}
    <p className="vault-help">Email and username remain visible to the service. <Link href="/privacy" className="text-link">Privacy details</Link></p>
  </section></main>;
}
