/* Home's practice reads (AXO-250 to 255), fetched together and kept apart in
   state: one failed read hides one card with its own message, it never turns
   the rest of Home into an empty state. */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "./AppProvider";
import { useResource } from "./useResource";
import {
  deviceTimeZone, dueQueue, focusAreas, nextBestAction, practiceFlags, practicePref, progressSummary,
  setPracticePref, startPracticeSession, targetGrades, topLeaks,
  type DueItem, type FocusArea, type FocusKind, type NextBestAction, type PracticeFlags, type PracticePref,
  type ProgressSummary, type TargetGrade,
} from "./practice";
import { computeStreak } from "./streak";
import { paths } from "../app/paths";

type HomePracticeData = {
  nba: NextBestAction;
  due: DueItem[];
  leaks: FocusArea[];
  progress: ProgressSummary;
  flags: PracticeFlags;
  pref: PracticePref | null;
  targets: TargetGrade[];
};

export function useHomePractice() {
  const { student } = useApp();
  const id = student?.id ?? null;
  const tzSent = useRef<string | null>(null);

  const { resource, reload } = useResource<HomePracticeData>(id ? `home-practice:${id}` : null, async () => {
    // The day the streak and "today" are counted in is the device's.
    const tz = deviceTimeZone();
    if (tz && tzSent.current !== `${id}:${tz}`) {
      try { await setPracticePref(id!, { timezone: tz }); tzSent.current = `${id}:${tz}`; } catch { /* an unknown zone keeps UTC */ }
    }
    // next_best_action brings the error items up to date first; the rest read after.
    const nba = await nextBestAction(id!);
    const [due, leaks, progress, flags, pref, targets] = await Promise.all([
      dueQueue(id!), focusAreas(id!, null, 8), progressSummary(id!), practiceFlags(), practicePref(id!), targetGrades(id!),
    ]);
    return { data: { nba, due, leaks: topLeaks(leaks, flags.mistake_type_ui), progress, flags, pref, targets } };
  });

  const streak = useMemo(() => resource.data ? computeStreak(resource.data.progress.session_dates, resource.data.progress.today) : null,
    [resource.data]);

  return { resource, reload, streak };
}

/** Starts a session and opens it. One function, so every button that says
    "start" behaves the same and reports failure the same way. */
export function useStartPractice() {
  const { student } = useApp();
  const navigate = useNavigate();
  return useCallback(async (kind: FocusKind, opts: { key?: string | null; subject?: string | null; itemIds?: string[] } = {}) => {
    if (!student?.id) throw new Error("No student is selected.");
    const r = await startPracticeSession(student.id, kind, opts);
    if (r.state !== "started") throw new Error("There is nothing to practise there right now.");
    navigate(paths.practice(r.session_id));
  }, [student?.id, navigate]);
}

/** Re-reads Home's practice cards when the tab regains focus after a session. */
export function useRefreshOnReturn(reload: () => Promise<void>) {
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);
}
