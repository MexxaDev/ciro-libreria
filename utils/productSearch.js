'use strict';

function hasBarcode(extra, code) {
  if (!extra) {
    return false;
  }
  try {
    return JSON.parse(extra).includes(code);
  } catch {
    return false;
  }
}

export function findProductsByQuery(products, query) {
  const term = (query || '').trim();
  if (!term || !Array.isArray(products)) {
    return [];
  }

  const byBarcode = products.find(p => p.barcode === term || hasBarcode(p.barcodes_extra, term));
  if (byBarcode) {
    return [byBarcode];
  }

  const normalized = term.toLowerCase();
  return products.filter(p => p.name && p.name.toLowerCase().includes(normalized));
}
