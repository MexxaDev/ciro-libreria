'use strict';

import { escapeHtml } from '../utils/sanitizer.js';

const ICONS = {
  success: 'fa-circle-check',
  error: 'fa-circle-xmark',
  warning: 'fa-triangle-exclamation',
  info: 'fa-circle-info'
};

const DURATION = 3500;

let _container = null;

function getContainer() {
  if (_container && document.body.contains(_container)) {
    return _container;
  }
  _container = document.querySelector('.toast-container') || document.querySelector('#toast-container');
  if (!_container) {
    _container = document.createElement('div');
    _container.className = 'toast-container';
    document.body.appendChild(_container);
  }
  return _container;
}

function show(type, title, message) {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');

  const icon = document.createElement('span');
  icon.className = `toast__icon fa-solid ${ICONS[type] || ICONS.info}`;
  toast.appendChild(icon);

  const content = document.createElement('div');
  content.className = 'toast__content';
  const titleEl = document.createElement('div');
  titleEl.className = 'toast__title';
  titleEl.textContent = escapeHtml(title || '');
  const messageEl = document.createElement('div');
  messageEl.className = 'toast__message';
  messageEl.textContent = escapeHtml(message || '');
  content.appendChild(titleEl);
  content.appendChild(messageEl);
  toast.appendChild(content);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast__close';
  closeBtn.setAttribute('aria-label', 'Cerrar');
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  toast.appendChild(closeBtn);

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

  const timer = setTimeout(dismiss, DURATION);
  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', () => {
    if (toast.isConnected) {
      setTimeout(dismiss, DURATION);
    }
  });
}

function init(container) {
  _container = container;
}

export default {
  init,
  show,
  success: (title, message) => show('success', title, message),
  error: (title, message) => show('error', title, message),
  warning: (title, message) => show('warning', title, message),
  info: (title, message) => show('info', title, message)
};
