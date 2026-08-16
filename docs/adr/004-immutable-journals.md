# ADR-004: Immutable double-entry journals

**Status:** Accepted  
**Date:** 2026-08-16

## Context

Accountants and auditors cannot accept silently edited history.

## Decision

Posted journals are insert-only. Corrections are reversals. Commercial documents post journals in the same database transaction while we remain a monolith. GL posting for sales/purchase goes live in Phase 6.

## Consequences

Stricter UX; trustworthy TB/P&L. Finance extraction later requires a posting API instead of shared tables.
