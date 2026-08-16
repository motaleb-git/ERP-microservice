# 24. Development roadmap

**Approval gate:** no application scaffolding until this pack is accepted.

Legend: **P** = phase. Each phase ships backend + API + frontend shell for that context + tests + runbook.

## Definition of Done (every phase)

- [ ] Architecture note updated if a decision changed
- [ ] Prisma migration(s) with constraints + indexes
- [ ] Domain services, not fat controllers
- [ ] OpenAPI for new routes
- [ ] Unit tests for invariants
- [ ] Integration tests (HTTP + DB)
- [ ] Authz on every write route
- [ ] Audit on posting / permission / entity create-update-delete
- [ ] Pino + correlation id on the path
- [ ] README: how to run that slice
- [ ] No secrets in logs or repo

---

## Phase 1 — Platform spine

**Goal:** empty ERP that is already production-shaped.

- pnpm + Turborepo monorepo (`apps/web`, `apps/api`, packages)
- Docker Compose: Postgres, Redis cache, Redis queue, RabbitMQ, MinIO, Mailhog
- NestJS: config (Zod), Pino, OTel stub, `/health` `/ready`, `/metrics`, `/api/v1` prefix, global validation pipe, exception filter envelope
- Prisma with `identity`, `organization`, `platform` schemas (minimal), outbox table
- Outbox publisher worker skeleton + one sample consumer
- Next.js app: layout, env, API client, health page
- GitHub Actions: lint, typecheck, unit placeholder
- Helm-not-yet: Dockerfile + `.env.example` + CONTRIBUTING

**Not in P1:** login UI beyond a stub, any ERP module.

## Phase 2 — Identity, tenancy, RBAC, audit

- Users, Argon2id, JWT access, hashed rotating refresh, 2FA TOTP
- Organizations, members, current-org context
- Branches / depts / designations / fiscal years / settings (thin)
- Permission catalog, roles, grants
- RLS policies + Prisma tenant plugin
- Audit interceptor
- Web: login, org switcher, users & roles admin, audit viewer (auditor)

**E2E:** invite → login → 2FA → assign role → forbidden without permission.

## Phase 3 — Inventory

- Categories, brands, units, products, warehouses
- Stock balances, movements, adjustments, transfers
- Reservation API (used later by sales)
- Weighted average cost on receive/adjust
- Web: product master, warehouse stock, adjust/transfer

**E2E:** receive + concurrent reserve (one winner).

## Phase 4 — Sales

- Customers, quotations, orders, shipments, invoices, returns, discounts/tax on lines
- Stock reserve/ship wiring
- Payments **as AR documents** posting into Finance **if Finance tables exist** — if P6 not done, keep invoice `draft/posted` with a **feature flag** `finance.posting_enabled` (default false until P6) **or** require P6 immediately after P4.

**Decision for approval:** prefer **P6 before P4 posting goes live**. P4 can still create commercial documents; **Post** button enabled in P6. Stock reservation is live in P4.

**E2E:** quote → order (reserve) → ship → (post invoice when finance ready).

## Phase 5 — Purchase

- Suppliers, PR, PO, GRN, purchase invoices, returns
- GRN → inventory receive
- AP posting flagged like sales (on in P6)

**E2E:** PR → PO → GRN increases stock.

## Phase 6 — Finance

- COA seed, taxes, journals, period close
- Invoice/GRN/payment posting recipes
- Reversals, AR/AP allocation
- Trial balance, P&amp;L, balance sheet, cash flow (v1 from journals)
- Web: COA, journal list, post/void, financial statements

**E2E:** posted invoice → TB moves; payment → AR clears; reverse restores.

## Phase 7 — HR

- Employees, profiles, documents (MinIO)
- Attendance, holidays, leave
- Salary structures, payroll run
- `PayrollPosted` → Finance journals

## Phase 8 — CRM

- Leads, opportunities, activities, follow-ups
- Convert lead → customer (idempotent)

## Phase 9 — Reporting & SaaS hardening

- Dashboard projections, sales/purchase/inventory/HR/finance reports
- Export, saved reports
- Grafana dashboards as code
- k6 smoke, backup restore drill, RLS pentest checklist
- Multi-currency completion if still single-currency
- Notification templates at production quality

---

## Explicit non-goals until named later

- Manufacturing / MRP / BOM
- POS / multi-channel e-com
- Full warehouse bin/lot/serial (design columns nullable; implement when asked)
- Custom report designer / BI embedded
- Multi-book (IFRS vs local) — single book per tenant v1
- Microservices split

---

## Suggested approval checklist

Reply with **Approved** or list amendments. At minimum confirm:

1. Modular monolith + later extraction order (Notification → Reporting → Identity → Inventory → Finance last)
2. Shared-DB tenancy + RLS
3. P4 sales **stock live**, **GL posting waits for P6**
4. Weighted average costing (not FIFO) in v1
5. MinIO + dual Redis + transactional outbox as stack additions
6. UUID v7, `NUMERIC` money, UUID PKs, document numbers separate
7. Start Phase 1 after approval

If you want FIFO, schema-per-tenant, or Finance before Inventory, say so now — those change table design.
