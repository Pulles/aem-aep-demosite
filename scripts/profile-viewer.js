const PROJECT_ID_KEY = 'heineken-demo-dsn-project-id';
const ACCESS_TOKEN_KEY = 'heineken-demo-dsn-access-token';
const DEFAULT_PROJECT_ID = 'trum-ABL7';
const PROFILE_VIEWER_SRC = '/plugins/profile-viewer/profile-viewer.js';
const LAUNCHER_ID = 'profile-viewer-launcher';
const PANEL_ID = 'profile-viewer-token-panel';
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

function removeTokenPanel() {
  document.getElementById(PANEL_ID)?.remove();
}

function showTokenPanel(onSubmit) {
  removeTokenPanel();
  const panel = document.createElement('form');
  panel.id = PANEL_ID;
  panel.style.position = 'fixed';
  panel.style.right = '18px';
  panel.style.bottom = '72px';
  panel.style.zIndex = '2147483645';
  panel.style.boxSizing = 'border-box';
  panel.style.display = 'grid';
  panel.style.gap = '8px';
  panel.style.width = 'min(320px, calc(100vw - 32px))';
  panel.style.border = '1px solid var(--brand-silver)';
  panel.style.borderRadius = '6px';
  panel.style.padding = '14px';
  panel.style.background = 'var(--background-color)';
  panel.style.boxShadow = 'var(--card-shadow)';
  panel.innerHTML = `
    <label for="profile-viewer-token">Demo System access token</label>
    <input id="profile-viewer-token" name="accessToken" type="password" autocomplete="off" required />
    <button type="submit" class="button primary">Open profile</button>
  `;
  panel.addEventListener('submit', async (event) => {
    event.preventDefault();
    const accessToken = panel.elements.accessToken.value.trim();
    if (!accessToken) return;
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    removeTokenPanel();
    await onSubmit();
  });
  document.body.append(panel);
  panel.elements.accessToken.focus();
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

function getAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

function useCookieAuth() {
  return new URLSearchParams(window.location.search).get('dsnUseCookies') === 'true';
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
  const accessToken = getAccessToken();
  if (!accessToken && !useCookieAuth()) {
    showLauncher(() => {
      showTokenPanel(async () => {
        await initProfileViewer();
        await openProfileViewer();
      });
    });
    return;
  }
  if (!initialized) {
    await loadProfileViewerRuntime();
    window.ProfileViewer.initialize({
      projectId,
      ...(accessToken && { accessToken }),
      apiEnvironment: 'prod',
      colorScheme: 'light',
      autofetch: 'on-toggle',
    });
    initialized = true;
  }
  showLauncher(async () => {
    if (!getAccessToken() && !useCookieAuth()) {
      showTokenPanel(async () => {
        await initProfileViewer();
        await openProfileViewer();
      });
      return;
    }
    if (!initialized) {
      await initProfileViewer();
    }
    await openProfileViewer();
  });
}