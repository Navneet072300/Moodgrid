"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, LoaderCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ configured, expired }: { configured: boolean; expired: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState(expired ? "That link has expired or was already used. Request a fresh one below." : "");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || status === "loading") return;
    setStatus("loading"); setError("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (authError) { setError(authError.status === 429 ? "Please wait a minute before requesting another link." : "We couldn't send your link. Check your email address and try again."); setStatus("idle"); return; }
      setStatus("sent");
    } catch { setError("Couldn't connect. Please check your connection and try again."); setStatus("idle"); }
  }
  if (status === "sent") return <div role="status" className="space-y-5 text-center">
    <span className="success-icon"><Check size={28} /></span><h2 className="text-2xl font-semibold">Check your inbox</h2>
    <p className="text-muted">We sent a sign-in link to <span className="text-white">{email}</span>. Open it to start your journal.</p>
    <p className="text-sm text-muted">No email? Check spam, or wait a minute before trying again.</p>
    <button className="text-link" onClick={() => setStatus("idle")}>Use another email or resend</button>
  </div>;
  return <form onSubmit={submit} className="space-y-5">
    <div><label htmlFor="email" className="field-label">Email address</label><div className="input-icon"><Mail size={18} /><input id="email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={status === "loading"} /></div></div>
    {error && <p role="alert" className="error-message">{error}</p>}
    {!configured && <p className="notice">Email sign-in isn’t available on this preview. You can explore the demo journal below.</p>}
    <button type="submit" className="button-primary w-full" disabled={!configured || status === "loading"}>{status === "loading" ? <><LoaderCircle size={18} className="animate-spin" /> Sending your link…</> : <>Send me a magic link <ArrowRight size={17} /></>}</button>
    <p className="text-center text-sm text-muted">Email signs you in. Your vault passphrase unlocks your journal.</p>
  </form>;
}
