# AXON Engineering Specification

# Volume VIII --- Database Specification

**Document ID:** AES-VOL-VIII **Version:** 1.0.0 **Status:** Draft for
Implementation **Depends On:** Constitution Chapters 0--9, Volumes
I--VII

------------------------------------------------------------------------

# Purpose

This volume defines the canonical data architecture of AXON. It
specifies entity ownership, persistence boundaries, relationships,
lifecycle management, migration strategy, and data governance.

The database is the system of record for persistent application state.
Every persisted entity SHALL have a single authoritative owner.

------------------------------------------------------------------------

# Objectives

-   Establish a normalized, maintainable data model.
-   Define ownership boundaries for all persistent data.
-   Support scalability, auditability, and performance.
-   Enable safe schema evolution through versioned migrations.

------------------------------------------------------------------------

# Data Architecture Principles

-   Single source of truth for every entity.
-   Explicit ownership by one backend service.
-   Immutable audit history where required.
-   Referential integrity by default.
-   Soft deletion only when justified by business requirements.
-   Schema changes MUST be managed through versioned migrations.

------------------------------------------------------------------------

# Canonical Domains

## Identity Domain

Entities: - User - Session - Role - Permission - OAuth Connection

Owner: Identity Service

------------------------------------------------------------------------

## Academic Domain

Entities: - Academic Profile - Digital Twin - Subject - Topic -
Knowledge State - Learning Event - Revision History

Owner: Academic Service

------------------------------------------------------------------------

## Mission Domain

Entities: - Mission - Mission Step - Mission History - Completion Record

Owner: Mission Service

------------------------------------------------------------------------

## Planner Domain

Entities: - Study Plan - Study Block - Calendar Event - Availability
Window

Owner: Planner Service

------------------------------------------------------------------------

## Resource Domain

Entities: - Note - Resource - Past Paper - File - Resource Metadata -
Search Index

Owner: Resource Service

------------------------------------------------------------------------

## Analytics Domain

Entities: - Metric - Usage Event - Progress Snapshot - Dashboard Summary

Owner: Analytics Service

------------------------------------------------------------------------

# Relationship Rules

-   Every relationship SHALL define ownership.
-   Cascading deletes MUST be explicitly documented.
-   Cross-domain references SHOULD use stable identifiers.
-   Circular ownership is prohibited.

------------------------------------------------------------------------

# Indexing Strategy

Every entity specification SHALL define:

-   Primary key
-   Secondary indexes
-   Unique constraints
-   Composite indexes (if applicable)
-   Full-text indexing requirements

Indexes SHALL be justified by query patterns.

------------------------------------------------------------------------

# Migration Policy

All schema changes MUST:

-   Be version controlled.
-   Be reversible where feasible.
-   Preserve existing production data.
-   Include migration validation.
-   Include rollback guidance.

------------------------------------------------------------------------

# Data Lifecycle

Every entity SHALL define:

-   Creation trigger
-   Update trigger
-   Retention period
-   Archival policy
-   Deletion policy

Sensitive data SHALL include privacy classification.

------------------------------------------------------------------------

# Backup & Recovery

Database specifications SHALL include:

-   Backup frequency
-   Recovery Point Objective (RPO)
-   Recovery Time Objective (RTO)
-   Verification procedures
-   Disaster recovery considerations

------------------------------------------------------------------------

# Future Specifications

This volume SHALL expand into:

-   Entity Catalog
-   Relationship Matrix
-   Schema Definitions
-   Migration Handbook
-   Indexing Guide
-   Data Retention Policy
-   Backup & Recovery Manual
-   Privacy Classification Matrix

------------------------------------------------------------------------

# Acceptance Criteria

This volume is complete only when every persistent entity has a
standalone specification defining ownership, schema, relationships,
indexing, lifecycle, migration, and retention requirements.
