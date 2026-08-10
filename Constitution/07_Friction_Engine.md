# AXON Production Constitution

# Chapter 7 --- Friction Engine

**Document ID:** AXON-FRI-001\
**Status:** Accepted\
**Version:** 1.0.0\
**Classification:** Core System Specification

------------------------------------------------------------------------

# 1. Purpose

The Friction Engine exists to systematically eliminate unnecessary
cognitive effort before, during, and after studying.

Its purpose is **not** to make studying easier. Its purpose is to make
**starting and continuing** meaningful study require fewer decisions.

------------------------------------------------------------------------

# 2. Scope

The Friction Engine governs:

-   Decision reduction
-   Automation policies
-   User prompts
-   Default behaviors
-   Workflow simplification
-   Context-aware orchestration

It does not determine academic priorities (Mission Engine) or learning
state (Academic Digital Twin).

------------------------------------------------------------------------

# 3. Definition

Constitutionally, **friction** is defined as any avoidable action,
decision, or interruption that does not directly contribute to learning.

Examples include:

-   Choosing what to study
-   Estimating study duration
-   Reordering tasks
-   Rebuilding a schedule after interruptions
-   Reopening frequently used tools

------------------------------------------------------------------------

# 4. Design Principles

## AXON-FRI-001 --- Eliminate Before Optimizing

The system MUST first determine whether a decision can be removed before
attempting to improve it.

Removing a decision is preferred over making the decision faster.

------------------------------------------------------------------------

## AXON-FRI-002 --- Intelligent Defaults

Every configurable feature MUST have a sensible default.

The average student SHOULD be able to use AXON effectively without
extensive configuration.

------------------------------------------------------------------------

## AXON-FRI-003 --- Progressive Disclosure

Advanced functionality SHALL remain available but MUST NOT dominate
primary workflows.

Complexity should appear only when needed.

------------------------------------------------------------------------

## AXON-FRI-004 --- Automation with Agency

Automation SHALL never permanently remove user control.

Whenever AXON acts automatically, users MUST be able to understand the
outcome and override future recommendations.

------------------------------------------------------------------------

# 5. Decision Hierarchy

Before requesting user input, the system SHALL evaluate:

1.  Can this be inferred from existing evidence?
2.  Can this be derived from the Academic Digital Twin?
3.  Can a safe default be applied?
4.  Is user confirmation required?
5.  Is explicit user choice unavoidable?

Only if the answer to the first four questions is "No" should the system
require manual input.

------------------------------------------------------------------------

# 6. Approved Automation

The Friction Engine MAY automatically:

-   Prepare today's mission
-   Sync planner with connected calendar
-   Reorder study sessions
-   Adjust estimated study duration
-   Resume unfinished work
-   Remember interface preferences

The engine MUST NOT silently perform destructive actions.

------------------------------------------------------------------------

# 7. User Interruptions

The engine SHALL minimize interruptions.

Notifications, prompts, and confirmations SHOULD appear only when they
materially improve outcomes.

Repeated confirmations for predictable behavior are discouraged.

------------------------------------------------------------------------

# 8. Failure Modes

The Friction Engine MUST gracefully handle:

-   Missing calendar data
-   Failed integrations
-   Incomplete planner information
-   Interrupted synchronization

Failures SHALL degrade functionality without preventing study.

------------------------------------------------------------------------

# 9. Success Definition

The Friction Engine succeeds when:

-   Students begin studying quickly.
-   Planning requires minimal manual effort.
-   Context switching decreases.
-   The interface feels prepared rather than demanding.

------------------------------------------------------------------------

# 10. Acceptance Criteria

This chapter is complete only if:

-   Friction is formally defined.
-   Decision hierarchy is established.
-   Automation boundaries are specified.
-   Student agency is preserved.
-   Failure handling supports graceful degradation.
-   The engine prioritizes removing unnecessary cognitive load.
