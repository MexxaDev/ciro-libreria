'use strict';

import { customerRepo, saleRepo } from '../../db/repositories.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import { validateCustomer } from '../../utils/validators.js';
import { escapeHtml } from '../../utils/sanitizer.js';
import { format } from '../../utils/currency.js';
import { logger } from '../../utils/logger.js';
import state from '../../js/state.js';

class Customers {
  constructor() {
    this.customers = [];
    this._pageSize = 20;
    this._currentPage = 1;
  }

  get _totalPages() {
    return Math.max(1, Math.ceil(this.customers.length / this._pageSize));
  }

  get _pageData() {
    const start = (this._currentPage - 1) * this._pageSize;
    return this.customers.slice(start, start + this._pageSize);
  }

  async load() {
    const container = document.getElementById('customers-content') || document.getElementById('customers');
    if (container) {
      container.innerHTML =
        '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando clientes...</div>';
    }
    try {
      this.customers = await customerRepo.findAll();
      this.render();
    } catch (error) {
      logger.error('Customers', 'Error loading customers:', error);
      Toast.error('Error', 'No se pudieron cargar los clientes');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h3 class="empty-state__title">Error al cargar</h3>
            <p class="empty-state__description">No se pudieron cargar los clientes.</p>
            <button class="btn btn-sm btn-primary" id="retry-customers">Reintentar</button>
          </div>
        `;
        document.getElementById('retry-customers')?.addEventListener('click', () => this.load());
      }
    }
  }

  render() {
    const container = document.getElementById('customers-content');
    if (!container) {
      return;
    }

    if (this.customers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fa-solid fa-users"></i></div>
          <h3 class="empty-state__title">No hay clientes</h3>
          <p class="empty-state__description">Agregá tu primer cliente.</p>
          <button class="btn btn-primary" id="add-first-customer">+ Nuevo Cliente</button>
        </div>
      `;
      document.getElementById('add-first-customer')?.addEventListener('click', () => this.openModal());
      return;
    }

    let html = `
      <div class="products-toolbar">
        <div class="products-search">
          <input type="text" class="form-input" placeholder="Buscar clientes..." id="customer-search">
        </div>
        <button class="btn btn-primary" id="add-customer-btn">+ Nuevo Cliente</button>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Dirección</th>
              <th>Saldo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    const customers = this._pageData;
    const offset = (this._currentPage - 1) * this._pageSize;

    customers.forEach((customer, i) => {
      const index = offset + i;
      const saldo = parseFloat(customer.balance) || 0;
      const isDefault = customer.id === 'cust_final' || customer.isDefault;
      html += `
        <tr data-index="${index}">
          <td>${escapeHtml(customer.name)}${isDefault ? ' <span class="badge badge-info" style="font-size:0.7em;">Sistema</span>' : ''}</td>
          <td>${escapeHtml(customer.phone || '-')}</td>
          <td>${escapeHtml(customer.address || '-')}</td>
          <td style="font-weight:var(--font-semibold);">${format(saldo)}</td>
          <td>
            <div class="flex gap-2">
              ${!isDefault ? `<button class="btn btn-sm btn-ghost" data-action="add-balance" data-index="${index}">+ Saldo</button>` : ''}
              ${!isDefault ? `<button class="btn btn-sm btn-ghost" data-action="edit" data-index="${index}">Editar</button>` : ''}
              ${!isDefault ? `<button class="btn btn-sm btn-danger" data-action="delete" data-index="${index}">Eliminar</button>` : ''}
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

    if (this._totalPages > 1) {
      const cp = this._currentPage;
      const tp = this._totalPages;
      let pages = '';
      const btn = (p, label = p, cls = '') =>
        `<button class="pagination-btn ${cls}${p === cp ? ' pagination-btn--active' : ''}" data-customer-page="${p}">${label}</button>`;

      if (tp <= 7) {
        for (let i = 1; i <= tp; i++) {
          pages += btn(i);
        }
      } else {
        pages += btn(1);
        if (cp > 3) {
          pages += '<span class="pagination-ellipsis">...</span>';
        }
        const s = Math.max(2, cp - 1);
        const e = Math.min(tp - 1, cp + 1);
        for (let i = s; i <= e; i++) {
          pages += btn(i);
        }
        if (cp < tp - 2) {
          pages += '<span class="pagination-ellipsis">...</span>';
        }
        pages += btn(tp);
      }

      html += `<div class="pagination">${btn(cp - 1, '‹', 'pagination-btn--prev')}${pages}${btn(cp + 1, '›', 'pagination-btn--next')}</div>`;
    }

    container.innerHTML = html;

    document.getElementById('add-customer-btn')?.addEventListener('click', () => this.openModal());
    document.getElementById('customer-search')?.addEventListener('input', e => this.search(e.target.value));

    container.querySelectorAll('[data-customer-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.customerPage);
        if (!page || page < 1 || page > this._totalPages) {
          return;
        }
        this._currentPage = page;
        this.render();
      });
    });

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index);
        const customer = this.customers[index];

        if (action === 'edit') {
          this.openModal(customer);
        } else if (action === 'delete') {
          this.deleteCustomer(customer.id);
        } else if (action === 'add-balance') {
          this.openAddBalance(customer);
        }
      });
    });
  }

  search(query) {
    if (!query) {
      this.render();
      return;
    }
    const filtered = this.customers.filter(
      c => c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone && c.phone.includes(query))
    );
    this._currentPage = 1;
    const prevData = this.customers;
    this.customers = filtered;
    this.render();
    this.customers = prevData;
    const searchInput = document.getElementById('customer-search');
    if (searchInput) {
      searchInput.value = query;
      searchInput.focus();
    }
  }

  openModal(customer = null) {
    const isEdit = !!customer;
    const title = isEdit ? 'Editar Cliente' : 'Nuevo Cliente';

    const body = `
      <div class="form-group">
        <label class="form-label" for="cust-name">Nombre</label>
        <input type="text" class="form-input" id="cust-name" value="${escapeHtml(customer ? customer.name : '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="cust-phone">Teléfono</label>
        <input type="text" class="form-input" id="cust-phone" value="${escapeHtml(customer ? customer.phone : '')}">
      </div>
      <div class="form-group">
        <label class="form-label" for="cust-address">Dirección</label>
        <input type="text" class="form-input" id="cust-address" value="${escapeHtml(customer ? customer.address : '')}">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="cust-cancel">Cancelar</button>
      <button class="btn btn-primary" id="cust-save">Guardar</button>
    `;

    Modal.show({ title, body, footer });

    document.getElementById('cust-cancel').addEventListener('click', () => Modal.close());

    document.getElementById('cust-save').addEventListener('click', async () => {
      const name = document.getElementById('cust-name').value;
      const phone = document.getElementById('cust-phone').value;
      const address = document.getElementById('cust-address').value;

      const errors = validateCustomer({ name });
      if (errors.length) {
        Toast.error('Error', errors[0]);
        return;
      }

      try {
        if (isEdit) {
          await customerRepo.update({ ...customer, name, phone, address });
          Toast.success('Éxito', 'Cliente actualizado');
        } else {
          await customerRepo.create({
            id: `cust_${Date.now()}`,
            name,
            phone,
            address,
            balance: 0,
            createdAt: new Date().toISOString()
          });
          Toast.success('Éxito', 'Cliente creado');
        }
        Modal.close();
        state.emit('data:customers-changed');
        this.load();
      } catch (error) {
        Toast.error('Error', 'No se pudo guardar el cliente');
      }
    });
  }

  openAddBalance(customer) {
    const body = `
      <div style="margin-bottom:var(--space-3);">
        <strong>${customer.name}</strong><br>
        <span style="color:var(--color-text-secondary);font-size:var(--text-sm);">Saldo actual: ${format(customer.balance || 0)}</span>
      </div>
      <div class="form-group">
        <label class="form-label" for="balance-amount">Monto a agregar</label>
        <input type="number" class="form-input" id="balance-amount" min="0" step="0.01" placeholder="0.00">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="bal-cancel">Cancelar</button>
      <button class="btn btn-primary" id="bal-save">Agregar</button>
    `;

    Modal.show({ title: 'Agregar Saldo', body, footer });

    document.getElementById('bal-cancel').addEventListener('click', () => Modal.close());

    document.getElementById('bal-save').addEventListener('click', async () => {
      const amount = parseFloat(document.getElementById('balance-amount').value);
      if (!amount || amount <= 0) {
        Toast.error('Error', 'Ingresá un monto válido');
        return;
      }

      try {
        const newBalance = (customer.balance || 0) + amount;
        await customerRepo.update({ ...customer, balance: newBalance });
        customer.balance = newBalance;
        Toast.success('Éxito', `Se agregaron ${format(amount)} al saldo`);
        Modal.close();
        state.emit('data:customers-changed');
        this.load();
      } catch (error) {
        Toast.error('Error', 'No se pudo actualizar el saldo');
      }
    });
  }

  async deleteCustomer(id) {
    if (id === 'cust_final') {
      Toast.error('Error', 'No se puede eliminar el cliente por defecto');
      return;
    }

    Modal.show({
      title: 'Confirmar Eliminación',
      body: '<p>¿Estás seguro de eliminar este cliente?</p>',
      footer: `
        <button class="btn btn-secondary" id="cancel-del-cust">Cancelar</button>
        <button class="btn btn-danger" id="confirm-del-cust">Eliminar</button>
      `
    });
    document.getElementById('cancel-del-cust')?.addEventListener('click', () => Modal.close());
    document.getElementById('confirm-del-cust')?.addEventListener('click', async () => {
      try {
        const sales = await saleRepo.query('customerId', id);
        if (sales && sales.length > 0) {
          Toast.error('Error', 'No se puede eliminar: el cliente tiene ventas asociadas');
          Modal.close();
          return;
        }
        await customerRepo.delete(id);
        Toast.success('Éxito', 'Cliente eliminado');
        Modal.close();
        state.emit('data:customers-changed');
        this.load();
      } catch (error) {
        Toast.error('Error', 'No se pudo eliminar el cliente');
      }
    });
  }
}

export default new Customers();
