'use strict';

import { escapeHtml } from './sanitizer.js';

export function getSalesByPeriod(sales, days) {
  const dateMap = {};
  sales.forEach(s => {
    if (s.date) {
      const day = s.date.substring(0, 10);
      dateMap[day] = (dateMap[day] || 0) + (parseFloat(s.total) || 0);
    }
  });
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    data.push(dateMap[dateStr] || 0);
  }
  return data;
}

export function getPeriodLabels(days) {
  const labels = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.getMonth() + 1 + '/' + d.getDate());
  }
  return labels;
}

export function getSalesByCategory(sales, products, categories) {
  const categoryTotals = {};

  sales.forEach(sale => {
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const categoryId = product ? product.categoryId : 'unknown';
        categoryTotals[categoryId] = (categoryTotals[categoryId] || 0) + (parseFloat(item.subtotal) || 0);
      });
    }
  });

  const categoryMap = {};
  (categories || []).forEach(c => {
    categoryMap[c.id] = c.name;
  });

  return {
    labels: Object.keys(categoryTotals).map(k => categoryMap[k] || 'Sin categoría'),
    data: Object.values(categoryTotals)
  };
}

export function renderTopProductsDetailed(sales, products, currencySymbol) {
  const productCounts = {};
  sales.forEach(sale => {
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach(item => {
        if (!productCounts[item.productId]) {
          const product = products.find(p => p.id === item.productId);
          productCounts[item.productId] = {
            name: item.name || (product ? product.name : 'Unknown'),
            quantity: 0,
            total: 0,
            image: product ? product.image : ''
          };
        }
        productCounts[item.productId].quantity += item.quantity || 0;
        productCounts[item.productId].total += parseFloat(item.subtotal) || 0;
      });
    }
  });

  const topProducts = Object.values(productCounts)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  if (topProducts.length === 0) {
    return '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);padding:var(--space-4);">No hay datos disponibles</p>';
  }

  const cs = currencySymbol || '$';

  return topProducts
    .map(
      (prod, i) => `
    <div class="top-product-item">
      <div class="top-product-item__image">
        ${prod.image ? `<img src="${escapeHtml(prod.image)}" alt="${escapeHtml(prod.name)}">` : '<i class="fa-solid fa-box"></i>'}
      </div>
      <div style="flex:1;">
        <div style="font-weight:var(--font-medium);font-size:var(--text-sm);">${i + 1}. ${escapeHtml(prod.name)}</div>
        <div style="font-size:var(--text-xs);color:var(--color-text-secondary);">${prod.quantity} vendidos - ${cs} ${prod.total.toFixed(2)}</div>
      </div>
      <div style="font-weight:var(--font-bold);font-size:var(--text-sm);color:var(--color-primary);">
        #${i + 1}
      </div>
    </div>
  `
    )
    .join('');
}

export function attachPeriodSelector(selectorId, callback) {
  const selector = document.getElementById(selectorId);
  if (!selector) {
    return;
  }

  selector.querySelectorAll('.chart-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selector.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      callback(btn.dataset.period);
    });
  });
}
