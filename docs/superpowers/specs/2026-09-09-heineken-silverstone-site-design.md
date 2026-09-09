# Heineken 0.0 Silverstone GP demo site — design

Status: approved by user 2026-09-09. Ready for implementation planning.

## Purpose

A demo/showcase AEM Edge Delivery Services (EDS) site for a fictional Heineken
0.0 presence around the Silverstone Grand Prix, used to demonstrate AEM +
Adobe Experience Platform (AEP) Web SDK behavioral tracking, including
identity stitching for "logged in" users. This is **not** a production
commerce site — ticket and merch "ordering" are simulated flows for
demo purposes. No real payments, no real authentication, no real inventory.

## Non-goals

- Real payment processing, inventory, or order fulfillment.
- Real user authentication (passwords, sessions, account recovery).
- Reproducing actual Heineken trademarked logo artwork or copying text from
  the (inaccessible) Scribd brand guidelines document. Placeholder branding
  only, using Heineken 0.0's publicly-known green/red/silver color
  association.
- Building new AEP schema, sandbox, or datastream — an existing one is
  reused (see below).

## Existing infrastructure (reused, not built)

- **AEM EDS site repo:** [github.com/Pulles/aem-aep-demosite](https://github.com/Pulles/aem-aep-demosite),
  cloned locally at `/Users/pvanoosterho/AEM_AEP demosite`. Built from
  `adobe/aem-boilerplate`. `aem-code-sync` GitHub App installed; DA
  (Document Authoring) content already provisioned and authenticated
  (personal Adobe ID `paulvanoosterhout@gmail.com`, cached at
  `~/.aem/da-token.json`).
- **AEP org/sandbox:** IMS org `8AB51935659C10E40A495FA2@AdobeOrg`
  ("DEMO POT EMEA" / `demopotemea`), sandbox `sandbox51`, region `irl1`.
- **AEP datastream:** ID `8b082166-1bea-41ac-9f3b-f5d9f691bc86`, bound to
  schema **"Demo System - Event Schema for Website (Global v1.1)"**.
  Verified working 2026-09-09 via direct `POST` to
  `https://edge.adobedc.net/ee/irl1/v1/interact?configId=8b082166-1bea-41ac-9f3b-f5d9f691bc86`:
  - A bare `web.webpagedetails.pageViews` event returns `200`, mints an
    ECID, and returns location hint `irl1`.
  - A `commerce.productListAdds` event with `identityMap.Email` and a
    `productListItems[]` array also returns `200` — confirms the schema
    tolerates standard XDM Commerce Details fields and the `Email`
    identity namespace is valid for this org.
  - Note: `https://dcs.adobedc.net/collection/{id}` (the endpoint
    initially assumed) returned `400 Inlet does not exist` — the correct
    endpoint for this org/datastream is `edge.adobedc.net` with a
    region-specific path (`/ee/irl1/v1/interact`), not `dcs.adobedc.net`.

## Site structure

Five pages, all authored in DA under `Pulles/aem-aep-demosite`:

| Page | Content |
|---|---|
| **Home** (`/`) | Hero banner, event highlights, links into other sections |
| **Tickets** (`/tickets`) | Ticket tiers (grandstand, general admission, hospitality) as a product grid, add-to-cart |
| **Merch** (`/merch`) | Merch product grid (apparel, accessories), add-to-cart |
| **Race Intel** (`/race-intel`) | Race weekend schedule, session times, news blurbs — static authored content, default blocks |
| **Circuit** (`/circuit`) | Silverstone circuit facts (length, corners, lap record), track image — static authored content, default blocks |

### Blocks

- **Reused as-is / with CSS variants:** `hero`, `cards`, `columns`,
  `header`, `footer` (from `adobe/aem-boilerplate`).
- **New — `login`:** Mock login/registration widget in the header.
  Captures name + email (no password), no server-side validation. On
  submit, persists identity to `localStorage` and fires an
  `authentication.login` or `authentication.registration` XDM event
  (see Event model). Updates header UI to show the logged-in name +
  a logout control.
- **New — `cart`:** Shared add-to-cart / cart-drawer / mock-checkout
  block used by both Tickets and Merch pages. Cart state in
  `localStorage`. "Place order" produces a fake order confirmation
  (order number, summary) with no real payment step. Fires
  `commerce.productListAdds`, `commerce.checkouts`, and
  `commerce.purchases` events (see Event model).
- **New — `product-grid`:** Renders a grid of items (tickets or merch)
  from a DA sheet data source, with an "Add to cart" action per item
  that hands off to the `cart` block's logic.

### Content data model

- `/tickets.json` — DA sheet: ticket tiers (SKU, name, description,
  price, image).
- `/merch.json` — DA sheet: merch items (SKU, name, description, price,
  image, category).

This keeps catalog-shaped data (tickets, merch) in an easily-editable
sheet, while narrative content (circuit facts, race schedule, hero copy)
stays hand-authored directly in DA pages using default EDS content —
per the approved "hybrid" approach.

## AEP Web SDK integration

- `alloy.js` (Adobe Web SDK) loaded via `<script>` in `head.html`,
  configured with:
  - `edgeConfigId: 8b082166-1bea-41ac-9f3b-f5d9f691bc86`
  - `orgId: 8AB51935659C10E40A495FA2@AdobeOrg`
  - default edge domain (`edge.adobedc.net`); region auto-resolves via
    location hint (observed `irl1` in testing).
- A page-view (`web.webpagedetails.pageViews`) event fires on every page
  load, site-wide, via `scripts.js`.
- Once a user has logged in/registered (mock), their email is read from
  `localStorage` and attached as `identityMap.Email` on every subsequent
  Web SDK event for the rest of the session — this is the "track logged
  in users" mechanism. Anonymous (not-logged-in) visitors are tracked
  only by the ECID Web SDK mints automatically; no email is sent.

### Event model (site action → XDM event)

| Site action | `eventType` | Key fields |
|---|---|---|
| Any page load | `web.webpagedetails.pageViews` | `web.webPageDetails.name`, `web.webPageDetails.URL` |
| View a ticket tier or merch item | `commerce.productViews` | `productListItems[]` |
| Add to cart (ticket or merch) | `commerce.productListAdds` | `productListItems[]` (`SKU`, `name`, `priceTotal`, `quantity`) |
| Begin mock checkout | `commerce.checkouts` | `productListItems[]` |
| Complete mock order | `commerce.purchases` | `commerce.order.priceTotal`, `productListItems[]` |
| Mock login | `authentication.login` (custom eventType string) | `identityMap.Email` |
| Mock registration | `authentication.registration` (custom eventType string) | `identityMap.Email` |

`authentication.login` / `authentication.registration` are not part of
the standard XDM controlled vocabulary but were empirically confirmed
(2026-09-09) not to break ingestion on this datastream — acceptable for
a demo. If stricter downstream reporting requires a standard eventType,
these could be swapped for a generic value with a custom field
distinguishing login vs. registration; not needed for this design.

## Branding

Placeholder only: Heineken 0.0's publicly-known green (`#00843D`-ish),
red accent, and silver/white color association, with generic/stock
F1-style and Silverstone circuit imagery. No real Heineken logo
artwork, no content copied from the (inaccessible) Scribd brand
guidelines document.

## Verification plan

- Local preview via `npx @adobe/aem-cli up` in the project directory.
- For each tracked action (page load, add-to-cart, checkout, login),
  confirm a `200` response from `edge.adobedc.net` in the browser
  Network tab, matching the pattern verified via curl during design.
- No automated AEP-side verification (e.g. checking the event landed in
  a dataset) is in scope — out of reach without working schema/sandbox
  API access in this environment (see below).

## Known constraint

The AJO MCP server available in this environment returns
`403: User region is missing` for `ajo-get-sandboxes` and
`ajo-get-namespaces`, regardless of org/sandbox — appears to be a
broken/misconfigured session for this connector, not a permissions
issue. It also only exposes AJO campaign/decisioning tools, not
schema/datastream authoring. As a result, AEP-side configuration
changes (if ever needed) require the Experience Platform web UI
(`experience.adobe.com`, which is also unreachable from the sandboxed
Browser pane — blocked by policy) rather than API/MCP automation.
This design avoids needing any such changes by reusing the existing
schema and datastream as-is.
