'use strict';

import state from '../js/state.js';

export function format(amount) {
  const settings = state.get('settings') || {};
  const symbol = settings.currencySymbol || '$';
  return `${symbol} ${Number(amount).toFixed(2)}`;
}

export function parse(value) {
  return parseFloat(value.toString().replace(/[^\d.-]/g, '')) || 0;
}
