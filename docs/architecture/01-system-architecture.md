# 1–4 · 11. System, Contexts, Modules, APIs, Extraction

## 1. Complete system architecture

### What we are building

A **modular monolith**: one NestJS process, one Next.js web app, one PostgreSQL database, with **hard domain boundaries**. Modules communicate through:

- **Synchronous in-process ports** for strongly consistent workflows (post invoice, receive goods, reserve stock).
- **Asynchronous domain events** (RabbitMQ, via outbox) for cross-context side effects (notifications, CRM activity, reporting projections, cache invalidation).

This is not a CRUD app with 10 folders. Each module owns:

- its PostgreSQL schema
- its domain model and invariants
- its application services
- its REST surface under `/api/v1/...`
- the events it publishes and the events it consumes

```
                    ┌─────────────────────────────────────────┐
                    │              apps/web (Next.js)         │
                    │   App Router · TanStack Query · RHF/Zod │
                    └────────────────────┬────────────────────┘
                                         │ HTTPS /api/v1
                    ┌────────────────────▼────────────────────┐
                    │         apps/api  NestJS monolith        │
                    │  Identity │ Org │ HR │ Inventory │ Sales │
                    │  Purchase │ Finance │ CRM │ Notify │ Rpt │
                    │                                          │
                    │  common: guards, CLS, filters, paging    │
                    │  infrastructure: prisma, redis, rmq, otel│
                    └─┬──────────┬──────────┬─────────────────┘
                      │          │          │
                 PostgreSQL   Redis     RabbitMQ
                 (truth)    (cache,     (events)
                            sessions,   + DLQ
                            BullMQ)     MinIO (files)
```

### Why a modular monolith (not microservices on day one)

| | |
| --- | --- |
| **Why** | ERP workflows are **cross-domain and transactional** (goods receive → stock → AP invoice → journal). Splitting those across networks on day one creates distributed-transaction hell. |
| **Problem solved** | Strong consistency for money and stock; one deployable while the domain is still being discovered. |
| **Trade-offs** | A large Node process; a careless import can break boundaries. We mitigate with ESLint `no-restricted-imports`, schema isolation, and public module APIs. |
| **Scale** | Horizontally scale **stateless API replicas** behind a load balancer. Bottlenecks (reports, notifications) offload to workers first — not new services. |
| **Change later** | Each Nest module is already a candidate service. Outbox events and REST contracts stay; in-process ports become HTTP/gRPC. |

### Process topology (always)

Even as a monolith we run **two process types** from the same codebase:

1. **API** — HTTP, auth, sync commands, health.
2. **Worker** — BullMQ jobs + RabbitMQ consumers + outbox publisher.

Why: CPU-heavy reports and email must not block request threads; Kubernetes can scale workers independently of the API.

### Shared kernel (tiny, deliberate)

Allowed to be imported by every module:

- `organization_id` / tenant context
- `UserId`, `Actor` (id, ip, userAgent)
- `Money`, `Quantity` value objects
- `Result` / domain error types
- pagination, clock, id generator
- outbox port, event envelope
- authorization port (`can(permission)`)

Not allowed in the kernel: Product, Invoice, JournalEntry, Employee. Those belong to their contexts.

---

## 2. Bounded contexts

| Context | PostgreSQL schema | Owns | Does **not** own |
| --- | --- | --- | --- |
| **Identity** | `identity` | Users, credentials, sessions, 2FA, platform roles | Org structure |
| **Organization** | `organization` | Tenants, memberships, branches, depts, fiscal years, settings | Employees as HR entities |
| **HR** | `hr` | Employees, attendance, leave, payroll **as HR records** | General ledger posting (emits events; Finance posts) |
| **Inventory** | `inventory` | Products, warehouses, stock balances, movements, adjustments, transfers | Purchase orders, sales prices as commercial docs |
| **Sales** | `sales` | Customers, quotations, sales orders, invoices, AR **documents**, returns | Cash book, COA, stock quantities |
| **Purchase** | `purchase` | Suppliers, PRs, POs, GRNs, purchase invoices, returns | Stock quantities (asks Inventory) |
| **Finance** | `finance` | COA, journals, taxes, banks, payments **as accounting**, reports TB/P&amp;L/BS/CF | Inventing stock or CRM pipelines |
| **CRM** | `crm` | Leads, opportunities, activities | Canonical customer master (references Sales customer once converted) |
| **Notification** | `notification` | Templates, in-app inbox, email dispatch | Business decisions |
| **Reporting** | `reporting` | Dashboards, snapshots, saved reports | Operational writes |

### Why these boundaries

- **Identity vs Organization:** A person can belong to many tenants. Auth is global; membership is tenant-scoped.
- **Sales vs Finance:** A sales invoice is a commercial document. The journal is a financial fact. They post together in one DB transaction **today**; they remain two models so Finance can later be extracted.
- **Purchase vs Inventory:** A GRN is a commercial receipt. On-hand quantity is an inventory fact. The sync call `Inventory.increaseOnHand` runs in the **same Postgres transaction**.
- **HR payroll vs Finance:** Payroll run is an HR process. When confirmed, Finance receives `PayrollPosted` and creates salary / tax / payable entries.
- **CRM vs Sales:** Leads are not customers. Conversion creates a Sales customer (idempotently) and links the opportunity.
- **Reporting vs source contexts:** Heavy aggregations must not lock OLTP tables. Reporting **projects** from events + scheduled snapshots.

### Context map (allowed couplings)

```
Identity ──<membership>──► Organization
Organization ◄── all tenant-owned contexts (organization_id)

Sales ──sync──► Inventory   (reserve / ship)
Purchase ──sync──► Inventory (receive / return)
Sales ──sync──► Finance     (post invoice / payment / return)
Purchase ──sync──► Finance  (post bill / payment / return)
HR ──event──► Finance       (payroll posted)
Inventory ──event──► Finance (optional COGS / adjustment journals)

* ──event──► Notification
* ──event──► Reporting
* ──event──► Audit (also sync interceptor)
CRM ──sync──► Sales          (qualify lead → customer)
```

**Rule:** no nested transactions across modules that hide failures. A sales-order confirmation that cannot reserve stock **rolls back** the whole command.

---

## 3. Module boundaries (NestJS + Next.js)

### Monorepo

```
apps/
  web/                  Next.js App Router
  api/                  NestJS HTTP + worker entrypoints
packages/
  shared/               Money, errors, event envelope, permission catalog
  types/                Public DTO / event TypeScript types
  config/               env schema (Zod) shared by api/web
  eslint-config/
  tsconfig/
docs/
  architecture/
  adr/
```

### API module layout (each bounded context)

```
apps/api/src/modules/sales/
  sales.module.ts                 public Nest module
  api/                            controllers, request/response DTOs
  application/                    command/query handlers, use-cases
  domain/                         entities, invariants, domain events, enums
  infrastructure/                 Prisma repos, mappers
```

**Controllers stay thin.** They: authenticate → authorize → parse DTO → call one use-case → map result.

**Other modules import only** `SalesFacade` / ports from `sales/public.ts`, never Prisma models from `sales`.

ESLint:

```
inventory/**  cannot import  sales/** internals
finance/**    cannot import  prisma models of inventory
```

### Frontend mirroring

```
apps/web/src/
  app/(auth)/
  app/(tenant)/
    dashboard/
    inventory/
    sales/
    ...
  features/<context>/     queries, mutations, tables, forms
  shared/                 ui, api-client, auth, tenancy
```

React components never talk to Prisma. The BFF is the Nest API. Next.js Route Handlers are only used for auth cookie bridging if we store refresh cookies on the web origin.

---

## 4. Microservice extraction strategy

Do **not** extract until at least two of these are true:

1. The module has a **clear public API** and event contract that has been stable across a release.
2. Scale or ownership requires independent deploy (e.g. notification volume, reporting ETL).
3. A transactional workflow that currently needs a shared DB has been redesigned (saga or issue-document-then-post).

### Potential future services — and why they exist

| Future service | Extract when | Why this cut | What must exist first |
| --- | --- | --- | --- |
| **API Gateway** | Multiple HTTP services | Authn, rate limit, routing, WAF in one place | Already we have Nest versioning + rate limit; gateway is optional until split |
| **Auth / Identity** | Compliance, separate SLO, many clients | Identity is a generic capability; blast-radius isolation | Opaque refresh store, JWKS if we move to asymmetric JWT |
| **User/Org** | Rarely alone — usually stays with Identity | Membership is small | — |
| **Inventory** | High write QPS on stock | Stock is a hot aggregate with locks | Movement log + reservation API as the **only** writers |
| **Sales** | Sales team / channel load | Commercial docs vs warehouse | Idempotent reservation + posting ports |
| **Purchase** | Obvious after inventory/sales | Symmetric to sales | GRN port to inventory |
| **Finance** | Audit isolation, regulated hosting | Ledgers must not share fate with CRM | Document → journal posting API; no dual-write from sales into GL tables |
| **Notification** | **First candidate** | Purely async, different scaling, failure-tolerant | Already event-driven |
| **Reporting** | **Second candidate** | Read-heavy, different DB shape | Snapshots + replica |

### Extraction sequence (recommended)

1. Split **Worker** (already from day one).
2. Extract **Notification**.
3. Extract **Reporting** onto a read replica / warehouse.
4. Extract **Identity** if SSO / many apps appear.
5. Extract **Inventory** only after the stock reservation API is the exclusive writer.
6. Extract **Finance** last among the OLTP domains — it is the hardest because of transactions.

### How in-process calls become remote

```
Today:   SalesService → InventoryFacade.reserve(...)   // same TX
Later:   SalesService → InventoryHttp.reserve(...)     // cannot share TX
```

When that happens, **sales order confirmation becomes a saga**:

1. Create SO `confirmed_pending_stock`
2. Call Inventory; on success mark `confirmed`
3. On stock failure: compensate SO → `confirm_failed` / back to `draft`

We **do not implement sagas now**. Shared DB is the correct consistency model until extraction.

---

## 11. API architecture

### Surface

```
/api/v1/auth/*
/api/v1/users/*
/api/v1/organizations/*
/api/v1/employees/*
/api/v1/inventory/*
/api/v1/products/*
/api/v1/sales/*
/api/v1/purchases/*
/api/v1/finance/*
/api/v1/crm/*
/api/v1/notifications/*
/api/v1/reports/*
/api/v1/health
/api/v1/ready
/metrics            (cluster-internal, not public)
```

Swagger at `/api/docs` (disabled or basic-auth in production).

### Conventions

| Concern | Choice |
| --- | --- |
| Style | REST, nouns, HTTP verbs |
| Version | URL `/api/v1`; breaking change → `/api/v2` |
| Envelope | `{ data, meta, error }` — `error` only on failure |
| IDs | UUID in path |
| Pagination | Cursor (`createdAt + id`) for lists that grow; numbered page only for small admin tables |
| Filter/sort | `filter[status]=posted&sort=-createdAt` |
| Search | `q=` full-text where indexed (`pg_trgm` / `tsvector`) |
| Idempotency | Header `Idempotency-Key` required for payments, posting, stock adjustments |
| Status | 201 create, 200 update, 204 empty delete, 409 conflict/version, 422 domain rule, 429 rate |
| Error code | Stable machine code `INV.INSUFFICIENT_STOCK` |
| Correlation | `X-Correlation-Id` echoed; generated if missing |

Success:

```json
{
  "data": { "id": "...", "status": "posted" },
  "meta": { "correlationId": "..." }
}
```

List:

```json
{
  "data": [ ... ],
  "meta": {
    "nextCursor": "eyJ...",
    "hasMore": true,
    "correlationId": "..."
  }
}
```

Failure:

```json
{
  "error": {
    "code": "FIN.PERIOD_CLOSED",
    "message": "Cannot post into a closed fiscal period",
    "details": [],
    "correlationId": "..."
  }
}
```

**Never return Prisma models.** Map to response DTOs. Never include password hash, refresh tokens, 2FA secrets, or internal version except as `etag` / `version` for optimistic lock.

### Query vs command

- `GET` — queries, no side effects, cacheable where safe (reference data).
- `POST /.../post`, `POST /.../confirm` — explicit verbs for state machines rather than `PATCH status`.
- `PATCH` — draft edits only.

---

## Major decision: TypeScript strict + no `any`

| | |
| --- | --- |
| **Why** | Financial systems cannot afford implicit `any` leaking unchecked JSON into journals. |
| **Trade-off** | Slower initial coding; fewer production type bugs. |
| **Scale / change** | Shared `packages/types` becomes the contract when services split. |
