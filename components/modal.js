'use strict';

import { escapeHtml } from '../utils/sanitizer.js';

let _backdrop = null;

function removeBackdrop() {
  if (!_backdrop) {
    return;
  }
  const backdrop = _backdrop;
  _backdrop = null;
  backdrop.classList.remove('active');
  document.removeEventListener('keydown', handleKeydown);
  backdrop.addEventListener(
    'transitionend',
    () => {
      backdrop.remove();
    },
    { once: true }
  );
  setTimeout(() => {
    if (backdrop.isConnected) {
      backdrop.remove();
    }
  }, 400);
}

function handleKeydown(e) {
  if (e.key === 'Escape' || e.key === 'Esc') {
    close();
  }
}

function open({ title = '', body = '', footer = '' } = {}) {
  close();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'modal-header';
  const titleEl = document.createElement('h3');
  titleEl.className = 'modal-title';
  titleEl.textContent = escapeHtml(title);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Cerrar');
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  closeBtn.addEventListener('click', close);
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal-body';
  bodyEl.innerHTML = body;
  modal.appendChild(bodyEl);

  if (footer) {
    const footerEl = document.createElement('div');
    footerEl.className = 'modal-footer';
    footerEl.innerHTML = footer;
    modal.appendChild(footerEl);
  }

  backdrop.appendChild(modal);
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) {
      close();
    }
  });

  document.body.appendChild(backdrop);
  _backdrop = backdrop;
  document.addEventListener('keydown', handleKeydown);

  requestAnimationFrame(() => {
    backdrop.classList.add('active');
  });
}

function close() {
  removeBackdrop();
}

export default { show: open, close };
