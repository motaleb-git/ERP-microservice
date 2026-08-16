# 12–15 · 22. Authentication, RBAC, multi-tenancy, audit, security

## 12. Authentication architecture

### Tokens

| Token | Form | Lifetime | Storage |
| --- | --- | --- | --- |
| Access | JWT (HS256 in Phase 2; **RS256/JWKS** before public clients or extracted Auth service) | 10–15 min | Memory / Authorization header from web |
| Refresh | Opaque 256-bit random, **only hash (SHA-256) stored** | 7–30 days | `httpOnly`, `Secure`, `SameSite=Lax` cookie on the API (or BFF) domain |

Web (Next.js) never puts refresh tokens in `localStorage`.

**Rotation:** every refresh issues a new token and marks the old session row replaced. **Reuse detection:** presenting a replaced token ⇒ revoke `family_id`.

### Password

Argon2id via `argon2` package (memory/time params in config, not hardcoded). Lockout: N failures per email+IP (Redis minute bucket + `login_attempts` audit). Timing-safe compare on failed unknown email (same hash cost dummy).

### Session lifecycle

`POST /api/v1/auth/login` → optional `2fa` challenge  
`POST /api/v1/auth/refresh`  
`POST /api/v1/auth/logout` (this session)  
`POST /api/v1/auth/logout-all`

### 2FA-ready (Phase 2 architecture, implement TOTP in same phase as auth)

- `user_totp.secret` encrypted with app KEK (env / KMS later)
- Login returns `totpRequired: true` + short-lived `preAuth` token (`amr=pwd` only)
- `POST /auth/2fa/verify` upgrades to full session
- Backup codes hashed; one-time

SSO/OIDC is an **adapter** later; local identity remains.

### Why JWT + opaque refresh

| | |
| --- | --- |
| **Why** | Access JWT keeps APIs stateless for horizontal scale. Opaque refresh lets us revoke and rotate without a huge JWT denylist. |
| **Trade-off** | Permission changes take up to access TTL unless we keep a Redis `permver:{user}` bump checked in the guard (we **will**: JWT carries `pv` claim; mismatch → 401 refresh). |
| **Scale** | API pods share nothing. Refresh hits PG+Redis. |
| **Change later** | RS256 + JWKS when Auth is extracted; cookie domain vs SPA stored tokens as needed. |

---

## 13. RBAC and permission model

### Model

**Permission** is a triple: `module.resource.action`  
Examples: `sales.invoices.read`, `sales.invoices.post`, `inventory.stock.adjust`, `finance.journals.reverse`, `identity.users.invite`

**Role** is a named set of permissions, **scoped to an organization** (plus a few system roles).

**Grant** is `user + role + organization [+ optional branch]`.

There is no “permission on a single invoice” in v1 (ABAC later). Branch-scoped roles cover warehouse managers.

### Platform vs tenant

| Role | Scope | Notes |
| --- | --- | --- |
| `platform.super_admin` | none (no org) | SaaS operator only; still audited |
| `tenant.admin` | org | All permissions in that org except platform |
| `tenant.auditor` | org | Read + audit log read; no post |
| Module roles | org | `sales.manager`, `sales.clerk`, `inventory.manager`, `purchase.manager`, `finance.controller`, `hr.manager`, `crm.user` |

Seed permissions from `packages/shared/permissions.ts` — **code is the catalog**. DB is the assignment store. Deploy adds new permission rows; never rename codes (deprecate).

### Enforcement points

1. Nest `PermissionsGuard` metadata `@RequirePermission('sales.invoices.post')`
2. Use-case level for document ownership (branch, warehouse)
3. PostgreSQL RLS as **defense in depth** (`organization_id = current_setting('erp.organization_id')::uuid`)

Frontend hides buttons via the same catalog (never as the only check).

### Permission cache

Redis `perm:{orgId}:{userId}` = JSON string[] + version. Invalidate on `user_roles` / `role_permissions` writes (transaction + `DEL`).

---

## 14. Multi-tenancy strategy

**Pattern:** shared database, shared schemas, **row-level discriminator** `organization_id`.

```
Request
  → JWT `orgId` (or X-Organization-Id for members of many orgs, validated against membership)
  → CLS TenantContext
  → Prisma middleware sets `erp.organization_id` for RLS
  → every query auto-filters org
```

Switching org requires membership; it reissues access token with the new `orgId`.

### Isolation layers

| Layer | Mechanism |
| --- | --- |
| Auth | Token org must match membership `active` |
| App | Prisma extension: reject writes missing `organization_id`; auto-where on reads |
| DB | RLS policies `USING (organization_id = current_setting('erp.organization_id')::uuid)` |
| Storage | MinIO prefix `{organizationId}/...` |
| Cache | Org in every key |
| Events | `organizationId` required in envelope; consumers set tenant context before applying |

Platform tables (`users`, `permissions`) have no RLS org filter; `user_roles` do.

### Why shared-schema tenancy first

| | |
| --- | --- |
| **Why** | Fastest path to a real SaaS product; one migration story; workable until noisy-neighbor or enterprise contract demands isolation. |
| **Problem solved** | Every table is tenant-aware from day one — no retrofit. |
| **Trade-off** | A missing `WHERE` is an incident. RLS + middleware exist so that bug fails closed. |
| **Scale** | Thousands of SMBs fit. Very large tenants: schema-per-tenant or dedicated DB **as an operational tier**, not a rewrite — still the same module code if `TenantContext` is the only org source. |
| **Change later** | Schema-per-tenant is a pooling/routing change in the DB adapter. |

**Users are global** (email login once, many orgs). That is the correct SaaS identity model.

---

## 15. Audit logging architecture

Table `platform.audit_logs` is **append-only**:

| Column | Content |
| --- | --- |
| `id` | UUID v7 |
| `organization_id` | nullable for platform login events |
| `user_id` | actor |
| `action` | `create|update|delete|post|void|login|permission_change` |
| `module` | `sales` |
| `entity` | `SalesInvoice` |
| `entity_id` | UUID |
| `before` | JSONB NULL on create |
| `after` | JSONB NULL on delete |
| `ip`, `user_agent` | from request |
| `correlation_id` | CLS |
| `created_at` | clock |

**Writer:** interceptor / domain event auditor. Redact secrets. Do not store password hashes in `before/after`.

**Readers:** `tenant.auditor` and `tenant.admin`. **No UPDATE/DELETE** from the API. Postgres `REVOKE UPDATE, DELETE`. Retention job archives to object storage (GDPR later), never “edit history”.

Login/logout, role assignment, posting, void, stock adjust, period close are **mandatory** audits.

---

## 22. Security architecture (OWASP-aligned)

| Control | Implementation |
| --- | --- |
| Injection | Prisma parameterized; no raw SQL unless tagged `$queryRaw` with bound params + review |
| XSS | Next.js escaping; CSP headers; JSON API not HTML |
| CSRF | Cookie refresh: `SameSite` + CSRF double-submit or Bearer-only API from web with origin checks |
| CORS | Explicit origins from env |
| Authn/z | JWT + RBAC + RLS |
| Secrets | dotenv locally; sealed secrets/KMS in prod; **never** in git |
| Headers | Helmet: `HSTS`, `X-Content-Type-Options`, `Referrer-Policy`, disabled `X-Powered-By` |
| Size limits | Nest `rawBody` + JSON 1mb default; upload via MinIO presign, not API body |
| Rate limit | Redis: login strict, write APIs moderate, reads looser |
| SSRF | No user-controlled internal URLs in v1 |
| File upload | MIME allow-list, size cap, virus scan later, random keys |
| Dependencies | `pnpm audit` in CI |
| Privacy | Pino redact paths; encryption at rest via cloud disk + optional column encryption for national ids |

API keys for machine-to-machine later: hashed like passwords, scoped permissions, not JWTs with long TTL.

Admin actions on other tenants: **impossible** without platform role; platform role still cannot silently read tenant journals without audit.
