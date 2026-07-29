import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Sales from '../modules/sales/sales.js';
import Dashboard from '../modules/dashboard/dashboard.js';
import { prepareSaleRows } from '../utils/saleHelpers.js';

describe('modules', () => {
  describe('Sales._computeTotals', () => {
    it('should return zeros for empty sales', () => {
      const result = Sales._computeTotals([]);
      assert.equal(result.totalVentas, 0);
      assert.equal(result.totalEfectivo, 0);
      assert.equal(result.totalTransferencia, 0);
    });

    it('should sum totals and payment methods', () => {
      const sales = [
        { total: 100, payments: [{ method: 'cash', amount: 100 }] },
        { total: 200, payments: [{ method: 'transfer', amount: 200 }] },
        {
          total: 150,
          payments: [
            { method: 'cash', amount: 75 },
            { method: 'transfer', amount: 75 }
          ]
        }
      ];
      const result = Sales._computeTotals(sales);
      assert.equal(result.totalVentas, 450);
      assert.equal(result.totalEfectivo, 175);
      assert.equal(result.totalTransferencia, 275);
    });

    it('should handle sales with string total', () => {
      const sales = [{ total: '150.50', payments: [{ method: 'cash', amount: 150.5 }] }];
      const result = Sales._computeTotals(sales);
      assert.equal(result.totalVentas, 150.5);
    });

    it('should handle legacy sales without payments field', () => {
      const sales = [{ total: 100, paymentMethod: 'cash' }];
      const result = Sales._computeTotals(sales);
      assert.equal(result.totalVentas, 100);
      assert.equal(result.totalEfectivo, 100);
    });
  });

  describe('Dashboard.getChangePercent', () => {
    it('should return +100% when previous is 0 and current > 0', () => {
      assert.equal(Dashboard.getChangePercent(100, 0), '+100%');
    });

    it('should return +0% when both are 0', () => {
      assert.equal(Dashboard.getChangePercent(0, 0), '+0%');
    });

    it('should return +50% for increase from 100 to 150', () => {
      assert.equal(Dashboard.getChangePercent(150, 100), '+50.0%');
    });

    it('should return -33.3% for decrease from 150 to 100', () => {
      assert.equal(Dashboard.getChangePercent(100, 150), '-33.3%');
    });

    it('should return +100% when previous is null/undefined', () => {
      assert.equal(Dashboard.getChangePercent(50, null), '+100%');
    });
  });

  describe('prepareSaleRows', () => {
    const customers = [
      { id: 'cust_1', name: 'Juan Perez' },
      { id: 'cust_2', name: 'Maria Gomez' }
    ];

    it('should return empty array for null/undefined sales', () => {
      assert.equal(prepareSaleRows(null, []).length, 0);
      assert.equal(prepareSaleRows(undefined, []).length, 0);
    });

    it('should return mapped rows for simple sale', () => {
      const sales = [
        {
          id: 'S-2026-000001',
          date: '2026-01-15T10:00:00.000Z',
          customerId: 'cust_1',
          total: 150,
          paymentMethod: 'cash'
        }
      ];
      const rows = prepareSaleRows(sales, customers);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]._id, 'S-2026-0');
      assert.equal(rows[0]._customer, 'Juan Perez');
      assert.ok(rows[0]._total.includes('150'));
      assert.ok(rows[0]._method.includes('Efectivo'));
    });

    it('should resolve Consumidor Final when no customerId', () => {
      const sales = [{ id: 'S-2026-000002', total: 50, paymentMethod: 'cash' }];
      const rows = prepareSaleRows(sales, customers);
      assert.equal(rows[0]._customer, 'Consumidor Final');
    });

    it('should resolve Consumidor Final when customer not found', () => {
      const sales = [{ id: 'S-2026-000003', customerId: 'nonexistent', total: 50, paymentMethod: 'transfer' }];
      const rows = prepareSaleRows(sales, customers);
      assert.equal(rows[0]._customer, 'Consumidor Final');
    });

    it('should display COMBINADO badge for multi-payment sales', () => {
      const sales = [
        {
          id: 'S-2026-000004',
          total: 100,
          payments: [
            { method: 'cash', amount: 50 },
            { method: 'transfer', amount: 50 }
          ]
        }
      ];
      const rows = prepareSaleRows(sales, customers);
      assert.ok(rows[0]._method.includes('COMBINADO'));
    });

    it('should handle undefined customers array', () => {
      const sales = [{ id: 'S-2026-000005', total: 30, paymentMethod: 'debit' }];
      const rows = prepareSaleRows(sales, undefined);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]._customer, 'Consumidor Final');
    });

    it('should return sale reference and customers in each row', () => {
      const sale = { id: 'S-2026-000006', total: 75, paymentMethod: 'cash' };
      const rows = prepareSaleRows([sale], customers);
      assert.equal(rows[0]._sale, sale);
      assert.equal(rows[0]._customers, customers);
    });
  });
});
