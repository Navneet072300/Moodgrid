# MoodGrid

Next.js 15 App Router, strict TypeScript, Supabase magic-link authentication, Tailwind CSS, Framer Motion, Recharts, and browser-side journal encryption. Deploy-ready on Vercel.

Production origin: `https://www.moodgrid.fun`. The [email setup guide](docs/auth-email-setup.md) lists the matching Supabase redirects and Resend sender domain.

## Run

```sh
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL`. A legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted. Do not replace an existing configured `.env.local`. There is no server encryption key or AI API key. Existing Groq credentials are unused by this version.

`/demo` contains fictional entries and temporary in-memory edits/uploads. It does not persist data or display the encryption-complete badge. Real journals require Supabase plus a separate vault passphrase. Browser encryption requires HTTPS, or localhost for development.

## Database setup and upgrade

Run [`supabase/setup.sql`](supabase/setup.sql) in the project's Supabase SQL editor. It supports a fresh database or the earlier MoodGrid schema and is safe to repeat after a successful run. It does not discard legacy journal data during installation. Alternatively, apply the eight ordered source migrations with the Supabase CLI, reconciling migration history if SQL was previously applied manually. Regenerate the SQL-editor bundle with `python3 scripts/generate-setup.py` after editing source migrations.

The encryption migration is [`202609180001_encrypted_vault.sql`](supabase/migrations/202609180001_encrypted_vault.sql). It requires the preceding profile, emoji, and sticker migrations. Deploy the application and install the database migration together: it deliberately freezes old plaintext writes, and the new application fails closed if encrypted storage is unavailable. An older application version cannot write after this migration is applied.

**Upgrading an existing encrypted installation:** run [`202609180002_sticker_deletion.sql`](supabase/migrations/202609180002_sticker_deletion.sql) in Supabase SQL Editor to enable owner-only deletion of encrypted sticker files. It does not delete existing data. This migration has not been applied to the hosted project by this code change; a Git push does not execute SQL. Without it, removed stickers stay in an encrypted cleanup queue until the policy is installed and cleanup is retried.

## Authentication

In Supabase Authentication, keep Email enabled and allow signup. Set the Site URL to the application origin and allow `/auth/callback` and `/auth/confirm` on localhost and production. Configure custom SMTP before inviting public users: the built-in sender is restricted to team addresses and a small project-wide email quota. See [production email setup](docs/auth-email-setup.md) for the exact configuration and troubleshooting steps.

The Magic Link email template can use:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Open MoodGrid</a>
```

The token-hash route allows opening the link on another device. The PKCE callback also supports Supabase's default flow in the initiating browser. Email login establishes account access; it never supplies the journal's decryption key.

Each account has a private profile with its email and an automatically generated unique username. Users may edit only their own username. Email follows Supabase Auth. User IDs remain stable when usernames change.

## Encryption design

- **Content:** a single encrypted vault document contains all entry dates, emojis, notes, mood scores, timestamps, tags, tag associations, sticker names, original MIME types, and file references. No date or tag search index is stored in plaintext. Filtering, charts, and streaks are computed after local decryption.
- **Algorithms:** Web Crypto AES-256-GCM with a fresh random 96-bit IV and a 128-bit authentication tag for every encryption. Authenticated context binds each message to its account and purpose, and sticker ciphertext to its sticker ID. JSON is length-prefixed and padded to 4 KiB blocks before encryption. Sticker bytes are encrypted separately.
- **Keys:** a random 256-bit data key is wrapped by a key derived from the user's passphrase using PBKDF2-HMAC-SHA-256, 600,000 iterations, and a random 128-bit salt. A separate random 256-bit recovery secret wraps the same data key. Only the wrapped keys, salt, work factor, and ciphertext reach Supabase. Passphrases are 16–256 characters; use a password manager or at least five random words. Length alone does not ensure strength.
- **Recovery:** users must acknowledge saving their generated recovery key before initial migration. Recovery unwraps the existing data key and wraps it under a new passphrase. Email access alone cannot recover a journal. Losing both the passphrase and recovery secret makes the journal unrecoverable. Rewrapping does not revoke a previously stolen data key or old key wrappers.
- **Memory:** unlocked data keys are non-extractable CryptoKey objects held in browser memory. The application never writes passphrases, recovery secrets, decrypted documents, or data keys to cookies, localStorage, sessionStorage, or IndexedDB. Reload, sign-out, account change, manual lock, ten minutes of inactivity, or returning after at least one minute hidden clears application access to keys/data and revokes media object URLs. JavaScript cannot guarantee forensic memory erasure, and browser/password-manager behavior is outside this guarantee.
- **Storage:** `encrypted_vaults` contains only cryptographic envelopes and account/revision/migration metadata. The `moodgrid-vault` bucket is private and stores immutable `application/octet-stream` objects at random paths. Filenames and original file types are inside the encrypted document. RLS and fixed-owner RPC checks remain in place.
- **Concurrency:** every write uses an expected revision and expected account ID; stale saves fail instead of overwriting another tab's journal or another account after an auth switch. Reload/unlock after a conflict. The encrypted JSON document is capped at 8 MiB; each save currently rewrites that document. This is intended for personal journals, not unlimited document storage.
- **External processing:** cloud AI summaries and automatic journal exposure through browser agent tools are removed. Weekly reflection is a local count-based summary, not an LLM. The old summary and plaintext sticker endpoints return HTTP 410. No decrypted journal enters Server Components or Server Actions; the remaining server action edits only the username.
- **Browser policy:** per-response script nonces, a restrictive Content Security Policy, private/no-store responses, and no camera/microphone/geolocation permission. The production script policy excludes unsafe-inline and unsafe-eval. CSS permits inline styles for charts and animation. All pages render dynamically so Next.js can attach request nonces.

Source references: [Web Crypto AES-GCM parameters](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams), [key derivation](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey), [OWASP PBKDF2 guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Next.js nonce CSP](https://nextjs.org/docs/15/app/guides/content-security-policy).

## Existing plaintext migration

1. The signed-in browser reads its own legacy snapshot and creates the user-held encryption keys.
2. Every old sticker file, including unreferenced files in the account's legacy folder, is downloaded to the browser, encrypted, uploaded to the new private bucket, downloaded again, decrypted, and compared byte-for-byte. Original files stay intact if verification fails.
3. The complete journal is encrypted, stored, read back, decrypted, and compared before any plaintext row is removed. A SHA-256 snapshot fingerprint detects legacy changes during migration.
4. A transaction clears only that account's old entries, tags, associations, and sticker metadata. The browser then removes the original objects through the Storage API, not SQL.
5. A completion RPC verifies that legacy rows and storage objects are gone before marking the vault complete. Failed cleanup can be resumed by unlocking again. The app's encryption-complete badge appears only after this stage and successful decryption.

The process is per account and requires the user to choose their own passphrase. Administrators cannot perform this step on the user's behalf while also remaining unable to decrypt. Users who have not completed migration may still have legacy plaintext. Previous backups, exports, logs, or prior AI requests cannot be retroactively encrypted. Operators must audit and expire those copies through the relevant providers' retention controls. Live deletion is not a promise of historical erasure. [Supabase storage deletion](https://supabase.com/docs/guides/storage/management/delete-objects) and [backup behavior](https://supabase.com/docs/guides/platform/backups) describe these separate mechanisms.

Abandoned uploads can leave encrypted orphan objects if a later database write fails. These contain no readable image/filename, but may consume storage. Storage administration can delete such ciphertext. The application does not grant object overwrite permission. The deletion migration grants authenticated owners DELETE access only to their encrypted sticker paths after migration completes.

## Deleting moments and stickers

Use the trash button in Recent moments, or **Delete moment** in a check-in dialog. Deletion rewrites the encrypted vault using its expected revision and removes tags from that moment only if no other entry uses them. Calendar, streaks, insights, and tag suggestions update from the same local state.

Each uploaded sticker has a delete control in the library and picker. Stickers referenced by saved moments cannot be deleted until those moments are changed or removed. An unused sticker is first removed from the encrypted document, with its random file path added to an encrypted cleanup queue. The browser then deletes the object through the Supabase Storage API and verifies its absence. Missing permissions, network errors, or an interrupted follow-up save leave a durable retry queue. Retry in the library or unlock again. Removed previews are revoked from browser memory. Live deletion does not purge historical backups or exports.

## Privacy claim and threat model

The supported claim is **“Journal content is end-to-end encrypted.”** The interface shows it only for unlocked, migrated accounts. The privacy page explains the scope.

This does **not** mean “every database field is encrypted” or “nobody can question security.” Account email/username, IDs, sign-in metadata, network/infrastructure logs, ciphertext sizes, revision counts, and access times remain visible. RLS alone does not protect content from database administrators; encryption provides that protection only while they lack the user's secret.

A database reader without the passphrase/recovery key cannot decrypt properly encrypted journal content. Weak passphrases can be guessed offline from stolen wrappers. An administrator can delete, corrupt, or replay stored ciphertext. A compromised device, browser extension, XSS, or malicious app operator serving modified JavaScript can capture plaintext/keys at unlock. Web-delivered encryption cannot eliminate trust in the code delivered to the user. This implementation has not received an independent cryptographic audit or penetration test. Do not advertise absolute security or historical deletion as verified facts.

## Features

- Daily check-in with 3,963 emoji choices, searchable categories, skin tones/families/flags, optional 280-character notes, eight tags, and sticker selection. One entry per date is maintained inside the encrypted document.
- Private sticker library: PNG/JPG/WebP/GIF/WebM, up to 3 MiB per file and 20 uploads per batch. Export Telegram `.tgs` or messaging-app packs to supported individual files first. Original format validation occurs locally, before encryption.
- Contribution calendar, edit dialogs, and confirmed moment/sticker deletion, all derived locally after unlock.
- Insights presets: 7/14/30/60/90/180 days, one year, all time, or custom inclusive dates. Scores are optional for general emojis and stickers; unscored entries do not distort averages. Long ranges aggregate into bounded chart periods.
- Local weekly reflection. No journal content is sent to an AI service.
- Concise dark interface, responsive filters, keyboard emoji navigation, and animations.

Unicode data and the included [license](licenses/UNICODE-LICENSE.txt) come from [Unicode emoji-test data](https://www.unicode.org/Public/emoji/latest/emoji-test.txt). The bundled version is 18.0, with 3,963 picker choices and 5,235 accepted presentation sequences. Device fonts determine glyph support. To update, use `scripts/generate-emoji-catalog.py` and add a new production migration for already-installed databases.

## Verification and deployment

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Tests cover crypto round-trips, nonce variation, non-extractable keys, wrong secrets, account/purpose binding, tamper rejection, recovery, ciphertext-only storage, RLS, stale-write rejection, migration guards, plaintext-write denial, legacy file cleanup stages, date ranges, and journal calculations. PGlite runs the actual SQL with minimal Supabase Auth/Storage contracts. Legacy schema tests are explicitly run before the encryption migration; a separate suite exercises the transition and final encrypted behavior. Storage test rows simulate the metadata effects of the Storage API; they do not verify actual hosted object deletion.

A browser-driven, multi-device migration/recovery test and independent security review remain necessary before production privacy guarantees. The hosted encryption migration and deletion of old backups are not accomplished by a local build.

To deploy on Vercel, import this directory as a Next.js project, set the public Supabase configuration and `NEXT_PUBLIC_SITE_URL` to the exact HTTPS origin, configure the matching Supabase auth callbacks, and coordinate database migration with the new release. Use Node 22 or newer. Real journals fail closed when the encryption schema is missing. `scripts/verify-supabase.ts` provides a read-only table/Auth connectivity check; it cannot apply migrations or verify private account data with a publishable key.

## Main files

- `src/lib/vault/crypto.ts`: Web Crypto operations and key wrapping.
- `src/lib/vault/store.ts`: browser-only encrypted persistence and verified migration.
- `src/lib/vault/types.ts`: encrypted/document schemas and persistence whitelist.
- `src/components/vault-gate.tsx`: setup, unlock, and recovery.
- `src/components/journal-provider.tsx`: memory-only unlocked state and lock lifecycle.
- `src/lib/queries.ts`: profile-only server query.
- `supabase/migrations/202609180001_encrypted_vault.sql`: encrypted schema and legacy cutoff.
- `src/app/privacy/page.tsx`: user-facing privacy scope and limits.
