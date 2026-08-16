# Contributing

## Prerequisites

- Node.js 22+
- pnpm 10 (`corepack enable` then `corepack prepare pnpm@10.15.1 --activate`)
- Docker Desktop (Postgres, Redis, RabbitMQ, MinIO, Mailhog)

## First run

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

- Web: http://localhost:3000
- API health: http://localhost:3001/api/v1/health
- Swagger: http://localhost:3001/api/docs
- Mailhog: http://localhost:8025
- RabbitMQ UI: http://localhost:15672 (erp / erp)
- MinIO console: http://localhost:9001

Worker (separate terminal):

```bash
pnpm dev:worker
```

## Rules

1. TypeScript strict. No `any`.
2. Do not skip transactions for money or stock.
3. Do not put secrets in logs or git.
4. Build one bounded context at a time.
5. Architecture docs live in `docs/architecture`. Change via ADR if a decision changes.
