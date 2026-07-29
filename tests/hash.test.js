import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, isLikelyHash, isSaltedHash } from '../utils/hash.js';

describe('hash', () => {
  describe('hashPassword', () => {
    it('should return a string', async () => {
      const result = await hashPassword('test');
      assert.equal(typeof result, 'string');
    });

    it('should return salt:hash format', async () => {
      const result = await hashPassword('password123');
      assert.match(result, /^[A-Za-z0-9+/]+=*:[a-f0-9]{64}$/);
    });

    it('should not be deterministic (random salt)', async () => {
      const a = await hashPassword('hello');
      const b = await hashPassword('hello');
      assert.notEqual(a, b);
    });

    it('should produce different hashes for different inputs', async () => {
      const a = await hashPassword('abc');
      const b = await hashPassword('xyz');
      assert.notEqual(a, b);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password against salted hash', async () => {
      const hash = await hashPassword('mypassword');
      assert.equal(await verifyPassword('mypassword', hash), true);
    });

    it('should reject incorrect password against salted hash', async () => {
      const hash = await hashPassword('mypassword');
      assert.equal(await verifyPassword('wrongpassword', hash), false);
    });

    it('should verify correct password against legacy unsalted hash', async () => {
      const encoder = new TextEncoder();
      const data = encoder.encode('legacy123');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const legacyHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      assert.equal(await verifyPassword('legacy123', legacyHash), true);
    });

    it('should reject incorrect password against legacy hash', async () => {
      const encoder = new TextEncoder();
      const data = encoder.encode('legacy123');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const legacyHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      assert.equal(await verifyPassword('wrong', legacyHash), false);
    });

    it('should return false for null/undefined/empty', async () => {
      assert.equal(await verifyPassword('test', null), false);
      assert.equal(await verifyPassword('test', undefined), false);
      assert.equal(await verifyPassword('test', ''), false);
    });
  });

  describe('isSaltedHash', () => {
    it('should return true for valid salt:hash format', () => {
      assert.equal(isSaltedHash('abc123:' + 'a'.repeat(64)), true);
    });

    it('should return false for legacy 64-char hex', () => {
      assert.equal(isSaltedHash('a'.repeat(64)), false);
    });

    it('should return false for short strings', () => {
      assert.equal(isSaltedHash('abc'), false);
    });

    it('should return false for null/undefined', () => {
      assert.equal(isSaltedHash(null), false);
      assert.equal(isSaltedHash(undefined), false);
    });
  });

  describe('isLikelyHash', () => {
    it('should return true for legacy 64-char hex string', () => {
      assert.equal(isLikelyHash('a'.repeat(64)), true);
    });

    it('should return true for salted hash format', () => {
      assert.equal(isLikelyHash('abc123:' + 'a'.repeat(64)), true);
    });

    it('should return false for short strings', () => {
      assert.equal(isLikelyHash('abc'), false);
    });

    it('should return false for empty string', () => {
      assert.equal(isLikelyHash(''), false);
    });

    it('should return false for non-hex strings', () => {
      assert.equal(isLikelyHash('g'.repeat(64)), false);
    });

    it('should return false for null/undefined', () => {
      assert.equal(isLikelyHash(null), false);
      assert.equal(isLikelyHash(undefined), false);
    });
  });
});
