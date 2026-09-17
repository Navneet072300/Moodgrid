import type { Envelope, KeyConfig } from "./vault/crypto";
import type { VaultRow } from "./vault/types";
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type Database = {
  public: {
    Tables: {
      encrypted_vaults: { Row: VaultRow; Insert: VaultRow; Update: never; Relationships: [] };
      entries: {
        Row: { id: string; user_id: string; date: string; emoji: string | null; sticker_id: string | null; mood_score: number | null; note: string | null; created_at: string };
        Insert: { id?: string; user_id: string; date: string; emoji?: string | null; sticker_id?: string | null; mood_score?: number | null; note?: string | null; created_at?: string };
        Update: { date?: string; emoji?: string | null; sticker_id?: string | null; mood_score?: number | null; note?: string | null };
        Relationships: [{ foreignKeyName: "entries_sticker_owner_fkey"; columns: ["sticker_id", "user_id"]; isOneToOne: false; referencedRelation: "stickers"; referencedColumns: ["id", "user_id"] }];
      };
      profiles: {
        Row: { id: string; email: string | null; username: string; created_at: string; updated_at: string; last_sign_in_at: string | null };
        Insert: { id: string; email?: string | null; username: string; created_at?: string; updated_at?: string; last_sign_in_at?: string | null };
        Update: { username?: string };
        Relationships: [];
      };
      stickers: {
        Row: { id: string; user_id: string; name: string; storage_path: string; mime_type: string; size_bytes: number; created_at: string };
        Insert: { id?: string; user_id: string; name: string; storage_path: string; mime_type: string; size_bytes: number; created_at?: string };
        Update: { name?: string };
        Relationships: [];
      };
      emoji_catalog: {
        Row: { emoji: string; label: string };
        Insert: { emoji: string; label: string };
        Update: { label?: string };
        Relationships: [];
      };
      tags: {
        Row: { id: string; user_id: string; name: string };
        Insert: { id?: string; user_id: string; name: string };
        Update: { name?: string };
        Relationships: [];
      };
      entry_tags: {
        Row: { entry_id: string; tag_id: string };
        Insert: { entry_id: string; tag_id: string };
        Update: { entry_id?: string; tag_id?: string };
        Relationships: [
          { foreignKeyName: "entry_tags_entry_id_fkey"; columns: ["entry_id"]; isOneToOne: false; referencedRelation: "entries"; referencedColumns: ["id"] },
          { foreignKeyName: "entry_tags_tag_id_fkey"; columns: ["tag_id"]; isOneToOne: false; referencedRelation: "tags"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      read_legacy_journal: { Args: Record<PropertyKey, never>; Returns: Json };
      create_encrypted_vault: { Args: { p_vault_user_id: string; p_config: KeyConfig; p_ciphertext: Envelope; p_fingerprint: string }; Returns: VaultRow[] };
      save_encrypted_vault: { Args: { p_vault_user_id: string; p_expected_revision: number; p_ciphertext: Envelope }; Returns: VaultRow[] };
      rewrap_vault_key: { Args: { p_vault_user_id: string; p_expected_revision: number; p_salt: string; p_wrapped_key: Envelope }; Returns: VaultRow[] };
      finalize_vault_migration: { Args: { p_vault_user_id: string; p_expected_revision: number; p_fingerprint: string }; Returns: VaultRow[] };
      complete_vault_migration: { Args: { p_vault_user_id: string; p_expected_revision: number }; Returns: VaultRow[] };
      claim_weekly_summary: { Args: Record<PropertyKey, never>; Returns: boolean };
      save_mood_entry: { Args: { p_date: string; p_emoji: string; p_note: string; p_tags: string[] }; Returns: string };
      save_journal_entry: { Args: { p_date: string; p_emoji: string | null; p_sticker_id: string | null; p_mood_score: number | null; p_note: string; p_tags: string[] }; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
