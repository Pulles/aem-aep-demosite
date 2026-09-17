import { addToCart } from '../../scripts/cart.js';
import { trackEvent } from '../../scripts/analytics.js';

function formatPrice(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

/**
 * @param {{
 *   sku: string, name: string, description?: string, price: string|number, image?: string
 * }} item
 * @returns {HTMLLIElement}
 */
function renderItem(item) {
  const price = Number(item.price);
  const li = document.createElement('li');
  li.className = 'product-grid-item';

  if (item.image) {
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'product-grid-image';
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.name;
    img.loading = 'lazy';
    imageWrapper.append(img);
    li.append(imageWrapper);
  }

  const body = document.createElement('div');
  body.className = 'product-grid-body';
  const title = document.createElement('h3');
  title.textContent = item.name;
  const desc = document.createElement('p');
  desc.textContent = item.description || '';
  const priceEl = document.createElement('p');
  priceEl.className = 'product-grid-price';
  priceEl.textContent = formatPrice(price);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button primary';
  button.textContent = 'Add to cart';
  button.addEventListener('click', () => {
    addToCart({
      sku: item.sku, name: item.name, price, quantity: 1,
    });
    trackEvent('commerce.productListAdds', {
      productListItems: [{
        SKU: item.sku, name: item.name, priceTotal: price, quantity: 1,
      }],
    });
  });

  body.append(title, desc, priceEl, button);
  li.append(body);
  return li;
}

/**
 * @param {Element} block
 */
export default async function decorate(block) {
  const source = block.querySelector('a');
  const href = source ? source.getAttribute('href') : block.textContent.trim();
  block.innerHTML = '';
  const ul = document.createElement('ul');

  try {
    const resp = await fetch(href);
    const json = await resp.json();
    const items = json.data || [];
    items.forEach((item) => ul.append(renderItem(item)));
    if (items.length > 0) {
      trackEvent('commerce.productViews', {
        productListItems: items.map((item) => ({
          SKU: item.sku, name: item.name, priceTotal: Number(item.price),
        })),
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load product grid data', href, error);
  }

  block.append(ul);
}
