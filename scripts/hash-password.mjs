// Generate a PBKDF2 hash compatible with cf/auth.js
// Usage: node scripts/hash-password.mjs "my-password"
import { webcrypto as crypto } from 'node:crypto';

const enc = new TextEncoder();
const b64 = (bytes) => Buffer.from(new Uint8Array(bytes)).toString('base64');
const password = process.argv[2] || 'admin123';
const iterations = 100_000;

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);

console.log(`pbkdf2$${iterations}$${b64(salt)}$${b64(bits)}`);
