import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { useDialogDismiss } from "./Dialog";
import { hapticTick } from "../lib/haptics";

/* AXO-302: the "how hard was the paper" orb. One drag, five steps. The orb is a
   critically damped spring (period 0.5 s, no overshoot) that settles on the
   nearest step; its colour is mixed from the steps either side of where it is.
   Transform and opacity animate; the rest is set once per frame as custom
   properties on the sheet. Nothing moves under reduced motion. Hue runs
   teal, blue, violet, magenta, amber: a difficulty is a feeling, not a
   severity, and red stays reserved for Sign out and destructive deletes. */

export const DIFFICULTY_WORDS = ["Very easy", "Easy", "About right", "Hard", "Very hard"] as const;

/* Per step: [highlight, body, shadow, accent] as rgb triples. */
const PAL: number[][][] = [
  [[200, 255, 242], [60, 201, 196], [10, 90, 102], [213, 255, 154]],
  [[191, 230, 255], [76, 149, 255], [18, 48, 127], [124, 255, 224]],
  [[214, 196, 255], [122, 74, 240], [38, 21, 128], [255, 154, 230]],
  [[255, 168, 226], [196, 52, 160], [58, 12, 68], [255, 176, 90]],
  [[255, 133, 0], [255, 109, 0], [255, 84, 0], [255, 133, 0]],
];
const STEPS = PAL.length;
const LAST = STEPS - 1;
const clamp = (x: number) => Math.max(0, Math.min(LAST, x));
const rgb = (a: number[]) => `rgb(${a.join(",")})`;
/* Past either end the orb resists: distance grows, but ever more slowly. */
const rubber = (over: number, dim: number) => (over * dim * .55) / (dim + .55 * Math.abs(over));

function mix(v: number, slot: number): number[] {
  const c = clamp(v), i = Math.min(LAST - 1, Math.floor(c)), k = c - i;
  const a = PAL[i][slot], b = PAL[i + 1][slot];
  return [0, 1, 2].map((j) => Math.round(a[j] + (b[j] - a[j]) * k));
}

const reducedMotion = () => document.documentElement.dataset.motion === "reduce"
  || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

export default function PaperDifficultyOrb({ initial, saved, onSave }: {
  /** 1 to 5 when the student has already answered; otherwise the middle step. */
  initial: number | null;
  /** Set by the parent once the write has gone through. */
  saved: boolean;
  onSave: (rating: number) => Promise<void>;
}) {
  const dismiss = useDialogDismiss();
  const start = initial && initial >= 1 && initial <= STEPS ? initial - 1 : 2;
  const [shown, setShown] = useState(start);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const flight = useRef(false);
  const sim = useRef({
    v: start, vel: 0, target: start, drag: false, from: 0, v0: 0, raf: 0, last: 0, lastShown: start,
    hist: [] as { t: number; v: number }[],
  });
  const paintRef = useRef<() => void>(() => {});
  const stepRef = useRef<FrameRequestCallback>(() => {});

  useEffect(() => {
    const s = sim.current;
    const host = zone.current?.closest<HTMLElement>(".sheet");
    if (!host) return;
    const paint = () => {
      const c = clamp(s.v), w = c / LAST, c1 = mix(s.v, 1);
      const light = document.documentElement.dataset.theme === "light";
      const st = host.style;
      st.setProperty("--c0", rgb(mix(s.v, 0)));
      st.setProperty("--c1", rgb(c1));
      st.setProperty("--c2", rgb(mix(s.v, 2)));
      st.setProperty("--cx", rgb(mix(s.v, 3)));
      st.setProperty("--amb", `rgba(${c1.join(",")},${((light ? .2 : .34) - w * .08).toFixed(2)})`);
      st.setProperty("--w", w.toFixed(3));
      st.setProperty("--dk", (w * w * .7).toFixed(3));
      st.setProperty("--bo", (.95 - w * .45).toFixed(2));
      st.setProperty("--tx", `${((s.v - 2) * 15).toFixed(1)}px`);
      st.setProperty("--ty", `${(w * 7).toFixed(1)}px`);
      const lean = Math.max(-3, Math.min(3, s.vel));
      st.setProperty("--sx", (1 + Math.min(.03, Math.abs(s.vel) * .008)).toFixed(4));
      st.setProperty("--sk", `${(-lean * .8).toFixed(2)}deg`);
      const r = Math.round(s.drag ? c : s.target);
      if (r !== s.lastShown) {
        s.lastShown = r;
        if (s.drag) hapticTick();
      }
      setShown(r);
    };
    paintRef.current = paint;
    const step = (now: number) => {
      const dt = Math.min(.05, (now - (s.last || now)) / 1000);
      s.last = now;
      const om = 2 * Math.PI / .5, n = Math.max(1, Math.ceil(dt / .008)), h = dt / n;
      for (let i = 0; i < n; i++) {
        s.vel += (-om * om * (s.v - s.target) - 2 * om * s.vel) * h;
        s.v += s.vel * h;
      }
      paint();
      if (Math.abs(s.v - s.target) < .0006 && Math.abs(s.vel) < .01) {
        s.v = s.target; s.vel = 0; paint(); s.raf = 0; s.last = 0; return;
      }
      s.raf = requestAnimationFrame(step);
    };
    stepRef.current = step;
    paint();
    return () => {
      cancelAnimationFrame(s.raf); s.raf = 0;
      for (const p of ["--c0", "--c1", "--c2", "--cx", "--amb", "--w", "--dk", "--bo", "--tx", "--ty", "--sx", "--sk"]) host.style.removeProperty(p);
    };
  }, []);

  const settle = () => {
    const s = sim.current;
    if (reducedMotion()) { cancelAnimationFrame(s.raf); s.raf = 0; s.v = s.target; s.vel = 0; paintRef.current(); return; }
    if (!s.raf) {
      s.last = 0;
      s.raf = requestAnimationFrame(stepRef.current);
    }
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (busy || saved) return;
    const s = sim.current;
    s.drag = true; cancelAnimationFrame(s.raf); s.raf = 0;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events have no active pointer */ }
    s.from = e.clientX; s.v0 = s.v; s.vel = 0;
    s.hist = [{ t: performance.now(), v: s.v }];
    setTouched(true);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (!s.drag) return;
    const raw = s.v0 + (e.clientX - s.from) / 80;
    s.v = raw < 0 ? -rubber(-raw, 1.2) : raw > LAST ? LAST + rubber(raw - LAST, 1.2) : raw;
    const now = performance.now();
    s.hist.push({ t: now, v: s.v });
    while (s.hist.length > 2 && now - s.hist[0].t > 90) s.hist.shift();
    const a = s.hist[0], b = s.hist[s.hist.length - 1];
    s.vel = b.t > a.t ? (b.v - a.v) / ((b.t - a.t) / 1000) : 0;
    paintRef.current();
  };
  const onUp = () => {
    const s = sim.current;
    if (!s.drag) return;
    s.drag = false;
    s.target = Math.max(0, Math.min(LAST, Math.round(s.v + s.vel * .499)));
    settle();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (busy || saved) return;
    const s = sim.current;
    let r = Math.round(s.target);
    if (e.key === "ArrowRight" || e.key === "ArrowUp") r = Math.min(LAST, r + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") r = Math.max(0, r - 1);
    else if (e.key === "Home") r = 0;
    else if (e.key === "End") r = LAST;
    else return;
    e.preventDefault();
    setTouched(true);
    s.target = r;
    settle();
  };

  async function save() {
    if (flight.current || saved) return;
    const s = sim.current;
    cancelAnimationFrame(s.raf); s.raf = 0;
    s.target = Math.round(s.target); s.v = s.target; s.vel = 0; s.drag = false;
    paintRef.current();
    flight.current = true; setBusy(true); setFault(false);
    try { await onSave(s.target + 1); }
    catch { setFault(true); }
    finally { flight.current = false; setBusy(false); }
  }

  /* After the write: one ring leaves the orb, then the sheet goes. */
  useEffect(() => {
    if (!saved) return;
    const el = ring.current;
    if (el && !reducedMotion()) { el.classList.remove("go"); void el.offsetWidth; el.classList.add("go"); }
    const timer = window.setTimeout(dismiss, reducedMotion() ? 1200 : 1800);
    return () => window.clearTimeout(timer);
  }, [saved, dismiss]);

  return <div className="pd-orb-wrap" data-done={saved || undefined}>
    <div ref={zone} className="pd-zone" role="slider" tabIndex={0}
      aria-label="How difficult the paper felt" aria-valuemin={1} aria-valuemax={STEPS}
      aria-valuenow={shown + 1} aria-valuetext={DIFFICULTY_WORDS[shown]}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
      <div className="pd-halo" aria-hidden="true" />
      <div className="pd-ring" ref={ring} aria-hidden="true" />
      <div className="pd-ow" aria-hidden="true"><div className="pd-breath"><div className="pd-press"><div className="pd-orb">
        <div className="pd-spin"><i className="pd-bl k1" /><i className="pd-bl k2" /><i className="pd-bl k3" /></div>
        <div className="pd-spin s2"><i className="pd-bl k4" /><i className="pd-bl k3" style={{ left: "60%", top: "30%" }} /></div>
        <i className="pd-dark" /><i className="pd-top" /><i className="pd-pool" /><i className="pd-arc" /><i className="pd-gloss" /><i className="pd-gr" /><i className="pd-rim" />
      </div></div></div></div>
      <div className="pd-hint" style={{ opacity: touched ? 0 : 1 }} aria-hidden="true">Drag the orb</div>
      <div className="pd-pips" aria-hidden="true">{DIFFICULTY_WORDS.map((w, k) => <i key={w} className={k === shown ? "on" : undefined} />)}</div>
    </div>
    <div className="pd-word" aria-hidden="true">{DIFFICULTY_WORDS[shown]}</div>
    <div className="pd-count" aria-hidden="true">{shown + 1} of {STEPS}</div>
    {fault && <p className="pd-fault" role="alert">That did not save. Check your connection and try again.</p>}
    <div className="acts pd-acts">
      <button type="button" className="btn primary" disabled={busy || saved} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>
      <button type="button" className="btn plain" disabled={busy || saved} onClick={dismiss}>Not now</button>
    </div>
  </div>;
}
