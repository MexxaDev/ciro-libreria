import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPayments, getMethodTotal, getPaymentMethodLabel, validatePayments } from '../utils/payments.js';

describe('payments', () => {
  describe('getPayments', () => {
    it('should return payments array from sale with payments field', () => {
      const sale = { payments: [{ method: 'cash', amount: 100 }] };
      const result = getPayments(sale);
      assert.equal(result.length, 1);
      assert.equal(result[0].method, 'cash');
      assert.equal(result[0].amount, 100);
    });
    it('should fallback to paymentMethod + total', () => {
      const sale = { paymentMethod: 'debit', total: 250 };
      const result = getPayments(sale);
      assert.equal(result.length, 1);
      assert.equal(result[0].method, 'debit');
      assert.equal(result[0].amount, 250);
    });
    it('should return empty array for sale with no payment info', () => {
      const result = getPayments({});
      assert.equal(result.length, 0);
    });
    it('should handle multiple payments', () => {
      const sale = {
        payments: [
          { method: 'cash', amount: 50 },
          { method: 'transfer', amount: 50 }
        ]
      };
      const result = getPayments(sale);
      assert.equal(result.length, 2);
    });
    it('should parse amount as float', () => {
      const sale = { payments: [{ method: 'cash', amount: '100.50' }] };
      const result = getPayments(sale);
      assert.equal(result[0].amount, 100.5);
    });
  });

  describe('getMethodTotal', () => {
    it('should sum amounts for matching method', () => {
      const sale = {
        payments: [
          { method: 'cash', amount: 100 },
          { method: 'transfer', amount: 200 }
        ]
      };
      assert.equal(getMethodTotal(sale, 'cash'), 100);
      assert.equal(getMethodTotal(sale, 'transfer'), 200);
    });
    it('should return 0 for non-existent method', () => {
      const sale = { payments: [{ method: 'cash', amount: 100 }] };
      assert.equal(getMethodTotal(sale, 'debit'), 0);
    });
  });

  describe('getPaymentMethodLabel', () => {
    it('should return label for known methods', () => {
      assert.equal(getPaymentMethodLabel('cash'), 'Efectivo');
      assert.equal(getPaymentMethodLabel('debit'), 'Débito');
      assert.equal(getPaymentMethodLabel('transfer'), 'Transferencia');
      assert.equal(getPaymentMethodLabel('account'), 'Cuenta Corriente');
    });
    it('should return method id for unknown methods', () => {
      assert.equal(getPaymentMethodLabel('unknown'), 'unknown');
    });
    it('should return N/A for empty input', () => {
      assert.equal(getPaymentMethodLabel(''), 'N/A');
    });
  });

  describe('validatePayments', () => {
    it('should return valid for correct payment', () => {
      const result = validatePayments([{ method: 'cash', amount: 100 }], 100);
      assert.equal(result.valid, true);
    });
    it('should reject empty payments', () => {
      const result = validatePayments([], 100);
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('método'));
    });
    it('should reject null payments', () => {
      const result = validatePayments(null, 100);
      assert.equal(result.valid, false);
    });
    it('should reject negative amounts', () => {
      const result = validatePayments([{ method: 'cash', amount: -10 }], 100);
      assert.equal(result.valid, false);
    });
    it('should reject when sum does not match total', () => {
      const result = validatePayments([{ method: 'cash', amount: 50 }], 100);
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('coincide'));
    });
    it('should accept within 0.01 tolerance', () => {
      const result = validatePayments([{ method: 'cash', amount: 100.005 }], 100);
      assert.equal(result.valid, true);
    });
    it('should reject when amount exceeds tolerance', () => {
      const result = validatePayments([{ method: 'cash', amount: 100.02 }], 100);
      assert.equal(result.valid, false);
    });
    it('should accept combined payments matching total', () => {
      const result = validatePayments(
        [
          { method: 'cash', amount: 50 },
          { method: 'transfer', amount: 50 }
        ],
        100
      );
      assert.equal(result.valid, true);
    });
  });
});
