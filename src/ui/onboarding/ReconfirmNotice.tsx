/* ═══════════════════════════════════════════════════════════════════════════
   RECONFIRM THE UPDATED NOTICE (AXO-266)

   Shown once to a guardian whose saved consent was given under an older notice.
   Nothing they agreed to is switched off while this is open. It shows the
   current notice, with their own choices already filled in, and one button that
   records those choices again under the current wording. Optional switches can
   be changed here; required items are shown, not offered as a choice.

   "Not now" is always available and lasts for the session: the app is not held
   back over a wording change, but the weekly email only starts once the current
   wording has been confirmed.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useApp } from "../data/AppProvider";
import {
  listPurposes, confirmCurrentNotice, noticeStrings, purposeLabel, purposeNote,
} from "../data/modules";
import type { ReconfirmRow } from "../data/modules";
import { Shell, Err, SRow, ICONS } from "./chrome";
import PressBox from "../components/PressBox";
import Switch from "../components/Switch";
import { useParentMode } from "../data/useParentMode";
import { hapticFirm } from "../lib/haptics";
import { SUPPORT_EMAIL } from "../lib/legal";
import type { ReactNode } from "react";

type Purpose = { purpose: string; label: string; is_required: boolean; sort_order: number };

const ICON: Record<string, [string, ReactNode]> = {
  store_papers: ["ic-b", ICONS.paper],
  extract_text: ["ic-b", ICONS.read],
  generate_explanations: ["ic-b", ICONS.explain],
  track_progress: ["ic-b", ICONS.trend],
  weekly_parent_digest: ["ic-a", ICONS.mail],
  improve_extraction: ["ic-a", ICONS.spark],
};

export default function ReconfirmNotice({ rows, onDone, onLater }: {
  rows: ReconfirmRow[]; onDone: () => void; onLater: () => void;
}) {
  const { guardian } = useApp();
  const { guard } = useParentMode();
  const [purposes, setPurposes] = useState<Purpose[] | null>(null);
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = noticeStrings("en");

  useEffect(() => {
    let live = true;
    listPurposes().then((list) => { if (live) setPurposes(list as Purpose[]); })
      .catch(() => { if (live) setError("The notice could not be loaded. Try again in a moment."); });
    return () => { live = false; };
  }, []);

  // Only purposes this guardian has switched on are shown as on; the rest stay off.
  const held = new Set(rows.map((r) => r.purpose));
  const on = (p: string) => choices[p] ?? held.has(p);

  const confirm = () => {
    hapticFirm();
    setError(null);
    guard(async () => {
      setBusy(true);
      try {
        const decided: Record<string, boolean> = {};
        for (const r of rows) decided[r.purpose] = on(r.purpose);
        await confirmCurrentNotice({ guardianId: guardian!.id, rows, choices: decided });
        onDone();
      } catch {
        setError("We couldn't save that. Nothing has changed. Try again.");
      } finally { setBusy(false); }
    });
  };

  const row = (p: Purpose) => {
    const [tone, icon] = ICON[p.purpose] ?? ["ic-n", ICONS.shield];
    const label = purposeLabel(p.purpose, p.label, "en");
    return (
      <SRow
        key={p.purpose} tone={tone} icon={icon} label={label}
        small={purposeNote(p.purpose, "en")}
        trailing={p.is_required
          ? <span className="locked">{t.requiredTag}</span>
          : <Switch label={label} on={on(p.purpose)} onChange={(next) => setChoices((c) => ({ ...c, [p.purpose]: next }))} />}
      />
    );
  };

  const shown = (purposes ?? []).filter((p) => held.has(p.purpose));
  const required = shown.filter((p) => p.is_required);
  const optional = shown.filter((p) => !p.is_required);

  return (
    <Shell title="We've updated our notice" sub="Read it once and confirm. Nothing you agreed to has been changed or switched off.">
      <Err message={error} />
      {required.length > 0 && <div className="subnote">{t.requiredSection}</div>}
      {required.map(row)}
      {optional.length > 0 && <div className="subnote">{t.optionalSection}</div>}
      {optional.map(row)}
      <p className="subnote">
        The full wording is on our <a href="/privacy" target="_blank" rel="noreferrer">privacy page</a>.
        You can change any optional choice later in Settings. Questions: {SUPPORT_EMAIL}.
      </p>
      <div className="obfoot">
        <PressBox as="button" type="button" className="btn primary" disabled={busy || !purposes} aria-busy={busy} onClick={confirm}>
          {busy ? "Saving…" : "Confirm"}
        </PressBox>
        <PressBox as="button" type="button" className="btn" onClick={onLater}>Not now</PressBox>
      </div>
    </Shell>
  );
}
