export type Tag = { id: string; name: string };
export type Profile = { id: string; email: string | null; username: string; created_at: string; updated_at: string; last_sign_in_at: string | null };
export type Sticker = { id: string; user_id: string; name: string; storage_path: string; mime_type: string; size_bytes: number; created_at: string; preview_url?: string };
export type Entry = {
  id: string;
  user_id: string;
  date: string;
  emoji: string | null;
  sticker_id?: string | null;
  sticker?: Sticker | null;
  mood_score?: number | null;
  note: string | null;
  created_at: string;
  tags: Tag[];
};
export type EntryInput = { date: string; emoji: string | null; sticker_id?: string | null; mood_score?: number | null; note: string; tags: string[]; timezone: string };
export type ActionResult<T> = { data: T; error?: never } | { error: string; data?: never };
