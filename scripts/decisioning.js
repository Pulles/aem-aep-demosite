/**
 * AJO Offer Decisioning integration for the Heineken 0.0 Silverstone GP demo site.
 * Requests personalized decisions from Adobe Journey Optimizer via the same
 * Adobe Web SDK (alloy) and datastream already used for analytics — see
 * docs/superpowers/specs/2026-09-10-ajo-offer-decisioning-design.md
 *
 * The proposition content-parsing below is best-effort against Adobe's
 * commonly-documented shape and has not yet been verified against a real
 * offer (none existed at time of writing). It may need adjustment once a
 * real decision scope is wired in — see the spec's "Prerequisite" section.
 */
import { trackEvent } from './analytics.js';

/**
 * Requests a personalized decision for a given scope and normalizes
 * whatever Adobe returns into simple renderable fields.
 * @param {string} decisionScope
 * @returns {Promise<{
 *   headline: string, description: string, ctaText: string, ctaHref: string, proposition: object
 * } | null>}
 */
const OFFER_TIMEOUT_MS = 3000;

export async function getOffer(decisionScope) {
  try {
    // window.alloy's returned promise never settles if the real alloy.min.js
    // library fails to load (CDN blocked/slow/down) — race it against a
    // timeout so a missing offer/CDN never blocks the calling block's
    // decorate(), which EDS awaits sequentially per section (see
    // scripts/aem.js loadSection/loadSections).
    const result = await Promise.race([
      window.alloy('sendEvent', {
        renderDecisions: true,
        decisionScopes: [decisionScope],
      }),
      new Promise((resolve) => { setTimeout(() => resolve(null), OFFER_TIMEOUT_MS); }),
    ]);
    if (!result) return null;

    const proposition = result?.propositions?.[0];
    const item = proposition?.items?.[0];
    const content = item?.data?.content;
    if (!content) return null;

    const data = typeof content === 'string' ? JSON.parse(content) : content;
    if (!data?.headline) return null;

    return {
      headline: data.headline,
      description: data.description || '',
      ctaText: data.ctaText || 'Learn more',
      ctaHref: data.ctaHref || '#',
      proposition,
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Offer decisioning request failed', decisionScope, e);
    return null;
  }
}

/**
 * Reports that a rendered offer was displayed to the visitor, so AJO can
 * measure and optimize the Decision Policy that served it.
 * @param {object} proposition Raw proposition object returned by getOffer
 */
export function trackOfferDisplay(proposition) {
  trackEvent('decisioning.propositionDisplay', {
    _experience: { decisioning: { propositions: [proposition] } },
  });
}

/**
 * Reports that a visitor interacted with (clicked) a rendered offer.
 * @param {object} proposition Raw proposition object returned by getOffer
 */
export function trackOfferInteract(proposition) {
  trackEvent('decisioning.propositionInteract', {
    _experience: { decisioning: { propositions: [proposition] } },
  });
}
