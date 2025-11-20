/**
 * Encryption utilities for Cloudflare Workers
 * Uses Web Crypto API instead of Node.js crypto
 */

import type { Env } from './index';

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const SALT_LENGTH = 16;
const KEY_LENGTH = 256; // bits
const ITERATIONS = 100000;

/**
 * Derives a key from the encryption secret using PBKDF2
 */
async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts a string value (e.g., API key)
 * Returns a base64-encoded string containing salt + iv + encrypted data
 */
export async function encrypt(text: string, env: Env): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Derive key
    const key = await deriveKey(env.ENCRYPTION_KEY || env.JWT_SECRET, salt);

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
        {
            name: ALGORITHM,
            iv,
        },
        key,
        data
    );

    // Combine: salt + iv + encrypted data
    const combined = new Uint8Array(
        salt.length + iv.length + encrypted.byteLength
    );
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts an encrypted string
 */
export async function decrypt(encryptedData: string, env: Env): Promise<string> {
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    // Extract components
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH);

    // Derive key
    const key = await deriveKey(env.ENCRYPTION_KEY || env.JWT_SECRET, salt);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
        {
            name: ALGORITHM,
            iv,
        },
        key,
        encrypted
    );

    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

/**
 * Masks an API key for display (shows only first 8 and last 4 characters)
 */
export function maskApiKey(apiKey: string): string {
    if (apiKey.length <= 12) {
        return '*'.repeat(apiKey.length);
    }

    const start = apiKey.substring(0, 8);
    const end = apiKey.substring(apiKey.length - 4);
    const middle = '*'.repeat(Math.max(0, apiKey.length - 12));

    return `${start}${middle}${end}`;
}
