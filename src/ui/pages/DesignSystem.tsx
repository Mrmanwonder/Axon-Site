import { useEffect, useRef, useState, type ReactNode } from "react";
import { PRESETS as AVATAR_PRESETS, avatarRenderFor, initialFor } from "../../avatar.js";
import { MaterialSymbol, type MaterialSymbolName } from "../components/MaterialSymbols";
import Switch from "../components/Switch";
import EssentialButton, { type EssentialSize } from "../components/EssentialButton";
import "./DesignSystem.css";

/*
 * Public design-system reference, not a second theme.
 * Swatches, type and radii resolve the same tokens the production app uses.
 * Component examples are explicitly labelled as previews; no student data.
 */

const sections = [
  { id: "overview", name: "Overview", group: "Introduction" },
  { id: "identity", name: "Identity", group: "Foundations" },
  { id: "colors", name: "Colors", group: "Foundations" },
  { id: "typography", name: "Typography", group: "Foundations" },
  { id: "layout", name: "Layout & shape", group: "Foundations" },
  { id: "avatars", name: "Avatars", group: "Foundations" },
  { id: "components", name: "Components", group: "Interface" },
  { id: "states", name: "States & evidence", group: "Interface" },
  { id: "motion", name: "Motion", group: "Interface" },
  { id: "principles", name: "Principles", group: "Reference" },
] as const;

type Theme = "dark" | "light";
const sourceBase = "https://github.com/Mrmanwonder/Axon-Site/blob/main/";

const semanticColors = [
  { name: "Accent", token: "--accent", usage: "Primary action · selected · navigation" },
  { name: "Positive", token: "--positive", usage: "Confirmed state · improvement" },
  { name: "Attention", token: "--attention", usage: "Review · warning · destructive action" },
  { name: "Sign out", token: "--signout", usage: "Reserved for the sign-out row only" },
] as const;
const surfaceColors = [
  { name: "Background", token: "--bg" },
  { name: "Surface", token: "--surface" },
  { name: "Sunk", token: "--surface-sunk" },
  { name: "Field", token: "--field" },
  { name: "Primary text", token: "--label" },
  { name: "Secondary text", token: "--label-2" },
] as const;
const causeColors = [
  { name: "Conceptual gap", token: "--cause-conceptual-gap" },
  { name: "Procedural slip", token: "--cause-procedural-slip" },
  { name: "Misread question", token: "--cause-misread-question" },
  { name: "Incomplete", token: "--cause-incomplete" },
  { name: "Presentation", token: "--cause-presentation" },
  { name: "Keyword miss", token: "--cause-keyword-miss" },
  { name: "Timed out", token: "--cause-timed-out" },
] as const;
const radii = [
  { name: "Card", token: "--r-card" },
  { name: "Sheet", token: "--r-sheet" },
  { name: "Navigation", token: "--r-nav" },
  { name: "Pill", token: "--r-pill" },
  { name: "Button", token: "--r-btn" },
  { name: "Filter chip", token: "--r-fchip" },
  { name: "Field", token: "--r-field" },
  { name: "Tile", token: "--r-tile" },
] as const;

const portraitKeys = ["dreamBloom", "aquaViolet", "midnightLime", "emberViolet", "citrusMint", "frostCobalt", "copperRose"];
const glyphNames: MaterialSymbolName[] = ["back", "chevron", "share", "edit", "rescan", "zoom", "confirmed", "attention", "delete"];

function useTokenValue(token: string, theme: Theme) {
  const [value, setValue] = useState("");
  useEffect(() => {
    const host = document.querySelector(".ds-site");
    if (host) setValue(getComputedStyle(host).getPropertyValue(token).trim());
  }, [token, theme]);
  return value;
}
function SectionHeading({ index, title, description, id }: { index: string; title: string; description: string; id: string }) {
  return <div className="ds-section-heading">
    <div className="ds-section-overline"><span>{index}</span><span className="ds-rule" /><span>{id}</span></div>
    <h2>{title}</h2>
    <p>{description}</p>
  </div>;
}
function CopyButton({ value, label = "Copy", title }: { value: string; label?: string; title?: string }) {
  const [message, setMessage] = useState("");
  const clearRef = useRef<number | null>(null);
  useEffect(() => () => { if (clearRef.current !== null) window.clearTimeout(clearRef.current); }, []);
  async function copy() {
    if (!navigator.clipboard?.writeText) { setMessage("Unavailable"); return; }
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied");
    } catch { setMessage("Unavailable"); }
    if (clearRef.current !== null) window.clearTimeout(clearRef.current);
    clearRef.current = window.setTimeout(() => setMessage(""), 1800);
  }
  return <button type="button" className="ds-copy" onClick={() => { void copy(); }} title={title || "Copy to clipboard"} aria-label={(label === "Copy" ? "Copy " : "") + (title || value)}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/></svg>
    <span aria-live="polite">{message || label}</span>
  </button>;
}
function Swatch({ name, token, note, theme }: { name: string; token: string; note?: string; theme: Theme }) {
  const value = useTokenValue(token, theme);
  return <div className="ds-swatch">
    <div className="ds-swatch-paint" style={{ background: "var(" + token + ")" }}><span className="ds-swatch-dot"/></div>
    <div className="ds-swatch-body">
      <div className="ds-swatch-title">{name}</div>
      <span className="ds-mono">{token}</span>
      {note && <small>{note}</small>}
      <div className="ds-swatch-meta"><span className="ds-mono">{value || "Live token"}</span><CopyButton value={value || "var(" + token + ")"} title={token}/></div>
    </div>
  </div>;
}
/* Use the real asset generator without bootstrapping auth, data or the student shell. */
function AvatarDisc({ presetKey, label }: { presetKey: string; label?: string }) {
  const render = avatarRenderFor({ avatar_seed: presetKey });
  return <span className="ds-avatar-disc" data-kind={render.kind} style={{ background: render.background, color: render.color }} aria-hidden="true">
    {render.kind === "dot-face" && render.glyph
      ? <svg viewBox={"0 0 " + render.glyph.size + " " + render.glyph.size} focusable="false">{render.glyph.points.map((point: { x: number; y: number; tone: number }, i: number) =>
          <circle key={i} cx={point.x + .5} cy={point.y + .5} r=".26" fill="currentColor" opacity={point.tone === 0 ? .42 : point.tone === 1 ? .8 : .96}/>
        )}</svg>
      : <span>{initialFor(label)}</span>}
  </span>;
}
function Meta({ children }: { children: ReactNode }) { return <div className="ds-label">{children}</div>; }
function DividerLabel({ children }: { children: React.ReactNode }) { return <div className="ds-subtitle">{children}</div>; }

export default function DesignSystem() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("overview");
  const [selected, setSelected] = useState("Cambridge");
  const [switchOn, setSwitchOn] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [exampleTab, setExampleTab] = useState("Library");
  const [buttonSize, setButtonSize] = useState<EssentialSize>("medium");
  const [buttonState, setButtonState] = useState<"live" | "hover" | "pressed" | "focus" | "loading" | "disabled">("live");
  const [buttonNotice, setButtonNotice] = useState("Try an action. Examples do not change student data.");
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "/" && !editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const visibleSections = sections.filter(s => (s.name + " " + s.group).toLowerCase().includes(search.toLowerCase()));
  const navigate = (id: string) => {
    setActive(id);
    setSearch("");
    document.getElementById("ds-" + id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return <div className="ds-site" data-theme={theme}>
    <a className="ds-skip" href="#ds-main">Skip to content</a>
    <aside className="ds-sidebar" aria-label="Design system navigation">
      <div className="ds-sidebar-top">
        <div className="ds-mark"><img src="/axon-lockup-v2.svg" alt="Axon" /></div>
        <div className="ds-system-name">Design system <span> / 01</span></div>
      </div>
      <label className="ds-search-box">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
        <span className="ds-visually-hidden">Filter navigation</span>
        <input ref={searchRef} aria-label="Filter navigation" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a section" />
        <span className="ds-search-key">/</span>
      </label>
      <nav className={search ? "ds-nav ds-mobile-open" : "ds-nav"}>
        {visibleSections.length === 0 && <p className="ds-no-result">No matching sections</p>}
        {visibleSections.map((s, i) => <div key={s.id}>
          {(i === 0 || visibleSections[i - 1].group !== s.group) && <div className="ds-nav-group">{s.group}</div>}
          <button className={active === s.id ? "ds-nav-item is-active" : "ds-nav-item"} type="button" onClick={() => navigate(s.id)} aria-current={active === s.id ? "location" : undefined}>
            <span>{s.name}</span><span className="ds-nav-arrow">↗</span>
          </button>
        </div>)}
      </nav>
      <div className="ds-sidebar-bottom">
        <span className="ds-live-dot" /><span>Connected to production tokens</span>
        <a href={sourceBase + "src/ui/styles/tokens.css"} target="_blank" rel="noreferrer">View source ↗</a>
      </div>
    </aside>

    <main className="ds-main" id="ds-main" tabIndex={-1}>
      <header className="ds-topbar">
        <div className="ds-breadcrumb">Axon <span>/</span> Design language <span>/</span> <strong>{sections.find(s => s.id === active)?.name || "Overview"}</strong></div>
        <div className="ds-top-actions">
          <div className="ds-theme-switch" role="group" aria-label="Preview theme">
            <button className={theme === "dark" ? "is-on" : ""} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} type="button">Dark</button>
            <button className={theme === "light" ? "is-on" : ""} aria-pressed={theme === "light"} onClick={() => setTheme("light")} type="button">Light</button>
          </div>
          <a className="ds-app-link" href="/">Open Axon <span>↗</span></a>
        </div>
      </header>

      <div className="ds-content">
        <section id="ds-overview" className="ds-section ds-hero-section">
          <div className="ds-hero">
            <div className="ds-hero-copy">
              <div className="ds-overline"><span className="ds-overline-dot"/> AXON / DESIGN REFERENCE</div>
              <h1>One language.<br/><em>Every detail.</em></h1>
              <p>The living reference for Axon’s identity and interface: the actual tokens, patterns, interactions and rules behind the product.</p>
              <div className="ds-hero-actions">
                <button type="button" className="ds-hero-button" onClick={() => navigate("colors")}>Explore foundations <span>↗</span></button>
                <a className="ds-text-link" href={sourceBase + "src/ui/styles/"} target="_blank" rel="noreferrer">Browse CSS source →</a>
              </div>
            </div>
            <div className="ds-hero-art" aria-label="Illustrative Axon design composition">
              <div className="ds-art-grid" />
              <div className="ds-art-ring ds-art-ring-one"/><div className="ds-art-ring ds-art-ring-two"/>
              <div className="ds-art-word">A<span>•</span></div>
              <div className="ds-art-chip ds-art-chip-one">Onest <b>600</b></div>
              <div className="ds-art-chip ds-art-chip-two"><span/> #3A86FF</div>
              <div className="ds-art-foot">Thoughtfully made for learning.</div>
            </div>
          </div>
          <div className="ds-intro-stats">
            <div><span>01</span><strong>One source of truth</strong><small>Production tokens, not a parallel style guide</small></div>
            <div><span>02</span><strong>Two complete themes</strong><small>Dark first · light fully supported</small></div>
            <div><span>03</span><strong>One visual grammar</strong><small>Meaning never depends on color alone</small></div>
          </div>
        </section>

        <section id="ds-identity" className="ds-section">
          <SectionHeading index="01" id="Identity" title="The signature." description="Start with the real Axon artwork. The mark and lockup are production assets, not recreations."/>
          <div className="ds-identity-grid">
            <div className="ds-identity-panel ds-white"><img src="/axon-lockup-v2.svg" alt="Official Axon lockup"/><span>PRIMARY LOCKUP / LIGHT SURFACE</span></div>
            <div className="ds-identity-panel ds-identity-black"><div className="ds-icon-plate"><img src="/axon-logo.svg" alt="Official Axon emblem"/></div><span>SYMBOL / MONOCHROME ASSET</span></div>
          </div>
          <div className="ds-info-line"><p>Keep proportions intact. Use provided SVG or PNG artwork instead of drawing or approximating the mark.</p><div><a href="/axon-lockup-v2.svg" download>Lockup SVG ↗</a><a href="/axon-logo.svg" download>Symbol SVG ↗</a></div></div>
        </section>

        <section id="ds-colors" className="ds-section">
          <SectionHeading index="02" id="Colors" title="Color with intention." description="A semantic palette, not a decoration kit. Click a swatch to copy its resolved value in the selected theme."/>
          <DividerLabel>SEMANTIC / ACTION & MEANING</DividerLabel>
          <div className="ds-color-grid">{semanticColors.map(x => <Swatch key={x.token} name={x.name} token={x.token} note={x.usage} theme={theme}/>)}</div>
          <DividerLabel>SURFACES / HIERARCHY</DividerLabel>
          <div className="ds-color-grid ds-color-grid-six">{surfaceColors.map(x => <Swatch key={x.token} name={x.name} token={x.token} theme={theme}/>)}</div>
          <div className="ds-color-note"><MaterialSymbol name="attention" size={22}/><p><strong>Color is never a verdict.</strong> Red belongs to Sign out only. Amber signals attention. These seven cause hues classify a kind of mistake, never its severity.</p></div>
          <DividerLabel>ANALYSIS / SEVEN CATEGORICAL HUES</DividerLabel>
          <div className="ds-cause-grid">{causeColors.map(x => <div className="ds-cause" key={x.token}><i style={{ background: "var(" + x.token + ")" }}/><div><span>{x.name}</span><small>{x.token}</small></div><CopyButton value={"var(" + x.token + ")"} title={x.token}/></div>)}</div>
          <div className="ds-source-note">Defined in <a href={sourceBase + "src/ui/styles/tokens.css"} target="_blank" rel="noreferrer">src/ui/styles/tokens.css ↗</a></div>
        </section>

        <section id="ds-typography" className="ds-section">
          <SectionHeading index="03" id="Typography" title="Quietly confident." description="Onest is the product typeface: self-hosted, variable, and consistently set tight. Numerals use tabular spacing."/>
          <div className="ds-type-hero"><span>FONT FAMILY / ONEST</span><strong>Aa<span>.</span></strong><p>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br/>abcdefghijklmnopqrstuvwxyz<br/>0123456789 &@!? — ( )</p><small>400 / REGULAR · 500 / MEDIUM · 600 / SEMIBOLD · 700 / BOLD</small></div>
          <div className="ds-type-table">
            {[
              { t: "Display", token: "--fs-h1", demo: "See the bigger picture.", cls: "ds-type-display" },
              { t: "Title", token: "--fs-title", demo: "Your learning, in focus.", cls: "ds-type-title" },
              { t: "Body", token: "--fs-body", demo: "Clear answers are easier to act on.", cls: "ds-type-body" },
              { t: "Meta", token: "--fs-meta", demo: "47 questions · 6 papers", cls: "ds-type-meta" },
              { t: "Section label", token: "--fs-sec", demo: "RECENT PAPERS", cls: "ds-type-overline" },
            ].map(x => <div className="ds-type-row" key={x.t}><div><span>{x.t}</span><code>{x.token}</code></div><strong className={x.cls}>{x.demo}</strong></div>)}
          </div>
          <div className="ds-info-line"><p>Numerals stay stable. Avoid oversized marks: performance is context, never a grade-shaped headline.</p><a href={sourceBase + "src/ui/styles/tokens.css"} target="_blank" rel="noreferrer">Type tokens ↗</a></div>
        </section>

        <section id="ds-layout" className="ds-section">
          <SectionHeading index="04" id="Layout & shape" title="Soft edges. Sharp hierarchy." description="Geometry is deliberately fluid: responsive gutters, rounded surfaces, restrained borders, and a small vocabulary of radii."/>
          <DividerLabel>GEOMETRY / LIVE TOKEN VALUES</DividerLabel>
          <div className="ds-radius-grid">{radii.map(x => <div key={x.token} className="ds-radius"><div className="ds-radius-sample" style={{ borderRadius: "var(" + x.token + ")" }} /><span>{x.name}</span><small>{x.token}</small></div>)}</div>
          <div className="ds-layout-showcase">
            <div className="ds-layout-mobile"><span>380px / MOBILE FIRST</span><div className="ds-mini-phone"><div className="ds-mini-title"/><div className="ds-mini-sub"/><div className="ds-mini-card"><i/><i/><i/></div><div className="ds-mini-nav"><b/><b/><b/><b/></div></div></div>
            <div className="ds-layout-rules"><h3>Built from the smallest screen.</h3><p>Axon begins around a 380px viewport, with fluid spacing and mobile touch ergonomics.</p><div className="ds-measure"><span>44px</span><div>Minimum interactive target</div></div><div className="ds-measure"><span>768px</span><div>Navigation moves into a rail</div></div><div className="ds-measure"><span>1024px</span><div>Rail gains text labels</div></div><p className="ds-muted">Use <code>clamp()</code> for continuous scaling. Respect device safe areas.</p></div>
          </div>
        </section>

        <section id="ds-avatars" className="ds-section">
          <SectionHeading index="05" id="Avatars" title="Identity, without a camera." description="Locally generated gradients and fine dot portraits bring warmth without profile-photo uploads. These previews use Axon’s actual avatar renderer."/>
          <div className="ds-avatars-showcase"><div className="ds-avatar-line">{portraitKeys.map(key => <div className="ds-avatar-example" key={key}><AvatarDisc presetKey={key} label="A"/><span>{AVATAR_PRESETS.find(p => p.key === key)?.title || key}</span></div>)}</div><div className="ds-avatar-line ds-dot-line">{["dotFace01", "dotFace02", "dotFace03", "dotFace04", "dotFace05", "dotFace06", "dotFace07", "dotFace08"].map(key => <div className="ds-avatar-example" key={key}><AvatarDisc presetKey={key}/><span>{key.replace("dotFace", "Portrait ")}</span></div>)}</div></div>
          <div className="ds-source-note">More presets are available in the product. Source: <a href={sourceBase + "src/avatar.js"} target="_blank" rel="noreferrer">src/avatar.js ↗</a></div>
        </section>

        <section id="ds-components" className="ds-section">
          <SectionHeading index="06" id="Components" title="Every interaction belongs." description="Representative live previews of Axon’s controls and their semantic roles. These are examples—not real student records."/>
          <div className="ds-component-grid">
            <div className="ds-component-card">
              <Meta>B5 ESSENTIAL / PRODUCTION COMPONENTS</Meta>
              <div className="ds-button-stack ds-essential-showcase">
                <EssentialButton to="/design-system#ds-layout" size="medium">Explore layout</EssentialButton>
                <EssentialButton variant="secondary" size="medium" onClick={() => setButtonNotice("Review paper is a preview action.")}>Review paper</EssentialButton>
                <EssentialButton variant="quiet" size="medium" onClick={() => setButtonNotice("Not now is a preview action.")}>Not now</EssentialButton>
              </div>
              <p>Graphite in light mode, near-white in dark. Directional arrows are reserved for links. Save and Confirm are text-only actions.</p>
              <div className="ds-demo-response" role="status">{buttonNotice}</div>
            </div>
            <div className="ds-component-card">
              <Meta>SEGMENTED / MUTUALLY EXCLUSIVE</Meta>
              <div className="ds-demo-segment" role="group" aria-label="Example curriculum choice">{["Cambridge", "CBSE", "IB"].map(x => <button key={x} className={selected === x ? "is-on" : ""} type="button" aria-pressed={selected === x} onClick={() => setSelected(x)}>{x}</button>)}</div>
              <div className="ds-demo-choice">Selected <b>{selected}</b></div>
              <p>One selection, one moving emphasis. Labels remain still.</p>
            </div>
            <div className="ds-component-card">
              <Meta>CHIPS / FILTERS</Meta>
              <div className="ds-chip-row">{["All papers", "In progress", "Reviewed"].map(x => <button type="button" className={exampleTab === x ? "ds-chip is-on" : "ds-chip"} key={x} onClick={() => setExampleTab(x)} aria-pressed={exampleTab === x}>{x}</button>)}</div>
              <p>Filters express an active choice with shape and fill.</p>
            </div>
            <div className="ds-component-card">
              <Meta>CONTROL / TOGGLE</Meta>
              <div className="ds-toggle-row"><div><strong>Paper notifications</strong><small>When a paper is ready to read</small></div><Switch on={switchOn} onChange={setSwitchOn} label="Paper notifications" /></div>
              <p>Functional example. The switch changes this preview only.</p>
            </div>
            <div className="ds-component-card ds-component-wide">
              <Meta>B5 ESSENTIAL / SIZES & STATES</Meta>
              <div className="ds-button-controls">
                <div role="group" aria-label="Essential button size" className="ds-demo-segment">
                  {([["compact","44px"],["medium","52px"],["large","56px"]] as const).map(([value,label]) =>
                    <button type="button" key={value} className={buttonSize === value ? "is-on" : ""}
                      aria-pressed={buttonSize === value} onClick={() => setButtonSize(value)}>{label}</button>
                  )}
                </div>
                <div role="group" aria-label="Essential button state" className="ds-essential-state-controls">
                  {(["live","hover","pressed","focus","loading","disabled"] as const).map(value =>
                    <button type="button" key={value} aria-pressed={buttonState === value}
                      className={buttonState === value ? "is-on" : ""} onClick={() => setButtonState(value)}>{value}</button>
                  )}
                </div>
              </div>
              <div className={"ds-essential-states ds-essential-state-" + buttonState}>
                <EssentialButton size={buttonSize} loading={buttonState === "loading"} disabled={buttonState === "disabled"}
                  onClick={() => setButtonNotice("Primary action preview only.")}>Save changes</EssentialButton>
                <EssentialButton variant="secondary" size={buttonSize}
                  loading={buttonState === "loading"} disabled={buttonState === "disabled"}
                  onClick={() => setButtonNotice("Secondary action preview only.")}>Review paper</EssentialButton>
                <EssentialButton variant="quiet" size={buttonSize}
                  loading={buttonState === "loading"} disabled={buttonState === "disabled"}
                  onClick={() => setButtonNotice("Quiet action preview only.")}>Not now</EssentialButton>
              </div>
              <p>Compact 44px · Default 52px · Large 56px. Focus remains keyboard-visible; loading preserves button size and cannot double-submit.</p>
            </div>
            <div className="ds-component-card ds-component-wide">
              <Meta>ICONOGRAPHY / MATERIAL SYMBOLS</Meta>
              <div className="ds-icon-grid">{glyphNames.map(name => <div key={name}><span><MaterialSymbol name={name} size={24}/></span><small>{name}</small></div>)}</div>
              <p>Outlined Google Material Symbols, used consistently and bundled locally.</p>
            </div>
          </div>
        </section>

        <section id="ds-states" className="ds-section">
          <SectionHeading index="07" id="States & evidence" title="Say what is known." description="Confidence is distinguished by form so the meaning survives grayscale, accessibility settings and screenshots."/>
          <div className="ds-confidence-grid">
            <div><span className="ds-status ds-status-confirmed"><MaterialSymbol name="confirmed" size={20}/> Confirmed</span><p>Solid surface; evidence established.</p></div>
            <div><span className="ds-status ds-status-likely">Likely</span><p>Light fill and a visible outline.</p></div>
            <div><span className="ds-status ds-status-unsure">Needs a check</span><p>Dashed outline, no implied certainty.</p></div>
          </div>
          <div className="ds-evidence-example"><div className="ds-evidence-top"><span>EXAMPLE / QUESTION REVIEW</span><span className="ds-status ds-status-unsure">Needs a check</span></div><div className="ds-evidence-main"><div className="ds-paper-mini"><div/><div/><div/><div/></div><div><span className="ds-evidence-kicker">Marking evidence</span><h3>One detail needs your eyes.</h3><p>Review the highlighted part before it affects your insights.</p><button type="button" className="ds-demo-secondary" onClick={() => setSheetOpen(!sheetOpen)}>{sheetOpen ? "Close preview" : "See sheet preview"} <span>↗</span></button></div></div><div className={sheetOpen ? "ds-preview-sheet is-open" : "ds-preview-sheet"} aria-hidden={!sheetOpen}><div className="ds-sheet-handle"/><strong>Review the evidence</strong><p>Example sheet. No student data or marks are shown here.</p><button type="button" onClick={() => setSheetOpen(false)}>Done</button></div></div>
        </section>

        <section id="ds-motion" className="ds-section">
          <SectionHeading index="08" id="Motion" title="Movement with a reason." description="A measured rhythm. Every transition helps orientation; none competes with the act of studying."/>
          <div className="ds-motion-grid">
            {[{ time: "120ms", label: "State", desc: "Selections · controls", token: "--d-state" }, { time: "200ms", label: "Disclose", desc: "Reveal · transition", token: "--d-disclose" }, { time: "280ms", label: "Recompute", desc: "After a correction · current token", token: "--d-recompute" }].map(x => <div className="ds-motion-card" key={x.token}><strong>{x.time}</strong><span>{x.label}</span><p>{x.desc}</p><code>{x.token}</code></div>)}
          </div>
          <div className="ds-motion-rule"><span className="ds-motion-orbit" aria-hidden="true"><span/></span><div><h3>Never motion for its own sake.</h3><p>Transform and opacity, with the sheet curve <code>cubic-bezier(.32,.72,0,1)</code>. Respect OS and in-app reduced-motion settings. No bounces, confetti, mascots or streaks.</p></div></div>
        </section>

        <section id="ds-principles" className="ds-section">
          <SectionHeading index="09" id="Principles" title="The rules behind the pixels." description="These decisions make the interface recognizably Axon—and keep the experience trustworthy."/>
          <div className="ds-principles-grid">
            {[
              ["01", "Evidence before appearance.", "Unconfirmed model output never reads as an established fact."],
              ["02", "Learning over judgement.", "Say “marks lost”, not “score”. Never invent data to populate a blank screen."],
              ["03", "Purposeful restraint.", "No visual severity rainbow, oversized grades, streaks or decorative gamification."],
              ["04", "Accessible by default.", "Keyboard focus, 44px targets, both themes and reduced motion are required."],
              ["05", "Cohesive at any width.", "Design for the phone first. Expand to a rail, not a different product."],
              ["06", "Copy is part of the system.", "Specific, warm and actionable, without exclamation marks or false certainty."],
            ].map(x => <div className="ds-principle" key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong><p>{x[2]}</p></div>)}
          </div>
          <div className="ds-footer"><div><img src="/axon-lockup-v2.svg" alt="Axon" /><p>A maintained window into the real Axon design system.</p></div><div><a href={sourceBase + "Axon.md"} target="_blank" rel="noreferrer">Product rules ↗</a><a href={sourceBase + "Constitution/Volume_I_Design_System_Specification.md"} target="_blank" rel="noreferrer">Constitution ↗</a><a href={sourceBase + "src/ui/styles/"} target="_blank" rel="noreferrer">Design source ↗</a></div></div>
        </section>
      </div>
    </main>
  </div>;
}
