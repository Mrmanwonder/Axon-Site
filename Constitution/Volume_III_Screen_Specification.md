# AXON Engineering Specification

# Volume III --- Screen Specification

**Document ID:** AES-VOL-III **Version:** 1.0.0 **Status:** Draft for
Implementation **Depends On:** Constitution Chapters 0--9, Volume I,
Volume II

------------------------------------------------------------------------

# Purpose

This volume defines every screen in AXON as a deterministic engineering
specification.

A screen is responsible for orchestrating components, presenting data,
and coordinating user workflows. Business logic remains owned by the
platform engines and backend services.

------------------------------------------------------------------------

# Objectives

-   Standardize every screen implementation.
-   Eliminate ambiguity in layout and navigation.
-   Define ownership boundaries.
-   Specify loading, error, offline, and accessibility behavior.
-   Provide a blueprint suitable for implementation by engineering teams
    or AI coding agents.

------------------------------------------------------------------------

# Canonical Screen Template

Every screen specification SHALL include:

1.  Purpose
2.  Primary User Goal
3.  Entry Conditions
4.  Exit Conditions
5.  Layout Hierarchy
6.  Component Tree
7.  Navigation Rules
8.  Data Sources
9.  API Dependencies
10. State Management
11. Loading States
12. Empty States
13. Error States
14. Offline Behaviour
15. Keyboard Navigation
16. Touch Behaviour
17. Motion & Transitions
18. Accessibility
19. Analytics Events
20. Performance Budget
21. Acceptance Tests

------------------------------------------------------------------------

# Screen Inventory

## Authentication

-   Welcome
-   Sign In
-   Sign Up
-   Account Recovery

## Onboarding

-   Introduction
-   Academic Profile
-   Goals
-   Calendar Connection
-   Integrations
-   Initial Mission

## Core Experience

-   Dashboard
-   Today's Mission
-   Focus Session
-   Session Review
-   Planner
-   Analytics
-   Mentor
-   Resources
-   Search
-   Notifications
-   Settings

## Supporting Screens

-   Profile
-   Integrations
-   Privacy
-   Subscription
-   About
-   Help

------------------------------------------------------------------------

# Screen Ownership

Dashboard - Owner: Mission Engine - Primary Goal: Orient the student.

Focus - Owner: Mission Engine - Primary Goal: Execute meaningful study.

Review - Owner: Academic Digital Twin - Primary Goal: Capture learning
outcomes.

Planner - Owner: Mission Engine - Primary Goal: Organize future work.

Analytics - Owner: Academic Digital Twin - Primary Goal: Explain
progress.

Mentor - Owner: Academic Digital Twin - Primary Goal: Provide contextual
guidance.

Resources - Owner: Content Services - Primary Goal: Access learning
material.

Settings - Owner: Platform Services - Primary Goal: Configure the
operating system.

------------------------------------------------------------------------

# Cross-Screen Rules

-   Navigation MUST preserve context where possible.
-   Every screen MUST expose exactly one dominant action.
-   Screens SHALL compose reusable components from Volume II.
-   Screens SHALL reference design tokens from Volume I.
-   Screens MUST NOT implement business logic locally.
-   Deep linking MUST restore the appropriate application state.

------------------------------------------------------------------------

# Deliverables

Each screen listed in this volume SHALL eventually receive its own
standalone specification document containing detailed layouts,
interaction flows, component mappings, API contracts, performance
budgets, accessibility requirements, and acceptance tests.

------------------------------------------------------------------------

# Acceptance Criteria

This volume is complete only when every user-facing screen has an
independent engineering specification conforming to the canonical screen
template.
