# The accuracy harness

v1 is not done when scanning works. It is done when scanning is measured.

This is the thing that decides whether the pipeline is good enough to put in
front of a student, and it is deliberately boring: plain JSON, no dependencies,
one command. A harness nobody can run because its lockfile rotted is a harness
that stops being run, and this one has to survive a year of constant pipeline
changes.

```bash
node --test harness/metrics.test.mjs                       # the metrics themselves
node harness/run.mjs harness/runs/EXAMPLE-run.json --goldenset example
node harness/run.mjs harness/runs/2026-08-20.json --baseline harness/runs/2026-08-13.json
```

## The golden set comes first

Twenty labelled papers **before** pipeline work, not after. Every decision made
without them is made blind, and the tuning that follows will be tuning toward
whatever the last paper someone happened to look at needed.

Twenty real marked papers, minimum, spanning classes 9–12 and at least four
subjects — and deliberately including the bad cases:

- a paper marked in green pen, or pencil
- a page damaged by glare
- a diagram-heavy biology answer
- a long answer running three pages
- a paper where the teacher's own arithmetic does not add up

A golden set of clean papers measures nothing worth knowing. The clean ones are
the papers the pipeline was already going to get right.

Every paper is hand-labelled once: question boundaries, per-question marks
awarded and available, and the position and class of every teacher mark.

### Consent and handling

These are children's exam papers with a name, a roll number and a school on the
front. Label them under the same rules as production — collected with the same
consent, held in the same place, deleted on the same schedule. A test corpus is
not an exemption from anything in §17, and "it's only for the harness" is how a
folder of scanned children's papers ends up on somebody's laptop.

The label files themselves carry no images and no personal data — only
coordinates, marks, and a transcription of the answer — so they are the part
that is safe to keep in the repository. The pages they refer to are not.

### Label format

One file per paper in `harness/goldenset/`. `harness/example/` holds a synthetic
one so the shape is unambiguous; it lives outside the golden set on purpose,
because a set with an invented paper in it measures nothing.

```jsonc
{
  "paper": {
    "id": "…",                  // must match paper.id in the database
    "board": "CBSE", "class_level": 11, "subject": "Physics",
    "type": "unit_test",        // decides Tier 1 against Tier 2
    "pages": 2,
    "reported_total": 12,       // as the teacher wrote it
    "stated_maximum": 20,
    "notes": "green pen; glare on page 4"   // shown per paper in the report
  },
  "questions": [
    {
      "label": "Q1",
      "spans": [{ "page": 1, "box": { "x": 120, "y": 300, "w": 2700, "h": 620 } }],
      "region_type": "prose",   // prose | math | diagram | table | mcq | mixed
      "marks_awarded": 4,
      "marks_available": 5,
      "answer_text": "…",       // omit for a diagram; see below
      "teacher_marks": [
        { "page": 1, "box": { … }, "mark_class": "marginal_number", "value": 4 },
        { "page": 1, "box": { … }, "mark_class": "circle" }
      ]
    }
  ]
}
```

Boxes are in the pixel coordinates of the **conditioned** page — the one the
pipeline stores, after deskew and resolution normalisation — not of the original
photograph. Label against what the pipeline sees.

A question that runs across pages gets several spans. That is normal, not an
edge case, and a label that flattens it to one box will score a correct
extraction as a miss.

## Predictions

`harness/export.mjs` pulls a real run out of the database into the format
`run.mjs` scores. It uses a guardian's own token rather than the service key: the
golden set is scanned under a test account like any other student's papers, so
RLS is exactly the right amount of access.

```bash
MASTERY_SUPABASE_URL=https://<project>.supabase.co \
MASTERY_ANON_KEY=<publishable key> \
MASTERY_ACCESS_TOKEN=<signed-in guardian JWT> \
node harness/export.mjs <run-id> … > harness/runs/2026-08-20.json
```

## The metrics, in priority order

The order is not cosmetic. **Mark attribution is the north-star metric and
everything else is diagnostic.** A pipeline that transcribes beautifully and
binds a mark to the wrong question is worse than one that transcribes badly and
binds correctly: the first produces confident analytics about somebody else's
answer, and the second produces an explanation with a typo in it.

1. **Mark attribution accuracy** — the share of questions with the correct
   awarded mark bound to the correct question. A question the pipeline never
   found counts against it; scoring only what was found would reward giving up.
2. **Reconciliation rate** — the share of papers whose arithmetic closes
   unaided. The best single proxy for end-to-end health, and the only one here
   measurable in production without labels, which is what makes it the
   production monitor rather than just a harness number.
3. **Question segmentation F1** — with over- and under-segmentation reported
   separately. They have different causes and different fixes: a split usually
   means a rule line read as a boundary, a merge means a question number was
   missed. A single F1 hides which is happening.
4. **Answer text WER** — matters least. Explanations tolerate an imperfect
   transcription far better than analytics tolerate a misattributed mark, and a
   report that treats them as equals will get the pipeline optimised for the
   wrong thing. A region labelled `diagram` is excluded: the pipeline is
   supposed to decline to transcribe those, and scoring the refusal as an error
   would punish it for following its own rule.
5. **Correction rate in review** — from production, per field type. The best
   ongoing signal of where the pipeline is actually weak, as opposed to where it
   was weak on twenty papers from one city, which is the ceiling on everything
   above.

## The gates

| Gate | Threshold | What it holds back |
| --- | --- | --- |
| Mark attribution | ≥ 98% on the golden set | Insights shipping against real data |
| Reconciliation | ≥ 90% unaided | The review step ever becoming skippable |

Below 98%, per-question errors compound across papers and the trend lines become
confidently misleading — which is worse than an empty state, because an empty
state is honest. `run.mjs` exits non-zero when either gate fails.

The reconciliation gate is not about whether review is pleasant. Review is
mandatory in v1 regardless, and `commit_extraction_run()` enforces that in SQL.
The gate is about when it would be defensible to stop.

## Running it on every change

Every pipeline change: new prompt, new model, new threshold, new stage. Pass
`--baseline` with the previous run and the report shows the movement, which is
the only number that answers "did that help".

`ExtractionRun.pipeline_version` is what makes the comparison possible, which is
why it is not optional. A run with no version is a run nobody can compare against
anything, and this system will be changed constantly for its first year.
