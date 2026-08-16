# 9–10 · 18–21 · 23. Redis, events, observability, Docker, CI/CD, production, testing

## 9. Redis caching strategy

Redis is **volatile infrastructure**. Flushing Redis must never corrupt money or stock.

### Uses

| Use | Pattern | Key shape | TTL | Invalidation |
| --- | --- | --- | --- | --- |
| Permission set | cache-aside | `perm:{orgId}:{userId}` | 5–15 min | Role/permission write → `DEL` |
| Session allow-list (optional) | write-through of session id | `sess:{sessionId}` | aligned to refresh | Logout / reuse detection → `DEL` |
| Reference data | cache-aside | `ref:{orgId}:units` etc. | 1 h | CRUD on that master |
| Dashboard widgets | cache-aside | `dash:{orgId}:{widget}:{period}` | 30–120 s | Domain events `InvoicePosted`, `PaymentReceived` |
| HTTP rate limit | sliding window via Redis | `rl:{ip}:{route}` | window | n/a |
| Distributed lock | Redlock-like / `SET NX PX` | `lock:seq:{orgId}:{docType}` | short | only for **sequence helpers** that still commit in PG — **not** for stock |
| BullMQ | library keys | `bull:{queue}:*` | n/a | n/a |

### Explicitly not cached (unless tagged + immediate invalidation)

- `stock_balances.qty_*`
- journal line amounts / account balances
- invoice `amount_paid` / open balance
- anything used in a posting decision

Stock **reads for UI** may be cached 5–10 seconds with `StockUpdated` invalidation. **Reservation and posting always read PostgreSQL `SELECT ... FOR UPDATE`.**

### Cache-aside algorithm

1. Get from Redis.
2. On miss, load DB, `SET` with TTL.
3. On write, update DB then `DEL` (not SET) — avoid stale overwrite races.

### Why this split

| | |
| --- | --- |
| **Why** | Authz checks happen on every request; hitting 8 permission joins is wasteful. Money cannot be served from a replica of last week’s cache. |
| **Trade-off** | Invalidation bugs cause UI staleness, not ledger corruption — we keep it that way on purpose. |
| **Scale** | Redis Cluster later; start with one instance, `maxmemory-policy allkeys-lru` only on cache DB index, **never** LRU on BullMQ DB. Use **separate Redis logical DBs or two instances**: `cache` vs `queue`. **Two instances in Compose** recommended. |
| **Change later** | Swap to KeyDB/Memorystore without API changes; facades behind `CachePort`. |

---

## 10. RabbitMQ event architecture

### Envelope (all events)

```json
{
  "id": "uuidv7",
  "type": "sales.InvoicePosted",
  "version": 1,
  "occurredAt": "2026-08-16T05:00:00.000Z",
  "organizationId": "...",
  "aggregateType": "SalesInvoice",
  "aggregateId": "...",
  "correlationId": "...",
  "causationId": "...",
  "actorId": "...",
  "payload": {}
}
```

Payloads are **backward compatible**: add optional fields; never reuse names. Breaking change → `version: 2` and a new routing key.

### Topology

- Exchange `erp.events` **topic**, durable
- Retry exchange `erp.events.retry` + TTL queues (5s, 30s, 5m)
- DLX `erp.events.dlx` → queue `erp.events.dead`
- Routing key: `sales.invoice.posted.v1`

Queue per **consumer group** (not per instance):

- `notification.email`
- `notification.inapp`
- `reporting.projections`
- `crm.activity-from-sales`
- `cache.invalidation`

The **API process does not consume** business queues. Workers do.

### Transactional outbox (mandatory)

```
BEGIN
  write invoice + lines + journal + stock...
  INSERT outbox_events
COMMIT
-- separate publisher poller:
  SELECT unpublished FOR UPDATE SKIP LOCKED
  publish to RabbitMQ
  SET published_at = now()
```

| | |
| --- | --- |
| **Why** | If we publish then the TX rolls back, consumers see ghosts. If we commit then the process dies before publish, effects are lost. Outbox makes publish **at-least-once** and consistent with Postgres. |
| **Trade-off** | Seconds of delay; extra table. |
| **Scale** | Publisher is a worker replica with `SKIP LOCKED`; partition later. |
| **Change later** | Debezium CDC on `outbox_events` if we want log-based publishing. |

### Consumer rules

1. Strip/insert `inbox_messages (event_id, consumer_name)` first — duplicate → ack and return.
2. Handler is **idempotent** even without inbox (e.g. `INSERT notification ... ON CONFLICT`).
3. Failure after inbox insert must not happen (process **after** inbox only if work is also idempotent) **or** insert inbox **after** success.  
   **Chosen:** inbox **after** success + unique event id on effects. Retry then re-runs work safely.
4. After N retries → DLQ; Pager/alert; no silent drop.
5. Never assume order across types. Within an aggregate, consumers that need order must use version / `occurredAt` + ignore stale.

### Catalog (initial)

| Event | Publisher | Typical consumers |
| --- | --- | --- |
| `identity.UserCreated` | Identity | Notification (welcome), Audit |
| `organization.OrganizationCreated` | Org | Finance (seed COA), Inventory (default warehouse) — **sync seed in same TX preferred** for onboard |
| `hr.EmployeeCreated` | HR | Notification, Identity (optional user invite) |
| `inventory.ProductCreated` | Inventory | Reporting, cache |
| `inventory.StockUpdated` | Inventory | Dashboard cache, Reporting |
| `purchase.PurchaseOrderCreated` | Purchase | Notification, Approval |
| `purchase.GoodsReceived` | Purchase | Notification, Reporting (Inventory already sync-updated) |
| `sales.SalesOrderCreated` | Sales | CRM, Notification |
| `sales.InvoicePosted` | Sales | Notification, Reporting, CRM |
| `finance.PaymentPosted` | Finance | Sales/Purchase allocation already sync; notify, reporting |
| `finance.JournalEntryPosted` | Finance | Reporting |

Sync vs async reminder: **stock and GL change with the document POST in one TX**. Events are for everyone else.

---

## 18. Observability architecture

| Signal | Tool | Standard |
| --- | --- | --- |
| Logs | Pino JSON stdout | `level`, `msg`, `correlationId`, `organizationId`, `userId` (not email/PII dumps), `module` |
| Traces | OpenTelemetry SDK | W3C `traceparent`; Nest interceptor + Prisma + AMQP + HTTP |
| Metrics | Prometheus | RED: request rate/error/duration, queue lag, outbox age, TX duration, stock lock waits |
| Screens | Grafana | API, Postgres, Redis, RabbitMQ, Node |
| Probes | HTTP | `/api/v1/health` liveness (process up), `/api/v1/ready` (PG+Redis+RMQ ping) |

**Never log:** passwords, hashes, tokens, TOTP secrets, card numbers, national ids, raw authorization headers.

PII in logs: user id yes, email only at debug locally.

OTel service names: `erp-api`, `erp-worker`, `erp-web`.

---

## 19. Docker architecture

### Local Compose (Phase 1)

Services:

- `postgres:16`
- `redis-cache`
- `redis-queue`
- `rabbitmq:3-management`
- `minio`
- `api` (Nest)
- `worker` (same image, different command)
- `web` (Next)
- `mailhog` (dev email)
- optional `prometheus` + `grafana` from Phase 1 skeleton or Phase 8

Networks: `erp_internal`. Volumes for pg/redis/minio.

Each app image:

- multi-stage build
- non-root user
- `NODE_ENV=production`
- dist only
- dumb-init / node signal handling

### Kubernetes-ready without running K8s now

12-factor: config from env; no sticky sessions; graceful shutdown (`SIGTERM` wait for in-flight + stop consumers); `/ready` for pod readiness; HPA-friendly (stateless).

Manifests later: Deployment api, Deployment worker, Migration Job (Prisma migrate **before** new pods), Secret store, Ingress.

---

## 20. CI/CD architecture

GitHub Actions:

1. **PR:** `pnpm lint` · `typecheck` · `test:unit` · `test:integration` (Testcontainers) · Next.js lint
2. **Main:** build & push images (`api`, `web`) with git SHA tag + `OpenAPI` artifact
3. **Release tag:** deploy staging → smoke E2E → prod (environment protection)

Jobs never print `.env`. Secrets via GitHub Environments.

Migrations: **forward-only**. Destructive deploys require an explicit expand/contract ADR.

---

## 21. Production deployment architecture

```
Internet
  → CDN / Next.js (web)
  → WAF / TLS terminate
  → Ingress
       → api (N replicas)
       → worker (M replicas)
  Postgres primary (+ replica for reporting later)
  Redis cache, Redis queue
  RabbitMQ cluster (or managed)
  Object storage (MinIO / S3)
  Prometheus / Grafana / Loki or vendor APM
```

| | |
| --- | --- |
| **Why** | ERP availability is a business continuity requirement; API and workers scale on different axes. |
| **Trade-off** | You operate a small platform. Managed PG/Redis/RMQ in production is preferred over self-hosting the first year. |
| **Scale** | Vertical PG first (it’s the bottleneck). Then read replica, then extract reporting, then extract inventory. |
| **Change later** | Swap MinIO→S3, Compose→EKS/GKE, Pino+OTel→vendor without rewriting domains. |

Backups: PG PITR 7–30 days; MinIO versioning; **test restore** in CI monthly (operational checklist).

---

## 23. Testing strategy

| Layer | Tool | What |
| --- | --- | --- |
| Unit | Jest | Domain services: posting rules, stock math, allocation, RBAC checks — **no I/O** |
| Integration | Jest + Supertest + Testcontainers PG/Redis | Repositories, HTTP, RLS, transactions, idempotency |
| Contract | OpenAPI snapshot / schema tests | DTO drift |
| Messaging | Testcontainers RabbitMQ or in-memory outbox assertion | Outbox row exists after post; consumer idempotency |
| E2E | Playwright (web) + Supertest critical paths | Login, SO→invoice→payment; PO→GRN→bill |
| Load | k6 later (not Phase 1) | Measure before “optimize” |

**Financial tests are not optional:** balanced journal, period closed rejection, double-post rejection, concurrent reservation (two checkouts, one warehouse).

DoD per phase: unit + integration for that context; E2E for its primary workflow; architecture notes updated if decisions changed.
