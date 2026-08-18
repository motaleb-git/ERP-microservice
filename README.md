# ERP Management System with Microservices Architecture

I’ve been working on an enterpris

Production-grade enterprise ERP (modular monolith, SaaS-ready).

**Status:** Phase 1 in progress — platform spine (monorepo, Docker, health, logging, outbox).

Architecture: [docs/architecture/README.md](docs/architecture/README.md)

## Run locally

Requires Node 22, pnpm 10, and Docker.

```bash
cp .env.example .env
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local

pnpm install
pnpm docker:up
pnpm db:generate
pnpm db:migrate:deploy
pnpm dev
```

In another terminal:

```bash
pnpm dev:worker
```

| Surface | URL |
| --- | --- |
| Web | http://localhost:3000 |
| Health page | http://localhost:3000/health |
| API liveness | http://localhost:3001/api/v1/health |
| API readiness | http://localhost:3001/api/v1/ready |
| Metrics | http://localhost:3001/metrics |
| OpenAPI | http://localhost:3001/api/docs |

## Stack

Next.js · NestJS · PostgreSQL · Prisma · Redis · RabbitMQ · BullMQ

Development continues by bounded context: Auth (Phase 2) → Inventory → Sales → Purchase → Finance → HR → CRM → Reporting.
