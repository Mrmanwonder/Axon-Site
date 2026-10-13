# Insights and analytics accuracy audit

Date: 13 Oct 2026. Linear: AXO-270 (child of AXO-244). The owner asked in chat:

> Check how every single insight and analytics is calculated. Research and reason what should be done to make them as accurate as possible. Do it ourselves, not with the API, once the data that is needed is received. See if any insight or analytics can be improved or added.

This file is a record and a design reference. It is evidence, not an instruction; `Axon.md` outranks it. It lists every calculation, what was wrong with it, what changed, and the sources behind each change.

## Ground rules kept

- **No model after extraction.** Every number on Insights, Home, the practice analytics and the parent digest is computed deterministically. The client computes from the two analytics views (`src/ui/data/insights.ts`, `syllabusMap.ts`, `stats.ts`, `commandWords.ts`), and the database computes in SQL.
- **Model-written inputs.** The explain stage writes four fields: `cause`, `concepts`, `command_word` and `loss_reasons`. Nothing in this work asks a model anything new.
  - `concepts` is free text, so it is folded deterministically.
  - The model's `command_word` is no longer used for any rate.
- **Hard rules unchanged.**
  - Analytics read only `attempt_analytics` and `mark_loss_analytics`.
  - No marks are computed or adjusted.
  - The cause enum is unchanged.
  - No percentages on screen, and confidence is never shown as a number.
  - The outlook stays opt-in.

## Methods adopted (all in `src/ui/data/stats.ts` unless noted)

| Method | Why | Source |
|---|---|---|
| **One paper's measurement error ≈ 0.55 / √(maximum mark), as a share** | 287 GCSE and A Level units: mean alpha 0.81; SEM interquartile range 3.1 to 5.0 marks; A Level units average 5.5 marks. The SEM tracks √max: about 0.52·√60 for 60-mark units and 0.59·√200 for 200-mark composites. That is about 7% on a 60-mark paper and 12% on a 20-mark test. Any change smaller than that can be noise from one sitting. | Ofqual Reliability Programme: Bramley and Dhawan (2010), *Estimates of reliability of qualifications*; Cambridge Assessment, *Estimates of reliability at qualification level for GCSE and A level examinations* |
| **Wilson score interval** | The textbook interval fails at small n; Wilson is recommended for small samples. It counts questions, not marks, because marks inside one question are not independent. | Brown, Cai and DasGupta (2001), *Interval estimation for a binomial proportion*, Statistical Science 16(2) |
| **Empirical-Bayes beta-binomial shrinkage** | It pulls many small rates (topics, command words) toward the student's own overall rate, in proportion to how little evidence each has. Prior strength comes from the method of moments over the student's groups, clamped to 4 to 60 marks, with a default of 10. | Efron and Morris (1975); the standard beta-binomial empirical-Bayes treatment |
| **Two-proportion z-test** | Comparing shares of questions across two independent sets (digest weeks, first vs last third of papers). | Standard |
| **Paper-by-paper sign agreement** | Questions on one paper share its difficulty and the student's day. A pooled gap can come from one bad paper, so a claim about a kind of question must hold paper by paper. | Design rule (cluster-robust reasoning) |
| **Equating through grade thresholds (uniform mark scale)** | Series differ in difficulty, and the board's grade lines measure exactly that. A raw mark is mapped to a uniform scale by straight lines between (0,0), E=40, D=50, C=60, B=70, A=80 and (max,100). It is then mapped back onto another series' lines. This is how the boards ran UMS. | Pearson, *UMS awarding for modular GCE* (straight lines between adjacent boundary points) |

## Every calculation, what was wrong, what changed

### Insights (`src/ui/data/insights.ts`, client)

| Module | Before | Problem | Now |
|---|---|---|---|
| Evidence | Marks available and lost from every eligible attempt | **Choice papers** ("answer any two"): an unchosen question counted as lost marks in every module | A paper whose questions add up to more than its printed `stated_maximum` is a choice paper. Its blank, zero-mark questions are left out of every count, and the cause card says how many. With no printed maximum, nothing is assumed. |
| Patterns | Same cause in at least 2 papers of a subject; the 4-paper floor counted all subjects together | Two Physics papers in a 4-paper library could be called a Physics pattern | The 4-paper floor applies **per subject**. |
| Trend sentence | Compared lost share between the first and last halves, with a ±5-point threshold, across all subjects | (1) 5 points is inside one paper's own noise (about 7%). (2) Under "All", early Economics and late Physics papers made a fake trend. | Each paper is centred on its own subject's average; subjects with one paper sit out. A direction is named only when the change exceeds 1.96 × SE **and** 5 points. Each side's variance is the larger of its observed spread and the SEM floor (`shareChange`). |
| Question size note | Pooled band share against the rest: at least 5 questions, at least 4 marks, a 10-point gap and 1.5× | One bad paper could create the note | The gap must also hold paper by paper: worse in at least 2 papers, and in more papers than it was better. |
| Command words | Losses only, using the model's tag | No denominator, so it could not say whether the student is weak at a word or just meets it often | The word is read **from the printed question** (a TS port of `private.printed_command_word`, kept in step by a shared fixture). Each row adds a **rate over every question that prints it**, full marks included, once 3 questions print it. It also gets a shrunk share and a question-level Wilson interval. "More than your usual share" appears only when the whole interval sits above the student's overall share. |
| Topics | Free-text concepts, folded only by case | "Newton's Laws" and "newtons law" were counted as different topics | Folds case, punctuation, "&", a leading article and plain plurals. It never merges different words. |
| Knock-on | Any loss with `depends_on_parts` | The explain stage also lists a **full-mark** previous part carried as safe context (`fullMarkPreviousContext`), so "one early slip" was claimed where there was no slip | Counted only when a depended-on part on the same paper itself lost marks. An earlier part that can't be found is not assumed to have lost any. |
| Pacing | End-of-paper blank run | Unchosen questions at the end of a choice paper looked like running out of time | Choice-paper blanks are removed first. |
| **New: where slips happen** | — | — | Procedural slips and misreads are placed by printed order into thirds of each paper (papers with at least 6 ordered questions). "Late" is named only when the last third's slip rate beats the first third's by a two-proportion z of at least 1.96, with at least 3 late slips across at least 2 papers. The suggested fix is "leave a few minutes to check the last questions". |
| Subjects, stages, causes, checklist, fading | Unchanged | — | — |

### Syllabus map (`syllabusMap.ts`)

- **Before:** the shade was `ceil(lost/available × 4)`, so one 2-mark question lost could take the darkest shade.
- **Now:** the shade is taken after shrinkage toward the subject's own lost share (`shadeFor`). A topic with nothing lost stays clean, and a well-evidenced topic keeps its own share.

### Question difficulty (`questionDifficulty.ts`)

- Topics group on the folded key but display the tag as written, never a folded form such as "vector".

### Database (`20261013200000_axo_270_analytics_accuracy.sql`, `20261013200100_axo_270_digest_trend.sql`)

| Function | Before | Problem | Now |
|---|---|---|---|
| `private.attempt_tags` → paper number | Catalogue identity only (`assessment_identity`) | The Cambridge catalogue is empty in production: one identity row, a CBSE one. So **no Cambridge paper had a paper number**, and component weights, the AO inference and the grade outlook had nothing to read. | It falls back to the reference printed on the paper and read at triage (`private.paper_printed_ref`, via `private.cambridge_ref`). That is the strict footer `9709/12/M/J/24`, or a high-confidence code, two-digit component, session and year. It is accepted only when the code is the paper's own syllabus. |
| `public.scorecard` | Command word = printed, else the model's tag; AO inferred from the same | The model tag exists only on lost parts, so the rates for model-tagged words were biased low | Rates use printed command words only. Model-only parts count as untagged. |
| `public.focus_areas.reason` (shown on Home) | "N marks recoverable across M papers" | Breaks the owner's copy rule (13 Oct): "N marks to win back" | "N marks to win back across M papers" |
| `public.grade_outlook` range | Per component: min to max of paper shares, with a fixed ±0.10 for a single paper. Then summed. | The range **widened** with more papers, and summing component extremes assumes they all go wrong together. Series difficulty was ignored. | Per component: mean share, with variance = max(sample variance, SEM²); predictive variance v(1 + 1/n). The total's 90% range is mid ± 1.645·√Σ(weighted max² · predictive variance). Each paper is first **equated** onto the target series and variant through verified component thresholds, where both ends exist. Output adds `interval` and `equated_papers`. The screen names neither as a number. |
| `private.build_parent_digest` trend | "Fewer/more" at a 10-point gap with at least 10 questions each side | 10 vs 10 questions with a 10-point gap is well inside chance (SE ≈ 0.21) | Needs the 10-point floor **and** a two-proportion test at 95%. |
| `lossByCause`, `needsCheck` (client reads) | A single read | Stops at the API row cap and under-counts a long history | Paged like the Insights reads. |
| `topic_readiness`, `next_best_action`, `due_queue`, `progress_summary`, streak | Reviewed | Rule-based ladders and schedules with stated thresholds; nothing statistical to correct | Unchanged |
| `student_analytics_readiness` | 4 papers overall | The "fewer than about four papers" rule is about the library | Unchanged; per-subject floors live in the modules that make subject claims. |

### Grade thresholds ingest (`scripts/exams/`)

- **Component thresholds are stored** (`public.grade_threshold_component`).
- **When a component counts as verified:** it must sit in a verified route of the same table. That means its A and E passed the weighted cross-check and its raw maximum matched the weighting file. Its five thresholds must also strictly descend and stay between 0 and the maximum. Drafts are never read.
- **Re-reads:** `known.mjs` no longer counts a table as known until its components are stored, so the daily run fills in the tables already loaded.
- **Coverage:** the weighting file covers the newest three series (Nov 2025, Mar 2026, Jun 2026), so equating works for papers from those series. Older series keep raw shares, and the outlook reports how many papers were equated.

## Verification

- `tests/ui/insights-accuracy.test.ts` covers:
  - the statistics;
  - the shared command-word fixture;
  - choice papers;
  - command-word rates;
  - slip position;
  - topic and part keys;
  - map shading.
- `tests/ui/insights-engine.test.ts` was updated for:
  - per-subject patterns;
  - the noise-aware, within-subject trend;
  - the paper-consistent size note;
  - the knock-on antecedent.
- `tests/db/insights-accuracy.test.mjs` covers:
  - the same fixture against SQL;
  - strict printed-reference parsing;
  - equating.
- `tests/db/practice-loop.test.mjs` covers:
  - printed-only scorecard rates;
  - the copy fix;
  - outlook interval and equating;
  - the paper number from a printed reference.
- `tests/db/parent-digest.test.mjs` covers the significant and not-significant digest trends.
- `scripts/exams/test_thresholds.py` covers component threshold verification.

## Not done, for the owner

1. **Cross-subject pattern signal.** `pattern_insight` has no writer anywhere, so `get_cross_subject_signal` never returns a row and the Pro teaser never shows.
   - **Proposed rule:** the same cause in at least 2 subjects, each with at least 4 papers and at least 2 papers showing it, and its exposure-adjusted rate above the student's base rate beyond chance.
   - **Why it needs a decision:** turning it on shows parents an upsell, so it is the owner's call. Recommendation: build it with that rule.
2. **Older series equating.** This needs the board's older weighting factors files, and the weighting page links only the current file. Until then, papers from before November 2025 are not equated.
3. **Catalogue identities.** The printed reference now fills the paper number. The `assessment_identity` catalogue for Cambridge is still empty, which also limits scheme retrieval. Out of scope here.
4. **Topic tags.** The free-text `concepts` remain model text. The verified syllabus tags (`region_topic`) are the better source, and the map already uses them. Retiring "Topics that keep coming up" in favour of the map is a product choice.
