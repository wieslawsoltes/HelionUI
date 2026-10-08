/** A dependency-free bootstrap, embedded before application-module evaluation.
 * It reports unsupported file launches without disabling origin/CSP security.
 * Keep this function self-contained: build tooling serializes its exact body. */
export function launchApplication(entry, {version, standalone = false, path = '/'} = {}) {
  const notice = document.getElementById('boot');
  const detail = document.getElementById('boot-detail') || notice;
  const show = (title, message) => {
    if (notice) {
      notice.hidden = false;
      notice.classList.add('failed');
      notice.setAttribute('role', 'alert');
    }
    const heading = document.getElementById('boot-title');
    if (heading) heading.textContent = title;
    if (detail) { detail.style.whiteSpace = 'pre-wrap'; detail.style.overflowWrap = 'anywhere'; detail.style.maxHeight = '45vh'; detail.style.overflow = 'auto'; detail.textContent = message; }
    const hint = document.getElementById('boot-hint');
    if (hint) hint.textContent = 'Use the complete package on localhost or HTTPS. Browser security stays enabled.';
  };
  const protocol = globalThis.location?.protocol;
  if (protocol === 'file:' || protocol === 'data:') {
    const filename = standalone && protocol === 'file:'
      ? (new URL(globalThis.location.href).pathname.split('/').pop() || 'helion-standalone.html')
      : 'helion-standalone.html';
    const target = standalone ? '/' + filename : path;
    const instructions = standalone
      ? 'Extract the complete ZIP and run its start-helion launcher.\nOr, in the folder containing this HTML file, run:\n\npython3 -m http.server 8080 --bind 127.0.0.1'
      : 'From the extracted helion-ui project root, run:\n\nnpm start';
    show('Open Helion through localhost',
      `This ${protocol} document has an isolated browser origin. Direct file opening is not supported.\n\n${instructions}\n\nThen open:\nhttp://127.0.0.1:8080${target}\n\nBuild: ${version}.\nBrowser security remains enabled; no worker or GPU startup was attempted.`);
    const tip = notice?.querySelector?.('small');
    if (tip) tip.textContent = 'Start the local server first; keyboard/font commands become available after the app loads.';
    globalThis.__HELION_LAUNCH_STATUS__ = 'needs-server';
    return false;
  }
  globalThis.__HELION_LAUNCH_STATUS__ = 'loading';
  // Dynamic import keeps the local-file check ahead of all module evaluation.
  return import(entry).then(() => {
    globalThis.__HELION_LAUNCH_STATUS__ = 'module-loaded';
    return true; // Application GPU readiness is reported by the app, not here.
  }, error => {
    globalThis.__HELION_LAUNCH_STATUS__ = 'module-error';
    show('Helion could not load its application', `${error.message}\n\nBuild: ${version}.\nUse the complete replacement package on localhost or HTTPS; do not mix release files.`);
    console.error(error);
    return false;
  });
}
