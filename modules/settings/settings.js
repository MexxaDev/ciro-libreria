'use strict';

import { settingRepo } from '../../db/repositories.js';
import { exportDatabase } from '../../utils/export.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import state from '../../js/state.js';
import { escapeHtml } from '../../utils/sanitizer.js';
import backupManager from '../../services/backupManager.js';
import { logger } from '../../utils/logger.js';
import {
  testConnection,
  loadGitHubConfig,
  saveGitHubConfig,
  downloadFile,
  applyGitHubDefaults
} from '../../utils/githubBackup.js';

class Settings {
  constructor() {
    this.settings = {};
    this.logoDataUrl = '';
    this.githubConfig = loadGitHubConfig();
    applyGitHubDefaults();
  }

  async load() {
    try {
      const settings = await settingRepo.findAll();
      this.settings = {};
      settings.forEach(s => {
        this.settings[s.key] = s.value;
      });

      this.logoDataUrl = this.settings.logo || '';
      this.render();
    } catch (error) {
      logger.error('Settings', 'Error loading settings:', error);
      Toast.error('Error', 'No se pudieron cargar la configuración');
    }
  }

  render() {
    const container = document.getElementById('settings');
    if (!container) {
      return;
    }

    const currency = escapeHtml(this.settings.currency || 'ARS');
    const currencySymbol = escapeHtml(this.settings.currencySymbol || '$');
    const businessName = escapeHtml(this.settings.businessName || '');
    const ticketFooter = escapeHtml(this.settings.ticketFooter || '');

    const taxEnabled = this.settings.taxEnabled !== 'false';
    const taxRate = escapeHtml(this.settings.taxRate || '21');

    const shopEnabled = this.settings.shop_enabled === 'true' || false;
    const shopWhatsapp = escapeHtml(this.settings.shop_whatsapp || '');
    const shopHoursOpen = escapeHtml(this.settings.shop_hours_open || '09:00');
    const shopHoursClose = escapeHtml(this.settings.shop_hours_close || '23:00');
    const shopTakeaway = this.settings.shop_takeaway_enabled !== 'false';
    const shopDelivery = this.settings.shop_delivery_enabled !== 'false';
    const shopMinDelivery = escapeHtml(this.settings.shop_min_delivery || '0');
    const shopDeliveryCost = escapeHtml(this.settings.shop_delivery_cost || '0');

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-header__title">Configuración</h1>
        <p class="page-header__subtitle">Ajustes del sistema</p>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Datos del Negocio</h3>
        <div class="settings-section__desc">Información que aparecerá en los tickets</div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">Nombre del Negocio</label>
            <input type="text" class="form-input" id="setting-businessName" value="${businessName}">
          </div>
          <div class="form-group">
            <label class="form-label">Moneda</label>
            <select class="form-input form-select" id="setting-currency">
              <option value="ARS" ${currency === 'ARS' ? 'selected' : ''}>Peso Argentino (ARS)</option>
              <option value="USD" ${currency === 'USD' ? 'selected' : ''}>Dólar (USD)</option>
              <option value="EUR" ${currency === 'EUR' ? 'selected' : ''}>Euro (EUR)</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">Símbolo de Moneda</label>
            <input type="text" class="form-input" id="setting-currencySymbol" value="${currencySymbol}" maxlength="5" style="width:80px;">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Pie de Ticket</label>
          <textarea class="form-input" id="setting-ticketFooter" rows="3">${ticketFooter}</textarea>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Apariencia</h3>
        <div class="settings-section__desc">Personalizá la interfaz del sistema</div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
            <input type="checkbox" id="setting-theme" ${this.settings.theme === 'dark' ? 'checked' : ''}>
            <span class="form-label" style="margin:0;">Modo Oscuro</span>
          </label>
          <p style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-top:var(--space-1);">
            Cambiá entre tema claro y oscuro
          </p>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Impuestos</h3>
        <div class="settings-section__desc">Configuración del IVA para el POS</div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
            <input type="checkbox" id="setting-tax-enabled" ${taxEnabled ? 'checked' : ''}>
            <span class="form-label" style="margin:0;">Habilitar IVA</span>
          </label>
          <p style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-top:var(--space-1);">
            Si está deshabilitado, no se calculará IVA en las ventas
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">Porcentaje de IVA (%)</label>
            <input type="number" class="form-input" id="setting-taxRate" value="${taxRate}" min="0" max="100" step="0.1" style="width:120px;">
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Shop - Catálogo Online</h3>
        <div class="settings-section__desc">Configuración del catálogo público para clientes</div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
            <input type="checkbox" id="setting-shop-enabled" ${shopEnabled ? 'checked' : ''}>
            <span class="form-label" style="margin:0;">Activar Shop</span>
          </label>
          <p style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-top:var(--space-1);">
            Al activar, tu catálogo estará disponible en ${window.location.origin}#shop
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">WhatsApp (con código país)</label>
            <input type="text" class="form-input" id="setting-shop-whatsapp" value="${shopWhatsapp}" placeholder="5491123456789">
            <p style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:var(--space-1);">
              Número donde llegarán los pedidos
            </p>
          </div>
          <div class="form-group">
            <label class="form-label">Color Primario</label>
            <input type="color" class="form-input" id="setting-shop-color" value="${this.settings.shop_primary_color || '#7C3AED'}">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">Horario Apertura</label>
            <input type="time" class="form-input" id="setting-shop-open" value="${shopHoursOpen}">
          </div>
          <div class="form-group">
            <label class="form-label">Horario Cierre</label>
            <input type="time" class="form-input" id="setting-shop-close" value="${shopHoursClose}">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
              <input type="checkbox" id="setting-shop-takeaway" ${shopTakeaway ? 'checked' : ''}>
              <span class="form-label" style="margin:0;">Take Away</span>
            </label>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
              <input type="checkbox" id="setting-shop-delivery" ${shopDelivery ? 'checked' : ''}>
              <span class="form-label" style="margin:0;">Delivery</span>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">Monto Mínimo Delivery</label>
            <input type="number" class="form-input" id="setting-shop-min-delivery" value="${shopMinDelivery}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Costo Envío</label>
            <input type="number" class="form-input" id="setting-shop-delivery-cost" value="${shopDeliveryCost}" min="0">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Banner Principal (URL)</label>
          <input type="text" class="form-input" id="setting-shop-banner" value="${this.settings.shop_banner || ''}" placeholder="https://...">
        </div>

        <div class="form-group">
          <label class="form-label">Link Público del Shop</label>
          <div style="display:flex;gap:var(--space-2);align-items:center;">
            <input type="text" class="form-input" value="${window.location.origin}#shop" readonly style="background:var(--color-gray-50);cursor:copy;">
            <button class="btn btn-sm btn-secondary" id="copy-shop-url" title="Copiar link">
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Logo del Negocio</h3>
        <div class="settings-section__desc">Tamaño máximo: 200x200px. Se guardará en formato Base64.</div>

        <div style="display:flex;gap:var(--space-4);align-items:flex-start;">
          <div>
            <input type="file" accept="image/*" id="setting-logo" style="display:none;">
            <button class="btn btn-secondary" id="upload-logo-btn">
              <i class="fa-solid fa-upload"></i> Subir Logo
            </button>
          </div>
          <div id="logo-preview" style="display:${this.logoDataUrl ? 'block' : 'none'};">
            <img src="${this.logoDataUrl}" alt="Logo del negocio" style="max-width:200px;max-height:200px;border-radius:var(--radius-lg);border:1px solid var(--color-border);">
            <button class="btn btn-sm btn-danger" id="remove-logo-btn" style="margin-top:var(--space-2);">Eliminar</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Copias de Seguridad</h3>
        <div class="settings-section__desc">Snapshots automáticos, exportación y restauración del sistema.</div>

        <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4);">
          <button class="btn btn-primary" id="create-snapshot-btn">
            <i class="fa-solid fa-camera"></i> Crear Snapshot
          </button>
          <button class="btn btn-secondary" id="export-backup">
            <i class="fa-solid fa-file-export"></i> Exportar JSON
          </button>
          <button class="btn btn-secondary" id="import-backup">
            <i class="fa-solid fa-file-import"></i> Importar JSON
          </button>
          <input type="file" accept=".json" id="import-file" style="display:none;">
        </div>

        <div class="form-group" style="margin-bottom:var(--space-4);">
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
            <input type="checkbox" id="auto-backup-toggle">
            <span class="form-label" style="margin:0;">Backup Automático (cada 5 min si hay cambios)</span>
          </label>
        </div>

        <div id="quota-display" style="margin-bottom:var(--space-4);font-size:var(--text-sm);color:var(--color-text-secondary);">
          Verificando almacenamiento...
        </div>

        <div id="snapshot-list">
          <p style="color:var(--color-text-secondary);font-size:var(--text-sm);">Cargando snapshots...</p>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Sincronización GitHub</h3>
        <div class="settings-section__desc">Subí automáticamente los snapshots a tu repositorio de GitHub.</div>

        <div class="form-group">
          <label class="form-label">Token de GitHub</label>
          <input type="password" class="form-input" id="github-token" placeholder="ghp_..." autocomplete="off">
          <p style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:var(--space-1);">Dejar vacío para mantener el token actual</p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-3);">
          <div class="form-group">
            <label class="form-label">Owner</label>
            <input type="text" class="form-input" id="github-owner" placeholder="usuario" value="${escapeHtml(this.githubConfig.owner)}">
          </div>
          <div class="form-group">
            <label class="form-label">Repo</label>
            <input type="text" class="form-input" id="github-repo" placeholder="repositorio" value="${escapeHtml(this.githubConfig.repo)}">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:var(--space-4);">
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
            <input type="checkbox" id="github-auto-sync" ${this.githubConfig.autoSync ? 'checked' : ''}>
            <span class="form-label" style="margin:0;">Subir automáticamente cada snapshot a GitHub</span>
          </label>
        </div>

        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
          <button class="btn btn-primary" id="github-test-btn">
            <i class="fa-solid fa-plug"></i> Probar Conexión
          </button>
          <button class="btn btn-secondary" id="github-save-btn">
            <i class="fa-solid fa-floppy-disk"></i> Guardar Configuración
          </button>
          <button class="btn btn-secondary" id="github-upload-btn">
            <i class="fa-solid fa-cloud-arrow-up"></i> Subir último snapshot
          </button>
          <button class="btn btn-success" id="github-fetch-btn" style="margin-left:auto;">
            <i class="fa-solid fa-download"></i> Traer datos
          </button>
        </div>
        <div id="github-status" style="margin-top:var(--space-3);font-size:var(--text-sm);"></div>
      </div>

      <div class="settings-section" id="logs-section">
        <h3 class="settings-section__title">Registros del Sistema</h3>
        <div class="settings-section__desc">Errores y advertencias recientes para depuración.</div>
        <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3);">
          <button class="btn btn-sm btn-secondary" id="refresh-logs-btn">
            <i class="fa-solid fa-rotate"></i> Actualizar
          </button>
          <button class="btn btn-sm btn-danger" id="clear-logs-btn">
            <i class="fa-solid fa-trash"></i> Limpiar
          </button>
        </div>
        <div id="log-entries">
          <p style="color:var(--color-text-secondary);font-size:var(--text-sm);">Sin registros.</p>
        </div>
      </div>

      <div style="margin-top:var(--space-6);">
        <button class="btn btn-secondary" id="reset-settings" style="margin-right:var(--space-3);">
          <i class="fa-solid fa-rotate-left"></i> Restablecer Defectos
        </button>
        <button class="btn btn-primary btn-lg" id="save-settings">
          <i class="fa-solid fa-floppy-disk"></i> Guardar Configuración
        </button>
      </div>
    `;

    this.attachEvents();
  }

  async attachEvents() {
    const uploadBtn = document.getElementById('upload-logo-btn');
    const logoInput = document.getElementById('setting-logo');
    const removeBtn = document.getElementById('remove-logo-btn');
    const exportBtn = document.getElementById('export-backup');
    const importBtn = document.getElementById('import-backup');
    const importFile = document.getElementById('import-file');
    const saveBtn = document.getElementById('save-settings');
    const resetBtn = document.getElementById('reset-settings');
    const createSnapshotBtn = document.getElementById('create-snapshot-btn');
    const autoToggle = document.getElementById('auto-backup-toggle');
    const copyShopUrl = document.getElementById('copy-shop-url');

    copyShopUrl?.addEventListener('click', () => {
      navigator.clipboard.writeText(`${window.location.origin}#shop`).then(() => {
        Toast.success('Enlace copiado', 'El link del shop fue copiado al portapapeles');
      });
    });

    uploadBtn?.addEventListener('click', () => logoInput?.click());

    logoInput?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }

      if (!file.type.startsWith('image/')) {
        Toast.error('Error', 'Seleccioná un archivo de imagen válido');
        return;
      }

      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > 200 || height > 200) {
            const ratio = Math.min(200 / width, 200 / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          this.logoDataUrl = canvas.toDataURL('image/png');
          const preview = document.getElementById('logo-preview');
          preview.innerHTML = `
            <img src="${this.logoDataUrl}" alt="Logo del negocio" style="max-width:200px;max-height:200px;border-radius:var(--radius-lg);border:1px solid var(--color-border);">
            <button class="btn btn-sm btn-danger" id="remove-logo-btn" style="margin-top:var(--space-2);">Eliminar</button>
          `;
          preview.style.display = 'block';
          document.getElementById('remove-logo-btn')?.addEventListener('click', () => this.removeLogo());
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    removeBtn?.addEventListener('click', () => this.removeLogo());

    exportBtn?.addEventListener('click', () => exportDatabase());

    importBtn?.addEventListener('click', () => importFile?.click());

    importFile?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const result = await backupManager.importFromFile(file);
        Toast.success('Importación exitosa', `Se importaron ${result.items} registros en ${result.stores} stores`);
        await this.load();
        state.set('settings', this.settings);
      } catch (error) {
        Toast.error('Error de importación', error.message || 'No se pudo importar el backup');
      }
    });

    createSnapshotBtn?.addEventListener('click', async () => {
      createSnapshotBtn.disabled = true;
      createSnapshotBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando...';
      try {
        await backupManager.createSnapshot('Snapshot manual');
        Toast.success('Snapshot creado', 'Backup completo del sistema');
        this.loadSnapshots();
      } catch (err) {
        Toast.error('Error', err.message);
      }
      createSnapshotBtn.disabled = false;
      createSnapshotBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Crear Snapshot';
    });

    autoToggle?.addEventListener('change', () => {
      if (autoToggle.checked) {
        backupManager.startAutoBackup();
        Toast.success('Auto-backup activado', 'Se creará un snapshot cada 5 minutos si hay cambios');
      } else {
        backupManager.stopAutoBackup();
      }
    });

    if (backupManager.isAutoBackupRunning()) {
      autoToggle.checked = true;
    }

    saveBtn?.addEventListener('click', () => this.save());

    resetBtn?.addEventListener('click', () => {
      Modal.show({
        title: 'Confirmar Restablecer',
        body: '<p>¿Estás seguro de restablecer todos los valores por defecto?</p>',
        footer: `
          <button class="btn btn-secondary" id="cancel-reset">Cancelar</button>
          <button class="btn btn-danger" id="confirm-reset">Restablecer</button>
        `
      });

      requestAnimationFrame(() => {
        document.getElementById('cancel-reset')?.addEventListener('click', () => Modal.close());
        document.getElementById('confirm-reset')?.addEventListener('click', () => {
          Modal.close();
          this.resetToDefaults();
        });
      });
    });

    this.loadSnapshots();
    this.updateQuota();
    this.attachLogEvents();
    this.attachGitHubEvents();
  }

  attachGitHubEvents() {
    const testBtn = document.getElementById('github-test-btn');
    const saveBtn = document.getElementById('github-save-btn');
    const statusEl = document.getElementById('github-status');

    testBtn?.addEventListener('click', async () => {
      const token = document.getElementById('github-token')?.value?.trim();
      const owner = document.getElementById('github-owner')?.value?.trim();
      const repo = document.getElementById('github-repo')?.value?.trim();

      if (!token || !owner || !repo) {
        Toast.error('Error', 'Completá token, owner y repo');
        return;
      }

      testBtn.disabled = true;
      testBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Probando...';
      statusEl.innerHTML = '<span style="color:var(--color-text-secondary);">Verificando conexión...</span>';

      try {
        await testConnection(token, owner, repo);
        statusEl.innerHTML = '<span style="color:var(--color-success);">Conexión exitosa</span>';
        Toast.success('Éxito', 'Conexión verificada correctamente');
      } catch (err) {
        statusEl.innerHTML = `<span style="color:var(--color-danger);">Error: ${escapeHtml(err.message)}</span>`;
        Toast.error('Error', err.message);
      } finally {
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Probar Conexión';
      }
    });

    saveBtn?.addEventListener('click', () => {
      const tokenInput = document.getElementById('github-token')?.value?.trim();
      const token = tokenInput || this.githubConfig.token || '';
      const owner = document.getElementById('github-owner')?.value?.trim();
      const repo = document.getElementById('github-repo')?.value?.trim();
      const autoSync = document.getElementById('github-auto-sync')?.checked || false;

      const config = { token, owner, repo, autoSync };
      saveGitHubConfig(config);
      this.githubConfig = config;
      backupManager.setGitHubConfig(config);

      statusEl.innerHTML = '<span style="color:var(--color-success);">Configuración guardada</span>';
      Toast.success('Guardado', 'Configuración de GitHub guardada');
    });

    const uploadBtn = document.getElementById('github-upload-btn');
    uploadBtn?.addEventListener('click', async () => {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
      try {
        const result = await backupManager.syncSnapshotToGitHub();
        statusEl.innerHTML = `<span style="color:var(--color-success);">Subido: ${escapeHtml(result.label)} (${result.items} registros)</span>`;
        Toast.success('Subido a GitHub', `${result.label}: ${result.items} registros`);
      } catch (err) {
        statusEl.innerHTML = `<span style="color:var(--color-danger);">Error: ${escapeHtml(err.message)}</span>`;
        Toast.error('Error al subir', err.message);
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Subir último snapshot';
      }
    });

    const fetchBtn = document.getElementById('github-fetch-btn');
    fetchBtn?.addEventListener('click', () => {
      const owner = document.getElementById('github-owner')?.value?.trim();
      const repo = document.getElementById('github-repo')?.value?.trim();

      if (!owner || !repo) {
        Toast.error('Error', 'Completá owner y repo primero');
        return;
      }

      Modal.show({
        title: 'Descargar datos de GitHub',
        body: '<p>Para descargar datos desde GitHub necesitás confirmar.</p>',
        footer: `
          <button class="btn btn-secondary" id="modal-cancel-btn">Cancelar</button>
          <button class="btn btn-danger" id="modal-confirm-fetch">Descargar y reemplazar</button>
        `
      });

      document.getElementById('modal-cancel-btn')?.addEventListener('click', () => Modal.close());
      document.getElementById('modal-confirm-fetch')?.addEventListener('click', async () => {
        Modal.close();
        fetchBtn.disabled = true;
        fetchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Descargando...';

        try {
          const data = await downloadFile(owner, repo);
          const backupData = data?.data || data;
          if (!backupData || typeof backupData !== 'object') {
            throw new Error('Formato de backup inválido');
          }
          await backupManager.restoreFromData(backupData);
          statusEl.innerHTML = '<span style="color:var(--color-success);">Datos restaurados. Recargando...</span>';
          Toast.success('Restaurado', 'Datos descargados de GitHub. Recargando...');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          statusEl.innerHTML = `<span style="color:var(--color-danger);">Error: ${escapeHtml(err.message)}</span>`;
          Toast.error('Error', err.message);
        } finally {
          fetchBtn.disabled = false;
          fetchBtn.innerHTML = '<i class="fa-solid fa-download"></i> Traer datos';
        }
      });
    });
  }

  attachLogEvents() {
    const refreshBtn = document.getElementById('refresh-logs-btn');
    const clearBtn = document.getElementById('clear-logs-btn');

    refreshBtn?.addEventListener('click', () => this.renderLogs());
    clearBtn?.addEventListener('click', () => {
      logger.clear();
      this.renderLogs();
      Toast.success('Registros', 'Registros eliminados');
    });

    this.renderLogs();
  }

  renderLogs() {
    const container = document.getElementById('log-entries');
    if (!container) {
      return;
    }

    const entries = logger.getWarningsAndErrors();
    if (entries.length === 0) {
      container.innerHTML =
        '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);">Sin registros de errores o advertencias.</p>';
      return;
    }

    const html = entries
      .slice(-50)
      .reverse()
      .map(
        e => `
      <div class="log-entry log-entry--${e.level}" title="${escapeHtml(e.message)}">
        <span class="log-entry__time">${e.timestamp.toLocaleTimeString()}</span>
        <span class="log-entry__module">${escapeHtml(e.module)}</span>
        <span class="log-entry__message">${escapeHtml(e.message)}</span>
      </div>
    `
      )
      .join('');

    container.innerHTML = html;
  }

  async loadSnapshots() {
    const container = document.getElementById('snapshot-list');
    if (!container) {
      return;
    }

    try {
      const snapshots = await backupManager.listSnapshots();
      if (snapshots.length === 0) {
        container.innerHTML =
          '<div class="empty-state"><div class="empty-state__icon"><i class="fa-solid fa-camera"></i></div><h3 class="empty-state__title">Sin snapshots</h3><p class="empty-state__description">Creá tu primer snapshot para proteger tus datos.</p></div>';
        return;
      }

      const typeLabels = {
        manual: 'Manual',
        automatic: 'Automático',
        'pre-import': 'Pre-import',
        'post-import': 'Post-import'
      };

      container.innerHTML = `
        <p style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-bottom:var(--space-2);font-weight:var(--font-semibold);">
          SNAPSHOTS GUARDADOS (${snapshots.length})
        </p>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);">
          ${snapshots
            .map(s => {
              const date = new Date(s.createdAt).toLocaleString('es-AR');
              return `
              <div class="settings-snapshot-item">
                <div class="settings-snapshot-item__info">
                  <strong>${escapeHtml(s.label)}</strong>
                  <span class="settings-snapshot-item__meta">
                    ${date} · ${s.summary.items} registros ·
                    <span class="badge badge-${s.type === 'automatic' ? 'warning' : 'primary'}">${typeLabels[s.type] || s.type}</span>
                  </span>
                </div>
                <div class="settings-snapshot-item__actions">
                  <button class="btn btn-sm btn-primary" data-upload="${s.id}" title="Subir a GitHub">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                  </button>
                  <button class="btn btn-sm btn-secondary" data-restore="${s.id}" title="Restaurar">
                    <i class="fa-solid fa-rotate-left"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" data-delete="${s.id}" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `;

      container.querySelectorAll('[data-restore]').forEach(btn => {
        btn.addEventListener('click', async () => {
          Modal.show({
            title: 'Restaurar Snapshot',
            body: '<p>¿Estás seguro de restaurar este snapshot?<br><span style="color:var(--color-warning);font-size:var(--text-sm);">Todos los datos actuales serán reemplazados.</span></p>',
            footer: `
              <button class="btn btn-secondary" id="cancel-restore">Cancelar</button>
              <button class="btn btn-danger" id="confirm-restore">Restaurar</button>
            `
          });
          document.getElementById('cancel-restore')?.addEventListener('click', () => Modal.close());
          document.getElementById('confirm-restore')?.addEventListener('click', async () => {
            Modal.close();
            try {
              const result = await backupManager.restoreSnapshot(btn.dataset.restore);
              Toast.success('Restaurado', `Snapshot restaurado: ${result.items} registros en ${result.stores} stores`);
              if (state.get('currentRoute') === 'settings') {
                this.load();
              } else {
                window.location.reload();
              }
            } catch (err) {
              Toast.error('Error al restaurar', err.message);
            }
          });
        });
      });

      container.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await backupManager.deleteSnapshot(btn.dataset.delete);
            Toast.success('Snapshot eliminado');
            this.loadSnapshots();
          } catch (err) {
            Toast.error('Error', err.message);
          }
        });
      });

      container.querySelectorAll('[data-upload]').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
          try {
            const result = await backupManager.syncSnapshotToGitHub(btn.dataset.upload);
            Toast.success('Subido a GitHub', `${result.label}: ${result.items} registros`);
          } catch (err) {
            Toast.error('Error al subir', err.message);
          } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i>';
          }
        });
      });
    } catch {
      container.innerHTML = '<p style="color:var(--color-danger);">Error al cargar snapshots</p>';
    }
  }

  async updateQuota() {
    const container = document.getElementById('quota-display');
    if (!container) {
      return;
    }

    try {
      const quota = await backupManager.checkStorageQuota();
      if (quota.supported) {
        const used = (quota.used / (1024 * 1024)).toFixed(1);
        const total = (quota.quota / (1024 * 1024)).toFixed(1);
        const isWarning = quota.percentage > 80;
        container.innerHTML = `
          <span style="color:${isWarning ? 'var(--color-warning)' : 'var(--color-text-secondary)'}">
            <i class="fa-solid fa-database"></i>
            Almacenamiento: ${used} MB / ${total} MB (${quota.percentage}%)
            ${isWarning ? ' - Almacenamiento casi lleno' : ''}
          </span>
        `;
      } else {
        container.innerHTML =
          '<span style="color:var(--color-text-secondary);"><i class="fa-solid fa-database"></i> No se puede verificar el almacenamiento en este navegador.</span>';
      }
    } catch {
      container.innerHTML = '';
    }
  }

  removeLogo() {
    this.logoDataUrl = '';
    const preview = document.getElementById('logo-preview');
    if (preview) {
      preview.style.display = 'none';
      preview.innerHTML = '';
    }
  }

  async save() {
    const settings = [
      { key: 'businessName', value: document.getElementById('setting-businessName')?.value || '' },
      { key: 'currency', value: document.getElementById('setting-currency')?.value || 'ARS' },
      { key: 'currencySymbol', value: document.getElementById('setting-currencySymbol')?.value || '$' },
      { key: 'ticketFooter', value: document.getElementById('setting-ticketFooter')?.value || '' },
      { key: 'logo', value: this.logoDataUrl },
      { key: 'taxEnabled', value: (document.getElementById('setting-tax-enabled')?.checked || false).toString() },
      { key: 'taxRate', value: document.getElementById('setting-taxRate')?.value || '21' },
      { key: 'shop_enabled', value: (document.getElementById('setting-shop-enabled')?.checked || false).toString() },
      { key: 'shop_whatsapp', value: document.getElementById('setting-shop-whatsapp')?.value || '' },
      { key: 'shop_primary_color', value: document.getElementById('setting-shop-color')?.value || '#7C3AED' },
      { key: 'shop_hours_open', value: document.getElementById('setting-shop-open')?.value || '09:00' },
      { key: 'shop_hours_close', value: document.getElementById('setting-shop-close')?.value || '23:00' },
      {
        key: 'shop_takeaway_enabled',
        value: (document.getElementById('setting-shop-takeaway')?.checked || false).toString()
      },
      {
        key: 'shop_delivery_enabled',
        value: (document.getElementById('setting-shop-delivery')?.checked || false).toString()
      },
      { key: 'shop_min_delivery', value: document.getElementById('setting-shop-min-delivery')?.value || '0' },
      { key: 'shop_delivery_cost', value: document.getElementById('setting-shop-delivery-cost')?.value || '0' },
      { key: 'shop_banner', value: document.getElementById('setting-shop-banner')?.value || '' },
      { key: 'theme', value: document.getElementById('setting-theme')?.checked || false ? 'dark' : 'light' }
    ];

    try {
      const existingSettings = await settingRepo.findAll();
      const existingMap = {};
      existingSettings.forEach(s => {
        existingMap[s.key] = s;
      });

      const toSave = settings.map(s => ({
        ...s,
        id: existingMap[s.key]?.id || undefined
      }));

      await settingRepo.saveAll(toSave);

      this.settings = {};
      settings.forEach(s => {
        this.settings[s.key] = s.value;
      });
      state.set('settings', this.settings);
      state.emit('data:settings-changed', this.settings);

      Toast.success('Éxito', 'Configuración guardada correctamente');
    } catch (error) {
      logger.error('Settings', 'Error saving settings', error);
      Toast.error('Error', `No se pudo guardar: ${error.message}`);
    }
  }

  async resetToDefaults() {
    const defaults = [
      { key: 'businessName', value: 'Mi Negocio' },
      { key: 'currency', value: 'ARS' },
      { key: 'currencySymbol', value: '$' },
      { key: 'ticketFooter', value: 'Gracias por su compra!' },
      { key: 'logo', value: '' },
      { key: 'taxEnabled', value: 'true' },
      { key: 'taxRate', value: '21' },
      { key: 'shop_enabled', value: 'false' },
      { key: 'shop_whatsapp', value: '' },
      { key: 'shop_primary_color', value: '#7C3AED' },
      { key: 'shop_hours_open', value: '09:00' },
      { key: 'shop_hours_close', value: '23:00' },
      { key: 'shop_takeaway_enabled', value: 'true' },
      { key: 'shop_delivery_enabled', value: 'true' },
      { key: 'shop_min_delivery', value: '0' },
      { key: 'shop_delivery_cost', value: '0' },
      { key: 'shop_banner', value: '' },
      { key: 'theme', value: 'light' }
    ];

    try {
      const existingSettings = await settingRepo.findAll();
      const existingMap = {};
      existingSettings.forEach(s => {
        existingMap[s.key] = s;
      });

      const toSave = defaults.map(s => ({
        ...s,
        id: existingMap[s.key]?.id || undefined
      }));

      await settingRepo.saveAll(toSave);

      this.logoDataUrl = '';
      Toast.success('Éxito', 'Configuración restablecida');
      await this.load();
      state.set('settings', this.settings);
      state.emit('data:settings-changed', this.settings);
    } catch (error) {
      logger.error('Settings', 'Error resetting settings', error);
      Toast.error('Error', `No se pudo restablecer: ${error.message}`);
    }
  }
}

export default new Settings();
