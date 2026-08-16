-- Phase 1 platform spine: schemas, identity/org stubs, outbox, inbox, audit.

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS organization;
CREATE SCHEMA IF NOT EXISTS platform;

CREATE TYPE organization."OrganizationStatus" AS ENUM ('trial', 'active', 'suspended', 'closed');

CREATE TABLE identity.users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE organization.organizations (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status organization."OrganizationStatus" NOT NULL DEFAULT 'trial',
  base_currency CHAR(3) NOT NULL DEFAULT 'BDT',
  timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE platform.outbox_events (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organization.organizations(id),
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload_jsonb JSONB NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  publish_attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX outbox_events_unpublished_idx
  ON platform.outbox_events (created_at)
  WHERE published_at IS NULL;

CREATE INDEX outbox_events_created_at_idx
  ON platform.outbox_events (created_at);

CREATE TABLE platform.inbox_messages (
  event_id TEXT NOT NULL,
  consumer_name TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, consumer_name)
);

CREATE TABLE platform.idempotency_keys (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  actor_id UUID,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json JSONB,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, key)
);

CREATE TABLE platform.audit_logs (
  id UUID PRIMARY KEY,
  organization_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  before JSONB,
  after JSONB,
  ip TEXT,
  user_agent TEXT,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_org_created_idx
  ON platform.audit_logs (organization_id, created_at DESC);

CREATE INDEX audit_logs_entity_idx
  ON platform.audit_logs (entity, entity_id);

REVOKE UPDATE, DELETE ON platform.audit_logs FROM PUBLIC;

CREATE TABLE platform.file_objects (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
