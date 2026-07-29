'use strict';

export const BRAND = {
  name: 'Syntra POS',
  shortName: 'Syntra',
  tagline: 'Sistema de Gestión Moderno',
  description: 'Sistema de gestión POS Syntra',

  logo: 'icons/favicon.svg',
  logoSmall: 'icons/favicon.svg',
  favicon: 'icons/favicon.svg',

  color: '#7C3AED',
  colorDark: '#5B21B6',

  currency: 'ARS',
  currencySymbol: '$',

  defaultTicketFooter: 'Gracias por su compra!'
};

export function getBrandLogo(className = '') {
  return `<img src="${BRAND.logo}" alt="${BRAND.name}" class="brand-logo ${className}" loading="eager">`;
}

export function getBrandLogoSvg(size = 36) {
  return `<img src="${BRAND.logoSmall}" alt="${BRAND.name}" width="${size}" height="${size}" class="brand-logo-sm" loading="eager">`;
}
