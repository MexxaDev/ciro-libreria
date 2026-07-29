'use strict';

import cashService from './cashService.js';
import { cashClosureRepo } from '../../db/repositories.js';
import { format } from '../../utils/currency.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import state from '../../js/state.js';
import { escapeHtml } from '../../utils/sanitizer.js';
import { exportCashToPDF } from '../../utils/pdfExport.js';
import { logger } from '../../utils/logger.js';

class Cash {
  async load() {
    const container = document.getElementById('cash-content');
    if (container) {
      container.innerHTML =
        '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando caja...</div>';
    }
    try {
      await cashService.getActiveSession();
      this.render();
    } catch (error) {
      logger.error('Cash', 'Error loading cash module', error);
      if (container) {
        container.innerHTML =
          '<div style="text-align:center;padding:var(--space-8);color:var(--color-danger);"><i class="fa-solid fa-triangle-exclamation" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Error al cargar el modulo de caja</div>';
      }
    }
  }

  async render(tab = 'current') {
    const container = document.getElementById('cash-content');
    if (!container) {
      return;
    }

    container.innerHTML = this._renderTabs(tab);

    container.querySelectorAll('.cash-tab').forEach(tabEl => {
      tabEl.addEventListener('click', () => {
        const newTab = tabEl.dataset.cashTab;
        this.render(newTab);
      });
    });

    if (tab === 'current') {
      await this._renderCurrentTab();
    } else {
      await this._renderHistoryTab();
    }
  }

  _renderTabs(activeTab) {
    return `
      <div class="cash-tabs">
        <button class="cash-tab ${activeTab === 'current' ? 'active' : ''}" data-cash-tab="current">
          <i class="fa-solid fa-cash-register"></i> Caja
        </button>
        <button class="cash-tab ${activeTab === 'history' ? 'active' : ''}" data-cash-tab="history">
          <i class="fa-solid fa-clock-rotate-left"></i> Historial de Cierres
        </button>
      </div>
      <div class="cash-tab-content" id="cash-tab-content"></div>
    `;
  }

  async _renderCurrentTab() {
    const content = document.getElementById('cash-tab-content');
    if (!content) {
      return;
    }

    if (cashService.currentSession) {
      this.renderOpenSession(content);
    } else {
      await this._renderClosedState(content);
    }
  }

  async _renderClosedState(container) {
    const closures = await cashService.getClosures();
    const lastClosure = closures && closures.length > 0 ? closures[0] : null;

    container.innerHTML = `
      <div class="card" style="text-align:center;">
        <div class="card-body" style="padding:var(--space-10);">
          <div style="font-size:64px;margin-bottom:var(--space-4);color:var(--color-text-muted);"><i class="fa-solid fa-cash-register"></i></div>
          <h3 style="font-size:var(--text-xl);font-weight:var(--font-semibold);margin-bottom:var(--space-2);">Caja Cerrada</h3>
          <p style="color:var(--color-text-secondary);margin-bottom:var(--space-6);max-width:400px;margin-left:auto;margin-right:auto;">No hay una sesión de caja abierta. Iniciá una nueva jornada para comenzar a operar.</p>
          <div style="display:flex;gap:var(--space-3);justify-content:center;">
            <button class="btn btn-primary btn-lg" id="open-session-btn"><i class="fa-solid fa-play"></i> Abrir Caja</button>
            ${lastClosure ? `<button class="btn btn-ghost btn-lg" id="last-closure-btn"><i class="fa-solid fa-clock-rotate-left"></i> Ver Último Cierre</button>` : ''}
          </div>
        </div>
      </div>
    `;

    document.getElementById('open-session-btn')?.addEventListener('click', () => this.openSession());
    document.getElementById('last-closure-btn')?.addEventListener('click', () => {
      if (lastClosure) {
        this._showClosureDetail(lastClosure.id);
      }
    });
  }

  _renderCashSummaryRows(s, options = {}) {
    const { showHeader = false, showCloseInputs = false, expectedLabel = 'Efectivo Esperado' } = options;

    let html = '';
    if (showHeader) {
      html += `
        <div class="cash-summary__header">
          <div><span class="cash-summary__label">Apertura</span><span class="cash-summary__value">${new Date(s.session.openedAt).toLocaleString('es-AR')}</span></div>
          <div><span class="cash-summary__label">Responsable</span><span class="cash-summary__value">${escapeHtml(s.session.userName || 'N/A')}</span></div>
        </div>
        <div class="cash-summary__divider"></div>`;
    }
    html += `
      <div class="cash-summary__row"><span>Monto Inicial</span><span>${format(s.initialAmount)}</span></div>
      <div class="cash-summary__row"><span>Ingresos Manuales</span><span style="color:var(--color-success);">+${format(s.manualIn)}</span></div>
      <div class="cash-summary__row"><span>Egresos Manuales</span><span style="color:var(--color-danger);">-${format(s.manualOut)}</span></div>
      <div class="cash-summary__divider"></div>
      <div class="cash-summary__row"><span>Ventas Efectivo</span><span>${format(s.cashSales)}</span></div>
      <div class="cash-summary__row"><span>Ventas Transferencia</span><span>${format(s.transferSales)}</span></div>
      <div class="cash-summary__row"><span>Ventas Débito</span><span>${format(s.debitSales)}</span></div>
      <div class="cash-summary__row"><span>Ventas Cuenta Corriente</span><span>${format(s.accountSales)}</span></div>
      <div class="cash-summary__row cash-summary__total"><span>Total Ventas</span><span>${format(s.totalSales)}</span></div>
      <div class="cash-summary__divider"></div>
      <div class="cash-summary__row cash-summary__expected"><span>${expectedLabel}</span><span>${format(s.expectedTotal)}</span></div>`;
    if (showCloseInputs) {
      const denominations = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
      html += `
        <div style="margin-top:var(--space-4);">
          <button class="btn btn-ghost btn-sm" id="toggle-cash-count" type="button" style="width:100%;justify-content:space-between;">
            <span><i class="fa-solid fa-calculator"></i> Conteo de Efectivo</span>
            <i class="fa-solid fa-chevron-down" id="cash-count-chevron"></i>
          </button>
          <div id="cash-count-section" style="display:none;margin-top:var(--space-3);">
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-2);">
              ${denominations
                .map(
                  d => `
                <div style="display:flex;align-items:center;gap:var(--space-2);">
                  <label style="flex:1;font-size:var(--text-sm);font-weight:var(--font-medium);">$${d}</label>
                  <input type="number" class="form-input cash-count-input" data-value="${d}" min="0" value="0" style="width:70px;text-align:center;">
                  <span class="cash-count-total" data-value="${d}" style="font-size:var(--text-sm);font-weight:var(--font-semibold);min-width:60px;text-align:right;">$0</span>
                </div>
              `
                )
                .join('')}
            </div>
            <div class="cash-summary__divider" style="margin:var(--space-3) 0;"></div>
            <div style="display:flex;justify-content:space-between;font-weight:var(--font-bold);font-size:var(--text-base);">
              <span>Total contado</span>
              <span id="cash-count-sum">$0</span>
            </div>
          </div>
        </div>
        <div style="margin-top:var(--space-3);">
          <label class="form-label">Monto Real Contado</label>
          <input type="number" class="form-input form-input-lg" id="close-final-amount" min="0" step="0.01" placeholder="0.00" style="font-size:var(--text-lg);font-weight:var(--font-bold);">
        </div>
        <div class="form-group">
          <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
          <input type="text" class="form-input" id="close-observation" placeholder="Motivo del cierre">
        </div>`;
    }
    return html;
  }

  async renderOpenSession(container) {
    const summary = await cashService.getSessionSummary();
    if (!summary) {
      container.innerHTML = '<p>Error al cargar resumen</p>';
      return;
    }
    const s = summary;
    const movements = await cashService.getMovements();

    container.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 class="card-title">Caja Abierta</h3>
            <p class="card-subtitle">${new Date(s.session.openedAt).toLocaleString('es-AR')} · ${escapeHtml(s.session.userName || '')}</p>
          </div>
          <span class="badge badge-success" style="font-size:var(--text-sm);padding:var(--space-1) var(--space-3);">ABIERTA</span>
        </div>
        <div class="card-body">
          <div class="cash-summary">
            ${this._renderCashSummaryRows(s, { expectedLabel: 'Efectivo Esperado' })}
          </div>
          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5);flex-wrap:wrap;">
            <button class="btn btn-secondary" id="add-movement-in"><i class="fa-solid fa-plus"></i> Ingreso</button>
            <button class="btn btn-secondary" id="add-movement-out"><i class="fa-solid fa-minus"></i> Egreso</button>
            <button class="btn btn-secondary" id="export-pdf-btn"><i class="fa-solid fa-file-pdf"></i> Exportar PDF</button>
            <button class="btn btn-danger" id="close-session-btn" style="margin-left:auto;"><i class="fa-solid fa-lock"></i> Cerrar Caja</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Movimientos</h3>
          <p class="card-subtitle">${movements.length} registros</p>
        </div>
        <div class="card-body">
          ${this.renderMovementsList(movements)}
        </div>
      </div>
    `;

    document.getElementById('close-session-btn')?.addEventListener('click', () => this.closeSession());
    document.getElementById('add-movement-in')?.addEventListener('click', () => this.addMovement('in'));
    document.getElementById('add-movement-out')?.addEventListener('click', () => this.addMovement('out'));
    document.getElementById('export-pdf-btn')?.addEventListener('click', () => this.exportPDF());
  }

  renderMovementsList(movements) {
    if (movements.length === 0) {
      return '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);text-align:center;padding:var(--space-4);">No hay movimientos registrados.</p>';
    }

    const sorted = [...movements].sort((a, b) => new Date(b.date) - new Date(a.date));
    const colors = {
      opening: 'var(--color-info)',
      in: 'var(--color-success)',
      out: 'var(--color-danger)',
      sale: 'var(--color-primary)',
      cancellation: 'var(--color-warning)'
    };
    const labels = { opening: 'Apertura', in: 'Ingreso', out: 'Egreso', sale: 'Venta', cancellation: 'Cancelación' };
    let html = '<div class="movements-list">';
    sorted.forEach(m => {
      const typeLabel = labels[m.type] || m.type;
      const typeColor = colors[m.type] || 'var(--color-text)';
      const sign = m.type === 'out' || m.type === 'cancellation' ? '-' : '+';
      html += `
        <div class="movement-item">
          <div class="movement-item__info">
            <span class="movement-item__type" style="color:${typeColor};">${typeLabel}</span>
            ${m.description ? `<span class="movement-item__desc">${escapeHtml(m.description)}</span>` : ''}
          </div>
          <div class="movement-item__amount">
            <span class="movement-item__value">${sign}${format(Math.abs(m.amount))}</span>
            <div class="movement-item__time">${new Date(m.date).toLocaleTimeString('es-AR')}</div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  async _renderHistoryTab() {
    const content = document.getElementById('cash-tab-content');
    if (!content) {
      return;
    }

    try {
      const closures = await cashService.getClosures();
      if (closures.length === 0) {
        content.innerHTML = `
          <div class="card" style="text-align:center;">
            <div class="card-body" style="padding:var(--space-10);">
              <div style="font-size:64px;margin-bottom:var(--space-4);color:var(--color-text-muted);"><i class="fa-solid fa-clock-rotate-left"></i></div>
              <h3 style="font-size:var(--text-xl);font-weight:var(--font-semibold);margin-bottom:var(--space-2);">Sin cierres registrados</h3>
              <p style="color:var(--color-text-secondary);margin-bottom:var(--space-6);max-width:400px;margin-left:auto;margin-right:auto;">Aún no hay cierres de caja registrados. Los cierres aparecerán aquí automáticamente.</p>
            </div>
          </div>
        `;
        return;
      }

      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Historial de Cierres</h3>
            <p class="card-subtitle">${closures.length} cierre${closures.length !== 1 ? 's' : ''} registrado${closures.length !== 1 ? 's' : ''}</p>
          </div>
          <div class="card-body">
            <div class="cash-closures-table">
              <div class="cash-closures-table__header">
                <span>Fecha Cierre</span>
                <span>Responsable</span>
                <span>Apertura</span>
                <span>Esperado</span>
                <span>Real</span>
                <span>Diferencia</span>
                <span>Ventas</span>
                <span>Acción</span>
              </div>
              ${closures
                .map(c => {
                  const diffClass = Math.abs(c.difference) > 0.01 ? 'cash-diff--alert' : 'cash-diff--ok';
                  const diffSign = c.difference >= 0 ? '+' : '';
                  return `
                  <div class="cash-closures-table__row">
                    <span class="cash-cell--date">${new Date(c.closedAt).toLocaleString('es-AR')}</span>
                    <span>${escapeHtml(c.userName || 'N/A')}</span>
                    <span class="cash-cell--amount">${format(c.initialAmount)}</span>
                    <span class="cash-cell--amount">${format(c.expectedTotal)}</span>
                    <span class="cash-cell--amount">${format(c.finalAmount)}</span>
                    <span class="cash-cell--amount ${diffClass}">${diffSign}${format(c.difference)}</span>
                    <span class="cash-cell--amount">${c.salesCount || 0}</span>
                    <span class="cash-cell--actions">
                      <button class="btn btn-sm btn-secondary cash-history-detail" data-closure-id="${c.id}" title="Ver detalle">
                        <i class="fa-solid fa-eye"></i>
                      </button>
                      <button class="btn btn-sm btn-secondary cash-history-pdf" data-closure-id="${c.id}" title="Reimprimir PDF">
                        <i class="fa-solid fa-file-pdf"></i>
                      </button>
                    </span>
                  </div>
                `;
                })
                .join('')}
            </div>
          </div>
        </div>
      `;

      content.querySelectorAll('.cash-history-detail').forEach(btn => {
        btn.addEventListener('click', () => this._showClosureDetail(btn.dataset.closureId));
      });
      content.querySelectorAll('.cash-history-pdf').forEach(btn => {
        btn.addEventListener('click', () => this._reprintClosurePDF(btn.dataset.closureId));
      });
    } catch (error) {
      logger.error('Cash', 'Error loading history', error);
      content.innerHTML =
        '<p style="color:var(--color-danger);text-align:center;padding:var(--space-8);">Error al cargar historial de cierres.</p>';
    }
  }

  async _showClosureDetail(closureId) {
    try {
      const closure = await cashClosureRepo.findById(closureId);
      if (!closure) {
        Toast.error('Error', 'Cierre no encontrado');
        return;
      }

      const body = `
        <div class="cash-closure-detail">
          <div class="cash-summary__header">
            <div><span class="cash-summary__label">Apertura</span><span class="cash-summary__value">${new Date(closure.openedAt).toLocaleString('es-AR')}</span></div>
            <div><span class="cash-summary__label">Cierre</span><span class="cash-summary__value">${new Date(closure.closedAt).toLocaleString('es-AR')}</span></div>
            <div><span class="cash-summary__label">Responsable</span><span class="cash-summary__value">${escapeHtml(closure.userName || 'N/A')}</span></div>
          </div>
          <div class="cash-summary__divider"></div>
          <div class="cash-summary__row"><span>Monto Inicial</span><span>${format(closure.initialAmount)}</span></div>
          <div class="cash-summary__row"><span>Ingresos Manuales</span><span style="color:var(--color-success);">+${format(closure.manualIn)}</span></div>
          <div class="cash-summary__row"><span>Egresos Manuales</span><span style="color:var(--color-danger);">-${format(closure.manualOut)}</span></div>
          <div class="cash-summary__divider"></div>
          <div class="cash-summary__row"><span>Ventas Efectivo</span><span>${format(closure.cashSales)}</span></div>
          <div class="cash-summary__row"><span>Ventas Transferencia</span><span>${format(closure.transferSales)}</span></div>
          <div class="cash-summary__row"><span>Ventas Débito</span><span>${format(closure.debitSales)}</span></div>
          <div class="cash-summary__row"><span>Ventas Cuenta Corriente</span><span>${format(closure.accountSales)}</span></div>
          <div class="cash-summary__row cash-summary__total"><span>Total Ventas</span><span>${format(closure.totalSales)}</span></div>
          <div class="cash-summary__divider"></div>
          <div class="cash-summary__row cash-summary__expected"><span>Efectivo Esperado</span><span>${format(closure.expectedTotal)}</span></div>
          <div class="cash-summary__row"><span>Monto Real Contado</span><span>${format(closure.finalAmount)}</span></div>
          <div class="cash-summary__row ${Math.abs(closure.difference) > 0.01 ? 'cash-diff--alert' : 'cash-diff--ok'}"><span><strong>Diferencia</strong></span><span><strong>${closure.difference >= 0 ? '+' : ''}${format(closure.difference)}</strong></span></div>
          ${closure.closeObservation ? `<div class="cash-summary__divider"></div><div class="cash-summary__row"><span>Observación</span><span>${escapeHtml(closure.closeObservation)}</span></div>` : ''}
          ${
            closure.cashCounts
              ? `
            <div class="cash-summary__divider"></div>
            <div style="font-size:var(--text-sm);font-weight:var(--font-semibold);margin-bottom:var(--space-2);">Conteo de Efectivo</div>
            ${Object.entries(closure.cashCounts)
              .map(
                ([denom, count]) => `
              <div class="cash-summary__row" style="font-size:var(--text-sm);">
                <span>$${parseInt(denom).toLocaleString('es-AR')} x ${count}</span>
                <span>${format(count * parseInt(denom))}</span>
              </div>
            `
              )
              .join('')}
          `
              : ''
          }
        </div>
      `;

      const footer = `
        <button class="btn btn-secondary" id="close-detail-btn">Cerrar</button>
        <button class="btn btn-primary" id="detail-pdf-btn"><i class="fa-solid fa-file-pdf"></i> Reimprimir PDF</button>
      `;

      Modal.show({ title: 'Detalle del Cierre', body, footer });

      document.getElementById('close-detail-btn')?.addEventListener('click', () => Modal.close());
      document.getElementById('detail-pdf-btn')?.addEventListener('click', () => {
        Modal.close();
        this._reprintClosurePDF(closureId);
      });
    } catch (error) {
      logger.error('Cash', 'Error showing closure detail', error);
      Toast.error('Error', 'No se pudo mostrar el detalle');
    }
  }

  async _reprintClosurePDF(closureId) {
    try {
      const closure = await cashClosureRepo.findById(closureId);
      if (!closure) {
        Toast.error('Error', 'Cierre no encontrado');
        return;
      }

      const settings = state.get('settings');
      await exportCashToPDF(closure, closure.movements || [], settings);
      Toast.success('PDF generado', 'Reporte de caja exportado correctamente');
    } catch (error) {
      logger.error('Cash', 'Error reprinting PDF', error);
      Toast.error('Error', 'No se pudo generar el PDF');
    }
  }

  openSession() {
    const body = `
      <div class="cash-open-modal">
        <div class="cash-open-modal__icon">
          <i class="fa-solid fa-cash-register"></i>
        </div>
        <h2 class="cash-open-modal__title">Apertura de Caja</h2>
        <p class="cash-open-modal__desc">Ingresá el monto inicial para comenzar la jornada</p>
        <div class="form-group" style="margin-top:var(--space-6);">
          <label class="form-label">Monto Inicial</label>
          <input type="number" class="form-input form-input-lg" id="initial-amount" min="0" step="0.01" placeholder="0.00" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
          <input type="text" class="form-input" id="open-cash-obs" placeholder="Ej: Inicio de turno mañana">
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="session-cancel">Cancelar</button>
      <button class="btn btn-primary" id="session-confirm">Abrir Caja</button>
    `;

    Modal.show({ title: '', body, footer });

    document.getElementById('session-cancel')?.addEventListener('click', () => Modal.close());

    document.getElementById('session-confirm')?.addEventListener('click', async () => {
      const amount = document.getElementById('initial-amount')?.value;
      const obs = document.getElementById('open-cash-obs')?.value || '';
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
        Toast.error('Error', 'Ingresá un monto inicial válido');
        return;
      }
      try {
        await cashService.openSession(amount, obs);
        Toast.success('Éxito', 'Caja abierta correctamente');
        Modal.close();
        this.render();
      } catch (error) {
        Toast.error('Error', error.message);
      }
    });
  }

  async closeSession() {
    const summary = await cashService.getSessionSummary();
    if (!summary) {
      return;
    }
    const s = summary;

    const body = `
      <div class="cash-summary">
        ${this._renderCashSummaryRows(s, { showHeader: true, showCloseInputs: true, expectedLabel: 'Efectivo Esperado' })}
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="close-cancel">Cancelar</button>
      <button class="btn btn-danger" id="close-confirm"><i class="fa-solid fa-lock"></i> Cerrar Caja</button>
    `;

    Modal.show({ title: 'Cierre de Caja', body, footer });

    document.getElementById('close-cancel')?.addEventListener('click', () => Modal.close());

    const toggleBtn = document.getElementById('toggle-cash-count');
    const countSection = document.getElementById('cash-count-section');
    const chevron = document.getElementById('cash-count-chevron');
    if (toggleBtn && countSection) {
      toggleBtn.addEventListener('click', () => {
        const isOpen = countSection.style.display !== 'none';
        countSection.style.display = isOpen ? 'none' : 'block';
        if (chevron) {
          chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
        }
      });
    }

    document.querySelectorAll('.cash-count-input').forEach(inp => {
      inp.addEventListener('input', () => {
        let total = 0;
        document.querySelectorAll('.cash-count-input').forEach(i => {
          const val = parseInt(i.value) || 0;
          const denom = parseInt(i.dataset.value);
          const subtotal = val * denom;
          total += subtotal;
          const totalEl = document.querySelector(`.cash-count-total[data-value="${denom}"]`);
          if (totalEl) {
            totalEl.textContent = '$' + subtotal.toLocaleString('es-AR');
          }
        });
        const sumEl = document.getElementById('cash-count-sum');
        if (sumEl) {
          sumEl.textContent = '$' + total.toLocaleString('es-AR', { minimumFractionDigits: 2 });
        }
        const finalAmount = document.getElementById('close-final-amount');
        if (finalAmount) {
          finalAmount.value = total.toFixed(2);
        }
      });
    });

    document.getElementById('close-confirm')?.addEventListener('click', async () => {
      const finalAmount = document.getElementById('close-final-amount')?.value;
      const observation = document.getElementById('close-observation')?.value || '';

      const cashCounts = {};
      document.querySelectorAll('.cash-count-input').forEach(inp => {
        const val = parseInt(inp.value) || 0;
        if (val > 0) {
          cashCounts[inp.dataset.value] = val;
        }
      });

      if (!finalAmount || isNaN(parseFloat(finalAmount)) || parseFloat(finalAmount) < 0) {
        Toast.error('Error', 'Ingresá un monto final válido');
        return;
      }
      try {
        const closure = await cashService.closeSession(finalAmount, observation, cashCounts);
        const diff = closure.difference;
        if (Math.abs(diff) > 0.01) {
          Toast.warning('Caja Cerrada', `Diferencia: ${format(diff)}`);
        } else {
          Toast.success('Caja Cerrada', 'Cierre exitoso. Diferencia: $0.00');
        }
        Modal.close();
        this.render();
      } catch (error) {
        Toast.error('Error', error.message);
      }
    });
  }

  async exportPDF() {
    const btn = document.getElementById('export-pdf-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    }
    try {
      const summary = await cashService.getSessionSummary();
      const movements = await cashService.getMovements();
      const settings = state.get('settings');
      await exportCashToPDF(summary, movements, settings);
      Toast.success('PDF generado', 'Reporte de caja exportado correctamente');
    } catch (error) {
      logger.error('Cash', 'Error exporting PDF', error);
      Toast.error('Error', 'No se pudo generar el PDF');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Exportar PDF';
      }
    }
  }

  addMovement(type) {
    const typeLabel = type === 'in' ? 'Ingreso' : 'Egreso';
    const body = `
      <div class="form-group">
        <label class="form-label">Monto</label>
        <input type="number" class="form-input" id="movement-amount" min="0" step="0.01" placeholder="0.00" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
        <input type="text" class="form-input" id="movement-desc" placeholder="Motivo del movimiento">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="mov-cancel">Cancelar</button>
      <button class="btn btn-primary" id="mov-confirm">Registrar ${typeLabel}</button>
    `;

    Modal.show({ title: `Nuevo ${typeLabel}`, body, footer });

    document.getElementById('mov-cancel')?.addEventListener('click', () => Modal.close());

    document.getElementById('mov-confirm')?.addEventListener('click', async () => {
      const amount = document.getElementById('movement-amount')?.value;
      const description = document.getElementById('movement-desc')?.value || '';
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        Toast.error('Error', 'Ingresá un monto válido');
        return;
      }
      try {
        await cashService.addMovement(type, amount, description);
        Toast.success('Éxito', `${typeLabel} registrado correctamente`);
        Modal.close();
        this.render();
      } catch (error) {
        Toast.error('Error', error.message);
      }
    });
  }

  showQuickCashModal() {
    if (!cashService.currentSession) {
      Toast.error('Error', 'No hay sesión de caja abierta');
      return;
    }

    const body = `
      <div style="margin-bottom:var(--space-4);">
        <label class="form-label" for="cash-op-type">Tipo de operación</label>
        <select class="form-input" id="cash-op-type">
          <option value="in">Ingreso Manual</option>
          <option value="out">Egreso Manual</option>
          <option value="close">Cierre de Caja</option>
        </select>
      </div>
      <div id="cash-op-dynamic">
        <div class="form-group">
          <label class="form-label" for="cash-op-amount">Monto</label>
          <input type="number" class="form-input" id="cash-op-amount" min="0" step="0.01" placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="form-label" for="cash-op-obs">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
          <input type="text" class="form-input" id="cash-op-obs" placeholder="Motivo del movimiento">
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="cash-modal-close-btn">Cerrar</button>
      <button class="btn btn-primary" id="cash-modal-exec-btn">Ejecutar</button>
    `;

    Modal.show({ title: 'Gestión de Caja', body, footer });

    document.getElementById('cash-modal-close-btn')?.addEventListener('click', () => Modal.close());

    document.getElementById('cash-op-type')?.addEventListener('change', e => {
      const dynamic = document.getElementById('cash-op-dynamic');
      if (e.target.value === 'close') {
        dynamic.innerHTML =
          '<div style="text-align:center;padding:var(--space-4);"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;"></i><p style="margin-top:var(--space-2);">Cargando resumen...</p></div>';
        this._loadQuickCloseSummary(dynamic);
      } else {
        dynamic.innerHTML = `
          <div class="form-group">
            <label class="form-label">Monto</label>
            <input type="number" class="form-input" id="cash-op-amount" min="0" step="0.01" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
            <input type="text" class="form-input" id="cash-op-obs" placeholder="Motivo del movimiento">
          </div>
        `;
      }
    });

    document.getElementById('cash-modal-exec-btn')?.addEventListener('click', async () => {
      const type = document.getElementById('cash-op-type')?.value;
      if (type === 'close') {
        await this._executeQuickClose();
        return;
      }
      const amount = document.getElementById('cash-op-amount')?.value;
      const obs = document.getElementById('cash-op-obs')?.value || '';
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        Toast.error('Error', 'Ingresá un monto válido');
        return;
      }
      try {
        await cashService.addMovement(type, amount, obs);
        const label = type === 'in' ? 'Ingreso' : 'Egreso';
        Toast.success('Éxito', `${label} registrado correctamente`);
        Modal.close();
        this.render();
      } catch (err) {
        Toast.error('Error', err.message);
      }
    });
  }

  async _loadQuickCloseSummary(dynamic) {
    const summary = await cashService.getSessionSummary();
    if (!summary) {
      dynamic.innerHTML = '<p style="color:var(--color-danger);">Error al cargar resumen</p>';
      return;
    }

    const s = summary;
    dynamic.innerHTML = `
      <div class="cash-summary">
        ${this._renderCashSummaryRows(s, { showHeader: true, showCloseInputs: true, expectedLabel: 'Total Esperado en Efectivo' })}
      </div>
    `;
  }

  async _executeQuickClose() {
    const finalAmount = document.getElementById('close-final-amount')?.value;
    const observation = document.getElementById('close-observation')?.value || '';
    if (!finalAmount || isNaN(parseFloat(finalAmount)) || parseFloat(finalAmount) < 0) {
      Toast.error('Error', 'Ingresá un monto final válido');
      return;
    }
    try {
      await cashService.closeSession(finalAmount, observation);
      const expected = parseFloat(
        document.querySelector('.cash-summary__expected span:last-child')?.textContent?.replace(/[^\d.-]/g, '') || '0'
      );
      const diff = parseFloat(finalAmount) - expected;
      if (Math.abs(diff) > 0.01) {
        Toast.warning('Caja Cerrada', `Diferencia: ${format(diff)}`);
      } else {
        Toast.success('Caja Cerrada', 'Cierre exitoso. Diferencia: $0.00');
      }
      Modal.close();
      this.render();
    } catch (err) {
      Toast.error('Error', err.message);
    }
  }
}

export default new Cash();
