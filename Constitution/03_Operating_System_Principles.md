# AXON Production Constitution

# Chapter 3 --- Operating System Principles

**Document ID:** AXON-OSP-001\
**Status:** Accepted\
**Version:** 1.0.0\
**Classification:** Immutable Foundation

------------------------------------------------------------------------

# 1. Purpose

This chapter defines the operating principles that distinguish AXON from
conventional study applications.

The Vision defines **why** AXON exists.

The Product Philosophy defines **how** AXON should behave.

This chapter defines **how the product is structured**.

Every screen, workflow, AI recommendation, integration, and engineering
decision SHALL conform to these principles.

------------------------------------------------------------------------

# 2. Definition

For the purposes of this Constitution, a **Study Operating System** is
software that coordinates, prioritizes, and orchestrates the student's
entire learning workflow instead of providing disconnected utilities.

Planning, execution, review, analytics, and adaptation are treated as
one continuous system.

------------------------------------------------------------------------

# 3. System Model

AXON consists of four continuously interacting engines.

1.  Academic Digital Twin
2.  Mission Engine
3.  Momentum Engine
4.  Friction Engine

These are architectural concepts rather than user-facing modules.

No engine may operate in isolation.

------------------------------------------------------------------------

# 4. Operating Principles

## AXON-OSP-001 --- Orchestration over Aggregation

AXON MUST orchestrate study.

It MUST NOT merely aggregate independent tools.

Requirements:

-   Planning SHALL influence missions.
-   Missions SHALL influence focus sessions.
-   Focus sessions SHALL influence analytics.
-   Analytics SHALL update the Academic Digital Twin.
-   The updated Digital Twin SHALL influence future planning.

No feature may exist without participating in this feedback loop.

------------------------------------------------------------------------

## AXON-OSP-002 --- One Primary Objective

Every screen MUST communicate one dominant objective.

Requirements:

-   Every page SHALL define exactly one Primary Action.
-   Secondary actions SHALL remain visually subordinate.
-   If multiple actions compete for attention, the design SHALL be
    revised.

Examples:

Dashboard → Begin Today's Mission

Focus Mode → Complete Current Work

Review → Understand Progress

Planner → Prepare Future Work

------------------------------------------------------------------------

## AXON-OSP-003 --- Continuous Adaptation

The product MUST adapt continuously.

Adaptation SHOULD occur after:

-   study sessions,
-   assessments,
-   planner changes,
-   calendar changes,
-   new deadlines,
-   completed missions.

Adaptation SHALL occur without requiring manual reconfiguration.

------------------------------------------------------------------------

## AXON-OSP-004 --- Explainable Intelligence

Whenever AXON changes a recommendation, it SHOULD provide a concise
explanation.

Examples:

-   "Today's workload was reduced because your available time
    decreased."

-   "Mechanics was prioritised because recent assessments indicate lower
    confidence."

The system MUST avoid unexplained behavioural changes.

------------------------------------------------------------------------

## AXON-OSP-005 --- Real-World Awareness

Planning SHALL consider context beyond academic content.

Approved contextual sources include:

-   Connected calendars
-   Exam schedules
-   Planner state
-   Mission completion history
-   Academic Digital Twin

Additional contextual sources require constitutional approval.

------------------------------------------------------------------------

## AXON-OSP-006 --- Momentum Preservation

When disruption occurs, AXON SHALL preserve momentum rather than restart
planning.

Examples:

-   Missed sessions
-   Unexpected calendar events
-   Partial completion
-   Schedule compression

The preferred response is intelligent replanning instead of failure
notifications.

------------------------------------------------------------------------

## AXON-OSP-007 --- Minimal Decision Surface

The number of decisions required before beginning meaningful work SHALL
be minimized.

The product SHOULD progressively hide complexity while remaining
transparent.

------------------------------------------------------------------------

# 5. System Flow

Every study cycle SHALL follow this sequence:

Prepare

↓

Generate Mission

↓

Focus

↓

Review

↓

Update Academic Digital Twin

↓

Adapt Future Plan

This loop forms the core operating cycle of AXON.

------------------------------------------------------------------------

# 6. Architectural Consequences

The Operating System Principles require:

-   Adaptive Planner
-   Mission Engine
-   Focus Mode
-   Session Review
-   Academic Digital Twin
-   Explainable AI
-   Persistent state between sessions

Future features MUST integrate with this lifecycle.

------------------------------------------------------------------------

# 7. Acceptance Criteria

This chapter is complete only if:

-   AXON is defined as an orchestrating system.
-   Every operating principle is normative.
-   Feedback loops are established.
-   Continuous adaptation is required.
-   Future features can be validated against these principles.
