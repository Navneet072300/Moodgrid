"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { usernameSchema } from "@/lib/validation";
import type { ActionResult, Profile } from "@/lib/types";

export async function updateUsername(input: string): Promise<ActionResult<Profile>> {
  const parsed = usernameSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please sign in again." };
    const { data, error } = await supabase.from("profiles").update({ username: parsed.data }).eq("id", user.id).select("*").single();
    if (error) return { error: error.code === "23505" ? "That username is already taken. Try another one." : "Your username could not be saved. Please try again." };
    revalidatePath("/", "layout");
    return { data };
  } catch { return { error: "Couldn’t connect. Please try again." }; }
}
