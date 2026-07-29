'use strict';

import {
  cashSessionRepo,
  cashMovementRepo,
  cashClosureRepo,
  saleRepo,
  productRepo,
  saleItemRepo,
  customerRepo
} from '../../db/repositories.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import { getPayments, getMethodTotal } from '../../utils/payments.js';
import state from '../../js/state.js';
import { exportCashToPDF } from '../../utils/pdfExport.js';
import { logger } from '../../utils/logger.js';

class CashService {
  constructor() {
    this.currentSession = null;
  }

  async getActiveSession() {
    try {
      const sessions = await cashSessionRepo.findAll();
      this.currentSession = sessions.find(s => !s.closedAt) || null;
    } catch {
      this.currentSession = null;
    }
    return this.currentSession;
  }

  async requireActiveSession() {
    await this.getActiveSession();
    if (!this.currentSession) {
      await this._showForcedOpenModal();
    }
    return this.currentSession;
  }

  async openSession(initialAmount, observation = '') {
    if (this.currentSession) {
      throw new Error('Ya hay una sesión de caja abierta');
    }
    const amount = parseFloat(initialAmount);
    if (isNaN(amount) || amount < 0) {
      throw new Error('Monto inicial inválido');
    }
    const user = state.get('currentUser');
    const session = {
      id: `session_${Date.now()}`,
      initialAmount: amount,
      openedAt: new Date().toISOString(),
      closedAt: null,
      finalAmount: null,
      userId: user?.id,
      userName: user?.name,
      observation: observation || ''
    };
    await cashSessionRepo.create(session);
    this.currentSession = session;

    await cashMovementRepo.create({
      id: `mov_${Date.now()}_open`,
      sessionId: session.id,
      type: 'opening',
      amount: amount,
      description: observation || 'Apertura de caja',
      date: new Date().toISOString(),
      userId: user?.id
    });

    return session;
  }

  async closeSession(finalAmount, observation = '', cashCounts = null) {
    if (!this.currentSession) {
      throw new Error('No hay sesión de caja abierta');
    }
    const amount = parseFloat(finalAmount);
    if (isNaN(amount) || amount < 0) {
      throw new Error('Monto final inválido');
    }

    const summary = await this.getSessionSummary();
    if (!summary) {
      throw new Error('No se pudo calcular el resumen de caja');
    }

    this.currentSession.closedAt = new Date().toISOString();
    this.currentSession.finalAmount = amount;
    this.currentSession.closeObservation = observation || '';
    await cashSessionRepo.update(this.currentSession);

    const closure = await this._createClosure(summary, amount, observation, cashCounts);
    this.currentSession = null;

    try {
      const settings = state.get('settings');
      await exportCashToPDF(closure, closure.movements, settings);
    } catch {
      /* PDF auto-download best-effort */
    }

    return closure;
  }

  async _createClosure(summary, finalAmount, observation, cashCounts = null) {
    const session = summary.session;
    const difference = finalAmount - summary.expectedTotal;
    const closure = {
      id: `closure_${Date.now()}`,
      sessionId: session.id,
      closedAt: session.closedAt,
      openedAt: session.openedAt,
      initialAmount: summary.initialAmount,
      manualIn: summary.manualIn,
      manualOut: summary.manualOut,
      cashSales: summary.cashSales,
      transferSales: summary.transferSales,
      debitSales: summary.debitSales,
      accountSales: summary.accountSales,
      totalSales: summary.totalSales,
      expectedTotal: summary.expectedTotal,
      finalAmount: finalAmount,
      difference: difference,
      userId: session.userId,
      userName: session.userName,
      observation: session.observation,
      closeObservation: observation || '',
      salesCount: summary.salesCount,
      movements: summary.movements.map(m => ({ ...m })),
      cashCounts: cashCounts
    };
    await cashClosureRepo.create(closure);
    return closure;
  }

  async cancelSale(sale) {
    try {
      const session = await this.getActiveSession();
      if (!session) {
        return;
      }

      const user = state.get('currentUser');
      const payments = getPayments(sale);
      for (const p of payments) {
        await cashMovementRepo.create({
          id: `mov_${Date.now()}_cancel_${sale.id.replace(/[^a-zA-Z0-9]/g, '_')}_${p.method}_${Math.random().toString(36).slice(2, 6)}`,
          sessionId: session.id,
          type: 'cancellation',
          paymentMethod: p.method,
          amount: -p.amount,
          description: `Cancelación venta ${sale.id} ${p.method}`,
          date: new Date().toISOString(),
          userId: user?.id,
          saleId: sale.id
        });
      }

      await saleRepo.update({ ...sale, status: 'cancelled' });

      state.emit('data:sales-changed');

      const items = await saleItemRepo.query('saleId', sale.id);
      for (const item of items) {
        if (item.productId && item.quantity) {
          const product = await productRepo.findById(item.productId);
          if (product) {
            await productRepo.update({ ...product, stock: (product.stock || 0) + item.quantity });
          }
        }
      }

      const accountPayment = payments.find(p => p.method === 'account');
      if (accountPayment && accountPayment.amount > 0 && sale.customerId && sale.customerId !== 'cust_final') {
        const customer = await customerRepo.findById(sale.customerId);
        if (customer) {
          await customerRepo.update({ ...customer, balance: (customer.balance || 0) + accountPayment.amount });
          state.emit('data:customers-changed');
        }
      }
    } catch (error) {
      logger.error('CashService', 'Error cancelling sale', error);
      throw new Error('No se pudo cancelar la venta');
    }
  }

  async addMovement(type, amount, description = '') {
    if (!this.currentSession) {
      throw new Error('No hay sesión de caja abierta');
    }
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      throw new Error('Monto inválido');
    }
    const user = state.get('currentUser');
    const movement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sessionId: this.currentSession.id,
      type,
      amount: value,
      description: description || '',
      date: new Date().toISOString(),
      userId: user?.id
    };
    await cashMovementRepo.create(movement);
    return movement;
  }

  async recordSale(sale) {
    if (!this.currentSession) {
      return;
    }
    const user = state.get('currentUser');
    const payments = getPayments(sale);
    for (const p of payments) {
      await cashMovementRepo.create({
        id: `mov_${Date.now()}_sale_${sale.id.replace(/[^a-zA-Z0-9]/g, '_')}_${p.method}`,
        sessionId: this.currentSession.id,
        type: 'sale',
        paymentMethod: p.method,
        amount: p.amount,
        description: `Venta ${sale.id} ${p.method}`,
        date: new Date().toISOString(),
        userId: user?.id,
        saleId: sale.id
      });
    }
  }

  async getMovementsForSession(sessionId) {
    try {
      return (await cashMovementRepo.query('sessionId', sessionId)) || [];
    } catch {
      return [];
    }
  }

  async getMovements() {
    if (!this.currentSession) {
      return [];
    }
    return this.getMovementsForSession(this.currentSession.id);
  }

  async getSummaryForSession(sessionId) {
    const session = await cashSessionRepo.findById(sessionId);
    if (!session) {
      return null;
    }

    const movements = await this.getMovementsForSession(sessionId);
    const allSales = (await saleRepo.findAll()) || [];
    const sessionSales = allSales.filter(s => s.sessionId === sessionId && s.status !== 'cancelled');

    const opening = movements.find(m => m.type === 'opening');
    const initialAmount = opening ? parseFloat(opening.amount) : parseFloat(session.initialAmount) || 0;
    const manualIn = movements.filter(m => m.type === 'in').reduce((s, m) => s + parseFloat(m.amount), 0);
    const manualOut = movements.filter(m => m.type === 'out').reduce((s, m) => s + parseFloat(m.amount), 0);
    const cashSales = sessionSales.reduce((s, sale) => s + getMethodTotal(sale, 'cash'), 0);
    const transferSales = sessionSales.reduce((s, sale) => s + getMethodTotal(sale, 'transfer'), 0);
    const debitSales = sessionSales.reduce((s, sale) => s + getMethodTotal(sale, 'debit'), 0);
    const accountSales = sessionSales.reduce((s, sale) => s + getMethodTotal(sale, 'account'), 0);
    const totalSales = sessionSales.reduce((s, sale) => s + parseFloat(sale.total), 0);
    const expectedTotal = initialAmount + manualIn - manualOut + cashSales;

    return {
      initialAmount,
      manualIn,
      manualOut,
      cashSales,
      transferSales,
      debitSales,
      accountSales,
      totalSales,
      expectedTotal,
      session,
      movements,
      salesCount: sessionSales.length
    };
  }

  async getSessionSummary() {
    if (!this.currentSession) {
      return null;
    }
    return this.getSummaryForSession(this.currentSession.id);
  }

  async getAllClosedSessions() {
    try {
      const sessions = await cashSessionRepo.findAll();
      return sessions.filter(s => s.closedAt).sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
    } catch {
      return [];
    }
  }

  async getClosures() {
    try {
      const closures = await cashClosureRepo.findAll();
      return closures.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
    } catch {
      return [];
    }
  }

  _showForcedOpenModal() {
    return new Promise(resolve => {
      const body = `
        <div class="cash-open-modal">
          <div class="cash-open-modal__icon">
            <i class="fa-solid fa-cash-register"></i>
          </div>
          <h2 class="cash-open-modal__title">Apertura de Caja</h2>
          <p class="cash-open-modal__desc">Ingresá el monto inicial para comenzar la jornada</p>
          <div class="form-group" style="margin-top:var(--space-6);">
            <label class="form-label">Monto Inicial</label>
            <input type="number" class="form-input form-input-lg" id="open-cash-amount" min="0" step="0.01" placeholder="0.00" autofocus>
          </div>
          <div class="form-group">
            <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
            <input type="text" class="form-input" id="open-cash-obs" placeholder="Ej: Inicio de turno mañana">
          </div>
          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-6);">
            <button class="btn btn-secondary btn-lg" id="open-cash-cancel" style="flex:1;">
              <i class="fa-solid fa-arrow-left"></i> Salir del POS
            </button>
            <button class="btn btn-primary btn-lg" id="open-cash-confirm" style="flex:1;">
              <i class="fa-solid fa-check"></i> Abrir Caja
            </button>
          </div>
        </div>
      `;

      Modal.show({
        title: '',
        body,
        footer: '',
        closable: false
      });

      document.getElementById('open-cash-confirm')?.addEventListener('click', async () => {
        const amount = document.getElementById('open-cash-amount')?.value;
        const obs = document.getElementById('open-cash-obs')?.value || '';
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
          Toast.error('Error', 'Ingresá un monto inicial válido');
          return;
        }
        try {
          await this.openSession(amount, obs);
          Toast.success('Éxito', 'Caja abierta correctamente');
          Modal.close();
          resolve();
        } catch (err) {
          Toast.error('Error', err.message);
        }
      });

      document.getElementById('open-cash-cancel')?.addEventListener('click', () => {
        Modal.close();
        window.location.hash = 'dashboard';
        resolve();
      });
    });
  }
}

export default new CashService();
