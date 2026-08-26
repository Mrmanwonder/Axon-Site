# The golden set goes here

One `.json` label file per paper. Format, consent rules, and the five
required bad cases are all specified in `harness/README.md` — read that
before adding anything here, not this file.

This directory is empty on purpose. `harness/run.mjs` already refuses to
report a score against an empty set (`node harness/run.mjs …` with no
`--goldenset` flag exits with "The golden set is empty. Label some papers
into harness/goldenset/ first" rather than printing a hollow 100%) — that is
the correct behaviour, not a bug to route around by pointing the harness at
`harness/example/` instead. `harness/example/` is a synthetic fixture kept
outside this directory specifically so it can never be mistaken for a
measurement.

Once label files start landing here, run:

```bash
node harness/validate-goldenset.mjs
```

before running the harness against them. It checks each file against the
schema `harness/README.md` documents and reports coverage against the
twenty-paper, four-subject, five-bad-case minimum `harness/README.md` and
`SCANNING_SYSTEM.md` §18 both specify — so a labelling gap shows up before a
gate failure does, not after.

Remember: label files carry no images and no personal data, which is what
makes them safe to commit here. The pages they refer to are not, and do not
belong in this repository — see `harness/README.md`'s "Consent and handling"
section.
