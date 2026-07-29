'use strict';

export const ROLES = {
  ADMIN: 'admin',
  CAJERO: 'cajero'
};

export const ROUTE_PERMISSIONS = {
  dashboard: [ROLES.ADMIN],
  pos: [ROLES.ADMIN, ROLES.CAJERO],
  products: [ROLES.ADMIN, ROLES.CAJERO],
  categories: [ROLES.ADMIN],
  customers: [ROLES.ADMIN],
  sales: [ROLES.ADMIN, ROLES.CAJERO],
  cash: [ROLES.ADMIN, ROLES.CAJERO],
  reports: [ROLES.ADMIN],
  settings: [ROLES.ADMIN],
  users: [ROLES.ADMIN],
  'payment-methods': [ROLES.ADMIN]
};

export const DEFAULT_ROUTES = {
  [ROLES.ADMIN]: 'dashboard',
  [ROLES.CAJERO]: 'pos'
};

export const MENU_ITEMS = {
  [ROLES.ADMIN]: [
    { route: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
    { route: 'pos', icon: 'fa-cash-register', label: 'POS' },
    { route: 'products', icon: 'fa-box', label: 'Productos' },
    { route: 'categories', icon: 'fa-tags', label: 'Categorías' },
    { route: 'customers', icon: 'fa-users', label: 'Clientes' },
    { route: 'sales', icon: 'fa-money-bill', label: 'Ventas' },
    { route: 'cash', icon: 'fa-money-bill-wave', label: 'Caja' },
    { route: 'reports', icon: 'fa-chart-bar', label: 'Reportes' },
    { route: 'payment-methods', icon: 'fa-credit-card', label: 'Medios de Pago' },
    { route: 'users', icon: 'fa-users-gear', label: 'Usuarios' },
    { route: 'settings', icon: 'fa-gear', label: 'Configuración' }
  ],
  [ROLES.CAJERO]: [
    { route: 'pos', icon: 'fa-cash-register', label: 'POS' },
    { route: 'cash', icon: 'fa-money-bill-wave', label: 'Caja' },
    { route: 'products', icon: 'fa-box', label: 'Productos' },
    { route: 'sales', icon: 'fa-money-bill', label: 'Ventas' }
  ]
};

export function hasRoutePermission(role, route) {
  const allowed = ROUTE_PERMISSIONS[route];
  if (!allowed) {
    return false;
  }
  return allowed.includes(role);
}

export function getDefaultRoute(role) {
  return DEFAULT_ROUTES[role] || 'dashboard';
}

export function getAllowedRoutes(role) {
  return Object.entries(ROUTE_PERMISSIONS)
    .filter(([, roles]) => roles.includes(role))
    .map(([route]) => route);
}

export function getMenuForRole(role) {
  return MENU_ITEMS[role] || [];
}

export function canPerformAction(role, action) {
  const cajeroActions = ['cancel_sale'];

  if (role === ROLES.ADMIN) {
    return true;
  }
  if (role === ROLES.CAJERO) {
    return cajeroActions.includes(action);
  }
  return false;
}
