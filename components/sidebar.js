'use strict';

import state from '../js/state.js';
import { BRAND } from '../config/brandConfig.js';
import { getMenuForRole } from '../config/permissions.js';
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

export default class Sidebar {
  constructor() {
    this.user = state.get('currentUser') || null;
  }

  mount(container) {
    if (!container) {
      return;
    }

    const role = this.user ? this.user.role : 'admin';
    const menuItems = getMenuForRole(role);
    const currentRoute = state.get('currentRoute') || 'dashboard';

    const header = document.createElement('div');
    header.className = 'sidebar-header';
    const logo = document.createElement('div');
    logo.className = 'sidebar-logo';
    if (BRAND.logo) {
      logo.innerHTML = `<img src="${escapeHtml(BRAND.logo)}" alt="${escapeHtml(BRAND.name)}" loading="eager">`;
    } else {
      logo.textContent = BRAND.name.charAt(0).toUpperCase();
    }
    const brand = document.createElement('span');
    brand.className = 'sidebar-brand';
    brand.textContent = BRAND.name;
    header.appendChild(logo);
    header.appendChild(brand);

    const nav = document.createElement('nav');
    nav.className = 'sidebar-nav';
    for (const item of menuItems) {
      const el = document.createElement('div');
      el.className = 'sidebar-item';
      if (item.route === currentRoute) {
        el.classList.add('active');
      }
      el.dataset.route = item.route;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.innerHTML = `
        <span class="sidebar-item__icon"><i class="fa-solid ${escapeHtml(item.icon)}"></i></span>
        <span>${escapeHtml(item.label)}</span>
      `;
      el.addEventListener('click', () => {
        window.location.hash = item.route;
        closeMobileSidebar();
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      });
      nav.appendChild(el);
    }

    const footer = document.createElement('div');
    footer.className = 'sidebar-footer';
    const logout = document.createElement('div');
    logout.className = 'sidebar-item';
    logout.setAttribute('role', 'button');
    logout.innerHTML = `
      <span class="sidebar-item__icon"><i class="fa-solid fa-right-from-bracket"></i></span>
      <span>Salir</span>
    `;
    logout.addEventListener('click', () => {
      state.clearSession();
      window.location.reload();
    });
    footer.appendChild(logout);

    container.innerHTML = '';
    container.appendChild(header);
    container.appendChild(nav);
    container.appendChild(footer);
  }
}
