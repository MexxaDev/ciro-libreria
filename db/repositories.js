'use strict';

import db from './indexeddb.js';

let idCounter = 0;
const generateId = () => {
  const timestamp = Date.now().toString(36);
  const counter = (++idCounter % 1000).toString(36).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 7);
  return `${timestamp}_${counter}${random}`;
};

class Repository {
  constructor(storeName) {
    this.storeName = storeName;
    this.db = db;
  }

  async findAll() {
    return this.db.getAll(this.storeName);
  }

  async findById(id) {
    return this.db.get(this.storeName, id);
  }

  async create(item) {
    const newItem = { ...item, id: item.id || generateId() };
    await this.db.add(this.storeName, newItem);
    return newItem;
  }

  async update(item) {
    await this.db.put(this.storeName, item);
    return item;
  }

  async saveAll(items) {
    await this.db.putAll(this.storeName, items);
    return items;
  }

  async delete(id) {
    await this.db.delete(this.storeName, id);
  }

  async query(indexName, value) {
    return this.db.getAll(this.storeName, indexName, value);
  }
}

export const productRepo = new Repository('products');
export const categoryRepo = new Repository('categories');
export const customerRepo = new Repository('customers');
export const saleRepo = new Repository('sales');
export const saleItemRepo = new Repository('sale_items');
export const cashSessionRepo = new Repository('cash_sessions');
export const cashMovementRepo = new Repository('cash_movements');
export const cashClosureRepo = new Repository('cash_closures');
export const settingRepo = new Repository('settings');
export const userRepo = new Repository('users');
export const notificationRepo = new Repository('notifications');
export const backupSnapshotRepo = new Repository('backup_snapshots');
export const counterRepo = new Repository('counters');
export const paymentMethodRepo = new Repository('payment_methods');

const SALE_ID_KEY = 'saleSequence';

export async function generateSaleId() {
  const year = new Date().getFullYear();
  return new Promise((resolve, reject) => {
    const transaction = db.db.transaction('counters', 'readwrite');
    const store = transaction.objectStore('counters');

    const getReq = store.get(SALE_ID_KEY);
    getReq.onsuccess = () => {
      let nextVal;
      if (getReq.result) {
        nextVal = getReq.result.value + 1;
        store.put({ id: SALE_ID_KEY, value: nextVal });
      } else {
        nextVal = 1;
        store.add({ id: SALE_ID_KEY, value: 1 });
      }
      const padded = String(nextVal).padStart(6, '0');
      resolve(`S-${year}-${padded}`);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}
