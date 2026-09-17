import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { ALICE, BOB, SUPABASE_FIXTURE } from "./supabase-fixture";

let db: PGlite;
let migration: string;
before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_FIXTURE);
  for (const file of ["202609160001_initial_schema.sql", "202609170001_profiles.sql"]) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await db.query("update public.profiles set username = case when id = $1 then 'cosmic_panda' else 'jazzy_otter' end", [ALICE]);
  migration = await readFile("supabase/migrations/202609180003_username_variety.sql", "utf8");
});
after(async () => { await db?.close(); });

test("username migration preserves every existing profile field and can be rerun", async () => {
  const before = (await db.query("select * from public.profiles order by id")).rows;
  await db.exec(migration);
  await db.exec(migration);
  assert.deepEqual((await db.query("select * from public.profiles order by id")).rows, before);
});

test("new signups rotate through 128 prefixes without jazzy/cosmic and produce valid unique names", async () => {
  await db.query("insert into auth.users(id,email) select gen_random_uuid(), 'signup-' || n || '@example.test' from generate_series(1,128) n");
  const result = await db.query<{ username: string }>("select username from public.profiles where email like 'signup-%@example.test'");
  assert.equal(result.rows.length, 128);
  assert.equal(new Set(result.rows.map((row) => row.username)).size, 128);
  assert.equal(new Set(result.rows.map((row) => row.username.split('_')[0])).size, 128);
  for (const { username } of result.rows) {
    assert.match(username, /^[a-z]+_[a-z]+_[a-f0-9]{8}$/);
    assert.ok(username.length <= 32);
    assert.doesNotMatch(username, /^(jazzy|cosmic)/);
  }
  await db.exec(migration); // Rerunning the upgrade must not reset allocation.
  assert.equal((await db.query<{ last_value: number }>("select last_value from public.moodgrid_username_counter")).rows[0].last_value, 128);
  await db.query("insert into auth.users(id,email) values (gen_random_uuid(), 'after-cycle@example.test')");
  assert.match((await db.query<{ username: string }>("select username from public.profiles where email='after-cycle@example.test'")).rows[0].username, /^amber_/);
});

test("returning users keep their old or edited names without advancing the counter", async () => {
  const counter = (await db.query("select last_value from public.moodgrid_username_counter")).rows;
  await db.query("update auth.users set last_sign_in_at = now(), email='returning@example.test' where id = $1", [ALICE]);
  assert.deepEqual((await db.query("select username,email from public.profiles where id=$1", [ALICE])).rows, [{ username: "cosmic_panda", email: "returning@example.test" }]);
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [BOB]);
  try { await db.query("update public.profiles set username='my_chosen_name' where id=$1", [BOB]); }
  finally { await db.exec("reset role"); }
  await db.query("update auth.users set last_sign_in_at=now() where id=$1", [BOB]);
  assert.equal((await db.query<{ username: string }>("select username from public.profiles where id=$1", [BOB])).rows[0].username, "my_chosen_name");
  assert.deepEqual((await db.query("select last_value from public.moodgrid_username_counter")).rows, counter);
});

test("public clients cannot inspect/advance the counter or invoke the profile trigger function", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query("select nextval('public.moodgrid_username_counter')"), /permission denied/);
      await assert.rejects(db.query("select * from public.moodgrid_username_counter"), /permission denied/);
      await assert.rejects(db.query("select public.sync_moodgrid_profile($1,'spoof@example.test',now(),now())", [ALICE]), /permission denied/);
    } finally { await db.exec("reset role"); }
  }
});
