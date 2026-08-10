# AXON Production Constitution

# Chapter 0 --- Constitution Framework

**Document ID:** AXON-CONST-000\
**Status:** Accepted\
**Version:** 1.0.0

## Purpose

This chapter defines how every subsequent chapter in the AXON Production
Constitution must be written, interpreted, maintained, and amended. It
is the governing specification for the documentation itself.

## Scope

Applies to every constitutional document covering product, UX, UI, AI,
backend, infrastructure, integrations, engineering, QA, and operations.

## Normative Language

  Keyword      Meaning
  ------------ -----------------------------------------------------------
  MUST         Mandatory requirement.
  MUST NOT     Prohibited.
  SHOULD       Strong recommendation requiring justification to deviate.
  SHOULD NOT   Discouraged.
  MAY          Optional.

## Decision Hierarchy

1.  Constitution Framework
2.  Vision
3.  Product Philosophy
4.  Operating System Principles
5.  Design System
6.  Feature Specifications
7.  Engineering Specifications

Lower-level documents must never contradict higher-level documents.

## Requirement IDs

Every requirement receives a permanent identifier (e.g. AXON-CORE-001).
IDs are never reused.

## Immutable Rules

### AXON-CONST-001

AXON MUST be engineered as a production product.

### AXON-CONST-002

Production code MUST NOT contain placeholder UI, fake APIs, TODO
markers, mock workflows, stub implementations, or lorem ipsum.

### AXON-CONST-003

If required implementation information is unavailable (API credentials,
OAuth configuration, branding assets, legal copy, etc.), implementation
MUST stop and request the missing information instead of inventing
substitutes.

### AXON-CONST-004

Every AI-generated recommendation SHOULD be explainable to the user.

### AXON-CONST-005

Every feature MUST reduce or preserve cognitive load. Features that
increase cognitive load require an explicit constitutional amendment.

## Standard Chapter Template

Every future chapter SHALL contain:

1.  Metadata
2.  Purpose
3.  Scope
4.  Dependencies
5.  Definitions
6.  Requirements
7.  Rationale
8.  Acceptance Criteria
9.  Future Considerations
10. Open Questions (only if unresolved)

## Traceability

Every requirement MUST trace back to either: - a higher constitutional
rule, or - an approved architectural decision.

## Amendment Policy

Only a new Constitution revision may alter immutable rules.

## Acceptance Criteria

This chapter is complete only if: - Normative terminology is defined. -
Decision hierarchy is fixed. - Requirement ID format is defined. -
Production-only policy is established. - Placeholder prohibition is
established. - Documentation template is standardized.
