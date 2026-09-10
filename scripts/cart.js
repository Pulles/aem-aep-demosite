/**
 * Mock cart for the Heineken 0.0 Silverstone GP demo site.
 * No real checkout — client-side only, for demonstrating AEP commerce
 * event tracking (add-to-cart, checkout, purchase).
 */
const STORAGE_KEY = 'heineken-demo-cart';

/**
 * @returns {Array<{ sku: string, name: string, price: number, quantity: number }>}
 */
export function getCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('cartchange', { detail: items }));
  return items;
}

/**
 * @param {{ sku: string, name: string, price: number, quantity?: number }} item
 */
export function addToCart(item) {
  const items = getCart();
  const existing = items.find((i) => i.sku === item.sku);
  if (existing) {
    existing.quantity += item.quantity || 1;
  } else {
    items.push({ ...item, quantity: item.quantity || 1 });
  }
  return saveCart(items);
}

/**
 * @param {string} sku
 */
export function removeFromCart(sku) {
  return saveCart(getCart().filter((i) => i.sku !== sku));
}

export function clearCart() {
  return saveCart([]);
}

/**
 * @param {Array<{ price: number, quantity: number }>} [items]
 * @returns {number}
 */
export function cartTotal(items = getCart()) {
  return items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
}
