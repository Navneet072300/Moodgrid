// This module uses Web Crypto only. Never send keys or passphrases to a server.
export const KDF_ITERATIONS = 600_000;
export type Envelope = { v: 1; iv: string; data: string };
export type KeyConfig = { salt: string; iterations: number; wrapped_key: Envelope; recovery_wrapped_key: Envelope };
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
function context(user: string, purpose: string) { return encoder.encode(`moodgrid:v1:${user}:${purpose}`); }
async function aesKey(raw: Uint8Array<ArrayBuffer>) { return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]); }
async function passphraseKey(passphrase: string, salt: string, iterations: number) {
  if (iterations !== KDF_ITERATIONS || fromBase64(salt).length !== 16) throw new Error("Unsupported vault key settings.");
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: fromBase64(salt), iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function seal(bytes: Uint8Array<ArrayBuffer>, key: CryptoKey, user: string, purpose: string): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: context(user, purpose), tagLength: 128 }, key, bytes);
  return { v: 1, iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}
export async function open(envelope: Envelope, key: CryptoKey, user: string, purpose: string): Promise<Uint8Array<ArrayBuffer>> {
  if (envelope.v !== 1 || fromBase64(envelope.iv).length !== 12) throw new Error("Unsupported encrypted data.");
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv), additionalData: context(user, purpose), tagLength: 128 }, key, fromBase64(envelope.data)));
}
export async function encryptJSON(value: unknown, key: CryptoKey, user: string): Promise<Envelope> {
  const data = encoder.encode(JSON.stringify(value));
  if (data.length > 8 * 1024 * 1024) throw new Error("This vault has reached its 8 MB journal limit.");
  // Store the length inside the encryption and pad to 4 KiB blocks.
  const padded = new Uint8Array(Math.ceil((data.length + 4) / 4096) * 4096);
  new DataView(padded.buffer).setUint32(0, data.length);
  padded.set(data, 4);
  return seal(padded, key, user, "journal");
}
export async function decryptJSON(envelope: Envelope, key: CryptoKey, user: string): Promise<unknown> {
  const padded = await open(envelope, key, user, "journal");
  const length = new DataView(padded.buffer).getUint32(0);
  if (length > padded.length - 4) throw new Error("Invalid vault data.");
  return JSON.parse(decoder.decode(padded.subarray(4, 4 + length))) as unknown;
}
export function newRecoveryKey(): string {
  return `MG1-${toBase64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
function recoveryBytes(recovery: string): Uint8Array<ArrayBuffer> {
  if (!/^MG1-[A-Za-z0-9_-]{43}$/.test(recovery.trim())) throw new Error("Enter your complete recovery key.");
  const bytes = fromBase64(recovery.trim().slice(4).replace(/-/g, "+").replace(/_/g, "/") + "=");
  if (bytes.length !== 32) throw new Error("Invalid recovery key.");
  return bytes;
}
export function validatePassphrase(passphrase: string): void {
  if (passphrase.length < 16 || passphrase.length > 256) throw new Error("Use a unique passphrase of 16–256 characters, ideally five or more random words.");
}
export async function createKeys(passphrase: string, recovery: string, user: string): Promise<{ key: CryptoKey; config: KeyConfig }> {
  validatePassphrase(passphrase);
  const raw = crypto.getRandomValues(new Uint8Array(32));
  try {
    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const wrapping = await passphraseKey(passphrase, salt, KDF_ITERATIONS);
    const recoveryKey = await aesKey(recoveryBytes(recovery));
    const wrapped_key = await seal(raw, wrapping, user, "passphrase-key");
    const recovery_wrapped_key = await seal(raw, recoveryKey, user, "recovery-key");
    return { key: await aesKey(raw), config: { salt, iterations: KDF_ITERATIONS, wrapped_key, recovery_wrapped_key } };
  } finally { raw.fill(0); }
}
export async function unlockKey(config: KeyConfig, passphrase: string, user: string): Promise<CryptoKey> {
  const wrapping = await passphraseKey(passphrase, config.salt, config.iterations);
  const raw = await open(config.wrapped_key, wrapping, user, "passphrase-key");
  try { return await aesKey(raw); } finally { raw.fill(0); }
}
export async function recoverKey(config: KeyConfig, recovery: string, newPassphrase: string, user: string): Promise<{ key: CryptoKey; config: KeyConfig }> {
  validatePassphrase(newPassphrase);
  const raw = await open(config.recovery_wrapped_key, await aesKey(recoveryBytes(recovery)), user, "recovery-key");
  try {
    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const wrapping = await passphraseKey(newPassphrase, salt, KDF_ITERATIONS);
    return { key: await aesKey(raw), config: { ...config, salt, iterations: KDF_ITERATIONS, wrapped_key: await seal(raw, wrapping, user, "passphrase-key") } };
  } finally { raw.fill(0); }
}
