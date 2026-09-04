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

   Billing lives here because this screen is the guardian's own account surface
   — their contact, their consent ledger, their data export, their account.
   There is deliberately no pricing card, no plan comparison and no "Upgrade"
   button anywhere in it: an upgrade prompt is only ever earned by a genuine
   detected pattern, on the parent's dashboard, and none of that is this screen.
   What this section does is EXPLAIN state the server has already decided —
   most of all the one state that would otherwise be silent, a failed payment.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useApp } from "../data/AppProvider";
import { useEntitlements } from "../data/useEntitlements";
import { useToast } from "../components/ToastProvider";
import { useSheetControls } from "../components/SheetProvider";
import {
  exportMyData, downloadJson, deleteAccount, openBillingPortal, sb,
  isPasskeySupported, registerPasskey, listPasskeys, renamePasskey, deletePasskey,
  PASSKEY_MESSAGE,
  AVATAR_PRESETS, avatarStyleFor, backgroundFor, inkFor, isChosenAvatar, initialFor,
} from "../data/modules";
import { hapticTick, hapticFirm } from "../lib/haptics";
import Switch from "../components/Switch";
import Chevron from "../components/Chevron";
import PressBox from "../components/PressBox";
import type { Prefs, Passkey } from "../data/modules";

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

/* Plain, parent-facing names for `billing_state`. `past_due` is the only one
   that needs a sentence rather than a word: it is the state a parent has to be
   able to act on, and the only one that took something away. */
const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  pro_annual: "Pro",
  past_due: "Paused",
  canceled: "Free",
  unknown: "—",
  failed: "—",
};

const PLAN_NOTE: Record<string, string> = {
  free: "Full analysis of every paper, permanently",
  pro: "Billed monthly",
  pro_annual: "Billed yearly",
  past_due: "Pro is paused until the payment is settled",
  canceled: "Pro has ended. Everything scanned so far is still here.",
  unknown: "Checking\u2026",
  failed: "We couldn't check this just now",
};

export default function Settings() {
  const {
    guardian, student, prefs, setPref, consent, refreshConsent, setConsent,
    setAvatar, signOutNow,
  } = useApp();
  const { state: billingRead, entitlements } = useEntitlements();
  const toast = useToast();
  const { openSheet } = useSheetControls();
  const [busy, setBusy] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const passkeySupported = isPasskeySupported();

  const loadPasskeys = () => {
    if (!guardian || !passkeySupported) return;
    listPasskeys().then(setPasskeys).catch(() => { /* the list panel just stays empty */ });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadPasskeys, [guardian, passkeySupported]);

  const name = student?.first_name ?? guardian?.name ?? "";
  const initial = initialFor(name);

  /* The same call the nav swatch makes, from the same module. Two surfaces draw
     this student and neither owns the definition. */
  const avatar = avatarStyleFor(student);
  const chosen = isChosenAvatar(student);

  const pickAvatar = async (key: string) => {
    hapticTick();
    try {
      await setAvatar(key);
    } catch {
      // setAvatar has already put the previous face back. Say so plainly —
      // silently reverting a tap is the invisible failure hard rule 4 forbids,
      // small as this one is.
      toast("That could not be saved. Your picture is unchanged.", "warn");
    }
  };

  /* "loading", "failed" and a real state are three different things, and the
     row says which. Reading "free" out of a request that never came back is
     the one mistake this section cannot make. */
  const planKey = billingRead === "ready" && entitlements
    ? entitlements.billingState
    : billingRead === "failed" ? "failed" : "unknown";

  const toPortal = async () => {
    hapticTick();
    try {
      // Navigates away on success, so there is nothing to report back.
      await openBillingPortal("/settings");
    } catch (e) { toast((e as Error).message || "Billing could not be opened.", "warn"); }
  };

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
        <div
          className="pic"
          aria-hidden="true"
          data-preset={avatar.preset}
          style={{ background: avatar.background, color: avatar.color }}
        >
          {initial}
        </div>
        <div>
          <div className="n">{name}</div>
          <div className="e">{guardian?.contact}</div>
        </div>
      </div>

      {/* ── The picture ──
          No photograph, here or anywhere: there is no avatar bucket, no upload
          path and no column that could hold an image of a child. What a student
          picks is a gradient, and what is stored is its name.

          Ten presets, all of them offered. Two of them — Halo and Mandarin —
          are close enough to the reserved sign-out red that the app will never
          hand one out unasked, but a student choosing red for themselves is not
          the interface spending it, so both are here to pick.

          A tap is the whole interaction. No confirm step and no save button:
          this is reversible decoration, and asking someone to ratify their
          choice of colour is exactly the "prove yourself to the machine" the
          copy rules rule out. */}
      {student && (
        <>
          <div className="sectitle">Picture</div>
          <div className="card lookcard">
            <div className="lookrow" role="radiogroup" aria-label="Your picture">
              {AVATAR_PRESETS.map((p) => {
                const on = chosen && student.avatar_seed === p.key;
                return (
                  <PressBox
                    as="button"
                    type="button"
                    key={p.key}
                    className={"look" + (on ? " on" : "")}
                    role="radio"
                    aria-checked={on}
                    aria-label={p.title}
                    title={p.title}
                    onClick={() => { void pickAvatar(p.key); }}
                  >
                    <span
                      className="disc"
                      aria-hidden="true"
                      style={{ background: backgroundFor(p), color: inkFor(p) }}
                    >
                      {initial}
                    </span>
                  </PressBox>
                );
              })}
            </div>
          </div>
          <div className="note">
            {chosen
              ? "Yours on every device you sign in on."
              : "Picked for you from your profile. Choose another whenever you like."}
          </div>
        </>
      )}

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

      {/* ── Billing ──
          Four states, and the read itself is a fifth. "Loading" is not "free"
          and a failed read is not "past due": a claim about someone's money is
          the last thing this interface should guess at, so an unreachable read
          says so rather than naming a state. */}
      <div className="sectitle">Billing</div>

      {billingRead === "ready" && entitlements?.billingState === "past_due" && (
        <PressBox
          as="button" type="button" className="card attention" data-interactive=""
          onClick={() => void toPortal()}
        >
          <div className="ic">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2.5" y="5" width="19" height="14" rx="3" />
              <path d="M2.5 10h19M12 15h5" />
            </svg>
          </div>
          <div className="b">
            <div className="t1">The last payment didn&rsquo;t go through</div>
            <div className="t2">Pro is paused until it&rsquo;s settled. Tap to update the card.</div>
          </div>
          <Chevron />
        </PressBox>
      )}

      <div className="list" style={{ marginTop: 12 }}>
        <div className="srow noicon">
          <div className="lbl">
            Plan
            <small>{PLAN_NOTE[planKey]}</small>
          </div>
          <div className="aux">
            {PLAN_LABEL[planKey]}
          </div>
        </div>

        {/* Only where there is a Stripe customer to open a portal for. A free
            account has never checked out, and billing-portal answers a 409 —
            offering the row anyway would be a button that exists to fail. */}
        {billingRead === "ready" && entitlements && entitlements.billingState !== "free" && (
          <PressBox
            as="button" type="button" className="srow noicon" data-interactive=""
            onClick={() => void toPortal()}
          >
            <div className="lbl">
              {entitlements.billingState === "past_due" ? "Update payment method" : "Manage billing"}
              <small>Opens Stripe, where the card and the plan are held</small>
            </div>
            <Chevron />
          </PressBox>
        )}
      </div>
      <div className="note">
        {billingRead === "failed"
          ? "We couldn't reach billing just now, so this shows nothing rather than a guess. It'll be right on the next load."
          : entitlements?.billingState === "past_due"
            ? "Nothing has been deleted. Every paper, mark and explanation is still here, and scanning and each paper's own analysis are unaffected — those are free, always."
            : "Scanning and each paper's own analysis are free, always. Pro adds the wider lens across papers and subjects."}
      </div>


      {passkeySupported && (
        <>
          <div className="sectitle">Security</div>
          <div className="list">
            {(passkeys ?? []).map((pk) => (
              <PressBox
                key={pk.id}
                as="button" type="button" className="srow noicon" data-interactive=""
                disabled={passkeyBusy}
                onClick={() => {
                  hapticTick();
                  openSheet({
                    title: pk.friendly_name || "Passkey",
                    body: `Added ${new Date(pk.created_at).toLocaleDateString()}. Renaming or removing takes effect immediately — no extra sign-in needed.`,
                    choices: [
                      { label: "Rename", value: "rename" },
                      { label: "Remove this passkey", value: "remove" },
                    ],
                    onChoice: async (choice) => {
                      if (choice === "rename") {
                        openSheet({
                          title: "Rename this passkey",
                          input: { id: `pk-${pk.id}`, placeholder: pk.friendly_name ?? "Passkey" },
                          primary: "Save name",
                          onConfirm: async (value) => {
                            const name = value.trim();
                            if (!name) return;
                            setPasskeyBusy(true);
                            try {
                              await renamePasskey(pk.id, name);
                              loadPasskeys();
                              toast("Renamed.");
                            } catch (e) { toast((e as Error).message || "That could not be renamed.", "warn"); }
                            finally { setPasskeyBusy(false); }
                          },
                        });
                        return;
                      }
                      if (choice === "remove") {
                        setPasskeyBusy(true);
                        try {
                          await deletePasskey(pk.id);
                          loadPasskeys();
                          toast("Passkey removed.");
                        } catch (e) { toast((e as Error).message || "That could not be removed.", "warn"); }
                        finally { setPasskeyBusy(false); }
                      }
                    },
                  });
                }}
              >
                <div className="lbl">
                  {pk.friendly_name || "Passkey"}
                  <small>Added {new Date(pk.created_at).toLocaleDateString()}</small>
                </div>
                <Chevron />
              </PressBox>
            ))}
            <PressBox
              as="button" type="button" className="srow noicon" data-interactive=""
              disabled={!guardian || passkeyBusy}
              onClick={async () => {
                hapticFirm();
                setPasskeyBusy(true);
                try {
                  const result = await registerPasskey();
                  if (result.outcome === "ok") {
                    loadPasskeys();
                    toast("Passkey added.");
                  } else if (result.outcome !== "cancelled") {
                    toast(PASSKEY_MESSAGE[result.outcome] ?? "That didn't work.", "warn");
                  }
                } catch (e) { toast((e as Error).message || "That didn't work.", "warn"); }
                finally { setPasskeyBusy(false); }
              }}
            >
              <div className="lbl">Add a passkey<small>Face ID, Touch ID, or your device's screen lock</small></div>
              <Chevron />
            </PressBox>
          </div>
          <div className="note">
            Renaming or removing a passkey takes effect immediately — no extra sign-in needed.
          </div>
        </>
      )}

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
                `axon-data-${new Date().toISOString().slice(0, 10)}.json`,
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
