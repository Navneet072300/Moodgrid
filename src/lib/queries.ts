import "server-only";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

// Only account profile data can be read by the application server.
export async function getProfile(userId: string): Promise<Profile> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw new Error("Your account profile could not be loaded. Check the database setup.");
  return data;
}
