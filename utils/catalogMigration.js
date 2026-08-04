'use strict';

export const LEGACY_CATEGORY_IDS = ['cat_1', 'cat_2', 'cat_3', 'cat_4'];
const LEGACY_PRODUCT_ID = /^prod_\d{1,4}$/;

export function isLegacyProductId(id) {
  return typeof id === 'string' && LEGACY_PRODUCT_ID.test(id);
}

export function hasLegacyCatalog(categories) {
  return Array.isArray(categories) && categories.some(c => c && LEGACY_CATEGORY_IDS.includes(c.id));
}
