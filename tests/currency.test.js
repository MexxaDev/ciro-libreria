'use strict';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import state from '../js/state.js';
import { format, parse } from '../utils/currency.js';

describe('currency', () => {
  describe('format', () => {
    beforeEach(() => {
      state.set('settings', {});
    });

    it('should format number with default $ symbol', () => {
      const result = format(10);
      assert.equal(result, '$ 10.00');
    });

    it('should format with two decimal places', () => {
      const result = format(12.5);
      assert.equal(result, '$ 12.50');
    });

    it('should round to two decimals', () => {
      const result = format(10.005);
      assert.equal(result, '$ 10.01');
    });

    it('should handle zero', () => {
      assert.equal(format(0), '$ 0.00');
    });

    it('should handle negative values', () => {
      assert.equal(format(-5.5), '$ -5.50');
    });

    it('should use custom currency symbol from settings', () => {
      state.set('settings', { currencySymbol: '€' });
      assert.equal(format(20), '€ 20.00');
    });

    it('should handle string input', () => {
      assert.equal(format('25.5'), '$ 25.50');
    });
  });

  describe('parse', () => {
    it('should parse a plain number string', () => {
      assert.equal(parse('123.45'), 123.45);
    });

    it('should strip non-numeric characters', () => {
      assert.equal(parse('$ 100.00'), 100);
    });

    it('should handle comma-separated numbers', () => {
      assert.equal(parse('1,234.56'), 1234.56);
    });

    it('should handle negative values', () => {
      assert.equal(parse('-$50.00'), -50);
    });

    it('should return 0 for non-numeric input', () => {
      assert.equal(parse('abc'), 0);
    });

    it('should return 0 for empty string', () => {
      assert.equal(parse(''), 0);
    });

    it('should parse actual number input', () => {
      assert.equal(parse(42.5), 42.5);
    });
  });
});
