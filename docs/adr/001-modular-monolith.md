# ADR-001: Modular monolith with schema-separated bounded contexts

**Status:** Accepted  
**Date:** 2026-08-16

## Context

We need an enterprise ERP with many domains and a future microservice option, without delaying a correct financial system.

## Decision

Ship one NestJS application. Each bounded context is a Nest module + PostgreSQL schema + public facade. Cross-context **money and stock** stays in one Postgres transaction. Side effects go through the outbox to RabbitMQ.

## Consequences

Positive: transactional integrity, simple ops, extractable later.  
Negative: requires import discipline; a single runtime failure domain.
