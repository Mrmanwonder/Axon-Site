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

/* Five phases rather than eight steps: the flow branches, so a step count would
   either be wrong on one path or have to lie about the total. */
export const PHASES = ["Account", "Verify", "Consent", "Plan", "Student"];

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

/** Brand marks. Google keeps its four colours because its brand terms require
    them; Apple's is currentColor, which the CSS resolves to black on light and
    white on dark — exactly the pair Apple specifies. */
export const BRAND = {
  google: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7Z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z" />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" className="apl" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.377-2.376-2.076-.16-3.844 1.132-4.923 1.132ZM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.687.805-3.583 1.818-.804.896-1.482 2.337-1.296 3.714 1.343.104 2.79-.688 3.634-1.703Z" />
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
