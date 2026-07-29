'use strict';

import db from '../db/indexeddb.js';
import { backupSnapshotRepo } from '../db/repositories.js';
import { logger } from '../utils/logger.js';
import { uploadFile, loadGitHubConfig } from '../utils/githubBackup.js';

const ALL_STORES = [
  'products',
  'categories',
  'customers',
  'sales',
  'sale_items',
  'cash_sessions',
  'cash_movements',
  'cash_closures',
  'settings',
  'users',
  'notifications',
  'counters',
  'backup_snapshots'
];

const MAX_SNAPSHOTS = 20;
const DEFAULT_INTERVAL = 300000;

class BackupManager {
  constructor() {
    this._autoTimer = null;
    this._lastSnapshotHash = null;
    this._githubConfig = loadGitHubConfig();
  }

  setGitHubConfig(config) {
    this._githubConfig = config;
  }

  async _computeHash(data) {
    const json = JSON.stringify(data);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(json);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async _gatherData(stores) {
    const data = {};
    for (const store of stores) {
      data[store] = await db.getAll(store);
    }
    return data;
  }

  async _restoreData(snapshotData) {
    for (const [storeName, items] of Object.entries(snapshotData)) {
      if (!ALL_STORES.includes(storeName)) {
        continue;
      }
      if (!Array.isArray(items)) {
        continue;
      }
      await db.clear(storeName);
      for (const item of items) {
        await db.add(storeName, item);
      }
    }
  }

  async restoreFromData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Datos inválidos');
    }
    const storeCount = Object.keys(data).length;
    const itemCounts = Object.entries(data)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => `${k}:${v.length}`)
      .join(', ');
    logger.info('BackupManager', `Restaurando ${storeCount} stores: ${itemCounts}`);
    await this._restoreData(data);
  }

  async _cleanupOldSnapshots() {
    const snapshots = await backupSnapshotRepo.findAll();
    if (snapshots.length > MAX_SNAPSHOTS) {
      const sorted = snapshots.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const toDelete = sorted.slice(0, sorted.length - MAX_SNAPSHOTS);
      for (const snap of toDelete) {
        await backupSnapshotRepo.delete(snap.id);
      }
    }
  }

  async createSnapshot(label, type = 'manual') {
    const now = new Date();
    const data = await this._gatherData(ALL_STORES);
    const checksum = await this._computeHash(data);
    const totalItems = ALL_STORES.reduce((sum, s) => sum + (data[s]?.length || 0), 0);

    const snapshot = {
      id: `snap_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now.toISOString(),
      label: label || `Backup ${now.toLocaleString('es-AR')}`,
      type,
      checksum,
      data,
      summary: { stores: ALL_STORES.length, items: totalItems }
    };

    await backupSnapshotRepo.create(snapshot);
    await this._cleanupOldSnapshots();
    this._lastSnapshotHash = checksum;

    this._githubConfig = loadGitHubConfig();
    const { autoSync } = this._githubConfig;
    if (autoSync) {
      this._syncToGitHub(snapshot).catch(err => {
        logger.warn('BackupManager', 'GitHub sync failed', err.message);
      });
    }

    return snapshot;
  }

  async _syncToGitHub(snapshot) {
    const { token, owner, repo } = this._githubConfig;
    if (!token || !owner || !repo) {
      throw new Error('GitHub no configurado');
    }

    const filename = `backups/syntra-backup-${snapshot.createdAt.replace(/[:.]/g, '-')}.json`;
    const latestPath = 'backups/latest.json';

    const label = snapshot.label || 'Backup sin etiqueta';
    const summary = snapshot.summary ? ` (${snapshot.summary.items} items)` : '';
    const message = `backup: ${label}${summary}`;

    const data = JSON.stringify({ _meta: { uploadedAt: new Date().toISOString() }, data: snapshot.data }, null, 2);

    await uploadFile(token, owner, repo, filename, data, message);
    await uploadFile(token, owner, repo, latestPath, data, `backup: actualizar latest.json${summary}`);
  }

  async syncSnapshotToGitHub(snapshotId) {
    this._githubConfig = loadGitHubConfig();

    let snapshot;
    if (snapshotId) {
      snapshot = await backupSnapshotRepo.findById(snapshotId);
      if (!snapshot) {
        throw new Error('Snapshot no encontrado');
      }
    } else {
      const all = await backupSnapshotRepo.findAll();
      if (all.length === 0) {
        throw new Error('No hay snapshots para subir');
      }
      snapshot = all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    }

    await this._syncToGitHub(snapshot);
    return { label: snapshot.label, items: snapshot.summary?.items || 0 };
  }

  async listSnapshots() {
    const snapshots = await backupSnapshotRepo.findAll();
    return snapshots
      .map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        label: s.label,
        type: s.type,
        checksum: s.checksum,
        summary: s.summary
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async restoreSnapshot(id) {
    const snapshot = await backupSnapshotRepo.findById(id);
    if (!snapshot) {
      throw new Error('Snapshot no encontrado');
    }

    const currentChecksum = await this._computeHash(snapshot.data);
    if (currentChecksum !== snapshot.checksum) {
      throw new Error('El snapshot está corrupto (checksum no coincide)');
    }

    await this._restoreData(snapshot.data);
    return {
      stores: snapshot.summary.stores,
      items: snapshot.summary.items,
      label: snapshot.label,
      date: snapshot.createdAt
    };
  }

  async deleteSnapshot(id) {
    await backupSnapshotRepo.delete(id);
  }

  async importFromFile(file, createPreBackup = true) {
    if (createPreBackup) {
      await this.createSnapshot('Pre-importación', 'pre-import');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || typeof data !== 'object') {
            throw new Error('Archivo de backup inválido');
          }

          const stores = Object.keys(data).filter(k => k !== '_meta');
          if (stores.length === 0) {
            throw new Error('No hay datos para importar');
          }

          for (const store of stores) {
            if (!ALL_STORES.includes(store)) {
              throw new Error(`Store desconocido: ${store}`);
            }
            if (!Array.isArray(data[store])) {
              throw new Error(`Store ${store}: formato inválido`);
            }
          }

          for (const store of stores) {
            await db.clear(store);
            for (const item of data[store]) {
              await db.add(store, item);
            }
          }

          await this.createSnapshot('Post-importación', 'post-import');
          resolve({ stores: stores.length, items: stores.reduce((s, k) => s + data[k].length, 0) });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsText(file);
    });
  }

  startAutoBackup(intervalMs) {
    if (this._autoTimer) {
      return;
    }
    const ms = intervalMs || DEFAULT_INTERVAL;
    this._autoTimer = setInterval(async () => {
      try {
        const currentData = await this._gatherData(ALL_STORES);
        const currentHash = await this._computeHash(currentData);
        if (currentHash !== this._lastSnapshotHash) {
          await this.createSnapshot('Backup automático', 'automatic');
        }
      } catch (err) {
        logger.error('BackupManager', 'Auto-backup error', err);
      }
    }, ms);
  }

  stopAutoBackup() {
    if (this._autoTimer) {
      clearInterval(this._autoTimer);
      this._autoTimer = null;
    }
  }

  isAutoBackupRunning() {
    return this._autoTimer !== null;
  }

  async checkStorageQuota() {
    const result = { supported: false, used: null, quota: null, percentage: null };
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        result.supported = true;
        result.used = estimate.usage;
        result.quota = estimate.quota;
        result.percentage = estimate.quota > 0 ? Math.round((estimate.usage / estimate.quota) * 100) : 0;
      } catch {
        /* storage API not available */
      }
    }
    return result;
  }

  async getSnapshotCount() {
    const snapshots = await backupSnapshotRepo.findAll();
    return snapshots.length;
  }
}

export default new BackupManager();
