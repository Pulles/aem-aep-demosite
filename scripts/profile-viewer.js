const PROJECT_ID_KEY = 'heineken-demo-dsn-project-id';
const DEFAULT_PROJECT_ID = 'pvanoosterho-MDF1';
const PROFILE_VIEWER_SRC = '/plugins/profile-viewer/profile-viewer.js';
let initialized = false;

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
    promptForProjectId();
    return;
  }
  if (initialized) {
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
}
