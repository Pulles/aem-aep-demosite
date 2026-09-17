import { loadCSS } from './aem.js';
import { trackEvent } from './analytics.js';

const FEATURE_EVENTS = {
  subscribe: 'Subscribe race alerts',
  timing: 'Show live timing',
  positions: 'Show track positions',
  penalytics: 'Show penalytics',
};

function trackRaceIntelInteraction(action, label) {
  return trackEvent('web.webinteraction.linkClicks', {
    web: {
      webInteraction: {
        name: label,
        type: 'other',
        URL: `${window.location.href}#race-intel-${action}`,
        linkClicks: { value: 1 },
      },
    },
    _demopotemea: {
      interactionDetails: {
        core: {
          action,
          channel: 'web',
        },
      },
    },
  });
}

function createMetric(label, value, detail) {
  const item = document.createElement('li');
  item.className = 'race-intel-metric';
  item.innerHTML = `<span>${label}</span><strong>${value}</strong><small>${detail}</small>`;
  return item;
}

function createPosition(driver, team, gap, status) {
  const row = document.createElement('li');
  row.className = 'race-intel-position';
  row.innerHTML = `
    <span class="race-intel-position-rank">${driver}</span>
    <span>${team}</span>
    <strong>${gap}</strong>
    <small>${status}</small>
  `;
  return row;
}

function createPenalty(title, risk, detail) {
  const item = document.createElement('li');
  item.className = 'race-intel-penalty';
  item.innerHTML = `<strong>${title}</strong><span>${risk}</span><small>${detail}</small>`;
  return item;
}

function setActivePanel(block, action) {
  block.querySelectorAll('.race-intel-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== action;
  });
  block.querySelectorAll('.race-intel-action').forEach((button) => {
    button.classList.toggle('active', button.dataset.action === action);
    button.setAttribute('aria-pressed', String(button.dataset.action === action));
  });
}

function buildEnhancement() {
  const block = document.createElement('section');
  block.className = 'race-intel-enhancement';
  block.innerHTML = `
    <div class="race-intel-header">
      <div>
        <p class="race-intel-kicker">Race control</p>
        <h2>Live Silverstone intelligence</h2>
      </div>
      <button type="button" class="button primary race-intel-subscribe" data-action="subscribe">Subscribe to alerts</button>
    </div>
    <div class="race-intel-actions" role="group" aria-label="Race intelligence views">
      <button type="button" class="race-intel-action active" data-action="timing" aria-pressed="true">Timing</button>
      <button type="button" class="race-intel-action" data-action="positions" aria-pressed="false">Positions</button>
      <button type="button" class="race-intel-action" data-action="penalytics" aria-pressed="false">Penalytics</button>
    </div>
    <div class="race-intel-panel" data-panel="timing">
      <ul class="race-intel-metrics"></ul>
    </div>
    <div class="race-intel-panel" data-panel="positions" hidden>
      <ul class="race-intel-positions"></ul>
    </div>
    <div class="race-intel-panel" data-panel="penalytics" hidden>
      <ul class="race-intel-penalties"></ul>
    </div>
  `;

  const metrics = block.querySelector('.race-intel-metrics');
  metrics.append(
    createMetric('Fastest lap', '1:29.481', 'Sector 2 purple'),
    createMetric('Pit window', 'Laps 18-24', 'Medium to hard crossover'),
    createMetric('Track temp', '32 C', 'Grip rising'),
  );

  const positions = block.querySelector('.race-intel-positions');
  positions.append(
    createPosition('P1', 'Green Star Racing', '+0.000', 'Clean air'),
    createPosition('P2', 'Silverstone Works', '+1.842', 'DRS threat'),
    createPosition('P3', 'Zero Zero GP', '+5.213', 'Tyre offset'),
  );

  const penalties = block.querySelector('.race-intel-penalties');
  penalties.append(
    createPenalty('Track limits', 'Medium risk', 'Cars 7 and 22 on final warning'),
    createPenalty('Unsafe release', 'Low risk', 'Pit lane under review cleared'),
    createPenalty('Overtake audit', 'High impact', 'Lap 12 move flagged for replay'),
  );

  block.querySelector('.race-intel-subscribe').addEventListener('click', (event) => {
    event.currentTarget.textContent = 'Subscribed';
    event.currentTarget.disabled = true;
    trackRaceIntelInteraction('subscribe', FEATURE_EVENTS.subscribe);
  });

  block.querySelectorAll('.race-intel-action').forEach((button) => {
    button.addEventListener('click', () => {
      const { action } = button.dataset;
      setActivePanel(block, action);
      trackRaceIntelInteraction(action, FEATURE_EVENTS[action]);
    });
  });

  return block;
}

export default async function initRaceIntel() {
  if (!window.location.pathname.replace(/\/$/, '').endsWith('/race-intel')) return;
  const main = document.querySelector('main');
  if (!main || main.querySelector('.race-intel-enhancement')) return;
  await loadCSS('/styles/race-intel.css');
  const firstSection = main.querySelector('.section');
  const enhancement = buildEnhancement();
  if (firstSection) {
    firstSection.after(enhancement);
  } else {
    main.append(enhancement);
  }
}
