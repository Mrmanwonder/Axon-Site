# AXON Production Constitution

# Chapter 8 --- Information Architecture

**Document ID:** AXON-IA-001\
**Status:** Accepted\
**Version:** 1.0.0\
**Classification:** Immutable Architecture

------------------------------------------------------------------------

# 1. Purpose

This chapter defines the canonical structure of the AXON Study Operating
System.

Information Architecture (IA) defines where information belongs, how
users navigate between spaces, and which system owns each
responsibility.

No screen, workflow, or feature may violate this architecture without a
constitutional amendment.

------------------------------------------------------------------------

# 2. Architectural Principle

AXON is organized around **workflows**, not tools.

Students should never think:

> "Which feature should I open?"

They should think:

> "What am I trying to accomplish?"

Navigation must therefore mirror the student's academic journey.

------------------------------------------------------------------------

# 3. Canonical User Journey

Every authenticated session follows this high-level flow:

1.  Dashboard
2.  Today's Mission
3.  Focus Session
4.  Session Review
5.  Planner (if required)
6.  Exit

Supporting modules remain accessible but are never the primary flow.

------------------------------------------------------------------------

# 4. Primary Workspaces

The operating system consists of the following first-class workspaces.

## Dashboard

Purpose: Orient the student.

Primary Question: "What should I do today?"

Owner: Mission Engine

------------------------------------------------------------------------

## Focus

Purpose: Execute work.

Primary Question: "What am I doing right now?"

Owner: Mission Engine

------------------------------------------------------------------------

## Review

Purpose: Reflect and update learning state.

Primary Question: "What changed?"

Owner: Academic Digital Twin

------------------------------------------------------------------------

## Planner

Purpose: Manage future workload.

Primary Question: "How should future study be organized?"

Owner: Mission Engine

------------------------------------------------------------------------

## Analytics

Purpose: Explain progress.

Primary Question: "Why am I improving?"

Owner: Academic Digital Twin

------------------------------------------------------------------------

## Mentor

Purpose: Provide explainable guidance.

Primary Question: "What should I understand?"

Owner: Academic Digital Twin

------------------------------------------------------------------------

## Resources

Purpose: Access notes, past papers, documents, and learning material.

Primary Question: "What do I need?"

Owner: Content Services

------------------------------------------------------------------------

## Settings

Purpose: Configure preferences, integrations, privacy, and account.

Primary Question: "How should AXON work for me?"

Owner: Platform Services

------------------------------------------------------------------------

# 5. Navigation Rules

AXON-IA-001

Every workspace MUST have exactly one primary objective.

AXON-IA-002

Users MUST always know where they are.

AXON-IA-003

Navigation MUST preserve context whenever possible.

AXON-IA-004

The primary study workflow MUST never require opening more than one
workspace simultaneously.

------------------------------------------------------------------------

# 6. Ownership Boundaries

Each workspace owns its own responsibility.

Example:

Planner owns scheduling.

Analytics owns explanation.

Focus owns execution.

No workspace may duplicate another workspace's primary responsibility.

------------------------------------------------------------------------

# 7. Cross-Workspace Communication

Information SHALL flow through system engines rather than direct feature
coupling.

Example:

Focus Session → Academic Digital Twin → Mission Engine → Planner

NOT

Focus Session → Planner directly

This preserves architectural consistency.

------------------------------------------------------------------------

# 8. Acceptance Criteria

This chapter is complete only if:

-   Every workspace has a unique purpose.
-   Navigation reflects student workflows.
-   Ownership boundaries are defined.
-   Cross-workspace communication follows system engines.
-   Feature duplication is prohibited.
