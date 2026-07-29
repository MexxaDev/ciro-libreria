'use strict';

import db from '../db/indexeddb.js';

export async function exportDatabase() {
  const stores = [
    'products',
    'categories',
    'customers',
    'sales',
    'sale_items',
    'cash_sessions',
    'cash_movements',
    'settings',
    'users',
    'notifications',
    'cash_closures',
    'backup_snapshots',
    'counters'
  ];

  const data = {};

  for (const store of stores) {
    data[store] = await db.getAll(store);
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `pos-backup-${new Date().toISOString().substring(0, 10)}.json`;
  a.click();

  URL.revokeObjectURL(url);
}
