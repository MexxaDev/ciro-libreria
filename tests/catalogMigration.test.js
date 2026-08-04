import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isLegacyProductId, hasLegacyCatalog, LEGACY_CATEGORY_IDS } from '../utils/catalogMigration.js';

describe('catalogMigration', () => {
  describe('isLegacyProductId', () => {
    it('should detect short numeric legacy ids', () => {
      assert.equal(isLegacyProductId('prod_1'), true);
      assert.equal(isLegacyProductId('prod_9999'), true);
    });

    it('should NOT detect user-created timestamp ids', () => {
      assert.equal(isLegacyProductId('prod_1754399000000'), false);
    });

    it('should NOT detect seed ids or other formats', () => {
      assert.equal(isLegacyProductId('PROD-0001'), false);
      assert.equal(isLegacyProductId('prod_mkx3qo'), false);
      assert.equal(isLegacyProductId(undefined), false);
      assert.equal(isLegacyProductId(''), false);
    });
  });

  describe('hasLegacyCatalog', () => {
    it('should be true when legacy categories exist', () => {
      const categories = [{ id: 'cat_1' }, { id: 'cat_pap' }];
      assert.equal(hasLegacyCatalog(categories), true);
    });

    it('should be false for the librería catalog', () => {
      const categories = [{ id: 'cat_pap' }, { id: 'cat_esc' }];
      assert.equal(hasLegacyCatalog(categories), false);
    });

    it('should be false for empty or invalid input', () => {
      assert.equal(hasLegacyCatalog([]), false);
      assert.equal(hasLegacyCatalog(null), false);
      assert.equal(hasLegacyCatalog(undefined), false);
    });
  });

  describe('LEGACY_CATEGORY_IDS', () => {
    it('should contain the 4 legacy category ids', () => {
      assert.deepEqual(LEGACY_CATEGORY_IDS, ['cat_1', 'cat_2', 'cat_3', 'cat_4']);
    });
  });
});
