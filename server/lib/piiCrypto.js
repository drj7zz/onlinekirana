/**
 * AES-256-GCM encryption at rest for PII (phone numbers, street addresses).
 *
 * Stored shape: `v1:<iv hex>:<tag hex>:<ciphertext hex>` — the version prefix
 * lets us rotate the key later without re-encrypting everything in one go.
 *
 * Config: PII_ENCRYPTION_KEY (64 hex chars = 32 bytes). If the key is missing,
 * values pass through UNENCRYPTED but a loud warning is printed once, so a
 * misconfigured deploy degrades instead of crashing every write.
 */
const crypto = require('crypto');

const KEY_HEX = process.env.PII_ENCRYPTION_KEY || '';
const KEY = /^[0-9a-f]{64}$/i.test(KEY_HEX) ? Buffer.from(KEY_HEX, 'hex') : null;
const PREFIX = 'v1:';

if (!KEY) {
  console.warn('[pii] PII_ENCRYPTION_KEY is not a 64-char hex key — PII will be stored UNENCRYPTED.');
}

/** Encrypt a UTF-8 string → `v1:iv:tag:ct`, or pass through when unconfigured. */
function encryptPII(plain) {
  if (plain === undefined || plain === null || plain === '') return plain;
  const s = String(plain);
  if (!KEY || s.startsWith(PREFIX)) return s;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(s, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ct.toString('hex')}`;
}

/** Decrypt a `v1:…` value; plain values (legacy/pre-encryption rows) pass through. */
function decryptPII(value) {
  if (value === undefined || value === null || value === '') return value;
  const s = String(value);
  if (!s.startsWith(PREFIX)) return s; // not encrypted (legacy row or plaintext)
  if (!KEY) return '[encrypted]';      // key lost — never return ciphertext as data
  try {
    const [, ivHex, tagHex, ctHex] = s.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('[pii] decrypt failed — key rotated without migration?', err.message);
    return '[unreadable]';
  }
}

module.exports = { encryptPII, decryptPII };
