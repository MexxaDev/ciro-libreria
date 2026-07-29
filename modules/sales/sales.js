'use strict';

import { saleRepo, customerRepo } from '../../db/repositories.js';
import Table from '../../components/table.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import { SALES_COLUMNS, SALES_ACTIONS, prepareSaleRows, showSaleDetail } from './salesTable.js';
import { getPayments } from '../../utils/payments.js';
import { format } from '../../utils/currency.js';
import { escapeHtml } from '../../utils/sanitizer.js';
import { logger } from '../../utils/logger.js';
import state from '../../js/state.js';
import cashService from '../cash/cashService.js';

class Sales {
  constructor() {
    this.sales = [];
    this.customers = [];
    state.on('data:sales-changed', () => this.load());
  }

  async load() {
    const container = document.getElementById('sales-list');
    if (container) {
      container.innerHTML =
        '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando ventas...</div>';
    }
    try {
      this.sales = await saleRepo.findAll();
      this.customers = await customerRepo.findAll();
      this._populateCustomerFilter();
      this.render();
    } catch (error) {
      logger.error('Sales', 'Error loading sales', error);
      if (container) {
        container.innerHTML =
          '<div style="text-align:center;padding:var(--space-8);color:var(--color-danger);"><i class="fa-solid fa-triangle-exclamation" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Error al cargar las ventas</div>';
      }
    }
  }

  _populateCustomerFilter() {
    const select = document.getElementById('sales-customer-filter');
    if (!select) {
      return;
    }
    select.innerHTML = '<option value="">Todos los clientes</option>';
    for (const c of this.customers) {
      select.innerHTML += `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`;
    }
  }

  async filter() {
    const dateFrom = document.getElementById('sales-date-from')?.value;
    const dateTo = document.getElementById('sales-date-to')?.value;
    const customerId = document.getElementById('sales-customer-filter')?.value;
    const paymentMethod = document.getElementById('sales-payment-filter')?.value;
    const amountMin = document.getElementById('sales-amount-min')?.value;
    const amountMax = document.getElementById('sales-amount-max')?.value;
    const includeCancelled = document.getElementById('sales-include-cancelled')?.checked;

    let filtered = [...this.sales];

    if (!includeCancelled) {
      filtered = filtered.filter(s => s.status !== 'cancelled');
    }

    if (dateFrom) {
      const [fromY, fromM, fromD] = dateFrom.split('-').map(Number);
      const fromTime = new Date(fromY, fromM - 1, fromD).getTime();
      filtered = filtered.filter(s => {
        if (!s.date) {
          return false;
        }
        return new Date(s.date).getTime() >= fromTime;
      });
    }
    if (dateTo) {
      const [toY, toM, toD] = dateTo.split('-').map(Number);
      const toTime = new Date(toY, toM - 1, toD, 23, 59, 59, 999).getTime();
      filtered = filtered.filter(s => {
        if (!s.date) {
          return false;
        }
        return new Date(s.date).getTime() <= toTime;
      });
    }
    if (customerId) {
      filtered = filtered.filter(s => s.customerId === customerId);
    }
    if (paymentMethod) {
      filtered = filtered.filter(s => s.paymentMethod === paymentMethod);
    }
    if (amountMin) {
      const min = parseFloat(amountMin);
      if (!isNaN(min)) {
        filtered = filtered.filter(s => parseFloat(s.total) >= min);
      }
    }
    if (amountMax) {
      const max = parseFloat(amountMax);
      if (!isNaN(max)) {
        filtered = filtered.filter(s => parseFloat(s.total) <= max);
      }
    }

    this.render(filtered);
  }

  _clearFilters() {
    const ids = [
      'sales-date-from',
      'sales-date-to',
      'sales-customer-filter',
      'sales-payment-filter',
      'sales-amount-min',
      'sales-amount-max'
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        el.value = '';
      }
    }
    const incl = document.getElementById('sales-include-cancelled');
    if (incl) {
      incl.checked = false;
    }
    this.filter();
  }

  _computeTotals(sales) {
    let totalVentas = 0;
    let totalEfectivo = 0;
    let totalTransferencia = 0;

    for (const sale of sales) {
      totalVentas += parseFloat(sale.total) || 0;
      const payments = getPayments(sale);
      for (const p of payments) {
        if (p.method === 'cash') {
          totalEfectivo += p.amount;
        } else if (p.method === 'transfer') {
          totalTransferencia += p.amount;
        }
      }
    }

    return { totalVentas, totalEfectivo, totalTransferencia };
  }

  render(sales = this.sales) {
    const container = document.getElementById('sales-list');
    if (!container) {
      return;
    }

    if (sales.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fa-solid fa-money-bill-wave"></i></div>
          <h3 class="empty-state__title">No hay ventas</h3>
          <p class="empty-state__description">No se encontraron ventas con los filtros seleccionados.</p>
        </div>
      `;
      return;
    }

    const totals = this._computeTotals(sales);

    const sorted = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
    const rows = prepareSaleRows(sorted, this.customers);

    container.innerHTML = `
      <div class="sales-kpi-grid">
        <div class="sales-kpi-card">
          <div class="sales-kpi-card__label">Total Ventas</div>
          <div class="sales-kpi-card__value">${format(totals.totalVentas)}</div>
        </div>
        <div class="sales-kpi-card sales-kpi-card--cash">
          <div class="sales-kpi-card__label">Total Efectivo</div>
          <div class="sales-kpi-card__value">${format(totals.totalEfectivo)}</div>
        </div>
        <div class="sales-kpi-card sales-kpi-card--transfer">
          <div class="sales-kpi-card__label">Total Transferencia</div>
          <div class="sales-kpi-card__value">${format(totals.totalTransferencia)}</div>
        </div>
      </div>
      <div id="sales-table-container"></div>
    `;

    const tableContainer = document.getElementById('sales-table-container');
    const actions = [
      ...SALES_ACTIONS,
      {
        name: 'cancel',
        label: 'Cancelar',
        class: 'btn-danger btn-sm',
        icon: 'fa-solid fa-ban',
        onClick: row => this._cancelSale(row)
      }
    ];
    const table = new Table({
      columns: SALES_COLUMNS,
      data: rows,
      actions,
      onRowClick: row => showSaleDetail(row),
      pageSize: 15
    });
    table.mount(tableContainer);
  }

  async _cancelSale(row) {
    const sale = row._sale;
    if (!sale) {
      return;
    }

    if (!cashService.currentSession) {
      Toast.error('Error', 'No hay una sesión de caja abierta. No se puede cancelar la venta.');
      return;
    }

    Modal.show({
      title: 'Confirmar Cancelación',
      body: `
        <p>¿Estás seguro de cancelar la venta <strong>#${escapeHtml(sale.id.substring(0, 8))}</strong>?</p>
        <p style="margin-top:var(--space-3);color:var(--color-danger);">
          <i class="fa-solid fa-triangle-exclamation"></i>
          Esta acción no se puede deshacer. Se revertirá el stock y los movimientos de caja.
        </p>
        <div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-md);">
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);">
            <span>Total:</span>
            <span style="font-weight:var(--font-bold);">${format(sale.total)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span>Fecha:</span>
            <span>${sale.date ? new Date(sale.date).toLocaleString('es-AR') : 'N/A'}</span>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" id="cancel-cancel-btn">Volver</button>
        <button class="btn btn-danger" id="confirm-cancel-btn"><i class="fa-solid fa-ban"></i> Sí, Cancelar Venta</button>
      `
    });

    document.getElementById('confirm-cancel-btn')?.addEventListener('click', async () => {
      try {
        await cashService.cancelSale(sale);
        Modal.close();
        Toast.success('Venta Cancelada', `La venta #${sale.id.substring(0, 8)} fue cancelada correctamente`);
      } catch (error) {
        Toast.error('Error', error.message || 'No se pudo cancelar la venta');
      }
    });

    document.getElementById('cancel-cancel-btn')?.addEventListener('click', () => Modal.close());
  }
}

export default new Sales();
