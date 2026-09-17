import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createKeys, decryptJSON, encryptJSON, fromBase64, newRecoveryKey, open, recoverKey, seal, toBase64, unlockKey, type KeyConfig } from "../src/lib/vault/crypto";
import { documentForStorage } from "../src/lib/vault/types";
import { ALICE, BOB } from "./supabase-fixture";
const password = "five unique words from my password-manager";
let key: CryptoKey;
let config: KeyConfig;
let recovery: string;
before(async () => { recovery = newRecoveryKey(); ({ key, config } = await createKeys(password, recovery, ALICE)); });

test("encrypted journal hides content and produces fresh nonces", async () => {
  const original = { date: "2026-09-17", emoji: "😤", note: "private work frustration", tags: ["confidential"], score: 2, sticker: "private-cat.webp" };
  const first = await encryptJSON(original, key, ALICE);
  const second = await encryptJSON(original, key, ALICE);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.data, second.data);
  for (const value of Object.values(original).flat().filter((value) => typeof value === "string" && value.length > 4)) assert.equal(JSON.stringify(first).includes(String(value)), false);
  assert.deepEqual(await decryptJSON(first, key, ALICE), original);
  assert.equal(fromBase64(first.data).length, 4096 + 16);
  assert.equal(key.extractable, false);
  await assert.rejects(crypto.subtle.exportKey("raw", key));
});
test("wrong passphrases, foreign accounts and modified ciphertext fail authentication", async () => {
  await assert.rejects(unlockKey(config, "not the right passphrase", ALICE));
  await assert.rejects(unlockKey(config, password, BOB));
  const ciphertext = await encryptJSON({ note: "private" }, key, ALICE);
  await assert.rejects(decryptJSON(ciphertext, key, BOB));
  const modified = fromBase64(ciphertext.data); modified[7] ^= 1;
  await assert.rejects(decryptJSON({ ...ciphertext, data: toBase64(modified) }, key, ALICE));
  await assert.rejects(unlockKey({ ...config, iterations: 1 }, password, ALICE));
});
test("recovery changes the passphrase without changing the data key", async () => {
  const original = await encryptJSON({ text: "keep this memory" }, key, ALICE);
  const updated = await recoverKey(config, recovery, "a different long unique passphrase", ALICE);
  assert.deepEqual(await decryptJSON(original, updated.key, ALICE), { text: "keep this memory" });
  assert.deepEqual(await decryptJSON(original, await unlockKey(updated.config, "a different long unique passphrase", ALICE), ALICE), { text: "keep this memory" });
  await assert.rejects(unlockKey(updated.config, password, ALICE));
  await assert.rejects(recoverKey(config, newRecoveryKey(), "a different long unique passphrase", ALICE));
  assert.equal(updated.key.extractable, false);
});
test("sticker encryption authenticates file identity and preserves binary bytes", async () => {
  const bytes = Uint8Array.from({ length: 50_000 }, (_, index) => index % 256);
  const ciphertext = await seal(bytes, key, ALICE, "sticker:cat");
  assert.deepEqual(await open(ciphertext, key, ALICE, "sticker:cat"), bytes);
  await assert.rejects(open(ciphertext, key, ALICE, "sticker:dog"));
  await assert.rejects(open(ciphertext, key, ALICE, "journal"));
});
test("stored documents exclude browser preview URLs and duplicated hydrated media", () => {
  const sticker = { id: "44444444-4444-4444-8444-444444444444", user_id: ALICE, name: "cat", storage_path: `${ALICE}/cipher.bin`, mime_type: "image/png", size_bytes: 10, created_at: "2026-01-01", preview_url: "blob:private-memory" };
  const document = documentForStorage({ version: 1, stickers: [sticker], tags: [], entries: [{ id: "entry", user_id: ALICE, date: "2026-01-01", emoji: null, sticker_id: sticker.id, sticker, note: "private", created_at: "2026-01-01", tags: [] }], migration: { fingerprint: "hash", legacyPaths: [] } });
  assert.equal(JSON.stringify(document).includes("blob:"), false);
  assert.equal("sticker" in document.entries[0], false);
});
