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
import { getPayments, PAYMENT_METHODS } from '../../utils/payments.js';
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
      debtPayments: summary.debtPayments,
      cashDebtPayments: summary.cashDebtPayments,
      cashSales: summary.cashSales,
      transferSales: summary.transferSales,
      debitSales: summary.debitSales,
      accountSales: summary.accountSales,
      totalSales: summary.totalSales,
      expectedTotal: summary.expectedTotal,
      methods: summary.methods || null,
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
          if (product && !product.variablePrice) {
            await productRepo.update({ ...product, stock: (product.stock || 0) + item.quantity });
          }
        }
      }

      const accountPayment = payments.find(p => p.method === 'account');
      if (accountPayment && accountPayment.amount > 0 && sale.customerId && sale.customerId !== 'cust_final') {
        const customer = await customerRepo.findById(sale.customerId);
        if (customer) {
          await customerRepo.update({ ...customer, balance: (customer.balance || 0) - accountPayment.amount });
          state.emit('data:customers-changed');
        }
      }
    } catch (error) {
      logger.error('CashService', 'Error cancelling sale', error);
      throw new Error('No se pudo cancelar la venta');
    }
  }

  async addMovement(type, amount, description = '', paymentMethod = 'cash') {
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
      paymentMethod,
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

    const methodsMap = {};
    for (const pm of PAYMENT_METHODS) {
      methodsMap[pm.id] = { sales: 0, manualIn: 0, manualOut: 0, debtPayments: 0, net: 0 };
    }

    for (const sale of sessionSales) {
      const payments = getPayments(sale);
      for (const p of payments) {
        if (!methodsMap[p.method]) {
          methodsMap[p.method] = { sales: 0, manualIn: 0, manualOut: 0, debtPayments: 0, net: 0 };
        }
        methodsMap[p.method].sales += p.amount;
      }
    }

    for (const m of movements) {
      if (m.type === 'in' || m.type === 'out' || m.type === 'payment') {
        const method = m.paymentMethod || 'cash';
        if (!methodsMap[method]) {
          methodsMap[method] = { sales: 0, manualIn: 0, manualOut: 0, debtPayments: 0, net: 0 };
        }
        if (m.type === 'in') {
          methodsMap[method].manualIn += parseFloat(m.amount);
        } else if (m.type === 'out') {
          methodsMap[method].manualOut += parseFloat(m.amount);
        } else {
          methodsMap[method].debtPayments += parseFloat(m.amount);
        }
      }
    }

    for (const id of Object.keys(methodsMap)) {
      const d = methodsMap[id];
      d.net = d.sales + d.manualIn + (d.debtPayments || 0) - d.manualOut;
    }

    const manualIn = movements.filter(m => m.type === 'in').reduce((s, m) => s + parseFloat(m.amount), 0);
    const manualOut = movements.filter(m => m.type === 'out').reduce((s, m) => s + parseFloat(m.amount), 0);
    const debtPayments = movements.filter(m => m.type === 'payment').reduce((s, m) => s + parseFloat(m.amount), 0);
    const cashSales = methodsMap['cash']?.sales || 0;
    const transferSales = methodsMap['transfer']?.sales || 0;
    const debitSales = methodsMap['debit']?.sales || 0;
    const accountSales = methodsMap['account']?.sales || 0;
    const totalSales = sessionSales.reduce((s, sale) => s + parseFloat(sale.total), 0);
    const cashManualIn = methodsMap['cash']?.manualIn || 0;
    const cashManualOut = methodsMap['cash']?.manualOut || 0;
    const cashDebtPayments = methodsMap['cash']?.debtPayments || 0;
    const expectedTotal = initialAmount + cashManualIn + cashDebtPayments - cashManualOut + cashSales;

    return {
      initialAmount,
      manualIn,
      manualOut,
      debtPayments,
      cashDebtPayments,
      cashSales,
      transferSales,
      debitSales,
      accountSales,
      totalSales,
      expectedTotal,
      methods: methodsMap,
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
