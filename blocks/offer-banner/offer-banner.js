import { getOffer, trackOfferDisplay, trackOfferInteract } from '../../scripts/decisioning.js';

/**
 * Renders a personalized offer banner from AJO Offer Decisioning.
 * Renders nothing if no offer qualifies for this scope — never a
 * broken/empty box.
 * @param {Element} block
 */
export default async function decorate(block) {
  const scope = block.textContent.trim();
  block.textContent = '';
  if (!scope) return;

  const offer = await getOffer(scope);
  if (!offer) return;

  const content = document.createElement('div');
  content.className = 'offer-banner-content';

  if (offer.html) {
    // Trusted: this HTML comes from our own configured AEP org's Offer
    // Decisioning response, not arbitrary user input.
    content.innerHTML = offer.html;
  } else {
    if (offer.headline) {
      const headline = document.createElement('h3');
      headline.textContent = offer.headline;
      content.append(headline);
    }
    if (offer.description) {
      const description = document.createElement('p');
      description.textContent = offer.description;
      content.append(description);
    }
    if (offer.ctaText && offer.ctaHref) {
      const cta = document.createElement('a');
      cta.className = 'button primary';
      cta.href = offer.ctaHref;
      cta.textContent = offer.ctaText;
      content.append(cta);
    }
  }

  content.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => trackOfferInteract(offer.proposition));
  });

  block.append(content);
  trackOfferDisplay(offer.proposition);
}
