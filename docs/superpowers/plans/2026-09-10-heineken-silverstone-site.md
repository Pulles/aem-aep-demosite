# Heineken 0.0 Silverstone GP Demo Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a demo AEM Edge Delivery Services (EDS) microsite for a fictional Heineken 0.0 Silverstone Grand Prix experience (Home, Tickets, Merch, Race Intel, Circuit), with mock login/registration and mock ticket/merch ordering, all instrumented with the Adobe Web SDK against an existing AEP datastream so every page view, product view, add-to-cart, checkout, purchase, login, and registration fires a real XDM event to the Adobe Edge Network.

**Architecture:** Reuse the existing `adobe/aem-boilerplate`-based EDS repo as-is (`hero`, `cards`, `columns`, `header`, `footer` blocks unchanged). Add three new blocks (`login`, `cart`, `product-grid`) plus three shared `/scripts/` modules (`analytics.js`, `identity.js`, `cart.js`) that blocks import — per this repo's convention, blocks never import each other directly (except `fragment/fragment.js`); shared logic lives in `/scripts/`. Catalog data (tickets, merch) is DA-authored JSON sheets fetched at runtime by `product-grid`; narrative content (circuit facts, race schedule, hero copy) is hand-authored DA HTML using default content and existing blocks.

**Tech Stack:** Vanilla JS (ES modules, no framework, no build step — matches `adobe/aem-boilerplate`), Adobe Web SDK (`alloy.js`, loaded via `<script>` tag, not npm), DA (Document Authoring) for content, existing AEP datastream over Adobe Edge Network.

**Spec:** [docs/superpowers/specs/2026-09-09-heineken-silverstone-site-design.md](../specs/2026-09-09-heineken-silverstone-site-design.md)

## Global Constraints

- No real payments, no real authentication, no real inventory — all ordering/login flows are simulated (spec: Purpose/Non-goals).
- Do not create new AEP schema, sandbox, or datastream. Reuse: datastream ID `8b082166-1bea-41ac-9f3b-f5d9f691bc86`, org `8AB51935659C10E40A495FA2@AdobeOrg`, sandbox `sandbox51`, Edge Network region `irl1` (spec: Existing infrastructure).
- `scripts/aem.js` is vendored — never edit it (AGENTS.md).
- No build step; only `devDependencies` in `package.json` — the Web SDK loads via a CDN `<script>` tag, never as an npm runtime dependency (AGENTS.md, spec: AEP Web SDK integration).
- Scope every block's CSS to `.blockname`; `-wrapper`/`-container` are section-level classes owned by the framework, not the block (AGENTS.md).
- `fragment/fragment.js` is the only cross-block import allowed. All other shared logic goes in `/scripts/` and is imported from there (AGENTS.md).
- Placeholder branding only: Heineken 0.0's publicly-known green/red/silver colors, no real logo artwork, nothing copied from the (inaccessible) Scribd brand guidelines doc (spec: Branding).
- Code changes ship via git commit to `github.com/Pulles/aem-aep-demosite` on `main`; a PR needs a `{branch}--{repo}--{owner}.aem.page/{path}` preview link before it's mergeable (AGENTS.md). Content changes (DA pages, JSON sheets) ship separately via the DA Source API + `admin.hlx.page` preview — never via git.
- DA auth: `DA_TOKEN=$(node -e "const t=require(process.env.HOME+'/.aem/da-token.json'); process.stdout.write(t.access_token);")` — re-run the `da-auth-helper` login (see spec) if any DA call returns `401`.
- Verify markup before writing block JS: `curl localhost:3000/<path>.plain.html` against the local `aem up` server first (AGENTS.md) — the task steps below already show the expected shape, but confirm it locally before trusting it.

---

### Task 1: Brand colors + Web SDK bootstrap + site-wide page-view tracking

**Files:**
- Modify: `styles/styles.css`
- Modify: `head.html`
- Create: `scripts/analytics.js`
- Modify: `scripts/scripts.js`
- Test: manual (local preview + browser Network tab; no automated test runner in this repo, see `package.json`)

**Interfaces:**
- Produces: `scripts/analytics.js` exports `initAnalytics()`, `trackEvent(eventType, xdmFields = {})`, `trackPageView()`. Every later task that needs to fire an XDM event imports `trackEvent` from `'../../scripts/analytics.js'`.

- [ ] **Step 1: Add Heineken 0.0 brand color variables**

Edit `styles/styles.css`, inside the `:root { ... }` block (after the existing `/* colors */` block, do not remove existing variables — other blocks depend on `--link-color` etc.):

```css
  /* colors */
  --background-color: white;
  --light-color: #f8f8f8;
  --dark-color: #505050;
  --text-color: #131313;
  --link-color: #00843d;
  --link-hover-color: #00612d;

  /* heineken 0.0 brand (placeholder — public brand colors only) */
  --brand-green: #00843d;
  --brand-green-dark: #00612d;
  --brand-red: #d0021b;
  --brand-silver: #c8ccce;
```

(`--link-color`/`--link-hover-color` are switched from the boilerplate blue to Heineken green so links/buttons read on-brand everywhere for free; `--brand-red` and `--brand-silver` are new, for blocks that need an accent.)

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint:css`
Expected: no errors.

- [ ] **Step 3: Add the Adobe Web SDK (alloy.js) bootstrap to `head.html`**

Edit `head.html`, add after the existing two `<script nonce="aem" ...>` tags (keep the exact `nonce="aem"` attribute — the CSP in this file is `strict-dynamic` + nonce-based, so any new `<script>` tag needs the same nonce or it will be blocked):

```html
<script nonce="aem" src="https://cdn1.adoberesources.net/alloyStatic/2.x/alloy.min.js" async></script>
<script nonce="aem">
  !function(n,o){o.forEach(function(o){n[o]||((n.__alloyNS=n.__alloyNS||[]).push(o),n[o]=
  function(){var u=arguments;return new Promise(function(i,l){n[o].q.push([i,l,u])})},n[o].q=[])})}
  (window,["alloy"]);
</script>
```

Note for whoever runs this step: this is Adobe's standard, unversioned Web SDK stub snippet (stable for years). If the AEP UI's datastream "Setup" tab shows a different exact library URL when you have access to check it, prefer that URL — the stub logic itself does not change.

- [ ] **Step 4: Create `scripts/analytics.js`**

```js
/**
 * Adobe Web SDK (alloy) integration for the Heineken 0.0 Silverstone GP demo site.
 * Datastream + org are reused from an existing AEP sandbox — see
 * docs/superpowers/specs/2026-09-09-heineken-silverstone-site-design.md
 */
import { getIdentity } from './identity.js';

const DATASTREAM_ID = '8b082166-1bea-41ac-9f3b-f5d9f691bc86';
const ORG_ID = '8AB51935659C10E40A495FA2@AdobeOrg';

/**
 * Configures alloy. Call once, as early as possible.
 * @returns {Promise<void>}
 */
export function initAnalytics() {
  return window.alloy('configure', {
    edgeConfigId: DATASTREAM_ID,
    orgId: ORG_ID,
  });
}

/**
 * Sends an XDM event via alloy. Automatically attaches identityMap.Email
 * when a mock identity is present (see scripts/identity.js), so every
 * event fired after login/registration is stitched to that identity.
 * @param {string} eventType XDM eventType, e.g. 'web.webpagedetails.pageViews'
 * @param {object} [xdmFields] Additional XDM fields to merge in
 * @returns {Promise<object>}
 */
export function trackEvent(eventType, xdmFields = {}) {
  const identity = getIdentity();
  const xdm = { eventType, ...xdmFields };
  if (identity && identity.email) {
    xdm.identityMap = { Email: [{ id: identity.email, primary: true }] };
  }
  return window.alloy('sendEvent', { xdm });
}

/**
 * Fires a page-view event. alloy automatically attaches web/device/
 * environment context, so no manual web.webPageDetails is needed.
 * @returns {Promise<object>}
 */
export function trackPageView() {
  return trackEvent('web.webpagedetails.pageViews');
}
```

- [ ] **Step 5: Fire a page view on every page load**

Edit `scripts/scripts.js`. Add the import at the top alongside the existing `aem.js` import block:

```js
import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  buildBlock,
} from './aem.js';
import { initAnalytics, trackPageView } from './analytics.js';
```

Then modify `loadEager` to configure and fire the page view after the LCP section has loaded (so it doesn't compete with LCP), replacing the existing function body:

```js
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }

  try {
    await initAnalytics();
    trackPageView();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Analytics init/page-view failed', e);
  }
}
```

- [ ] **Step 6: Verify JS lint passes**

Run: `npm run lint:js`
Expected: no errors.

- [ ] **Step 7: Manually verify locally**

Run: `npx -y @adobe/aem-cli up`
Open the local preview in a browser, open DevTools > Network, filter for `adobedc.net`.
Expected: a request to `edge.adobedc.net/ee/irl1/v1/interact` (or similar `/ee/.../v1/interact` path) returns `200` on page load.

- [ ] **Step 8: Commit**

```bash
cd "/Users/pvanoosterho/AEM_AEP demosite"
git add styles/styles.css head.html scripts/analytics.js scripts/scripts.js
git commit -m "Add Heineken 0.0 brand colors and Adobe Web SDK page-view tracking"
git push origin main
```

---

### Task 2: Mock identity + login/registration block

**Files:**
- Create: `scripts/identity.js`
- Create: `blocks/login/login.js`
- Create: `blocks/login/login.css`
- Test: manual (local preview + browser Network tab + localStorage inspection)

**Interfaces:**
- Consumes: `trackEvent` from `scripts/analytics.js` (Task 1).
- Produces: `scripts/identity.js` exports `getIdentity()` (returns `{ name, email } | null`), `setIdentity({ name, email })`, `clearIdentity()`. `scripts/analytics.js` (Task 1) already consumes `getIdentity` — no change needed there, just confirm it resolves once this file exists. Dispatches a `window` `CustomEvent('identitychange', { detail: identity | null })` on every change, for any block that wants to react.

- [ ] **Step 1: Create `scripts/identity.js`**

```js
/**
 * Mock identity for the Heineken 0.0 Silverstone GP demo site.
 * No real authentication — captures a name + email client-side so the
 * site can demonstrate AEP identity stitching for "logged in" users.
 */
const STORAGE_KEY = 'heineken-demo-identity';

/**
 * @returns {{ name: string, email: string } | null}
 */
export function getIdentity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * @param {{ name: string, email: string }} identity
 * @returns {{ name: string, email: string }}
 */
export function setIdentity(identity) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  window.dispatchEvent(new CustomEvent('identitychange', { detail: identity }));
  return identity;
}

export function clearIdentity() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('identitychange', { detail: null }));
}
```

- [ ] **Step 2: Create `blocks/login/login.js`**

```js
import { getIdentity, setIdentity, clearIdentity } from '../../scripts/identity.js';
import { trackEvent } from '../../scripts/analytics.js';

/**
 * @param {Element} block
 * @param {{ name: string, email: string }} identity
 */
function renderLoggedIn(block, identity) {
  block.innerHTML = '';
  const greeting = document.createElement('span');
  greeting.className = 'login-greeting';
  greeting.textContent = `Hi, ${identity.name}`;
  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'button secondary login-logout';
  logout.textContent = 'Log out';
  // eslint-disable-next-line no-use-before-define
  logout.addEventListener('click', () => { clearIdentity(); renderForm(block); });
  block.append(greeting, logout);
}

/**
 * @param {Element} block
 */
function renderForm(block) {
  block.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'login-form';
  form.innerHTML = `
    <input type="text" name="name" placeholder="Name" autocomplete="name" required />
    <input type="email" name="email" placeholder="Email" autocomplete="email" required />
    <button type="submit" class="button primary">Log in / Register</button>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    if (!name || !email) return;
    const isNewUser = !getIdentity();
    const identity = setIdentity({ name, email });
    trackEvent(isNewUser ? 'authentication.registration' : 'authentication.login');
    renderLoggedIn(block, identity);
  });
  block.append(form);
}

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const identity = getIdentity();
  if (identity) {
    renderLoggedIn(block, identity);
  } else {
    renderForm(block);
  }
}
```

- [ ] **Step 3: Create `blocks/login/login.css`**

```css
.login {
  display: flex;
  align-items: center;
  gap: 12px;
}

.login .login-form {
  display: flex;
  align-items: center;
  gap: 8px;
}

.login .login-form input {
  box-sizing: border-box;
  border: 1px solid var(--brand-silver);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: var(--body-font-size-xs);
}

.login .login-greeting {
  font-size: var(--body-font-size-xs);
  font-weight: 500;
  white-space: nowrap;
}
```

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Add the `login` block to the site nav (DA content, not git)**

Fetch the current nav so you don't clobber it:

```bash
DA_TOKEN=$(node -e "const t=require(process.env.HOME+'/.aem/da-token.json'); process.stdout.write(t.access_token);")
curl -s -H "Authorization: Bearer $DA_TOKEN" "https://admin.da.live/source/Pulles/aem-aep-demosite/nav.html"
```

Replace the third (currently empty) `<div>` — the `nav-tools` column per `blocks/header/header.js:127-130` — with the login block, keeping the first two divs exactly as they are:

```bash
cat > /tmp/nav.html << 'EOF'
<main>
  <div>
    <p><a href="/">AEM AEP Demosite</a></p>
  </div>
  <div>
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </div>
  <div>
    <div class="login"></div>
  </div>
</main>
EOF
DA_TOKEN=$(node -e "const t=require(process.env.HOME+'/.aem/da-token.json'); process.stdout.write(t.access_token);")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT "https://admin.da.live/source/Pulles/aem-aep-demosite/nav.html" \
  -H "Authorization: Bearer $DA_TOKEN" -F "data=@/tmp/nav.html;type=text/html"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "https://admin.hlx.page/preview/Pulles/aem-aep-demosite/main/nav" \
  -H "Authorization: Bearer $DA_TOKEN"
```

Expected: both calls return `200`/`201`.

- [ ] **Step 6: Manually verify**

Run: `npx -y @adobe/aem-cli up`, open the local preview.
Expected: a login form appears in the header. Submitting name+email shows "Hi, `<name>`" + a Log out button; DevTools > Application > Local Storage shows `heineken-demo-identity`; DevTools > Network shows a `200` to `edge.adobedc.net/ee/.../v1/interact` for the login/registration event. Reloading the page keeps you logged in (identity persisted). Log out clears it and shows the form again.

- [ ] **Step 7: Commit**

```bash
cd "/Users/pvanoosterho/AEM_AEP demosite"
git add scripts/identity.js blocks/login/login.js blocks/login/login.css
git commit -m "Add mock login/registration block with identity tracking"
git push origin main
```

---

### Task 3: Cart module + cart/checkout block

**Files:**
- Create: `scripts/cart.js`
- Create: `blocks/cart/cart.js`
- Create: `blocks/cart/cart.css`
- Test: manual (local preview + browser Network tab + localStorage inspection)

**Interfaces:**
- Consumes: `trackEvent` from `scripts/analytics.js` (Task 1).
- Produces: `scripts/cart.js` exports `getCart()` (returns `Array<{ sku, name, price, quantity }>`), `addToCart({ sku, name, price, quantity })`, `removeFromCart(sku)`, `clearCart()`, `cartTotal(items = getCart())`. Task 4's `product-grid` block imports `addToCart` from this file. Dispatches `window` `CustomEvent('cartchange', { detail: items })` on every change.

- [ ] **Step 1: Create `scripts/cart.js`**

```js
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
```

- [ ] **Step 2: Create `blocks/cart/cart.js`**

```js
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
```

- [ ] **Step 3: Create `blocks/cart/cart.css`**

```css
.cart {
  border: 1px solid var(--brand-silver);
  border-radius: 8px;
  padding: 16px;
  max-width: 400px;
}

.cart h3 {
  margin-top: 0;
}

.cart .cart-items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cart .cart-items li {
  padding: 4px 0;
  border-bottom: 1px solid var(--light-color);
}

.cart .cart-total {
  font-weight: 700;
}

.cart .cart-confirmation {
  color: var(--brand-green);
  font-weight: 500;
}
```

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/pvanoosterho/AEM_AEP demosite"
git add scripts/cart.js blocks/cart/cart.js blocks/cart/cart.css
git commit -m "Add mock cart/checkout block with commerce event tracking"
git push origin main
```

(Manual verification of this block happens in Task 4, once a `product-grid` exists to add items from — an empty cart block with nothing to add to it isn't meaningfully testable on its own.)

---

### Task 4: Product-grid block + tickets/merch catalog + Tickets & Merch pages

**Files:**
- Create: `blocks/product-grid/product-grid.js`
- Create: `blocks/product-grid/product-grid.css`
- Test: manual (local preview + browser Network tab)

**Interfaces:**
- Consumes: `addToCart` from `scripts/cart.js` (Task 3), `trackEvent` from `scripts/analytics.js` (Task 1).

- [ ] **Step 1: Create `blocks/product-grid/product-grid.js`**

```js
import { addToCart } from '../../scripts/cart.js';
import { trackEvent } from '../../scripts/analytics.js';

function formatPrice(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

/**
 * @param {{ sku: string, name: string, description?: string, price: string|number, image?: string }} item
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
```

- [ ] **Step 2: Create `blocks/product-grid/product-grid.css`**

```css
.product-grid ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 24px;
}

.product-grid .product-grid-item {
  border: 1px solid var(--brand-silver);
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--background-color);
}

.product-grid .product-grid-image img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.product-grid .product-grid-body {
  padding: 16px;
}

.product-grid .product-grid-price {
  font-weight: 700;
  color: var(--brand-green);
}
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit code**

```bash
cd "/Users/pvanoosterho/AEM_AEP demosite"
git add blocks/product-grid/product-grid.js blocks/product-grid/product-grid.css
git commit -m "Add product-grid block for ticket/merch catalogs"
git push origin main
```

- [ ] **Step 5: Author the tickets catalog (DA content, not git)**

```bash
cat > /tmp/tickets.json << 'EOF'
{
  ":type": "sheet",
  "data": [
    {
      "sku": "TICKET-GA",
      "name": "General Admission",
      "description": "Grounds access for the full Silverstone GP race weekend.",
      "price": "249",
      "image": "https://placehold.co/600x450?text=General+Admission"
    },
    {
      "sku": "TICKET-GRANDSTAND",
      "name": "Grandstand Seat",
      "description": "Reserved grandstand seating with a view of the main straight.",
      "price": "459",
      "image": "https://placehold.co/600x450?text=Grandstand"
    },
    {
      "sku": "TICKET-HOSPITALITY",
      "name": "Heineken 0.0 Hospitality",
      "description": "Premium hospitality suite access with race-day catering.",
      "price": "899",
      "image": "https://placehold.co/600x450?text=Hospitality"
    }
  ]
}
EOF
DA_TOKEN=$(node -e "const t=require(process.env.HOME+'/.aem/da-token.json'); process.stdout.write(t.access_token);")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT "https://admin.da.live/source/Pulles/aem-aep-demosite/tickets.json" \
  -H "Authorization: Bearer $DA_TOKEN" -F "data=@/tmp/tickets.json;type=application/json"
```

Expected: `200`/`201`. (JSON sheets are binaries from DA's point of view — served directly from `content.da.live`, no preview/publish step needed, per the da-content skill's rule 6 on binaries. The page that references it, `/tickets`, still needs its own preview — see Step 7.)

- [ ] **Step 6: Author the merch catalog (DA content, not git)**

```bash
cat > /tmp/merch.json << 'EOF'
{
  ":type": "sheet",
  "data": [
    {
      "sku": "MERCH-TSHIRT",
      "name": "Heineken 0.0 Race Tee",
      "description": "Cotton t-shirt with the Heineken 0.0 Silverstone GP print.",
      "price": "29",
      "image": "https://placehold.co/600x450?text=Race+Tee"
    },
    {
      "sku": "MERCH-CAP",
      "name": "Team Cap",
      "description": "Adjustable cap in green and silver.",
      "price": "19",
      "image": "https://placehold.co/600x450?text=Team+Cap"
    },
    {
      "sku": "MERCH-SCARF",
      "name": "Trackside Scarf",
      "description": "Silverstone GP trackside scarf.",
      "price": "15",
      "image": "https://placehold.co/600x450?text=Scarf"
    }
  ]
}
EOF
DA_TOKEN=$(node -e "const t=require(process.env.HOME+'/.aem/da-token.json'); process.stdout.write(t.access_token);")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT "https://admin.da.live/source/Pulles/aem-aep-demosite/merch.json" \
  -H "Authorization: Bearer $DA_TOKEN" -F "data=@/tmp/merch.json;type=application/json"
```

Expected: `200`/`201`.

- [ ] **Step 7: Author the Tickets and Merch pages + cart, then preview (DA content, not git)**

```bash
cat > /tmp/tickets.html << 'EOF'
<main>
  <div>
    <h1>Tickets</h1>
    <p>Choose your Silverstone GP experience with Heineken 0.0.</p>
  </div>
  <div>
    <div class="product-grid">
      <div><div><a href="/tickets.json">Tickets data</a></div></div>
    </div>
  </div>
  <div>
    <div class="cart"></div>
  </div>
</main>
EOF
cat > /tmp/merch.html << 'EOF'
<main>
  <div>
    <h1>Merch</h1>
    <p>Take the Heineken 0.0 Silverstone GP look home with you.</p>
  </div>
  <div>
    <div class="product-grid">
      <div><div><a href="/merch.json">Merch data</a></div></div>
    </div>
  </div>
  <div>
    <div class="cart"></div>
  </div>
</main>
EOF
DA_TOKEN=$(node -e "const t=require(process.env.HOME+'/.aem/da-token.json'); process.stdout.write(t.access_token);")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT "https://admin.da.live/source/Pulles/aem-aep-demosite/tickets.html" \
  -H "Authorization: Bearer $DA_TOKEN" -F "data=@/tmp/tickets.html;type=text/html"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT "https://admin.da.live/source/Pulles/aem-aep-demosite/merch.html" \
  -H "Authorization: Bearer $DA_TOKEN" -F "data=@/tmp/merch.html;type=text/html"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "https://admin.hlx.page/preview/Pulles/aem-aep-demosite/main/tickets" \
  -H "Authorization: Bearer $DA_TOKEN"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "https://admin.hlx.page/preview/Pulles/aem-aep-demosite/main/merch" \
  -H "Authorization: Bearer $DA_TOKEN"
```

Expected: all four calls return `200`/`201`.

- [ ] **Step 8: Manually verify**

Open `https://main--aem-aep-demosite--pulles.aem.page/tickets` and `/merch`.
Expected: each page shows a grid of 3 items with images, prices, and "Add to cart" buttons, plus a "Your cart" panel below. Clicking "Add to cart" updates the cart panel immediately (via the `cartchange` event) and DevTools > Network shows a `200` to `edge.adobedc.net` for the `commerce.productListAdds` event. Clicking "Place order (demo)" shows an order confirmation, clears the cart, and fires `commerce.checkouts` + `commerce.purchases` events (both visible as `200`s in Network).

---

### Task 5: Home, Race Intel, and Circuit page content + nav/footer finalization

**Files:** none (DA content only, not git)

- [ ] **Step 1: Update the nav with links to all pages (DA content)**

```bash
cat > /tmp/nav.html << 'EOF'
<main>
  <div>
    <p><a href="/">Heineken 0.0 | Silverstone GP</a></p>
  </div>
  <div>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/tickets">Tickets</a></li>
      <li><a href="/merch">Merch</a></li>
      <li><a href="/race-intel">Race Intel</a></li>
      <li><a href="/circuit">Circuit</a></li>
    </ul>
  </div>
  <div>
    <div class="login"></div>
  </div>
</main>
EOF
DA_TOKEN=$(node -e "const t=require(process.env.HOME+'/.aem/da-token.json'); process.stdout.write(t.access_token);")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT "https://admin.da.live/source/Pulles/aem-aep-demosite/nav.html" \
  -H "Authorization: Bearer $DA_TOKEN" -F "data=@/tmp/nav.html;type=text/html"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "https://admin.hlx.page/preview/Pulles/aem-aep-demosite/main/nav" \
  -H "Authorization: Bearer $DA_TOKEN"
```

Expected: both calls return `200`/`201`.

- [ ] **Step 2: Update the footer (DA content)**

```bash
cat > /tmp/footer.html << 'EOF'
<main>
  <div>
    <p>© 2026 Heineken 0.0 Silverstone GP (demo site). Drink responsibly. 0.0% alcohol.</p>
  </div>
</main>
EOF
DA_TOKEN=$(node -e "const t=require(process.env.HOME+'/.aem/da-token.json'); process.stdout.write(t.access_token);")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT "https://admin.da.live/source/Pulles/aem-aep-demosite/footer.html" \
  -H "Authorization: Bearer $DA_TOKEN" -F "data=@/tmp/footer.html;type=text/html"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "https://admin.hlx.page/preview/Pulles/aem-aep-demosite/main/footer" \
  -H "Authorization: Bearer $DA_TOKEN"
```

Expected: both calls return `200`/`201`.

- [ ] **Step 3: Author the Home page (DA content)**

Uses the existing `hero` and `cards` blocks (canonical div form, matching `blocks/cards/cards.js:3-16` — each `cards` row is one card, with an image cell and a body cell):

```bash
cat > /tmp/index.html << 'EOF'
<main>
  <div>
    <div class="hero">
      <div>
        <div>
          <picture><img src="https://placehold.co/1600x600?text=Heineken+0.0+Silverstone+GP" alt="Heineken 0.0 Silverstone GP"></picture>
        </div>
        <div>
          <h1>Heineken 0.0 at the Silverstone Grand Prix</h1>
          <p>Tickets, merch, and everything you need for race weekend.</p>
        </div>
      </div>
    </div>
  </div>
  <div>
    <h2>Explore</h2>
    <div class="cards">
      <div>
        <div><picture><img src="https://placehold.co/600x450?text=Tickets" alt="Tickets"></picture></div>
        <div><p><a href="/tickets">Tickets</a></p><p>Grab your seat for the race weekend.</p></div>
      </div>
      <div>
        <div><picture><img src="https://placehold.co/600x450?text=Merch" alt="Merch"></picture></div>
        <div><p><a href="/merch">Merch</a></p><p>Shop the Heineken 0.0 race collection.</p></div>
      </div>
      <div>
        <div><picture><img src="https://placehold.co/600x450?text=Race+Intel" alt="Race Intel"></picture></div>
        <div><p><a href="/race-intel">Race Intel</a></p><p>Schedule, sessions, and news.</p></div>
      </div>
      <div>
        <div><picture><img src="https://placehold.co/600x450?text=Circuit" alt="Circuit"></picture></div>
        <div><p><a href="/circuit">Circuit</a></p><p>Track facts and history.</p></div>
      </div>
    </div>
  </div>
</main>
EOF
DA_TOKEN=$(node -e "const t=require(process.env.HOME+'/.aem/da-token.json'); process.stdout.write(t.access_token);")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT "https://admin.da.live/source/Pulles/aem-aep-demosite/index.html" \
  -H "Authorization: Bearer $DA_TOKEN" -F "data=@/tmp/index.html;type=text/html"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "https://admin.hlx.page/preview/Pulles/aem-aep-demosite/main/" \
  -H "Authorization: Bearer $DA_TOKEN"
```

Expected: both calls return `200`/`201`.

- [ ] **Step 4: Author the Race Intel page (DA content)**

```bash
cat > /tmp/race-intel.html << 'EOF'
<main>
  <div>
    <h1>Race Intel</h1>
    <p>Everything you need to know for Silverstone GP race weekend.</p>
    <h2>Schedule</h2>
    <table>
      <tr><td><strong>Friday</strong></td><td>Practice 1 &amp; 2</td></tr>
      <tr><td><strong>Saturday</strong></td><td>Practice 3, Qualifying</td></tr>
      <tr><td><strong>Sunday</strong></td><td>Race day — lights out 15:00 BST</td></tr>
    </table>
    <h2>News</h2>
    <p>Stay tuned for the latest updates from the paddock throughout race weekend.</p>
  </div>
</main>
EOF
DA_TOKEN=$(node -e "const t=require(process.env.HOME+'/.aem/da-token.json'); process.stdout.write(t.access_token);")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT "https://admin.da.live/source/Pulles/aem-aep-demosite/race-intel.html" \
  -H "Authorization: Bearer $DA_TOKEN" -F "data=@/tmp/race-intel.html;type=text/html"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "https://admin.hlx.page/preview/Pulles/aem-aep-demosite/main/race-intel" \
  -H "Authorization: Bearer $DA_TOKEN"
```

Expected: both calls return `200`/`201`.

- [ ] **Step 5: Author the Circuit page (DA content)**

Uses the existing `columns` block for the track-facts layout:

```bash
cat > /tmp/circuit.html << 'EOF'
<main>
  <div>
    <h1>Silverstone Circuit</h1>
    <picture><img src="https://placehold.co/1200x700?text=Silverstone+Circuit+Map" alt="Silverstone circuit map"></picture>
  </div>
  <div>
    <div class="columns">
      <div>
        <div><h3>Length</h3><p>5.891 km</p></div>
        <div><h3>Corners</h3><p>18</p></div>
      </div>
      <div>
        <div><h3>Lap record</h3><p>1:27.097</p></div>
        <div><h3>First Grand Prix</h3><p>1948</p></div>
      </div>
    </div>
  </div>
</main>
EOF
DA_TOKEN=$(node -e "const t=require(process.env.HOME+'/.aem/da-token.json'); process.stdout.write(t.access_token);")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT "https://admin.da.live/source/Pulles/aem-aep-demosite/circuit.html" \
  -H "Authorization: Bearer $DA_TOKEN" -F "data=@/tmp/circuit.html;type=text/html"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "https://admin.hlx.page/preview/Pulles/aem-aep-demosite/main/circuit" \
  -H "Authorization: Bearer $DA_TOKEN"
```

Expected: both calls return `200`/`201`.

- [ ] **Step 6: Manually verify all five pages**

Open each of: `https://main--aem-aep-demosite--pulles.aem.page/`, `/tickets`, `/merch`, `/race-intel`, `/circuit`.
Expected: nav shows all 5 links + the login widget on every page; footer shows the updated copy; Home shows the hero + 4-card explore grid linking to the other pages; Race Intel shows the schedule table; Circuit shows the track image + 4 fact columns. No broken images/links, no console errors.

---

### Task 6: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run full lint**

Run: `npm run lint`
Expected: no errors, in either `lint:js` or `lint:css`.

- [ ] **Step 2: Full manual walkthrough with Network tab open**

Open `https://main--aem-aep-demosite--pulles.aem.page/` in a browser with DevTools > Network open, filtered to `adobedc.net`, and walk through:
1. Load Home — expect one `200` `web.webpagedetails.pageViews` request.
2. Click into Tickets — expect a `200` page-view, plus a `200` `commerce.productViews` for the 3 tickets.
3. Add a ticket to cart — expect a `200` `commerce.productListAdds`.
4. Click "Place order (demo)" — expect a `200` `commerce.checkouts` and a `200` `commerce.purchases`, and see the order confirmation render.
5. Log in via the nav login form (new email) — expect a `200` `authentication.registration`.
6. Reload the page — confirm you're still logged in (name shown in nav) and a subsequent add-to-cart event's request payload includes `identityMap.Email` (inspect the request body in DevTools).
7. Repeat steps 2-4 on Merch.
8. Visit Race Intel and Circuit — confirm they render correctly and each fires a `200` page-view.

Expected: every `adobedc.net` request in the whole walkthrough returns `200`, and the identity-map check in step 6 confirms logged-in tracking is working end to end.

- [ ] **Step 3: Confirm the PR is ready**

```bash
cd "/Users/pvanoosterho/AEM_AEP demosite"
git log --oneline main -8
git status
```

Expected: all Task 1-4 commits present, working tree clean. Note the live preview link `https://main--aem-aep-demosite--pulles.aem.page/` for the PR description (AGENTS.md requires this link on any PR).
