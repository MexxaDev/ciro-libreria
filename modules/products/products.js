'use strict';

import { productRepo, categoryRepo, saleItemRepo } from '../../db/repositories.js';
import db from '../../db/indexeddb.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import { validateProduct } from '../../utils/validators.js';
import Table from '../../components/table.js';
import { escapeHtml } from '../../utils/sanitizer.js';
import { logger } from '../../utils/logger.js';
import { findProductsByQuery } from '../../utils/productSearch.js';
import state from '../../js/state.js';

class Products {
  constructor() {
    this.products = [];
    this.categories = [];
    this.table = null;
  }

  async load() {
    const container = document.getElementById('product-list');
    if (container) {
      container.innerHTML =
        '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando productos...</div>';
    }
    try {
      this.products = await productRepo.findAll();
      this.categories = await categoryRepo.findAll();
      this.render();
      this._setupDataListeners();
    } catch (err) {
      logger.error('Products', 'Error loading products:', err);
      if (container) {
        container.innerHTML =
          '<div class="empty-state"><div class="empty-state__icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h3 class="empty-state__title">Error al cargar</h3><p class="empty-state__description">No se pudieron cargar los productos. <button class="btn btn-sm btn-primary" data-action="retry-products">Reintentar</button></p></div>';
        container.querySelector('[data-action="retry-products"]')?.addEventListener('click', () => this.load());
      }
    }
  }

  _setupDataListeners() {
    if (this._listenersAttached) {
      return;
    }
    this._listenersAttached = true;

    state.on('data:categories-changed', async () => {
      this.categories = await categoryRepo.findAll();
      this.render();
    });
  }

  searchBarcode(query) {
    const term = (query || '').trim();
    if (!term) {
      this.render();
      return;
    }

    const matches = findProductsByQuery(this.products, term);
    if (matches.length > 0) {
      this.render(matches);
      return;
    }

    const isNumeric = /^\d+$/.test(term);
    const prefill = isNumeric ? { barcode: term } : { name: term };
    const body = `
      <div style="text-align:center;padding:var(--space-4) 0;">
        <i class="fa-solid fa-magnifying-glass" style="font-size:48px;color:var(--color-text-muted);margin-bottom:var(--space-3);display:block;"></i>
        <p style="font-size:var(--text-lg);font-weight:var(--font-medium);margin-bottom:var(--space-2);">No se encontró el artículo</p>
        <p style="color:var(--color-text-secondary);margin-bottom:var(--space-3);">Búsqueda: <strong>${escapeHtml(term)}</strong></p>
        <p>¿Desea cargarlo?</p>
      </div>
    `;
    const footer = `
      <button class="btn btn-secondary" id="barcode-notfound-cancel">No</button>
      <button class="btn btn-primary" id="barcode-notfound-create">Sí, Cargar Artículo</button>
    `;

    Modal.show({ title: 'Producto no encontrado', body, footer });

    document.getElementById('barcode-notfound-cancel').addEventListener('click', () => Modal.close());
    document.getElementById('barcode-notfound-create').addEventListener('click', () => {
      Modal.close();
      this.openModal(null, prefill);
    });
  }

  searchLive(query) {
    const term = (query || '').trim();
    if (!term) {
      this.render();
      return;
    }

    const matches = findProductsByQuery(this.products, term);
    if (matches.length > 0) {
      this.render(matches);
      return;
    }

    const container = document.getElementById('product-list');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fa-solid fa-magnifying-glass"></i></div>
          <h3 class="empty-state__title">Sin resultados</h3>
          <p class="empty-state__description">No se encontró ningún artículo para "<strong>${escapeHtml(term)}</strong>".</p>
        </div>
      `;
    }
  }

  exportProducts() {
    const json = JSON.stringify(this.products, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productos-${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('Éxito', 'Productos exportados correctamente');
  }

  importProducts(file) {
    const reader = new FileReader();
    reader.onload = async e => {
      let imported;
      try {
        imported = JSON.parse(e.target.result);
      } catch {
        Toast.error('Error', 'El archivo JSON no es válido');
        return;
      }

      if (!Array.isArray(imported)) {
        Toast.error('Error', 'El archivo no contiene una lista de productos');
        return;
      }

      if (imported.length > 0 && (!imported[0].name || imported[0].price === undefined)) {
        Toast.error('Error', 'El archivo no tiene el formato de productos esperado');
        return;
      }

      const body = `
        <p>Se importarán <strong>${imported.length}</strong> productos.</p>
        <p style="color:var(--color-warning);font-size:var(--text-sm);margin-top:var(--space-2);">
          <i class="fa-solid fa-triangle-exclamation"></i>
          Todos los productos actuales serán reemplazados.
        </p>
      `;
      const footer = `
        <button class="btn btn-secondary" id="import-cancel">Cancelar</button>
        <button class="btn btn-danger" id="import-confirm">Reemplazar Productos</button>
      `;

      Modal.show({ title: 'Importar Productos', body, footer });

      document.getElementById('import-cancel').addEventListener('click', () => Modal.close());
      document.getElementById('import-confirm').addEventListener('click', async () => {
        Modal.close();
        try {
          await db.clear('products');
          await productRepo.saveAll(imported);
          Toast.success('Éxito', `${imported.length} productos importados`);
          state.emit('data:products-changed');
          this.load();
        } catch (error) {
          logger.error('Products', 'Error importing products:', error);
          Toast.error('Error', 'No se pudieron importar los productos');
        }
      });
    };
    reader.readAsText(file);
  }

  render(list = this.products) {
    const container = document.getElementById('product-list');
    if (!container) {
      return;
    }

    if (this.products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fa-solid fa-box-open"></i></div>
          <h3 class="empty-state__title">No hay productos</h3>
          <p class="empty-state__description">Comenzá agregando tu primer producto.</p>
          <button class="btn btn-primary" id="add-first-product">+ Nuevo Producto</button>
        </div>
      `;
      document.getElementById('add-first-product')?.addEventListener('click', () => this.openModal());
      return;
    }

    const columns = [
      { key: 'name', label: 'Nombre' },
      {
        key: 'price',
        label: 'Precio',
        format: (val, row) => {
          if (row.variablePrice) {
            return `<span style="color:var(--color-text-muted);font-style:italic;">$${val}</span> <span class="badge badge-sm badge-warning">Variable</span>`;
          }
          return `$${val}`;
        }
      },
      { key: 'stock', label: 'Stock' },
      {
        key: 'categoryId',
        label: 'Categoría',
        format: val => {
          const cat = this.categories.find(c => c.id === val);
          return cat ? cat.name : 'Sin categoría';
        }
      },
      {
        key: 'barcode',
        label: 'Código',
        format: (val, row) => {
          let html = escapeHtml(val || '');
          if (row.barcodes_extra) {
            try {
              const extras = JSON.parse(row.barcodes_extra);
              if (extras.length) {
                html += ` <span class="badge badge-sm badge-secondary">+${extras.length}</span>`;
              }
            } catch {
              /* ignore */
            }
          }
          return html;
        }
      }
    ];

    const actions = [
      { name: 'edit', label: 'Editar', class: 'btn-ghost', icon: 'fa-solid fa-pen' },
      { name: 'adjust-stock', label: 'Stock', class: 'btn-ghost', icon: 'fa-solid fa-boxes-stacked' },
      { name: 'delete', label: 'Eliminar', class: 'btn-danger', icon: 'fa-solid fa-trash' }
    ];

    this.table = new Table({
      columns,
      data: list,
      actions,
      onRowClick: product => this.openModal(product),
      pageSize: 20
    });

    container.innerHTML = '';
    this.table.mount(container);

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.rowIndex);
        this.openModal(list[index]);
      });
    });

    container.querySelectorAll('[data-action="adjust-stock"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.rowIndex);
        this.openStockAdjustModal(list[index]);
      });
    });

    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.rowIndex);
        const product = list[index];

        let hasSales = false;
        try {
          const saleItems = await saleItemRepo.query('productId', product.id);
          hasSales = saleItems && saleItems.length > 0;
        } catch (error) {
          logger.error('Products', 'Error checking sales history:', error);
        }

        const body = hasSales
          ? `<p>El producto "${product.name}" tiene ventas históricas.</p><p style="color:var(--color-warning);font-size:var(--text-sm);margin-top:var(--space-2);"><i class="fa-solid fa-triangle-exclamation"></i> ¿Querés marcarlo como inactivo en lugar de eliminarlo?</p>`
          : `<p>¿Estás seguro de eliminar el producto "${product.name}"?</p>`;

        const footer = `
          <button class="btn btn-secondary" id="cancel-delete">Cancelar</button>
          ${
            hasSales
              ? '<button class="btn btn-warning" id="confirm-soft-delete">Marcar Inactivo</button>'
              : '<button class="btn btn-danger" id="confirm-delete">Eliminar</button>'
          }
        `;

        Modal.show({ title: 'Confirmar Eliminación', body, footer });

        requestAnimationFrame(() => {
          document.getElementById('cancel-delete')?.addEventListener('click', () => Modal.close());

          if (hasSales) {
            document.getElementById('confirm-soft-delete')?.addEventListener('click', async () => {
              try {
                await productRepo.update({ ...product, visible: false, inactive: true });
                Toast.success('Éxito', 'Producto marcado como inactivo');
                Modal.close();
                state.emit('data:products-changed');
                this.load();
              } catch (error) {
                Toast.error('Error', 'No se pudo actualizar el producto');
              }
            });
          } else {
            document.getElementById('confirm-delete')?.addEventListener('click', async () => {
              try {
                await productRepo.delete(product.id);
                Toast.success('Éxito', 'Producto eliminado');
                Modal.close();
                state.emit('data:products-changed');
                this.load();
              } catch (error) {
                Toast.error('Error', 'No se pudo eliminar el producto');
              }
            });
          }
        });
      });
    });
  }

  resizeImage(file, maxWidth, maxHeight) {
    return new Promise((resolve, _reject) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = e => {
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  openStockAdjustModal(product) {
    const body = `
      <div style="margin-bottom:var(--space-3);">
        <strong>${escapeHtml(product.name)}</strong><br>
        <span style="color:var(--color-text-secondary);font-size:var(--text-sm);">Stock actual: ${product.stock}</span>
      </div>
      <div class="form-group">
        <label class="form-label">Cantidad (positivo = ingreso, negativo = egreso)</label>
        <input type="number" class="form-input" id="stock-adjust-qty" step="1" placeholder="Ej: 10 o -5">
      </div>
      <div class="form-group">
        <label class="form-label">Motivo</label>
        <input type="text" class="form-input" id="stock-adjust-reason" placeholder="Ej: Inventario fisico, merma, devolución">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="stock-adjust-cancel">Cancelar</button>
      <button class="btn btn-primary" id="stock-adjust-save">Aplicar</button>
    `;

    Modal.show({ title: 'Ajustar Stock', body, footer });

    document.getElementById('stock-adjust-cancel').addEventListener('click', () => Modal.close());

    document.getElementById('stock-adjust-save').addEventListener('click', async () => {
      const qty = parseInt(document.getElementById('stock-adjust-qty').value);
      const reason = document.getElementById('stock-adjust-reason').value.trim();

      if (isNaN(qty) || qty === 0) {
        Toast.error('Error', 'Ingresá una cantidad válida');
        return;
      }

      const newStock = product.stock + qty;
      if (newStock < 0) {
        Toast.error('Error', `El stock no puede ser negativo (actual: ${product.stock})`);
        return;
      }

      try {
        await productRepo.update({ ...product, stock: newStock });
        Toast.success('Éxito', `Stock actualizado: ${product.stock} → ${newStock}${reason ? ` (${reason})` : ''}`);
        Modal.close();
        this.load();
      } catch (error) {
        logger.error('Products', 'Error adjusting stock:', error);
        Toast.error('Error', 'No se pudo ajustar el stock');
      }
    });
  }

  openModal(product = null, prefill = {}) {
    const isEdit = !!product;
    const title = isEdit ? 'Editar Producto' : 'Nuevo Producto';

    const categoryOptions = this.categories
      .map(
        cat =>
          `<option value="${escapeHtml(cat.id)}" ${product && product.categoryId === cat.id ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`
      )
      .join('');

    const extraBarcodes =
      product && product.barcodes_extra
        ? (() => {
            try {
              return JSON.parse(product.barcodes_extra);
            } catch {
              return [];
            }
          })()
        : [];
    const b2 = escapeHtml(extraBarcodes[0] || '');
    const b3 = escapeHtml(extraBarcodes[1] || '');
    const b4 = escapeHtml(extraBarcodes[2] || '');

    const body = `
      <div class="form-group">
        <label class="form-label" for="prod-name">Nombre</label>
        <input type="text" class="form-input" id="prod-name" value="${product ? escapeHtml(product.name) : escapeHtml(prefill.name || '')}" required>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="form-group">
          <label class="form-label" for="prod-price">Precio</label>
          <input type="number" class="form-input" id="prod-price" value="${product ? product.price : ''}" min="0" step="0.01" required>
          <div style="margin-top:var(--space-2);">
            <label class="form-label" style="display:flex;align-items:center;gap:var(--space-2);font-weight:var(--font-normal);cursor:pointer;">
              <input type="checkbox" id="prod-variable-price" ${product && product.variablePrice ? 'checked' : ''}>
              Precio variable (se define al vender)
              <span style="color:var(--color-text-muted);font-size:var(--text-xs);cursor:help;" title="Para productos cuyo precio cambia según el cliente o situación. En el POS el precio será editable.">
                <i class="fa-solid fa-circle-question"></i>
              </span>
            </label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="prod-stock">Stock</label>
          <input type="number" class="form-input" id="prod-stock" value="${product ? product.stock : ''}" min="0" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="prod-category">Categoría</label>
        <select class="form-input form-select" id="prod-category">
          <option value="">Sin categoría</option>
          ${categoryOptions}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="form-group">
          <label class="form-label" for="prod-barcode">Código de barras principal</label>
          <input type="text" class="form-input" id="prod-barcode" value="${product ? escapeHtml(product.barcode || '') : escapeHtml(prefill.barcode || '')}">
        </div>
        <div class="form-group">
          <label class="form-label" for="prod-sku">SKU</label>
          <input type="text" class="form-input" id="prod-sku" value="${product ? escapeHtml(product.sku || '') : escapeHtml(prefill.sku || '')}">
        </div>
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div class="form-group">
          <label class="form-label" for="prod-barcode2">Código 2</label>
          <input type="text" class="form-input" id="prod-barcode2" value="${b2}">
        </div>
        <div class="form-group">
          <label class="form-label" for="prod-barcode3">Código 3</label>
          <input type="text" class="form-input" id="prod-barcode3" value="${b3}">
        </div>
        <div class="form-group">
          <label class="form-label" for="prod-barcode4">Código 4</label>
          <input type="text" class="form-input" id="prod-barcode4" value="${b4}">
        </div>
      </div>
        <div class="form-group">
          <label class="form-label">Visible</label>
          <input type="checkbox" id="prod-visible" ${product ? (product.visible ? 'checked' : '') : 'checked'}>
        </div>
        <div class="form-group">
          <label class="form-label">Visible en Web (Shop)</label>
          <input type="checkbox" id="prod-visible-web" ${product ? (product.visible_web ? 'checked' : '') : ''}>
        </div>
        <div class="form-group">
          <label class="form-label" for="prod-price-web">Precio Web (opcional)</label>
          <input type="number" class="form-input" id="prod-price-web" value="${product ? product.price_web || '' : ''}" min="0" step="0.01" placeholder="Dejar vacío para usar precio normal">
        </div>
        <div class="form-group">
          <label class="form-label" for="prod-description">Descripción Corta</label>
          <textarea class="form-input" id="prod-description" rows="2" placeholder="Descripción para el catálogo online">${product ? escapeHtml(product.description || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Imagen</label>
        <input type="file" id="prod-image" accept="image/*" style="padding:var(--space-2);font-size:var(--text-sm);">
        ${product && product.image ? `<div style="margin-top:var(--space-2);"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name || '')}" class="product-preview-img"></div>` : ''}
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="prod-cancel">Cancelar</button>
      <button class="btn btn-primary" id="prod-save">Guardar</button>
    `;

    Modal.show({ title, body, footer });

    document.getElementById('prod-cancel').addEventListener('click', () => Modal.close());

    document.getElementById('prod-save').addEventListener('click', async () => {
      const name = document.getElementById('prod-name').value;
      const price = parseFloat(document.getElementById('prod-price').value);
      const stock = parseInt(document.getElementById('prod-stock').value);
      const categoryId = document.getElementById('prod-category').value || null;
      const barcode = document.getElementById('prod-barcode').value;
      const barcode2 = document.getElementById('prod-barcode2').value;
      const barcode3 = document.getElementById('prod-barcode3').value;
      const barcode4 = document.getElementById('prod-barcode4').value;
      const sku = document.getElementById('prod-sku').value;
      const visible = document.getElementById('prod-visible').checked;
      const visibleWeb = document.getElementById('prod-visible-web').checked;
      const variablePrice = document.getElementById('prod-variable-price').checked;
      const priceWeb = document.getElementById('prod-price-web').value;
      const description = document.getElementById('prod-description').value;
      const imageInput = document.getElementById('prod-image');

      const errors = validateProduct({ name, price, stock });
      if (errors.length) {
        Toast.error('Error', errors[0]);
        return;
      }

      const allBarcodes = [barcode, barcode2, barcode3, barcode4].filter(Boolean);
      if (new Set(allBarcodes).size !== allBarcodes.length) {
        Toast.error('Error', 'Los códigos de barras ingresados se repiten');
        return;
      }

      if (allBarcodes.length) {
        const conflict = this.products.some(p => {
          if (isEdit && p.id === product.id) {
            return false;
          }
          if (p.barcode && allBarcodes.includes(p.barcode)) {
            return true;
          }
          if (p.barcodes_extra) {
            try {
              return JSON.parse(p.barcodes_extra).some(e => allBarcodes.includes(e));
            } catch {
              return false;
            }
          }
          return false;
        });
        if (conflict) {
          Toast.error('Error', 'Uno de los códigos ya está en uso por otro producto');
          return;
        }
      }

      const extras = [barcode2, barcode3, barcode4].filter(Boolean);

      let imageData = product ? product.image : '';
      if (imageInput.files && imageInput.files[0]) {
        imageData = await this.resizeImage(imageInput.files[0], 200, 200);
      }

      const productData = {
        name,
        price,
        stock,
        categoryId,
        barcode,
        barcodes_extra: extras.length ? JSON.stringify(extras) : '',
        sku,
        visible,
        visible_web: visibleWeb,
        variablePrice: !!variablePrice,
        price_web: priceWeb ? parseFloat(priceWeb) : null,
        description: description || '',
        image: imageData
      };

      try {
        if (isEdit) {
          await productRepo.update({ ...product, ...productData });
          Toast.success('Éxito', 'Producto actualizado');
        } else {
          await productRepo.create({ ...productData, id: `prod_${Date.now().toString(36)}` });
          Toast.success('Éxito', 'Producto creado');
        }
        Modal.close();
        state.emit('data:products-changed');
        this.load();
      } catch (error) {
        Toast.error('Error', 'No se pudo guardar el producto');
      }
    });
  }
}

export default new Products();
