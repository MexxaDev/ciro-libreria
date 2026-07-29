'use strict';

import { escapeHtml } from '../utils/sanitizer.js';

class Table {
  constructor({ columns = [], data = [], actions = [], onRowClick = null, pageSize = 0 }) {
    this.columns = columns;
    this.data = data;
    this.actions = actions;
    this.onRowClick = onRowClick;
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.highlightedIndex = -1;
    this.element = null;
  }

  get totalPages() {
    if (!this.pageSize) {
      return 1;
    }
    return Math.max(1, Math.ceil(this.data.length / this.pageSize));
  }

  get _pageData() {
    if (!this.pageSize) {
      return this.data;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    return this.data.slice(start, start + this.pageSize);
  }

  _renderPagination() {
    if (!this.pageSize || this.totalPages <= 1) {
      return '';
    }

    const buildBtn = (page, label = page, cls = '') => `
      <button class="pagination-btn ${cls}${page === this.currentPage ? ' pagination-btn--active' : ''}" data-page="${page}">
        ${label}
      </button>
    `;

    let pages = '';
    const tp = this.totalPages;
    const cp = this.currentPage;

    if (tp <= 7) {
      for (let i = 1; i <= tp; i++) {
        pages += buildBtn(i);
      }
    } else {
      pages += buildBtn(1);
      if (cp > 3) {
        pages += '<span class="pagination-ellipsis">...</span>';
      }
      const start = Math.max(2, cp - 1);
      const end = Math.min(tp - 1, cp + 1);
      for (let i = start; i <= end; i++) {
        pages += buildBtn(i);
      }
      if (cp < tp - 2) {
        pages += '<span class="pagination-ellipsis">...</span>';
      }
      pages += buildBtn(tp);
    }

    return `
      <div class="pagination">
        ${buildBtn(cp - 1, '‹', 'pagination-btn--prev')}
        ${pages}
        ${buildBtn(cp + 1, '›', 'pagination-btn--next')}
      </div>
    `;
  }

  render() {
    if (this.data.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fa-solid fa-inbox"></i></div>
          <h3 class="empty-state__title">No hay datos</h3>
          <p class="empty-state__description">No se encontraron registros.</p>
        </div>
      `;
    }

    const rows = this._pageData;
    const offset = this.pageSize ? (this.currentPage - 1) * this.pageSize : 0;

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              ${this.columns.map(col => `<th>${col.label}</th>`).join('')}
              ${this.actions.length ? '<th>Acciones</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row, i) => {
                const globalIdx = offset + i;
                const rowClass = globalIdx === this.highlightedIndex ? ' class="table-row--highlighted"' : '';
                return `
                <tr${rowClass} ${this.onRowClick ? `data-row-index="${globalIdx}"` : ''}>
                  ${this.columns
                    .map(
                      col => `
                    <td>
                      ${col.format ? col.format(row[col.key], row) : escapeHtml(String(row[col.key] ?? '-'))}
                    </td>
                  `
                    )
                    .join('')}
                  ${
                    this.actions.length
                      ? `
                    <td>
                      <div class="flex gap-2">
                        ${this.actions
                          .map(
                            action => `
                          <button class="btn btn-sm ${action.class || 'btn-ghost'}" data-action="${action.name}" data-row-index="${globalIdx}">
                            ${action.icon ? `<i class="${action.icon}"></i>` : ''} ${action.label || ''}
                          </button>
                        `
                          )
                          .join('')}
                      </div>
                    </td>
                  `
                      : ''
                  }
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
      ${this._renderPagination()}
    `;
  }

  mount(container) {
    this.element = container;
    container.innerHTML = this.render();

    if (this.onRowClick) {
      container.querySelectorAll('tbody tr').forEach(tr => {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
          const index = parseInt(tr.dataset.rowIndex);
          this.onRowClick(this.data[index], index);
        });
      });
    }

    if (this.actions.length) {
      container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const actionName = btn.dataset.action;
          const index = parseInt(btn.dataset.rowIndex);
          const action = this.actions.find(a => a.name === actionName);
          if (action && action.onClick) {
            action.onClick(this.data[index], index);
          }
        });
      });
    }

    this._mountPagination();
  }

  _mountPagination() {
    if (!this.pageSize || this.totalPages <= 1) {
      return;
    }
    const container = this.element.querySelector('.pagination');
    if (!container) {
      return;
    }
    container.addEventListener('click', e => {
      const btn = e.target.closest('.pagination-btn');
      if (!btn) {
        return;
      }
      e.stopPropagation();
      const page = parseInt(btn.dataset.page);
      if (!page || page < 1 || page > this.totalPages) {
        return;
      }
      this.setPage(page);
    });
  }

  setPage(n) {
    if (n < 1 || n > this.totalPages || n === this.currentPage) {
      return;
    }
    this.currentPage = n;
    if (this.element) {
      this.mount(this.element);
    }
  }

  update(data) {
    this.data = data;
    this.currentPage = 1;
    this.highlightedIndex = -1;
    if (this.element) {
      this.mount(this.element);
    }
  }

  highlightRow(index) {
    this.highlightedIndex = index;
    if (this.pageSize) {
      this.currentPage = Math.floor(index / this.pageSize) + 1;
    }
    if (this.element) {
      this.mount(this.element);
    }
  }
}

export default Table;
