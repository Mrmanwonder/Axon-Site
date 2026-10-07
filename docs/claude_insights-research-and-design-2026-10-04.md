# Insights: research and design (2026-10-04)

Dated record. Evidence, not instructions; `Axon.md` outranks it.

## What was wrong

- Insights rendered one live module (marks lost by cause) and five "not ready yet" cards.
- The explain stage had been writing command words, per-mark loss breakdowns, topic tags and part dependencies for weeks. None of it was exposed through the analytics views, so the modules that needed it had nothing to read.
- Filters changed only the trend. The cause breakdown could not be filtered, so any filter turned it off.
- Home had no insight at all, because "no table holds a generated insight".
- While the library was still loading, Insights said "0 of 4 papers".

## What students need, and where it comes from

| Finding | Source | What Axon does with it |
|---|---|---|
| "Where to next" feedback drives improvement more than any other kind; praise slightly hurts | Hattie and Timperley's feedback model; Brooks et al. 2021 (Frontiers in Education) | Lead with **Before your next paper**: the student's own fixes for mistakes that repeat. No praise copy anywhere. |
| Sorting your own errors by type after an exam (exam wrappers) raises course grades a little but measurably, more so over several courses | Soicher and Gurung; NSTA JCST 2020 (1,100+ students, 5 STEM courses) | Cause breakdown split into **knowledge / exam technique / finishing**, with each cause defined. |
| Cambridge examiners repeat the same reasons for lost marks: ignoring the command word, too few points for the marks, no formula or working, units and significant figures, answering a different question | Cambridge International, *Improving candidate performance through the use of mark schemes and principal examiners' reports* | **Command words** and **question size** modules. Fix text comes from the explain stage, which already requires an action the student can do in the exam. |
| Method marks and follow-through mean one early slip need not cost every later mark, but often does when working is hidden | Cambridge mark-scheme conventions (M/A/B, follow-through) | **Built on an earlier part**: marks lost on parts that used an earlier answer. No scheme text is stored or shown. |
| Careless errors are common (about 20% of errors) and more common in engaged, successful students | Clements; San Pedro, Baker et al. (UPenn) | Slips are kept separate from concept gaps and named neutrally. A strong student's slips are treated as a technique to fix, not a knowledge gap. |
| Running out of time shows as a run of blank questions at the end of a paper; Cambridge Assessment measures exactly that run | Cambridge Assessment, *Research Matters* 37, speededness in GCSEs | **End of the paper**: the longest run of blank, zero-mark questions at the end of each paper, in printed order. A blank in the middle is not counted. |
| Practice testing and spaced practice are the two highest-value study techniques; rereading and highlighting are low value | Dunlosky et al. 2013 | No study-plan module (Axon.md forbids a planner). Fix lines are things to do in the next paper, which is retrieval practice under exam conditions. |
| Comparing students with peers, especially with top performers, mostly produces anxiety rather than effort | Learning-analytics dashboard studies (JLA; Anglia Ruskin 2019) | No peer comparison, ranking or prediction. The trend compares the student only with their own earlier papers. |

## Rules the engine enforces (`src/ui/data/insights.ts`)

1. Inputs come only from `attempt_analytics` and `mark_loss_analytics` (hard rule 3).
2. Nothing is called a pattern under 4 papers. A repeating mistake must cost marks in 2 or more papers **of the same subject**. Patterns are never merged across subjects; cross-subject detection stays the Pro feature on `pattern_insight`.
3. A per-mark breakdown is used only when it adds up to exactly the marks the teacher took off. Otherwise the whole loss stays on the primary cause. The teacher's number wins.
4. A trend uses only complete totals and needs 6 papers before it names a direction, and a 5-point change in share before it says better or worse.
5. A question-size band needs 3 questions to be shown, and a note about it needs 5 questions, 4 marks lost and a 10-point gap against the rest.
6. Topics and command words count losses only, never a success rate, and say how many explained questions carry the tag.
7. Every claim shows its sample size and opens the questions it rests on.
8. "Fading" (seen in 2+ earlier papers, none of the last 3) is stated as the student's own record. It is not praise and not a prediction.
9. No percentages are printed. Shares are drawn as bars.

## Not built, and why

- **Syllabus topic heatmap**: needs official syllabus topic trees and tags on every question. Started as its own piece of work (`20261004100000_syllabus_topics_and_mastery.sql`, not applied yet).
- **Effort-ranked quick wins**: still no defensible measure of how much effort a fix takes.
