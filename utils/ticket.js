'use strict';

import Modal from '../components/modal.js';
import Toast from '../components/toast.js';
import { format } from './currency.js';
import { logger } from './logger.js';
import { getPayments, getPaymentType, getPaymentMethodLabel } from './payments.js';
import { escapeHtml } from './sanitizer.js';
import { BRAND } from '../config/brandConfig.js';

export function renderTicketItems(sale) {
  if (!sale.items || !Array.isArray(sale.items) || sale.items.length === 0) {
    return '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);">No hay detalles de items.</p>';
  }
  return sale.items
    .map(
      item => `
    <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border-light);font-size:var(--text-sm);">
      <span>${item.quantity}x ${escapeHtml(item.name)}</span>
      <span style="font-weight:var(--font-medium);">${format(item.subtotal || item.price * item.quantity)}</span>
    </div>
  `
    )
    .join('');
}

export function renderTicketPayments(sale) {
  const payments = getPayments(sale);
  const paymentType = getPaymentType(sale);
  let html = payments
    .map(
      p => `
    <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);">
      <span>${getPaymentMethodLabel(p.method)}</span>
      <span>${format(p.amount)}</span>
    </div>
  `
    )
    .join('');
  if (paymentType === 'COMBINADO') {
    html +=
      '<div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:var(--space-1);text-align:right;">Tipo: COMBINADO</div>';
  }
  return html;
}

export function renderTicketBody(sale, settings) {
  const businessName = settings?.businessName || BRAND.name;
  const businessAddress = settings?.address || BRAND.address;
  const ticketFooter = settings?.ticketFooter || BRAND.defaultTicketFooter;
  const itemsHtml = renderTicketItems(sale);
  const paymentsHtml = renderTicketPayments(sale);

  return `
    <div style="font-family:monospace;max-width:min(300px,calc(100vw - 40px));margin:0 auto;padding:20px;background:white;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:18px;font-weight:bold;">${escapeHtml(businessName)}</div>
        <div style="font-size:12px;color:#666;">${escapeHtml(businessAddress)}</div>
        <div style="font-size:12px;color:#666;">Ticket #${sale.id ? sale.id.substring(0, 8) : 'N/A'}</div>
        <div style="font-size:12px;color:#666;">${new Date(sale.date).toLocaleString('es-AR')}</div>
      </div>
      <div style="border-top:1px dashed #ccc;padding-top:10px;margin-bottom:10px;">
        ${itemsHtml}
      </div>
      <div style="border-top:1px solid var(--color-border);padding-top:var(--space-3);">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);font-size:var(--text-sm);">
          <span>Subtotal:</span>
          <span>${format(sale.subtotal || 0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);font-size:var(--text-sm);">
          <span>Descuento:</span>
          <span>-${format(sale.discount || 0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:var(--text-lg);border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-2);">
          <span>TOTAL:</span>
          <span>${format(sale.total || 0)}</span>
        </div>
        <div style="margin-top:var(--space-2);padding-top:var(--space-2);border-top:1px dashed var(--color-border-light);">
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-bottom:var(--space-1);font-weight:var(--font-semibold);">MÉTODOS DE PAGO</div>
          ${paymentsHtml}
          ${sale.cashReceived !== null && sale.cashReceived !== undefined ? `<div style="display:flex;justify-content:space-between;font-size:var(--text-sm);margin-top:var(--space-1);"><span>Recibido:</span><span>${format(sale.cashReceived)}</span></div>` : ''}
          ${sale.change !== null && sale.change !== undefined ? `<div style="display:flex;justify-content:space-between;font-size:var(--text-sm);"><span>Cambio:</span><span>${format(sale.change)}</span></div>` : ''}
        </div>
      </div>
      <div style="text-align:center;margin-top:20px;font-size:12px;color:#666;">
        ${escapeHtml(ticketFooter)}
      </div>
    </div>
    <div style="text-align:center;margin-top:20px;">
      <button class="btn btn-primary" id="ticket-print-btn"><i class="fa-solid fa-print"></i> Imprimir</button>
      <button class="btn btn-secondary" id="ticket-close-btn">Cerrar</button>
    </div>
  `;
}

export function showTicketModal(title, body) {
  Modal.show({ title, body, footer: '' });

  requestAnimationFrame(() => {
    const printBtn = document.getElementById('ticket-print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        try {
          printBtn.disabled = true;
          printBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Imprimiendo...';
          window.onafterprint = () => {
            window.onafterprint = null;
            Modal.close();
          };
          window.print();
        } catch (err) {
          logger.error('Ticket', 'Print error:', err);
          Toast.error('Error', 'No se pudo abrir la impresión');
          printBtn.disabled = false;
          printBtn.innerHTML = '<i class="fa-solid fa-print"></i> Imprimir';
        }
      });
    }
    const closeBtn = document.getElementById('ticket-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => Modal.close());
    }
  });
}
