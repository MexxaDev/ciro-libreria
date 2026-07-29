'use strict';

import { saleRepo, productRepo, customerRepo, categoryRepo } from '../../db/repositories.js';
import { getPayments, PAYMENT_METHODS, PAYMENT_COLORS } from '../../utils/payments.js';
import { drawBarLineChart, drawDoughnutChart, drawPieChart } from '../../utils/charts.js';
import {
  getSalesByPeriod,
  getPeriodLabels,
  getSalesByCategory,
  renderTopProductsDetailed,
  attachPeriodSelector
} from '../../utils/analytics.js';
import state from '../../js/state.js';
import { logger } from '../../utils/logger.js';

class Reports {
  constructor() {
    this.sales = [];
    this.products = [];
    this.customers = [];
    this.categories = [];
    this.currentPeriod = 30;
  }

  async load() {
    const container = document.getElementById('reports');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>
          Cargando reportes...
        </div>
      `;
    }

    try {
      const [sales, products, customers, categories] = await Promise.all([
        saleRepo.findAll(),
        productRepo.findAll(),
        customerRepo.findAll(),
        categoryRepo.findAll()
      ]);

      this.sales = (sales || []).filter(s => s.status !== 'cancelled');
      this.products = products || [];
      this.customers = customers || [];
      this.categories = categories || [];

      this.render();
    } catch (error) {
      logger.error('Reports', 'Error loading reports:', error);
      if (container) {
        container.innerHTML = `
          <div style="text-align:center;padding:var(--space-8);color:var(--color-danger);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:48px;margin-bottom:var(--space-3);display:block;"></i>
            <h3>Error al cargar reportes</h3>
            <p style="margin-top:var(--space-2);color:var(--color-text-secondary);">Revisa la consola para más detalles</p>
          </div>
        `;
      }
    }
  }

  render() {
    const container = document.getElementById('reports');
    if (!container) {
      return;
    }

    const settings = state.get('settings') || {};
    this.currencySymbol = settings.currencySymbol || '$';

    container.innerHTML = `
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h1 class="page-header__title">Reportes</h1>
          <p class="page-header__subtitle">Análisis avanzado de ventas</p>
        </div>
        <button class="btn btn-primary" id="reports-export-csv">
          <i class="fa-solid fa-download"></i> Exportar CSV
        </button>
      </div>

      <div class="kpi-grid">
        ${this.renderSummaryCards(this.currencySymbol)}
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Ventas por Período</h3>
            <div class="chart-period-selector" id="report-period-selector">
              <button class="chart-period-btn" data-period="7">7 días</button>
              <button class="chart-period-btn active" data-period="30">30 días</button>
              <button class="chart-period-btn" data-period="90">90 días</button>
              <button class="chart-period-btn" data-period="365">Año</button>
            </div>
          </div>
          <canvas id="report-main-chart" height="350" aria-label="Gráfico de ventas por período"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Distribución por Categoría</h3>
          </div>
          <canvas id="report-category-chart" height="350" aria-label="Gráfico de distribución por categoría"></canvas>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Métodos de Pago</h3>
          </div>
          <canvas id="report-payment-chart" height="280" aria-label="Gráfico de métodos de pago"></canvas>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Top 10 Productos</h3>
          </div>
          <div id="report-top-products"></div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      setTimeout(() => {
        this.initMainChart();
        this.initCategoryChart(this.currencySymbol, this.categories);
        this.initPaymentChart(this.currencySymbol);
        this.renderTopProducts();
      }, 100);

      attachPeriodSelector('report-period-selector', period => {
        this.currentPeriod = parseInt(period);
        this.initMainChart();
      });
    });

    document.getElementById('reports-export-csv')?.addEventListener('click', () => this.exportSalesCSV());
  }

  renderSummaryCards(currencySymbol) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonth = y + '-' + m;

    const salesToday = this.sales.filter(s => s.date && s.date.startsWith(today));
    const salesMonth = this.sales.filter(s => s.date && s.date.startsWith(thisMonth));

    const totalToday = salesToday.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const totalMonth = salesMonth.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

    const avgTicket = salesMonth.length > 0 ? totalMonth / salesMonth.length : 0;

    const productCounts = {};
    salesMonth.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          productCounts[item.productId] = (productCounts[item.productId] || 0) + (item.quantity || 0);
        });
      }
    });
    const totalItems = Object.values(productCounts).reduce((sum, q) => sum + q, 0);

    return `
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--primary">
            <i class="fa-solid fa-dollar-sign"></i>
          </div>
        </div>
        <div class="kpi-card__value">${currencySymbol} ${totalToday.toFixed(2)}</div>
        <div class="kpi-card__label">Ventas Hoy</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--success">
            <i class="fa-solid fa-chart-line"></i>
          </div>
        </div>
        <div class="kpi-card__value">${currencySymbol} ${totalMonth.toFixed(2)}</div>
        <div class="kpi-card__label">Ventas Mes</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--warning">
            <i class="fa-solid fa-ticket"></i>
          </div>
        </div>
        <div class="kpi-card__value">${currencySymbol} ${avgTicket.toFixed(2)}</div>
        <div class="kpi-card__label">Ticket Promedio</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--info">
            <i class="fa-solid fa-box"></i>
          </div>
        </div>
        <div class="kpi-card__value">${totalItems}</div>
        <div class="kpi-card__label">Unidades Vendidas</div>
      </div>
    `;
  }

  initMainChart() {
    const canvas = document.getElementById('report-main-chart');
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const data = getSalesByPeriod(this.sales, this.currentPeriod);
    const labels = getPeriodLabels(this.currentPeriod);

    drawBarLineChart(ctx, labels, data, 'Ventas', ['#7C3AED', '#A78BFA', '#C4B5FD'], this.currencySymbol);
  }

  initCategoryChart(currencySymbol, categories) {
    const canvas = document.getElementById('report-category-chart');
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const categoryData = getSalesByCategory(this.sales, this.products, categories);

    drawDoughnutChart(
      ctx,
      categoryData.labels,
      categoryData.data,
      ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'],
      currencySymbol
    );
  }

  initPaymentChart(currencySymbol) {
    const canvas = document.getElementById('report-payment-chart');
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

    this.sales.forEach(sale => {
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

    drawPieChart(ctx, methodLabels, methodData, methodColors, currencySymbol);
  }

  renderTopProducts() {
    const container = document.getElementById('report-top-products');
    if (!container) {
      return;
    }

    container.innerHTML = renderTopProductsDetailed(this.sales, this.products, this.currencySymbol);
  }

  exportSalesCSV() {
    if (this.sales.length === 0) {
      return;
    }

    const headers = ['ID', 'Fecha', 'Cliente', 'Subtotal', 'Descuento', 'IVA', 'Total', 'Método de Pago', 'Tipo'];
    const rows = this.sales.map(sale => {
      const customer = this.customers.find(c => c.id === sale.customerId);
      return [
        sale.id,
        sale.date ? new Date(sale.date).toLocaleString('es-AR') : '',
        customer ? customer.name : 'Consumidor Final',
        sale.subtotal || 0,
        sale.discount || 0,
        sale.tax || 0,
        sale.total || 0,
        sale.paymentMethod || '',
        sale.paymentType || 'SIMPLE'
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_ventas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

export default new Reports();
