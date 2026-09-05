/* One disclosure, in the pre-port markup exactly.
   `.disclose` / `.toggle` / `.car` / `.panel` / `.inner` come from the
   stylesheet unchanged; the only thing this adds is the measured height the
   original set from its own script, because `height: auto` cannot be
   transitioned. Collapsed is the resting state — see the note at the call
   site in QuestionDetail for why that matters there. */

import { useEffect, useRef, useState } from "react";

export default function Disclose({
  label, children, onOpen,
}: {
  label: string;
  children: React.ReactNode;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = panel.current, i = inner.current;
    if (!p || !i) return;
    p.style.height = open ? `${i.offsetHeight}px` : "0px";
  }, [open, children]);

  return (
    <div className={"disclose" + (open ? " open" : "")}>
      <button
        type="button"
        className="toggle"
        aria-expanded={open}
        onClick={() => { if (!open) onOpen?.(); setOpen((v) => !v); }}
      >
        <span>{label}</span>
        <svg className="car" viewBox="0 0 7 12" stroke="currentColor" strokeWidth="2" fill="none"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 1l5 5-5 5" /></svg>
      </button>
      <div className="panel" ref={panel} aria-hidden={!open}>
        <div className="inner" ref={inner}>{children}</div>
      </div>
    </div>
  );
}
