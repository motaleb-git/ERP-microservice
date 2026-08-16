# 16–17. Financial transactions and inventory consistency

These two domains are why this is an ERP, not a dashboard over tables.

## 16. Financial transaction architecture

### Principles

1. **Double-entry only.** Every posted journal has `Σ debit = Σ credit` and at least two lines.
2. **Documents ≠ books.** Invoice POST *creates* a journal. Editing a posted invoice is forbidden.
3. **Immutability.** Posted `journal_entries` / `journal_lines` are not UPDATEd. Corrections = **reversal journal** + optional new posting.
4. **Same database transaction** as the commercial document that posted them (while we are a modular monolith).
5. **Period control.** Posting date must fall in an **open** fiscal period.
6. **Idempotency.** `POST /invoices/:id/post` with `Idempotency-Key` / unique `journal_entry_id` on the document.
7. **Money types.** `NUMERIC`, never `float`. Tenant `base_currency`; document currency + `fx_rate` stored; lines in **document currency**; reporting in base via stored `base_amount` on each journal line (computed at post time). Phase 2 may be single-currency, but **columns exist from the start**.

### Account map (seed per tenant)

A system COA template is copied at organization creation (same TX):

| Code (example) | Name | Type |
| --- | --- | --- |
| 1000 | Cash | asset |
| 1010 | Bank | asset |
| 1100 | Accounts Receivable | asset |
| 1200 | Inventory | asset |
| 2000 | Accounts Payable | liability |
| 2100 | Tax Payable | liability |
| 3000 | Equity | equity |
| 4000 | Sales Revenue | revenue |
| 4100 | Sales Returns | revenue (contra) |
| 5000 | COGS | expense |
| 5100 | Operating Expense | expense |

Tenants can extend; system accounts are flagged `is_system` and cannot be deleted if referenced.

### Posting recipes (always journals)

**Sales invoice posted (accrual)**  
- Dr AR `grand_total`  
- Cr Revenue `net`  
- Cr Tax Payable `tax`

**Customer payment**  
- Dr Cash/Bank `amount`  
- Cr AR `amount`  
Then allocate payment to invoices (sub-ledger, not extra GL if already on AR control account).

**Purchase invoice posted**  
- Dr Inventory or Expense (depending on receipt-already-capitalized policy — see below)  
- Dr Tax Recoverable  
- Cr AP

**Standard for this product (recommended):**

- **Goods receipt** Dr Inventory / Cr GRNI (goods received not invoiced)  
- **Purchase invoice** Dr GRNI / Dr Tax / Cr AP  
- **Payment** Dr AP / Cr Bank  

This keeps stock and books aligned.

**Stock adjustment write-off**  
- Dr Adjustment expense  
- Cr Inventory  

**COGS on shipment (optional Phase 6, design now):**  
weighted average cost * qty shipped  
- Dr COGS  
- Cr Inventory  

Until Phase 6, we may ship stock **without** COGS if Finance is not live; flag `finance.cogs_on_ship = false` in settings. The movement still stores `unit_cost` so backfill is possible.

**Payroll confirmed**  
- Dr Salary expense  
- Cr Tax withheld  
- Cr Salary payable  
(Payment later clears payable.)

### Reversal

`POST /finance/journals/:id/reverse` creates a new posted journal with swapped debit/credit, `reversal_of_id` set, original remains. Source document status → `reversed` / `void` per type. You cannot reverse a reversal (reverse the reverse by posting a new document).

### Sub-ledgers

AR and AP are **not** separate GL systems. They are:

- open invoices (`grand_total - amount_paid`)
- payment allocations
- GL control accounts that **must** reconcile (report: AR trial vs 1100 balance)

A nightly (BullMQ) reconciliation job alerts on drift — drift is a **P0 defect**.

### Concurrency

Posting:

```
BEGIN
  SELECT invoice FOR UPDATE
  assert draft
  assert period open
  lock sequence
  insert journal + lines
  assert balanced
  update invoice posted + journal_entry_id
  insert outbox
COMMIT
```

| | |
| --- | --- |
| **Why double-entry + immutability** | Auditability, accountant trust, legal reconstruction of books. |
| **Trade-off** | More tables and stricter UX (you cannot “just edit” a posted invoice). |
| **Scale** | Partition journals by month; reporting replica; never sharded by random UUID without org prefix thinking. |
| **Change later** | Finance service with a posting API; documents send `PostingRequest` instead of writing journal tables. |

---

## 17. Inventory consistency strategy

### Source of truth

**`stock_movements` is the ledger. `stock_balances` is a transactional projection** updated in the **same** statement batch.

Invariant:

```
qty_on_hand = SUM(signed movement qty)   -- reconcilable
qty_reserved = SUM(reserve) - SUM(release) - SUM(issues that consumed reservation)
```

A BullMQ job can rebuild a balance from movements if drift is detected. UI and reservation still use `stock_balances` with `FOR UPDATE`.

### Signed quantity convention

Store `qty > 0` + `type`. Application converts to signed:

| Type | Sign on on_hand | Sign on reserved |
| --- | --- | --- |
| receipt / transfer_in / adjust_in / return_in | + | 0 |
| issue / transfer_out / adjust_out | − | 0 or −reserved if consuming reservation |
| reserve | 0 | + |
| release | 0 | − |

CHECK: `qty > 0`. CHECK: `qty_on_hand >= 0`, `qty_reserved >= 0`, `qty_on_hand >= qty_reserved` when negatives disallowed.

### Sales flow (stock)

1. SO confirm → **reserve** at warehouse (fail if insufficient available)  
2. Shipment post → **issue** + **release** reservation (same lines)  
3. Cancel SO → **release** remaining reservation  

Never decrement on_hand at confirm; that causes false stockouts versus physical goods.

### Purchase flow (stock)

1. GRN post → **receipt** at warehouse, `unit_cost` from PO  
2. Update weighted average on product/warehouse (in same TX):

```
new_avg = (old_qty * old_avg + recv_qty * recv_cost) / (old_qty + recv_qty)
```

`old_qty = 0` → `new_avg = recv_cost`.

3. Purchase return → **issue** with cost = current avg (or layer — v1 is **weighted average only**)

### Transfers

One TX: `transfer_out` source + `transfer_in` dest, same `transfer_id`. Draft transfers do nothing to stock. In-transit: optional warehouse `IN_TRANSIT` (Phase 3: skip in-transit; complete atomically).

### Adjustments

Count vs system: post adjustment document → movements → optional finance journal.

### Concurrency

```
SELECT stock_balances WHERE product AND warehouse FOR UPDATE
-- or INSERT balance if missing (single unique constraint, retry on conflict)
```

**Do not use Redis locks for this.** Two API pods + PG row lock is the correct serialiser.

### Idempotency

A GRN cannot post twice (`status` + unique posted movement `source_type+source_id+line+type`).

| | |
| --- | --- |
| **Why movement+balance together** | Fast reads (balance) + reconstructability (movements) + no event-sourced complexity. |
| **Trade-off** | Must update two places in one TX; reconcilers needed. |
| **Scale** | Hot products: row lock contention — mitigate with warehouse split, not with eventual consistency. |
| **Change later** | Inventory service with Reserve/Receive/Ship RPC; Sales stores reservation ids, not quantities alone. |

---

## Critical workflows (end-to-end, monolith TX boxes)

### Sales

```
Customer
  → Quotation (draft/send/accept)
  → Sales Order
      [TX] confirm: reserve stock
  → Shipment
      [TX] post: issue stock [+ COGS journal if enabled]
  → Invoice
      [TX] post: AR/revenue/tax journal
  → Payment
      [TX] post: cash/AR journal + allocations
```

Partial invoice / partial ship: quantities on lines; status `partially_*`.

### Purchase

```
Supplier
  → Requisition (approve)
  → Purchase Order (approve/send)
  → Goods Receipt
      [TX] post: receipt stock + GRNI journal
  → Purchase Invoice
      [TX] post: GRNI clear + AP + tax
  → Payment
      [TX] post: AP/bank + allocations
```

### Failures

Any step throws → TX abort → **no outbox row**. User retries. If worker consumes a duplicate event later, inbox suppresses side effects.

---

## Document state machines (authoritative)

**Sales order:** `draft → confirmed → partially_fulfilled → fulfilled`; `→ cancelled` (release stock) from draft/confirmed with zero shipped.

**Sales invoice:** `draft → posted → (partially_paid|paid)`; `posted → void` only via reversal path if unpaid; paid invoices reversed via credit note.

**Journal:** `draft → posted`; `posted → reversed` (new row). Close **not** a journal status; **period** closes.

**Stock document (GRN, shipment, adjustment, transfer):** `draft → posted → cancelled` (cancel = reverse movements if policy allows; Phase 3: cancel only before post).
