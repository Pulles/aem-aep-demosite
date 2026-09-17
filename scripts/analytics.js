/**
 * Adobe Web SDK (alloy) integration for the Heineken 0.0 Silverstone GP demo site.
 * Datastream + org are reused from an existing AEP sandbox — see
 * docs/superpowers/specs/2026-09-09-heineken-silverstone-site-design.md
 */
import { getIdentity } from './identity.js';

const DATASTREAM_ID = '8b082166-1bea-41ac-9f3b-f5d9f691bc86';
const ORG_ID = '8AB51935659C10E40A495FA2@AdobeOrg';
const DCS_PROFILE_ENDPOINT = 'https://dcs.adobedc.net/collection/b9e497817b014b5684766a0c5d8429d20d5159a6d03bd21f77531818fc3a44c3';
const PROFILE_DATASET_ID = '6a96a91f7ba624c8c1169a21';
const PROFILE_SCHEMA_REF = 'https://ns.adobe.com/demopotemea/schemas/1118fc8be763f5e0e3008df22e8e6843d2bcf422b83924b3';

function splitName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

async function getExperienceCloudId() {
  try {
    const result = await window.alloy('getIdentity');
    return result?.identity?.ECID || '';
  } catch {
    return '';
  }
}

/**
 * Configures alloy. Call once, as early as possible.
 * @returns {Promise<void>}
 */
export function initAnalytics() {
  return window.alloy('configure', {
    edgeConfigId: DATASTREAM_ID,
    orgId: ORG_ID,
    defaultConsent: 'pending',
  });
}

/**
 * Applies the site's collection consent to Alloy.
 * @param {boolean} consented Whether experience-event collection is allowed
 * @returns {Promise<object>}
 */
export function setAnalyticsConsent(consented) {
  return window.alloy('setConsent', {
    consent: [{
      standard: 'Adobe',
      version: '2.0',
      value: {
        collect: { val: consented ? 'y' : 'n' },
      },
    }],
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
  const params = new URLSearchParams(window.location.search);
  const trackingCode = params.get('utm_campaign') || params.get('utm_source') || params.get('utm_medium');
  const xdm = {
    eventType,
    ...(trackingCode && { marketing: { trackingCode } }),
    ...xdmFields,
    web: {
      ...xdmFields.web,
      webPageDetails: {
        URL: window.location.href,
        ...xdmFields.web?.webPageDetails,
      },
    },
  };
  if (identity && identity.email) {
    xdm.identityMap = { Email: [{ id: identity.email, primary: true }] };
  }
  return window.alloy('sendEvent', { xdm });
}

/**
 * Sends a profile-shaped payload to the DCS collection endpoint.
 * @param {{ name?: string, email: string, phone?: string, marketingOptIn?: boolean }} profile
 * @returns {Promise<Response>}
 */
export async function sendProfileToDcs(profile) {
  const ecid = await getExperienceCloudId();
  const { firstName, lastName } = splitName(profile.name);
  const phoneNumber = profile.phone || '';
  const timestamp = new Date().toISOString();
  const xdm = {
    header: {
      datasetId: PROFILE_DATASET_ID,
      imsOrgId: ORG_ID,
      source: { name: 'web' },
      schemaRef: {
        id: PROFILE_SCHEMA_REF,
        contentType: 'application/vnd.adobe.xed-full+json;version=1',
      },
    },
    body: {
      xdmMeta: {
        schemaRef: {
          id: PROFILE_SCHEMA_REF,
          contentType: 'application/vnd.adobe.xed-full+json;version=1',
        },
      },
      identityMap: [{
        Email: [{
          authenticatedState: 'authenticated',
          id: profile.email,
          primary: true,
        }],
      }],
      xdmEntity: {
        testProfile: true,
        _repo: { createDate: timestamp },
        consents: {
          marketing: {
            email: { val: profile.marketingOptIn ? 'y' : 'n' },
            push: { val: 'n' },
            sms: { val: 'n' },
            preferred: 'email',
          },
        },
        person: {
          name: { firstName, lastName },
        },
        personalEmail: { address: profile.email },
        _demopotemea: {
          identification: {
            core: {
              email: profile.email,
              ecid,
              phoneNumber,
            },
          },
          scoring: {
            churn: { churnPrediction: 50.0 },
            core: { propensityScore: 78.0 },
          },
        },
        mobilePhone: { number: phoneNumber },
      },
    },
  };

  const response = await fetch(DCS_PROFILE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(xdm),
  });
  if (!response.ok) {
    throw new Error(`DCS profile call failed with status ${response.status}`);
  }
  return response;
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
