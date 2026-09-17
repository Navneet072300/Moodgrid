import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createKeys, encryptJSON, decryptJSON, newRecoveryKey, type KeyConfig } from "../src/lib/vault/crypto";
import type { VaultRow } from "../src/lib/vault/types";
import { ALICE, BOB, SUPABASE_FIXTURE } from "./supabase-fixture";
let db: PGlite; let key: CryptoKey; let config: KeyConfig; let fingerprint: string;
const path = `${ALICE}/44444444-4444-4444-8444-444444444444.webp`;
async function asUser(user: string, operation: () => Promise<void>) {
  await db.exec("set role authenticated"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try { await operation(); } finally { await db.exec("reset role"); }
}
async function row(): Promise<VaultRow> { return (await db.query<VaultRow>("select * from public.encrypted_vaults where user_id=$1", [ALICE])).rows[0]; }
before(async () => {
  db = new PGlite(); await db.exec(SUPABASE_FIXTURE);
  for (const file of (await readdir("supabase/migrations")).filter((name) => name.endsWith(".sql") && !name.startsWith("20260918")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await asUser(ALICE, async () => {
    await db.query("select public.save_mood_entry('2026-01-01','😊','private legacy note',array['secret-tag'])");
    await db.query("insert into storage.objects(bucket_id,name) values ('moodgrid-stickers',$1)", [path]);
    await db.query("insert into public.stickers(user_id,name,storage_path,mime_type,size_bytes) values ($1,'private sticker',$2,'image/webp',50)", [ALICE,path]);
  });
  await db.exec(await readFile("supabase/migrations/202609180001_encrypted_vault.sql", "utf8"));
  ({ key, config } = await createKeys("a long unique passphrase for a test", newRecoveryKey(), ALICE));
});
after(async () => { await db?.close(); });

test("encryption migration freezes every legacy write path", async () => {
  await asUser(ALICE, async () => {
    await assert.rejects(db.query("select public.save_mood_entry('2026-01-02','😊','new plaintext',array[]::text[])"), /permission denied/);
    await assert.rejects(db.query("select public.save_journal_entry('2026-01-02','😊',null,4::smallint,'plaintext',array[]::text[])"), /permission denied/);
    await assert.rejects(db.query("insert into public.entries(user_id,date,emoji) values ($1,'2026-01-02','😊')", [ALICE]), /permission denied/);
    await assert.rejects(db.query("insert into public.tags(user_id,name) values ($1,'plaintext')", [ALICE]), /permission denied/);
    await assert.rejects(db.query("update public.stickers set name='plaintext'"), /permission denied/);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('moodgrid-stickers',$1)", [`${ALICE}/new.webp`]), /row-level security/);
    await assert.rejects(db.query("select public.claim_weekly_summary()"), /permission denied/);
  });
});
test("legacy migration snapshots are account-scoped and ciphertext round-trips", async () => {
  await asUser(BOB, async () => {
    const result = (await db.query<{ result: { snapshot: { entries: unknown[] } } }>("select public.read_legacy_journal() as result")).rows[0].result;
    assert.equal(result.snapshot.entries.length, 0);
  });
  await asUser(ALICE, async () => {
    const result = (await db.query<{ result: { fingerprint: string; snapshot: unknown } }>("select public.read_legacy_journal() as result")).rows[0].result;
    fingerprint = result.fingerprint;
    const ciphertext = await encryptJSON(result.snapshot, key, ALICE);
    await assert.rejects(db.query("select public.create_encrypted_vault($1,$2::jsonb,$3::jsonb,'stale')", [ALICE,JSON.stringify(config),JSON.stringify(ciphertext)]), /Legacy journal changed/);
    await db.query("select public.create_encrypted_vault($1,$2::jsonb,$3::jsonb,$4)", [ALICE,JSON.stringify(config),JSON.stringify(ciphertext),fingerprint]);
    const stored = await row();
    assert.equal(stored.migration_stage, "pending");
    assert.deepEqual(await decryptJSON(stored.ciphertext,key,ALICE), result.snapshot);
    assert.equal(JSON.stringify(stored).includes("private legacy note"), false);
    assert.equal(JSON.stringify(stored).includes("secret-tag"), false);
    await assert.rejects(db.query("select public.finalize_vault_migration($1,1,'wrong')", [ALICE]), /Legacy journal changed/);
    assert.equal((await db.query("select * from public.entries")).rows.length,1);
    assert.equal((await db.query("delete from storage.objects where name=$1 returning name", [path])).rows.length,0);
  });
});
test("database readers cannot cross accounts or overwrite vaults directly", async () => {
  await asUser(BOB, async () => {
    assert.equal((await db.query("select * from public.encrypted_vaults")).rows.length,0);
    await assert.rejects(db.query("select public.finalize_vault_migration($1,1,$2)", [ALICE,fingerprint]), /Vault changed/);
    await assert.rejects(db.query("select public.save_encrypted_vault($1,1,$2::jsonb)", [ALICE,JSON.stringify(await encryptJSON({},key,ALICE))]), /Vault changed/);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('moodgrid-vault',$1)", [`${ALICE}/44444444-4444-4444-8444-444444444444.bin`]), /row-level security/);
  });
  await asUser(ALICE, async () => { await assert.rejects(db.query("update public.encrypted_vaults set revision=999"), /permission denied/); });
  await db.exec("set role anon");
  try { await assert.rejects(db.query("select * from public.encrypted_vaults"), /permission denied/); await assert.rejects(db.query("select public.read_legacy_journal()"), /permission denied/); }
  finally { await db.exec("reset role"); }
});
test("migration cannot claim completion before both plaintext rows and files are removed", async () => {
  await asUser(ALICE, async () => {
    await assert.rejects(db.query("select public.complete_vault_migration($1,1)", [ALICE]), /Plaintext cleanup/);
    await db.query("select public.finalize_vault_migration($1,1,$2)", [ALICE,fingerprint]);
    for (const table of ["entries","tags","entry_tags","stickers"]) assert.equal((await db.query(`select * from public.${table}`)).rows.length,0);
    assert.equal((await row()).migration_stage,"files");
    await assert.rejects(db.query("select public.complete_vault_migration($1,2)", [ALICE]), /Plaintext cleanup/);
    // Simulates the metadata removal performed by the Supabase Storage DELETE API.
    await db.query("delete from storage.objects where name=$1", [path]);
    await db.query("select public.complete_vault_migration($1,2)", [ALICE]);
    assert.equal((await row()).migration_stage,"complete");
  });
});
test("encrypted saves use revisions to reject lost updates and malformed envelopes", async () => {
  await asUser(ALICE, async () => {
    const cipher = await encryptJSON({ note: "only the user can decrypt this" },key,ALICE);
    await db.query("select public.save_encrypted_vault($1,3,$2::jsonb)", [ALICE,JSON.stringify(cipher)]);
    await assert.rejects(db.query("select public.save_encrypted_vault($1,3,$2::jsonb)", [ALICE,JSON.stringify(cipher)]), /Vault changed/);
    await assert.rejects(db.query("select public.save_encrypted_vault($1,4,$2::jsonb)", [ALICE,JSON.stringify({ ...cipher, iv: "invalid" })]), /check constraint/);
    assert.equal((await row()).revision,4);
    assert.deepEqual(await decryptJSON((await row()).ciphertext,key,ALICE), { note: "only the user can decrypt this" });
  });
});
