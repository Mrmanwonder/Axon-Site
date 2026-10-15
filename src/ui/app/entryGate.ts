/** Public landing must not boot auth. Unknown/blocked storage and every deep
 * link or auth callback take the established application recovery path. */
export function needsApplication(location: Pick<Location, "pathname" | "search" | "hash">, storage: () => Storage = () => localStorage): boolean {
  if (!['/', '/index.html'].includes(location.pathname) || location.search || location.hash) return true;
  try {
    const saved = storage();
    for (let i = 0; i < saved.length; i++) {
      if (/^sb-.+-auth-token$/.test(saved.key(i) ?? "")) return true;
    }
    return false;
  } catch { return true; }
}
