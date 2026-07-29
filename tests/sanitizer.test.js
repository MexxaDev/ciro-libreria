import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../utils/sanitizer.js';

describe('sanitizer', () => {
  it('should escape double quotes', () => {
    assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;');
  });

  it('should escape single quotes', () => {
    const result = escapeHtml("'hello'");
    assert.ok(result.includes('hello'));
    assert.ok(!result.includes("'"));
  });

  it('should escape ampersands', () => {
    assert.equal(escapeHtml('a & b'), 'a &amp; b');
  });

  it('should escape angle brackets', () => {
    assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  });

  it('should handle mixed characters', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = escapeHtml(input);
    assert.ok(!result.includes('<'));
    assert.ok(!result.includes('"'));
  });

  it('should return empty string for empty input', () => {
    assert.equal(escapeHtml(''), '');
  });

  it('should pass through safe strings unchanged', () => {
    assert.equal(escapeHtml('Hello World 123'), 'Hello World 123');
  });

  it('should handle non-string input gracefully', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(123), '123');
  });
});
