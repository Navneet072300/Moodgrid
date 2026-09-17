// Read-only connectivity/schema check; never sends email or modifies records.
// Run: node --env-file=.env.local --import tsx scripts/verify-supabase.ts
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../src/lib/supabase/config";

async function main() {
  const { url, key } = supabaseConfig();
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ auth: "unavailable", status: response.status }));
      process.exitCode = 1;
      return;
    }
    const settings: unknown = await response.json();
    const external = typeof settings === "object" && settings && "external" in settings ? settings.external : undefined;
    const emailEnabled = typeof external === "object" && external && "email" in external ? external.email === true : null;
    console.log(JSON.stringify({ auth: "connected", emailEnabled }));

    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    for (const table of ["encrypted_vaults", "profiles", "entries", "tags", "entry_tags", "stickers", "emoji_catalog", "summary_rate_limits"]) {
      const { error, status } = await supabase.from(table).select("*").limit(0);
      const state = error?.code === "PGRST205" ? "missing" : error?.code === "42501" ? "exists; anonymous access denied" : error ? "unverified" : "reachable; RLS must be checked with a signed-in session";
      console.log(JSON.stringify({ table, state, status, code: error?.code ?? null }));
      if (error && error.code !== "42501") process.exitCode = 1;
    }
    // OPTIONS is generic in PostgREST and cannot prove an RPC exists.
    console.log(JSON.stringify({ functions: "require signed-in or administrative verification", executed: false }));
  } catch {
    console.error(JSON.stringify({ connection: "failed" }));
    process.exitCode = 1;
  }
}
void main();
