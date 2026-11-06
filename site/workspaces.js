// Only the four known, same-origin child windows may register or navigate.
// Switching never serializes a document or remounts a retained surface.
export function createWorkspaceHost({entries, active, visible, navigate}) {
  const entryFor = child => [...entries.values()].find(entry => entry.frame.contentWindow === child);
  function sync() {
    for (const [id, entry] of entries) {
      const surface = entry.surface;
      if (!surface || surface.disposed) continue;
      if (id === active() && visible()) surface.start();
      else surface.stop();
    }
  }
  return {
    sync,
    register(child, surface) {
      const entry = entryFor(child);
      if (!entry) return false;
      entry.surface = surface;
      sync();
      return true;
    },
    navigate(child, route) {
      if (!entryFor(child)) return false;
      return navigate(route);
    }
  };
}
