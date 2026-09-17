import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { MOODS } from "../src/lib/moods";

import { ALICE, BOB, SUPABASE_FIXTURE } from "./supabase-fixture";
let db: PGlite;
let aliceEntry: string;
let bobEntry: string;
let bobTag: string;


async function asUser(userId: string, operation: () => Promise<void>) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  try { await operation(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
}
async function save(date: string, emoji: string, note: string, tags: string[]) {
  const result = await db.query<{ id: string }>("select public.save_mood_entry($1::date, $2, $3, $4::text[]) as id", [date, emoji, note, tags]);
  return result.rows[0].id;
}
before(async () => {
  db = new PGlite();
  // Legacy behavior before the encryption migration; encryption transitions have their own suite.
  await db.exec(SUPABASE_FIXTURE);
  for (const file of (await readdir("supabase/migrations")).filter((name) => name.endsWith(".sql") && !name.startsWith("20260918")).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await asUser(ALICE, async () => { aliceEntry = await save("2026-01-01", "😊", "Alice private note", ["work"]); });
  await asUser(BOB, async () => {
    bobEntry = await save("2026-01-01", "😌", "Bob private note", ["home"]);
    bobTag = (await db.query<{ id: string }>("select id from public.tags where name = 'home'")).rows[0].id;
  });
});
after(async () => { await db?.close(); });

test("RLS hides other users' entries, tags and links", async () => {
  await asUser(ALICE, async () => {
    const entries = await db.query<{ user_id: string; note: string }>("select user_id, note from public.entries");
    assert.equal(entries.rows.length, 1);
    assert.equal(entries.rows[0].user_id, ALICE);
    assert.equal((await db.query("select * from public.tags where id = $1", [bobTag])).rows.length, 0);
    assert.equal((await db.query("select * from public.entry_tags where entry_id = $1", [bobEntry])).rows.length, 0);
    assert.equal((await db.query("update public.entries set note = 'stolen' where id = $1 returning id", [bobEntry])).rows.length, 0);
    assert.equal((await db.query("delete from public.entries where id = $1 returning id", [bobEntry])).rows.length, 0);
  });
});
test("RLS rejects spoofed owners and cross-owner tag links", async () => {
  await asUser(ALICE, async () => {
    await assert.rejects(db.query("insert into public.entries(user_id,date,emoji) values ($1,'2026-01-02','😊')", [BOB]), /row-level security/);
    await assert.rejects(db.query("insert into public.entry_tags(entry_id,tag_id) values ($1,$2)", [aliceEntry, bobTag]), /row-level security/);
    await assert.rejects(db.query("update public.entries set user_id = $1 where id = $2", [BOB, aliceEntry]), /row-level security|permission denied/);
  });
});
test("same-day save updates one row and replaces links atomically", async () => {
  await asUser(ALICE, async () => {
    const id = await save("2026-01-01", "🥰", "Updated note", ["Family", "family"]);
    assert.equal(id, aliceEntry);
    const rows = await db.query<{ emoji: string }>("select emoji from public.entries where date = '2026-01-01'");
    assert.equal(rows.rows.length, 1); assert.equal(rows.rows[0].emoji, "🥰");
    const links = await db.query<{ name: string }>("select t.name from public.entry_tags et join public.tags t on et.tag_id = t.id where et.entry_id = $1", [id]);
    assert.deepEqual(links.rows, [{ name: "family" }]);
    await assert.rejects(save("2026-01-01", "😢", "Must roll back", ["x".repeat(25)]), /Invalid tag/);
    const preserved = await db.query<{ note: string }>("select note from public.entries where id = $1", [id]);
    assert.equal(preserved.rows[0].note, "Updated note");
    assert.equal((await db.query("select * from public.entry_tags where entry_id = $1", [id])).rows.length, 1);
  });
});
test("database constraints reject duplicates, unknown emoji and long notes", async () => {
  await asUser(ALICE, async () => {
    await assert.rejects(db.query("insert into public.entries(user_id,date,emoji) values ($1,'2026-01-01','😊')", [ALICE]), /unique constraint/);
    await assert.rejects(save("2026-01-02", "not-emoji", "", []), /foreign key constraint/);
    await assert.rejects(save("2026-01-02", "😊", "a".repeat(281), []), /check constraint/);
    assert.ok(await save("2026-01-02", "😊", "🙂".repeat(280), []));
    await assert.rejects(save("2099-01-01", "😊", "", []), /Future entries/);
  });
});
test("every UI mood is supported by the database constraint", async () => {
  await asUser(BOB, async () => {
    for (const mood of MOODS) assert.ok(await save("2026-01-02", mood.emoji, "", []));
  });
});
test("summary cooldown persists per user and cannot be cleared by clients", async () => {
  await asUser(ALICE, async () => {
    assert.equal((await db.query<{ allowed: boolean }>("select public.claim_weekly_summary() as allowed")).rows[0].allowed, true);
    assert.equal((await db.query<{ allowed: boolean }>("select public.claim_weekly_summary() as allowed")).rows[0].allowed, false);
    await assert.rejects(db.query("delete from public.summary_rate_limits"), /permission denied/);
  });
  await asUser(BOB, async () => {
    assert.equal((await db.query<{ allowed: boolean }>("select public.claim_weekly_summary() as allowed")).rows[0].allowed, true);
  });
});
test("anonymous clients cannot read data or invoke write functions", async () => {
  await db.exec("set role anon");
  try {
    await assert.rejects(db.query("select * from public.entries"), /permission denied/);
    await assert.rejects(save("2026-01-03", "😊", "", []), /permission denied/);
    await assert.rejects(db.query("select public.claim_weekly_summary()"), /permission denied/);
  } finally { await db.exec("reset role"); }
});

test("existing and new accounts get private profiles with editable unique usernames", async () => {
  const profiles = await db.query<{ id: string; email: string; username: string }>("select id,email,username from public.profiles order by id");
  assert.equal(profiles.rows.length, 2);
  assert.equal(profiles.rows[0].email, "alice@example.test");
  assert.match(profiles.rows[0].username, /^[a-z]+_[a-z]+_[a-f0-9]{8}$/);
  await asUser(ALICE, async () => {
    assert.equal((await db.query("select * from public.profiles")).rows.length, 1);
    await db.query("update public.profiles set username = 'cosmic_panda' where id = $1", [ALICE]);
    await assert.rejects(db.query("update public.profiles set email = 'spoof@example.test' where id = $1", [ALICE]), /permission denied/);
    await assert.rejects(db.query("update public.profiles set username = 'Bad Name' where id = $1", [ALICE]), /check constraint/);
    assert.equal((await db.query("update public.profiles set username = 'other_account' where id = $1 returning id", [BOB])).rows.length, 0);
  });
  await asUser(BOB, async () => {
    await assert.rejects(db.query("update public.profiles set username = 'cosmic_panda' where id = $1", [BOB]), /unique constraint/);
  });
  await db.query("update auth.users set email = 'new-alice@example.test', last_sign_in_at = now() where id = $1", [ALICE]);
  const updated = (await db.query<{ email: string; username: string }>("select email,username from public.profiles where id = $1", [ALICE])).rows[0];
  assert.deepEqual(updated, { email: "new-alice@example.test", username: "cosmic_panda" });
  const userId = "33333333-3333-4333-8333-333333333333";
  await db.query("insert into auth.users(id,email) values ($1,'new@example.test')", [userId]);
  assert.equal((await db.query("select * from public.profiles where id = $1", [userId])).rows.length, 1);
});

test("expanded emoji catalog accepts flags, skin tones and non-mood emojis", async () => {
  const count = (await db.query<{ count: number }>("select count(*)::int as count from public.emoji_catalog")).rows[0].count;
  assert.ok(count > 5000);
  await asUser(ALICE, async () => {
    for (const emoji of ["💻", "🍕", "🇮🇳", "🧑🏽‍💻", "👨‍👩‍👧‍👦", "❤"]) assert.ok(await save("2026-01-05", emoji, "", []));
    await assert.rejects(db.query("insert into public.emoji_catalog values ('fake','fake')"), /permission denied/);
  });
});

test("stickers and storage objects remain owned by one account", async () => {
  const stickerId = "44444444-4444-4444-8444-444444444444";
  const path = `${ALICE}/${stickerId}.webp`;
  await asUser(ALICE, async () => {
    await db.query("insert into storage.objects(bucket_id,name) values ('moodgrid-stickers',$1)", [path]);
    await db.query("insert into public.stickers(id,user_id,name,storage_path,mime_type,size_bytes) values ($1,$2,'Happy cat',$3,'image/webp',100)", [stickerId,ALICE,path]);
    await db.query("select public.save_journal_entry('2026-01-06',null,$1,4::smallint,'Cat day',array['cats'])", [stickerId]);
    await assert.rejects(db.query("delete from public.stickers where id = $1", [stickerId]), /foreign key constraint/);
    assert.equal((await db.query("delete from storage.objects where name = $1 returning name", [path])).rows.length, 0);
    await assert.rejects(db.query("select public.save_journal_entry('2026-01-06','😊',$1,4::smallint,'',array[]::text[])", [stickerId]), /check constraint/);
  });
  await asUser(BOB, async () => {
    assert.equal((await db.query("select * from public.stickers where id = $1", [stickerId])).rows.length, 0);
    assert.equal((await db.query("select * from storage.objects where name = $1", [path])).rows.length, 0);
    await assert.rejects(db.query("select public.save_journal_entry('2026-01-06',null,$1,3::smallint,'',array[]::text[])", [stickerId]), /Sticker is not in your library/);
    await assert.rejects(db.query("insert into public.entries(user_id,date,sticker_id) values ($1,'2026-01-06',$2)", [BOB,stickerId]), /foreign key constraint/);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('moodgrid-stickers',$1)", [`${ALICE}/fake.webp`]), /row-level security/);
  });
});


test("SQL-editor setup safely upgrades existing accounts and can be rerun", async () => {
  const upgrade = new PGlite();
  try {
    await upgrade.exec(SUPABASE_FIXTURE);
    await upgrade.exec(await readFile("supabase/migrations/202609160001_initial_schema.sql", "utf8"));
    await upgrade.query("insert into public.entries(user_id,date,emoji,note) values ($1,'2026-01-01','😊','Keep my memory')", [ALICE]);
    const setup = await readFile("supabase/setup.sql", "utf8");
    await upgrade.exec(setup);
    const profile = (await upgrade.query<{ username: string }>("select username from public.profiles where id = $1", [ALICE])).rows[0];
    assert.ok(profile.username);
    await upgrade.exec(setup);
    assert.equal((await upgrade.query<{ username: string }>("select username from public.profiles where id = $1", [ALICE])).rows[0].username, profile.username);
    assert.deepEqual((await upgrade.query<{ note: string; mood_score: number }>("select note,mood_score from public.entries where user_id = $1", [ALICE])).rows, [{ note: "Keep my memory", mood_score: 5 }]);
    assert.equal((await upgrade.query("select * from public.profiles")).rows.length, 2);
    assert.equal((await upgrade.query<{ public: boolean }>("select public from storage.buckets where id = 'moodgrid-stickers'")).rows[0].public, false);
  } finally { await upgrade.close(); }
});
test("SQL-editor setup bootstraps a fresh database", async () => {
  const fresh = new PGlite();
  try {
    await fresh.exec(SUPABASE_FIXTURE);
    await fresh.exec(await readFile("supabase/setup.sql", "utf8"));
    assert.equal((await fresh.query("select * from public.profiles")).rows.length, 2);
    assert.ok((await fresh.query<{ count: number }>("select count(*)::int as count from public.emoji_catalog")).rows[0].count > 5000);
  } finally { await fresh.close(); }
});
