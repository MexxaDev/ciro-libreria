'use strict';

import ShopCart from './shopCart.js';
import ShopWhatsApp from './shopWhatsApp.js';
import ShopUI from './shopUI.js';
import { escapeHtml } from '../../utils/sanitizer.js';

class ShopCheckout {
  constructor() {
    this.orderType = 'takeaway';
    this.settings = {};
  }

  setSettings(settings) {
    this.settings = settings || {};
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

  showCheckout() {
    const modal = document.getElementById('shop-modal');
    const modalBody = document.getElementById('shop-modal-body');

    modalBody.innerHTML = ShopUI.renderCheckoutModal();
    modal.classList.add('active');

    this.setupCheckoutEvents();
  }

  setupCheckoutEvents() {
    const form = document.getElementById('shop-checkout-form');
    const orderTypeBtns = document.querySelectorAll('.shop-order-type-btn');
    const deliveryFields = document.getElementById('shop-delivery-fields');
    const backBtn = document.getElementById('shop-back-cart');
    const closeBtn = document.getElementById('shop-close-modal');

    orderTypeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        orderTypeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.orderType = btn.dataset.type;

        if (this.orderType === 'delivery') {
          deliveryFields.style.display = 'block';
          document.getElementById('shop-address').required = true;
        } else {
          deliveryFields.style.display = 'none';
          document.getElementById('shop-address').required = false;
        }
      });
    });

    backBtn?.addEventListener('click', () => {
      this.showCart();
    });

    closeBtn?.addEventListener('click', () => {
      this.closeModal();
    });

    form?.addEventListener('submit', e => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  async handleSubmit() {
    const firstName = document.getElementById('shop-firstname').value.trim();
    const lastName = document.getElementById('shop-lastname').value.trim();
    const phone = document.getElementById('shop-phone').value.trim();
    const generalNote = document.getElementById('shop-general-note').value.trim();

    if (!firstName || !lastName || !phone) {
      this.showError('Por favor completá todos los campos obligatorios');
      return;
    }

    const checkoutData = {
      firstName,
      lastName,
      phone,
      orderType: this.orderType,
      generalNote
    };

    if (this.orderType === 'delivery') {
      const address = document.getElementById('shop-address').value.trim();
      const neighborhood = document.getElementById('shop-neighborhood').value.trim();
      const addressRef = document.getElementById('shop-address-ref').value.trim();

      if (!address) {
        this.showError('Por favor ingresá la dirección de entrega');
        return;
      }

      checkoutData.address = address;
      checkoutData.neighborhood = neighborhood;
      checkoutData.addressRef = addressRef;
    }

    try {
      const items = ShopCart.getItems();
      await ShopWhatsApp.sendOrder(checkoutData, items);
      ShopCart.clear();
      this.closeModal();
      this.showSuccess();
    } catch (error) {
      this.showError(error.message || 'Error al enviar el pedido');
    }
  }

  showCart() {
    const modalBody = document.getElementById('shop-modal-body');
    modalBody.innerHTML = ShopUI.renderCartModal();
    this.setupCartEvents();
  }

  showSuccess() {
    const modalBody = document.getElementById('shop-modal-body');
    modalBody.innerHTML = `
      <div class="shop-success-state">
        <div class="shop-success-icon">
          <i class="fa-solid fa-check"></i>
        </div>
        <h2>¡Pedido Enviado!</h2>
        <p>Tu pedido fue enviado por WhatsApp. Te contactaremos pronto.</p>
        <button class="shop-btn-primary" id="shop-continue-shopping">
          Seguir Comprando
        </button>
      </div>
    `;

    document.getElementById('shop-continue-shopping')?.addEventListener('click', () => {
      this.closeModal();
      window.location.hash = 'shop';
    });
  }

  showError(message) {
    const existing = document.querySelector('.shop-error-toast');
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'shop-error-toast';
    toast.innerHTML = `
      <i class="fa-solid fa-exclamation-circle"></i>
      <span>${escapeHtml(message)}</span>
    `;

    document.getElementById('shop-modal-body').appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  closeModal() {
    const modal = document.getElementById('shop-modal');
    modal.classList.remove('active');
  }

  setupCartEvents() {
    const cartItems = ShopCart.getItems();

    document.querySelectorAll('.shop-qty-btn.plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const productId = btn.dataset.productId;
        const item = cartItems.find(i => i.id === productId);
        if (item) {
          if (item.stock !== undefined && item.quantity >= item.stock) {
            this.showToast('Stock máximo alcanzado', 'error');
            return;
          }
          ShopCart.updateQuantity(productId, item.quantity + 1);
          this.refreshCart();
        }
      });
    });

    document.querySelectorAll('.shop-qty-btn.minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const productId = btn.dataset.productId;
        const item = cartItems.find(i => i.id === productId);
        if (item) {
          if (item.quantity <= 1) {
            ShopCart.removeItem(productId);
          } else {
            ShopCart.updateQuantity(productId, item.quantity - 1);
          }
          this.refreshCart();
        }
      });
    });

    document.querySelectorAll('.shop-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const productId = btn.dataset.productId;
        ShopCart.removeItem(productId);
        this.refreshCart();
      });
    });

    document.querySelectorAll('.shop-note-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const productId = btn.dataset.productId;
        const item = cartItems.find(i => i.id === productId);
        if (item) {
          this.showNoteModal(productId, item.note || '');
        }
      });
    });

    document.getElementById('shop-close-modal')?.addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('shop-go-checkout')?.addEventListener('click', () => {
      const isOpen = ShopUI.checkIfOpen(this.settings);
      if (!isOpen) {
        this.showToast('El negocio está cerrado. No se pueden realizar pedidos.', 'error');
        return;
      }
      this.showCheckout();
    });
  }

  showNoteModal(productId, currentNote) {
    const modalBody = document.getElementById('shop-modal-body');
    modalBody.innerHTML = `
      <div class="shop-modal-content">
        <div class="shop-modal-header">
          <h2>Nota del Producto</h2>
          <button class="shop-modal-close" id="shop-close-note-modal">&times;</button>
        </div>
        <div style="padding: var(--space-4) var(--space-6);">
          <textarea class="shop-form-textarea" id="shop-product-note"
                    placeholder="Ej: sin cebolla, término medio..."
                    style="min-height: 100px;">${escapeHtml(currentNote)}</textarea>
          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-4);">
            <button class="shop-btn-back" id="shop-cancel-note" style="flex:1;">Cancelar</button>
            <button class="shop-btn-confirm" id="shop-save-note" style="flex:1;">Guardar</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('shop-close-note-modal')?.addEventListener('click', () => {
      this.showCart();
    });

    document.getElementById('shop-cancel-note')?.addEventListener('click', () => {
      this.showCart();
    });

    document.getElementById('shop-save-note')?.addEventListener('click', () => {
      const note = document.getElementById('shop-product-note').value.trim();
      ShopCart.updateNote(productId, note);
      this.showCart();
    });
  }

  refreshCart() {
    const modalBody = document.getElementById('shop-modal-body');
    modalBody.innerHTML = ShopUI.renderCartModal();
    this.setupCartEvents();

    const cartBtn = document.getElementById('shop-cart-button');
    if (cartBtn) {
      cartBtn.outerHTML = ShopUI.renderCartButton();
      this.setupCartButton();
    }
  }

  setupCartButton() {
    const cartBtn = document.getElementById('shop-cart-button');
    const modal = document.getElementById('shop-modal');
    const modalBody = document.getElementById('shop-modal-body');

    cartBtn?.addEventListener('click', () => {
      if (ShopCart.isEmpty()) {
        return;
      }

      modalBody.innerHTML = ShopUI.renderCartModal();
      modal.classList.add('active');
      this.setupCartEvents();
    });
  }
}

export default new ShopCheckout();
