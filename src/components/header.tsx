"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, CalendarDays, ChevronDown, LogOut, LockKeyhole, Sun } from "lucide-react";
import { Brand } from "./brand";
import { useJournal } from "./journal-provider";
import { createClient } from "@/lib/supabase/client";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { demo, email, profile, encrypted, lock } = useJournal();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const nav = [
    { label: "Today", href: demo ? "/demo" : "/today", Icon: Sun },
    { label: "Calendar", href: demo ? "/demo/calendar" : "/calendar", Icon: CalendarDays },
    { label: "Insights", href: demo ? "/demo/insights" : "/insights", Icon: BarChart3 },
  ];
  async function logout() {
    setPending(true); setError("");
    try {
      const { error: authError } = await createClient().auth.signOut();
      if (authError) throw authError;
      lock(); router.replace("/"); router.refresh();
    } catch { setError("Couldn’t sign out. Try again."); setPending(false); }
  }
  return <>
    <header className="app-header"><div className="header-inner">
      <Brand href={demo ? "/demo" : "/today"} />
      <nav aria-label="Main navigation" className="main-nav">{nav.map(({ label, href, Icon }) => <Link href={href} key={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined}><Icon size={16} /><span>{label}</span></Link>)}</nav>
      <details className="account-menu"><summary aria-label="Account menu"><span className="avatar">{profile.username.slice(0, 1).toUpperCase()}</span><ChevronDown size={14} /></summary><div className="account-popover"><strong className="block truncate text-sm">@{profile.username}</strong><p className="truncate text-sm text-muted">{demo ? "Your demo journal" : email}</p>{encrypted && <button onClick={lock} className="text-link"><LockKeyhole size={15} />Lock journal</button>}<Link href={demo ? "/demo/account" : "/account"} className="text-link">Edit profile →</Link><Link href={demo ? "/demo/stickers" : "/stickers"} className="text-link">My stickers →</Link>{demo ? <Link href="/login" className="text-link">Start your own journal →</Link> : <button onClick={logout} disabled={pending} className="flex items-center gap-2 text-sm"><LogOut size={16} />{pending ? "Signing out…" : "Sign out"}</button>}{error && <p role="alert" className="error-message">{error}</p>}</div></details>
    </div></header>
    {encrypted && <div className="encryption-status"><LockKeyhole size={13} /><span>Journal content is end-to-end encrypted</span><Link href="/privacy">Details</Link></div>}
    {demo && <div className="demo-banner"><span><span className="status-dot" />Demo journal <span className="hidden sm:inline">· Sample entries. Edits last during this visit.</span></span><Link href="/login">Make it yours <span aria-hidden="true">↗</span></Link></div>}
  </>;
}
