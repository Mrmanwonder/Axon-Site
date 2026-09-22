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

   ── Parent Mode ──────────────────────────────────────────────────────────

   This is the student's phone. The same session that scans a physics paper
   opens this screen, so consent, billing, export and both deletions go through
   `guard` — the parent confirms with a code sent to the contact on the account,
   and the window closes on its own a quarter of an hour later.

   The prompt is not a confirmation and does not break the rule above. It is not
   asking anyone to ratify a decision; it is asking whether the account holder
   is the person holding the phone. The consequence sheet still does the
   explaining, and it does it after.

   Where the real refusal lives varies, and the difference matters:

   · consent, delete papers, delete account — refused by the database. A
     request typed into the console fails exactly as the button does.
   · export — built from ordinary RLS-scoped reads that the app needs anyway, so
     `guard` gates the button rather than the data. Server-side gating means
     routing it through one export RPC, which is P1-FE-004.
   · billing portal — gates reaching Stripe. Once it opens, Stripe's own
     session governs what happens inside it.

   Billing lives here because this screen is the guardian's own account surface
   — their contact, their consent ledger, their data export, their account.
   There is deliberately no pricing card, no plan comparison and no "Upgrade"
   button anywhere in it: an upgrade prompt is only ever earned by a genuine
   detected pattern, on the parent's dashboard, and none of that is this screen.
   What this section does is EXPLAIN state the server has already decided —
   most of all the one state that would otherwise be silent, a failed payment.
   ═══════════════════════════════════════════════════════════════════════════ */

import ProfileChooser from "../components/ProfileChooser";
import { LocalDataService } from "../../local-data.js";
import { useEffect, useState } from "react";

import { Link } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { useEntitlements } from "../data/useEntitlements";
import { useToast } from "../components/ToastProvider";
import { useSheetControls } from "../components/SheetProvider";
import { useParentMode } from "../data/useParentMode";
import {
  exportMyData, downloadJson, deleteAccount, openBillingPortal, sb,
  isParentModeRequired,
  AVATAR_PRESETS, avatarStyleFor, backgroundFor, inkFor, isChosenAvatar, initialFor,
  BOARD_LABEL, CLASS_LEVELS, classLabel, subjectsForClass, syllabusCode,
} from "../data/modules";
import { hapticTick, hapticFirm } from "../lib/haptics";
import { ANALYTICS_CONSENT_EVENT, getAnalyticsConsent, setAnalyticsConsent } from "../lib/analytics";
import Switch from "../components/Switch";
import Chevron from "../components/Chevron";
import PressBox from "../components/PressBox";
import type { Prefs } from "../data/modules";
import { paths } from "../app/paths";

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
    guardian, student, prefs, setPref, consent, consentResource, refreshConsent, setConsent,
    setAvatar, updateStudentProfile, signOutNow,

  } = useApp();
  const { state: billingRead, entitlements } = useEntitlements();
  const toast = useToast();
  const { openSheet } = useSheetControls();
  /* P0-002. Everything below that changes consent, moves money or removes data
     goes through `guard`. It is not the boundary — the database refuses these
     for a session that has not re-authenticated, which is what holds against a
     request typed into the console — it is how a parent is asked, so the
     refusal is a prompt rather than an error. */
  const { guard } = useParentMode();
  const [busy, setBusy] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(student?.first_name ?? "");
  const [profileClass, setProfileClass] = useState(student?.class_level ?? 11);
  const [profileSubjects, setProfileSubjects] = useState<string[]>(student?.subjects ?? []);
  const [analyticsAllowed, setAnalyticsAllowed] = useState(() => getAnalyticsConsent() === "granted");
  const name = student?.first_name ?? guardian?.name ?? "";

  useEffect(() => {
    const syncAnalyticsChoice = () => setAnalyticsAllowed(getAnalyticsConsent() === "granted");
    window.addEventListener(ANALYTICS_CONSENT_EVENT, syncAnalyticsChoice);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, syncAnalyticsChoice);
  }, []);
  const initial = initialFor(name);

  /* The same call the nav swatch makes, from the same module. Two surfaces draw
     this student and neither owns the definition. */
  const avatar = avatarStyleFor(student);
  const chosen = isChosenAvatar(student);

  const beginProfileEdit = () => {
    if (!student) return;
    hapticTick();
    setProfileName(student.first_name);
    setProfileClass(student.class_level);
    setProfileSubjects(student.subjects ?? []);
    setEditingProfile(true);
  };

  const pickProfileClass = (next: number) => {
    hapticTick();
    const offered = new Set(subjectsForClass(next).map(({ subject }) => subject));
    setProfileClass(next);
    // Keep subjects whose names exist at the new stage. Their syllabus codes
    // are remapped on save; a Physics student should not have to pick Physics
    // again merely because 0625 became 9702.
    setProfileSubjects((current) => current.filter((subject) => offered.has(subject)));
  };

  const saveProfile = async () => {
    const firstName = profileName.trim();
    if (!firstName) return toast("Enter the student's first name.", "warn");
    if (!profileSubjects.length) return toast("Pick at least one subject.", "warn");
    setBusy("profile");
    hapticFirm();
    try {
      await updateStudentProfile({
        firstName,
        classLevel: profileClass,
        subjects: profileSubjects.map((subject) => ({
          subject,
          syllabus_code: syllabusCode(subject, profileClass)!,
        })),
      });
      setEditingProfile(false);
      toast("Profile saved.");
    } catch (e) {
      toast((e as Error).message || "The profile could not be saved.", "warn");
    } finally {
      setBusy(null);
    }
  };

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

  /* Guarded: the portal can change the card, the plan, and cancel the
     subscription. Note the honest limit — Stripe's portal authorises on its own
     session once opened, so what this gates is reaching it, not what happens
     inside. */
  const toPortal = () => guard(async () => {
    hapticTick();
    try {
      // Navigates away on success, so there is nothing to report back.
      await openBillingPortal("/settings");
    } catch (e) { toast((e as Error).message || "Billing could not be opened.", "warn"); }
  });

  const pref = (key: keyof Prefs) => (next: boolean) => { void setPref({ [key]: next } as Partial<Prefs>).catch(() => toast("That setting could not be saved. Changes need a connection.", "warn")); };

  /** A consent switch. Optimism is deliberately absent: the thumb moves only
      after the ledger has confirmed, and reverts on failure. */
  const consentSwitch = (purpose: string) => (next: boolean) => guard(async () => {
    setBusy(purpose);
    hapticFirm();
    try {
      await setConsent(purpose, next);
      toast(next
        ? "Consent recorded."
        : "Consent withdrawn. Processing for this stops now.");
    } catch (e) {
      await refreshConsent().catch(() => { /* leave what we had */ });
      // The guard opened the window before this ran, so a refusal here means it
      // closed in between — a slow sheet, a phone that slept. Say which, rather
      // than reporting a permissions error to a parent who just confirmed.
      toast(isParentModeRequired(e)
        ? "That took long enough for the confirmation to expire. Try once more."
        : (e as Error).message || "That could not be recorded.", "warn");
    } finally {
      setBusy(null);
    }
  });

  return (
    <>
      <div className="greet"><h1>Settings</h1></div>

      <ProfileChooser />
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
            <fieldset className="lookrow" aria-label="Your picture">
              {AVATAR_PRESETS.map((p) => {
                const on = chosen && student.avatar_seed === p.key;
                return (
                  <label
                    key={p.key}
                    className={"look" + (on ? " on" : "")}
                    title={p.title}
                  >
                    <input type="radio" name="avatar" value={p.key} checked={!!on}
                      aria-label={p.title} onChange={() => { void pickAvatar(p.key); }} />
                    <span
                      className="disc"
                      aria-hidden="true"
                      style={{ background: backgroundFor(p), color: inkFor(p) }}
                    >
                      {initial}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </div>
          <div className="note">
            {chosen
              ? "Yours on every device you sign in on."
              : "Picked for you from your profile. Choose another whenever you like."}
          </div>
        </>
      )}

      <div className="sectitle">Profile</div>
      {editingProfile && student ? (
        <div className="card profileedit">
          <label className="profilefield" htmlFor="settings-student-name">
            <span>First name</span>
            <input
              id="settings-student-name"
              value={profileName}
              autoComplete="given-name"
              onChange={(event) => setProfileName(event.target.value)}
            />
          </label>

          <div className="profilelabel">Stage</div>
          <div className="seg" role="group" aria-label="Class">
            {CLASS_LEVELS.map((level) => (
              <button key={level} type="button" className={level === profileClass ? "on" : undefined}
                      aria-pressed={level === profileClass} onClick={() => pickProfileClass(level)}>
                {level}
              </button>
            ))}
          </div>
          <div className="profilehint">{classLabel(profileClass)} · {BOARD_LABEL}</div>

          <div className="profilelabel">Subjects</div>
          <div className="profilechips" role="group" aria-label="Subjects">
            {subjectsForClass(profileClass).map(({ subject, code }) => {
              const selected = profileSubjects.includes(subject);
              return (
                <button key={subject} type="button" className={"fchip" + (selected ? " active" : "")}
                        aria-pressed={selected} onClick={() => {
                          hapticTick();
                          setProfileSubjects((current) => selected
                            ? current.filter((item) => item !== subject)
                            : [...current, subject]);
                        }}>
                  {subject} · {code}
                </button>
              );
            })}
          </div>

          <div className="profileactions">
            <PressBox as="button" type="button" className="btn primary"
                      disabled={busy === "profile"} onClick={() => void saveProfile()}>
              {busy === "profile" ? "Saving…" : "Save profile"}
            </PressBox>
            <button type="button" className="btn plain" disabled={busy === "profile"}
                    onClick={() => setEditingProfile(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="list">
          <PressBox as="button" type="button" className="srow noicon" data-interactive=""
                    disabled={!student} onClick={beginProfileEdit}>
            <div className="lbl">Student<small>{student?.first_name ?? "No profile"}</small></div>
            <div className="aux">Edit</div>
            <Chevron />
          </PressBox>
          <div className="srow noicon">
            <div className="lbl">Board</div>
            <div className="aux">{student ? BOARD_LABEL : "—"}</div>
          </div>
          <div className="srow noicon">
            <div className="lbl">Stage</div>
            <div className="aux">{student ? classLabel(student.class_level) : "—"}</div>
          </div>
          <div className="srow noicon">
            <div className="lbl">Subjects</div>
            <div className="aux">
              {student?.subjects?.length ? student.subjects.join(", ") : "None yet"}
            </div>
          </div>
        </div>
      )}


      {/* ── Billing ──
          Four states, and the read itself is a fifth. "Loading" is not "free"
          and a failed read is not "past due": a claim about someone's money is
          the last thing this interface should guess at, so an unreachable read
          says so rather than naming a state. */}
      <div className="sectitle">Billing</div>

      {billingRead === "ready" && entitlements?.billingState === "past_due" && (
        <PressBox
          as="button" type="button" className="card attention" data-interactive=""
          onClick={() => toPortal()}
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
            onClick={() => toPortal()}
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


      {consentResource.state === "failed" && <button onClick={() => void refreshConsent()}>Retry consent</button>}
      <div className="sectitle">Notifications</div>
      <div className="list">
        <div className="srow noicon">
          <div className="lbl">Paper ready<small>Extraction finished and ready to review</small></div>
          <span className="locked">Not available yet</span>
        </div>
        <div className="srow noicon">
          <div className="lbl">Correction needed<small>An item came back Unsure</small></div>
          <span className="locked">Not available yet</span>
        </div>
        <div className="srow noicon">
          <div className="lbl">
            Weekly digest to the parent
            <small>Consent — turning this off is recorded as a withdrawal</small>
          </div>
          {consentResource.state === "ready" && typeof consent.weekly_parent_digest === "boolean" ? (
          <Switch
            label="Weekly digest to the parent"
            on={consent.weekly_parent_digest === true}
            busy={busy === "weekly_parent_digest"}
            disabled={!guardian || busy === "weekly_parent_digest"}
            onChange={(n) => void consentSwitch("weekly_parent_digest")(n)}
          />
          ) : <span role="status">Consent {consentResource.state === "loading" ? "loading…" : "unavailable"}</span>}
        </div>
      </div>
      <div className="note">Paper notifications are not available yet.</div>

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
          {consentResource.state === "ready" && typeof consent.improve_extraction === "boolean" ? (
          <Switch
            label="Help improve extraction"
            on={consent.improve_extraction === true}
            busy={busy === "improve_extraction"}
            disabled={!guardian || busy === "improve_extraction"}
            onChange={(n) => void consentSwitch("improve_extraction")(n)}
          />
          ) : <span role="status">Consent {consentResource.state === "loading" ? "loading…" : "unavailable"}</span>}
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
            onPick={(theme) => void setPref({ theme }).catch(() => toast("That setting could not be saved. Changes need a connection.", "warn"))}
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
            onPick={(text_size) => void setPref({ text_size }).catch(() => toast("That setting could not be saved. Changes need a connection.", "warn"))}
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
        <div className="srow noicon">
          <div className="lbl">
            Product analytics
            <small>Optional PostHog analytics and masked session replay</small>
          </div>
          <Switch
            label="Product analytics"
            on={analyticsAllowed}
            onChange={(next) => {
              hapticTick();
              setAnalyticsConsent(next);
              setAnalyticsAllowed(next);
              toast(next ? "Analytics allowed." : "Analytics turned off.");
            }}
          />
        </div>

        <PressBox
          as="button" type="button" className="srow noicon" data-interactive=""
          disabled={!guardian}
          onClick={() => guard(async () => {
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
          })}
        >
          <div className="lbl">Download your data<small>Profiles, saved results, preferences and consent records</small></div>
          <Chevron />
        </PressBox>

        <PressBox
          as="button" type="button" className="srow noicon" data-interactive=""
          onClick={() => guard(() => {
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
                  try { await LocalDataService.clearStudent(student.id); }
                  catch { throw new Error("Server papers were deleted, but some local copies could not be cleared. Close other Axon tabs and retry cleanup."); }
                  toast("Papers, analysis and local drafts deleted.");
                } catch (e) {
                  toast(isParentModeRequired(e)
                    ? "That took long enough for the confirmation to expire. Try once more."
                    : (e as Error).message || "Deletion failed.", "warn");
                }
              },
            });
          })}
        >
          <div className="lbl">Delete the papers<small>Clears papers and analysis, keeps the profile</small></div>
          <Chevron />
        </PressBox>

        <PressBox
          as="button" type="button" className="srow noicon" data-interactive=""
          disabled={!guardian}
          onClick={() => guard(() => {
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
                } catch (e) {
                  toast(isParentModeRequired(e)
                    ? "That took long enough for the confirmation to expire. Try once more."
                    : (e as Error).message || "Deletion failed.", "warn");
                }
              },
            });
          })}
        >
          <div className="lbl">Delete this account<small>Removes everything. Cannot be undone.</small></div>
          <Chevron />
        </PressBox>
      </div>
      <div className="note">
        No targeted advertising. There&rsquo;s nothing to opt out of because it was never built in.
      </div>

      <div className="sectitle">About Axon</div>
      <div className="list">
        <Link className="srow noicon" to={paths.privacy}>
          <div className="lbl">Privacy Policy<small>Data, storage, choices and deletion</small></div>
          <Chevron />
        </Link>
        <Link className="srow noicon" to={paths.terms}>
          <div className="lbl">Terms and Conditions<small>Accounts, uploads, AI output and subscriptions</small></div>
          <Chevron />
        </Link>
        <Link className="srow noicon" to={paths.cookies}>
          <div className="lbl">Cookie Policy<small>Necessary storage and optional analytics</small></div>
          <Chevron />
        </Link>
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
