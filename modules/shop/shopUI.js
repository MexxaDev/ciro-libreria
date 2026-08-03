'use strict';

import ShopCart from './shopCart.js';
import { getProductImage } from '../../utils/imageHelper.js';
import { escapeHtml } from '../../utils/sanitizer.js';

class ShopUI {
  static renderProductCard(product, categories = []) {
    const price = product.price_web || product.price;
    const isOutOfStock = product.stock !== undefined && product.stock <= 0;
    const hasPromo = product.promo || false;
    const imageSrc = getProductImage(product, categories);
    const placeholder = getProductImage({ name: 'Product', image: '' }, []);

    return `
      <div class="shop-product-card ${isOutOfStock ? 'out-of-stock' : ''}" data-product-id="${product.id}">
        ${hasPromo ? '<span class="shop-badge-promo">Promo</span>' : ''}
        ${isOutOfStock ? '<div class="shop-out-of-stock-overlay"><span>Agotado</span></div>' : ''}
        <div class="shop-product-image">
          <img src="${imageSrc}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='${placeholder}';">
        </div>
        <div class="shop-product-info">
          <h3 class="shop-product-name">${escapeHtml(product.name)}</h3>
          ${product.description ? `<p class="shop-product-desc">${escapeHtml(product.description)}</p>` : ''}
          <div class="shop-product-footer">
            <span class="shop-product-price">$${price.toLocaleString()}</span>
            ${
              !isOutOfStock
                ? `<button class="shop-btn-add" data-product-id="${product.id}">
                  <i class="fa-solid fa-plus"></i>
                </button>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  static renderCategoryPill(category, isActive = false) {
    const color = category.color || '#0EA5E9';
    return `
      <button class="shop-category-pill ${isActive ? 'active' : ''}"
              data-category-id="${category.id}"
              style="${isActive ? `background:${color};color:white;` : ''}">
        ${escapeHtml(category.name)}
      </button>
    `;
  }

  static renderCartButton() {
    const count = ShopCart.getItemCount();
    const subtotal = ShopCart.getSubtotal();

    return `
      <div class="shop-cart-button ${count > 0 ? 'has-items' : ''}" id="shop-cart-button">
        <div class="shop-cart-icon">
          <i class="fa-solid fa-shopping-bag"></i>
          ${count > 0 ? `<span class="shop-cart-count">${count}</span>` : ''}
        </div>
        <div class="shop-cart-info">
          ${
            count > 0
              ? `<span class="shop-cart-total">$${subtotal.toLocaleString()}</span>`
              : '<span class="shop-cart-empty">Carrito vacío</span>'
          }
        </div>
        <i class="fa-solid fa-chevron-up shop-cart-arrow"></i>
      </div>
    `;
  }

  static renderCartModal() {
    const items = ShopCart.getItems();
    const subtotal = ShopCart.getSubtotal();

    if (items.length === 0) {
      return `
        <div class="shop-modal-content">
          <div class="shop-modal-header">
            <h2>Tu Carrito</h2>
            <button class="shop-modal-close" id="shop-close-modal">&times;</button>
          </div>
          <div class="shop-cart-empty-state">
            <i class="fa-solid fa-shopping-bag"></i>
            <p>Tu carrito está vacío</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="shop-modal-content">
        <div class="shop-modal-header">
          <h2>Tu Carrito (${ShopCart.getItemCount()} items)</h2>
          <button class="shop-modal-close" id="shop-close-modal">&times;</button>
        </div>
        <div class="shop-cart-items">
          ${items
            .map(item => {
              const imageSrc = getProductImage(item, []);
              const placeholder = getProductImage({ name: 'Product', image: '' }, []);
              return `
            <div class="shop-cart-item" data-product-id="${item.id}">
              <div class="shop-cart-item-image">
                <img src="${imageSrc}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.onerror=null;this.src='${placeholder}';">
              </div>
              <div class="shop-cart-item-info">
                <h4>${escapeHtml(item.name)}</h4>
                <span class="shop-cart-item-price">$${(item.price * item.quantity).toLocaleString()}</span>
                <button class="shop-note-btn" data-product-id="${item.id}" title="Agregar nota">
                  <i class="fa-solid fa-note-sticky"></i>
                </button>
                ${item.note ? `<p class="shop-cart-item-note">${escapeHtml(item.note)}</p>` : ''}
              </div>
              <div class="shop-cart-item-actions">
                <div class="shop-quantity-control">
                  <button class="shop-qty-btn minus" data-product-id="${item.id}">-</button>
                  <span class="shop-qty-value">${item.quantity}</span>
                  <button class="shop-qty-btn plus" data-product-id="${item.id}">+</button>
                </div>
                <button class="shop-remove-btn" data-product-id="${item.id}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          `;
            })
            .join('')}
        </div>
        <div class="shop-cart-footer">
          <div class="shop-cart-subtotal">
            <span>Subtotal:</span>
            <span class="shop-cart-total-value">$${subtotal.toLocaleString()}</span>
          </div>
          <button class="shop-btn-checkout" id="shop-go-checkout">
            Continuar Pedido
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  }

  static renderCheckoutModal() {
    return `
      <div class="shop-modal-content shop-modal-checkout">
        <div class="shop-modal-header">
          <h2>Datos del Pedido</h2>
          <button class="shop-modal-close" id="shop-close-modal">&times;</button>
        </div>
        <form id="shop-checkout-form" class="shop-checkout-form">
          <div class="shop-form-section">
            <h3>Datos Personales</h3>
            <div class="shop-form-row">
              <div class="shop-form-group">
                <label class="shop-form-label">Nombre *</label>
                <input type="text" class="shop-form-input" id="shop-firstname" required>
              </div>
              <div class="shop-form-group">
                <label class="shop-form-label">Apellido *</label>
                <input type="text" class="shop-form-input" id="shop-lastname" required>
              </div>
            </div>
            <div class="shop-form-group">
              <label class="shop-form-label">Teléfono *</label>
              <input type="tel" class="shop-form-input" id="shop-phone" required>
            </div>
          </div>

          <div class="shop-form-section">
            <h3>Tipo de Pedido</h3>
            <div class="shop-order-type-selector">
              <button type="button" class="shop-order-type-btn active" data-type="takeaway">
                <i class="fa-solid fa-shopping-bag"></i>
                <span>Take Away</span>
              </button>
              <button type="button" class="shop-order-type-btn" data-type="delivery">
                <i class="fa-solid fa-motorcycle"></i>
                <span>Delivery</span>
              </button>
            </div>

            <div id="shop-delivery-fields" style="display:none;">
              <div class="shop-form-group">
                <label class="shop-form-label">Dirección *</label>
                <input type="text" class="shop-form-input" id="shop-address" placeholder="Calle y número">
              </div>
              <div class="shop-form-row">
                <div class="shop-form-group">
                  <label class="shop-form-label">Barrio</label>
                  <input type="text" class="shop-form-input" id="shop-neighborhood">
                </div>
                <div class="shop-form-group">
                  <label class="shop-form-label">Referencia</label>
                  <input type="text" class="shop-form-input" id="shop-address-ref" placeholder="Ej: Timbre azul">
                </div>
              </div>
            </div>
          </div>

          <div class="shop-form-section">
            <h3>Nota General (Opcional)</h3>
            <textarea class="shop-form-textarea" id="shop-general-note"
                      placeholder="Ej: sin cebolla, enviar cambio de $20.000"></textarea>
          </div>

          <div class="shop-checkout-actions">
            <button type="button" class="shop-btn-back" id="shop-back-cart">
              <i class="fa-solid fa-arrow-left"></i> Volver al Carrito
            </button>
            <button type="submit" class="shop-btn-confirm">
              Confirmar Pedido <i class="fa-solid fa-whatsapp"></i>
            </button>
          </div>
        </form>
      </div>
    `;
  }

  static renderHomeHeader(businessName, settings) {
    const isOpen = this.checkIfOpen(settings);
    const openTime = settings.shop_hours_open || '09:00';
    const closeTime = settings.shop_hours_close || '23:00';

    return `
      <div class="shop-header">
        <div class="shop-header-content">
          <div class="shop-logo">
            ${
              settings.logo
                ? `<img src="${settings.logo}" alt="${escapeHtml(businessName)}">`
                : `<div class="shop-logo-placeholder">${escapeHtml(businessName.charAt(0))}</div>`
            }
          </div>
          <div class="shop-business-info">
            <h1 class="shop-business-name">${escapeHtml(businessName)}</h1>
            <div class="shop-status ${isOpen ? 'open' : 'closed'}">
              <span class="shop-status-dot"></span>
              ${isOpen ? 'Abierto' : 'Cerrado'}
            </div>
            <p class="shop-hours">
              <i class="fa-regular fa-clock"></i>
              ${openTime} - ${closeTime}
            </p>
          </div>
        </div>
        ${settings.shop_banner ? `<div class="shop-banner"><img src="${settings.shop_banner}" alt="Banner"></div>` : ''}
      </div>
    `;
  }

  static checkIfOpen(settings) {
    const openTime = settings.shop_hours_open || '09:00';
    const closeTime = settings.shop_hours_close || '23:00';

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [openHour, openMin] = openTime.split(':').map(Number);
    const [closeHour, closeMin] = closeTime.split(':').map(Number);

    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;

    if (closeMinutes < openMinutes) {
      return currentTime >= openMinutes || currentTime <= closeMinutes;
    }

    return currentTime >= openMinutes && currentTime <= closeMinutes;
  }
}

export default ShopUI;
