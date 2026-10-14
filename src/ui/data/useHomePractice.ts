/* Each Home card owns its read, last-good value and retry. The SQL due_queue,
   focus_areas and next_best_action each refresh their own error items under the
   same database lock; none needs another card to succeed first. */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "./AppProvider";
import { useResource } from "./useResource";
import {
  deviceTimeZone, dueQueue, focusAreas, nextBestAction, practiceFlags, progressSummary,
  setPracticePref, startPracticeSession, type FocusKind,
} from "./practice";
import { computeStreak } from "./streak";
import { paths } from "../app/paths";

export function useHomePractice() {
  const { student } = useApp();
  const id = student?.id ?? null;
  const tzSent = useRef<string | null>(null);
  // Only calendar-dependent reads wait for the timezone. Share the write, and
  // retry it on the next refresh after failure. A profile switch gets a new
  // coordinator and useResource refuses late results from the previous profile.
  const calendar = useMemo(() => {
    let pending: Promise<void> | null = null;
    return () => {
      const tz = deviceTimeZone();
      if (!id || !tz || tzSent.current === `${id}:${tz}`) return Promise.resolve();
      if (!pending) pending = setPracticePref(id, { timezone: tz })
        .then(() => { tzSent.current = `${id}:${tz}`; })
        .catch(() => { /* Keep the server's last-known timezone. */ })
        .finally(() => { pending = null; });
      return pending;
    };
  }, [id]);
  const key = (name: string) => id ? `home-practice:${id}:${name}` : null;
  const nba = useResource(key("nba"), async () => { await calendar(); return { data: await nextBestAction(id!) }; });
  const due = useResource(key("due"), async () => { await calendar(); return { data: await dueQueue(id!) }; });
  const leaks = useResource(key("leaks"), async () => { await calendar(); return { data: await focusAreas(id!, null, 8) }; });
  const progress = useResource(key("progress"), async () => { await calendar(); return { data: await progressSummary(id!) }; });
  const flags = useResource(key("flags"), async () => ({ data: await practiceFlags() }));
  // Preferences and targets belong to TargetGrades; Home did not consume them.
  const reload = useCallback(async () => {
    await Promise.all([nba.reload(), due.reload(), leaks.reload(), progress.reload(), flags.reload()]);
  }, [nba.reload, due.reload, leaks.reload, progress.reload, flags.reload]);
  const streak = useMemo(() => progress.resource.data
    ? computeStreak(progress.resource.data.session_dates, progress.resource.data.today) : null, [progress.resource.data]);
  return { nba, due, leaks, progress, flags, reload, streak };
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
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [reload]);
}
