# ADR-003: Transactional outbox + idempotent consumers

**Status:** Accepted  
**Date:** 2026-08-16

## Context

RabbitMQ cannot participate in the Postgres transaction. Dual-write is a well-known data-loss failure mode.

## Decision

Write `platform.outbox_events` in the business transaction. A worker publisher emits at-least-once. Consumers use `platform.inbox_messages` and idempotent handlers. Dead-letter after retries.

## Consequences

Eventual side effects (email, CRM, reports) may lag seconds. Core ledgers never depend on the broker.
