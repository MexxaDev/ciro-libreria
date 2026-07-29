import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasRoutePermission, getDefaultRoute, canPerformAction, ROLES } from '../config/permissions.js';

describe('permissions', () => {
  describe('hasRoutePermission', () => {
    it('admin should access all routes', () => {
      assert.equal(hasRoutePermission('admin', 'dashboard'), true);
      assert.equal(hasRoutePermission('admin', 'pos'), true);
      assert.equal(hasRoutePermission('admin', 'settings'), true);
      assert.equal(hasRoutePermission('admin', 'reports'), true);
    });

    it('cajero should access POS, sales, products, and cash', () => {
      assert.equal(hasRoutePermission('cajero', 'pos'), true);
      assert.equal(hasRoutePermission('cajero', 'sales'), true);
      assert.equal(hasRoutePermission('cajero', 'products'), true);
      assert.equal(hasRoutePermission('cajero', 'cash'), true);
    });

    it('cajero should NOT access dashboard, settings, reports, or categories', () => {
      assert.equal(hasRoutePermission('cajero', 'dashboard'), false);
      assert.equal(hasRoutePermission('cajero', 'settings'), false);
      assert.equal(hasRoutePermission('cajero', 'reports'), false);
      assert.equal(hasRoutePermission('cajero', 'categories'), false);
    });

    it('unknown role should have no access', () => {
      assert.equal(hasRoutePermission('hacker', 'pos'), false);
    });
  });

  describe('getDefaultRoute', () => {
    it('admin defaults to dashboard', () => {
      assert.equal(getDefaultRoute('admin'), 'dashboard');
    });

    it('cajero defaults to pos', () => {
      assert.equal(getDefaultRoute('cajero'), 'pos');
    });

    it('unknown role defaults to dashboard', () => {
      assert.equal(getDefaultRoute('unknown'), 'dashboard');
    });
  });

  describe('canPerformAction', () => {
    it('admin can perform all actions', () => {
      assert.equal(canPerformAction('admin', 'manage_users'), true);
      assert.equal(canPerformAction('admin', 'cancel_sale'), true);
    });

    it('cajero can cancel sales', () => {
      assert.equal(canPerformAction('cajero', 'cancel_sale'), true);
    });

    it('cajero cannot manage users', () => {
      assert.equal(canPerformAction('cajero', 'manage_users'), false);
    });
  });

  describe('ROLES', () => {
    it('should have admin and cajero values', () => {
      assert.equal(ROLES.ADMIN, 'admin');
      assert.equal(ROLES.CAJERO, 'cajero');
    });

    it('should not have supervisor', () => {
      const values = Object.values(ROLES);
      assert.ok(!values.includes('supervisor'));
    });
  });
});
