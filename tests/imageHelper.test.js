'use strict';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stringToColor, generatePlaceholderSVG, getProductImage } from '../utils/imageHelper.js';

describe('imageHelper', () => {
  describe('stringToColor', () => {
    it('should return an HSL color string', () => {
      const result = stringToColor('TestProduct');
      assert.match(result, /^hsl\(\d+, 65%, 55%\)$/);
    });

    it('should be deterministic for the same input', () => {
      const a = stringToColor('Pizza');
      const b = stringToColor('Pizza');
      assert.equal(a, b);
    });

    it('should produce different colors for different inputs', () => {
      const a = stringToColor('Pizza');
      const b = stringToColor('Burger');
      assert.notEqual(a, b);
    });

    it('should handle empty string', () => {
      const result = stringToColor('');
      assert.match(result, /^hsl\(\d+, 65%, 55%\)$/);
    });
  });

  describe('generatePlaceholderSVG', () => {
    it('should return a data URI', () => {
      const result = generatePlaceholderSVG('Pizza', 'hsl(100, 65%, 55%)');
      assert.ok(result.startsWith('data:image/svg+xml,'));
    });

    it('should use the first character as initial', () => {
      const result = generatePlaceholderSVG('Hamburguesa', 'hsl(0, 65%, 55%)');
      const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''));
      assert.ok(decoded.includes('>H<'));
    });

    it('should truncate long names to 15 chars', () => {
      const result = generatePlaceholderSVG('Very Long Product Name Here', 'hsl(0, 65%, 55%)');
      const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''));
      assert.ok(decoded.includes('Very Long Produ...'));
    });

    it('should escape HTML characters', () => {
      const result = generatePlaceholderSVG('Test<Script>', 'hsl(0, 65%, 55%)');
      const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''));
      assert.ok(!decoded.includes('<Script>'));
    });
  });

  describe('getProductImage', () => {
    it('should return the product image if set', () => {
      const product = { name: 'Pizza', image: 'pizza.jpg' };
      assert.equal(getProductImage(product), 'pizza.jpg');
    });

    it('should return placeholder for product without image', () => {
      const product = { name: 'Pizza', image: '' };
      const result = getProductImage(product);
      assert.ok(result.startsWith('data:image/svg+xml,'));
    });

    it('should use category color if available', () => {
      const product = { name: 'Pizza', image: '', categoryId: 'cat1' };
      const categories = [{ id: 'cat1', color: 'hsl(120, 50%, 50%)' }];
      const result = getProductImage(product, categories);
      const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''));
      assert.ok(decoded.includes('hsl(120, 50%, 50%)'));
    });

    it('should fall back to name-based color if category not found', () => {
      const product = { name: 'Pizza', image: '', categoryId: 'cat99' };
      const categories = [{ id: 'cat1', color: 'hsl(120, 50%, 50%)' }];
      const result = getProductImage(product, categories);
      assert.ok(result.startsWith('data:image/svg+xml,'));
    });

    it('should default to "Product" name if missing', () => {
      const product = { name: '', image: '' };
      const result = getProductImage(product);
      assert.ok(result.startsWith('data:image/svg+xml,'));
    });

    it('should handle product with no image and empty categories', () => {
      const product = { name: 'Taco', image: '' };
      const result = getProductImage(product, []);
      assert.ok(result.startsWith('data:image/svg+xml,'));
    });
  });
});
