'use strict';

import { notificationRepo } from '../db/repositories.js';
import { escapeHtml } from '../utils/sanitizer.js';
import { logger } from '../utils/logger.js';

class Notification {
  static container = null;

  static init() {
    if (this.container) {
      return;
    }

    this.container = document.createElement('div');
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
  }

  static async create({ title, message, type = 'info', userId = null }) {
    const notification = {
      id: `notif_${Date.now()}`,
      title,
      message,
      type,
      userId,
      read: false,
      date: new Date().toISOString()
    };

    try {
      await notificationRepo.create(notification);
      this.showToast(notification);
      return notification;
    } catch (error) {
      logger.error('Notification', 'Error creating notification', error);
    }
  }

  static showToast(notification) {
    const toast = document.createElement('div');
    toast.className = `notification-toast notification-toast--${notification.type}`;

    toast.innerHTML = `
      <div class="notification-toast__header">
        <div>
          <div class="notification-toast__title">${escapeHtml(notification.title)}</div>
          <div class="notification-toast__message">${escapeHtml(notification.message)}</div>
        </div>
        <button class="notification-toast__close" aria-label="Cerrar notificación">\u00d7</button>
      </div>
    `;

    toast.querySelector('.notification-toast__close').addEventListener('click', () => toast.remove());

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  static async getAll(limit = 50) {
    const notifications = await notificationRepo.findAll();
    return notifications.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
  }

  static async markAsRead(id) {
    const notification = await notificationRepo.findById(id);
    if (notification) {
      notification.read = true;
      await notificationRepo.update(notification);
    }
  }

  static async getUnreadCount() {
    const notifications = await notificationRepo.findAll();
    return notifications.filter(n => !n.read).length;
  }
}

export default Notification;
