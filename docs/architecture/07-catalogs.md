# RBAC catalog, notifications, reporting

Complements [04-security.md](./04-security.md) and [03-platform.md](./03-platform.md). Codes are stable; never rename — deprecate.

## Permission catalog (v1)

Format: `module.resource.action`

| Code | Typical roles |
| --- | --- |
| `identity.users.read` | tenant.admin, hr.manager |
| `identity.users.invite` | tenant.admin |
| `identity.users.disable` | tenant.admin |
| `identity.roles.read` | tenant.admin, tenant.auditor |
| `identity.roles.write` | tenant.admin |
| `identity.audit.read` | tenant.admin, tenant.auditor |
| `organization.settings.read` | tenant.admin |
| `organization.settings.write` | tenant.admin |
| `organization.branches.write` | tenant.admin |
| `organization.fiscal.write` | tenant.admin, finance.controller |
| `hr.employees.read` | hr.manager, tenant.admin |
| `hr.employees.write` | hr.manager |
| `hr.attendance.write` | hr.manager |
| `hr.leave.approve` | hr.manager |
| `hr.payroll.run` | hr.manager |
| `hr.payroll.post` | hr.manager, finance.controller |
| `inventory.products.read` | inventory.manager, sales.clerk, purchase.clerk |
| `inventory.products.write` | inventory.manager |
| `inventory.warehouses.write` | inventory.manager |
| `inventory.stock.read` | inventory.manager, sales.clerk |
| `inventory.stock.adjust` | inventory.manager |
| `inventory.stock.transfer` | inventory.manager |
| `sales.customers.read` | sales.clerk, sales.manager, crm.user |
| `sales.customers.write` | sales.clerk, sales.manager |
| `sales.quotations.write` | sales.clerk, sales.manager |
| `sales.orders.confirm` | sales.manager |
| `sales.invoices.post` | sales.manager |
| `sales.payments.post` | finance.controller, sales.manager |
| `sales.returns.post` | sales.manager |
| `purchase.suppliers.write` | purchase.manager |
| `purchase.requisitions.approve` | purchase.manager |
| `purchase.orders.approve` | purchase.manager |
| `purchase.grn.post` | inventory.manager, purchase.manager |
| `purchase.invoices.post` | purchase.manager, finance.controller |
| `finance.accounts.write` | finance.controller |
| `finance.journals.post` | finance.controller |
| `finance.journals.reverse` | finance.controller |
| `finance.periods.close` | finance.controller |
| `finance.reports.read` | finance.controller, tenant.auditor, tenant.admin |
| `crm.leads.write` | crm.user, sales.manager |
| `crm.opportunities.write` | crm.user, sales.manager |
| `reports.dashboards.read` | all authenticated members |
| `reports.export` | managers, tenant.auditor |

`tenant.admin` receives every org permission except platform.  
`platform.super_admin` is not an org role.

Frontend uses this same catalog from `packages/shared`. The API is the only enforcement point.

## Notification architecture

**Owns:** templates, in-app inbox, email outbox. **Does not own:** whether a document should exist.

### Channels

| Channel | Transport | Failure policy |
| --- | --- | --- |
| In-app | `notification.in_app_notifications` | Persist then fan-out via WebSocket/SSE later; v1 is pull |
| Email | BullMQ `email` → SMTP/SES | Retry 5s/30s/5m then DLQ |
| Future SMS/push | same dispatcher | Not Phase 1–8 |

### Flow

1. Domain posts (same TX as business write) emit outbox events.
2. Worker `notification.*` consumers are **idempotent** on `event.id`.
3. Render `notification_templates` with a sandboxed Mustache/Handlebars subset — **no eval**.
4. Insert in-app row; enqueue email job with `Idempotency-Key = event.id + channel`.

### Why async

Email latency and provider outages must not roll back an invoice post. The ledger is already committed; notification is a side effect.

**Trade-off:** user may see a posted invoice before the email. Acceptable.

**Scale:** Notification is the **first extraction candidate** — already queue-shaped.

**Change later:** replace SMTP with SES; in-app via a dedicated websocket service reading the same table.

Templates are tenant-overridable copies of system templates (`code` unique per org).

## Custom reporting architecture

Reporting **never** writes operational tables.

### Layers

1. **OLTP queries** — Phase 6 financial statements (TB/P&L/BS/CF) from `journal_lines` with period filters. Indexed; acceptable for interactive use at SMB scale.
2. **Event projections** — `reporting.*` consumers maintain dashboard snapshots (`reporting.dashboard_snapshots`) keyed `(organization_id, widget, period)`.
3. **Snapshots** — BullMQ nightly materializes sales/purchase/inventory/HR fact tables in schema `reporting`.
4. **Exports** — async job → MinIO CSV/XLSX; poll download URL.
5. **Saved reports** — `reporting.saved_reports`: name, query spec (whitelist of metrics/dimensions), not free SQL.

### Why no free SQL designer in v1

Tenant SQL against OLTP is a security and load hazard. Whitelisted specs keep tenancy and indexes under control.

**Trade-off:** less flexibility than Metabase. Phase 9 can add a read-replica + optional BI embed.

**Scale:** replica → warehouse (ClickHouse/BigQuery) without changing module APIs; consumers already depend on events, not live joins across all domains.

**Change later:** extract Reporting service onto the replica; keep snapshot schema.

### v1 reports

- Dashboard: revenue, open AR/AP, stock valuation, pending POs, attendance today
- Sales: by customer, product, period, invoice aging
- Purchase: by supplier, GRN vs bill variance
- Inventory: on-hand, movement, adjustment, dead stock
- HR: headcount, leave, payroll totals
- Finance: TB, P&L, BS, cash flow, AR/AP reconciliation vs GL

## Table checklist (all schemas)

Identity: `users`, `user_totp`, `user_totp_backup_codes`, `sessions`, `login_attempts`, `permissions`, `roles`, `role_permissions`, `user_roles`  
Organization: `organizations`, `organization_members`, `branches`, `departments`, `designations`, `fiscal_years`, `fiscal_periods`, `business_settings`  
HR: `employees`, `employee_profiles`, `holidays`, `leave_types`, `leave_balances`, `leave_requests`, `attendance_records`, `salary_structures`, `salary_components`, `employee_salary`, `payroll_runs`, `payroll_items`, `employee_documents`  
Inventory: `categories`, `brands`, `units`, `products`, `warehouses`, `stock_balances`, `stock_movements`, `stock_adjustments`, `stock_adjustment_lines`, `stock_transfers`, `stock_transfer_lines`  
Sales: `customers`, `sales_quotations`, `sales_quotation_lines`, `sales_orders`, `sales_order_lines`, `shipments`, `shipment_lines`, `sales_invoices`, `sales_invoice_lines`, `sales_returns`, `sales_return_lines`  
Purchase: `suppliers`, `purchase_requisitions`, `pr_lines`, `purchase_orders`, `po_lines`, `goods_receipts`, `grn_lines`, `purchase_invoices`, `purchase_invoice_lines`, `purchase_returns`, `purchase_return_lines`  
Finance: `accounts`, `tax_codes`, `journal_entries`, `journal_lines`, `payments`, `payment_allocations`, `bank_accounts`, `document_sequences`  
CRM: `leads`, `opportunities`, `activities`, `follow_ups`  
Notification: `notification_templates`, `in_app_notifications`, `email_messages`  
Reporting: `dashboard_snapshots`, `saved_reports`  
Platform: `outbox_events`, `inbox_messages`, `idempotency_keys`, `audit_logs`, `file_objects`

Column-level definitions: [02-data-model.md](./02-data-model.md).
