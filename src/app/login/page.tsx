import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, LockKeyhole } from "lucide-react";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { hasSupabase } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Your journal starts here" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const configured = hasSupabase();
  if (configured) { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (user) redirect("/today"); }
  const { error } = await searchParams;
  return <main className="login-page"><div className="login-top"><Brand /><Link href="/" className="subtle-link"><ArrowLeft size={16} />Back home</Link></div><div className="login-card card"><div className="login-emojis" aria-hidden="true">😌 <span>😊</span> 🥹</div><h1>Sign in</h1><p className="mb-8 text-muted">Get a magic link by email.</p><LoginForm configured={configured} expired={error === "expired"} /><div className="login-divider"><span>Just looking around?</span></div><Link href="/demo" className="button-secondary w-full">Explore the demo <ArrowUpRight size={16} /></Link></div><p className="flex items-center justify-center gap-2 text-sm text-muted"><LockKeyhole size={14} />Unlock your encrypted journal after signing in.</p></main>;
}
