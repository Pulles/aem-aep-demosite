import {
  getIdentity, setIdentity, clearIdentity, isKnownEmail, rememberEmail,
} from '../../scripts/identity.js';
import { sendProfileToDcs, trackEvent } from '../../scripts/analytics.js?v=analytics-refresh';

const LOGIN_MODE = 'login';
const REGISTRATION_MODE = 'registration';

function reportAuthEvent(eventType, xdmFields = {}) {
  trackEvent(eventType, xdmFields).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Authentication event failed', error);
  });
}

async function sendAuthProfile(profile) {
  await sendProfileToDcs(profile);
}

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
  logout.addEventListener('click', () => { clearIdentity(); renderForm(block, LOGIN_MODE); });
  block.append(greeting, logout);
}

/**
 * @param {Element} block
 * @param {string} mode
 */
function renderForm(block, mode) {
  block.innerHTML = '';
  const modeSwitcher = document.createElement('div');
  modeSwitcher.className = 'login-mode-switcher';
  const loginButton = document.createElement('button');
  loginButton.type = 'button';
  loginButton.className = `login-mode-button ${mode === LOGIN_MODE ? 'active' : ''}`;
  loginButton.textContent = 'Log in';
  loginButton.setAttribute('aria-pressed', String(mode === LOGIN_MODE));
  loginButton.addEventListener('click', () => renderForm(block, LOGIN_MODE));
  const registrationButton = document.createElement('button');
  registrationButton.type = 'button';
  registrationButton.className = `login-mode-button ${mode === REGISTRATION_MODE ? 'active' : ''}`;
  registrationButton.textContent = 'Register';
  registrationButton.setAttribute('aria-pressed', String(mode === REGISTRATION_MODE));
  registrationButton.addEventListener('click', () => renderForm(block, REGISTRATION_MODE));
  modeSwitcher.append(loginButton, registrationButton);

  const form = document.createElement('form');
  form.className = 'login-form';
  if (mode === REGISTRATION_MODE) {
    form.innerHTML = `
      <input type="text" name="name" placeholder="Name" autocomplete="name" required />
      <input type="email" name="email" placeholder="Email" autocomplete="email" required />
      <input type="tel" name="phone" placeholder="Phone" autocomplete="tel" required />
      <label class="login-optin">
        <input type="checkbox" name="marketingOptIn" value="yes" />
        Marketing opt-in
      </label>
      <button type="submit" class="button primary">Register</button>
    `;
  } else {
    form.innerHTML = `
      <input type="text" name="name" placeholder="Name" autocomplete="name" required />
      <input type="email" name="email" placeholder="Email" autocomplete="email" required />
      <button type="submit" class="button primary">Log in</button>
    `;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      if (!name || !email) return;
      if (mode === REGISTRATION_MODE) {
        const phone = form.elements.phone.value.trim();
        if (!phone) return;
        await sendAuthProfile({
          name, email, phone, marketingOptIn: form.elements.marketingOptIn.checked,
        });
        rememberEmail(email);
        const identity = setIdentity({ name, email });
        reportAuthEvent('web.registration', {
          consents: {
            marketing: {
              email: { val: form.elements.marketingOptIn.checked ? 'y' : 'n' },
            },
          },
          person: {
            name: { fullName: name },
          },
          personalEmail: { address: email },
          mobilePhone: { number: phone },
        });
        renderLoggedIn(block, identity);
        return;
      }
      await sendAuthProfile({ name, email });
      if (!isKnownEmail(email)) rememberEmail(email);
      const identity = setIdentity({ name, email });
      reportAuthEvent('authentication.login');
      renderLoggedIn(block, identity);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Authentication failed', error);
    }
  });
  block.append(modeSwitcher, form);
}

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const identity = getIdentity();
  if (identity) {
    renderLoggedIn(block, identity);
  } else {
    renderForm(block, LOGIN_MODE);
  }
}
