# Exam dates and grade thresholds that load themselves

Date: 13 Oct 2026. Owner request (in chat): "build a system for fetching the latest exam dates
and GTs automatically so that it does not need to be done manually every time", and "load and
verify the GTs". Follows AXO-207 (exam dates) and AXO-262 (grade outlook).

This file is a record and a runbook. It says what runs, what it checks, and what to do when a
check fails.

## What runs, and when

`.github/workflows/exam-ingest.yml` runs every day at 03:41 UTC. It also runs after each
migration run on `main`, on pushes that touch its inputs, and on demand from the Actions tab.
It uses the `production` environment's `SUPABASE_DB_URL`, the same secret as `migrate.yml`.

1. **Timetables** (`scripts/exams/ingest.py --discover`)
   - Reads the board's exam timetables page
     (cambridgeinternational.org → Exams officers' guide → Timetabling exams → Exam timetables)
     and every zone timetable linked there, plus the entries in `curriculum/exams/sources.json`.
   - For a given series, zone and variant, the page's file wins over the manifest's.
   - Every file must pass the existing two-view cross-check: the weekly view and the A-Z view of
     the same PDF must agree on every component and date. That check has run on every load since
     AXO-207.
   - A file that fails is skipped with a warning, and its earlier dates stay in the database.
   - `exam_timetable.source_url` and `source_sha256` record exactly which file was loaded.
   - Run by hand without `--discover`, the script keeps its old behaviour: any SHA-256 that differs
     from the manifest stops the run.
2. **Grade thresholds** (`scripts/exams/thresholds_ingest.py`)
   - Reads the board's AS & A Level grade threshold page, then the three newest series pages
     linked from it, and collects every threshold table PDF on them. Syllabus code and series come
     from the file name.
   - Downloads the board's *syllabus component weighting factors* file, linked from
     cambridgeinternational.org/weighting. That file gives every component's raw maximum,
     weighted maximum and weighting factor for the series it covers.
   - Skips tables that are already fully verified (`scripts/exams/known.mjs`). Drafts are retried
     every day, because a newer weighting file may let them verify.
   - Reads each table and checks every route (`scripts/exams/cambridge_thresholds.py`). Writes one
     `grade_threshold_set` row per route, with its grades. Each table replaces that syllabus and
     series in a single transaction.

## How a route is verified (no person in the loop; owner decision 13 Oct 2026)

A route is `verified` (`verified_by = 'auto:cambridge-thresholds-v1'`) only when every check
below is true. Each check's result is stored in `grade_threshold_set.checks`.

| Check | What must hold |
|---|---|
| `title` | The table's own heading names the syllabus code and the series. |
| `factor` | Each factor is weighted maximum ÷ raw maximum, and agrees with the printed (rounded) factor to the places shown, e.g. 1.66667 for 5/3. |
| `components` | Every component of the route has thresholds in the table and a factor in the weighting file, with the same raw maximum in both. |
| `max` | The route's maximum weighted mark equals the sum of factor × raw maximum, exactly. |
| `a_e` | Syllabus A and E equal the weighted sums of the component A and E thresholds, to within half a mark (the board's rounding). |
| `order` | The grades strictly descend. |
| `grade_count` | Six grades (A* to E) for A Level, five (a to e) for AS. |

Two of the board's own documents have to agree for a route to pass. A misread number or a wrong
factor fails `a_e` or `max` (`scripts/exams/test_thresholds.py` proves both).

- B, C and D are **not** checked. The board sets them by judgement; they are not interpolated.
  An interpolation check was tried and rejected for this reason.
- Staged routes carry forward earlier results (components 7x to 9x), which have no thresholds in
  the table. They can't be checked, so they stay `draft`. The outlook never reads them.

## How the outlook uses them

`public.grade_outlook` (migration `20261013110000_axo_244_threshold_routes_and_outlook.sql`):

1. **Which levels and routes:** only verified routes for the student's level (A Level linear or
   AS). Staged routes are never read.
2. **Which series:** the most recent series in the same month as the student's own exam series;
   otherwise the most recent series.
3. **Which route:** the student's chosen papers when they set them. Otherwise, the most complete
   route their identified papers cover.
4. **Variants:** the board publishes several variants of one route (11, 31, 41, 51 / 12, 32, 42,
   52 / …) with different thresholds, and the student's papers don't record the variant. So
   every variant is read and the range is widened across them:
   - low grade: the worst any variant gives the low total;
   - high grade: the best any variant gives the high total;
   - middle grade: the more cautious of the variants.
   The previous version picked one variant with `limit 1`, which was arbitrary. Insights now says
   "N variants, widest range".

## First load (13 Oct 2026)

Run locally against the live site before merge, limited to the ten syllabus codes production
students take:

- **Thresholds:** for 9093, 9231, 9609, 9618, 9699, 9701, 9702, 9708, 9709 and 9990 (June 2026),
  124 linear and AS routes verified and 155 staged routes kept as drafts. No failures.
- **Weighting file:** covers November 2025, March 2026 and June 2026.
- **Timetables:** discovery found 14 zone timetables on the board's page. Together with the
  manifest that made 15 to load: June 2026 and November 2026 for zones 1 to 6 plus 3 UK, and
  March 2027 zone 4. All 15 passed the cross-check.

The production load is done by the workflow after merge; its run ids are recorded on AXO-262.

## When something fails

| Signal | Meaning | Action |
|---|---|---|
| Warning: "skipped, earlier dates stay" | A timetable's two views disagree, or it couldn't be read. | Open the PDF. If the board's own document is inconsistent, wait for its correction; nothing wrong loads in the meantime. |
| `no zone timetables found` / `no series pages found` | The board changed its page layout. | Update the pattern in `cambridge_thresholds.py`. The job fails loudly rather than loading nothing quietly. |
| Routes stuck in draft (`select option_code, checks from grade_threshold_set where status = 'draft' and assessment <> 'staged'`) | Usually a series the weighting file doesn't cover yet. | They verify by themselves once the board publishes the new weighting file. |
| Warning: "the table says … the file name …; not loaded" | The board's file name and its contents disagree (seen 13 Oct: Sociology 9699, file `march-2025`, contents March 2026). | Nothing loads for that file, so no other series is overwritten. It loads once the board fixes the name, or once the series page links a correct copy. |

## Not covered

- IGCSE and O Level threshold pages. No production student takes them today. To add them, put
  the page in `QUALIFICATION_PAGES` and check their table layout first.
- CBSE and IB dates. They are unchanged from `sources.json`: IB is held for the owner's licence
  decision (AXO-200), and CBSE's 2027 date sheet isn't published yet.
