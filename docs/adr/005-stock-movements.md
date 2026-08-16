# ADR-005: Stock movements as ledger, balances as transactional projection

**Status:** Accepted  
**Date:** 2026-08-16

## Context

Inventory must stay consistent under concurrent orders and receipts.

## Decision

Every quantity change is an immutable `stock_movement`. `stock_balances` updates in the same transaction under `SELECT FOR UPDATE`. Redis is never used to serialize stock. Costing method v1 is weighted average.

## Consequences

Reconstructable stock, obvious locking, possible hot-row contention on popular SKUs — addressed by warehouses and later extraction, not by eventual consistency.
