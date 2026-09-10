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

  const headline = document.createElement('h3');
  headline.textContent = offer.headline;

  const description = document.createElement('p');
  description.textContent = offer.description;

  const cta = document.createElement('a');
  cta.className = 'button primary';
  cta.href = offer.ctaHref;
  cta.textContent = offer.ctaText;
  cta.addEventListener('click', () => trackOfferInteract(offer.proposition));

  content.append(headline, description, cta);
  block.append(content);

  trackOfferDisplay(offer.proposition);
}
