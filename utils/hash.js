'use strict';

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const HEX_START = 2;
const LEGACY_SHA256_LENGTH = 64;

function arrayBufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(HEX_START, '0'))
    .join('');
}

function base64Encode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function hashPassword(password) {
  const saltBuffer = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  const key = await crypto.subtle.importKey('raw', passwordData, { name: 'PBKDF2' }, false, ['deriveBits']);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    key,
    HASH_BYTES * 8
  );

  const saltBase64 = base64Encode(saltBuffer);
  const hashHex = arrayBufferToHex(derivedBits);

  return `${saltBase64}:${hashHex}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') {
    return false;
  }

  if (isSaltedHash(storedHash)) {
    const [saltBase64, expectedHex] = storedHash.split(':');
    const saltBuffer = base64Decode(saltBase64);
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);

    const key = await crypto.subtle.importKey('raw', passwordData, { name: 'PBKDF2' }, false, ['deriveBits']);

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      key,
      HASH_BYTES * 8
    );

    return arrayBufferToHex(derivedBits) === expectedHex;
  }

  if (isLikelyHash(storedHash)) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return arrayBufferToHex(hashBuffer) === storedHash;
  }

  return false;
}

export function isSaltedHash(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const parts = value.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, hash] = parts;
  return salt.length > 0 && hash.length === LEGACY_SHA256_LENGTH && /^[a-f0-9]+$/.test(hash);
}

export function isLikelyHash(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return isSaltedHash(value) || (value.length === LEGACY_SHA256_LENGTH && /^[a-f0-9]+$/.test(value));
}
