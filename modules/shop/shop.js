'use strict';

import { productRepo, categoryRepo, settingRepo } from '../../db/repositories.js';
import ShopCart from './shopCart.js';
import ShopUI from './shopUI.js';
import ShopCheckout from './shopCheckout.js';
import { logger } from '../../utils/logger.js';
import { escapeHtml } from '../../utils/sanitizer.js';
import state from '../../js/state.js';
import { BRAND } from '../../config/brandConfig.js';

class Shop {
  constructor() {
    this.products = [];
    this.categories = [];
    this.settings = {};
    this.currentCategory = null;
    this.searchQuery = '';
  }

  async load() {
    const container = document.getElementById('shop-content');
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="shop-loading">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Cargando catálogo...</p>
      </div>
    `;

    try {
      const [products, categories, settings] = await Promise.all([
        productRepo.findAll(),
        categoryRepo.findAll(),
        settingRepo.findAll()
      ]);

      this.settings = {};
      settings.forEach(s => {
        this.settings[s.key] = s.value;
      });

      if (this.settings.shop_enabled !== 'true') {
        container.innerHTML = `
          <div class="shop-error">
            <i class="fa-solid fa-shop-slash"></i>
            <p>El catálogo online no está disponible</p>
          </div>
        `;
        return;
      }

      this.products = products.filter(p => p.visible_web === true && p.visible !== false);
      this.categories = categories;

      this.updateSEO();
      this.render();

      const isOpen = ShopUI.checkIfOpen(this.settings);
      if (!isOpen) {
        this.showClosedBanner();
      }

      this.setupSearch();
      this.setupCartButton();

      // Pass settings to checkout
      ShopCheckout.setSettings(this.settings);
      this._setupDataListeners();
    } catch (error) {
      logger.error('Shop', 'Error loading shop:', error);
      container.innerHTML = `
        <div class="shop-error">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>Error al cargar el catálogo</p>
        </div>
      `;
    }
  }

  _setupDataListeners() {
    if (this._listenersAttached) {
      return;
    }
    this._listenersAttached = true;

    state.on('data:products-changed', () => {
      this.load();
    });

    state.on('data:categories-changed', () => {
      this.load();
    });

    state.on('data:settings-changed', newSettings => {
      this.settings = newSettings || {};
      ShopCheckout.setSettings(this.settings);
      if (this.settings.shop_enabled !== 'true') {
        const container = document.getElementById('shop-content');
        if (container) {
          container.innerHTML = `
            <div class="shop-error">
              <i class="fa-solid fa-shop-slash"></i>
              <p>El catálogo online no está disponible</p>
            </div>
          `;
        }
      } else {
        this.load();
      }
    });
  }

  setupSearch() {
    const searchInput = document.getElementById('shop-search');
    if (!searchInput) {
      return;
    }

    let timeout;
    searchInput.addEventListener('input', e => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.searchQuery = e.target.value;
        this.updateProducts();
      }, 300);
    });
  }

  updateSEO() {
    const businessName = this.settings.businessName || BRAND.name;

    document.title = `${businessName} - Shop`;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = `Hacé tu pedido online en ${businessName}`;

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.content = `${businessName} - Shop`;

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement('meta');
      ogDesc.setAttribute('property', 'og:description');
      document.head.appendChild(ogDesc);
    }
    ogDesc.content = `Catálogo online de ${businessName}`;

    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.content = window.location.href;
  }

  render() {
    const container = document.getElementById('shop-content');
    if (!container) {
      return;
    }

    const businessName = this.settings.businessName || BRAND.name;

    container.innerHTML = `
      ${ShopUI.renderHomeHeader(businessName, this.settings)}

      <div class="shop-search-container">
        <div class="shop-search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="shop-search" class="shop-search-input"
                 placeholder="Buscar productos..." value="${escapeHtml(this.searchQuery)}">
        </div>
      </div>

      <div class="shop-categories" id="shop-categories">
        <button class="shop-category-pill ${!this.currentCategory ? 'active' : ''}"
                data-category-id="all">
          Todos
        </button>
        ${this.categories.map(cat => ShopUI.renderCategoryPill(cat, this.currentCategory === cat.id)).join('')}
      </div>

        <div class="shop-products-grid" id="shop-products">
          ${this.getFilteredProducts()
            .map(p => ShopUI.renderProductCard(p, this.categories))
            .join('')}
        </div>

      ${
        this.products.length === 0
          ? `
        <div class="shop-empty">
          <i class="fa-solid fa-box-open"></i>
          <p>No hay productos disponibles</p>
        </div>
      `
          : ''
      }
    `;

    this.setupEvents();
    // Cart button is now set up in load() to avoid duplication
  }

  getFilteredProducts() {
    let products = this.products;

    if (this.currentCategory && this.currentCategory !== 'all') {
      products = products.filter(p => p.categoryId === this.currentCategory);
    }

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      products = products.filter(
        p => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query))
      );
    }

    return products;
  }

  setupEvents() {
    document.querySelectorAll('.shop-category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const categoryId = pill.dataset.categoryId;
        this.currentCategory = categoryId === 'all' ? null : categoryId;

        document.querySelectorAll('.shop-category-pill').forEach(p => {
          p.classList.remove('active');
        });
        pill.classList.add('active');

        this.updateProducts();
      });
    });

    this.setupProductDelegation();
  }

  setupProductDelegation() {
    const productsGrid = document.getElementById('shop-products');
    if (!productsGrid) {
      return;
    }

    // Remove existing listener to avoid duplicates
    if (this._productClickHandler) {
      productsGrid.removeEventListener('click', this._productClickHandler);
    }

    // Event delegation for add buttons
    this._productClickHandler = e => {
      const addBtn = e.target.closest('.shop-btn-add');
      if (!addBtn || addBtn.disabled) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const productId = addBtn.dataset.productId;
      const product = this.products.find(p => p.id === productId);

      if (product) {
        if (product.stock !== undefined && product.stock <= 0) {
          this.showToast('Producto agotado', 'error');
          return;
        }

        const currentItem = ShopCart.getItems().find(i => i.id === productId);
        if (product.stock !== undefined && currentItem && currentItem.quantity >= product.stock) {
          this.showToast('Stock máximo alcanzado', 'error');
          return;
        }

        ShopCart.addItem(product);
        this.updateCartButton();
        this.showToast('Producto agregado', 'success');
        this.animateAddButton(addBtn);
      }
    };

    productsGrid.addEventListener('click', this._productClickHandler);
  }

  setupCartButton() {
    const existingBtn = document.getElementById('shop-cart-button');
    if (existingBtn) {
      existingBtn.outerHTML = ShopUI.renderCartButton();
    } else {
      const cartContainer = document.createElement('div');
      cartContainer.id = 'shop-cart-button';
      cartContainer.innerHTML = ShopUI.renderCartButton();
      document.body.appendChild(cartContainer);
    }

    ShopCheckout.setupCartButton();
  }

  updateCartButton() {
    const btn = document.getElementById('shop-cart-button');
    if (btn) {
      btn.outerHTML = ShopUI.renderCartButton();
      ShopCheckout.setupCartButton();
    }
  }

  updateProducts() {
    const container = document.getElementById('shop-products');
    if (!container) {
      return;
    }

    const products = this.getFilteredProducts();

    if (products.length === 0) {
      container.innerHTML = `
        <div class="shop-no-results">
          <i class="fa-solid fa-search"></i>
          <p>No se encontraron productos</p>
        </div>
      `;
      return;
    }

    container.innerHTML = products.map(p => ShopUI.renderProductCard(p, this.categories)).join('');

    // Re-setup delegation after re-render
    this.setupProductDelegation();
  }

  animateAddButton(btn) {
    if (!btn) {
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    btn.classList.add('adding');
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-plus"></i>';
      btn.classList.remove('adding');
    }, 500);
  }

  showToast(message, type = 'info') {
    const existing = document.querySelector('.shop-toast');
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement('div');
    toast.className = `shop-toast shop-toast-${type}`;
    toast.innerHTML = `
      <i class="fa-solid fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
      <span>${escapeHtml(message)}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  showClosedBanner() {
    const container = document.querySelector('.shop-container');
    if (!container) {
      return;
    }

    const banner = document.createElement('div');
    banner.className = 'shop-closed-banner';
    banner.innerHTML = `
      <i class="fa-solid fa-clock"></i>
      <span>Estamos cerrados. Podés ver el catálogo pero no realizar pedidos.</span>
    `;

    container.insertBefore(banner, container.firstChild);

    const cartButton = document.getElementById('shop-cart-button');
    if (cartButton) {
      cartButton.style.opacity = '0.5';
      cartButton.style.pointerEvents = 'none';
    }
  }
}

export default new Shop();
