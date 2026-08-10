# AXON Production Constitution

# Chapter 5 --- Mission Engine

**Document ID:** AXON-MIS-001\
**Status:** Accepted\
**Version:** 1.0.0\
**Classification:** Core System Specification

------------------------------------------------------------------------

# 1. Purpose

The Mission Engine converts long-term academic objectives into one
immediately actionable daily mission.

The Mission Engine is the execution layer of AXON. Students do not
manage task lists; they complete missions generated from the Academic
Digital Twin.

------------------------------------------------------------------------

# 2. Scope

The Mission Engine governs:

-   Daily mission generation
-   Mission reprioritization
-   Mission completion
-   Mission recovery
-   Planner synchronization

It does not determine student knowledge (ADT responsibility) or
interface presentation (UI specifications).

------------------------------------------------------------------------

# 3. Mission Definition

A Mission is the smallest meaningful unit of guided study that advances
the student's long-term goals.

Every mission SHALL contain:

-   Primary objective
-   Estimated duration
-   Ordered activities
-   Success criteria
-   Reason for recommendation

There SHALL be exactly one Active Mission at any given time.

------------------------------------------------------------------------

# 4. Inputs

Mission generation MAY use only approved inputs:

-   Academic Digital Twin
-   Adaptive Planner
-   Upcoming examinations
-   Calendar availability
-   Assignment deadlines
-   Previous mission history
-   User preferences
-   Manual user overrides

No other input source is permitted without constitutional approval.

------------------------------------------------------------------------

# 5. Outputs

The Mission Engine SHALL produce:

-   Mission title
-   Estimated completion time
-   Ordered activity sequence
-   Expected learning outcome
-   Confidence impact estimate (when available)
-   Completion conditions

------------------------------------------------------------------------

# 6. Mission Lifecycle

Every mission follows this state machine:

Draft → Generated → Presented → Accepted → In Progress → Completed

Alternative terminal states:

-   Deferred
-   Replanned
-   Cancelled

Completed missions MUST remain immutable historical records.

------------------------------------------------------------------------

# 7. Trigger Events

Mission recalculation SHALL occur when:

-   a mission completes,
-   calendar availability changes,
-   an exam is added,
-   the planner changes,
-   significant ADT updates occur,
-   the student explicitly requests replanning.

------------------------------------------------------------------------

# 8. Prioritization Rules

When conflicts exist, priorities SHALL be resolved in the following
order:

1.  Imminent examinations
2.  Hard deadlines
3.  Critical knowledge gaps
4.  Previously interrupted work
5.  Long-term optimisation

Future chapters may refine these rules but SHALL preserve their ordering
unless constitutionally amended.

------------------------------------------------------------------------

# 9. Explainability

Every generated mission SHOULD answer:

-   Why this mission?
-   Why today?
-   Why this order?

The explanation SHOULD be concise and evidence-based.

------------------------------------------------------------------------

# 10. Failure Recovery

Missing a mission SHALL NOT be treated as failure.

Instead, the engine SHALL:

-   reassess available time,
-   preserve learning momentum,
-   redistribute workload,
-   generate a revised mission.

Punitive mechanics are prohibited.

------------------------------------------------------------------------

# 11. Invariants

The Mission Engine MUST ensure:

-   Exactly one Active Mission.
-   Every mission has measurable completion criteria.
-   Every mission originates from approved inputs.
-   Every mission is explainable.
-   Every mission contributes to long-term academic progress.

------------------------------------------------------------------------

# 12. Acceptance Criteria

This chapter is complete only if:

-   Mission lifecycle is defined.
-   Inputs and outputs are specified.
-   Replanning triggers are documented.
-   Failure recovery preserves momentum.
-   Explainability is required.
-   Mission generation remains dependent on the Academic Digital Twin.
