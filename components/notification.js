'use strict';

import { escapeHtml } from '../utils/sanitizer.js';

const DURATION = 6000;

let _container = null;

function getContainer() {
  if (_container && document.body.contains(_container)) {
    return _container;
  }
  _container = document.querySelector('.notification-container');
  if (!_container) {
    _container = document.createElement('div');
    _container.className = 'notification-container';
    document.body.appendChild(_container);
  }
  return _container;
}

function show({ title = '', message = '', type = 'info' } = {}) {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `notification-toast notification-toast--${type}`;
  toast.setAttribute('role', 'status');

  const header = document.createElement('div');
  header.className = 'notification-toast__header';
  const titleEl = document.createElement('span');
  titleEl.className = 'notification-toast__title';
  titleEl.textContent = escapeHtml(title);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'notification-toast__close';
  closeBtn.setAttribute('aria-label', 'Cerrar');
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  toast.appendChild(header);

  if (message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'notification-toast__message';
    messageEl.textContent = escapeHtml(message);
    toast.appendChild(messageEl);
  }

  const dismiss = () => {
    toast.style.transition = 'all 0.3s ease';
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  };
  closeBtn.addEventListener('click', dismiss);

  container.appendChild(toast);

  setTimeout(dismiss, DURATION);
}

function init() {
  getContainer();
}

export default {
  init,
  show
};
