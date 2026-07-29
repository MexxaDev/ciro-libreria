'use strict';

import { paymentMethodRepo } from '../../db/repositories.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import { escapeHtml } from '../../utils/sanitizer.js';
import { logger } from '../../utils/logger.js';
import state from '../../js/state.js';

class PaymentMethods {
  constructor() {
    this.methods = [];
  }

  async load() {
    const container = document.getElementById('payment-methods-content');
    if (container) {
      container.innerHTML =
        '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando medios de pago...</div>';
    }
    try {
      this.methods = await paymentMethodRepo.findAll();
      this.render();
    } catch (error) {
      logger.error('PaymentMethods', 'Error loading payment methods:', error);
      Toast.error('Error', 'No se pudieron cargar los medios de pago');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h3 class="empty-state__title">Error al cargar</h3>
            <p class="empty-state__description">No se pudieron cargar los medios de pago.</p>
            <button class="btn btn-primary" id="retry-load-methods">Reintentar</button>
          </div>
        `;
        document.getElementById('retry-load-methods')?.addEventListener('click', () => this.load());
      }
    }
  }

  render() {
    const container = document.getElementById('payment-methods-content');
    if (!container) {
      return;
    }

    if (this.methods.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fa-solid fa-credit-card"></i></div>
          <h3 class="empty-state__title">No hay medios de pago</h3>
          <p class="empty-state__description">Agregá tu primer medio de pago.</p>
          <button class="btn btn-primary" id="add-first-method">+ Nuevo Medio de Pago</button>
        </div>
      `;
      document.getElementById('add-first-method')?.addEventListener('click', () => this.openModal());
      return;
    }

    let html = `
      <div class="products-toolbar">
        <div></div>
        <button class="btn btn-primary" id="add-method-btn">+ Nuevo Medio de Pago</button>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Color</th>
              <th>ID</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    this.methods.forEach((method, index) => {
      html += `
        <tr data-index="${index}">
          <td><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${escapeHtml(method.color || '#888')};vertical-align:middle;"></span></td>
          <td><code>${escapeHtml(method.id)}</code></td>
          <td>${escapeHtml(method.label)}</td>
          <td><span class="badge badge-${method.enabled ? 'success' : 'danger'}">${method.enabled ? 'Activo' : 'Inactivo'}</span></td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-ghost" data-action="edit" data-index="${index}">Editar</button>
              <button class="btn btn-sm btn-danger" data-action="delete" data-index="${index}">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;

    document.getElementById('add-method-btn')?.addEventListener('click', () => this.openModal());

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index);
        const method = this.methods[index];

        if (action === 'edit') {
          this.openModal(method);
        } else if (action === 'delete') {
          this.deleteMethod(method.id);
        }
      });
    });
  }

  openModal(method = null) {
    const isEdit = !!method;
    const title = isEdit ? 'Editar Medio de Pago' : 'Nuevo Medio de Pago';

    const body = `
      <div class="form-group">
        <label class="form-label" for="pm-id">ID (identificador único)</label>
        <input type="text" class="form-input" id="pm-id" value="${escapeHtml(method ? method.id : '')}" ${isEdit ? 'disabled' : ''} placeholder="ej: cash, debit, mp" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="pm-label">Nombre visible</label>
        <input type="text" class="form-input" id="pm-label" value="${escapeHtml(method ? method.label : '')}" placeholder="ej: Efectivo, Mercado Pago" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="pm-color">Color</label>
        <input type="color" class="form-input" id="pm-color" value="${method && method.color ? method.color : '#10B981'}" style="height:40px;padding:4px;">
      </div>
      <div class="form-group">
        <label class="form-label">
          <input type="checkbox" id="pm-enabled" ${!method || method.enabled !== false ? 'checked' : ''}> Activo
        </label>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="pm-cancel">Cancelar</button>
      <button class="btn btn-primary" id="pm-save">Guardar</button>
    `;

    Modal.show({ title, body, footer });

    document.getElementById('pm-cancel')?.addEventListener('click', () => Modal.close());

    document.getElementById('pm-save')?.addEventListener('click', async () => {
      const id = document.getElementById('pm-id').value.trim();
      const label = document.getElementById('pm-label').value.trim();
      const color = document.getElementById('pm-color').value;
      const enabled = document.getElementById('pm-enabled').checked;

      if (!id) {
        Toast.error('Error', 'El ID es obligatorio');
        return;
      }
      if (!label) {
        Toast.error('Error', 'El nombre es obligatorio');
        return;
      }
      if (!isEdit) {
        const exists = this.methods.find(m => m.id === id);
        if (exists) {
          Toast.error('Error', 'Ya existe un medio de pago con ese ID');
          return;
        }
      }

      try {
        if (isEdit) {
          await paymentMethodRepo.update({ ...method, label, color, enabled });
          Toast.success('Éxito', 'Medio de pago actualizado');
        } else {
          await paymentMethodRepo.create({ id, label, color, enabled });
          Toast.success('Éxito', 'Medio de pago creado');
        }
        Modal.close();
        state.emit('data:payment-methods-changed');
        this.load();
      } catch (error) {
        logger.error('PaymentMethods', 'Error saving payment method:', error);
        Toast.error('Error', 'No se pudo guardar el medio de pago');
      }
    });
  }

  async deleteMethod(id) {
    Modal.show({
      title: 'Confirmar Eliminación',
      body: '<p>¿Estás seguro de eliminar este medio de pago?</p>',
      footer: `
        <button class="btn btn-secondary" id="cancel-del-pm">Cancelar</button>
        <button class="btn btn-danger" id="confirm-del-pm">Eliminar</button>
      `
    });
    document.getElementById('cancel-del-pm')?.addEventListener('click', () => Modal.close());
    document.getElementById('confirm-del-pm')?.addEventListener('click', async () => {
      try {
        await paymentMethodRepo.delete(id);
        Toast.success('Éxito', 'Medio de pago eliminado');
        Modal.close();
        state.emit('data:payment-methods-changed');
        this.load();
      } catch (error) {
        logger.error('PaymentMethods', 'Error deleting payment method:', error);
        Toast.error('Error', 'No se pudo eliminar el medio de pago');
      }
    });
  }
}

export default new PaymentMethods();
