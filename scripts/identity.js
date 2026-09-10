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
