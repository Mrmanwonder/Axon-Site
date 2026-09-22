/* ═══════════════════════════════════════════════════════════════════════════
   ONBOARDING CHROME

   The pieces every step is built from: the shell with its back affordance and
   phase rail, the field, the amber error, and the icon set.

   Icons are drawn on a 24px grid but render at 16-19px, so each is two or three
   strokes. Anything busier turns to mush at the size it actually ships at.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import PressBox from "../components/PressBox";
import { hapticTick } from "../lib/haptics";

/* Four phases rather than a step count: the flow branches, so a step count would
   either be wrong on one path or have to lie about the total. */
export const PHASES = ["Account", "Consent", "Plan", "Student"];

export const ICONS = {
  back: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  tick: <path d="M20 6 9 17l-5-5" />,
  trend: <path d="M4 16.5 9 9.5l4 4 7-9" />,
  paper: <><path d="M6 4.5h9l4 4V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" /><path d="M14.5 4.5V9H19" /></>,
  read: <path d="M5 7.5h10M5 12h13M5 16.5h7" />,
  explain: <><path d="M12 4a5.5 5.5 0 0 0-3 10.1V17h6v-2.9A5.5 5.5 0 0 0 12 4Z" /><path d="M10.5 20h3" /></>,
  mail: <><path d="M4 7h16v10H4z" /><path d="m4.5 7.5 7.5 5.5 7.5-5.5" /></>,
  spark: <><circle cx="12" cy="12" r="2.8" /><path d="M12 4.5v2.4M12 17.1v2.4M4.5 12h2.4M17.1 12h2.4" /></>,
  shield: <path d="M12 3.5 5 6v6c0 4 3 7 7 8.5 4-1.5 7-4.5 7-8.5V6l-7-2.5Z" />,
  never: <><circle cx="12" cy="12" r="8.5" /><path d="m6.5 17.5 11-11" /></>,
  clock: <><path d="M12 7v5l3.5 2" /><circle cx="12" cy="12" r="9" /></>,
  card: <path d="M3 9.5h18M3 7.5h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  cap: <><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="M6.5 10.5V16c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-5.5" /></>,
  person: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5" /></>,
  pencil: <path d="M4.5 19.5l1-4L16 5l3 3L8.5 18.5l-4 1Z" />,
  stamp: <><path d="M12 3.5 5 6v6c0 4 3 7 7 8.5 4-1.5 7-4.5 7-8.5V6l-7-2.5Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  warn: <><path d="M12 8v5M12 16.5v.4" /><path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>,
  info: <><path d="M12 15.5v.4M12 7v5" /><circle cx="12" cy="12" r="9" /></>,
} as const;

export const Icon = ({ d, className }: { d: ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">{d}</svg>
);

export const Chev = () => (
  <svg className="chev" viewBox="0 0 7 12" stroke="currentColor" strokeWidth="1.8"
       fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 1l5 5-5 5" />
  </svg>
);

/** Google keeps its four brand colours rather than recolouring the mark. */
export const BRAND = {
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
    </svg>
  ),
} as const;

/** Chrome common to every step. Steps outside the numbered flow get no rail —
    landing and the student's own first run are not partway through anything,
    and on the two dead ends a rail would claim progress through a flow that has
    just stopped. */
export function Shell({
  children, title, sub, phase, onBack,
}: {
  children: ReactNode;
  title?: string;
  sub?: string;
  phase?: number;
  onBack?: () => void;
}) {
  /* `#obroot` is not decorative and it is not a leftover mount point: twenty
     rules in system.css are scoped to it, including the whole onboarding
     palette (`.ic-b`, `.ic-g`, `.ic-a`, `.ic-n`) and the `--ob-*` tokens that
     tint the background wash. Without this wrapper the flow renders, and the
     row icons silently lose their colour — which is exactly how it was found. */
  return (
    <div id="obroot" aria-label="Set up your account">
      <div className="obwrap">
        <div className="obhead">
        {onBack && (
          <PressBox
            as="button" type="button" className="obback" aria-label="Back"
            onClick={() => { hapticTick(); onBack(); }}
          >
            <Icon d={ICONS.back} />
          </PressBox>
        )}
        {phase !== undefined && (
          <div className="obprog">
            <div
              className="segs"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={PHASES.length}
              aria-valuenow={phase + 1}
              aria-valuetext={`${PHASES[phase]} — phase ${phase + 1} of ${PHASES.length}`}
            >
              {PHASES.map((_, i) => (
                <i key={i} className={i < phase ? "done" : i === phase ? "now" : undefined}>
                  <span />
                </i>
              ))}
            </div>
            <div className="ph">{PHASES[phase]}</div>
          </div>
          )}
        </div>
        <div className="view on obview">
          {title && (
            <div className="greet">
              <h1>{title}</h1>
              {sub && <div className="sub">{sub}</div>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Amber, never red: red is the sign-out row and nothing else. An error here is
    something to fix, not a rebuke. */
export function Err({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="draft" role="alert">
      <div className="ic"><Icon d={ICONS.warn} /></div>
      <div className="b"><div className="t2">{message}</div></div>
    </div>
  );
}

export function Field({
  id, label, value, onChange, placeholder, hint, autoComplete, className, type = "text", onEnter,
  inputMode, maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  autoComplete?: string;
  className?: string;
  type?: string;
  onEnter?: () => void;
  /** "numeric" for the OTP field — the large numeric keypad iOS and Android
      both show, and what makes `autoComplete="one-time-code"` actually take
      effect on iOS Safari. */
  inputMode?: "text" | "numeric" | "email" | "tel";
  maxLength?: number;
}) {
  return (
    <div className={"obfield " + (className ?? "")}>
      <label className="k" htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete ?? "off"}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }}
      />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Method({
  icon, tone = "ic-b", t1, t2, onClick,
}: {
  icon: ReactNode;
  tone?: string;
  t1: string;
  t2?: string;
  onClick: () => void;
}) {
  return (
    <PressBox as="button" type="button" className="method" onClick={onClick}>
      <div className={"ic " + tone}><Icon d={icon} /></div>
      <div className="b">
        <div className="t1">{t1}</div>
        {t2 && <div className="t2">{t2}</div>}
      </div>
      <Chev />
    </PressBox>
  );
}

export function SRow({
  tone, icon, label, small, trailing,
}: {
  tone: string;
  icon: ReactNode;
  label: string;
  small?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="srow">
      <div className={"ic " + tone}><Icon d={icon} /></div>
      <div className="lbl">{label}{small && <small>{small}</small>}</div>
      {trailing}
    </div>
  );
}
