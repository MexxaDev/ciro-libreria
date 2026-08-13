'use strict';

import {
  productRepo,
  customerRepo,
  saleRepo,
  saleItemRepo,
  categoryRepo,
  settingRepo,
  generateSaleId
} from '../../db/repositories.js';
import Toast from '../../components/toast.js';
import state from '../../js/state.js';
import { format } from '../../utils/currency.js';
import { getProductImage } from '../../utils/imageHelper.js';
import { logger } from '../../utils/logger.js';
import { PAYMENT_METHODS, validatePayments, loadPaymentMethods } from '../../utils/payments.js';
import { renderTicketBody, showTicketModal } from '../../utils/ticket.js';
import cash from '../cash/cash.js';
import cashService from '../cash/cashService.js';
import { escapeHtml } from '../../utils/sanitizer.js';

class POS {
  constructor() {
    this.cart = [];
    this.products = [];
    this.categories = [];
    this.customers = [];
    this.currentCustomer = null;
    this.currentCategory = null;
    this.discount = 0;
    this.discountType = 'percent';
    this.payments = [{ method: 'cash', amount: 0 }];
    this.settings = {};
    this._isProcessing = false;
  }

  async loadProducts() {
    await cashService.requireActiveSession();

    const [products, customers, categories, settings] = await Promise.all([
      productRepo.findAll(),
      customerRepo.findAll(),
      categoryRepo.findAll(),
      settingRepo.findAll()
    ]);

    this.products = products.filter(p => !p.inactive && p.visible !== false);
    this.categories = categories;
    this.customers = customers;

    this.settings = {};
    settings.forEach(s => {
      this.settings[s.key] = s.value;
    });

    this.renderProducts();
    this._injectCategoryPills();
    this.renderCart();
    this.renderCustomerSelect();
    this.setupBarcodeInput();
    this._renderPaymentUI();
    this._injectCashButton();
    this._setupDataListeners();
    this._setupKeyboardShortcuts();
  }

  _setupDataListeners() {
    if (this._listenersAttached) {
      return;
    }
    this._listenersAttached = true;

    state.on('data:settings-changed', newSettings => {
      this.settings = newSettings || {};
      this.renderCart();
      this._renderPaymentUI();
    });

    state.on('data:categories-changed', async () => {
      this.categories = await categoryRepo.findAll();
      this._injectCategoryPills();
      this.renderProducts();
    });

    state.on('data:products-changed', async () => {
      const all = await productRepo.findAll();
      this.products = all.filter(p => !p.inactive && p.visible !== false);
      this.renderProducts();
    });

    state.on('data:customers-changed', async () => {
      this.customers = await customerRepo.findAll();
      this.renderCustomerSelect();
    });

    state.on('data:payment-methods-changed', async () => {
      await loadPaymentMethods();
      this._renderPaymentUI();
      this.renderCart();
    });
  }

  _injectCategoryPills() {
    const container = document.querySelector('.pos-products');
    if (!container) {
      return;
    }

    let pillsContainer = document.getElementById('pos-category-pills');
    if (pillsContainer) {
      pillsContainer.remove();
    }

    pillsContainer = document.createElement('div');
    pillsContainer.id = 'pos-category-pills';
    pillsContainer.className = 'pos-category-pills';

    pillsContainer.innerHTML = `
      <button class="pos-category-pill ${!this.currentCategory ? 'active' : ''}" data-category-id="all">Todos</button>
      ${this.categories
        .map(
          cat => `
        <button class="pos-category-pill ${this.currentCategory === cat.id ? 'active' : ''}" data-category-id="${escapeHtml(cat.id)}">${escapeHtml(cat.name)}</button>
      `
        )
        .join('')}
    `;

    const searchBar = container.querySelector('.pos-search-bar');
    const productList = document.getElementById('pos-product-list');
    if (searchBar && productList) {
      searchBar.after(pillsContainer);
    } else {
      container.insertBefore(pillsContainer, productList);
    }

    pillsContainer.querySelectorAll('.pos-category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const categoryId = pill.dataset.categoryId;
        this.currentCategory = categoryId === 'all' ? null : categoryId;

        pillsContainer.querySelectorAll('.pos-category-pill').forEach(p => {
          p.classList.remove('active');
        });
        pill.classList.add('active');

        this.renderProducts();
      });
    });
  }

  setupBarcodeInput() {
    if (this._barcodeAttached) {
      return;
    }
    const barcodeInput = document.getElementById('pos-barcode-input');
    if (!barcodeInput) {
      return;
    }

    this._barcodeAttached = true;
    setTimeout(() => barcodeInput.focus(), 100);

    barcodeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = barcodeInput.value.trim();
        if (code) {
          this.searchBarcode(code);
        }
      }
    });
  }

  _setupKeyboardShortcuts() {
    if (this._kbAttached) {
      return;
    }
    this._kbAttached = true;

    document.addEventListener('keydown', e => {
      const tag = document.activeElement?.tagName || '';
      const isInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

      if (e.key === 'F2' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('pos-search-input')?.focus();
        return;
      }

      if (e.key === 'F3' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('pos-barcode-input')?.focus();
        return;
      }

      if (e.key === 'F4' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('confirm-sale-btn')?.click();
        return;
      }

      if (e.key === 'F5' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('discount-value')?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (isInput) {
          document.activeElement?.blur();
        } else {
          const searchInput = document.getElementById('pos-search-input');
          if (searchInput && searchInput.value) {
            searchInput.value = '';
            this.renderProducts();
          }
        }
        return;
      }

      if (e.key === '?' && !isInput) {
        e.preventDefault();
        this._showShortcutsHelp();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('confirm-sale-btn')?.click();
        return;
      }
    });
  }

  _showShortcutsHelp() {
    const existing = document.querySelector('.pos-shortcuts-help');
    if (existing) {
      existing.remove();
      return;
    }

    const shortcuts = [
      ['F2', 'Buscar productos'],
      ['F3', 'Código de barras'],
      ['F4', 'Confirmar venta'],
      ['F5', 'Descuento'],
      ['Esc', 'Limpiar / Salir'],
      ['Ctrl+Enter', 'Confirmar venta'],
      ['?', 'Ayuda de atajos']
    ];

    const overlay = document.createElement('div');
    overlay.className = 'pos-shortcuts-help';
    overlay.innerHTML = `
      <div class="pos-shortcuts-help__card">
        <div class="pos-shortcuts-help__title">Atajos de teclado</div>
        <div class="pos-shortcuts-help__grid">
          ${shortcuts
            .map(
              ([key, action]) => `
            <div class="pos-shortcuts-help__row">
              <span class="pos-shortcuts-help__action">${action}</span>
              <span class="pos-shortcuts-help__key">${key}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    document.body.appendChild(overlay);
  }

  async searchBarcode(code) {
    const barcodeInput = document.getElementById('pos-barcode-input');
    let product = this.products.find(p => {
      if (p.barcode === code || p.id === code) {
        return true;
      }
      if (p.barcodes_extra) {
        try {
          return JSON.parse(p.barcodes_extra).includes(code);
        } catch {
          return false;
        }
      }
      return false;
    });

    if (!product) {
      product = this.products.find(p => p.sku && p.sku === code);
    }

    let quantity = 1;

    if (!product) {
      for (const p of this.products) {
        const candidates = [p.barcode];
        if (p.barcodes_extra) {
          try {
            candidates.push(...JSON.parse(p.barcodes_extra));
          } catch {
            /* ignore */
          }
        }
        candidates.push(p.sku, p.id);
        const matched = candidates.find(c => c && code.endsWith(c) && code.length > c.length);
        if (matched) {
          const prefix = code.slice(0, code.length - matched.length);
          const parsed = parseInt(prefix, 10);
          if (!isNaN(parsed) && parsed > 0 && String(parsed) === prefix) {
            product = p;
            quantity = parsed;
            break;
          }
        }
      }
    }

    if (product) {
      this.addToCart(product.id, quantity);
      if (barcodeInput) {
        barcodeInput.value = '';
        barcodeInput.focus();
      }
      Toast.success('Agregado', `${quantity > 1 ? quantity + 'x ' : ''}${product.name} agregado al carrito`);
    } else {
      Toast.error('No encontrado', `Producto con código "${code}" no encontrado`);
      if (barcodeInput) {
        barcodeInput.value = '';
        barcodeInput.focus();
      }
    }
  }

  renderProducts() {
    const container = document.getElementById('pos-product-list');
    if (!container) {
      return;
    }

    const searchInput = document.querySelector('.pos-search-bar .form-input');
    const query = searchInput ? searchInput.value.toLowerCase() : '';

    let products = this.products;
    if (query) {
      products = products.filter(p => {
        if (p.name.toLowerCase().includes(query)) {
          return true;
        }
        if (p.barcode && p.barcode.includes(query)) {
          return true;
        }
        if (p.barcodes_extra) {
          try {
            return JSON.parse(p.barcodes_extra).some(e => e.includes(query));
          } catch {
            return false;
          }
        }
        return false;
      });
    }
    if (this.currentCategory) {
      products = products.filter(p => p.categoryId === this.currentCategory);
    }

    if (products.length === 0) {
      container.innerHTML =
        '<p class="pos-cart-empty" style="padding:var(--space-4);">No hay productos disponibles.</p>';
      return;
    }

    const placeholder = getProductImage({ name: 'Product', image: '' }, []);

    container.innerHTML = products
      .map(product => {
        const imageSrc = getProductImage(product, this.categories);
        const outOfStock = product.stock <= 0;
        const lowStock = product.stock <= 5 && product.stock > 0;
        let stockBadge = '';
        if (outOfStock) {
          stockBadge =
            '<span class="pos-product-card__stock-badge pos-product-card__stock-badge--out">Sin stock</span>';
        } else if (lowStock) {
          stockBadge = `<span class="pos-product-card__stock-badge pos-product-card__stock-badge--low">${product.stock}</span>`;
        }
        return `
        <div class="pos-product-card ${outOfStock ? 'pos-product-card--out-of-stock' : ''}" data-id="${escapeHtml(product.id)}">
          <div class="pos-product-card__image">
            ${stockBadge}
            <img src="${imageSrc}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(placeholder)}';">
          </div>
          <div class="pos-product-card__name">${escapeHtml(product.name)}</div>
          <div class="pos-product-card__price">${format(product.price)}</div>
        </div>
      `;
      })
      .join('');

    container.querySelectorAll('.pos-product-card').forEach(card => {
      card.addEventListener('click', () => {
        const productId = card.dataset.id;
        this.addToCart(productId);
      });
    });

    if (searchInput && !this._searchAttached) {
      this._searchAttached = true;
      let timeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => this.renderProducts(), 300);
      });
    }
  }

  addToCart(productId, quantity = 1) {
    const product = this.products.find(p => p.id === productId);
    if (!product) {
      return;
    }

    if (!product.variablePrice && product.stock <= 0) {
      Toast.error('Sin stock', `${product.name} no tiene stock disponible`);
      return;
    }

    const existing = this.cart.find(item => item.id === productId);
    if (existing) {
      if (!product.variablePrice && existing.quantity + quantity > product.stock) {
        Toast.error('Sin stock', `${product.name} solo tiene ${product.stock} unidades`);
        return;
      }
      existing.quantity += quantity;
    } else {
      if (!product.variablePrice && quantity > product.stock) {
        Toast.error('Sin stock', `${product.name} solo tiene ${product.stock} unidades`);
        return;
      }
      this.cart.push({ ...product, quantity });
    }
    this.renderCart();
  }

  renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) {
      return;
    }

    if (this.cart.length === 0) {
      container.innerHTML =
        '<div class="pos-cart-empty"><i class="fa-solid fa-cart-shopping"></i>El carrito está vacío</div>';
      this.updateTotal();
      this._updateCartCount();
      return;
    }

    const placeholder = getProductImage({ name: 'Product', image: '' }, []);

    container.innerHTML = this.cart
      .map((item, index) => {
        const imageSrc = getProductImage(item, this.categories);
        return `
        <div class="pos-cart-item">
          <div class="pos-cart-item__image">
            <img src="${imageSrc}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(placeholder)}';">
          </div>
          <div class="pos-cart-item__info">
            <div class="pos-cart-item__name">${escapeHtml(item.name)}</div>
            <div class="pos-cart-item__price">${
              item.variablePrice
                ? `$ <input type="number" class="pos-cart-item__price-input" value="${item.price}" min="0" step="0.01" data-index="${index}"> x ${item.quantity}`
                : `${format(item.price)} x <input type="number" class="pos-cart-item__qty-input" value="${item.quantity}" min="1" max="${item.stock || 999}" data-index="${index}">`
            }</div>
          </div>
          <div class="pos-cart-item__actions">
            <button class="pos-cart-item__btn pos-cart-item__btn--remove" data-index="${index}">&minus;</button>
            <span class="pos-cart-item__qty">${item.quantity}</span>
            <button class="pos-cart-item__btn pos-cart-item__btn--add" data-index="${index}">+</button>
            <button class="pos-cart-item__delete" data-index="${index}" title="Eliminar" aria-label="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>
      `;
      })
      .join('');

    container.querySelectorAll('.pos-cart-item__btn--remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this.removeFromCart(idx);
      });
    });

    container.querySelectorAll('.pos-cart-item__btn--add').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        if (this.cart[idx].quantity >= this.cart[idx].stock) {
          Toast.error('Sin stock', `${this.cart[idx].name} solo tiene ${this.cart[idx].stock} unidades`);
          return;
        }
        this.cart[idx].quantity += 1;
        this.renderCart();
      });
    });

    container.querySelectorAll('.pos-cart-item__delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this.cart.splice(idx, 1);
        this.renderCart();
      });
    });

    container.querySelectorAll('.pos-cart-item__qty-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.index);
        let val = parseInt(inp.value) || 1;
        if (val < 1) {
          val = 1;
        }
        if (val > (this.cart[idx].stock || 999)) {
          Toast.error('Sin stock', `${this.cart[idx].name} solo tiene ${this.cart[idx].stock} unidades`);
          val = this.cart[idx].stock;
        }
        this.cart[idx].quantity = val;
        this.renderCart();
      });
      inp.addEventListener('focus', () => inp.select());
    });

    container.querySelectorAll('.pos-cart-item__price-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.index);
        const val = parseFloat(inp.value);
        if (isNaN(val) || val < 0) {
          inp.value = this.cart[idx].price;
          return;
        }
        this.cart[idx].price = val;
        this.renderCart();
      });
      inp.addEventListener('focus', () => inp.select());
    });

    this.updateTotal();
    this._updateCartCount();
  }

  _updateCartCount() {
    const el = document.getElementById('cart-count');
    if (!el) {
      return;
    }
    const total = this.cart.reduce((s, i) => s + i.quantity, 0);
    el.textContent = total > 0 ? total : '';
  }

  removeFromCart(index) {
    if (this.cart[index].quantity > 1) {
      this.cart[index].quantity -= 1;
    } else {
      this.cart.splice(index, 1);
    }
    this.renderCart();
  }

  renderCustomerSelect() {
    const container = document.getElementById('pos-customer-select');
    if (!container) {
      return;
    }

    const defaultCustomer = this.customers.find(c => c.id === 'cust_final');
    const otherCustomers = this.customers.filter(c => c.id !== 'cust_final');

    let options = '';
    if (defaultCustomer) {
      options = `<option value="${defaultCustomer.id}">Consumidor Final</option>`;
    } else {
      options = '<option value="">Consumidor Final</option>';
    }

    options += otherCustomers
      .map(c => {
        const saldo = c.balance || 0;
        return `<option value="${escapeHtml(c.id)}" data-balance="${saldo}">${escapeHtml(c.name)} (Saldo: ${format(saldo)})</option>`;
      })
      .join('');

    container.innerHTML = options;

    if (defaultCustomer) {
      this.currentCustomer = defaultCustomer;
    }

    this._setupCustomerSelectEvents();
  }

  _setupCustomerSelectEvents() {
    if (this._customerSelectAttached) {
      return;
    }
    this._customerSelectAttached = true;
    const container = document.getElementById('pos-customer-select');
    if (!container) {
      return;
    }

    container.addEventListener('change', e => {
      const customerId = e.target.value;
      this.currentCustomer = customerId ? this.customers.find(c => c.id === customerId) : null;
      this.updateCustomerInfo();
    });
  }

  updateCustomerInfo() {
    const infoContainer = document.getElementById('customer-info');
    if (!infoContainer) {
      return;
    }

    if (this.currentCustomer) {
      const balance = this.currentCustomer.balance || 0;
      const isDebt = balance > 0;
      const creditLimitEnabled = this.settings.creditLimitEnabled !== 'false';
      const creditLimit = parseFloat(this.settings.creditLimit) || 0;
      const isOverLimit = creditLimitEnabled && creditLimit > 0 && balance >= creditLimit;
      const color = isDebt ? 'var(--color-danger)' : 'var(--color-success)';
      const label = isDebt ? 'Deuda' : 'Saldo a favor';
      const warningBadge = isOverLimit ? ' <span class="badge badge-warning">⚠️ Límite alcanzado</span>' : '';

      infoContainer.innerHTML = `${label}: <strong style="color:${color};">${format(balance)}</strong>${warningBadge}`;

      if (isOverLimit && this._lastWarnedCustomer !== this.currentCustomer.id) {
        this._lastWarnedCustomer = this.currentCustomer.id;
        Toast.warning(
          'Límite de crédito',
          `${this.currentCustomer.name} superó el límite de crédito (${format(creditLimit)})`
        );
      }
    } else {
      infoContainer.innerHTML = '';
      this._lastWarnedCustomer = null;
    }
  }

  updateTotal() {
    const { subtotal, discountAmount, taxRate, taxAmount, total } = this._getTotal();

    const subtotalEl = document.getElementById('cart-subtotal');
    const discountEl = document.getElementById('cart-discount');
    const totalEl = document.getElementById('cart-total');
    const taxRow = document.getElementById('pos-tax-row');
    const taxRateEl = document.getElementById('cart-tax-rate');
    const taxEl = document.getElementById('cart-tax');

    if (subtotalEl) {
      subtotalEl.textContent = format(subtotal);
    }
    if (discountEl) {
      discountEl.textContent = '-' + format(discountAmount);
    }
    if (totalEl) {
      totalEl.textContent = format(total);
    }

    if (taxRow && taxEl && taxRateEl) {
      if (taxRate > 0) {
        taxRow.style.display = '';
        taxRateEl.textContent = taxRate;
        taxEl.textContent = format(taxAmount);
      } else {
        taxRow.style.display = 'none';
      }
    }

    if (this.payments.length === 1) {
      this.payments[0].amount = total;
    }

    this._updatePaymentSummary();
  }

  setDiscount(type, value) {
    this.discountType = type;
    this.discount = parseFloat(value) || 0;
    this.updateTotal();
  }

  _getTotal() {
    const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = this.discountType === 'percent' ? subtotal * (this.discount / 100) : this.discount;
    const taxEnabled = this.settings.taxEnabled === 'true';
    const taxRate = taxEnabled ? parseFloat(this.settings.taxRate) || 0 : 0;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * (taxRate / 100);
    const total = taxableAmount + taxAmount;
    return { subtotal, discountAmount, taxRate, taxAmount, total };
  }

  _renderPaymentUI() {
    const container = document.querySelector('.pos-cart-footer');
    if (!container) {
      return;
    }

    const existing = document.getElementById('pos-multi-payment');
    if (existing) {
      existing.remove();
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'pos-multi-payment';

    const { total } = this._getTotal();

    if (this.payments.length === 1) {
      this.payments[0].amount = total;
    }

    const paid = this.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const remaining = Math.max(0, total - paid);

    wrapper.innerHTML = `
      <div id="payment-status-bar">
        <div class="payment-status">
          <span class="payment-status__label">Total a cobrar:</span>
          <span class="payment-status__value" id="payment-total-display">${format(total)}</span>
        </div>
        <div class="payment-status">
          <span class="payment-status__label">Ingresado:</span>
          <span class="payment-status__value" id="payment-paid-display">${format(paid)}</span>
        </div>
        <div class="payment-status">
          <span class="payment-status__label">Restante:</span>
          <span class="payment-status__remaining ${remaining <= 0.01 ? 'paid' : ''}" id="payment-remaining-display">${format(remaining)}</span>
        </div>
        ${remaining > 0.01 ? `<div class="payment-progress"><div class="payment-progress__bar" style="width:${total > 0 ? Math.min(100, (paid / total) * 100) : 0}%;background:var(--color-primary);"></div></div>` : ''}
        <div class="payment-divider"></div>
      </div>
      <div id="payment-rows">
        ${this._renderPaymentRows()}
      </div>
      <div class="payment-btn-group">
        <button class="btn btn-ghost btn-sm payment-add-btn" id="add-payment-btn">
          <i class="fa-solid fa-plus"></i> Agregar método
        </button>
        <button class="btn btn-ghost btn-sm" id="quick-cash-btn" title="Efectivo exacto">
          <i class="fa-solid fa-money-bill-wave"></i>
        </button>
        <button class="btn btn-ghost btn-sm" id="reset-payments-btn">
          <i class="fa-solid fa-rotate-left"></i>
        </button>
      </div>
    `;

    const confirmBtn = document.getElementById('confirm-sale-btn');
    container.insertBefore(wrapper, confirmBtn);

    document.getElementById('add-payment-btn')?.addEventListener('click', () => {
      this.payments.push({ method: 'cash', amount: 0 });
      this._updatePaymentUI();
    });

    document.getElementById('reset-payments-btn')?.addEventListener('click', () => {
      this.payments = [{ method: 'cash', amount: 0 }];
      this._updatePaymentUI();
    });

    document.getElementById('quick-cash-btn')?.addEventListener('click', () => {
      const { total } = this._getTotal();
      this.payments = [{ method: 'cash', amount: total, _received: total }];
      this._updatePaymentUI();
      const receivedInput = document.querySelector('.payment-row__received');
      if (receivedInput) {
        receivedInput.value = total;
        receivedInput.focus();
        receivedInput.select();
      }
    });

    this._attachPaymentRowEvents();
    this._updatePaymentUI();
  }

  _renderPaymentRows() {
    return this.payments
      .map((p, i) => {
        const isCash = p.method === 'cash';
        const allCash = this.payments.every(x => x.method === 'cash');
        const cashIdx = this.payments.findIndex(x => x.method === 'cash');
        const showReceived = isCash && (allCash || cashIdx === i);
        const changeVal = Math.max(0, (parseFloat(p._received) || 0) - (parseFloat(p.amount) || 0));

        return `
        <div class="payment-row" data-index="${i}">
          <select class="payment-row__method" data-index="${i}">
            ${PAYMENT_METHODS.map(m => `<option value="${m.id}" ${m.id === p.method ? 'selected' : ''}>${m.label}</option>`).join('')}
          </select>
          <div class="payment-row__amount-wrap">
            <input type="number" class="payment-row__amount" data-index="${i}" value="${p.amount || ''}" min="0" step="0.01" placeholder="0.00">
            ${
              showReceived
                ? `
              <input type="number" class="payment-row__received" data-index="${i}" value="${p._received || ''}" placeholder="Recibido" min="0" step="0.01">
              <span class="payment-row__change ${changeVal > 0 ? 'has-change' : ''}" data-index="${i}">${format(changeVal)}</span>
            `
                : ''
            }
          </div>
          ${this.payments.length > 1 ? `<button class="payment-row__remove" data-index="${i}" aria-label="Eliminar método de pago"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </div>
      `;
      })
      .join('');
  }

  _attachPaymentRowEvents() {
    document.querySelectorAll('.payment-row__method').forEach(sel => {
      sel.addEventListener('change', e => {
        const idx = parseInt(e.target.dataset.index);
        this.payments[idx].method = e.target.value;
        this._updatePaymentUI();
      });
    });

    document.querySelectorAll('.payment-row__amount').forEach(inp => {
      inp.addEventListener('input', e => {
        const idx = parseInt(e.target.dataset.index);
        this.payments[idx].amount = parseFloat(e.target.value) || 0;
        this._updatePaymentSummary();
        this._updateChange(idx);
      });
      inp.addEventListener('focus', e => e.target.select());
    });

    document.querySelectorAll('.payment-row__received').forEach(inp => {
      inp.addEventListener('input', e => {
        const idx = parseInt(e.target.dataset.index);
        this.payments[idx]._received = parseFloat(e.target.value) || 0;
        this._updateChange(idx);
        this._updatePaymentSummary();
      });
      inp.addEventListener('focus', e => e.target.select());
    });

    document.querySelectorAll('.payment-row__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        this.payments.splice(idx, 1);
        this._updatePaymentUI();
      });
    });
  }

  _updatePaymentSummary() {
    const { total } = this._getTotal();
    const paid = this.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const remaining = Math.max(0, total - paid);

    const totalEl = document.getElementById('payment-total-display');
    const paidEl = document.getElementById('payment-paid-display');
    const remainEl = document.getElementById('payment-remaining-display');

    if (totalEl) {
      totalEl.textContent = format(total);
    }
    if (paidEl) {
      paidEl.textContent = format(paid);
    }
    if (remainEl) {
      remainEl.textContent = format(remaining);
      remainEl.className = 'payment-status__remaining' + (remaining <= 0.01 ? ' paid' : '');
    }

    const progressBar = document.querySelector('#payment-status-bar .payment-progress');
    if (progressBar && total > 0) {
      const pct = Math.min(100, (paid / total) * 100);
      const bar = progressBar.querySelector('.payment-progress__bar');
      if (bar) {
        bar.style.width = pct + '%';
      }
    }

    const confirmBtn = document.getElementById('confirm-sale-btn');
    if (confirmBtn) {
      const diff = Math.abs(paid - total);
      if (diff <= 0.01 && total > 0) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Venta';
      } else {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `Falta ${format(remaining)}`;
      }
    }
  }

  _updatePaymentUI() {
    const wrapper = document.getElementById('pos-multi-payment');
    if (!wrapper) {
      return;
    }

    const { total } = this._getTotal();
    const paid = this.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const remaining = Math.max(0, total - paid);

    const totalEl = document.getElementById('payment-total-display');
    const paidEl = document.getElementById('payment-paid-display');
    const remainEl = document.getElementById('payment-remaining-display');

    if (totalEl) {
      totalEl.textContent = format(total);
    }
    if (paidEl) {
      paidEl.textContent = format(paid);
    }
    if (remainEl) {
      remainEl.textContent = format(remaining);
      remainEl.className = 'payment-status__remaining' + (remaining <= 0.01 ? ' paid' : '');
    }

    const rows = document.getElementById('payment-rows');
    if (rows) {
      rows.innerHTML = this._renderPaymentRows();
      this._attachPaymentRowEvents();
    }

    const confirmBtn = document.getElementById('confirm-sale-btn');
    if (confirmBtn) {
      const diff = Math.abs(paid - total);
      if (diff <= 0.01 && total > 0) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Venta';
      } else {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `Falta ${format(remaining)}`;
      }
    }
  }

  _updateChange(idx) {
    const receivedEl = document.querySelector(`.payment-row__received[data-index="${idx}"]`);
    const changeEl = document.querySelector(`.payment-row__change[data-index="${idx}"]`);
    if (!receivedEl || !changeEl) {
      return;
    }
    const amount = parseFloat(this.payments[idx]?.amount) || 0;
    const received = parseFloat(receivedEl.value) || 0;
    const change = Math.max(0, received - amount);
    changeEl.textContent = format(change);
    changeEl.className = 'payment-row__change' + (change > 0 ? ' has-change' : '');
  }

  _validateSale() {
    if (this._isProcessing) {
      return 'already_processing';
    }
    if (this.cart.length === 0) {
      return 'empty_cart';
    }
    if (!cashService.currentSession) {
      return 'no_session';
    }

    const { total } = this._getTotal();
    const validation = validatePayments(this.payments, total);
    if (!validation.valid) {
      return validation.error;
    }

    const accountPayment = this.payments.find(p => p.method === 'account');
    if (accountPayment && accountPayment.amount > 0) {
      if (!this.currentCustomer || this.currentCustomer.id === 'cust_final' || this.currentCustomer.isDefault) {
        return 'account_no_customer';
      }
      const creditLimitEnabled = this.settings.creditLimitEnabled !== 'false';
      if (creditLimitEnabled) {
        const creditLimit = parseFloat(this.settings.creditLimit) || 0;
        const currentBalance = parseFloat(this.currentCustomer.balance) || 0;
        if (creditLimit > 0 && currentBalance + accountPayment.amount > creditLimit) {
          return 'account_insufficient';
        }
      }
    }

    for (const item of this.cart) {
      const product = this.products.find(p => p.id === item.id);
      if (product && product.stock < item.quantity) {
        return `stock:${item.name}:${product.stock}`;
      }
    }

    return null;
  }

  _buildSaleObject(saleId, totals) {
    const { subtotal, discountAmount, taxAmount, total } = totals;
    const primaryMethod = this.payments[0]?.method || 'cash';
    const cashPayment = this.payments.find(p => p.method === 'cash');
    const cashReceived = cashPayment ? parseFloat(cashPayment._received) || cashPayment.amount : 0;
    const change = cashPayment ? Math.max(0, cashReceived - cashPayment.amount) : 0;

    return {
      id: saleId,
      date: new Date().toISOString(),
      sessionId: cashService.currentSession?.id,
      customerId: this.currentCustomer ? this.currentCustomer.id : 'cust_final',
      items: this.cart.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
      })),
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      total,
      paymentMethod: primaryMethod,
      paymentType: this.payments.length > 1 ? 'COMBINADO' : 'SIMPLE',
      payments: this.payments.map(p => ({
        method: p.method,
        amount: parseFloat(p.amount) || 0
      })),
      cashReceived: cashPayment ? cashReceived : null,
      change: cashPayment ? change : null,
      userId: state.get('currentUser')?.id
    };
  }

  async confirmSale() {
    const error = this._validateSale();
    if (error) {
      const messages = {
        already_processing: null,
        empty_cart: 'El carrito está vacío',
        no_session: 'No hay una sesión de caja abierta',
        account_no_customer: 'Seleccioná un cliente para usar cuenta corriente',
        account_insufficient: 'El cliente excede el límite de crédito configurado'
      };
      if (error.startsWith('stock:')) {
        const [, name, stock] = error.split(':');
        Toast.error('Sin stock', `${name} solo tiene ${stock} unidades`);
      } else if (messages[error] !== undefined && messages[error] !== null) {
        Toast.error('Error', messages[error]);
      }
      return;
    }

    this._isProcessing = true;
    const confirmBtn = document.getElementById('confirm-sale-btn');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
    }

    const saleId = await generateSaleId();
    const sale = this._buildSaleObject(saleId, this._getTotal());

    try {
      await saleRepo.create(sale);

      const stockUpdates = [];
      let previousBalance = null;
      let previousBalanceCustomer = null;
      try {
        for (const [index, item] of sale.items.entries()) {
          await saleItemRepo.create({
            id: `SI-${sale.id}-${String(index + 1).padStart(3, '0')}`,
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal
          });

          const product = this.products.find(p => p.id === item.productId);
          if (product && !product.variablePrice) {
            product.stock -= item.quantity;
            stockUpdates.push(product);
            await productRepo.update(product);
          }
        }

        const accountPayment = this.payments.find(p => p.method === 'account');
        if (
          accountPayment &&
          accountPayment.amount > 0 &&
          this.currentCustomer &&
          this.currentCustomer.id !== 'cust_final' &&
          !this.currentCustomer.isDefault
        ) {
          previousBalance = this.currentCustomer.balance;
          previousBalanceCustomer = this.currentCustomer;
          // La venta completa se imputa a la cuenta corriente del cliente.
          // Lo cobrado en el momento por otros medios se descuenta como abono inmediato.
          const nonAccount = this.payments
            .filter(p => p.method !== 'account')
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
          const debtToAdd = Math.max(0, sale.total - nonAccount);
          this.currentCustomer.balance = (this.currentCustomer.balance || 0) + debtToAdd;
          await customerRepo.update(this.currentCustomer);
        }

        await cashService.recordSale(sale);
      } catch (innerError) {
        for (const product of stockUpdates) {
          const original = sale.items.find(i => i.productId === product.id);
          if (original) {
            product.stock += original.quantity;
            await productRepo.update(product).catch(() => {});
          }
        }
        if (previousBalanceCustomer && previousBalance !== null) {
          previousBalanceCustomer.balance = previousBalance;
          await customerRepo.update(previousBalanceCustomer).catch(() => {});
        }
        await saleRepo.delete(sale.id).catch(() => {});
        throw innerError;
      }
      state.set('sale:created', { ...sale });
      state.emit('data:sales-changed');

      Toast.success('Éxito', `Venta ${sale.id} confirmada`);
      this.showTicket(sale);
      this.cart = [];
      this.currentCustomer = null;
      this.discount = 0;
      this.payments = [{ method: 'cash', amount: 0 }];
      this.renderCart();
      this.renderCustomerSelect();
    } catch (error) {
      logger.error('POS', 'Error saving sale', error);
      Toast.error('Error', 'No se pudo guardar la venta');
    } finally {
      this._isProcessing = false;
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Venta';
      }
    }
  }

  showTicket(sale) {
    const settings = state.get('settings');
    const body = renderTicketBody(sale, settings);
    showTicketModal('Ticket de Venta', body);
  }

  _injectCashButton() {
    const header = document.querySelector('.pos-cart-header');
    if (!header) {
      return;
    }
    const existing = document.getElementById('pos-cash-btn');
    if (existing) {
      existing.style.display = '';
      if (!existing._cashHandlerAttached) {
        existing._cashHandlerAttached = true;
        existing.addEventListener('click', () => cash.showQuickCashModal());
      }
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'pos-cash-btn';
    btn.className = 'pos-cash-btn';
    btn.innerHTML = '<i class="fa-solid fa-cash-register"></i>';
    btn.title = 'Gestión de Caja';
    btn.setAttribute('aria-label', 'Gestión de Caja');
    btn._cashHandlerAttached = true;
    header.appendChild(btn);
    btn.addEventListener('click', () => cash.showQuickCashModal());
  }
}

export default new POS();
