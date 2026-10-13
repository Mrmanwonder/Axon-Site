/* ═══════════════════════════════════════════════════════════════════════════
   TARGET GRADES (AXO-245) and the grade-outlook switch (AXO-262)

   The student picks the grade they are aiming for, per subject, in their
   board's own scale. A suggestion from past papers is a prediction, so it
   appears only after the student turns "Show grade outlook" on (opt-in, never
   default; owner, 13 Oct 2026), and only when verified thresholds and enough
   identified papers exist. Otherwise no suggestion is drawn, and the screen
   says why rather than guessing.

   Two places use it: Home's one-time prompt for any student who has not set a
   target, and Settings, where every target stays editable.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PressBox from "./PressBox";
import Switch from "./Switch";
import Chevron from "./Chevron";
import { useApp } from "../data/AppProvider";
import { useResource } from "../data/useResource";
import { gradeOutlook, practicePref, setPracticePref, setTargetGrade, targetGradeScale, targetGrades, type GradeOutlook } from "../data/practice";
import { paths } from "../app/paths";
import { hapticTick } from "../lib/haptics";

type Loaded = {
  scale: string[] | null;
  targets: Record<string, string>;
  optIn: boolean;
  dismissed: boolean;
  outlook: Record<string, GradeOutlook>;
};

function useTargets() {
  const { student } = useApp();
  const id = student?.id ?? null;
  const subjects = student?.subjects ?? [];
  return useResource<Loaded>(id ? `targets:${id}:${subjects.join(",")}` : null, async () => {
    const [scale, rows, pref] = await Promise.all([targetGradeScale(id!), targetGrades(id!), practicePref(id!)]);
    const optIn = pref?.outlook_opt_in ?? false;
    const outlook: Record<string, GradeOutlook> = {};
    if (optIn) {
      await Promise.all(subjects.map(async (s) => {
        try { outlook[s] = await gradeOutlook(id!, s); } catch { /* the suggestion is optional; its absence is stated */ }
      }));
    }
    return {
      data: {
        scale, optIn, outlook,
        targets: Object.fromEntries(rows.map((r) => [r.subject, r.grade])),
        dismissed: Boolean(pref?.target_prompt_dismissed_at),
      },
    };
  });
}

function SubjectTarget({ subject, scale, value, outlook, optIn, onSet }: {
  subject: string; scale: string[]; value: string | undefined; outlook: GradeOutlook | undefined; optIn: boolean;
  onSet: (grade: string | null, suggested: string | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const suggestion = outlook?.state === "ready" ? outlook : null;
  const hint = !optIn ? null
    : suggestion?.suggested ? `Past papers suggest ${suggestion.low_grade}–${suggestion.high_grade}; a realistic stretch is ${suggestion.stretch ?? suggestion.suggested}. Based on ${suggestion.papers} papers.`
    : outlook?.state === "not_enough" ? `No suggestion yet: it needs ${outlook.needed} identified papers covering each of your papers.`
    : outlook?.state === "unsupported" ? "No suggestion for this subject: verified grade thresholds are not loaded yet."
    : null;
  const id = `target-${subject.replace(/\W+/g, "-")}`;
  return (
    <div className="trow">
      <label className="n" htmlFor={id}>
        {subject}
        {hint && <span className="hint">{hint}</span>}
      </label>
      <select
        id={id}
        value={value ?? ""}
        disabled={busy}
        aria-busy={busy}
        onChange={async (e) => {
          setBusy(true);
          hapticTick();
          try { await onSet(e.target.value || null, suggestion?.suggested ?? null); } finally { setBusy(false); }
        }}
      >
        <option value="">Not set</option>
        {scale.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
    </div>
  );
}

export default function TargetGrades({ mode }: { mode: "prompt" | "settings" }) {
  const { student } = useApp();
  const { resource, reload, updateData } = useTargets();
  const [error, setError] = useState<string | null>(null);
  const [optBusy, setOptBusy] = useState(false);
  const subjects = student?.subjects ?? [];
  const data = resource.data;

  // A prompt that has nothing left to ask closes itself.
  const missing = data ? subjects.filter((s) => !data.targets[s]) : [];
  const [closed, setClosed] = useState(false);
  useEffect(() => { setClosed(false); }, [student?.id]);

  if (!student) return null;
  if (mode === "prompt") {
    if (!data || closed || data.dismissed || !data.scale || subjects.length === 0 || missing.length === 0) return null;
  }

  if (resource.state === "failed" && !data) {
    return mode === "settings"
      ? <div className="note">Targets could not be loaded. <button type="button" className="textaction" onClick={() => void reload()}>Try again</button></div>
      : null;
  }
  if (!data) return mode === "settings" ? <div className="note" role="status">Loading targets…</div> : null;
  if (!data.scale) {
    return mode === "settings" ? <div className="note">Targets need a board and level on the profile first.</div> : null;
  }

  const set = async (subject: string, grade: string | null, suggested: string | null) => {
    setError(null);
    try {
      await setTargetGrade(student.id, subject, grade, suggested);
      updateData((d) => {
        const targets = { ...d.targets };
        if (grade) targets[subject] = grade; else delete targets[subject];
        return { ...d, targets };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That target did not save.");
    }
  };

  const toggleOutlook = async (next: boolean) => {
    setOptBusy(true);
    setError(null);
    try {
      await setPracticePref(student.id, { outlookOptIn: next });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That setting did not save.");
    } finally {
      setOptBusy(false);
    }
  };

  const list = (mode === "prompt" ? missing : subjects);

  return (
    <div className={"card targetcard" + (mode === "prompt" ? " nextstep focuscard" : "")} style={mode === "settings" ? { padding: "6px 18px 16px" } : undefined}>
      {mode === "prompt" && (
        <>
          <div className="eyebrow">Your targets</div>
          <div className="line">What grade are you aiming for?</div>
          <div className="why">Your target sets how Axon weighs what to practise. Change it any time in Settings.</div>
        </>
      )}
      <div className="tgrid">
        {list.map((s) => (
          <SubjectTarget key={s} subject={s} scale={data.scale!} value={data.targets[s]} outlook={data.outlook[s]}
                         optIn={data.optIn} onSet={(g, sug) => set(s, g, sug)} />
        ))}
      </div>
      {mode === "settings" && (
        <div className="trow" style={{ marginTop: 10 }}>
          <div className="n">
            Show grade outlook
            <span className="hint">A projected grade range from your identified past papers, with a suggestion when you set a target. Off unless you turn it on. Always a range, never a promise.</span>
          </div>
          <Switch label="Show grade outlook" on={data.optIn} busy={optBusy} disabled={optBusy} onChange={(n) => void toggleOutlook(n)} />
        </div>
      )}
      <div className="actions">
        {mode === "prompt" && (
          <>
            <PressBox as={Link} to={paths.settings} className="textaction">Check your exam dates <Chevron /></PressBox>
            <PressBox
              as="button"
              type="button"
              className="textaction"
              onClick={async () => {
                setClosed(true);
                try { await setPracticePref(student.id, { dismissTargetPrompt: true }); } catch { /* shown again next visit */ }
              }}
            >
              Not now
            </PressBox>
          </>
        )}
      </div>
      {error && <div role="alert" className="subnote" style={{ marginLeft: 0 }}>{error}</div>}
    </div>
  );
}
