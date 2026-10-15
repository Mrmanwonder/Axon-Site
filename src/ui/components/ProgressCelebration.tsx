import { useEffect, useState } from "react";
import type { Streak } from "../data/streak";

// Memory fallback avoids repeating announcements when storage is unavailable.
// Only opaque ids/dates are remembered; no marks, names or paper text.
const remembered = new Map<string, string>();
if (typeof window !== "undefined") window.addEventListener("axon:local-data", () => remembered.clear());
function read(key: string) {
  try { return localStorage.getItem(key) ?? remembered.get(key) ?? null; }
  catch { return remembered.get(key) ?? null; }
}
function write(key: string, value: string) {
  remembered.set(key, value);
  try { localStorage.setItem(key, value); } catch { /* memory fallback */ }
}

export default function ProgressCelebration({ studentId, readyPaperIds, fresh, streak, today, progressFresh }: {
  studentId: string;
  readyPaperIds: string[];
  fresh: boolean;
  streak: Streak | null;
  today?: string;
  progressFresh: boolean;
}) {
  const [notice, setNotice] = useState<{ studentId: string; text: string } | null>(null);
  const paperSignature = [...readyPaperIds].sort().join(",");
  useEffect(() => {
    if (!fresh) return;
    const key = `axon.reward-papers:${studentId}`;
    const prior = read(key);
    let previous: string[] = [];
    try { previous = prior ? JSON.parse(prior) : []; } catch { /* repair corrupt storage */ }
    if (!Array.isArray(previous)) previous = [];
    const current = paperSignature ? paperSignature.split(",") : [];
    const added = current.some(id => !previous.includes(id));
    // First live visit establishes a baseline, including an empty library.
    // Retain seen ids so reordering/deleting papers cannot celebrate old work.
    write(key, JSON.stringify([...new Set([...previous, ...current])]));
    if (prior !== null && added) setNotice({ studentId, text: "Paper read. Nice work." });
  }, [studentId, paperSignature, fresh]);
  useEffect(() => {
    if (!progressFresh || !today || !streak?.todayDone) return;
    const days = streak.current;
    if (!(days === 1 || days === 3 || (days > 0 && days % 7 === 0))) return;
    const key = `axon.reward-streak:${studentId}`;
    const event = `${today}:${days}`;
    if (read(key) === event) return;
    write(key, event);
    setNotice({ studentId, text: days === 1 ? "First practice day complete. Nice work." : `${days} practice days in a row. Nice work.` });
  }, [studentId, today, progressFresh, streak?.todayDone, streak?.current]);
  if (notice?.studentId !== studentId) return null;
  return <div className="card celebrate" role="status">
    <span className="celebrate-mark" aria-hidden="true">✓</span>
    <div className="b"><div className="t1">{notice.text}</div></div>
    <button type="button" className="textaction" onClick={() => setNotice(null)}>Dismiss</button>
  </div>;
}
