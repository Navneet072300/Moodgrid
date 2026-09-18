import test from "node:test";
import assert from "node:assert/strict";
import { initializeVault, persistVault, unlockVault, recoverVault, deleteVaultEntry, deleteVaultSticker, cleanupDeletedStickers } from "../src/lib/vault/store";
import { decryptJSON, newRecoveryKey, type Envelope, type KeyConfig } from "../src/lib/vault/crypto";
import type { VaultDocument, VaultRow } from "../src/lib/vault/types";
import { ALICE, BOB } from "./supabase-fixture";

// Exercise the real Supabase JS request/response layer without a hosted account.
// SQL permissions/transactions are covered separately with actual Postgres migrations.
function backend(corruptDownload = false) {
  const savedFetch = globalThis.fetch;
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://vault-test.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-public-key";
  const bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,1,2,3,4]);
  const legacyPath = `${ALICE}/44444444-4444-4444-8444-444444444444.png`;
  const snapshot = {
    entries: [{ id: "entry-1", user_id: ALICE, date: "2026-01-01", emoji: "😤", sticker_id: null, mood_score: 2, note: "secret migration note", created_at: "2026-01-01T12:00:00Z" }],
    tags: [{ id: "tag-1", name: "private-tag" }], links: [{ entry_id: "entry-1", tag_id: "tag-1" }],
    stickers: [{ id: "44444444-4444-4444-8444-444444444444", user_id: ALICE, name: "private sticker name", storage_path: legacyPath, mime_type: "image/png", size_bytes: bytes.length, created_at: "2026-01-01T12:00:00Z" }],
    files: [legacyPath],
  };
  let row: VaultRow | null = null;
  let plaintextRemoved = false;
  let legacyFileRemoved = false;
  const files = new Map<string, string>();
  const outgoing: string[] = [];
  const events: string[] = [];
  const failures = { denyDeletes: false, failDeletes: false, saveAtRevision: -1 };
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path === "/rest/v1/encrypted_vaults") return json(row ? [row] : []);
    if (path.startsWith("/rest/v1/rpc/")) {
      const rpc = path.split("/").at(-1);
      const body = await request.json() as { p_config?: KeyConfig; p_ciphertext?: Envelope; p_expected_revision?: number; p_salt?: string; p_wrapped_key?: Envelope };
      outgoing.push(JSON.stringify(body)); events.push(String(rpc));
      if (rpc === "read_legacy_journal") return json({ snapshot, fingerprint: "test-fingerprint" });
      assert.equal(request.headers.get("accept"), "application/vnd.pgrst.object+json", "Composite RPCs request singular records");
      if (rpc === "create_encrypted_vault") {
        assert.ok(body.p_config && body.p_ciphertext);
        row = { ...body.p_config, ciphertext: body.p_ciphertext, user_id: ALICE, revision: 1, migration_stage: "pending" };
      } else {
        assert.ok(row);
        if (body.p_expected_revision !== row.revision) return json({ message: "Vault changed", code: "P0001" }, 400);
        if (rpc === "save_encrypted_vault" && row.revision === failures.saveAtRevision) return json({ message: "Interrupted save", code: "P0001" }, 400);
        if (rpc === "finalize_vault_migration") { row.migration_stage = "files"; plaintextRemoved = true; }
        if (rpc === "complete_vault_migration") { assert.ok(legacyFileRemoved); row.migration_stage = "complete"; }
        if (rpc === "save_encrypted_vault") { assert.ok(body.p_ciphertext); row.ciphertext = body.p_ciphertext; }
        if (rpc === "rewrap_vault_key") { assert.ok(body.p_salt && body.p_wrapped_key); row.salt = body.p_salt; row.wrapped_key = body.p_wrapped_key; }
        row.revision++;
      }
      return json(row);
    }
    if (path === "/storage/v1/object/list/moodgrid-vault" && request.method === "POST") {
      const body = await request.json() as { prefix: string; search: string };
      events.push("encrypted-file-list");
      return json([...files.keys()].filter((key) => key.startsWith(`moodgrid-vault/${body.prefix}`)).map((key) => ({ name: key.split("/").at(-1) })).filter((file) => file.name?.includes(body.search)));
    }
    if (path === "/storage/v1/object/moodgrid-vault" && request.method === "DELETE") {
      events.push("encrypted-file-delete");
      if (failures.failDeletes) return json({ message: "Unavailable", statusCode: "503", error: "Unavailable" }, 503);
      if (failures.denyDeletes) return json([]);
      const body = await request.json() as { prefixes: string[] };
      const removed = body.prefixes.filter((name) => files.delete(`moodgrid-vault/${name}`)).map((name) => ({ name }));
      return json(removed);
    }
    if (path.includes("/object/") && request.method === "POST") {
      const raw = await request.clone().text();
      const body = await request.formData();
      const uploaded = body.get(""); assert.ok(uploaded instanceof Blob);
      const text = await uploaded.text(); outgoing.push(raw); events.push("encrypted-upload");
      files.set(path.slice(path.indexOf("moodgrid-vault/")), text);
      return json({ Key: path, Id: "stored-id" });
    }
    if (path.includes("/object/") && request.method === "GET") {
      if (path.includes("moodgrid-stickers/")) return new Response(bytes, { headers: { "Content-Type": "image/png" } });
      const body = files.get(path.slice(path.indexOf("moodgrid-vault/")));
      assert.ok(body); events.push("encrypted-readback");
      const envelope = JSON.parse(body) as Envelope;
      if (corruptDownload) envelope.iv = "AAAAAAAAAAAAAAAA";
      return new Response(JSON.stringify(envelope), { headers: { "Content-Type": "application/octet-stream" } });
    }
    if (path.includes("/object/moodgrid-stickers") && request.method === "DELETE") {
      assert.ok(plaintextRemoved); legacyFileRemoved = true; events.push("legacy-file-delete"); return json([]);
    }
    throw new Error(`Unexpected test request: ${request.method} ${path}`);
  };
  return {
    events, outgoing, failures, getRow: () => row, fileCount: () => files.size,
    removed: () => plaintextRemoved || legacyFileRemoved,
    restore() { globalThis.fetch = savedFetch; if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl; if (savedKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = savedKey; },
  };
}
test("browser store migrates, saves, unlocks and recovers using ciphertext-only outbound content", async () => {
  const mock = backend();
  const passphrase = "unique browser-store test passphrase";
  const recovery = newRecoveryKey();
  try {
    const vault = await initializeVault(ALICE, passphrase, recovery, () => {});
    assert.equal(vault.row.migration_stage, "complete");
    assert.equal(vault.document.entries[0].note, "secret migration note");
    assert.equal(vault.document.entries[0].tags[0].name, "private-tag");
    assert.ok(mock.events.indexOf("encrypted-readback") < mock.events.indexOf("finalize_vault_migration"));
    assert.ok(mock.events.indexOf("legacy-file-delete") < mock.events.indexOf("complete_vault_migration"));
    const saved = await persistVault(vault, { ...vault.document, entries: vault.document.entries.map((entry) => ({ ...entry, note: "new secret note" })) });
    const unlocked = await unlockVault(saved.row, passphrase, () => {});
    assert.equal(unlocked.document.entries[0].note, "new secret note");
    await assert.rejects(persistVault(vault, vault.document), /vault changed|connection failed/i);
    const recovered = await recoverVault(saved.row, recovery, "another unique test passphrase", () => {});
    assert.equal((await decryptJSON(recovered.row.ciphertext, recovered.key, ALICE) as { entries: { note: string }[] }).entries[0].note, "new secret note");
    for (const secret of [passphrase, recovery, "secret migration note", "new secret note", "private-tag", "private sticker name", "2026-01-01"]) assert.equal(mock.outgoing.some((body) => body.includes(secret)), false, `Outbound request leaked ${secret}`);
  } finally { mock.restore(); }
});
test("corrupt stored sticker ciphertext stops migration before any plaintext deletion", async () => {
  const mock = backend(true);
  try {
    await assert.rejects(initializeVault(ALICE, "unique browser-store test passphrase", newRecoveryKey(), () => {}), { name: "OperationError" });
    assert.equal(mock.removed(), false);
    assert.equal(mock.getRow(), null);
    assert.equal(mock.events.includes("finalize_vault_migration"), false);
  } finally { mock.restore(); }
});

test("moment deletion persists encrypted content and removes only unused tags of that moment", async () => {
  const mock = backend();
  const passphrase = "a deletion test with a long passphrase";
  try {
    let vault = await initializeVault(ALICE, passphrase, newRecoveryKey(), () => {});
    const shared = { id: "shared", name: "shared-tag" };
    const independent = { id: "unused-library-tag", name: "keep-me" };
    const first = vault.document.entries[0];
    vault = await persistVault(vault, { ...vault.document, entries: [{ ...first, tags: [...first.tags, shared] }, { ...first, id: "other-entry", date: "2026-01-02", note: "another private note", tags: [shared] }], tags: [...vault.document.tags, shared, independent] });
    const result = await deleteVaultEntry(vault, first.id);
    const reloaded = await unlockVault(result.row, passphrase, () => {});
    assert.deepEqual(reloaded.document.entries.map((entry) => entry.id), ["other-entry"]);
    assert.deepEqual(reloaded.document.tags, [shared, independent]);
    assert.equal(reloaded.document.stickers.length, 1);
    assert.equal(mock.events.includes("encrypted-file-delete"), false);
    for (const secret of ["secret migration note", "another private note", "shared-tag"]) assert.equal(mock.outgoing.some((body) => body.includes(secret)), false);
  } finally { mock.restore(); }
});

test("sticker removal commits encrypted references before deleting the Storage object", async () => {
  const mock = backend();
  try {
    const vault = await initializeVault(ALICE, "a deletion test with a long passphrase", newRecoveryKey(), () => {});
    mock.events.length = 0;
    const result = await deleteVaultSticker(vault, vault.document.stickers[0].id);
    assert.deepEqual(mock.events, ["save_encrypted_vault", "encrypted-file-delete", "encrypted-file-list", "save_encrypted_vault"]);
    assert.equal(mock.fileCount(), 0);
    assert.equal(result.document.stickers.length, 0);
    assert.deepEqual(result.document.pendingStickerDeletes, []);
    const stored = await decryptJSON(result.row.ciphertext, result.key, ALICE) as VaultDocument;
    assert.equal(stored.stickers.length, 0);
    assert.deepEqual(stored.entries, vault.document.entries);
  } finally { mock.restore(); }
});

test("used stickers and stale revisions never reach physical deletion", async () => {
  const mock = backend();
  try {
    const vault = await initializeVault(ALICE, "a deletion test with a long passphrase", newRecoveryKey(), () => {});
    const id = vault.document.stickers[0].id;
    const current = await persistVault(vault, { ...vault.document, entries: vault.document.entries.map((entry) => ({ ...entry, emoji: null, sticker_id: id })) });
    await assert.rejects(deleteVaultSticker(current, id), /Used in 1 moment/);
    await assert.rejects(deleteVaultSticker(vault, id), /vault changed|connection failed/i);
    assert.equal(mock.events.includes("encrypted-file-delete"), false);
    assert.equal(mock.fileCount(), 1);
  } finally { mock.restore(); }
});

test("silent Storage denial leaves an encrypted retry queue that survives unlock", async () => {
  const mock = backend();
  const passphrase = "a deletion test with a long passphrase";
  try {
    const vault = await initializeVault(ALICE, passphrase, newRecoveryKey(), () => {});
    const sticker = vault.document.stickers[0];
    mock.failures.denyDeletes = true;
    const pending = await deleteVaultSticker(vault, sticker.id);
    assert.equal(mock.fileCount(), 1);
    assert.deepEqual(pending.document.pendingStickerDeletes, [sticker.storage_path]);
    const unlocked = await unlockVault(pending.row, passphrase, () => {});
    assert.equal(unlocked.document.stickers.length, 0);
    mock.failures.denyDeletes = false;
    mock.failures.failDeletes = true;
    assert.deepEqual((await cleanupDeletedStickers(unlocked)).document.pendingStickerDeletes, [sticker.storage_path]);
    mock.failures.failDeletes = false;
    const cleaned = await cleanupDeletedStickers(unlocked);
    assert.equal(mock.fileCount(), 0);
    assert.deepEqual(cleaned.document.pendingStickerDeletes, []);
  } finally { mock.restore(); }
});

test("cleanup is idempotent when the file was removed but the final save was interrupted", async () => {
  const mock = backend();
  const passphrase = "a deletion test with a long passphrase";
  try {
    const vault = await initializeVault(ALICE, passphrase, newRecoveryKey(), () => {});
    mock.failures.saveAtRevision = vault.row.revision + 1;
    const pending = await deleteVaultSticker(vault, vault.document.stickers[0].id);
    assert.equal(mock.fileCount(), 0);
    assert.equal(pending.document.pendingStickerDeletes?.length, 1);
    const unlocked = await unlockVault(pending.row, passphrase, () => {});
    mock.failures.saveAtRevision = -1;
    assert.deepEqual((await cleanupDeletedStickers(unlocked)).document.pendingStickerDeletes, []);
  } finally { mock.restore(); }
});

test("cleanup refuses foreign paths or objects still in the active library", async () => {
  const mock = backend();
  try {
    const vault = await initializeVault(ALICE, "a deletion test with a long passphrase", newRecoveryKey(), () => {});
    for (const path of [`${BOB}/44444444-4444-4444-8444-444444444444.bin`, `${ALICE}/../private.bin`, vault.document.stickers[0].storage_path]) {
      await assert.rejects(cleanupDeletedStickers({ ...vault, document: { ...vault.document, pendingStickerDeletes: [path] } }), /ownership verification/);
    }
    assert.equal(mock.events.includes("encrypted-file-delete"), false);
  } finally { mock.restore(); }
});

test("streak popup dismissals survive encrypted saves and unlock without leaking dates", async () => {
  const mock = backend();
  const passphrase = "a streak notice test with a long passphrase";
  try {
    const vault = await initializeVault(ALICE, passphrase, newRecoveryKey(), () => {});
    const receipts = ["break:2026-09-16", "milestone:2026-01-01:50"];
    const saved = await persistVault(vault, { ...vault.document, seenStreakEvents: receipts });
    const unlocked = await unlockVault(saved.row, passphrase, () => {});
    assert.deepEqual(unlocked.document.seenStreakEvents, receipts);
    const deleted = await deleteVaultEntry(unlocked, unlocked.document.entries[0].id);
    assert.deepEqual(deleted.document.seenStreakEvents, receipts);
    for (const secret of [...receipts, "2026-09-16"]) assert.equal(mock.outgoing.some((body) => body.includes(secret)), false);
  } finally { mock.restore(); }
});
