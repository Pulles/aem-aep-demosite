import { setAnalyticsConsent, trackEvent, trackPageView } from './analytics.js';

function renderPhoto(gallery, photo) {
  const item = document.createElement('li');
  item.className = 'fan-gallery-card';
  item.innerHTML = `
    <img src="${photo.src}" alt="${photo.caption}" />
    <div>
      <strong>${photo.caption}</strong>
      <span>${photo.context}</span>
    </div>
  `;
  gallery.prepend(item);
}

function trackPhotoAdded(photo) {
  return trackEvent('web.webinteraction.linkClicks', {
    web: {
      webInteraction: {
        name: 'Fan race setup photo added',
        type: 'other',
        URL: `${window.location.href}#fan-gallery-photo-add`,
        linkClicks: { value: 1 },
      },
    },
    _demopotemea: {
      interactionDetails: {
        core: {
          action: 'fan-gallery-photo-add',
          channel: 'web',
          personalizationAnchor: 'raceViewingSetup',
          galleryContext: photo.context,
          photoCaption: photo.caption,
        },
      },
    },
  });
}

function initFanGallery() {
  const form = document.querySelector('.fan-gallery-form');
  const input = document.querySelector('#fan-gallery-photo');
  const gallery = document.querySelector('.fan-gallery-list');
  const preview = document.querySelector('.fan-gallery-preview');
  if (!form || !input || !gallery || !preview) return;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      preview.hidden = true;
      preview.removeAttribute('src');
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = input.files?.[0];
    const caption = form.elements.caption.value.trim();
    const context = form.elements.context.value;
    if (!file || !caption) return;

    const photo = {
      caption,
      context,
      src: preview.src,
      fileType: file.type,
      addedAt: new Date().toISOString(),
    };
    renderPhoto(gallery, photo);
    trackPhotoAdded(photo).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Fan gallery photo event failed', error);
    });
    form.reset();
    preview.hidden = true;
    preview.removeAttribute('src');
  });
}

setAnalyticsConsent(true).then(() => trackPageView()).catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fan gallery page-view tracking failed', error);
});

initFanGallery();
