import type { Metadata } from "next";
import { JournalShell } from "@/components/journal-shell";
import { demoEntries, DEMO_TAGS } from "@/lib/demo";
import { todayInTimezone } from "@/lib/dates";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo journal", robots: { index: false, follow: false } };
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const today = todayInTimezone();
  return <JournalShell demo entries={demoEntries(today)} tags={DEMO_TAGS} today={today} email="demo@moodgrid.app">{children}</JournalShell>;
}
