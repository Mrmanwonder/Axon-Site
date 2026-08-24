/* ═══════════════════════════════════════════════════════════════════════════
   SETTINGS

   `wireSettings` from src/app.js, as a screen.

   The one part that is not an ordinary preference is the pair of consent
   switches. Turning one off is a recorded WITHDRAWAL — a new append-only row in
   the ledger, not a preference change — so those two write through
   `setConsent`, which re-reads the ledger after writing. If the write fails the
   switch goes back to what the ledger says, because the ledger is the truth and
   the interface is not.

   Two copy rules visible here:
   · Deleting is not preceded by "are you sure?". The consequence sheet states
     what will happen and offers the action.
   · Sign out is the single sanctioned use of red in the whole interface.
     Deleting an account is more destructive and still is not red, because red
     here means "this ends the session", not "this is dangerous".
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { useApp } from "../data/AppProvider";
import { useToast } from "../components/ToastProvider";
import { useSheetControls } from "../components/SheetProvider";
import { exportMyData, downloadJson, deleteAccount, sb } from "../data/modules";
import { hapticTick, hapticFirm } from "../lib/haptics";
import Switch from "../components/Switch";
import Chevron from "../components/Chevron";
import PressBox from "../components/PressBox";
import type { Prefs } from "../data/modules";

function Seg<T extends string>({
  value, options, onPick, label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onPick: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? "on" : undefined}
          aria-pressed={o.value === value}
          onClick={() => { hapticTick(); onPick(o.value); }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const { guardian, student, prefs, setPref, consent, refreshConsent, setConsent, signOutNow } = useApp();
  const toast = useToast();
  const { openSheet } = useSheetControls();
  const [busy, setBusy] = useState<string | null>(null);

  const name = student?.first_name ?? guardian?.name ?? "";
  const initial = (name || "?")[0]?.toUpperCase() ?? "?";

  const pref = (key: keyof Prefs) => (next: boolean) => { void setPref({ [key]: next } as Partial<Prefs>); };

  /** A consent switch. Optimism is deliberately absent: the thumb moves only
      after the ledger has confirmed, and reverts on failure. */
  const consentSwitch = (purpose: string) => async (next: boolean) => {
    setBusy(purpose);
    hapticFirm();
    try {
      await setConsent(purpose, next);
      toast(next
        ? "Consent recorded."
        : "Consent withdrawn. Processing for this stops now.");
    } catch (e) {
      await refreshConsent().catch(() => { /* leave what we had */ });
      toast((e as Error).message || "That could not be recorded.", "warn");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="greet"><h1>Settings</h1></div>

      <div className="card sprofile">
        <div className="pic" aria-hidden="true">{initial}</div>
        <div>
          <div className="n">{name}</div>
          <div className="e">{guardian?.contact}</div>
        </div>
      </div>

      <div className="sectitle">Profile</div>
      <div className="list">
        <div className="srow noicon">
          <div className="lbl">Board</div>
          <div className="aux">{student?.board ?? "—"}</div>
        </div>
        <div className="srow noicon">
          <div className="lbl">Class</div>
          <div className="aux">{student ? String(student.class_level) : "—"}</div>
        </div>
        <div className="srow noicon">
          <div className="lbl">Subjects</div>
          <div className="aux">
            {student?.subjects?.length ? student.subjects.join(", ") : "None yet"}
          </div>
        </div>
      </div>
      <div className="note">Removing a subject archives its analysis rather than deleting it.</div>

      <div className="sectitle">Notifications</div>
      <div className="list">
        <div className="srow noicon">
          <div className="lbl">Paper ready<small>Extraction finished and ready to review</small></div>
          <Switch label="Paper ready" on={prefs.notify_paper_ready} onChange={pref("notify_paper_ready")} />
        </div>
        <div className="srow noicon">
          <div className="lbl">Correction needed<small>An item came back Unsure</small></div>
          <Switch label="Correction needed" on={prefs.notify_correction} onChange={pref("notify_correction")} />
        </div>
        <div className="srow noicon">
          <div className="lbl">
            Weekly digest to the parent
            <small>Consent — turning this off is recorded as a withdrawal</small>
          </div>
          <Switch
            label="Weekly digest to the parent"
            on={consent.weekly_parent_digest === true}
            busy={busy === "weekly_parent_digest"}
            disabled={!guardian || busy === "weekly_parent_digest"}
            onChange={(n) => void consentSwitch("weekly_parent_digest")(n)}
          />
        </div>
      </div>
      <div className="note">Notifications report state. There are no streak reminders or return nudges.</div>

      <div className="sectitle">AI transparency</div>
      <div className="list">
        <div className="srow noicon">
          <div className="lbl">Always show reasoning<small>Expand every disclosure panel by default</small></div>
          <Switch label="Always show reasoning" on={prefs.always_show_reasoning} onChange={pref("always_show_reasoning")} />
        </div>
        <div className="srow noicon">
          <div className="lbl">
            Help improve extraction
            <small>Consent — uses anonymised corrections. Off unless you turn it on.</small>
          </div>
          <Switch
            label="Help improve extraction"
            on={consent.improve_extraction === true}
            busy={busy === "improve_extraction"}
            disabled={!guardian || busy === "improve_extraction"}
            onChange={(n) => void consentSwitch("improve_extraction")(n)}
          />
        </div>
        <div className="srow noicon">
          <div className="lbl">Confidence indicators<small>Confirmed, Likely and Unsure labels</small></div>
          <div className="locked">Always on</div>
        </div>
      </div>

      <div className="sectitle">Display &amp; accessibility</div>
      <div className="list">
        <div className="srow noicon">
          <div className="lbl">Appearance</div>
          <Seg
            label="Appearance"
            value={prefs.theme}
            onPick={(theme) => void setPref({ theme })}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
        </div>
        <div className="srow noicon">
          <div className="lbl">Text size</div>
          <Seg
            label="Text size"
            value={prefs.text_size}
            onPick={(text_size) => void setPref({ text_size })}
            options={[
              { value: "s", label: "S" },
              { value: "m", label: "M" },
              { value: "l", label: "L" },
            ]}
          />
        </div>
        <div className="srow noicon">
          <div className="lbl">Reduce motion<small>Stillness here without changing your whole phone</small></div>
          <Switch label="Reduce motion" on={prefs.reduce_motion} onChange={pref("reduce_motion")} />
        </div>
        <div className="srow noicon">
          <div className="lbl">Language<small>Interface only — content follows the paper</small></div>
          <div className="aux">English</div>
        </div>
      </div>

      <div className="sectitle">Privacy &amp; data</div>
      <div className="list">
        <PressBox
          as="button" type="button" className="srow noicon" data-interactive=""
          disabled={!guardian}
          onClick={async () => {
            if (!guardian) return;
            hapticTick();
            try {
              toast("Gathering your data…");
              downloadJson(
                `mastery-data-${new Date().toISOString().slice(0, 10)}.json`,
                await exportMyData(guardian),
              );
              toast("Downloaded.");
            } catch (e) { toast((e as Error).message || "Export failed.", "warn"); }
          }}
        >
          <div className="lbl">Download your data<small>Everything we hold, as one file</small></div>
          <Chevron />
        </PressBox>

        <PressBox
          as="button" type="button" className="srow noicon" data-interactive=""
          onClick={() => {
            hapticTick();
            openSheet({
              title: "Delete the student's data?",
              body: "This clears papers and analysis but keeps the account, so you can start again without signing up.",
              items: [
                ["Papers and analysis are removed.", "Uploaded pages and everything derived from them."],
                ["The profile stays.", "Name, class and subjects remain, so nothing needs re-entering."],
              ],
              primary: "Delete the data",
              onConfirm: async () => {
                if (!student) return toast("Nothing to delete yet.");
                try {
                  const { error } = await sb.from("paper").delete().eq("student_id", student.id);
                  if (error) throw error;
                  toast("Papers and analysis deleted.");
                } catch (e) { toast((e as Error).message || "Deletion failed.", "warn"); }
              },
            });
          }}
        >
          <div className="lbl">Delete the papers<small>Clears papers and analysis, keeps the profile</small></div>
          <Chevron />
        </PressBox>

        <PressBox
          as="button" type="button" className="srow noicon" data-interactive=""
          disabled={!guardian}
          onClick={() => {
            hapticFirm();
            openSheet({
              title: "Delete this account?",
              body: "This removes the student's papers and everything we worked out from them. It cannot be undone.",
              items: [
                ["Papers and analysis go first.", "Every uploaded page and every explanation is deleted, not archived."],
                ["Your consent record is kept.", "It holds no personal data and is the evidence that consent was properly obtained."],
                ["Sign-in stops working immediately.", "The account is released, so this email or number can start fresh later."],
              ],
              primary: "Delete everything",
              onConfirm: async () => {
                if (!guardian) return;
                try {
                  toast("Deleting…");
                  const result = await deleteAccount(guardian);
                  toast(`Deleted ${result.students_erased} profile(s). Signing out.`);
                  setTimeout(() => location.reload(), 1200);
                } catch (e) { toast((e as Error).message || "Deletion failed.", "warn"); }
              },
            });
          }}
        >
          <div className="lbl">Delete this account<small>Removes everything. Cannot be undone.</small></div>
          <Chevron />
        </PressBox>
      </div>
      <div className="note">
        No targeted advertising. There&rsquo;s nothing to opt out of because it was never built in.
      </div>

      <div style={{ marginTop: 14 }} />
      {/* The single sanctioned use of red in the interface. */}
      <div className="list">
        <PressBox
          as="button" type="button" className="srow noicon" data-interactive=""
          onClick={() => { hapticFirm(); void signOutNow(); }}
        >
          <div className="lbl" style={{ color: "var(--signout)" }}>Sign out</div>
        </PressBox>
      </div>
    </>
  );
}
