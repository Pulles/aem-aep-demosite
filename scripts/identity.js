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

const KNOWN_EMAILS_KEY = 'heineken-demo-known-emails';

/**
 * @param {string} email
 * @returns {boolean} true if this email has been seen (registered) before
 */
export function isKnownEmail(email) {
  try {
    const raw = localStorage.getItem(KNOWN_EMAILS_KEY);
    const known = raw ? JSON.parse(raw) : [];
    return known.includes(email);
  } catch (e) {
    return false;
  }
}

/**
 * @param {string} email
 */
export function rememberEmail(email) {
  try {
    const raw = localStorage.getItem(KNOWN_EMAILS_KEY);
    const known = raw ? JSON.parse(raw) : [];
    if (!known.includes(email)) {
      known.push(email);
      localStorage.setItem(KNOWN_EMAILS_KEY, JSON.stringify(known));
    }
  } catch (e) {
    // do nothing
  }
}
