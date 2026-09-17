import { getCart, clearCart, cartTotal } from '../../scripts/cart.js';
import { trackEvent } from '../../scripts/analytics.js';

function formatPrice(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

/**
 * @param {Element} block
 */
function renderCart(block) {
  const items = getCart();
  block.innerHTML = '';

  const heading = document.createElement('h3');
  heading.textContent = 'Your cart';
  block.append(heading);

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'cart-empty';
    empty.textContent = 'Your cart is empty.';
    block.append(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'cart-items';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.name} x${item.quantity} — ${formatPrice(item.price * item.quantity)}`;
    list.append(li);
  });
  block.append(list);

  const total = document.createElement('p');
  total.className = 'cart-total';
  total.textContent = `Total: ${formatPrice(cartTotal(items))}`;
  block.append(total);

  const checkoutButton = document.createElement('button');
  checkoutButton.type = 'button';
  checkoutButton.className = 'button primary cart-checkout';
  checkoutButton.textContent = 'Place order (demo)';
  checkoutButton.addEventListener('click', () => {
    const productListItems = items.map((item) => ({
      SKU: item.sku, name: item.name, priceTotal: item.price, quantity: item.quantity,
    }));
    trackEvent('commerce.checkouts', { productListItems });
    const orderNumber = `DEMO-${Math.floor(Math.random() * 1000000)}`;
    trackEvent('commerce.purchases', {
      productListItems,
      commerce: { order: { purchaseID: orderNumber, priceTotal: cartTotal(items) } },
    });
    clearCart();
    block.innerHTML = '';
    const confirmation = document.createElement('p');
    confirmation.className = 'cart-confirmation';
    confirmation.textContent = `Order ${orderNumber} placed — thank you! (demo only, no real payment was made)`;
    block.append(confirmation);
  });
  block.append(checkoutButton);
}

/**
 * @param {Element} block
 */
export default function decorate(block) {
  renderCart(block);
  window.addEventListener('cartchange', () => renderCart(block));
}
