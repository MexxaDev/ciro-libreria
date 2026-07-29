'use strict';

import {
  saleRepo,
  productRepo,
  customerRepo,
  cashSessionRepo,
  cashMovementRepo,
  categoryRepo
} from '../../db/repositories.js';
import { getPayments, PAYMENT_COLORS } from '../../utils/payments.js';
import { PAYMENT_METHODS } from '../../utils/payments.js';
import {
  drawBarChart,
  drawBarLineChart,
  drawDoughnutChart,
  drawPieChart,
  drawMultiLineChart
} from '../../utils/charts.js';
import {
  getSalesByPeriod,
  getPeriodLabels,
  getSalesByCategory,
  renderTopProductsDetailed,
  attachPeriodSelector
} from '../../utils/analytics.js';
import Table from '../../components/table.js';
import { SALES_COLUMNS, SALES_ACTIONS, prepareSaleRows, showSaleDetail } from '../../utils/saleHelpers.js';
import state from '../../js/state.js';
import { escapeHtml } from '../../utils/sanitizer.js';
import { logger } from '../../utils/logger.js';
import cashService from '../cash/cashService.js';

class Dashboard {
  constructor() {
    this.element = null;
    this.cache = {
      sales: null,
      products: null,
      customers: null,
      sessions: null,
      movements: null,
      categories: null,
      lastLoad: 0
    };
    this._listenersAttached = false;
  }

  _setupDataListeners() {
    if (this._listenersAttached) {
      return;
    }
    this._listenersAttached = true;

    state.on('data:sales-changed', () => {
      this.cache.lastLoad = 0;
      if (this.element) {
        this.load();
      }
    });
  }

  async load() {
    this.element = document.getElementById('dashboard');
    this._setupDataListeners();
    const now = Date.now();
    if (now - this.cache.lastLoad < 30000 && this.cache.sales && this.cache.products) {
      this.renderWithCache();
      return;
    }

    if (this.element) {
      this.element.innerHTML = this.getLoadingSkeleton();
    }

    await this.loadStats();
  }

  getLoadingSkeleton() {
    return `
      <div class="page-header">
        <h1 class="page-header__title">Dashboard</h1>
        <p class="page-header__subtitle">Resumen completo de tu negocio</p>
      </div>
      <div class="kpi-grid" id="kpi-cards">
        ${Array(4)
          .fill(0)
          .map(
            () => `
          <div class="kpi-card">
            <div class="skeleton" style="width:48px;height:48px;border-radius:var(--radius-lg);margin-bottom:var(--space-4);"></div>
            <div class="skeleton" style="width:60%;height:32px;border-radius:var(--radius-sm);margin-bottom:var(--space-2);"></div>
            <div class="skeleton" style="width:40%;height:16px;border-radius:var(--radius-sm);"></div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  async loadStats() {
    try {
      const [sales, products, customers, sessions, movements, categories] = await Promise.all([
        saleRepo.findAll(),
        productRepo.findAll(),
        customerRepo.findAll(),
        cashSessionRepo.findAll(),
        cashMovementRepo.findAll(),
        categoryRepo.findAll()
      ]);

      this.cache.sales = (sales || []).filter(s => s.status !== 'cancelled');
      this.cache.products = products || [];
      this.cache.customers = customers || [];
      this.cache.sessions = sessions || [];
      this.cache.movements = movements || [];
      this.cache.categories = categories || [];
      this.cache.lastLoad = Date.now();
      this.cache.cashSummary = null;

      const openSession = this.cache.sessions.find(s => !s.closedAt);
      if (openSession) {
        try {
          this.cache.cashSummary = await cashService.getSummaryForSession(openSession.id);
        } catch (_) {
          this.cache.cashSummary = null;
        }
      }

      const settings = state.get('settings') || {};
      const currencySymbol = settings.currencySymbol || '$';
      this.renderDashboard(currencySymbol);
    } catch (error) {
      logger.error('Dashboard', 'Error loading dashboard stats:', error);
      this.cache.sales = [];
      this.cache.products = [];
      this.cache.customers = [];
      this.cache.sessions = [];
      this.cache.movements = [];
      this.cache.categories = [];
      this.cache.cashSummary = null;
      if (this.element) {
        this.element.innerHTML = `
          <div class="page-header">
            <h1 class="page-header__title">Dashboard</h1>
            <p class="page-header__subtitle">Resumen completo de tu negocio</p>
          </div>
          <div style="text-align:center;padding:var(--space-16);color:var(--color-danger);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:48px;margin-bottom:var(--space-4);display:block;"></i>
            <h3>Error al cargar estadisticas</h3>
            <p style="margin-top:var(--space-2);color:var(--color-text-secondary);">Revisa la consola para mas detalles</p>
          </div>
        `;
      }
    }
  }

  renderWithCache() {
    const settings = state.get('settings') || {};
    const currencySymbol = settings.currencySymbol || '$';
    this.renderDashboard(currencySymbol);
  }

  renderDashboard(currencySymbol) {
    this.currencySymbol = currencySymbol;
    if (!this.element) {
      return;
    }

    const sales = this.cache.sales || [];
    const products = this.cache.products || [];
    const categories = this.cache.categories || [];
    const customers = this.cache.customers || [];

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonth = y + '-' + m;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const salesToday = [];
    const salesYesterday = [];
    const salesMonth = [];
    let totalToday = 0;
    let totalYesterday = 0;
    let totalMonth = 0;
    let totalLastMonth = 0;
    let avgTicketLastMonth = 0;

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lm = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
    const lastMonthPrefix = lastMonthDate.getFullYear() + '-' + lm;
    let lastMonthCount = 0;

    sales.forEach(s => {
      if (!s.date) {
        return;
      }
      const d = s.date.substring(0, 10);
      const t = parseFloat(s.total) || 0;
      if (d === today) {
        salesToday.push(s);
        totalToday += t;
      }
      if (d === yesterdayStr) {
        salesYesterday.push(s);
        totalYesterday += t;
      }
      if (d.startsWith(thisMonth)) {
        salesMonth.push(s);
        totalMonth += t;
      }
      if (d.startsWith(lastMonthPrefix)) {
        totalLastMonth += t;
        lastMonthCount++;
      }
    });

    const avgTicket = salesMonth.length > 0 ? totalMonth / salesMonth.length : 0;
    avgTicketLastMonth = lastMonthCount > 0 ? totalLastMonth / lastMonthCount : 0;

    const currentSession = this.cache.sessions.find(s => !s.closedAt) || null;

    const alerts = this.getSmartAlerts(sales, products, currentSession, customers);

    this.element.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-header__title">Dashboard</h1>
          <p class="page-header__subtitle">Resumen completo de tu negocio</p>
        </div>
        <button class="btn btn-ghost btn-icon" id="dashboard-refresh-btn" title="Actualizar">
          <i class="fa-solid fa-rotate"></i>
        </button>
      </div>

      <div class="kpi-grid" id="kpi-cards">
        ${this.renderKPICard('fa-dollar-sign', 'Ventas Hoy', currencySymbol + ' ' + totalToday.toFixed(2), this.getChangePercent(totalToday, totalYesterday), 'primary', salesToday.length + ' transacciones')}
        ${this.renderKPICard('fa-chart-line', 'Ventas Mes', currencySymbol + ' ' + totalMonth.toFixed(2), this.getChangePercent(totalMonth, totalLastMonth), 'success', salesMonth.length + ' transacciones')}
        ${this.renderKPICard('fa-ticket', 'Ticket Prom.', currencySymbol + ' ' + avgTicket.toFixed(2), this.getChangePercent(avgTicket, avgTicketLastMonth), 'warning')}
        ${this.renderKPICard('fa-cash-register', 'Caja', currentSession ? currencySymbol + ' ' + (this.cache.cashSummary?.expectedTotal || 0).toFixed(2) : 'Cerrada', currentSession ? 'Abierta' : 'Cerrada', currentSession ? 'success' : 'danger', currentSession ? (this.cache.cashSummary?.movementCount || 0) + ' movimientos' : '')}
        ${this.renderKPICard('fa-boxes', 'Productos', products.length, products.filter(p => p.stock <= 5).length + ' stock bajo', 'info')}
        ${this.renderKPICard('fa-users', 'Clientes', customers.length, customers.filter(c => (parseFloat(c.balance) || 0) < 0).length + ' con deuda', 'info')}
      </div>

      <div class="charts-grid" id="charts-section">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Ventas</h3>
            <div class="chart-period-selector" id="period-selector">
              <button class="chart-period-btn active" data-period="7">7 días</button>
              <button class="chart-period-btn" data-period="30">30 días</button>
              <button class="chart-period-btn" data-period="90">90 días</button>
              <button class="chart-period-btn" data-period="365">Año</button>
            </div>
          </div>
          <canvas id="chart-main-sales" height="300" aria-label="Gráfico de ventas por período"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Ventas por Categoría</h3>
          </div>
          <canvas id="chart-categories" height="300" aria-label="Gráfico de ventas por categoría"></canvas>
        </div>
      </div>

      <div class="charts-grid" style="margin-top:var(--space-6);">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Semana vs Semana Anterior</h3>
          </div>
          <canvas id="chart-week-comparison" height="250" aria-label="Comparación semanal"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Ventas por Día de la Semana</h3>
          </div>
          <canvas id="chart-day-of-week" height="250" aria-label="Ventas por día"></canvas>
        </div>
      </div>

      <div class="charts-grid" style="margin-top:var(--space-6);">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Métodos de Pago</h3>
          </div>
          <canvas id="chart-payment-methods" height="250" aria-label="Gráfico de métodos de pago"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Horas Pico</h3>
          </div>
          <canvas id="chart-peak-hours" height="250" aria-label="Gráfico de horas pico"></canvas>
        </div>
      </div>

      <div class="charts-grid" style="margin-top:var(--space-6);">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Top Productos</h3>
          </div>
          <div id="top-products-detailed">
            ${renderTopProductsDetailed(sales, products, currencySymbol)}
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Top Clientes</h3>
          </div>
          <div id="top-customers">
            ${this.renderTopCustomers(sales, customers, currencySymbol)}
          </div>
        </div>
      </div>

      <div class="chart-card" style="margin-top:var(--space-6);">
        <div class="chart-card__header">
          <h3 class="chart-title">Últimas Ventas</h3>
        </div>
        <div id="recent-sales-table"></div>
      </div>
    `;

    this._syncHeaderAlerts(alerts);

    const refreshBtn = document.getElementById('dashboard-refresh-btn');
    if (refreshBtn && !refreshBtn._handlerAttached) {
      refreshBtn._handlerAttached = true;
      refreshBtn.addEventListener('click', () => {
        this.cache.lastLoad = 0;
        this.load();
      });
    }

    requestAnimationFrame(() => {
      setTimeout(() => {
        this.initMainChart('7', sales);
        this.initCategoriesChart(sales, products, categories, currencySymbol);
        this.initWeekComparisonChart(sales, currencySymbol);
        this.initDayOfWeekChart(sales);
        this.initPaymentMethodsChart(sales);
        this.initPeakHoursChart(sales);
        this.initRecentSalesTable(salesMonth, customers);
      }, 100);

      this._attachPeriodSelector(sales);
    });
  }

  renderKPICard(icon, label, value, change, colorClass, subtitle) {
    const changeNum = typeof change === 'string' ? parseFloat(change) : change;
    const isPositive = changeNum > 0 || (typeof change === 'string' && change.includes('Abierta'));

    let changeHtml = '';
    if (typeof change === 'string' && (change.includes('Abierta') || change.includes('Cerrada'))) {
      changeHtml = `<div class="kpi-card__change ${isPositive ? 'kpi-card__change--positive' : 'kpi-card__change--negative'}">${change}</div>`;
    } else {
      const arrow = isPositive ? '<i class="fa-solid fa-arrow-up"></i>' : '<i class="fa-solid fa-arrow-down"></i>';
      changeHtml = `<div class="kpi-card__change ${isPositive ? 'kpi-card__change--positive' : 'kpi-card__change--negative'}">${arrow} ${change}</div>`;
    }

    return `
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--${colorClass}">
            <i class="fa-solid ${icon}"></i>
          </div>
        </div>
        <div class="kpi-card__value">${value}</div>
        <div class="kpi-card__label">${label}</div>
        ${changeHtml}
        ${subtitle ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-1);">${subtitle}</div>` : ''}
      </div>
    `;
  }

  getChangePercent(current, previous) {
    if (!previous || previous === 0) {
      return current > 0 ? '+100%' : '+0%';
    }
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? '+' : '';
    return sign + change.toFixed(1) + '%';
  }

  getSmartAlerts(sales, products, currentSession, customers) {
    const alerts = [];

    const lowStock = products.filter(p => p.stock <= 5);
    if (lowStock.length > 0) {
      alerts.push({ type: 'warning', icon: 'fa-box-open', text: `${lowStock.length} producto(s) con stock bajo` });
    }

    const inactiveProducts = products.filter(p => p.visible === false || p.inactive === true);
    if (inactiveProducts.length > 0) {
      alerts.push({ type: 'info', icon: 'fa-eye-slash', text: `${inactiveProducts.length} producto(s) inactivo(s)` });
    }

    if (!currentSession) {
      alerts.push({ type: 'danger', icon: 'fa-cash-register', text: 'Caja no está abierta' });
    }

    const today = new Date().toISOString().split('T')[0];
    const salesToday = sales.filter(s => s.date && s.date.startsWith(today));
    if (salesToday.length === 0) {
      alerts.push({ type: 'warning', icon: 'fa-chart-line', text: 'Sin ventas registradas hoy' });
    }

    const customersWithDebt = customers.filter(c => (parseFloat(c.balance) || 0) < 0);
    if (customersWithDebt.length > 0) {
      alerts.push({ type: 'danger', icon: 'fa-user-clock', text: `${customersWithDebt.length} cliente(s) con deuda` });
    }

    return alerts;
  }

  renderSmartAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
      return '<div style="text-align:center;padding:var(--space-6);color:var(--color-success);"><i class="fa-solid fa-check-circle" style="font-size:24px;display:block;margin-bottom:var(--space-2);"></i><span style="font-size:var(--text-sm);">Todo en orden</span></div>';
    }

    return alerts
      .map(
        alert => `
      <div class="alert-item">
        <div class="alert-item__icon alert-item__icon--${alert.type}">
          <i class="fa-solid ${alert.icon}"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-sm);font-weight:var(--font-medium);">${alert.text}</div>
        </div>
        <span class="alert-item__type alert-item__type--${alert.type}">${alert.type === 'danger' ? 'Crítico' : alert.type === 'warning' ? 'Atención' : 'Info'}</span>
      </div>
    `
      )
      .join('');
  }

  _syncHeaderAlerts(alerts) {
    const btn = document.getElementById('header-alerts-btn');
    const badge = document.getElementById('header-alerts-badge');
    const count = document.getElementById('header-alerts-count');
    const content = document.getElementById('header-alerts-content');
    if (!btn || !badge || !content) {
      return;
    }

    const hasAlerts = alerts.length > 0;
    if (hasAlerts) {
      btn.classList.add('alerts-btn--has-alerts');
      badge.textContent = alerts.length;
      badge.style.display = '';
      if (count) {
        count.textContent = alerts.length;
        count.style.display = '';
      }
    } else {
      btn.classList.remove('alerts-btn--has-alerts');
      badge.style.display = 'none';
      if (count) {
        count.style.display = 'none';
      }
    }
    content.innerHTML = this.renderSmartAlerts(alerts);
  }

  renderTopCustomers(sales, customers, currencySymbol) {
    const customerCounts = {};
    sales.forEach(sale => {
      if (sale.customerId) {
        if (!customerCounts[sale.customerId]) {
          const customer = customers.find(c => c.id === sale.customerId);
          customerCounts[sale.customerId] = {
            name: customer ? customer.name : 'Consumidor Final',
            total: 0,
            count: 0
          };
        }
        customerCounts[sale.customerId].total += parseFloat(sale.total) || 0;
        customerCounts[sale.customerId].count += 1;
      }
    });

    const topCustomers = Object.values(customerCounts)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    if (topCustomers.length === 0) {
      return '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);padding:var(--space-4);">No hay datos disponibles</p>';
    }

    const cs = currencySymbol || '$';

    return topCustomers
      .map(
        (cust, _i) => `
      <div class="top-product-item">
        <div class="top-product-item__image" style="background:var(--color-info-light);color:var(--color-info);">
          <i class="fa-solid fa-user"></i>
        </div>
        <div style="flex:1;">
          <div style="font-weight:var(--font-medium);font-size:var(--text-sm);">${escapeHtml(cust.name)}</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary);">${cust.count} ventas - ${cs}${cust.total.toFixed(2)}</div>
        </div>
        <div style="font-weight:var(--font-bold);font-size:var(--text-sm);color:var(--color-primary);">
          ${cs}${cust.total.toFixed(2)}
        </div>
      </div>
    `
      )
      .join('');
  }

  initRecentSalesTable(salesMonth, customers) {
    const container = document.getElementById('recent-sales-table');
    if (!container) {
      return;
    }

    const last10 = salesMonth.slice(-10).reverse();
    if (last10.length === 0) {
      container.innerHTML =
        '<div style="text-align:center;padding:var(--space-6);color:var(--color-text-secondary);font-size:var(--text-sm);">No hay ventas registradas este mes</div>';
      return;
    }

    const rows = prepareSaleRows(last10, customers || []);
    const table = new Table({
      columns: SALES_COLUMNS,
      data: rows,
      actions: SALES_ACTIONS,
      onRowClick: row => showSaleDetail(row)
    });
    table.mount(container);
  }

  initMainChart(period, sales) {
    const canvas = document.getElementById('chart-main-sales');
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const days = parseInt(period);
    const data = getSalesByPeriod(sales, days);
    const labels = getPeriodLabels(days);

    drawBarLineChart(ctx, labels, data, 'Ventas', ['#7C3AED', '#C4B5FD'], this.currencySymbol);
  }

  initWeekComparisonChart(sales, currencySymbol) {
    const canvas = document.getElementById('chart-week-comparison');
    if (!canvas) {
      return;
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - mondayOffset);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const dataThisWeek = [0, 0, 0, 0, 0, 0, 0];
    const dataLastWeek = [0, 0, 0, 0, 0, 0, 0];

    const cs = currencySymbol || '$';

    sales.forEach(s => {
      if (!s.date) {
        return;
      }
      const d = new Date(s.date.substring(0, 10) + 'T00:00:00');
      const t = parseFloat(s.total) || 0;
      const dw = d.getDay();
      const idx = dw === 0 ? 6 : dw - 1;

      if (d >= thisMonday && d <= now) {
        dataThisWeek[idx] += t;
      } else if (d >= lastMonday && d < thisMonday) {
        dataLastWeek[idx] += t;
      }
    });

    const ctx = canvas.getContext('2d');
    drawMultiLineChart(
      ctx,
      labels,
      [
        { label: 'Esta semana', data: dataThisWeek },
        { label: 'Semana pasada', data: dataLastWeek }
      ],
      ['#7C3AED', '#94A3B8'],
      cs
    );
  }

  initDayOfWeekChart(sales) {
    const canvas = document.getElementById('chart-day-of-week');
    if (!canvas) {
      return;
    }

    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    sales.forEach(s => {
      if (!s.date) {
        return;
      }
      const d = new Date(s.date.substring(0, 10) + 'T00:00:00');
      const dow = d.getDay();
      dayTotals[dow] += parseFloat(s.total) || 0;
      dayCounts[dow]++;
    });

    const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const averages = dayTotals.map((t, i) => (dayCounts[i] > 0 ? t / dayCounts[i] : 0));

    const ctx = canvas.getContext('2d');
    drawBarChart(ctx, labels, averages, ['#EF4444', '#7C3AED', '#7C3AED', '#7C3AED', '#7C3AED', '#7C3AED', '#3B82F6']);
  }

  initCategoriesChart(sales, products, categories, currencySymbol) {
    const canvas = document.getElementById('chart-categories');
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const categoryData = getSalesByCategory(sales, products, categories);

    drawDoughnutChart(
      ctx,
      categoryData.labels,
      categoryData.data,
      ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'],
      currencySymbol
    );
  }

  initPaymentMethodsChart(sales) {
    const canvas = document.getElementById('chart-payment-methods');
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const methods = {};
    const labels = {};

    PAYMENT_METHODS.forEach(m => {
      methods[m.id] = 0;
      labels[m.id] = m.label;
    });

    sales.forEach(sale => {
      const payments = getPayments(sale);
      payments.forEach(p => {
        if (methods[p.method] !== undefined) {
          methods[p.method] += p.amount;
        } else {
          methods[p.method] = p.amount;
          labels[p.method] = p.method;
        }
      });
    });

    const methodKeys = Object.keys(methods).filter(k => methods[k] > 0);
    const methodData = methodKeys.map(k => methods[k]);
    const methodLabels = methodKeys.map(k => labels[k]);
    const methodColors = methodKeys.map(k => PAYMENT_COLORS[k] || '#6B7280');

    const settings = state.get('settings') || {};
    const currencySymbol = settings.currencySymbol || '$';
    drawPieChart(ctx, methodLabels, methodData, methodColors, currencySymbol);
  }

  initPeakHoursChart(sales) {
    const canvas = document.getElementById('chart-peak-hours');
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const hourData = new Array(18).fill(0);

    sales.forEach(sale => {
      if (sale.date && sale.date.length > 13) {
        const hour = parseInt(sale.date.substring(11, 13), 10);
        if (hour >= 6 && hour <= 23) {
          hourData[hour - 6] += parseFloat(sale.total) || 0;
        }
      }
    });

    const labels = [];
    for (let i = 6; i <= 23; i++) {
      labels.push(i + ':00');
    }

    drawBarChart(ctx, labels, hourData, [
      '#7C3AED',
      '#A78BFA',
      '#C4B5FD',
      '#7C3AED',
      '#A78BFA',
      '#C4B5FD',
      '#7C3AED',
      '#A78BFA',
      '#C4B5FD',
      '#7C3AED',
      '#A78BFA',
      '#C4B5FD',
      '#7C3AED',
      '#A78BFA',
      '#C4B5FD',
      '#7C3AED',
      '#A78BFA',
      '#C4B5FD'
    ]);
  }

  _attachPeriodSelector(sales) {
    attachPeriodSelector('period-selector', period => {
      this.initMainChart(period, sales);
    });
  }
}

export default new Dashboard();
