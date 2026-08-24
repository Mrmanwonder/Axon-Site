/* ═══════════════════════════════════════════════════════════════════════════
   THE ANALYTICS READS

   Everything Home and Insights need to say something true, and nothing they
   could use to say something plausible instead.

   `state` has three values and the distinction matters: "loading" is not
   "empty". A surface that renders its empty state while a read is still in
   flight tells a student they have no papers a moment before their papers
   appear, and a surface that renders zeroes on a failed read tells them their
   marks are zero. Both are lies with a confident face, which is the specific
   failure hard rule 4 exists to prevent.

   On failure this reports "failed" and holds whatever it had. It never
   substitutes a default, and callers must not treat a failed read as an empty
   one.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import {
  lossByCause, needsCheck, unreadablePages, analyticsReadiness,
} from "./modules";
import { useApp } from "./AppProvider";

export type Readiness = {
  papers_counted: number;
  questions_counted: number;
  has_enough_data: boolean;
};

export type Analytics = {
  state: "loading" | "ready" | "failed";
  readiness: Readiness | null;
  /** cause -> marks lost. Empty object is a real answer; null is "we do not know". */
  loss: Record<string, number> | null;
  needsCheck: { count: number; papers: number } | null;
  /** True when any of these came from the offline cache rather than the network. */
  stale: boolean;
  unreadable: { id: string; paper_id: string; page_number: number; reason: string }[] | null;
  reload: () => Promise<void>;
};

export function useAnalytics(): Analytics {
  const { student } = useApp();
  const [state, setState] = useState<Analytics["state"]>("loading");
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loss, setLoss] = useState<Record<string, number> | null>(null);
  const [check, setCheck] = useState<{ count: number; papers: number } | null>(null);
  const [unreadable, setUnreadable] = useState<Analytics["unreadable"]>(null);
  const [stale, setStale] = useState(false);

  const reload = useCallback(async () => {
    if (!student) {
      // No student is a definite answer, not a failure: there is nothing to
      // count yet, and the empty states are the honest thing to show.
      setReadiness({ papers_counted: 0, questions_counted: 0, has_enough_data: false });
      setLoss({});
      setCheck({ count: 0, papers: 0 });
      setUnreadable([]);
      setStale(false);
      setState("ready");
      return;
    }
    try {
      // Every one of these is read-through cached, so the value is under
      // `.data` and never the bare result. Unwrapping is not optional: reading
      // the wrapper directly yields undefined, which renders as a confident
      // zero — "0 of 4 papers" to a student who has ten.
      const [r, l, c, u] = await Promise.all([
        analyticsReadiness(student.id),
        lossByCause(student.id),
        needsCheck(student.id),
        unreadablePages(student.id),
      ]);
      setReadiness(r.data);
      setLoss(l.data);
      setCheck(c.data);
      setUnreadable(u.data);
      // A stale read is still an answer — past papers stay readable offline by
      // design — but the surface has to say so, so the flag is reported up.
      setStale(r.stale || l.stale || c.stale || u.stale);
      setState("ready");
    } catch {
      // Hold what we had. A failed read is not an empty library.
      setState("failed");
    }
  }, [student]);

  useEffect(() => { void reload(); }, [reload]);

  return { state, readiness, loss, needsCheck: check, unreadable, stale, reload };
}
