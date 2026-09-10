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
