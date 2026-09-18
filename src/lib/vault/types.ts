import { z } from "zod";
import type { Envelope, KeyConfig } from "./crypto";
import type { Entry, Sticker, Tag } from "../types";
export type VaultDocument = {
  version: 1; entries: Entry[]; tags: Tag[]; stickers: Sticker[];
  migration: { fingerprint: string; legacyPaths: string[] };
  pendingStickerDeletes?: string[];
  seenStreakEvents?: string[];
};
export type VaultRow = KeyConfig & { user_id: string; ciphertext: Envelope; revision: number; migration_stage: "pending" | "files" | "complete" };
export const envelopeSchema = z.object({ v: z.literal(1), iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/), data: z.string().min(24).max(12 * 1024 * 1024).regex(/^[A-Za-z0-9+/]*={0,2}$/) }).strict();
export const vaultRowSchema = z.object({ user_id: z.string().uuid(), salt: z.string(), iterations: z.literal(600000), wrapped_key: envelopeSchema, recovery_wrapped_key: envelopeSchema, ciphertext: envelopeSchema, revision: z.number().int().positive(), migration_stage: z.enum(["pending", "files", "complete"]) });
const tag = z.object({ id: z.string(), name: z.string().max(24) });
export const stickerSchema = z.object({ id: z.string().uuid(), user_id: z.string().uuid(), name: z.string().max(60), storage_path: z.string(), mime_type: z.string(), size_bytes: z.number().int().positive(), created_at: z.string() });
const entry = z.object({ id: z.string(), user_id: z.string().uuid(), date: z.string(), emoji: z.string().nullable(), sticker_id: z.string().nullable().optional(), mood_score: z.number().min(1).max(5).nullable().optional(), note: z.string().nullable(), created_at: z.string(), tags: z.array(tag) });
export const documentSchema = z.object({ version: z.literal(1), entries: z.array(entry), tags: z.array(tag), stickers: z.array(stickerSchema), migration: z.object({ fingerprint: z.string(), legacyPaths: z.array(z.string()) }), pendingStickerDeletes: z.array(z.string()).optional(), seenStreakEvents: z.array(z.string().max(80)).max(256).optional() });
export function parseDocument(value: unknown): VaultDocument { return documentSchema.parse(value); }
export function documentForStorage(document: VaultDocument): VaultDocument {
  return parseDocument(document); // Whitelist excludes blob URLs and hydrated sticker objects.
}
