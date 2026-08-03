'use strict';

import { escapeHtml } from '../utils/sanitizer.js';

export default class Table {
  constructor({ columns = [], data = [], actions = [], onRowClick = null, pageSize = null } = {}) {
    this.columns = columns;
    this.data = data;
    this.actions = actions;
    this.onRowClick = onRowClick;
    this.pageSize = pageSize && pageSize > 0 ? pageSize : null;
    this.currentPage = 1;
    this.sortKey = null;
    this.sortDir = 'asc';
    this.container = null;
  }

  update(data) {
    this.data = data || [];
    this.currentPage = 1;
    this.render();
  }

  mount(container) {
    this.container = container;
    this.render();
  }

  render() {
    if (!this.container) {
      return;
    }

    const sorted = this._sortedData();
    const totalPages = this.pageSize ? Math.max(1, Math.ceil(sorted.length / this.pageSize)) : 1;
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    const start = this.pageSize ? (this.currentPage - 1) * this.pageSize : 0;
    const pageRows = this.pageSize ? sorted.slice(start, start + this.pageSize) : sorted;

    const wrapper = document.createElement('div');
    wrapper.className = 'table-container';

    const table = document.createElement('table');
    table.className = 'table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const column of this.columns) {
      const th = document.createElement('th');
      th.textContent = column.label || '';
      if (column.key) {
        th.dataset.sortKey = column.key;
        th.style.cursor = 'pointer';
        th.appendChild(this._sortIcon(column.key));
      }
      headRow.appendChild(th);
    }
    if (this.actions.length > 0) {
      const th = document.createElement('th');
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    if (pageRows.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = this.columns.length + (this.actions.length > 0 ? 1 : 0);
      td.textContent = 'No hay datos para mostrar';
      td.style.textAlign = 'center';
      td.style.padding = 'var(--space-8)';
      td.style.color = 'var(--color-text-secondary)';
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      pageRows.forEach(row => {
        const originalIndex = this.data.indexOf(row);
        const tr = document.createElement('tr');
        tr.dataset.rowIndex = String(originalIndex);
        if (this.onRowClick) {
          tr.style.cursor = 'pointer';
          tr.addEventListener('click', () => this.onRowClick(row));
        }
        for (const column of this.columns) {
          const td = document.createElement('td');
          td.innerHTML = column.format ? column.format(row[column.key], row) : escapeHtml(row[column.key] ?? '');
          tr.appendChild(td);
        }
        if (this.actions.length > 0) {
          const td = document.createElement('td');
          td.style.whiteSpace = 'nowrap';
          for (const action of this.actions) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn ${action.class || 'btn-ghost'}`;
            btn.dataset.action = action.name;
            btn.dataset.rowIndex = String(originalIndex);
            if (action.icon) {
              const icon = document.createElement('i');
              icon.className = action.icon;
              btn.appendChild(icon);
            }
            if (action.label) {
              btn.appendChild(document.createTextNode(` ${action.label}`));
            }
            btn.addEventListener('click', e => {
              e.stopPropagation();
              if (action.onClick) {
                action.onClick(row, originalIndex);
              }
            });
            td.appendChild(btn);
          }
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);

    if (totalPages > 1) {
      wrapper.appendChild(this._renderPagination(totalPages));
    }

    this.container.innerHTML = '';
    this.container.appendChild(wrapper);

    table.querySelectorAll('th[data-sort-key]').forEach(th => {
      th.addEventListener('click', () => {
        this._toggleSort(th.dataset.sortKey);
      });
    });
  }

  _sortIcon(key) {
    const icon = document.createElement('i');
    icon.className = 'fa-solid';
    icon.style.marginLeft = '4px';
    icon.style.opacity = '0.6';
    icon.style.fontSize = '12px';
    if (this.sortKey === key) {
      icon.classList.add(this.sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
    } else {
      icon.classList.add('fa-sort');
    }
    return icon;
  }

  _toggleSort(key) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.currentPage = 1;
    this.render();
  }

  _sortedData() {
    if (!this.sortKey) {
      return [...this.data];
    }
    const key = this.sortKey;
    const dir = this.sortDir;
    return [...this.data].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      const numA = typeof av === 'number' ? av : Number(av);
      const numB = typeof bv === 'number' ? bv : Number(bv);
      if (
        typeof av !== 'object' &&
        av !== null &&
        av !== '' &&
        bv !== null &&
        bv !== '' &&
        !Number.isNaN(numA) &&
        !Number.isNaN(numB)
      ) {
        return dir === 'asc' ? numA - numB : numB - numA;
      }
      const sa = String(av ?? '').toLowerCase();
      const sb = String(bv ?? '').toLowerCase();
      if (sa < sb) {
        return dir === 'asc' ? -1 : 1;
      }
      if (sa > sb) {
        return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  _renderPagination(totalPages) {
    const pagination = document.createElement('div');
    pagination.className = 'pagination';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'pagination-btn';
    prev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prev.disabled = this.currentPage === 1;
    prev.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage -= 1;
        this.render();
      }
    });
    pagination.appendChild(prev);

    for (const page of this._pageList(totalPages)) {
      if (page === '…') {
        const span = document.createElement('span');
        span.className = 'pagination-ellipsis';
        span.textContent = '…';
        pagination.appendChild(span);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pagination-btn${page === this.currentPage ? ' pagination-btn--active' : ''}`;
        btn.textContent = String(page);
        btn.addEventListener('click', () => {
          if (page !== this.currentPage) {
            this.currentPage = page;
            this.render();
          }
        });
        pagination.appendChild(btn);
      }
    }

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'pagination-btn';
    next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    next.disabled = this.currentPage === totalPages;
    next.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage += 1;
        this.render();
      }
    });
    pagination.appendChild(next);

    return pagination;
  }

  _pageList(totalPages) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const current = this.currentPage;
    const wanted = new Set([1, totalPages, current - 1, current, current + 1]);
    const list = [];
    let prev = 0;
    for (let i = 1; i <= totalPages; i += 1) {
      if (wanted.has(i)) {
        if (prev && i - prev > 1) {
          list.push('…');
        }
        list.push(i);
        prev = i;
      }
    }
    return list;
  }
}
