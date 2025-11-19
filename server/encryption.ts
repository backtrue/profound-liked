import crypto from "crypto";
import { ENV } from "./_core/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derives a key from the JWT secret using PBKDF2
 */
function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(ENV.cookieSecret, salt, 100000, KEY_LENGTH, "sha256");
}

/**
 * Encrypts a string value (e.g., API key)
 * Returns a base64-encoded string containing salt + iv + tag + encrypted data
 */
export function encrypt(text: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const tag = cipher.getAuthTag();
  
  // Combine: salt + iv + tag + encrypted
  const combined = Buffer.concat([
    salt,
    iv,
    tag,
    Buffer.from(encrypted, "hex"),
  ]);
  
  return combined.toString("base64");
}

/**
 * Decrypts an encrypted string
 */
export function decrypt(encryptedData: string): string {
  const combined = Buffer.from(encryptedData, "base64");
  
  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH
  );
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  const key = deriveKey(salt);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Masks an API key for display (shows only first 8 and last 4 characters)
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return "*".repeat(apiKey.length);
  }
  
  const start = apiKey.substring(0, 8);
  const end = apiKey.substring(apiKey.length - 4);
  const middle = "*".repeat(Math.max(0, apiKey.length - 12));
  
  return `${start}${middle}${end}`;
}
