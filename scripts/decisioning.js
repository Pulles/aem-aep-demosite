/**
 * AJO Offer Decisioning integration for the Heineken 0.0 Silverstone GP demo site.
 * Requests personalized decisions from Adobe Journey Optimizer via the same
 * Adobe Web SDK (alloy) and datastream already used for analytics — see
 * docs/superpowers/specs/2026-09-10-ajo-offer-decisioning-design.md
 *
 * Proposition content in AEP/AJO is author-defined and can arrive in a few
 * different shapes depending on the offer's schema and how the author filled
 * it in. This module handles the two schemas relevant to a hand-rendered
 * (non-dom-action) offer:
 *   - https://ns.adobe.com/personalization/json-content-item — an arbitrary
 *     author-defined JSON object. Field names aren't fixed by Adobe, so this
 *     matches common aliases (headline/title/heading, etc.) rather than one
 *     rigid schema.
 *   - https://ns.adobe.com/personalization/html-content-item — a raw HTML
 *     string, rendered directly (trusted: it comes from our own configured
 *     AEP org, not arbitrary user input).
 * Other schemas (e.g. dom-action, ruleset) aren't meaningful to render inside
 * a single block and resolve to `null`.
 */
import { trackEvent } from './analytics.js';

const OFFER_TIMEOUT_MS = 3000;

const FIELD_ALIASES = {
  headline: ['headline', 'title', 'heading', 'name'],
  description: ['description', 'body', 'text', 'message', 'subheadline'],
  ctaText: ['ctaText', 'buttonText', 'cta', 'ctaLabel'],
  ctaHref: ['ctaHref', 'ctaUrl', 'url', 'link', 'href'],
};

/**
 * @param {object} content
 * @param {string[]} aliases
 * @returns {string | undefined}
 */
function pickField(content, aliases) {
  const key = aliases.find((k) => typeof content[k] === 'string' && content[k].trim());
  return key ? content[key].trim() : undefined;
}

/**
 * Normalizes one proposition item's content into renderable fields,
 * regardless of the exact field names an AJO author used.
 * @param {object} item A proposition item (`proposition.items[n]`)
 * @returns {{ html: string } | {
 *   headline: string, description?: string, ctaText?: string, ctaHref?: string
 * } | null}
 */
function normalizeItemContent(item) {
  const { schema, data } = item || {};
  if (!data) return null;

  if (schema === 'https://ns.adobe.com/personalization/html-content-item' && typeof data.content === 'string') {
    return { html: data.content };
  }

  if (schema === 'https://ns.adobe.com/personalization/json-content-item') {
    const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
    if (!content || typeof content !== 'object') return null;

    const headline = pickField(content, FIELD_ALIASES.headline);
    const description = pickField(content, FIELD_ALIASES.description);
    const ctaText = pickField(content, FIELD_ALIASES.ctaText);
    const ctaHref = pickField(content, FIELD_ALIASES.ctaHref);
    if (!headline && !description) return null;

    return {
      headline: headline || '', description, ctaText, ctaHref,
    };
  }

  // Unrecognized/unsupported schema (e.g. dom-action, ruleset) — nothing this
  // block knows how to render.
  return null;
}

/**
 * Requests a personalized decision for a given scope and normalizes
 * whatever Adobe returns into simple renderable fields.
 * @param {string} decisionScope
 * @returns {Promise<{
 *   html?: string, headline?: string, description?: string,
 *   ctaText?: string, ctaHref?: string, proposition: object
 * } | null>}
 */
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
    const normalized = normalizeItemContent(item);
    if (!normalized) return null;

    return { ...normalized, proposition };
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
