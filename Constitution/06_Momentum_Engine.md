# AXON Production Constitution

# Chapter 6 --- Momentum Engine

**Document ID:** AXON-MOM-001\
**Status:** Accepted\
**Version:** 1.0.0\
**Classification:** Core System Specification

------------------------------------------------------------------------

# 1. Purpose

The Momentum Engine preserves continuity in a student's academic
journey.

Its objective is not to maximize activity or maintain streaks. Its
objective is to ensure that interruptions do not become abandonment.

The Momentum Engine continuously adapts workload so that progress
remains sustainable.

------------------------------------------------------------------------

# 2. Scope

The Momentum Engine governs:

-   Session continuity
-   Recovery after interruptions
-   Workload redistribution
-   Daily pacing
-   Study consistency

It does not determine knowledge state (Academic Digital Twin) or mission
generation (Mission Engine).

------------------------------------------------------------------------

# 3. Design Philosophy

Momentum is defined as the student's ability to resume productive
learning with minimal psychological resistance.

The engine SHALL optimize for consistency rather than intensity.

------------------------------------------------------------------------

# 4. Inputs

Approved inputs:

-   Academic Digital Twin
-   Mission Engine
-   Planner state
-   Calendar availability
-   Session history
-   Exam schedule
-   User-initiated pauses

------------------------------------------------------------------------

# 5. Outputs

The engine may produce:

-   Reduced workload
-   Redistributed tasks
-   Recovery mission recommendations
-   Revised study cadence
-   Encouragement messaging
-   Planner updates

------------------------------------------------------------------------

# 6. Invariants

## AXON-MOM-001

A missed study session MUST NOT invalidate previous progress.

## AXON-MOM-002

Recovery MUST prioritize continuation over restarting.

## AXON-MOM-003

Temporary disruption MUST NOT permanently increase cognitive load.

## AXON-MOM-004

Recommendations MUST preserve student agency.

------------------------------------------------------------------------

# 7. Trigger Events

The engine SHALL evaluate momentum when:

-   a mission is completed,
-   a mission is abandoned,
-   a focus session ends,
-   calendar availability changes,
-   exams are added or modified,
-   prolonged inactivity is detected.

------------------------------------------------------------------------

# 8. Recovery Strategy

When disruption occurs, the preferred sequence SHALL be:

1.  Measure remaining available time.
2.  Estimate unfinished workload.
3.  Preserve high-priority learning.
4.  Redistribute lower-priority work.
5.  Generate a revised mission.
6.  Synchronize planner and calendar.

Restarting an entire plan SHOULD be avoided unless explicitly requested.

------------------------------------------------------------------------

# 9. Anti-Patterns

The Momentum Engine MUST NOT:

-   punish missed sessions,
-   reset streaks as a motivational tactic,
-   display guilt-inducing messaging,
-   increase workload solely to compensate for missed work,
-   require manual replanning after every interruption.

------------------------------------------------------------------------

# 10. Relationship with Other Engines

Academic Digital Twin: Provides evidence regarding behaviour and
learning state.

Mission Engine: Executes revised daily objectives.

Friction Engine: Removes unnecessary decisions during recovery.

The Momentum Engine coordinates with these systems but does not replace
them.

------------------------------------------------------------------------

# 11. Success Metrics

A successful Momentum Engine:

-   minimizes abandoned study plans,
-   reduces recovery time after interruptions,
-   maintains sustainable study consistency,
-   keeps daily missions achievable.

These are implementation goals rather than user-facing metrics.

------------------------------------------------------------------------

# 12. Acceptance Criteria

This chapter is complete only if:

-   Momentum is formally defined.
-   Recovery process is documented.
-   Punitive mechanics are prohibited.
-   Inputs and outputs are specified.
-   Interaction with other engines is defined.
-   Continuity is prioritized over perfection.
