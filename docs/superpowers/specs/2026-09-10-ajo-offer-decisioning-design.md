# AJO Offer Decisioning integration — design

Status: approved by user 2026-09-10. Blocked on one prerequisite before
implementation can start (see "Prerequisite" below).

## Purpose

Add real, personalized offer banners to the Heineken 0.0 Silverstone GP
demo site (see
[2026-09-09-heineken-silverstone-site-design.md](./2026-09-09-heineken-silverstone-site-design.md)),
sourced from Adobe Journey Optimizer's Offer Decisioning rather than
static/authored content. Example offer categories the user wants to be able
to demonstrate: a pre-sale promo, a hospitality/grandstand ticket upgrade
upsell, a merch/fan-zone promo, and a race-weekend reminder. These are
illustrative categories, not real existing campaigns — the actual Decision
Policies and Offers are authored by the user directly in the AJO UI (this
project has no tool access that can create them — see "Tooling
constraint" below).

## Non-goals

- Designing the actual Decision Policy logic (segmentation, eligibility
  rules, ranking) — that's entirely the user's responsibility in the AJO
  UI. This project's scope is: request a decision correctly for a given
  placement, render whatever comes back, and report engagement back to
  AEP. Which offer wins for which visitor is out of scope here.
- Fabricating realistic audience/behavioral profile data to make
  personalization meaningfully differ per visitor (the user explicitly
  deferred this — "wire the mechanism correctly," not "also build
  realistic segments").
- A second SDK or script tag. This reuses the Adobe Web SDK (`alloy.js`)
  and datastream (`8b082166-1bea-41ac-9f3b-f5d9f691bc86`) already
  integrated into the site — Offer Decisioning is served over the same
  Edge Network call surface as analytics.

## Tooling constraint

The AJO MCP connector available in this environment
(`mcp__d135d12d-6ad1-4b7b-ac20-f3891865a03b__*`) is **read-only**: it can
list/inspect existing Campaigns and Journeys, but its own skill docs
explicitly state it does not support creating or editing anything, and it
has no concept of Offers or Decision Policies at all (only Campaigns and
Journeys). It also errored on `ajo_sandbox_list` and returned "insufficient
permissions" for `ajo_campaign_list` against `sandbox51` when tested
2026-09-10 — its reliability is unconfirmed even for its documented
read-only scope. As a result, all AJO-side authoring (Decision Policies,
Offers, decision scopes/surfaces) must happen through the AJO web UI,
done by the user. This project only builds the site-side request/render
integration.

## Prerequisite (blocks implementation start)

The exact decision-scope/surface identifier format Adobe's current Offer
Decisioning expects via the Web SDK needs to be verified empirically
against a real scope — the same way the datastream ID and edge endpoint
were verified via direct `curl` calls during the original site's design
(see the other spec's "Existing infrastructure" section for that
precedent). The user will create one minimal test Decision Policy + Offer
in AJO (sandbox `sandbox51`) and provide the resulting decision scope or
surface identifier. **Implementation cannot start until this is
provided** — the first implementation step, once it is, is a `curl`
verification test (see "Verification gate" below), not writing the
block's code directly from documentation alone.

## Placements

One `offer-banner` block per page, each independently requesting its own
decision scope (not one shared scope for the whole site):

| Page | Illustrative offer category |
|---|---|
| Home | Pre-sale / general awareness offer |
| Tickets | Ticket upgrade upsell (e.g. Grandstand, Hospitality) |
| Merch | Merch / fan-zone promo |
| Race Intel | Race-weekend reminder |

Each page's authored content specifies which decision scope it requests
(same authoring pattern as `product-grid`'s data-source link — a value in
the block's content, not hardcoded in the block's JS), so a page can be
pointed at a different scope without any code change.

## Architecture

### `scripts/decisioning.js` (new shared module)

Wraps the Web SDK's personalization request and normalizes the response:

```js
/**
 * Requests a personalized decision for a given scope and normalizes
 * whatever Adobe returns into simple renderable fields.
 * @param {string} decisionScope
 * @returns {Promise<{ headline: string, description: string, ctaText: string, ctaHref: string } | null>}
 */
export async function getOffer(decisionScope) { ... }
```

- Calls `window.alloy('sendEvent', { renderDecisions: true, decisionScopes: [decisionScope] })`.
- On success, extracts the first qualifying proposition's content and maps
  it to `{ headline, description, ctaText, ctaHref }`. The exact property
  paths inside the response depend on the verification step (see
  "Prerequisite") — this function is the single place that translates
  Adobe's raw shape into the app's simple contract, so nothing else in the
  codebase needs to know Adobe's schema.
- Returns `null` (not a thrown error) when: the call fails, times out, or
  no proposition qualifies for this scope. Callers treat `null` as "render
  nothing" — never a broken/error UI state.
- Exports a second function to report engagement back to AEP (see "Closing
  the loop" below).

### `blocks/offer-banner/offer-banner.js` / `.css` (new block)

- Reads the decision scope from the block's authored content (a single
  text value, same pattern as how `product-grid` reads a data-source
  link).
- Calls `getOffer(scope)`. If it resolves to an offer, renders a headline,
  description, and a CTA button linking to `ctaHref`. If it resolves to
  `null`, the block renders **nothing** — no empty box, no placeholder
  text, no console error visible to a site visitor. (Internally, a
  `console.error` for actual failures is fine, matching the rest of the
  site's error-handling convention — just never user-visible broken UI.)
- CSS scoped to `.offer-banner`, reusing the same shared `--card-radius` /
  `--card-shadow` / brand-color variables as the rest of the site's
  premium/sporty styling pass, so it looks native to the rest of the
  site rather than bolted on.

### Closing the loop: proposition display/interact events

Default behavior (flagged during design, not objected to): when a banner
renders, fire `decisioning.propositionDisplay`; when its CTA is clicked,
fire `decisioning.propositionInteract`. These are the standard AEP/AJO
event types for measuring and optimizing Decision Policies — without
them, AJO has no signal that its offers were ever shown or acted on.
Implementation reuses the existing `trackEvent()` helper from
`scripts/analytics.js` (Task 1 of the original site plan), passing
whatever proposition/decision identifiers the verification step confirms
are needed in the event payload for AJO to attribute it back to the
correct decision.

## Verification gate (first implementation step, not a later task)

Once the user provides a real decision scope:

1. `curl` the Edge Network interact endpoint directly (same pattern used
   throughout the original site's build) with a minimal
   `renderDecisions`/`decisionScopes` payload against that scope, and
   inspect the raw response shape.
2. Confirm: what a "no offer qualifies" response looks like (so
   `getOffer()`'s `null`-return path is correct), and what a real
   proposition's content structure looks like (so the headline/
   description/CTA extraction logic is correct) — plus what identifiers
   the response contains that `propositionDisplay`/`propositionInteract`
   events need to reference.
3. Only after this is confirmed does `scripts/decisioning.js`'s actual
   parsing logic get written — not before, and not from documentation
   alone, matching this project's established practice of verifying
   Adobe API behavior empirically rather than assuming it.

## Verification plan (post-implementation, matches original site's pattern)

- Local preview + Browser pane, inspecting `window.alloy.q` for the
  `sendEvent` call with `renderDecisions`/`decisionScopes` (same technique
  used to verify page-view/commerce/identity events during the original
  site's build, since the sandboxed Browser tool cannot reach Adobe's real
  Edge Network domains).
- Confirm each page's `offer-banner` renders when a qualifying offer
  exists for its scope, and renders nothing (cleanly) when it doesn't —
  test both states if the user can toggle the AJO-side eligibility rules.
- Confirm `decisioning.propositionDisplay` fires on render and
  `decisioning.propositionInteract` fires on CTA click, both via the same
  `window.alloy.q` inspection technique.

## Known open question (not blocking, to resolve during/after the
verification gate)

The exact identifiers a `propositionInteract` event needs to reference
(to let AJO attribute the click back to the specific decision/proposition
that was shown) are part of what the verification step needs to confirm —
this spec describes the intent (report engagement back to AEP) but not
the exact payload shape, since that shape is what the Prerequisite's
empirical test exists to determine.
