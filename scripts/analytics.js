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
  return trackEvent('web.webpagedetails.pageViews', {
    web: {
      webPageDetails: {
        name: document.title,
      },
    },
  });
}
