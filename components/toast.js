'use strict';

import { escapeHtml } from '../utils/sanitizer.js';

class Toast {
  static container = null;

  static init(container) {
    this.container = container;
  }

  static show(title, message, type = 'success', duration = 3000) {
    if (!this.container) {
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${type === 'success' ? '\u2713' : type === 'error' ? '\u2715' : '\u26a0'}</span>
      <div class="toast__content">
        <div class="toast__title">${escapeHtml(title)}</div>
        <div class="toast__message">${escapeHtml(message)}</div>
      </div>
      <button class="toast__close" aria-label="Cerrar notificación">\u2715</button>
    `;

    this.container.appendChild(toast);

    toast.querySelector('.toast__close').addEventListener('click', () => {
      this.dismiss(toast);
    });

    setTimeout(() => this.dismiss(toast), duration);
  }

  static dismiss(toast) {
    toast.style.animation = 'slideOutRight var(--transition-normal)';
    setTimeout(() => toast.remove(), 300);
  }

  static success(title, message) {
    this.show(title, message, 'success');
  }

  static error(title, message) {
    this.show(title, message, 'error', 5000);
  }

  static warning(title, message) {
    this.show(title, message, 'warning', 4000);
  }

  static info(title, message) {
    this.show(title, message, 'info', 4000);
  }
}

export default Toast;
