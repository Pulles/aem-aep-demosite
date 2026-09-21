import { loadCSS } from './aem.js';
import { trackEvent } from './analytics.js';

const STORAGE_KEY = 'heineken-demo-circuit-predictions';
const DRIVERS = [
  'Max Verstappen',
  'Lando Norris',
  'Lewis Hamilton',
  'Charles Leclerc',
  'George Russell',
  'Oscar Piastri',
  'Carlos Sainz',
  'Fernando Alonso',
];

function createOptions(selectedDriver) {
  return DRIVERS.map((driver) => (
    `<option value="${driver}"${driver === selectedDriver ? ' selected' : ''}>${driver}</option>`
  )).join('');
}

function getPredictions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function savePredictions(predictions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions));
  } catch {
    // Saving is optional; the submitted prediction remains visible for this page view.
  }
}

function hasDuplicateDrivers(predictions) {
  const podium = [predictions.first, predictions.second, predictions.third];
  return new Set(podium).size !== podium.length;
}

function buildPredictionForm() {
  const savedPredictions = getPredictions();
  const section = document.createElement('section');
  section.className = 'circuit-predictions';
  section.innerHTML = `
    <div class="circuit-predictions-intro">
      <p class="circuit-predictions-kicker">Race weekend</p>
      <h2>Make your predictions</h2>
      <p>Choose the three drivers you expect on the podium and your fastest-lap pick.</p>
    </div>
    <form class="circuit-predictions-form">
      <fieldset>
        <legend>Top 3 drivers</legend>
        <label>First place<select name="first" required>${createOptions(savedPredictions.first || DRIVERS[0])}</select></label>
        <label>Second place<select name="second" required>${createOptions(savedPredictions.second || DRIVERS[1])}</select></label>
        <label>Third place<select name="third" required>${createOptions(savedPredictions.third || DRIVERS[2])}</select></label>
      </fieldset>
      <label class="circuit-predictions-fastest">Fastest lap time<input name="fastestLapTime" type="text" inputmode="decimal" pattern="[0-9]+:[0-5][0-9]\\.[0-9]{3}" placeholder="1:30.051" value="${savedPredictions.fastestLapTime || ''}" required /></label>
      <button type="submit" class="button primary">Save predictions</button>
      <p class="circuit-predictions-status" aria-live="polite"></p>
    </form>
  `;

  const form = section.querySelector('form');
  const status = section.querySelector('.circuit-predictions-status');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const predictions = Object.fromEntries(new FormData(form));
    if (hasDuplicateDrivers(predictions)) {
      status.textContent = 'Choose a different driver for each podium place.';
      return;
    }

    const submittedPredictions = {
      top3: [predictions.first, predictions.second, predictions.third],
      fastestLapTime: predictions.fastestLapTime,
    };
    savePredictions({ ...predictions, ...submittedPredictions });
    status.textContent = 'Predictions saved. Good luck for race day.';
    trackEvent('web.webinteraction.linkClicks', {
      web: {
        webInteraction: {
          name: 'Circuit predictions saved',
          type: 'other',
          URL: `${window.location.href}#circuit-predictions`,
          linkClicks: { value: 1 },
        },
      },
      _demopotemea: {
        heineken: {
          predictions: submittedPredictions,
        },
      },
    }).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Circuit prediction tracking failed', error);
    });
  });
  return section;
}

export default async function initCircuitPredictions() {
  if (!window.location.pathname.replace(/\/$/, '').endsWith('/circuit')) return;
  const main = document.querySelector('main');
  if (!main || main.querySelector('.circuit-predictions')) return;
  await loadCSS('/styles/circuit-predictions.css');
  const section = main.querySelector('.section');
  const predictions = buildPredictionForm();
  if (section) section.append(predictions);
  else main.append(predictions);
}
