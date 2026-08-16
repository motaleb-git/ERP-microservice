-- Phase 2 identity, RBAC, organization structure, RLS.

ALTER TABLE identity.users
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TYPE organization."MembershipStatus" AS ENUM ('invited', 'active', 'disabled');
CREATE TYPE organization."FiscalStatus" AS ENUM ('open', 'closed');

CREATE TABLE identity.user_totp (
  user_id UUID PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL,
  verified_at TIMESTAMPTZ
);

CREATE TABLE identity.user_totp_backup_codes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX user_totp_backup_codes_user_idx ON identity.user_totp_backup_codes (user_id);

CREATE TABLE identity.sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  replaced_by_session_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip TEXT,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sessions_user_idx ON identity.sessions (user_id);
CREATE INDEX sessions_family_idx ON identity.sessions (family_id);

CREATE TABLE identity.login_attempts (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX login_attempts_email_created_idx ON identity.login_attempts (email, created_at);

CREATE TABLE identity.permissions (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE identity.roles (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organization.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX roles_org_code_idx ON identity.roles (organization_id, code);
CREATE UNIQUE INDEX roles_system_code_uidx ON identity.roles (code) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX roles_org_code_uidx ON identity.roles (organization_id, code) WHERE organization_id IS NOT NULL;

CREATE TABLE identity.role_permissions (
  role_id UUID NOT NULL REFERENCES identity.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES identity.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE identity.user_roles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES identity.roles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
  branch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX user_roles_org_user_idx ON identity.user_roles (organization_id, user_id);

CREATE TABLE organization.organization_members (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  status organization."MembershipStatus" NOT NULL DEFAULT 'invited',
  permission_version INTEGER NOT NULL DEFAULT 1,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE organization.branches (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  address_json JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (organization_id, code)
);

ALTER TABLE identity.user_roles
  ADD CONSTRAINT user_roles_branch_fk
  FOREIGN KEY (branch_id) REFERENCES organization.branches(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX user_roles_grant_uidx
  ON identity.user_roles (user_id, role_id, organization_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'));

CREATE TABLE organization.departments (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES organization.branches(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES organization.departments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (organization_id, code)
);

CREATE TABLE organization.designations (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (organization_id, code)
);

CREATE TABLE organization.fiscal_years (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status organization."FiscalStatus" NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on > starts_on)
);

CREATE TABLE organization.fiscal_periods (
  id UUID PRIMARY KEY,
  fiscal_year_id UUID NOT NULL REFERENCES organization.fiscal_years(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status organization."FiscalStatus" NOT NULL DEFAULT 'open',
  CHECK (ends_on > starts_on)
);

CREATE TABLE organization.business_settings (
  organization_id UUID PRIMARY KEY REFERENCES organization.organizations(id) ON DELETE CASCADE,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  quote_prefix TEXT NOT NULL DEFAULT 'QUO',
  inventory_negative_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for a future non-owner role. Table owner (current app user) bypasses RLS
-- unless FORCE is set; Prisma connection pooling is the reason FORCE waits.
-- Isolation is enforced in the Prisma tenant plugin.
ALTER TABLE organization.organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization.organization_members
  USING (
    current_setting('erp.user_id', true) = user_id::text
    OR (
      current_setting('erp.organization_id', true) IS NOT NULL
      AND current_setting('erp.organization_id', true) <> ''
      AND organization_id = current_setting('erp.organization_id', true)::uuid
    )
  );

ALTER TABLE organization.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization.branches
  USING (
    current_setting('erp.organization_id', true) IS NOT NULL
    AND current_setting('erp.organization_id', true) <> ''
    AND organization_id = current_setting('erp.organization_id', true)::uuid
  );

ALTER TABLE organization.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization.departments
  USING (
    current_setting('erp.organization_id', true) IS NOT NULL
    AND current_setting('erp.organization_id', true) <> ''
    AND organization_id = current_setting('erp.organization_id', true)::uuid
  );

ALTER TABLE organization.designations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization.designations
  USING (
    current_setting('erp.organization_id', true) IS NOT NULL
    AND current_setting('erp.organization_id', true) <> ''
    AND organization_id = current_setting('erp.organization_id', true)::uuid
  );

ALTER TABLE organization.fiscal_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization.fiscal_years
  USING (
    current_setting('erp.organization_id', true) IS NOT NULL
    AND current_setting('erp.organization_id', true) <> ''
    AND organization_id = current_setting('erp.organization_id', true)::uuid
  );

ALTER TABLE organization.fiscal_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization.fiscal_periods
  USING (
    current_setting('erp.organization_id', true) IS NOT NULL
    AND current_setting('erp.organization_id', true) <> ''
    AND organization_id = current_setting('erp.organization_id', true)::uuid
  );

ALTER TABLE organization.business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization.business_settings
  USING (
    current_setting('erp.organization_id', true) IS NOT NULL
    AND current_setting('erp.organization_id', true) <> ''
    AND organization_id = current_setting('erp.organization_id', true)::uuid
  );

ALTER TABLE identity.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON identity.user_roles
  USING (
    current_setting('erp.organization_id', true) IS NOT NULL
    AND current_setting('erp.organization_id', true) <> ''
    AND organization_id = current_setting('erp.organization_id', true)::uuid
  );

ALTER TABLE identity.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON identity.roles
  USING (
    organization_id IS NULL
    OR (
      current_setting('erp.organization_id', true) IS NOT NULL
      AND current_setting('erp.organization_id', true) <> ''
      AND organization_id = current_setting('erp.organization_id', true)::uuid
    )
  );

ALTER TABLE platform.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.audit_logs
  USING (
    organization_id IS NULL
    OR (
      current_setting('erp.organization_id', true) IS NOT NULL
      AND current_setting('erp.organization_id', true) <> ''
      AND organization_id = current_setting('erp.organization_id', true)::uuid
    )
  );
