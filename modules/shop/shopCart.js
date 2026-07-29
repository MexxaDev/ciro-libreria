'use strict';

import { logger } from '../../utils/logger.js';

class ShopCart {
  constructor() {
    this.items = [];
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('syntra_shop_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate structure
        if (Array.isArray(parsed)) {
          this.items = parsed.filter(item => item && item.id && item.name && item.price && item.quantity > 0);
        } else {
          this.items = [];
        }
      }
    } catch (e) {
      logger.error('ShopCart', 'Cart restore failed:', e);
      this.items = [];
      localStorage.removeItem('syntra_shop_cart');
    }
  }

  saveToStorage() {
    localStorage.setItem('syntra_shop_cart', JSON.stringify(this.items));
  }

  addItem(product, quantity = 1) {
    if (product.stock !== undefined && product.stock <= 0) {
      return this.items;
    }

    const existingIndex = this.items.findIndex(item => item.id === product.id);

    if (existingIndex >= 0) {
      const newQty = this.items[existingIndex].quantity + quantity;
      if (product.stock !== undefined && newQty > product.stock) {
        this.items[existingIndex].quantity = product.stock;
      } else {
        this.items[existingIndex].quantity = newQty;
      }
    } else {
      this.items.push({
        id: product.id,
        name: product.name,
        price: product.price_web || product.price,
        image: product.image || '',
        quantity: quantity,
        note: '',
        stock: product.stock
      });
    }

    this.saveToStorage();
    return this.items;
  }

  removeItem(productId) {
    this.items = this.items.filter(item => item.id !== productId);
    this.saveToStorage();
    return this.items;
  }

  updateQuantity(productId, quantity) {
    const item = this.items.find(item => item.id === productId);
    if (item) {
      if (quantity <= 0) {
        return this.removeItem(productId);
      }
      item.quantity = quantity;
      this.saveToStorage();
    }
    return this.items;
  }

  updateNote(productId, note) {
    const item = this.items.find(item => item.id === productId);
    if (item) {
      item.note = note;
      this.saveToStorage();
    }
    return this.items;
  }

  getSubtotal() {
    return this.items.reduce((total, item) => total + item.price * item.quantity, 0);
  }

  getItemCount() {
    return this.items.reduce((count, item) => count + item.quantity, 0);
  }

  clear() {
    this.items = [];
    this.saveToStorage();
  }

  getItems() {
    return this.items;
  }

  isEmpty() {
    return this.items.length === 0;
  }
}

export default new ShopCart();
