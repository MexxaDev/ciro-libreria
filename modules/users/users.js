'use strict';

import { userRepo } from '../../db/repositories.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import { escapeHtml } from '../../utils/sanitizer.js';
import { hashPassword } from '../../utils/hash.js';
import { logger } from '../../utils/logger.js';
import state from '../../js/state.js';

class Users {
  constructor() {
    this.users = [];
  }

  async load() {
    const container = document.getElementById('users-content');
    if (container) {
      container.innerHTML =
        '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando usuarios...</div>';
    }
    try {
      this.users = await userRepo.findAll();
      this.render();
    } catch (error) {
      logger.error('Users', 'Error loading users:', error);
      Toast.error('Error', 'No se pudieron cargar los usuarios');
    }
  }

  render() {
    const container = document.getElementById('users-content');
    if (!container) {
      return;
    }

    if (this.users.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fa-solid fa-users"></i></div>
          <h3 class="empty-state__title">No hay usuarios</h3>
          <p class="empty-state__description">Creá tu primer usuario.</p>
          <button class="btn btn-primary" id="add-first-user">+ Nuevo Usuario</button>
        </div>
      `;
      document.getElementById('add-first-user')?.addEventListener('click', () => this.openModal());
      return;
    }

    const currentUser = state.get('currentUser');

    let html = `
      <div class="products-toolbar">
        <div class="products-search">
          <input type="text" class="form-input" placeholder="Buscar usuarios..." id="user-search">
        </div>
        <button class="btn btn-primary" id="add-user-btn">+ Nuevo Usuario</button>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    this.users.forEach((user, index) => {
      const isCurrentUser = currentUser && user.id === currentUser.id;
      const roleLabel = user.role === 'admin' ? 'Administrador' : 'Cajero';
      html += `
        <tr data-index="${index}">
          <td>${escapeHtml(user.name)}</td>
          <td>${escapeHtml(user.username)}</td>
          <td><span class="badge badge-${user.role === 'admin' ? 'primary' : 'secondary'}">${roleLabel}</span></td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-ghost" data-action="edit" data-index="${index}">Editar</button>
              ${!isCurrentUser ? `<button class="btn btn-sm btn-danger" data-action="delete" data-index="${index}">Eliminar</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;

    document.getElementById('add-user-btn')?.addEventListener('click', () => this.openModal());
    document.getElementById('user-search')?.addEventListener('input', e => this.search(e.target.value));

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index);
        const user = this.users[index];

        if (action === 'edit') {
          this.openModal(user);
        } else if (action === 'delete') {
          this.deleteUser(user.id);
        }
      });
    });
  }

  search(query) {
    if (!query) {
      this.render();
      return;
    }
    const filtered = this.users.filter(
      u => u.name.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase())
    );
    const prevData = this.users;
    this.users = filtered;
    this.render();
    this.users = prevData;
  }

  openModal(user = null) {
    const isEdit = !!user;
    const title = isEdit ? 'Editar Usuario' : 'Nuevo Usuario';

    const body = `
      <div class="form-group">
        <label class="form-label">Nombre completo</label>
        <input type="text" class="form-input" id="user-name" value="${escapeHtml(user ? user.name : '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Nombre de usuario</label>
        <input type="text" class="form-input" id="user-username" value="${escapeHtml(user ? user.username : '')}" ${isEdit ? 'disabled' : ''} required>
      </div>
      <div class="form-group">
        <label class="form-label">${isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</label>
        <input type="password" class="form-input" id="user-password" ${isEdit ? '' : 'required'}>
      </div>
      <div class="form-group">
        <label class="form-label">Rol</label>
        <select class="form-input" id="user-role">
          <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Administrador</option>
          <option value="cajero" ${user && user.role === 'cajero' ? 'selected' : ''}>Cajero</option>
        </select>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="user-cancel">Cancelar</button>
      <button class="btn btn-primary" id="user-save">Guardar</button>
    `;

    Modal.show({ title, body, footer });

    document.getElementById('user-cancel')?.addEventListener('click', () => Modal.close());

    document.getElementById('user-save')?.addEventListener('click', async () => {
      const name = document.getElementById('user-name').value.trim();
      const username = document.getElementById('user-username').value.trim();
      const password = document.getElementById('user-password').value;
      const role = document.getElementById('user-role').value;

      if (!name) {
        Toast.error('Error', 'El nombre es obligatorio');
        return;
      }
      if (!isEdit && !username) {
        Toast.error('Error', 'El nombre de usuario es obligatorio');
        return;
      }
      if (!isEdit && !password) {
        Toast.error('Error', 'La contraseña es obligatoria');
        return;
      }
      if (!isEdit) {
        const exists = this.users.find(u => u.username === username);
        if (exists) {
          Toast.error('Error', 'Ya existe un usuario con ese nombre de usuario');
          return;
        }
      }

      try {
        if (isEdit) {
          const updated = { ...user, name, role };
          if (password) {
            updated.password = await hashPassword(password);
          }
          await userRepo.update(updated);
          Toast.success('Éxito', 'Usuario actualizado');
        } else {
          await userRepo.create({
            id: `user_${Date.now()}`,
            name,
            username,
            password: await hashPassword(password),
            role,
            createdAt: new Date().toISOString()
          });
          Toast.success('Éxito', 'Usuario creado');
        }
        Modal.close();
        state.emit('data:users-changed');
        this.load();
      } catch (error) {
        logger.error('Users', 'Error saving user:', error);
        Toast.error('Error', 'No se pudo guardar el usuario');
      }
    });
  }

  async deleteUser(id) {
    const currentUser = state.get('currentUser');
    if (currentUser && currentUser.id === id) {
      Toast.error('Error', 'No podés eliminar tu propio usuario');
      return;
    }

    Modal.show({
      title: 'Confirmar Eliminación',
      body: '<p>¿Estás seguro de eliminar este usuario?</p>',
      footer: `
        <button class="btn btn-secondary" id="cancel-del-user">Cancelar</button>
        <button class="btn btn-danger" id="confirm-del-user">Eliminar</button>
      `
    });
    document.getElementById('cancel-del-user')?.addEventListener('click', () => Modal.close());
    document.getElementById('confirm-del-user')?.addEventListener('click', async () => {
      try {
        await userRepo.delete(id);
        Toast.success('Éxito', 'Usuario eliminado');
        Modal.close();
        state.emit('data:users-changed');
        this.load();
      } catch (error) {
        logger.error('Users', 'Error deleting user:', error);
        Toast.error('Error', 'No se pudo eliminar el usuario');
      }
    });
  }
}

export default new Users();
