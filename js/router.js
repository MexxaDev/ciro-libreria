'use strict';

import state from './state.js';
import { logger } from '../utils/logger.js';
import { hasRoutePermission, getDefaultRoute } from '../config/permissions.js';

class Router {
  constructor() {
    this.privateRoutes = [
      'dashboard',
      'pos',
      'products',
      'categories',
      'customers',
      'sales',
      'cash',
      'reports',
      'settings',
      'users',
      'payment-methods'
    ];
    this.publicRoutes = ['shop'];
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  handleRoute() {
    let hash = window.location.hash.slice(1) || 'dashboard';
    const user = state.get('currentUser');
    const role = user ? user.role : null;

    if (this.publicRoutes.includes(hash)) {
      state.set('currentRoute', hash);
      this.showPublicRoute(hash);
      return;
    }

    if (!user) {
      return;
    }

    if (!hasRoutePermission(role, hash)) {
      hash = getDefaultRoute(role);
      window.location.hash = hash;
    }

    if (!this.privateRoutes.includes(hash)) {
      hash = getDefaultRoute(role);
      window.location.hash = hash;
    }

    state.set('currentRoute', hash);
    this.showPrivateRoute(hash);
  }

  navigate(route) {
    window.location.hash = route;
  }

  async showPublicRoute(route) {
    const loginScreen = document.getElementById('login-screen');
    const app = document.getElementById('app');
    const shopContainer = document.getElementById('shop-container');

    if (loginScreen) {
      loginScreen.style.display = 'none';
    }
    if (app) {
      app.style.display = 'none';
    }

    if (shopContainer) {
      shopContainer.style.display = 'block';
      shopContainer.classList.add('active');
    }

    document.body.classList.add('shop-active');
    document.body.classList.remove('app-active');

    if (route === 'shop') {
      try {
        const { default: Shop } = await import('../modules/shop/shop.js');
        await Shop.load();
      } catch (error) {
        logger.error('Router', 'Error loading Shop module', error);
      }
    }
  }

  showPrivateRoute(route) {
    const app = document.getElementById('app');
    const shopContainer = document.getElementById('shop-container');

    document.body.classList.remove('shop-active');
    document.body.classList.add('app-active');

    if (app) {
      app.style.display = 'grid';
    }
    if (shopContainer) {
      shopContainer.style.display = 'none';
      shopContainer.classList.remove('active');
    }

    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });

    const targetSection = document.getElementById(route);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === route);
    });
  }
}

export default new Router();
