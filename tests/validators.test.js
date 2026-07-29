import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  required,
  minLength,
  maxLength,
  isNumber,
  isPositive,
  isInteger,
  validateProduct,
  validateCustomer,
  validateCategory
} from '../utils/validators.js';

describe('validators', () => {
  describe('required', () => {
    it('should return true for non-empty string', () => assert.equal(required('hello'), true));
    it('should return true for number 0', () => assert.equal(required(0), true));
    it('should return false for empty string', () => assert.equal(required(''), false));
    it('should return false for whitespace only', () => assert.equal(required('   '), false));
    it('should return false for null', () => assert.equal(required(null), false));
    it('should return false for undefined', () => assert.equal(required(undefined), false));
  });

  describe('minLength', () => {
    it('should return true when string meets min length', () => assert.equal(minLength('abc', 3), true));
    it('should return true when string exceeds min length', () => assert.equal(minLength('abcdef', 3), true));
    it('should return false when string is shorter', () => assert.equal(minLength('ab', 3), false));
    it('should return falsy for null', () => assert.ok(!minLength(null, 1)));
  });

  describe('maxLength', () => {
    it('should return true when string is within max', () => assert.equal(maxLength('abc', 5), true));
    it('should return true for empty/null', () => assert.equal(maxLength('', 5), true));
    it('should return false when string exceeds max', () => assert.equal(maxLength('abcdef', 3), false));
  });

  describe('isNumber', () => {
    it('should return true for integers', () => assert.equal(isNumber(42), true));
    it('should return true for floats', () => assert.equal(isNumber(3.14), true));
    it('should return true for numeric strings', () => assert.equal(isNumber('100'), true));
    it('should return false for NaN', () => assert.equal(isNumber(NaN), false));
    it('should return false for non-numeric strings', () => assert.equal(isNumber('abc'), false));
    it('should return false for null', () => assert.equal(isNumber(null), false));
  });

  describe('isPositive', () => {
    it('should return true for positive numbers', () => assert.equal(isPositive(1), true));
    it('should return true for 0.01', () => assert.equal(isPositive(0.01), true));
    it('should return false for 0', () => assert.equal(isPositive(0), false));
    it('should return false for negative', () => assert.equal(isPositive(-5), false));
  });

  describe('isInteger', () => {
    it('should return true for integers', () => assert.equal(isInteger(5), true));
    it('should return true for 0', () => assert.equal(isInteger(0), true));
    it('should return false for floats', () => assert.equal(isInteger(3.14), false));
    it('should return true for numeric string', () => assert.equal(isInteger('5'), true));
  });

  describe('validateProduct', () => {
    it('should return no errors for valid product', () => {
      const errors = validateProduct({ name: 'Test', price: 100, stock: 5 });
      assert.equal(errors.length, 0);
    });
    it('should require name', () => {
      const errors = validateProduct({ name: '', price: 100, stock: 5 });
      assert.ok(errors.some(e => e.includes('nombre')));
    });
    it('should require positive price', () => {
      const errors = validateProduct({ name: 'Test', price: 0, stock: 5 });
      assert.ok(errors.some(e => e.includes('precio')));
    });
    it('should allow price 0 for variablePrice products', () => {
      const errors = validateProduct({ name: 'Test', price: 0, stock: 5, variablePrice: true });
      assert.equal(errors.length, 0);
    });
    it('should reject non-numeric price for variablePrice products', () => {
      const errors = validateProduct({ name: 'Test', price: NaN, stock: 5, variablePrice: true });
      assert.ok(errors.some(e => e.includes('precio')));
    });
    it('should require integer stock', () => {
      const errors = validateProduct({ name: 'Test', price: 100, stock: 1.5 });
      assert.ok(errors.some(e => e.includes('stock')));
    });
  });

  describe('validateCustomer', () => {
    it('should return no errors for valid customer', () => {
      const errors = validateCustomer({ name: 'Juan' });
      assert.equal(errors.length, 0);
    });
    it('should require name', () => {
      const errors = validateCustomer({ name: '' });
      assert.ok(errors.some(e => e.includes('nombre')));
    });
  });

  describe('validateCategory', () => {
    it('should return no errors for valid category', () => {
      const errors = validateCategory({ name: 'Bebidas' });
      assert.equal(errors.length, 0);
    });
    it('should require name', () => {
      const errors = validateCategory({ name: '' });
      assert.ok(errors.some(e => e.includes('nombre')));
    });
  });
});
