'use strict';

import Modal from '../components/modal.js';
import { format } from './currency.js';
import { getPayments, getPaymentType, getPaymentMethodLabel } from './payments.js';
import { renderTicketBody, showTicketModal } from './ticket.js';
import { escapeHtml } from './sanitizer.js';
import state from '../js/state.js';

function getPaymentMethodBadgeClass(method) {
  const map = { cash: 'success', debit: 'info', transfer: 'info', account: 'danger' };
  return map[method] || 'primary';
}

export const SALES_COLUMNS = [
  { key: '_id', label: 'ID' },
  { key: '_date', label: 'Fecha' },
  { key: '_customer', label: 'Cliente' },
  { key: '_total', label: 'Total', format: val => `<strong>${val}</strong>` },
  { key: '_method', label: 'Método', format: val => val }
];

export const SALES_ACTIONS = [
  { name: 'view', label: 'Ver', class: 'btn-ghost', icon: 'fa-solid fa-eye', onClick: row => showSaleDetail(row) }
];

export function prepareSaleRows(sales, customers) {
  const cust = customers || [];
  return (sales || []).map(sale => {
    const customer = sale.customerId ? cust.find(c => c.id === sale.customerId) : null;
    const paymentType = getPaymentType(sale);
    const methodBadge =
      paymentType === 'COMBINADO'
        ? '<span class="badge badge-warning">COMBINADO</span>'
        : `<span class="badge badge-${getPaymentMethodBadgeClass(sale.paymentMethod)}">${getPaymentMethodLabel(sale.paymentMethod)}</span>`;

    return {
      _id: sale.id ? sale.id.substring(0, 8) : 'N/A',
      _date: sale.date ? new Date(sale.date).toLocaleString('es-AR') : 'N/A',
      _customer: customer ? customer.name : 'Consumidor Final',
      _total: format(sale.total),
      _method: methodBadge,
      _sale: sale,
      _customers: cust
    };
  });
}

export function showSaleDetail(row) {
  const sale = row._sale;
  const customers = row._customers || [];
  const customer = sale.customerId ? customers.find(c => c.id === sale.customerId) : null;

  let itemsHtml = '';
  if (sale.items && Array.isArray(sale.items)) {
    sale.items.forEach(item => {
      itemsHtml += `
        <div class="sale-detail__item">
          <span>${item.quantity}x ${escapeHtml(item.name)}</span>
          <span class="sale-detail__item-qty">${format(item.subtotal || item.price * item.quantity)}</span>
        </div>
      `;
    });
  }

  const payments = getPayments(sale);
  const paymentType = getPaymentType(sale);

  const body = `
    <div class="sale-detail__meta">
      <div class="sale-detail__row">
        <span>Ticket:</span>
        <span>#${sale.id.substring(0, 8)}</span>
      </div>
      <div class="sale-detail__row">
        <span>Fecha:</span>
        <span>${sale.date ? new Date(sale.date).toLocaleString('es-AR') : 'N/A'}</span>
      </div>
      <div class="sale-detail__row">
        <span>Cliente:</span>
        <span>${customer ? escapeHtml(customer.name) : 'Consumidor Final'}</span>
      </div>
      <div class="sale-detail__payments">
        <div class="sale-detail__payments-title">Métodos de Pago</div>
        ${payments
          .map(
            p => `
          <div class="sale-detail__row">
            <span>${getPaymentMethodLabel(p.method)}</span>
            <span>${format(p.amount)}</span>
          </div>
        `
          )
          .join('')}
        ${paymentType === 'COMBINADO' ? '<div class="sale-detail__combined">Tipo: COMBINADO</div>' : ''}
      </div>
    </div>

    <div class="sale-detail__items">
      ${itemsHtml || '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);">No hay detalles de items.</p>'}
    </div>

    <div class="sale-detail__footer">
      <div class="sale-detail__total-row">
        <span>Subtotal:</span>
        <span>${format(sale.subtotal || 0)}</span>
      </div>
      <div class="sale-detail__total-row">
        <span>Descuento:</span>
        <span>-${format(sale.discount || 0)}</span>
      </div>
      <div class="sale-detail__total-final">
        <span>TOTAL:</span>
        <span>${format(sale.total || 0)}</span>
      </div>
    </div>
  `;

  Modal.show({
    title: 'Detalles de Venta',
    body,
    footer: `
      <button class="btn btn-primary" id="sale-reprint-btn">
        <i class="fa-solid fa-print"></i> Re-imprimir Ticket
      </button>
      <button class="btn btn-secondary" id="sale-details-close">Cerrar</button>
    `
  });

  document.getElementById('sale-reprint-btn')?.addEventListener('click', () => {
    Modal.close();
    reprintSaleTicket(sale);
  });
  document.getElementById('sale-details-close')?.addEventListener('click', () => Modal.close());
}

export function reprintSaleTicket(sale) {
  const settings = state.get('settings');
  const body = renderTicketBody(sale, settings);
  showTicketModal('Ticket de Venta', body);
}
