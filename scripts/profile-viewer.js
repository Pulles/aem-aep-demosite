const PROJECT_ID_KEY = 'heineken-demo-dsn-project-id';
const DEFAULT_PROJECT_ID = 'trum-ABL7';
const PROFILE_VIEWER_SRC = '/plugins/profile-viewer/profile-viewer.js';
const LAUNCHER_ID = 'profile-viewer-launcher';
let initialized = false;

function waitForDsnApi() {
  if (window.DSN?.showSignInDialog) return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener('dsnApiReady', resolve, { once: true });
  });
}

async function openProfileViewer() {
  await waitForDsnApi();
  window.DSN.showSignInDialog();
}

function buildLauncher() {
  const launcher = document.createElement('button');
  launcher.id = LAUNCHER_ID;
  launcher.type = 'button';
  launcher.textContent = 'Profile';
  launcher.setAttribute('aria-label', 'Open profile viewer');
  launcher.style.position = 'fixed';
  launcher.style.right = '18px';
  launcher.style.bottom = '18px';
  launcher.style.zIndex = '2147483645';
  launcher.style.border = '1px solid var(--brand-green-dark)';
  launcher.style.borderRadius = '6px';
  launcher.style.padding = '10px 14px';
  launcher.style.background = 'var(--brand-green)';
  launcher.style.color = 'var(--background-color)';
  launcher.style.boxShadow = 'var(--card-shadow)';
  launcher.style.font = '700 14px var(--body-font-family)';
  launcher.style.cursor = 'pointer';
  return launcher;
}

function showLauncher(onClick) {
  const existing = document.getElementById(LAUNCHER_ID);
  if (existing) existing.remove();
  const launcher = buildLauncher();
  launcher.addEventListener('click', onClick);
  document.body.append(launcher);
}

function promptForProjectId() {
  // eslint-disable-next-line no-alert
  const projectId = window.prompt('Demo System Project ID');
  if (!projectId) return null;
  const trimmed = projectId.trim();
  if (!trimmed) return null;
  localStorage.setItem(PROJECT_ID_KEY, trimmed);
  return trimmed;
}

function getProjectId() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('dsnProjectId');
  if (projectId) {
    localStorage.setItem(PROJECT_ID_KEY, projectId);
    return projectId;
  }
  return localStorage.getItem(PROJECT_ID_KEY) || DEFAULT_PROJECT_ID;
}

function loadProfileViewerRuntime() {
  if (window.ProfileViewer) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PROFILE_VIEWER_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = PROFILE_VIEWER_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

export default async function initProfileViewer() {
  const projectId = getProjectId();
  if (!projectId) {
    showLauncher(async () => {
      const configuredProjectId = promptForProjectId();
      if (!configuredProjectId) return;
      await initProfileViewer();
      await openProfileViewer();
    });
    return;
  }
  if (initialized) {
    showLauncher(openProfileViewer);
    return;
  }
  await loadProfileViewerRuntime();
  window.ProfileViewer.initialize({
    projectId,
    apiEnvironment: 'prod',
    colorScheme: 'light',
    autofetch: 'on-toggle',
  });
  initialized = true;
  showLauncher(openProfileViewer);
}