import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSalesByPeriod, getPeriodLabels, getSalesByCategory } from '../utils/analytics.js';

describe('analytics', () => {
  describe('getSalesByPeriod', () => {
    it('should return array of length equal to days', () => {
      const result = getSalesByPeriod([], 7);
      assert.equal(result.length, 7);
    });
    it('should return zeros for empty sales', () => {
      const result = getSalesByPeriod([], 3);
      assert.deepEqual(result, [0, 0, 0]);
    });
    it('should aggregate sales by date', () => {
      const today = new Date().toISOString().split('T')[0];
      const sales = [
        { date: today + 'T10:00:00Z', total: 100 },
        { date: today + 'T15:00:00Z', total: 200 }
      ];
      const result = getSalesByPeriod(sales, 1);
      assert.equal(result[0], 300);
    });
    it('should not double-count different dates', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const sales = [
        { date: todayStr + 'T10:00:00Z', total: 100 },
        { date: yesterdayStr + 'T10:00:00Z', total: 50 }
      ];
      const result = getSalesByPeriod(sales, 2);
      assert.equal(result[0], 50);
      assert.equal(result[1], 100);
    });
    it('should handle sales with no date', () => {
      const result = getSalesByPeriod([{ total: 100 }], 1);
      assert.equal(result[0], 0);
    });
  });

  describe('getPeriodLabels', () => {
    it('should return array of length equal to days', () => {
      const result = getPeriodLabels(7);
      assert.equal(result.length, 7);
    });
    it('should return M/D format labels', () => {
      const result = getPeriodLabels(1);
      const today = new Date();
      const expected = today.getMonth() + 1 + '/' + today.getDate();
      assert.equal(result[0], expected);
    });
    it('should have increasing dates', () => {
      const result = getPeriodLabels(5);
      assert.equal(result.length, 5);
      assert.equal(result[0] < result[4], true);
    });
  });

  describe('getSalesByCategory', () => {
    it('should group sales by product category', () => {
      const sales = [{ items: [{ productId: 'p1', subtotal: 100 }] }, { items: [{ productId: 'p2', subtotal: 200 }] }];
      const products = [
        { id: 'p1', categoryId: 'cat1' },
        { id: 'p2', categoryId: 'cat2' }
      ];
      const categories = [
        { id: 'cat1', name: 'Bebidas' },
        { id: 'cat2', name: 'Comida' }
      ];
      const result = getSalesByCategory(sales, products, categories);
      assert.equal(result.labels.length, 2);
      assert.ok(result.labels.includes('Bebidas'));
      assert.ok(result.labels.includes('Comida'));
      assert.ok(result.data.includes(100));
      assert.ok(result.data.includes(200));
    });
    it('should return empty for no sales', () => {
      const result = getSalesByCategory([], [], []);
      assert.equal(result.labels.length, 0);
      assert.equal(result.data.length, 0);
    });
    it('should handle products with no category', () => {
      const sales = [{ items: [{ productId: 'p1', subtotal: 50 }] }];
      const products = [{ id: 'p1' }];
      const result = getSalesByCategory(sales, products, []);
      assert.equal(result.labels[0], 'Sin categoría');
      assert.equal(result.data[0], 50);
    });
  });
});
