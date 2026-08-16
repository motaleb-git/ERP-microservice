# Phase 1 runbook

Platform spine only: no login, no ERP modules.

## Bring-up

1. `pnpm docker:up` — Postgres 16, Redis cache, Redis queue, RabbitMQ, MinIO, Mailhog
2. `pnpm db:generate` then `pnpm db:migrate:deploy`
3. `pnpm dev` — API (3001) + web (3000)
4. `pnpm dev:worker` — outbox publisher + sample consumer

## Verify

- `GET /api/v1/health` → `{ data: { status: "ok", service: "erp-api" } }`
- `GET /api/v1/ready` → all checks `up` when Docker is healthy
- `GET /metrics` Prometheus text
- `POST /api/v1/system/outbox-sample` (when `SAMPLE_ENDPOINTS_ENABLED=true`) inserts `platform.outbox_events`
- Worker marks the row `published_at` and inserts `platform.inbox_messages`

## Schema created

`identity.users` (unused until Phase 2), `organization.organizations`, platform outbox/inbox/idempotency/audit/file_objects.
