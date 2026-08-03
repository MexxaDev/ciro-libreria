'use strict';

export const BRAND = {
  name: 'Ciro Librería Unidos',
  shortName: 'Ciro',
  tagline: 'Fotocopias · Impresiones · Diseños personalizados · Juguetería y regalería',
  description:
    'Librería, juguetería y regalería en Esperanza. Fotocopias, impresiones y diseños personalizados.',
  address: 'Perú 459 - Esperanza',
  services: [
    'Fotocopias',
    'Impresiones',
    'Diseños personalizados',
    'Juguetería y regalería'
  ],

  logo: 'icons/logo.png',
  logoSmall: 'icons/logo.png',
  favicon: 'icons/favicon.svg',

  color: '#0EA5E9',
  colorDark: '#1E3A8A',

  currency: 'ARS',
  currencySymbol: '$',

  defaultTicketFooter: 'Ciro Librería Unidos · Perú 459, Esperanza'
};

export function getBrandLogo(className = '') {
  return `<img src="${BRAND.logo}" alt="${BRAND.name}" class="brand-logo ${className}" loading="eager">`;
}

export function getBrandLogoSvg(size = 36) {
  return `<img src="${BRAND.logoSmall}" alt="${BRAND.name}" width="${size}" height="${size}" class="brand-logo-sm" loading="eager">`;
}
