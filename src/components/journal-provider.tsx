"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { updateUsername } from "@/app/actions/profile";
import { MAX_STICKER_BYTES, stickerFormat, stickerFileName } from "@/lib/stickers";
import { getMood } from "@/lib/moods";
import { todayInTimezone } from "@/lib/dates";
import { assertCheckInDate } from "@/lib/check-in-policy";
import { getStreakNotice, mergeStreakReceipts, type StreakNotice } from "@/lib/streak-notices";
import { entrySchema, usernameSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/client";
import { addEncryptedSticker, cleanupDeletedStickers, deleteVaultEntry, deleteVaultSticker, encryptedFile, initializeVault, loadVault, persistVault, recoverVault, unlockVault, type UnlockedVault } from "@/lib/vault/store";
import { withoutEntry, withoutSticker } from "@/lib/vault/document";
import type { VaultDocument, VaultRow } from "@/lib/vault/types";
import { VaultGate } from "./vault-gate";
import type { Entry, EntryInput, Profile, Sticker, Tag } from "@/lib/types";

type JournalContextValue = {
  entries: Entry[]; tags: Tag[]; today: string; timezone: string; demo: boolean; email: string; profile: Profile; stickers: Sticker[];
  encrypted: boolean; lock: () => void;
  rename: (username: string) => Promise<void>;
  uploadSticker: (file: File, name?: string) => Promise<Sticker>;
  save: (input: Omit<EntryInput, "timezone">) => Promise<Entry>;
  deleteEntry: (id: string) => Promise<void>;
  deleteSticker: (id: string) => Promise<void>;
  pendingStickerDeletes: number;
  retryStickerDeletes: () => Promise<void>;
  streakNotice: StreakNotice | null;
  dismissStreakNotice: (id: string) => Promise<void>;
};
const JournalContext = createContext<JournalContextValue | null>(null);
export function JournalProvider({ children, initialEntries, initialTags, initialToday, email, initialProfile, demo = false }: {
  children: React.ReactNode; initialEntries: Entry[]; initialTags: Tag[]; initialToday: string; email: string; initialProfile?: Profile; demo?: boolean;
}) {
  const [profile, setProfile] = useState<Profile>(initialProfile ?? { id: "demo", email, username: "cosmic_otter", created_at: `${initialToday}T12:00:00Z`, updated_at: `${initialToday}T12:00:00Z`, last_sign_in_at: null });
  const [entries, setEntries] = useState(demo ? initialEntries : []);
  const [tags, setTags] = useState(demo ? initialTags : []);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [pendingStickerDeletes, setPendingStickerDeletes] = useState(0);
  const [today, setToday] = useState(initialToday);
  const [timezone, setTimezone] = useState("UTC");
  const [clockReady, setClockReady] = useState(false);
  const [seenStreakEvents, setSeenStreakEvents] = useState<string[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [stage, setStage] = useState<"loading" | "setup" | "locked" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const row = useRef<VaultRow | null>(null);
  const vault = useRef<UnlockedVault | null>(null);
  const epoch = useRef(0);
  const writing = useRef(false);
  const objectUrls = useRef<string[]>([]);
  const noticeReceipts = useRef<string[]>([]);
  const withReceipts = useCallback((document: VaultDocument): VaultDocument => ({ ...document, seenStreakEvents: mergeStreakReceipts(document.seenStreakEvents, noticeReceipts.current) }), []);
  const clearUrls = useCallback(() => { objectUrls.current.forEach((url) => URL.revokeObjectURL(url)); objectUrls.current = []; }, []);
  const refreshVault = useCallback(async () => {
    if (demo) return;
    const generation = epoch.current;
    setStage("loading"); setError("");
    try { if (!globalThis.crypto?.subtle) throw new Error("Use HTTPS or localhost to unlock encrypted storage."); const result = await loadVault(profile.id); if (generation !== epoch.current) return; row.current = result; setStage(result ? "locked" : "setup"); }
    catch (error) { if (generation === epoch.current) { setStage("error"); setError(error instanceof Error ? error.message : "Encrypted storage is unavailable."); } }
  }, [demo, profile.id]);
  const lock = useCallback(() => {
    if (demo) return;
    epoch.current++; vault.current = null; row.current = null; writing.current = false;
    noticeReceipts.current = []; setSeenStreakEvents([]);
    clearUrls(); setEntries([]); setTags([]); setStickers([]); setPendingStickerDeletes(0); setUnlocked(false); setBusy(false); setProgress("");
    void refreshVault();
  }, [demo, clearUrls, refreshVault]);
  useEffect(() => { const lifecycle = epoch; const session = vault; void refreshVault(); return () => { lifecycle.current++; session.current = null; clearUrls(); }; }, [refreshVault, clearUrls]);
  useEffect(() => { if (!demo && initialProfile) setProfile(initialProfile); }, [demo, initialProfile]);
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(zone); setToday(todayInTimezone(zone)); setClockReady(true);
    // The timezone is needed only on this device, not in an account cookie.
    document.cookie = "moodgrid-timezone=; Path=/; Max-Age=0; SameSite=Lax";
    const timer = window.setInterval(() => setToday(todayInTimezone(zone)), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (demo || !unlocked) return;
    let hiddenAt = 0;
    let timeout = window.setTimeout(lock, 10 * 60_000);
    const activity = () => { window.clearTimeout(timeout); timeout = window.setTimeout(lock, 10 * 60_000); };
    const visibility = () => { if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 60_000) lock(); };
    window.addEventListener("pointerdown", activity); window.addEventListener("keydown", activity); window.addEventListener("pagehide", lock); document.addEventListener("visibilitychange", visibility);
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session?.user && session.user.id !== profile.id)) { lock(); window.location.assign("/login"); }
    });
    return () => { window.clearTimeout(timeout); subscription.unsubscribe(); window.removeEventListener("pointerdown", activity); window.removeEventListener("keydown", activity); window.removeEventListener("pagehide", lock); document.removeEventListener("visibilitychange", visibility); };
  }, [demo, unlocked, lock, profile.id]);
  async function hydrate(session: UnlockedVault, generation: number) {
    const local: Sticker[] = []; const urls: string[] = [];
    try {
      for (const sticker of session.document.stickers) {
        const bytes = await encryptedFile(sticker, session.key);
        const url = URL.createObjectURL(new Blob([bytes], { type: sticker.mime_type })); urls.push(url);
        local.push({ ...sticker, preview_url: url });
      }
      if (generation !== epoch.current) { urls.forEach((url) => URL.revokeObjectURL(url)); return; }
      clearUrls(); objectUrls.current = urls; vault.current = session; row.current = session.row;
      noticeReceipts.current = session.document.seenStreakEvents ?? []; setSeenStreakEvents(noticeReceipts.current);
      setEntries(session.document.entries.map((entry) => ({ ...entry, sticker: local.find((item) => item.id === entry.sticker_id) ?? null })).sort((a, b) => b.date.localeCompare(a.date)));
      setTags(session.document.tags); setStickers(local); setPendingStickerDeletes(session.document.pendingStickerDeletes?.length ?? 0); setUnlocked(true);
    } catch (error) { urls.forEach((url) => URL.revokeObjectURL(url)); throw error; }
  }
  async function openVault(operation: () => Promise<UnlockedVault>) {
    if (busy) return;
    const generation = epoch.current; setBusy(true); setError(""); setProgress("Unlocking…");
    try {
      const session = await operation();
      if (generation !== epoch.current) return;
      await hydrate(await cleanupDeletedStickers(session), generation);
    }
    catch (error) {
      if (generation === epoch.current) {
        setError(error instanceof Error ? error.message : "Unable to unlock your journal.");
        // An interrupted setup may already have saved a recoverable encrypted vault.
        const current = await loadVault(profile.id).catch(() => null);
        if (current) { row.current = current; setStage("locked"); }
      }
    } finally { if (generation === epoch.current) { setBusy(false); setProgress(""); } }
  }
  const rename = useCallback(async (username: string) => {
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    if (demo) { setProfile((value) => ({ ...value, username: parsed.data })); return; }
    const result = await updateUsername(parsed.data);
    if (result.error !== undefined) throw new Error(result.error);
    setProfile(result.data);
  }, [demo]);
  const save = useCallback(async (input: Omit<EntryInput, "timezone">): Promise<Entry> => {
    if (writing.current) throw new Error("Wait for the current save to finish.");
    const parsed = entrySchema.parse({ ...input, timezone });
    if (parsed.sticker_id && !stickers.some((item) => item.id === parsed.sticker_id)) throw new Error("Choose a sticker from your library.");
    const generation = epoch.current;
    const session = vault.current;
    if (!demo && !session) throw new Error("Unlock your journal before saving.");
    writing.current = true;
    try {
      const source = session?.document.entries ?? entries;
      assertCheckInDate(parsed.date, source, timezone);
      const existing = source.find((value) => value.date === parsed.date);
      const saved: Entry = { id: existing?.id ?? crypto.randomUUID(), user_id: demo ? "demo" : profile.id, date: parsed.date, emoji: parsed.emoji, sticker_id: parsed.sticker_id ?? null, sticker: stickers.find((item) => item.id === parsed.sticker_id) ?? null, mood_score: parsed.mood_score ?? getMood(parsed.emoji).score, note: parsed.note.trim() || null, created_at: existing?.created_at ?? new Date().toISOString(), tags: parsed.tags.map((name) => tags.find((tag) => tag.name === name) ?? { id: crypto.randomUUID(), name }) };
      const nextEntries = [saved, ...source.filter((value) => value.date !== saved.date)].sort((a, b) => b.date.localeCompare(a.date));
      const nextTags = [...new Map([...tags, ...saved.tags].map((tag) => [tag.name, tag])).values()].sort((a, b) => a.name.localeCompare(b.name));
      const next = session ? await persistVault(session, withReceipts({ ...session.document, entries: nextEntries, tags: nextTags })) : null;
      if (generation !== epoch.current) throw new Error("Journal locked. Unlock to see your latest saved data.");
      if (next) { vault.current = next; row.current = next.row; }
      setEntries(nextEntries.map((entry) => ({ ...entry, sticker: stickers.find((item) => item.id === entry.sticker_id) ?? null }))); setTags(nextTags);
      return saved;
    } finally { if (generation === epoch.current) writing.current = false; }
  }, [demo, entries, tags, timezone, stickers, profile.id, withReceipts]);
  const uploadSticker = useCallback(async (file: File, name?: string): Promise<Sticker> => {
    if (writing.current) throw new Error("Wait for the current save to finish.");
    if (!file.size || file.size > MAX_STICKER_BYTES) throw new Error("Choose a sticker smaller than 3 MB.");
    const generation = epoch.current; const session = vault.current;
    if (!demo && !session) throw new Error("Unlock your journal before uploading.");
    writing.current = true;
    try {
      const format = stickerFormat(new Uint8Array(await file.slice(0, 4096).arrayBuffer()));
      if (!format) throw new Error("Use PNG, JPG, WebP, GIF, or WebM.");
      if (generation !== epoch.current) throw new Error("Journal locked. Unlock to upload your sticker.");
      const id = crypto.randomUUID();
      const sticker: Sticker = { id, user_id: demo ? "demo" : profile.id, name: (name?.trim() || stickerFileName(file.name)).slice(0, 60), mime_type: format.mime, size_bytes: file.size, storage_path: `${profile.id}/${crypto.randomUUID()}.bin`, created_at: new Date().toISOString() };
      let next: UnlockedVault | null = null;
      if (session) {
        await addEncryptedSticker(file, sticker, session.key);
        next = await persistVault(session, withReceipts({ ...session.document, stickers: [sticker, ...session.document.stickers] }));
      }
      if (generation !== epoch.current) throw new Error("Journal locked. Unlock to reload your library.");
      if (next) { vault.current = next; row.current = next.row; }
      sticker.preview_url = URL.createObjectURL(file); objectUrls.current.push(sticker.preview_url);
      setStickers((current) => [sticker, ...current]); return sticker;
    } finally { if (generation === epoch.current) writing.current = false; }
  }, [demo, profile.id, withReceipts]);
  const remove = useCallback(async (kind: "entry" | "sticker", id: string) => {
    if (writing.current) throw new Error("Wait for the current save to finish.");
    const generation = epoch.current; const session = vault.current;
    if (!demo && !session) throw new Error("Unlock your journal before deleting.");
    writing.current = true;
    try {
      const local: VaultDocument = { version: 1, entries, tags, stickers, migration: { fingerprint: "", legacyPaths: [] } };
      const current = session ? { ...session, document: withReceipts(session.document) } : null;
      const next = current ? await (kind === "entry" ? deleteVaultEntry(current, id) : deleteVaultSticker(current, id)) : null;
      const document = next?.document ?? (kind === "entry" ? withoutEntry(local, id) : withoutSticker(local, id));
      if (generation !== epoch.current) throw new Error("Journal locked. Unlock to see your latest data.");
      if (next) { vault.current = next; row.current = next.row; }
      const remaining = stickers.filter((sticker) => document.stickers.some((item) => item.id === sticker.id));
      for (const sticker of stickers) {
        if (sticker.preview_url && !remaining.includes(sticker)) {
          URL.revokeObjectURL(sticker.preview_url);
          objectUrls.current = objectUrls.current.filter((url) => url !== sticker.preview_url);
        }
      }
      setEntries(document.entries.map((entry) => ({ ...entry, sticker: remaining.find((item) => item.id === entry.sticker_id) ?? null })));
      setTags(document.tags); setStickers(remaining); setPendingStickerDeletes(demo ? 0 : document.pendingStickerDeletes?.length ?? 0);
    } finally { if (generation === epoch.current) writing.current = false; }
  }, [demo, entries, tags, stickers, withReceipts]);
  const deleteEntry = useCallback((id: string) => remove("entry", id), [remove]);
  const deleteSticker = useCallback((id: string) => remove("sticker", id), [remove]);
  const retryStickerDeletes = useCallback(async () => {
    if (writing.current) throw new Error("Wait for the current save to finish.");
    const generation = epoch.current; const session = vault.current;
    if (!session) throw new Error("Unlock your journal to retry.");
    writing.current = true;
    try {
      const next = await cleanupDeletedStickers(session);
      if (generation !== epoch.current) return;
      vault.current = next; row.current = next.row;
      setPendingStickerDeletes(next.document.pendingStickerDeletes?.length ?? 0);
      if (next.document.pendingStickerDeletes?.length) throw new Error("File cleanup is still pending. Try again later, or lock and unlock to reload your journal.");
    } finally { if (generation === epoch.current) writing.current = false; }
  }, []);
  const streakNotice = useMemo(() => clockReady ? getStreakNotice(entries, today, seenStreakEvents) : null, [clockReady, entries, today, seenStreakEvents]);
  const dismissStreakNotice = useCallback(async (id: string) => {
    if (noticeReceipts.current.includes(id)) return;
    const generation = epoch.current; const session = vault.current;
    if (!demo && !session) return;
    // A visible notice must remain dismissible if the clock rolls over before
    // the next UI tick. Acknowledge the displayed event, not a newly derived one.
    if (streakNotice?.id !== id) return;
    noticeReceipts.current = mergeStreakReceipts(noticeReceipts.current, [id]);
    setSeenStreakEvents(noticeReceipts.current);
    // Dismissals never block journaling. If offline or another write is in
    // progress, retain the receipt in memory and include it in the next save.
    if (!session || writing.current) return;
    writing.current = true;
    try {
      const next = await persistVault(session, withReceipts(session.document));
      if (generation === epoch.current) { vault.current = next; row.current = next.row; }
    } catch { /* A subsequent save retries the encrypted receipt. */ }
    finally { if (generation === epoch.current) writing.current = false; }
  }, [demo, streakNotice, withReceipts]);
  const encrypted = !demo && unlocked && vault.current?.row.migration_stage === "complete";
  const value = useMemo(() => ({ entries, tags, today, timezone, demo, email, save, profile, stickers, rename, uploadSticker, encrypted, lock, deleteEntry, deleteSticker, pendingStickerDeletes, retryStickerDeletes, streakNotice, dismissStreakNotice }), [entries, tags, today, timezone, demo, email, save, profile, stickers, rename, uploadSticker, encrypted, lock, deleteEntry, deleteSticker, pendingStickerDeletes, retryStickerDeletes, streakNotice, dismissStreakNotice]);
  return <JournalContext.Provider value={value}>{demo || unlocked ? children : <VaultGate stage={stage} busy={busy} error={error} progress={progress} username={profile.username} onRetry={() => void refreshVault()}
    onSetup={(passphrase, recovery) => openVault(() => initializeVault(profile.id, passphrase, recovery, setProgress))}
    onUnlock={(passphrase) => openVault(async () => { if (!row.current) throw new Error("Reload to check your vault."); return unlockVault(row.current, passphrase, setProgress); })}
    onRecover={(recovery, passphrase) => openVault(async () => { if (!row.current) throw new Error("Reload to check your vault."); return recoverVault(row.current, recovery, passphrase, setProgress); })} />}</JournalContext.Provider>;
}
export function useJournal() {
  const value = useContext(JournalContext);
  if (!value) throw new Error("Journal components must be wrapped in JournalProvider.");
  return value;
}
