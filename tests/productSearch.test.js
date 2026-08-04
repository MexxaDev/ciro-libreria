import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findProductsByQuery } from '../utils/productSearch.js';

const products = [
  { id: 'PROD-0001', name: 'Lapicera Azul', barcode: '7790000000001', barcodes_extra: '' },
  {
    id: 'prod_mkx3qo',
    name: 'Cuaderno Rivadavia A4',
    barcode: '7791111111111',
    barcodes_extra: JSON.stringify(['EXTRA-001'])
  },
  { id: 'PROD-0002', name: 'Lapicera Negra', barcode: '', barcodes_extra: '' }
];

describe('findProductsByQuery', () => {
  it('should match exact barcode', () => {
    const matches = findProductsByQuery(products, '7790000000001');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].name, 'Lapicera Azul');
  });

  it('should match extra barcode', () => {
    const matches = findProductsByQuery(products, 'EXTRA-001');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].name, 'Cuaderno Rivadavia A4');
  });

  it('should match by name as case-insensitive substring', () => {
    const matches = findProductsByQuery(products, 'lapicera');
    assert.equal(matches.length, 2);
  });

  it('should match name ignoring case', () => {
    const matches = findProductsByQuery(products, 'CUADERNO');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].name, 'Cuaderno Rivadavia A4');
  });

  it('should prioritize barcode match over name match', () => {
    const data = [
      { id: 'a', name: '779123', barcode: '779123' },
      { id: 'b', name: '779123456', barcode: 'other' }
    ];
    const matches = findProductsByQuery(data, '779123');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, 'a');
  });

  it('should return empty array when nothing matches', () => {
    assert.equal(findProductsByQuery(products, 'no-existe').length, 0);
  });

  it('should return empty array for empty or whitespace query', () => {
    assert.equal(findProductsByQuery(products, '').length, 0);
    assert.equal(findProductsByQuery(products, '   ').length, 0);
  });

  it('should handle null or non-array products', () => {
    assert.equal(findProductsByQuery(null, 'lapicera').length, 0);
    assert.equal(findProductsByQuery(undefined, 'lapicera').length, 0);
  });
});
