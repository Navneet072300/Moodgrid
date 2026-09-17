import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/config";
import { getProfile } from "@/lib/queries";
import { todayInTimezone } from "@/lib/dates";
import { JournalShell } from "@/components/journal-shell";
export const dynamic = "force-dynamic";
export default async function JournalLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabase()) redirect("/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);
  // Journal plaintext and vault keys never enter Server Components.
  return <JournalShell entries={[]} tags={[]} today={todayInTimezone()} email={user.email ?? ""} profile={profile}>{children}</JournalShell>;
}
