'use strict';

/**
 * Generate a deterministic color from a string
 * @param {string} str - Input string
 * @returns {string} HSL color string
 */
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 55%)`;
}

/**
 * Generate SVG placeholder image
 * @param {string} name - Product name
 * @param {string} bgColor - Background color (CSS color string)
 * @returns {string} Data URI of SVG
 */
function generatePlaceholderSVG(name, bgColor) {
  const safe = name.replace(/[<>"'&]/g, '');
  const initial = safe.charAt(0).toUpperCase();
  const truncatedName = safe.length > 15 ? safe.substring(0, 15) + '...' : safe;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="${bgColor}"/><text x="100" y="80" font-family="Inter, Arial, sans-serif" font-size="56" font-weight="600" fill="white" text-anchor="middle" dominant-baseline="middle">${initial}</text><text x="100" y="130" font-family="Inter, Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.85)" text-anchor="middle" dominant-baseline="middle">${truncatedName}</text></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Get product image or generate placeholder
 * @param {Object} product - Product object
 * @param {Array} categories - Array of category objects (optional)
 * @returns {string} Image URL or data URI
 */
function getProductImage(product, categories = []) {
  if (product.image && product.image.trim() !== '') {
    return product.image;
  }

  let bgColor = null;
  if (product.categoryId && categories.length > 0) {
    const category = categories.find(c => c.id === product.categoryId);
    if (category && category.color) {
      bgColor = category.color;
    }
  }

  if (!bgColor) {
    bgColor = stringToColor(product.name || 'Product');
  }

  return generatePlaceholderSVG(product.name || 'Product', bgColor);
}

export { stringToColor, generatePlaceholderSVG, getProductImage };
