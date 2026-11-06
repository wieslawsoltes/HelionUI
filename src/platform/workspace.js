// Browser navigation/lifecycle only. No document snapshots or GPU readbacks.
// Direct and standalone pages remain independently runnable.
function host() {
  try { return window.parent !== window ? window.parent.__HELION_WORKSPACE_HOST__ : null; }
  catch { return null; }
}
export function startWorkspace(surface) {
  if (!host()?.register(window, surface)) surface.start();
}
export function navigateWorkspace(route, fallback) {
  if (!host()?.navigate(window, route)) location.href = fallback;
}
