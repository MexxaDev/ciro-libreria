'use strict';

import state from '../js/state.js';
import { BRAND } from '../config/brandConfig.js';
import { escapeHtml } from '../utils/sanitizer.js';

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) {
    sidebar.classList.remove('open');
  }
  if (overlay) {
    overlay.classList.remove('active');
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
  if (overlay) {
    overlay.classList.toggle('active');
  }
}

export default class Header {
  constructor() {
    this.user = state.get('currentUser') || null;
    this.settings = state.get('settings') || {};
  }

  mount(container) {
    if (!container) {
      return;
    }

    const businessName = this.settings.businessName || BRAND.name;
    const name = this.user ? this.user.name || this.user.username : 'Usuario';
    const role = this.user && this.user.role ? this.user.role : '';
    const initial = (name || 'U').charAt(0).toUpperCase();

    const left = document.createElement('div');
    left.className = 'header-left';

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'btn btn-ghost';
    menuBtn.setAttribute('aria-label', 'Abrir menú');
    menuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    menuBtn.addEventListener('click', toggleMobileSidebar);
    left.appendChild(menuBtn);

    const brand = document.createElement('div');
    brand.className = 'header-brand';
    if (BRAND.logo) {
      brand.innerHTML = `<img src="${escapeHtml(BRAND.logo)}" alt="${escapeHtml(BRAND.name)}" loading="eager">`;
    }
    const brandName = document.createElement('span');
    brandName.textContent = escapeHtml(businessName);
    brand.appendChild(brandName);
    left.appendChild(brand);

    const right = document.createElement('div');
    right.className = 'header-right';

    const wrapper = document.createElement('div');
    wrapper.className = 'user-btn-wrapper';

    const userBtn = document.createElement('button');
    userBtn.type = 'button';
    userBtn.className = 'user-btn';
    userBtn.setAttribute('aria-label', 'Menú de usuario');
    userBtn.textContent = initial;
    userBtn.addEventListener('click', e => {
      e.stopPropagation();
      popover.classList.toggle('active');
    });

    const popover = document.createElement('div');
    popover.className = 'user-popover';

    const popoverHeader = document.createElement('div');
    popoverHeader.className = 'user-popover__header';
    const avatar = document.createElement('div');
    avatar.className = 'user-popover__avatar';
    avatar.textContent = initial;
    const userInfo = document.createElement('div');
    const userName = document.createElement('div');
    userName.className = 'user-popover__name';
    userName.textContent = escapeHtml(name);
    const userRole = document.createElement('div');
    userRole.className = 'user-popover__role';
    userRole.textContent = escapeHtml(role === 'admin' ? 'Administrador' : role === 'cajero' ? 'Cajero' : role);
    userInfo.appendChild(userName);
    userInfo.appendChild(userRole);
    popoverHeader.appendChild(avatar);
    popoverHeader.appendChild(userInfo);

    const popoverBody = document.createElement('div');
    popoverBody.className = 'user-popover__body';
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'user-popover__btn user-popover__btn--logout';
    logoutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión';
    logoutBtn.addEventListener('click', () => {
      state.clearSession();
      window.location.reload();
    });
    popoverBody.appendChild(logoutBtn);

    popover.appendChild(popoverHeader);
    popover.appendChild(popoverBody);

    wrapper.appendChild(userBtn);
    wrapper.appendChild(popover);
    right.appendChild(wrapper);

    document.addEventListener('click', e => {
      if (!wrapper.contains(e.target)) {
        popover.classList.remove('active');
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && popover.classList.contains('active')) {
        popover.classList.remove('active');
      }
    });

    const overlay = document.getElementById('sidebar-overlay');
    if (overlay && !overlay._syntraHandler) {
      overlay._syntraHandler = true;
      overlay.addEventListener('click', closeMobileSidebar);
    }

    container.innerHTML = '';
    container.appendChild(left);
    container.appendChild(right);
  }
}
