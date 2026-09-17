"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { useJournal } from "./journal-provider";
export function ProfileView() {
  const { profile, rename, demo } = useJournal();
  const [username, setUsername] = useState(profile.username);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => setUsername(profile.username), [profile.username]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setSaved(false);
    try { await rename(username); setSaved(true); }
    catch (error) { setError(error instanceof Error ? error.message : "Couldn’t update your username."); }
    finally { setPending(false); }
  }
  return <main className="page-shell"><div className="page-heading"><div><h1>Account</h1></div></div><section className="card profile-card"><span className="profile-avatar">{profile.username.slice(0, 1).toUpperCase()}</span><h2>@{profile.username}</h2><form onSubmit={submit}><label className="field-label" htmlFor="profile-email">Login email</label><input id="profile-email" value={profile.email ?? ""} readOnly type="email" /><p className="text-xs text-muted">Email and username are visible to the service.</p><label className="field-label" htmlFor="profile-username">Username</label><input id="profile-username" value={username} autoComplete="username" minLength={3} maxLength={32} required disabled={pending} onChange={(event) => { setUsername(event.target.value.toLowerCase()); setSaved(false); }} aria-describedby="username-help" /><p id="username-help" className="text-xs text-muted">3–32 letters, numbers, or underscores. Start with a letter.</p>{error && <p role="alert" className="error-message">{error}</p>}<button className="button-primary" disabled={pending || username === profile.username}>{pending ? <LoaderCircle size={17} className="animate-spin" /> : saved ? <Check size={17} /> : null}{pending ? "Saving…" : "Save username"}</button>{saved && <p className="text-sm text-mint" role="status">{demo ? "Demo username updated." : "Your username is updated."}</p>}</form></section></main>;
}
