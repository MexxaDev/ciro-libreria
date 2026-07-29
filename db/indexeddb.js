'use strict';

const DB_NAME = 'pos_premium_db';
const DB_VERSION = 4;

const STORES = {
  products: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'categoryId', keyPath: 'categoryId' },
      { name: 'barcode', keyPath: 'barcode', unique: true },
      { name: 'sku', keyPath: 'sku', unique: true },
      { name: 'visible_web', keyPath: 'visible_web' }
    ]
  },
  categories: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: []
  },
  customers: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [{ name: 'phone', keyPath: 'phone', unique: false }]
  },
  sales: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'date', keyPath: 'date' },
      { name: 'customerId', keyPath: 'customerId' }
    ]
  },
  sale_items: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'saleId', keyPath: 'saleId' },
      { name: 'productId', keyPath: 'productId' }
    ]
  },
  cash_sessions: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [{ name: 'openedAt', keyPath: 'openedAt' }]
  },
  cash_movements: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [{ name: 'sessionId', keyPath: 'sessionId' }]
  },
  settings: {
    keyPath: 'key',
    autoIncrement: false,
    indexes: []
  },
  users: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [{ name: 'username', keyPath: 'username', unique: true }]
  },
  notifications: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'date', keyPath: 'date' },
      { name: 'read', keyPath: 'read' }
    ]
  },
  cash_closures: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'sessionId', keyPath: 'sessionId' },
      { name: 'closedAt', keyPath: 'closedAt' }
    ]
  },
  backup_snapshots: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'type', keyPath: 'type' }
    ]
  },
  counters: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: []
  },
  payment_methods: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: []
  }
};

class IndexedDBWrapper {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = event.target.result;
        const transaction = event.target.transaction;

        Object.entries(STORES).forEach(([storeName, config]) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, {
              keyPath: config.keyPath,
              autoIncrement: config.autoIncrement
            });

            config.indexes.forEach(index => {
              store.createIndex(index.name, index.keyPath, { unique: index.unique || false });
            });
          } else {
            const existingStore = transaction.objectStore(storeName);
            const existingIndexes = Array.from(existingStore.indexNames);

            config.indexes.forEach(index => {
              if (!existingIndexes.includes(index.name)) {
                existingStore.createIndex(index.name, index.keyPath, { unique: index.unique || false });
              }
            });
          }
        });
      };

      request.onsuccess = event => {
        this.db = event.target.result;

        const missingStores = [];
        Object.keys(STORES).forEach(storeName => {
          if (!this.db.objectStoreNames.contains(storeName)) {
            missingStores.push(storeName);
          }
        });

        if (missingStores.length > 0) {
          const newVersion = this.db.version + 1;
          this.db.close();
          const retry = indexedDB.open(DB_NAME, newVersion);
          retry.onupgradeneeded = e => {
            const upgDb = e.target.result;
            missingStores.forEach(storeName => {
              if (!upgDb.objectStoreNames.contains(storeName)) {
                const config = STORES[storeName];
                const store = upgDb.createObjectStore(storeName, {
                  keyPath: config.keyPath,
                  autoIncrement: config.autoIncrement
                });
                config.indexes.forEach(idx => {
                  store.createIndex(idx.name, idx.keyPath, { unique: idx.unique || false });
                });
              }
            });
          };
          retry.onsuccess = e => {
            this.db = e.target.result;
            resolve(this.db);
          };
          retry.onerror = e => reject(e.target.error);
        } else {
          resolve(this.db);
        }
      };

      request.onerror = event => {
        reject(event.target.error);
      };
    });
  }

  _getStore(storeName, mode = 'readonly') {
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const store = this._getStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName, indexName, query) {
    return new Promise((resolve, reject) => {
      try {
        const store = this._getStore(storeName);

        let request;
        if (indexName && query !== undefined) {
          const index = store.index(indexName);
          if (!index) {
            reject(new Error(`Index ${indexName} not found in ${storeName}`));
            return;
          }
          request = index.getAll(query);
        } else {
          request = store.getAll();
        }

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async add(storeName, item) {
    return new Promise((resolve, reject) => {
      const store = this._getStore(storeName, 'readwrite');
      const request = store.add(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      const store = this._getStore(storeName, 'readwrite');
      const request = store.put(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async putAll(storeName, items) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      let error = null;

      items.forEach(item => {
        const req = store.put(item);
        req.onerror = () => {
          error = req.error;
        };
      });

      transaction.oncomplete = () => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => {
        if (error) {
          reject(error);
        }
      };
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const store = this._getStore(storeName, 'readwrite');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const store = this._getStore(storeName, 'readwrite');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export default new IndexedDBWrapper();
