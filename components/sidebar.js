'use strict';

import router from '../js/router.js';
import state from '../js/state.js';
import { escapeHtml } from '../utils/sanitizer.js';
import { getMenuForRole } from '../config/permissions.js';
import { BRAND, getBrandLogo } from '../config/brandConfig.js';

class Sidebar {
  constructor() {
    this.element = null;
    this._routeHandlers = [];
    this._mousemoveHandler = null;
  }

  getMenuItems() {
    const user = state.get('currentUser');
    if (!user) {
      return [];
    }
    return getMenuForRole(user.role);
  }

  render() {
    const items = this.getMenuItems();
    const currentRoute = state.get('currentRoute') || 'dashboard';

    return `
      <div class="sidebar-header">
        <div class="sidebar-logo">${getBrandLogo()}</div>
        <span class="sidebar-brand">${BRAND.name}</span>
      </div>
      <nav class="sidebar-nav">
        <div class="sidebar-section">
          <div class="sidebar-section-title">Principal</div>
          ${items
            .map(
              item => `
            <div class="sidebar-item ${item.route === currentRoute ? 'active' : ''}" data-route="${item.route}">
              <span class="sidebar-item__icon"><i class="fa-solid ${item.icon}"></i></span>
                  <span>${escapeHtml(item.label)}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-item" id="logout-btn">
          <span class="sidebar-item__icon"><i class="fa-solid fa-right-from-bracket"></i></span>
          <span>Cerrar Sesión</span>
        </div>
      </div>
    `;
  }

  mount(container) {
    this.element = container;
    container.innerHTML = this.render();

    container.addEventListener('click', e => {
      const item = e.target.closest('.sidebar-item');
      if (!item) {
        return;
      }

      if (item.id === 'logout-btn') {
        if (!window.confirm('\u00bfEst\u00e1s seguro de cerrar sesi\u00f3n?')) {
          return;
        }
        state.clearSession();
        window.location.reload();
        return;
      }

      const route = item.dataset.route;
      if (route) {
        router.navigate(route);
      }
    });

    const routeHandler1 = route => {
      container.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.toggle('active', item.dataset.route === route);
      });
    };
    state.on('state:currentRoute', routeHandler1);
    this._routeHandlers.push(routeHandler1);

    this.initHoverMode();
  }

  initHoverMode() {
    const app = document.getElementById('app');
    if (!app) {
      return;
    }

    let hoverTimeout;
    let isHovering = false;

    this._mousemoveHandler = e => {
      if (e.clientX <= 10 && !isHovering) {
        isHovering = true;
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          app.classList.add('sidebar-hover-active');
        }, 300);
      } else if (e.clientX > 300 && isHovering) {
        isHovering = false;
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          app.classList.remove('sidebar-hover-active');
        }, 300);
      }
    };
    document.addEventListener('mousemove', this._mousemoveHandler);

    const sidebar = this.element;
    if (sidebar) {
      sidebar.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
      });

      sidebar.addEventListener('mouseleave', () => {
        isHovering = false;
        hoverTimeout = setTimeout(() => {
          app.classList.remove('sidebar-hover-active');
        }, 300);
      });
    }

    const routeHandler2 = route => {
      if (route === 'pos') {
        app.classList.add('sidebar-collapsed');
        app.classList.remove('sidebar-hidden');
        state.set('sidebarMode', 'hover');
      } else if (state.get('sidebarMode') === 'hover') {
        app.classList.remove('sidebar-collapsed', 'sidebar-hover-active');
        state.set('sidebarMode', 'expanded');
      }
    };
    state.on('state:currentRoute', routeHandler2);
    this._routeHandlers.push(routeHandler2);
  }

  destroy() {
    for (const handler of this._routeHandlers) {
      state.off('state:currentRoute', handler);
    }
    this._routeHandlers = [];
    if (this._mousemoveHandler) {
      document.removeEventListener('mousemove', this._mousemoveHandler);
      this._mousemoveHandler = null;
    }
  }
}

export default Sidebar;
