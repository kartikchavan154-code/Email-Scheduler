import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Derives a 32-byte Buffer from the provided ENCRYPTION_KEY string
 */
function getKey(): Buffer {
  let keyString = env.ENCRYPTION_KEY;
  // If provided as 64-char hex string
  if (keyString.length === 64 && /^[0-9a-fA-F]+$/.test(keyString)) {
    return Buffer.from(keyString, 'hex');
  }
  // Otherwise hash it to ensure 32 bytes
  return crypto.createHash('sha256').update(keyString).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM
 * Output format: iv:ciphertext:tag (all base64)
 */
export function encryptText(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

/**
 * Decrypts ciphertext using AES-256-GCM
 */
export function decryptText(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivB64, cipherB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const encrypted = Buffer.from(cipherB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
