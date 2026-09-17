import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, LockKeyhole, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { MoodCalendar } from "@/components/mood-calendar";
import { demoEntries } from "@/lib/demo";
import { todayInTimezone } from "@/lib/dates";
import { hasSupabase } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function LandingPage() {
  if (hasSupabase()) { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (user) redirect("/today"); }
  const today = todayInTimezone(); const entries = demoEntries(today);
  return <div className="landing-page"><header className="landing-header"><Brand /><div className="flex items-center gap-6"><Link href="/demo" className="subtle-link hidden sm:flex">Take a look around <ArrowUpRight size={15} /></Link><Link href="/login" className="button-secondary">Sign in <ArrowRight size={15} /></Link></div></header>
    <main><section className="landing-hero"><div className="landing-kicker"><span className="status-dot" />YOUR MOOD JOURNAL</div><h1>Track your mood.<br /><span>Keep it yours.</span></h1><p>Log a mood. Spot patterns. Set up an encrypted journal.</p><div className="hero-actions"><Link href="/login" className="button-primary">Start your mood journal <ArrowUpRight size={19} /></Link><Link href="/demo" className="hero-demo">Try the demo <ArrowRight size={17} /></Link></div><div className="hero-reassurance"><span><Check size={13} />Emojis & stickers</span><span><LockKeyhole size={13} />Client-side encryption</span></div></section>
    <section className="landing-preview" aria-label="Demo preview of the MoodGrid calendar"><div className="preview-toolbar"><div className="flex items-center gap-3"><span className="preview-dot" /><span>Calendar preview</span></div><span className="quiet-badge">DEMO JOURNAL</span></div><div className="preview-content"><div className="preview-top"><div><span className="eyebrow">YOUR YEAR IN FEELINGS</span><h2>Your year in moods.</h2></div><div className="preview-moods" aria-hidden="true"><span>😌</span><span>😊</span><span>🥹</span><span>😴</span><span>🤩</span></div></div><MoodCalendar entries={entries} today={today} /><div className="preview-bottom"><span><span className="text-mint">●</span> One emoji. One day. Your story.</span><Link href="/demo" className="text-link">Explore the journal <ArrowUpRight size={16} /></Link></div></div></section>
    <section className="landing-features"><article><span className="feature-number">01 / CHECK IN</span><h2>Quick check-ins.</h2><p>Find your emoji, add a thought if you want, and get on with your day.</p></article><article><span className="feature-number">02 / LOOK BACK</span><h2>A visual history.</h2><p>Your calendar becomes a colorful reminder that no two days are quite the same.</p></article><article><span className="feature-number"><Sparkles size={13} />03 / GET CURIOUS</span><h2>Private insights.</h2><p>Charts and weekly reflections run on your device.</p></article></section></main><footer className="landing-footer"><Brand /><Link href="/privacy">Privacy & encryption</Link></footer></div>;
}
