# AXON Engineering Specification

# Volume III — Screen Specification

## Home

Primary goal: orient the student and provide a clear next action.

## Library

Primary goal: browse and search processed papers.

Required:
- subject-aware labeling,
- searchable paper/question content,
- resilient loading/error/empty states,
- direct navigation into a paper and question.

## Scan

Primary goal: produce a trustworthy input for the pipeline.

Required:
- responsive camera startup,
- explicit capture quality,
- stable page tray/retake state,
- no duplicate submissions,
- clear processing state,
- accessible controls.

## Paper Review

Primary goal: let the student verify uncertain extraction before it becomes
trusted history.

## Paper Overview

Primary goal: summarize one processed paper and provide question navigation.

## Question Detail

Primary goal: show the question evidence, awarded/available marks, explanation,
and any grounding/withheld state.

## Insights

Primary goal: aggregate trusted history without presenting uncertain data as
fact.

## Settings

Primary goal: profile/account controls, privacy/analytics choices, appearance,
and billing.

## Global requirements

- Route changes preserve accessibility focus without visible non-interactive
  focus artifacts.
- Loading uses app-shaped skeletons rather than blank screens.
- Transitions should be short and responsive, with reduced-motion support.
- Student/private information must never appear in public metadata or analytics.
