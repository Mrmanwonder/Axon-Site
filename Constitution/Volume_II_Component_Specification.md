# AXON Engineering Specification

# Volume II --- Component Specification

**Document ID:** AES-VOL-II\
**Version:** 1.0.0\
**Status:** Draft for Implementation\
**Depends On:** Constitution Chapters 0--9, Volume I

------------------------------------------------------------------------

# Purpose

This volume defines every reusable UI component within AXON. It is the
canonical implementation reference for designers, frontend engineers,
and AI coding agents.

Components are the smallest independently testable UI building blocks.
Screens MUST compose components rather than redefining their behavior.

------------------------------------------------------------------------

# Objectives

-   Create a reusable component library.
-   Eliminate duplicated UI logic.
-   Standardize interaction patterns.
-   Guarantee accessibility and consistency.

------------------------------------------------------------------------

# Component Taxonomy

## Foundation

-   Button
-   Icon
-   Typography
-   Divider
-   Avatar
-   Badge
-   Chip
-   Tooltip

## Form Controls

-   Text Input
-   Search Field
-   Text Area
-   Select
-   Combobox
-   Checkbox
-   Radio
-   Toggle
-   Slider
-   Date Picker

## Navigation

-   Sidebar
-   Top Bar
-   Breadcrumb
-   Tabs
-   Navigation Rail
-   Command Palette

## Data Display

-   Card
-   Table
-   Timeline
-   Chart
-   Progress Ring
-   Metric Tile
-   Calendar Grid

## Study Components

-   Mission Card
-   Focus Timer
-   Session Tracker
-   Knowledge Indicator
-   Revision Queue
-   Planner Block
-   Resource Card
-   Mentor Chat Panel

## Feedback

-   Toast
-   Dialog
-   Modal
-   Banner
-   Skeleton Loader
-   Empty State
-   Error State

------------------------------------------------------------------------

# Canonical Component Template

Every component specification SHALL define:

1.  Purpose
2.  Responsibilities
3.  Public API (Props)
4.  Events
5.  Internal State
6.  Variants
7.  Visual States
8.  Keyboard Interaction
9.  Accessibility
10. Motion
11. Performance Budget
12. Analytics Events
13. Acceptance Tests

------------------------------------------------------------------------

# State Taxonomy

Every interactive component SHALL support only applicable states:

-   Default
-   Hover
-   Focus
-   Active
-   Disabled
-   Loading
-   Empty
-   Error
-   Success

State transitions MUST reference Motion Tokens defined in Volume I.

------------------------------------------------------------------------

# Ownership Rules

-   Components own presentation.
-   Screens own composition.
-   Engines own business logic.
-   APIs own data.
-   Components MUST NOT contain application-specific business rules.

------------------------------------------------------------------------

# Acceptance Criteria

This volume is complete only when every reusable UI element has a
standalone specification that conforms to the canonical template and
references Volume I design tokens.
