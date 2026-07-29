import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BRAND } from '../config/brandConfig.js';

describe('brandConfig', () => {
  it('should have a name', () => {
    assert.equal(typeof BRAND.name, 'string');
    assert.ok(BRAND.name.length > 0);
  });

  it('should not contain VICE branding', () => {
    assert.ok(!BRAND.name.toLowerCase().includes('vice'));
    assert.ok(!BRAND.name.toLowerCase().includes('burger'));
  });

  it('should use primary color #7C3AED', () => {
    assert.equal(BRAND.color, '#7C3AED');
  });

  it('should not use VICE colors', () => {
    assert.notEqual(BRAND.color, '#e13a7a');
    assert.notEqual(BRAND.color, '#1897b1');
  });
});
