import { useCallback, useEffect, useRef, useState } from "react";

export type Loadable<T> =
  | { state: "loading"; data: T | null; lastSuccessAt?: number }
  | { state: "ready"; data: T; source: "live" | "cache"; fetchedAt: number }
  | { state: "failed"; data: T | null; error: Error; retained: boolean; lastSuccessAt?: number };

export function useResource<T>(key: string | null, read: () => Promise<{ data: T; stale?: boolean }>, cached?: () => Promise<T | null>) {
  const [entry, setEntry] = useState<{ key: string | null; resource: Loadable<T> }>({ key, resource: { state: "loading", data: null } });
  const reader = useRef(read);
  reader.current = read;
  const cacheReader = useRef(cached);
  cacheReader.current = cached;
  const identity = useRef(key);
  identity.current = key;
  const generation = useRef(0);
  const reload = useCallback(async (throwOnError = false) => {
    const request = ++generation.current;
    if (key === null) return;
    setEntry(previous => ({ key, resource: {
      state: "loading", data: previous.key === key ? previous.resource.data : null,
      lastSuccessAt: previous.key === key ? successTime(previous.resource) : undefined,
    } }));
    let settled = false;
    // Cache painting shares the request identity and cannot replace a newer
    // live response or another student's resource. It stays visibly stale.
    void cacheReader.current?.().then(data => {
      if (data === null || settled || request !== generation.current || identity.current !== key) return;
      setEntry(previous => previous.key === key && previous.resource.data !== null ? previous : {
        key, resource: { state: "loading", data },
      });
    }).catch(() => {});
    try {
      const result = await reader.current();
      settled = true;
      if (request !== generation.current || identity.current !== key) return;
      setEntry({ key, resource: { state: "ready", data: result.data, source: result.stale ? "cache" : "live", fetchedAt: Date.now() } });
    } catch (cause) {
      settled = true;
      if (request !== generation.current || identity.current !== key) return;
      setEntry(previous => ({ key, resource: {
        state: "failed", data: previous.resource.data,
        retained: previous.resource.data !== null,
        lastSuccessAt: successTime(previous.resource),
        error: cause instanceof Error ? cause : new Error("The request could not be completed."),
      } }));
      if (throwOnError) throw cause;
    }
  }, [key]);
  useEffect(() => {
    void reload();
    return () => { ++generation.current; };
  }, [reload]);
  const resource: Loadable<T> = entry.key === key ? entry.resource : { state: "loading", data: null };
  return { resource, reload };
}

function successTime<T>(resource: Loadable<T>) {
  return resource.state === "ready" ? resource.fetchedAt : resource.lastSuccessAt;
}

export function isStale<T>(resource: Loadable<T>) {
  return resource.state === "ready" ? resource.source === "cache" : resource.data !== null;
}
