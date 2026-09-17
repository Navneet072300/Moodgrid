"use client";
import { z } from "zod";
import { createClient } from "../supabase/client";
import { stickerFormat } from "../stickers";
import { createKeys, decryptJSON, encryptJSON, open, recoverKey, seal, unlockKey, type KeyConfig } from "./crypto";
import { documentForStorage, envelopeSchema, parseDocument, stickerSchema, vaultRowSchema, type VaultDocument, type VaultRow } from "./types";
import type { Sticker } from "../types";
import { validateStickerDeletes, withoutEntry, withoutSticker } from "./document";

const BUCKET = "moodgrid-vault";
const LEGACY_BUCKET = "moodgrid-stickers";
export type UnlockedVault = { row: VaultRow; document: VaultDocument; key: CryptoKey };
export async function loadVault(user: string): Promise<VaultRow | null> {
  const { data, error } = await createClient().from("encrypted_vaults").select("*").eq("user_id", user).maybeSingle();
  if (error) throw new Error("Encrypted storage is unavailable. The database encryption migration must be installed before using your journal.");
  return data ? vaultRowSchema.parse(data) : null;
}
async function readDocument(row: VaultRow, key: CryptoKey): Promise<VaultDocument> {
  const document = parseDocument(await decryptJSON(row.ciphertext, key, row.user_id));
  if (document.entries.some((item) => item.user_id !== row.user_id) || document.stickers.some((item) => item.user_id !== row.user_id || !item.storage_path.startsWith(`${row.user_id}/`))) throw new Error("Vault ownership verification failed.");
  validateStickerDeletes(document, row.user_id);
  return document;
}
export async function encryptedFile(sticker: Sticker, key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  const { data, error } = await createClient().storage.from(BUCKET).download(sticker.storage_path);
  if (error || !data) throw new Error("An encrypted sticker could not be loaded. Try unlocking again.");
  const envelope = envelopeSchema.parse(JSON.parse(await data.text()) as unknown);
  return open(envelope, key, sticker.user_id, `sticker:${sticker.id}`);
}
async function uploadFile(bytes: Uint8Array<ArrayBuffer>, sticker: Sticker, key: CryptoKey) {
  const encrypted = await seal(bytes, key, sticker.user_id, `sticker:${sticker.id}`);
  const { error } = await createClient().storage.from(BUCKET).upload(sticker.storage_path, new Blob([JSON.stringify(encrypted)], { type: "application/octet-stream" }), { contentType: "application/octet-stream", upsert: false });
  if (error) throw new Error("Encrypted sticker upload failed. Your original data has been kept.");
  // Verify the actual stored bytes before migrating or committing a reference.
  const verified = await encryptedFile(sticker, key);
  if (verified.length !== bytes.length || verified.some((value, index) => value !== bytes[index])) throw new Error("Sticker verification failed. Original data has been kept.");
}
export async function addEncryptedSticker(file: File, sticker: Sticker, key: CryptoKey) {
  await uploadFile(new Uint8Array(await file.arrayBuffer()), sticker, key);
}
const legacySchema = z.object({ fingerprint: z.string(), snapshot: z.object({
  entries: z.array(z.object({ id: z.string(), user_id: z.string(), date: z.string(), emoji: z.string().nullable(), sticker_id: z.string().nullable().optional(), mood_score: z.number().nullable().optional(), note: z.string().nullable(), created_at: z.string() })),
  tags: z.array(z.object({ id: z.string(), name: z.string() })),
  links: z.array(z.object({ entry_id: z.string(), tag_id: z.string() })),
  stickers: z.array(stickerSchema), files: z.array(z.string()),
}) });
async function legacyDocument(user: string, key: CryptoKey, progress: (value: string) => void): Promise<VaultDocument> {
  const { data, error } = await createClient().rpc("read_legacy_journal");
  if (error) throw new Error("Existing data could not be loaded. Nothing has been removed.");
  const { snapshot, fingerprint } = legacySchema.parse(data);
  const stickers: Sticker[] = [];
  // Includes orphaned legacy files so no readable uploads are silently left behind.
  const paths = [...new Set([...snapshot.files, ...snapshot.stickers.map((item) => item.storage_path)])];
  for (const path of paths) {
    progress(`Encrypting stickers (${stickers.length + 1}/${paths.length})…`);
    if (!path.startsWith(`${user}/`)) throw new Error("Unexpected legacy file owner.");
    const { data: file, error: fileError } = await createClient().storage.from(LEGACY_BUCKET).download(path);
    if (fileError || !file) throw new Error("An original sticker is unavailable. Migration stopped without removing your data.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const original = snapshot.stickers.find((item) => item.storage_path === path);
    const id = original?.id ?? crypto.randomUUID();
    const format = stickerFormat(bytes);
    if (!format) throw new Error("A legacy sticker has an unsupported format. Original files have been preserved.");
    const sticker: Sticker = { id, user_id: user, name: original?.name ?? "Imported sticker", mime_type: format.mime, size_bytes: bytes.length, created_at: original?.created_at ?? new Date().toISOString(), storage_path: `${user}/${crypto.randomUUID()}.bin` };
    await uploadFile(bytes, sticker, key); stickers.push(sticker);
  }
  return {
    version: 1, tags: snapshot.tags, stickers,
    entries: snapshot.entries.map((entry) => ({ ...entry, tags: snapshot.links.filter((link) => link.entry_id === entry.id).flatMap((link) => snapshot.tags.filter((tag) => tag.id === link.tag_id)) })),
    migration: { fingerprint, legacyPaths: paths },
  };
}
async function finishMigration(vault: UnlockedVault, progress: (value: string) => void): Promise<UnlockedVault> {
  let row = vault.row;
  if (row.migration_stage === "complete") return vault;
  progress("Verifying encrypted copies…");
  for (const sticker of vault.document.stickers) {
    const bytes = await encryptedFile(sticker, vault.key);
    if (bytes.length !== sticker.size_bytes) throw new Error("Encrypted sticker verification failed. Migration paused.");
  }
  if (row.migration_stage === "pending") {
    const { data, error } = await createClient().rpc("finalize_vault_migration", { p_vault_user_id: row.user_id, p_expected_revision: row.revision, p_fingerprint: vault.document.migration.fingerprint }).single();
    if (error) throw new Error("Migration could not be finalized. Reload and unlock to retry; original data is preserved until verification succeeds.");
    row = vaultRowSchema.parse(data);
  }
  progress("Removing migrated plaintext copies…");
  for (let offset = 0; offset < vault.document.migration.legacyPaths.length; offset += 100) {
    const { error } = await createClient().storage.from(LEGACY_BUCKET).remove(vault.document.migration.legacyPaths.slice(offset, offset + 100));
    if (error) throw new Error("Encrypted copies are saved. Plaintext file cleanup is pending; unlock again to retry.");
  }
  const { data, error } = await createClient().rpc("complete_vault_migration", { p_vault_user_id: row.user_id, p_expected_revision: row.revision }).single();
  if (error) throw new Error("Plaintext cleanup is not yet verified. Unlock again to retry.");
  return { ...vault, row: vaultRowSchema.parse(data) };
}
export async function initializeVault(user: string, passphrase: string, recovery: string, progress: (value: string) => void): Promise<UnlockedVault> {
  progress("Creating your encryption key…");
  const { key, config } = await createKeys(passphrase, recovery, user);
  const document = await legacyDocument(user, key, progress);
  progress("Saving encrypted journal…");
  const ciphertext = await encryptJSON(documentForStorage(document), key, user);
  const { error } = await createClient().rpc("create_encrypted_vault", { p_vault_user_id: user, p_config: config, p_ciphertext: ciphertext, p_fingerprint: document.migration.fingerprint }).single();
  if (error) throw new Error("Vault creation did not finish. Reload to check its status before retrying. Keep your passphrase and recovery key.");
  const row = await loadVault(user);
  if (!row) throw new Error("Vault verification failed. Your original data is preserved.");
  const verified = await readDocument(row, key);
  if (JSON.stringify(verified) !== JSON.stringify(documentForStorage(document))) throw new Error("Vault verification failed. Your original data is preserved.");
  return finishMigration({ key, row, document: verified }, progress);
}
export async function unlockVault(row: VaultRow, passphrase: string, progress: (value: string) => void): Promise<UnlockedVault> {
  let key: CryptoKey;
  try { key = await unlockKey(row, passphrase, row.user_id); }
  catch { throw new Error("Unable to unlock. Check your passphrase or use your recovery key."); }
  const document = await readDocument(row, key);
  return finishMigration({ key, row, document }, progress);
}
export async function recoverVault(row: VaultRow, recovery: string, passphrase: string, progress: (value: string) => void): Promise<UnlockedVault> {
  let keys: { key: CryptoKey; config: KeyConfig };
  try { keys = await recoverKey(row, recovery, passphrase, row.user_id); }
  catch { throw new Error("Recovery failed. Check your recovery key and use a new passphrase of at least 16 characters."); }
  const document = await readDocument(row, keys.key);
  const { data, error } = await createClient().rpc("rewrap_vault_key", { p_vault_user_id: row.user_id, p_expected_revision: row.revision, p_salt: keys.config.salt, p_wrapped_key: keys.config.wrapped_key }).single();
  if (error) throw new Error("Recovery could not be saved. Reload and try again.");
  return finishMigration({ key: keys.key, row: vaultRowSchema.parse(data), document }, progress);
}
export async function persistVault(vault: UnlockedVault, document: VaultDocument): Promise<UnlockedVault> {
  const ciphertext = await encryptJSON(documentForStorage(document), vault.key, vault.row.user_id);
  const { data, error } = await createClient().rpc("save_encrypted_vault", { p_vault_user_id: vault.row.user_id, p_expected_revision: vault.row.revision, p_ciphertext: ciphertext }).single();
  if (error) throw new Error("Your vault changed or the connection failed. Lock and unlock to load the latest journal before retrying.");
  return { ...vault, document, row: vaultRowSchema.parse(data) };
}

export async function deleteVaultEntry(vault: UnlockedVault, id: string): Promise<UnlockedVault> {
  return persistVault(vault, withoutEntry(vault.document, id));
}

export async function deleteVaultSticker(vault: UnlockedVault, id: string): Promise<UnlockedVault> {
  const document = withoutSticker(vault.document, id);
  validateStickerDeletes(document, vault.row.user_id);
  // Commit the removal and encrypted retry queue before touching the file.
  // A stale revision must never delete an object still referenced by a newer vault.
  return cleanupDeletedStickers(await persistVault(vault, document));
}

export async function cleanupDeletedStickers(vault: UnlockedVault): Promise<UnlockedVault> {
  const paths = vault.document.pendingStickerDeletes ?? [];
  if (!paths.length || vault.row.migration_stage !== "complete") return vault;
  validateStickerDeletes(vault.document, vault.row.user_id);
  const remaining: string[] = [];
  const storage = createClient().storage.from(BUCKET);
  for (const path of paths) {
    try {
      const { error } = await storage.remove([path]);
      if (error) { remaining.push(path); continue; }
      // RLS may silently remove zero objects. Verify absence, including retries
      // after a successful deletion whose follow-up vault save was interrupted.
      const filename = path.split("/")[1];
      const { data, error: listError } = await storage.list(vault.row.user_id, { search: filename, limit: 2 });
      if (listError || !data || data.some((file) => file.name === filename)) remaining.push(path);
    } catch { remaining.push(path); }
  }
  if (remaining.length === paths.length) return vault;
  try { return await persistVault(vault, { ...vault.document, pendingStickerDeletes: remaining }); }
  catch { return vault; } // Keep the durable queue for the next unlock/retry.
}
