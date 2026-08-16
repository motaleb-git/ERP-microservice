# ERP Architecture — Approval Pack

**Status:** Accepted — Phase 1 implementation underway.  
**Style:** Modular monolith first, microservice-ready  
**Stack:** Next.js · NestJS · PostgreSQL · Prisma · Redis · RabbitMQ · BullMQ

## How to read

| Order | Document | Covers |
| --- | --- | --- |
| 1 | [01-system-architecture.md](./01-system-architecture.md) | System shape, bounded contexts, module boundaries, extraction strategy, API layout |
| 2 | [02-data-model.md](./02-data-model.md) | Database architecture, ERD, table catalog, relationships, constraints |
| 3 | [03-platform.md](./03-platform.md) | Redis, RabbitMQ, observability, Docker, CI/CD, production, testing |
| 4 | [04-security.md](./04-security.md) | Auth, RBAC, multi-tenancy, audit, OWASP |
| 5 | [05-finance-inventory.md](./05-finance-inventory.md) | Double-entry, posting, stock consistency, critical workflows |
| 6 | [06-roadmap.md](./06-roadmap.md) | Phased delivery, Definition of Done, what to approve |
| 7 | [07-catalogs.md](./07-catalogs.md) | Permission codes, notification pipeline, reporting, table checklist |
| — | [phase-1.md](./phase-1.md) | Phase 1 runbook |

## Non-negotiable rules

1. PostgreSQL is the source of truth for money, stock, and identity.
2. Redis is never the source of truth for financial or inventory data.
3. Domain events are published via a **transactional outbox**, not from application memory after commit.
4. Consumers are **idempotent**. Exactly-once delivery is not assumed.
5. Accounting is **double-entry**. Historical journals are not edited; they are reversed.
6. Stock quantity changes only through **stock movements** inside a database transaction.
7. Every tenant-owned row carries `organization_id`. Cross-tenant access is a defect, not a feature.
8. Build one bounded context at a time. No hundred-file dumps.

## Stack additions (justified)

The master prompt did not list these, but they are required for a serious ERP:

| Addition | Why |
| --- | --- |
| **pnpm + Turborepo** | Fast, standard TypeScript monorepo tooling |
| **MinIO (S3 API)** | Employee documents, invoice PDFs, attachments — not Postgres BLOBs |
| **Transactional outbox table** | Exactly the missing piece between DB transactions and RabbitMQ |
| **UUID v7** | Time-ordered IDs; better B-tree locality than UUID v4 |
| **PostgreSQL schemas** | Physical bounded-context boundaries inside one database |
| **NestJS CLS / AsyncLocalStorage** | Request-scoped `organizationId`, `userId`, `correlationId` |
| **Playwright** | Frontend E2E for critical workflows |

If any of these should be rejected, say so before Phase 1.
