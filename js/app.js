'use strict';

import db from '../db/indexeddb.js';
import state from './state.js';
import router from './router.js';
import {
  userRepo,
  settingRepo,
  categoryRepo,
  productRepo,
  paymentMethodRepo,
  customerRepo
} from '../db/repositories.js';
import Sidebar from '../components/sidebar.js';
import Header from '../components/header.js';
import Toast from '../components/toast.js';
import POS from '../modules/pos/pos.js';
import Products from '../modules/products/products.js';
import Categories from '../modules/categories/categories.js';
import Customers from '../modules/customers/customers.js';
import Sales from '../modules/sales/sales.js';
import Cash from '../modules/cash/cash.js';
import Settings from '../modules/settings/settings.js';
import Users from '../modules/users/users.js';
import Dashboard from '../modules/dashboard/dashboard.js';
import Reports from '../modules/reports/reports.js';
import PaymentMethods from '../modules/payment-methods/paymentMethods.js';
import Notification from '../components/notification.js';
import { hashPassword, verifyPassword, isLikelyHash, isSaltedHash } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import { BRAND } from '../config/brandConfig.js';
import { loadPaymentMethods } from '../utils/payments.js';

async function migratePasswords() {
  const users = await userRepo.findAll();
  for (const user of users) {
    if (user.password && !isSaltedHash(user.password) && !isLikelyHash(user.password)) {
      logger.info('App', `Hashing plaintext password for user: ${user.username}`);
      await userRepo.update({ ...user, password: await hashPassword(user.password) });
    }
  }
}

async function seedDatabase() {
  try {
    const response = await fetch('./data/seed.json');
    const seedData = await response.json();

    const users = await userRepo.findAll();
    if (users.length === 0) {
      for (const category of seedData.categories) {
        await categoryRepo.create(category);
      }
      for (const product of seedData.products) {
        await productRepo.create(product);
      }
      for (const user of seedData.users) {
        await userRepo.create({
          ...user,
          password: await hashPassword(user.password)
        });
      }
      for (const setting of seedData.settings) {
        await settingRepo.create(setting);
      }
      if (seedData.payment_methods) {
        for (const pm of seedData.payment_methods) {
          await paymentMethodRepo.create(pm);
        }
      }
      const defaultCustomer = seedData.customers?.find(c => c.id === 'cust_final');
      if (defaultCustomer) {
        await customerRepo.create(defaultCustomer);
      }
      logger.info('App', 'Seed data loaded');
    } else {
      await migratePasswords();

      const products = await productRepo.findAll();
      const hasOldCatalog = products.some(p => /^prod_\d+$/.test(p.id));

      if (hasOldCatalog) {
        for (const p of products) {
          if (/^prod_\d+$/.test(p.id)) {
            await productRepo.delete(p.id);
          }
        }
        const categories = await categoryRepo.findAll();
        for (const c of categories) {
          if (['cat_1', 'cat_2', 'cat_3', 'cat_4'].includes(c.id)) {
            await categoryRepo.delete(c.id);
          }
        }
        for (const category of seedData.categories) {
          await categoryRepo.create(category);
        }
        for (const product of seedData.products) {
          await productRepo.create(product);
        }
        logger.info('App', 'Migrated to librería catalog: 11 categories, 344 products');
      } else if (products.length < seedData.products.length) {
        for (const product of seedData.products) {
          const existing = products.find(p => p.id === product.id);
          if (!existing) {
            await productRepo.create(product);
          }
        }
        logger.info('App', 'Additional products seeded');
      }

      const settings = await settingRepo.findAll();
      const settingsMap = {};
      settings.forEach(s => {
        settingsMap[s.key] = s;
      });

      for (const setting of seedData.settings) {
        if (!settingsMap[setting.key]) {
          await settingRepo.create(setting);
        }
      }

      if (seedData.payment_methods) {
        const existingMethods = await paymentMethodRepo.findAll();
        if (existingMethods.length === 0) {
          for (const pm of seedData.payment_methods) {
            await paymentMethodRepo.create(pm);
          }
        }
      }

      const existingCustomers = await customerRepo.findAll();
      const hasDefaultCustomer = existingCustomers.some(c => c.id === 'cust_final');
      if (!hasDefaultCustomer) {
        await customerRepo.create({
          id: 'cust_final',
          name: 'Consumidor Final',
          phone: '',
          address: '',
          balance: 0,
          isDefault: true,
          createdAt: new Date().toISOString()
        });
        logger.info('App', 'Default customer seeded');
      }
    }
  } catch (error) {
    logger.error('App', 'Error seeding database', error);
  }
}

let _loginAttempts = 0;
let _loginLockoutUntil = 0;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 60000;

function initLogin() {
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.getElementById('app');
  const shopContainer = document.getElementById('shop-container');

  const hash = window.location.hash.slice(1);
  if (hash === 'shop') {
    loginScreen.style.display = 'none';
    appContainer.style.display = 'none';
    if (shopContainer) {
      shopContainer.style.display = 'block';
      shopContainer.classList.add('active');
    }
    document.body.classList.add('shop-active');
    return;
  }

  const currentUser = state.get('currentUser');
  if (currentUser) {
    loginScreen.style.display = 'none';
    appContainer.style.display = 'grid';
    initApp();
    return;
  }

  loginScreen.innerHTML = `
    <div class="login-card">
      <div class="login-header">
        <img src="${BRAND.logo}" alt="${BRAND.name}" class="login-logo" width="64" height="64">
        <h1 class="login-title">${BRAND.name}</h1>
        <p class="login-subtitle">Ingresá tus credenciales</p>
      </div>
      <form class="login-form" id="login-form">
        <div class="form-group">
          <label class="form-label">Usuario</label>
          <input type="text" class="form-input" id="login-username" placeholder="admin o cajero" required>
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <input type="password" class="form-input" id="login-password" placeholder="Contraseña" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">Ingresar</button>
      </form>
      <div class="login-footer">
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();

    if (Date.now() < _loginLockoutUntil) {
      const secs = Math.ceil((_loginLockoutUntil - Date.now()) / 1000);
      Toast.error('Bloqueado', `Demasiados intentos. Esperá ${secs}s`);
      return;
    }

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const users = await userRepo.findAll();
    const user = users.find(u => u.username === username);
    const matched = user && (await verifyPassword(password, user.password));

    if (matched) {
      _loginAttempts = 0;
      state.set('currentUser', {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      });
      loginScreen.style.display = 'none';
      appContainer.style.display = 'grid';

      if (user.role === 'cajero') {
        appContainer.classList.add('sidebar-collapsed');
      }

      initApp();
      Toast.success('Bienvenido', `Hola ${user.name}`);
    } else {
      _loginAttempts++;
      if (_loginAttempts >= LOGIN_MAX_ATTEMPTS) {
        _loginLockoutUntil = Date.now() + LOGIN_LOCKOUT_MS;
        _loginAttempts = 0;
        Toast.error('Bloqueado', 'Demasiados intentos. Esperá 60 segundos');
      } else {
        Toast.error('Error', 'Credenciales incorrectas');
      }
    }
  });
}

function initApp() {
  const sidebar = new Sidebar();
  sidebar.mount(document.getElementById('sidebar'));

  const header = new Header();
  header.mount(document.getElementById('header'));

  Toast.init(document.getElementById('toast-container'));

  Notification.init();

  if (state.get('sidebarMode') === 'hover') {
    document.getElementById('app')?.classList.add('sidebar-collapsed');
  }

  state.on('state:currentRoute', route => {
    loadModule(route);
  });

  state.on('data:users-changed', async () => {
    const current = state.get('currentUser');
    if (!current) {
      return;
    }
    const users = await userRepo.findAll();
    const fresh = users.find(u => u.id === current.id);
    if (!fresh) {
      state.clearSession();
      window.location.reload();
    }
  });

  state.on('data:settings-changed', settings => {
    applyTheme(settings.theme);
  });

  if (state.get('currentUser')) {
    loadSettings();
    loadModule(state.get('currentRoute') || 'dashboard');
  }
}

let _previousSidebarMode = null;

async function loadModule(route) {
  try {
    const app = document.getElementById('app');

    if (route !== 'pos' && _previousSidebarMode !== null) {
      const prevMode = _previousSidebarMode;
      _previousSidebarMode = null;
      app?.classList.remove('sidebar-collapsed', 'sidebar-hidden');
      if (prevMode === 'collapsed' || prevMode === 'hover') {
        app?.classList.add('sidebar-collapsed');
      }
      state.set('sidebarMode', prevMode);
    }

    switch (route) {
      case 'pos': {
        _previousSidebarMode = state.get('sidebarMode') || 'expanded';
        await POS.loadProducts();
        const confirmBtn = document.getElementById('confirm-sale-btn');
        if (confirmBtn && !confirmBtn._handlerAttached) {
          confirmBtn._handlerAttached = true;
          confirmBtn.addEventListener('click', () => POS.confirmSale());
        }
        const discountType = document.getElementById('discount-type');
        const discountValue = document.getElementById('discount-value');
        if (discountType && !discountType._handlerAttached) {
          discountType._handlerAttached = true;
          discountType.addEventListener('change', e => {
            POS.setDiscount(e.target.value, discountValue?.value || 0);
          });
        }
        if (discountValue && !discountValue._handlerAttached) {
          discountValue._handlerAttached = true;
          let discTimeout;
          discountValue.addEventListener('input', e => {
            clearTimeout(discTimeout);
            discTimeout = setTimeout(() => {
              const type = discountType?.value || 'percent';
              POS.setDiscount(type, e.target.value);
            }, 300);
          });
        }
        setTimeout(() => {
          const barcodeInput = document.getElementById('pos-barcode-input');
          if (barcodeInput) {
            barcodeInput.focus();
          }
        }, 100);

        if (app) {
          app.classList.add('sidebar-collapsed');
          app.classList.remove('sidebar-hidden');
          state.set('sidebarMode', 'hover');
        }
        break;
      }
      case 'products': {
        await Products.load();
        const addProductBtn = document.getElementById('add-product-btn');
        if (addProductBtn && !addProductBtn._handlerAttached) {
          addProductBtn._handlerAttached = true;
          addProductBtn.addEventListener('click', () => Products.openModal());
        }
        const barcodeSearch = document.getElementById('product-barcode-search');
        if (barcodeSearch && !barcodeSearch._handlerAttached) {
          barcodeSearch._handlerAttached = true;
          barcodeSearch.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const code = barcodeSearch.value.trim();
              if (code) {
                Products.searchBarcode(code);
              }
            }
          });
        }
        const exportBtn = document.getElementById('export-products-btn');
        if (exportBtn && !exportBtn._handlerAttached) {
          exportBtn._handlerAttached = true;
          exportBtn.addEventListener('click', () => Products.exportProducts());
        }
        const importBtn = document.getElementById('import-products-btn');
        if (importBtn && !importBtn._handlerAttached) {
          importBtn._handlerAttached = true;
          importBtn.addEventListener('click', () => document.getElementById('import-products-file')?.click());
        }
        const importFile = document.getElementById('import-products-file');
        if (importFile && !importFile._handlerAttached) {
          importFile._handlerAttached = true;
          importFile.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) {
              Products.importProducts(file);
              importFile.value = '';
            }
          });
        }
        break;
      }
      case 'categories': {
        await Categories.load();
        const addCategoryBtn = document.getElementById('add-category-btn');
        if (addCategoryBtn && !addCategoryBtn._handlerAttached) {
          addCategoryBtn._handlerAttached = true;
          addCategoryBtn.addEventListener('click', () => Categories.openModal());
        }
        break;
      }
      case 'customers': {
        const custContainer = document.getElementById('customers-content');
        if (custContainer) {
          await Customers.load();
        }
        break;
      }
      case 'sales': {
        const salesContainer = document.getElementById('sales-list');
        if (salesContainer) {
          await Sales.load();
          const filterBtn = document.getElementById('sales-filter-btn');
          if (filterBtn && !filterBtn._handlerAttached) {
            filterBtn._handlerAttached = true;
            filterBtn.addEventListener('click', () => Sales.filter());
          }
          const clearBtn = document.getElementById('sales-clear-filters-btn');
          if (clearBtn && !clearBtn._handlerAttached) {
            clearBtn._handlerAttached = true;
            clearBtn.addEventListener('click', () => Sales._clearFilters());
          }
          const customerSelect = document.getElementById('sales-customer-filter');
          if (customerSelect && !customerSelect._handlerAttached) {
            customerSelect._handlerAttached = true;
            customerSelect.addEventListener('change', () => Sales.filter());
          }
        }
        break;
      }
      case 'cash': {
        const cashContainer = document.getElementById('cash-content');
        if (cashContainer) {
          await Cash.load();
        }
        break;
      }
      case 'settings': {
        const settingsContainer = document.getElementById('settings');
        if (settingsContainer) {
          await Settings.load();
        }
        break;
      }
      case 'users': {
        const usersContainer = document.getElementById('users-content');
        if (usersContainer) {
          await Users.load();
        }
        break;
      }
      case 'reports': {
        const reportsContainer = document.getElementById('reports');
        if (reportsContainer) {
          await Reports.load();
        }
        break;
      }
      case 'payment-methods': {
        const pmContainer = document.getElementById('payment-methods-content');
        if (pmContainer) {
          await PaymentMethods.load();
        }
        break;
      }
      case 'dashboard':
      default: {
        const dashboardContainer = document.getElementById('dashboard');
        if (dashboardContainer) {
          await Dashboard.load();
        }
        break;
      }
    }
  } catch (error) {
    logger.error('App', `Error loading module ${route}`, error);
  }
}

async function loadSettings() {
  const defaultSettings = [
    { key: 'businessName', value: 'Mi Negocio' },
    { key: 'currency', value: 'ARS' },
    { key: 'currencySymbol', value: '$' },
    { key: 'ticketFooter', value: 'Gracias por su compra!' },
    { key: 'logo', value: '' },
    { key: 'creditLimitEnabled', value: 'false' },
    { key: 'creditLimit', value: '250000' }
  ];

  try {
    const existingSettings = await settingRepo.findAll();
    const existingMap = {};
    existingSettings.forEach(s => {
      existingMap[s.key] = s;
    });

    for (const def of defaultSettings) {
      if (!existingMap[def.key]) {
        await settingRepo.create(def);
      }
    }

    const settings = await settingRepo.findAll();
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    state.set('settings', settingsObj);
    applyTheme(settingsObj.theme);
  } catch (error) {
    logger.error('App', 'Error loading settings', error);
    state.set('settings', { currencySymbol: '$' });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
      logger.info('App', 'Service Worker registered');
    } catch (error) {
      logger.warn('App', 'Service Worker registration failed', error);
    }
  }
}

(async () => {
  try {
    await db.init();
    await seedDatabase();
    await loadPaymentMethods();

    initLogin();
    router.init();
    registerServiceWorker();
  } catch (error) {
    logger.error('App', 'App initialization error', error);
  }
})();
