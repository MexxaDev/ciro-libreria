'use strict';

import { categoryRepo, productRepo } from '../../db/repositories.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import { validateCategory } from '../../utils/validators.js';
import { escapeHtml } from '../../utils/sanitizer.js';
import { logger } from '../../utils/logger.js';
import state from '../../js/state.js';

class Categories {
  constructor() {
    this.categories = [];
  }

  async load() {
    const container = document.getElementById('categories-list');
    if (container) {
      container.innerHTML =
        '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando categorías...</div>';
    }
    try {
      this.categories = await categoryRepo.findAll();
      this.render();
    } catch (error) {
      logger.error('Categories', 'Error loading categories:', error);
      Toast.error('Error', 'No se pudieron cargar las categorías');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h3 class="empty-state__title">Error al cargar</h3>
            <p class="empty-state__description">No se pudieron cargar las categorías.</p>
            <button class="btn btn-sm btn-primary" id="retry-categories">Reintentar</button>
          </div>
        `;
        document.getElementById('retry-categories')?.addEventListener('click', () => this.load());
      }
    }
  }

  render() {
    const container = document.getElementById('categories-list');
    if (!container) {
      return;
    }

    if (this.categories.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fa-solid fa-folder"></i></div>
          <h3 class="empty-state__title">No hay categorías</h3>
          <p class="empty-state__description">Agregá tu primera categoría.</p>
          <button class="btn btn-primary" id="add-first-category">+ Nueva Categoría</button>
        </div>
      `;
      document.getElementById('add-first-category')?.addEventListener('click', () => this.openModal());
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Color</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${this.categories
              .map(
                (cat, index) => `
              <tr>
                <td>${escapeHtml(cat.name)}</td>
                <td>${escapeHtml(cat.description || '-')}</td>
                <td>
                  <span style="display:inline-block;width:16px;height:16px;background:${cat.color};border-radius:4px;"></span>
                </td>
                <td>
                  <div class="flex gap-2">
                    <button class="btn btn-sm btn-ghost" data-action="edit" data-index="${index}">Editar</button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-index="${index}">Eliminar</button>
                  </div>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        this.editCategory(this.categories[index]);
      });
    });

    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        this.deleteCategory(this.categories[index].id);
      });
    });
  }

  openModal(category = null) {
    const isEdit = !!category;
    const title = isEdit ? 'Editar Categoría' : 'Nueva Categoría';

    const body = `
      <div class="form-group">
        <label class="form-label">Nombre</label>
        <input type="text" class="form-input" id="cat-name" value="${escapeHtml(category ? category.name : '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <input type="text" class="form-input" id="cat-desc" value="${escapeHtml(category ? category.description : '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <input type="color" class="form-input" id="cat-color" value="${category ? category.color : '#7C3AED'}">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="cat-cancel">Cancelar</button>
      <button class="btn btn-primary" id="cat-save">Guardar</button>
    `;

    Modal.show({
      title,
      body,
      footer,
      onClose: () => {}
    });

    document.getElementById('cat-cancel').addEventListener('click', () => Modal.close());

    document.getElementById('cat-save').addEventListener('click', async () => {
      const name = document.getElementById('cat-name').value;
      const description = document.getElementById('cat-desc').value;
      const color = document.getElementById('cat-color').value;

      const errors = validateCategory({ name });
      if (errors.length) {
        Toast.error('Error', errors[0]);
        return;
      }

      try {
        if (isEdit) {
          await categoryRepo.update({ ...category, name, description, color });
          Toast.success('Éxito', 'Categoría actualizada');
        } else {
          await categoryRepo.create({ id: `cat_${Date.now()}`, name, description, color });
          Toast.success('Éxito', 'Categoría creada');
        }
        Modal.close();
        state.emit('data:categories-changed');
        this.load();
      } catch (error) {
        Toast.error('Error', 'No se pudo guardar la categoría');
      }
    });
  }

  editCategory(category) {
    this.openModal(category);
  }

  async deleteCategory(id) {
    const products = await productRepo.query('categoryId', id);
    const hasProducts = products && products.length > 0;

    const body = hasProducts
      ? `<p>¿Estás seguro de eliminar esta categoría?</p><p style="color:var(--color-warning);font-size:var(--text-sm);margin-top:var(--space-2);"><i class="fa-solid fa-triangle-exclamation"></i> Hay ${products.length} producto(s) en esta categoría. Quedarán como "Sin categoría".</p>`
      : '<p>¿Estás seguro de eliminar esta categoría?</p>';

    Modal.show({
      title: 'Confirmar Eliminación',
      body,
      footer: `
        <button class="btn btn-secondary" id="cancel-del-cat">Cancelar</button>
        <button class="btn btn-danger" id="confirm-del-cat">Eliminar</button>
      `
    });
    document.getElementById('cancel-del-cat')?.addEventListener('click', () => Modal.close());
    document.getElementById('confirm-del-cat')?.addEventListener('click', async () => {
      try {
        const products = await productRepo.query('categoryId', id);
        for (const product of products || []) {
          await productRepo.update({ ...product, categoryId: null });
        }
        await categoryRepo.delete(id);
        Toast.success('Éxito', 'Categoría eliminada');
        Modal.close();
        state.emit('data:categories-changed');
        state.emit('data:products-changed');
        this.load();
      } catch (error) {
        Toast.error('Error', 'No se pudo eliminar la categoría');
      }
    });
  }
}

export default new Categories();
