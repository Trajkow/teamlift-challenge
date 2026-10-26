import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Parses `CALENDAR_TOKEN_KEY` (32 bytes, base64). Returns null when it is missing or the wrong size. */
export function parseTokenKey(raw: string | undefined): Buffer | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const key = Buffer.from(trimmed, 'base64');
  return key.length === 32 ? key : null;
}

/** AES-256-GCM with a random IV. Output is `iv:tag:ciphertext`, each part base64. */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join(':');
}

/** Throws when the payload is malformed, was tampered with, or the key is wrong. */
export function decrypt(payload: string, key: Buffer): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('malformed encrypted value');
  const [iv, tag, data] = parts.map((p) => Buffer.from(p, 'base64')) as [Buffer, Buffer, Buffer];
  // Pin the tag length: GCM would otherwise accept a truncated tag, which weakens tamper detection.
  if (tag.length !== TAG_BYTES) throw new Error('malformed encrypted value');
  const decipher = createDecipheriv(ALGORITHM, key, iv, {authTagLength: TAG_BYTES});
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
