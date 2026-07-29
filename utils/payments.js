'use strict';

import { paymentMethodRepo } from '../db/repositories.js';

const DEFAULT_METHODS = [
  { id: 'cash', label: 'Efectivo', color: '#10B981', enabled: true },
  { id: 'debit', label: 'Débito', color: '#8B5CF6', enabled: true },
  { id: 'transfer', label: 'Transferencia', color: '#3B82F6', enabled: true },
  { id: 'account', label: 'Cuenta Corriente', color: '#F59E0B', enabled: true }
];

export let PAYMENT_METHODS = [...DEFAULT_METHODS];
export let PAYMENT_COLORS = {};

function _buildColors() {
  PAYMENT_COLORS = {};
  PAYMENT_METHODS.forEach(m => {
    PAYMENT_COLORS[m.id] = m.color || '#888';
  });
}

_buildColors();

export async function loadPaymentMethods() {
  try {
    const methods = await paymentMethodRepo.findAll();
    if (methods && methods.length > 0) {
      PAYMENT_METHODS = methods.filter(m => m.enabled !== false);
    } else {
      PAYMENT_METHODS = [...DEFAULT_METHODS];
    }
  } catch {
    PAYMENT_METHODS = [...DEFAULT_METHODS];
  }
  _buildColors();
}

const METHOD_LABELS = {
  cash: 'Efectivo',
  debit: 'Débito',
  transfer: 'Transferencia',
  account: 'Cuenta Corriente'
};

export function getPaymentMethodLabel(method) {
  const found = PAYMENT_METHODS.find(m => m.id === method);
  if (found) {
    return found.label;
  }
  return METHOD_LABELS[method] || method || 'N/A';
}

export function getPayments(sale) {
  if (sale.payments && Array.isArray(sale.payments) && sale.payments.length > 0) {
    return sale.payments.map(p => ({
      method: p.method,
      amount: parseFloat(p.amount) || 0
    }));
  }
  if (sale.paymentMethod) {
    return [{ method: sale.paymentMethod, amount: parseFloat(sale.total) || 0 }];
  }
  return [];
}

export function getPaymentType(sale) {
  if (sale.paymentType === 'COMBINADO') {
    return 'COMBINADO';
  }
  const payments = getPayments(sale);
  if (payments.length > 1) {
    return 'COMBINADO';
  }
  return 'SIMPLE';
}

export function getMethodTotal(sale, method) {
  const payments = getPayments(sale);
  return payments.filter(p => p.method === method).reduce((sum, p) => sum + p.amount, 0);
}

export function validatePayments(payments, total) {
  if (!payments || payments.length === 0) {
    return { valid: false, error: 'Agregá al menos un método de pago' };
  }
  for (const p of payments) {
    if (!p.method) {
      return { valid: false, error: 'Seleccioná un método de pago' };
    }
    if (isNaN(p.amount) || p.amount < 0) {
      return { valid: false, error: 'Montos de pago inválidos' };
    }
  }
  const sum = payments.reduce((s, p) => s + p.amount, 0);
  const diff = Math.abs(sum - total);
  if (diff > 0.01) {
    return {
      valid: false,
      error: `La suma de los pagos ($${sum.toFixed(2)}) no coincide con el total ($${total.toFixed(2)})`
    };
  }
  return { valid: true, error: null };
}
