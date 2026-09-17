import { JournalProvider } from "./journal-provider";
import { Header } from "./header";
import type { Entry, Profile, Tag } from "@/lib/types";
export function JournalShell({ children, entries, tags, today, email, profile, demo = false }: { children: React.ReactNode; entries: Entry[]; tags: Tag[]; today: string; email: string; profile?: Profile; demo?: boolean }) {
  return <JournalProvider initialEntries={entries} initialTags={tags} initialToday={today} email={email} initialProfile={profile} demo={demo}><Header />{children}</JournalProvider>;
}
