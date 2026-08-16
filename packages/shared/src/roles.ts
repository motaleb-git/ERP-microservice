import { PERMISSIONS, type PermissionCode } from "./permissions";

export const TENANT_ADMIN_CODE = "tenant.admin";
export const TENANT_AUDITOR_CODE = "tenant.auditor";

export const AUDITOR_PERMISSIONS = [
  "identity.users.read",
  "identity.roles.read",
  "identity.audit.read",
  "organization.settings.read",
  "finance.reports.read",
  "reports.dashboards.read",
  "reports.export",
] as const satisfies readonly PermissionCode[];

export const MODULE_ROLES: ReadonlyArray<{
  code: string;
  name: string;
  permissions: readonly PermissionCode[];
}> = [
  {
    code: "sales.manager",
    name: "Sales manager",
    permissions: [
      "sales.customers.read",
      "sales.customers.write",
      "sales.quotations.write",
      "sales.orders.confirm",
      "sales.invoices.post",
      "sales.payments.post",
      "sales.returns.post",
      "inventory.products.read",
      "inventory.stock.read",
      "reports.dashboards.read",
    ],
  },
  {
    code: "sales.clerk",
    name: "Sales clerk",
    permissions: [
      "sales.customers.read",
      "sales.customers.write",
      "sales.quotations.write",
      "inventory.products.read",
      "inventory.stock.read",
      "reports.dashboards.read",
    ],
  },
  {
    code: "inventory.manager",
    name: "Inventory manager",
    permissions: [
      "inventory.products.read",
      "inventory.products.write",
      "inventory.warehouses.write",
      "inventory.stock.read",
      "inventory.stock.adjust",
      "inventory.stock.transfer",
      "purchase.grn.post",
      "reports.dashboards.read",
    ],
  },
  {
    code: "purchase.manager",
    name: "Purchase manager",
    permissions: [
      "purchase.suppliers.write",
      "purchase.requisitions.approve",
      "purchase.orders.approve",
      "purchase.grn.post",
      "purchase.invoices.post",
      "inventory.products.read",
      "inventory.stock.read",
      "reports.dashboards.read",
    ],
  },
  {
    code: "finance.controller",
    name: "Finance controller",
    permissions: [
      "finance.accounts.write",
      "finance.journals.post",
      "finance.journals.reverse",
      "finance.periods.close",
      "finance.reports.read",
      "sales.payments.post",
      "purchase.invoices.post",
      "organization.fiscal.write",
      "reports.dashboards.read",
      "reports.export",
    ],
  },
  {
    code: "hr.manager",
    name: "HR manager",
    permissions: [
      "hr.employees.read",
      "hr.employees.write",
      "hr.attendance.write",
      "hr.leave.approve",
      "hr.payroll.run",
      "hr.payroll.post",
      "identity.users.read",
      "reports.dashboards.read",
    ],
  },
  {
    code: "crm.user",
    name: "CRM user",
    permissions: [
      "crm.leads.write",
      "crm.opportunities.write",
      "sales.customers.read",
      "reports.dashboards.read",
    ],
  },
];

export function tenantAdminPermissions(): PermissionCode[] {
  return [...PERMISSIONS];
}

export function permissionMeta(code: PermissionCode): { resource: string; action: string } {
  const parts = code.split(".");
  return {
    resource: parts.slice(0, -1).join("."),
    action: parts[parts.length - 1] ?? "",
  };
}
