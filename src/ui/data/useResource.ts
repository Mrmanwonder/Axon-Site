import { useCallback, useEffect, useRef, useState } from "react";

export type Loadable<T> =
  | { state: "loading"; data: T | null; lastSuccessAt?: number }
  | { state: "ready"; data: T; source: "live" | "cache"; fetchedAt: number }
  | { state: "failed"; data: T | null; error: Error; retained: boolean; lastSuccessAt?: number };

export function useResource<T>(key: string | null, read: () => Promise<{ data: T; stale?: boolean }>) {
  const [entry, setEntry] = useState<{ key: string | null; resource: Loadable<T> }>({ key, resource: { state: "loading", data: null } });
  const reader = useRef(read);
  reader.current = read;
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
    try {
      const result = await reader.current();
      if (request !== generation.current || identity.current !== key) return;
      setEntry({ key, resource: { state: "ready", data: result.data, source: result.stale ? "cache" : "live", fetchedAt: Date.now() } });
    } catch (cause) {
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
