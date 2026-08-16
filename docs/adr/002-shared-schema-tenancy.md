# ADR-002: Shared-schema multi-tenancy with RLS

**Status:** Accepted  
**Date:** 2026-08-16

## Context

The product must become multi-tenant SaaS without a rewrite.

## Decision

One database, `organization_id` on tenant data, RLS + application tenant context. Users are global; membership is per organization.

## Consequences

Fast iteration; isolation bugs are high severity — mitigated by RLS and mandatory org in JWTs. Dedicated-DB tenancy remains an operational tier later.
