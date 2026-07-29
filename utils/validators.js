'use strict';

export function required(value) {
  return value !== null && value !== undefined && value.toString().trim() !== '';
}

export function minLength(value, min) {
  return value && value.toString().length >= min;
}

export function maxLength(value, max) {
  return !value || value.toString().length <= max;
}

export function isNumber(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

export function isPositive(value) {
  return isNumber(value) && parseFloat(value) > 0;
}

export function isInteger(value) {
  return isNumber(value) && Number.isInteger(parseFloat(value));
}

export function validateProduct(product) {
  const errors = [];
  if (!required(product.name)) {
    errors.push('El nombre es obligatorio');
  }
  if (!isPositive(product.price)) {
    errors.push('El precio debe ser mayor a 0');
  }
  if (!isInteger(product.stock)) {
    errors.push('El stock debe ser un número entero');
  }
  return errors;
}

export function validateCustomer(customer) {
  const errors = [];
  if (!required(customer.name)) {
    errors.push('El nombre es obligatorio');
  }
  return errors;
}

export function validateCategory(category) {
  const errors = [];
  if (!required(category.name)) {
    errors.push('El nombre es obligatorio');
  }
  return errors;
}
