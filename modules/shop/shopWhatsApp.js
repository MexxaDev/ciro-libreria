'use strict';

import { settingRepo } from '../../db/repositories.js';
import { logger } from '../../utils/logger.js';

class ShopWhatsApp {
  async buildMessage(data, items, settings) {
    const whatsappNumber = settings.shop_whatsapp || '';

    if (!whatsappNumber) {
      throw new Error('No se configuro el numero de WhatsApp');
    }

    let message = 'Hola, quiero realizar un pedido.\n\n';
    message += 'Nombre: ' + data.firstName + ' ' + data.lastName + '\n';
    message += 'Telefono: ' + data.phone + '\n';
    message += 'Tipo: ' + (data.orderType === 'delivery' ? 'Delivery' : 'Take Away') + '\n';

    if (data.orderType === 'delivery') {
      message += '\nDireccion: ' + data.address + '\n';
      if (data.neighborhood) {
        message += 'Barrio: ' + data.neighborhood + '\n';
      }
      if (data.addressRef) {
        message += 'Referencia: ' + data.addressRef + '\n';
      }
    }

    message += '\nPedido:\n';
    items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      message += '- ' + item.name + ' x' + item.quantity + ' - $' + this.formatPrice(itemTotal) + '\n';
      if (item.note) {
        message += '  (' + item.note + ')\n';
      }
    });

    const subtotal = items.reduce((t, i) => t + i.price * i.quantity, 0);
    message += '\nSubtotal: $' + this.formatPrice(subtotal) + '\n';

    if (data.generalNote) {
      message += '\nNota:\n' + data.generalNote + '\n';
    }

    message += '\nGracias.';

    return {
      message: message,
      whatsappNumber: whatsappNumber
    };
  }

  formatPrice(price) {
    return price.toLocaleString('es-AR');
  }

  openWhatsApp(messageText, phoneNumber) {
    const encodedMessage = encodeURIComponent(messageText);
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const url = 'https://wa.me/' + cleanNumber + '?text=' + encodedMessage;
    window.open(url, '_blank');
  }

  async sendOrder(data, items) {
    try {
      const settings = await this.getSettings();
      const result = await this.buildMessage(data, items, settings);
      this.openWhatsApp(result.message, result.whatsappNumber);
      return true;
    } catch (error) {
      logger.error('ShopWhatsApp', 'Error sending WhatsApp:', error);
      throw error;
    }
  }

  async getSettings() {
    const allSettings = await settingRepo.findAll();
    const settingsObj = {};
    allSettings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    return settingsObj;
  }
}

export default new ShopWhatsApp();
