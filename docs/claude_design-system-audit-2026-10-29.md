# Design system audit — 2026-10-29

Dated record. Evidence, not instructions. `docs/specs/Axon.md` and the Constitution outrank it.

Scope: the Axon-Site front end (`src/ui/`), its token and component layer (`src/ui/styles/`), the public `/design-system` reference page, the in-app screens and the fixture harness. The backend repository (`axon-backend`) has no UI and is out of scope.

Method: static analysis of the source, the repo's own test gates, and a rendered check of 13 views at 390, 768 and 1440 px in both themes (axe, WCAG 2.2 AA tags, interactive targets under 44 px, horizontal overflow). Captures and scripts are in the scratchpad, not the repo.

## 1. Summary

| Area | Verdict |
| --- | --- |
| Repo gates | Pass: typecheck, 729 UI tests, 261 node tests, curriculum validation |
| Red reserved for sign-out and deletes | Holds in code (design-rules test). One **reference-page contradiction** |
| Text contrast tokens | Pass for text in both themes. Two **real failures** on accent text on washes and on a white-on-blue button |
| Non-text contrast | **Switch "off" track fails 3:1** in both themes |
| Accessible names and alt text | Static audit clean: 0 unnamed buttons, 0 images without alt |
| Rendered axe, data-driven screens | Clean: Home, Insights, paper overview, nav, review (light) |
| Tap targets ≥ 44 px | **Violations** on the review sheet, dialog and answer fixtures; inline links are the open question |
| Motion timings vs owner spec | **Conflict**: sheets, recompute and scrim disagree with `Axon.md` §6 |
| Token coverage | **Gaps**: no spacing or z-index scale; 132 hex and 148 `rgba()` literals outside `tokens.css`; 456 px font-size literals |
| Icon system | **Split**: Material Symbols in 15 places, hand-drawn inline SVG in 23 files |
| Breakpoints | 18 distinct widths in use; `Axon.md` specifies two (768, 1024) |
| User research | **None on file.** All evidence is desk research and owner decisions |

Priority actions are in §8. Each is a candidate Linear item; none has been filed.

## 2. Repo gates (run locally, 2026-10-29)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | Pass (exit 0) |
| `npx vitest run` (`npm run test:ui`) | 96 files, 729 tests, pass |
| `npm test` (node) | 261 tests, pass |
| `npm run curriculum:validate` | Pass: Cambridge 324, CBSE 424, IB 356 offerings |
| `tests/ui/design-rules.test.ts` | Pass. Confirms `var(--danger)` is consumed only by Settings and the listed destructive-control styles |

Not run: `npm run build` (not needed for this audit), `npm run test:e2e` and `npm run test:a11y` (the Playwright suite starts a `vite preview` server that needs a production build; the render audit below covers the same surfaces directly).

## 3. Token architecture

`src/ui/styles/tokens.css` is well layered: palette (`--p-*`), surface, role, component. Dark is the default and light re-declares only surface and role. The text-role colours were darkened for light-theme AA in a previous review, and the header comments record why.

The architecture is sound. The problems are where the code steps around it:

| Finding | Evidence | Why it matters |
| --- | --- | --- |
| Components read the palette layer directly | `var(--p-*)` used in `cookie-consent.css:80–99`, `app.css:171`, `shell.css:51,54,156` | `tokens.css` says components reference layer 3 or 4 only |
| Hex literals outside tokens | 132 occurrences across 27 files (largest: `system.css` 24, `DesignSystem.css` 17, `scanner.css` 31 via `rgba` and hex, `onboarding-intro.css` 12, `AvatarPicker.css` 8) | Palette swaps will not reach these |
| `rgba()` literals outside tokens | 148 occurrences across 11 files (`system.css` 70, `scanner.css` 30, `DesignSystem.css` 14) | Same; several are shadows, which have no token |
| Raw px font sizes | 456 occurrences across 24 files; `insights.css` 57, `system.css` 158 | `tokens.css` defines `--fs-*` and a user text-size switch that these bypass, so Settings → Text size does not reach them |
| No spacing scale | `grep --space-` returns nothing | Constitution Vol. I Part 2 lists a spacing scale as required |
| No z-index scale | 40 literal `z-index` values across 10 files (`system.css` 20) | Constitution Vol. I Part 2 lists z-index as a token group |
| Ad-hoc durations and easings | `performance.css` redefines `--d-*` and `--spring`; `system.css` sheet timings are separate from `tokens.css` | Two sources of truth for motion |
| No sub-12px text | No `font-size` literal below 12 px | Matches the stated floor (`tokens.css` header) |

The DesignSystem page is itself inconsistent with the token layer. Its `ds-*` rules use `font-family: ui-monospace` at 12 px (`DesignSystem.css:24,171,196`), bespoke weights (650), and an `ds-art-word` text shadow. These are reference-page styles, not product styles, but a page that documents the system should not violate it silently.

## 4. Rule-by-rule check against `Axon.md` §6 and §8

| Rule (source) | Status | Evidence |
| --- | --- | --- |
| Red only for sign-out and destructive deletes (Axon §6, owner 14 Oct) | **Holds in code; contradicted on the reference page** | `Settings.tsx:614,651,701`; `scanner.css:808` (draft delete); `resource-actions.css`; `review-2026-10.css:41,45`. But `DesignSystem.tsx` lists Attention as "Review · warning · **destructive action**", and `Attention` is amber |
| Teacher ink is never assumed red (owner 3 Oct) | Holds for the interface; known open debt | AXO-161 tracks `src/scan/layers.js` red mask; the test suite does not cover it |
| Confidence as form, not colour | Not checked rendered. Source uses dashed for Unsure (`review-2026-10` fixture shows dashed "Unsure") | Pass on the review fixture |
| Material Symbols for icons (owner) | **Partial** | 15 `<MaterialSymbol>` uses, 7 names; 23 files with inline SVG including `TabNav.tsx`, `ThemeToggle.tsx`, `ReviewSheet.tsx`, `Library.tsx`, `Home.tsx` |
| Tap targets ≥ 44 px (Axon §6) | **Violated on some screens** | See §5 |
| Two breakpoints, prefer `clamp()` (Axon §6) | **Violated** | 18 distinct widths in `@media` across `src/ui` (340, 359, 360, 420, 440, 480, 560, 600, 640, 700, 767, 768, 800, 900, 980, 1024, 1250; plus height queries 520 and 700). `DesignSystem.css` alone has four |
| Motion: transform and opacity only (Axon §6) | **Violated, documented** | Colour and shadow transitions are common (`--d-tint`, `--d-glyph`, `--d-plate` are colour cross-fades, recorded in `tokens.css` as deliberate). Strict reading fails |
| Reduced motion honoured (Axon §6) | Mostly holds | OS `prefers-reduced-motion` covered by `app.css:193`, `system.css:1180/1313/1503`. In-app switch via `data-motion="reduce"` in `app.css:202`. Gaps: 5 animated stylesheets have no reduced-motion rule of their own (`AppDropdown.css`, `CurriculumEditor.css`, `cookie-consent.css`, `insights.css`, `performance.css`). The `app.css` and `system.css` globals may cover them; **verify before fixing** |
| Copy: "marks lost", never "score" on summary surfaces | Holds in user-facing copy | Searches find `score` only as code identifiers (`PageSkeleton`, `practice.ts`). `SharedAcademic.tsx` has a `shared-score` class name with "Recorded total" text |
| "to win back", not "+N recoverable" (owner 13 Oct) | Holds | `HomePractice.tsx:98,169`; `PracticeAnalytics.tsx:213` |
| No exclamation marks in copy | Holds in `.tsx` | Only non-null assertions match |
| No emoji | Holds | No matches |
| Never "are you sure?" | Holds in code | Matches are comments that disclaim it (`Settings.tsx:14`, `DraftsSheet.tsx:9`, `useParentMode.tsx:15`) |
| Nav order Home · Library · Scan · Insights · Settings (Axon §4) | Holds | `src/ui/app/nav.tsx` documents the order |
| Addresses only from `paths.ts` (Axon §1) | **Violated** | `/design-system` is a public route in `routes.tsx:17` and is not in `paths.ts` or Axon §4 |

## 5. Rendered audit

Method: a render script loads each view with the repo's own fixture harness (`tests/browser/index.html`, `vite.browser.config.ts`) or the dev server for public pages, waits for network idle and fonts, then runs axe with WCAG 2.0/2.1/2.2 A and AA tags. Interactive elements under 43.5 px in either dimension are listed. Horizontal overflow was zero for all 78 captures.

Fixture caveat: Home and Insights render a loading skeleton unless the fixture is started with `scenario=insights`. The first pass captured skeletons and was discarded. The second pass (`data-*` files) uses real fixture data.

### 5.1 Axe violations

| Screen | Width / theme | Rule | Measured | Element |
| --- | --- | --- | --- | --- |
| `/design-system` hero | 390, 768, 1440, dark (light not verified, see below) | color-contrast (serious) | **3.48:1** white on `#3A86FF`, 12 px text, needs 4.5:1 | `.ds-hero-button` "Explore foundations" |
| Review sheet, "That's right" (`fx-review`) | 390, 768, dark | color-contrast (serious) | **4.42:1** `#3A86FF` on `#1A2537` (accent wash), 13 px, needs 4.5:1 | `button.qact.accent` |

Light theme of the review fixture passes. The first contrast table in this audit computed `#3A86FF` on the plain surface (5.24:1) and passed it; the failure is on the accent wash, which the table did not model.

The `/design-system` light capture was not a light render. The page has its own Dark/Light switch and ignores the `theme` query parameter, so the light result above is the dark page again. Re-run with the switch clicked before treating light as checked.

No axe violations on: Home (`data-home`, all widths and themes), Insights (`data-insights`, all widths and themes), paper overview (`data-paper`), nav (`fx-nav`), practice, scan, onboarding intro, password access, the privacy page.

### 5.2 Interactive targets under 44 px

| Screen | Element | Measured | Notes |
| --- | --- | --- | --- |
| Review sheet, 390 | Back | 34×34 | Icon button; violates Axon's 44 px floor |
| Review sheet, 390 | Save | 35×23 | Text button; violates |
| Review sheet, 390 | "That's right" | 96×36 | Violates |
| Dialog fixture, 390 | Open dialog, Background control | 90×24, 147×24 | Fixture controls; confirm whether shipped |
| Answer fixture, 390 | `x+1` control | 43×31 | Marginal |
| Insights, 390 | All subjects, All papers, Any date, Any tier | 95–118×39 | Filter chips at 39 px height; violate |
| Insights, 390 | Every lost mark, Practise AO2 | 118×21, 169×21 | Inline text links; open question (see below) |
| Home, 390 | Every lost mark, Scan it | 118×21, 61×21 | Text links |
| `/design-system`, `/privacy` | Inline links, email address | 18–33 px tall | Text links in running copy |

Open question for the owner: Axon §6 says every tap target is at least 44 px. Inline links inside a sentence are usually exempt in WCAG 2.5.8 (inline exception), but the Axon rule has no exception. Decide whether inline links count. The Review and Insights filters are unambiguous violations.

### 5.3 Visual review

Captures were viewed for dark and light at 390 and 1440 where noted.

- Review sheet, 390 dark: the core flow reads well. Dashed amber "Unsure" chip, the teacher's mark as a three-option selector, and the unreadable-part fallback ("We could not show this part of the page") are visible and follow the rules. Drawn-answer handling was not in the capture. The accent "That's right" button is the one low-contrast control.
- Nav, 390 dark: the glass tab bar with the Settings avatar matches Axon §6 and the `AGENTS.md` nav notes.
- Insights, 1440 light: the layout is dense but disciplined. Sample sizes appear beside headlines ("48 marks lost in total across 36 confirmed questions · 6 papers"), which meets the copy rules. Practice and grade-outlook sections are on the page, and the grade outlook is off by default. Two controls (the subject and paper filters) are the small targets above.
- Home, 390 dark: Next step, today's re-attempts, the "where the most marks are" list and progress all render with real sample data. The practice streak copy explains the weekend and freeze rules. The Start button is the one primary action.
- `/design-system`, 1440 dark: the reference page is polished, but its own hero button fails contrast and it lists amber as "destructive action".
- Cookie banner, public pages: the "Allow analytics" button is a solid dark fill and "Necessary only" is an outline. Emphasis is unequal. Consent choices should be presented with equal prominence. This is a legal and UX question for counsel, not a design-system fix. Flagged, not changed.

## 6. Components and states

Static checks:

- Every `<button>` either has a visible text child or an `aria-label`/`aria-labelledby`/`title`, except 35 buttons whose children are dynamic expressions. Those need a runtime check; none failed the rendered axe run.
- Every `<img>` has an `alt` attribute. Decorative images use `alt=""`.
- Three inputs flagged by the AST pass were checked and are not defects: two hidden file inputs (`useIngestion.tsx:210`, `Scan.tsx:273`) and a checkbox wrapped in its own `<label>` (`Practice.tsx:294`).
- Focus rings: 49 `:focus-visible` rules in the stylesheets. The design-rules test does not check focus.
- Reduced motion: see §4.

Not verified: real-device behaviour, VoiceOver and TalkBack, screen-reader announcement order, and keyboard-only flows in the sheets. `Axon.md` §10 says these need a physical device or assistive technology; none was available here.

## 7. Research and evidence

- There is **no primary user research on file**: no interview notes, usability sessions, surveys or diary data. The research skills needed inputs that do not exist, so no synthesis has been produced.
- The evidence that exists is desk research with citations in `docs/claude_insights-research-and-design-2026-10-04.md` (Hattie and Timperley; Soicher and Gurung; Cambridge examiner reports; Dunlosky et al.) and owner decisions.
- The scanner has no testing with real students and no real-device trial. `Axon.md` §7 says tuning requires owner-supplied footage. This is the largest evidence gap for the Scan flow.
- Recommended before the private beta (15 Oct target has passed, so treat as the next gate): a moderated usability session on the review and Home flows with 5 students and one parent, scripted from `docs/specs/Axon.md` §8 copy rules. Record outcomes in Linear; do not synthesise without transcripts.

## 8. Priority actions

1. **Fix the review sheet's tap targets and the accent-on-wash contrast.** Back, Save, "That's right", and the accent text on `--accent-wash` in dark. Core flow, measured failures.
2. **Fix the hero button on `/design-system`** (3.48:1). Either darken the fill for white text or use the dark ink token. Then re-check the light theme by clicking the switch.
3. **Resolve the motion conflict with the owner.** `Axon.md` §6 says sheets 440/300 ms, recompute 320 ms, scrim unspecified. Code says sheets 280/240 ms (`system.css:1485–1486`, `Dialog.tsx` `SHEET_EXIT_MS = 240`), recompute 280 ms (`tokens.css:386`) and 260 ms (`performance.css:15`). `performance.css` asserts "every finite decorative transition settles inside 280ms". Record in Linear as a disagreement; do not pick silently.
4. **Fix the Switch off-track contrast** (1.6:1 dark, 1.4:1 light, needs 3:1). Use a non-text boundary token (`--label-3` or a new `--control-edge`).
5. **Make `/design-system` consistent.** Add it to `paths.ts` and Axon §4, or remove it from the public router. Remove amber's "destructive action" wording.
6. **Add spacing and z-index token scales** (Constitution Vol. I Part 2), then migrate the most-used literals. Start with the 456 px font sizes in `insights.css` and `system.css`; they bypass the text-size switch.
7. **Pick one icon source.** Migrate the hand-drawn chevrons, close marks and theme glyphs to Material Symbols, or record in Linear that the nav glyphs are an approved exception.
8. **Decide the two-breakpoint rule.** Either bring the 18 widths down to 768 and 1024, or write the exceptions into Axon §6.
9. **Confirm the inline-link rule** (§5.2) and the cookie-banner button parity with counsel.
10. **Re-run the rendered audit after fixes** using `scenario=insights` for data screens and clicking the theme switch on `/design-system`.

## 9. Method limits

- Chromium only, on Linux. The repo's CI also runs WebKit; this audit did not.
- Fixtures, not production data or a live Supabase project. Consent and account screens were checked only where the harness renders them.
- Contrast was computed from token values and the rendered pair; blended and gradient backgrounds were not sampled exhaustively.
- Generic taste-skill rules (no gradients, no shadows at rest, no eyebrows, no hairlines) were used as a lens only. `Axon.md` and the owner decisions outrank them, and several are deliberate (the glass nav, the card shadow in light mode, the avatar gradient). They are not counted as violations in §4.
- No Linear issues were created. Items above are candidates for the owner to prioritise.
