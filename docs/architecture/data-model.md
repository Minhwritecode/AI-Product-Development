# Data Model Baseline

## Core entities

```text
User ──< UserRole >── Role
User ──< BranchMembership >── Branch
Supplier ──< PurchaseOrder ──< PurchaseOrderLine >── Ingredient
PurchaseOrder ──< GoodsReceipt ──< GoodsReceiptLine >── Ingredient
WarehouseStock ──< InventoryLedger >── Ingredient
Branch ──< StockRequest ──< StockRequestLine >── Ingredient
Branch ──< BranchStock >── Ingredient
MenuItem ──< RecipeVersion ──< RecipeLine >── Ingredient
Branch ──< DailyCount ──< WastageLine >── Ingredient
All mutations ──< AuditLog
GuestSession ──< QueueEntry >── QueuePolicy
GuestSession ──< FOHRequest >── TableSession
Branch ──< BranchConfig / OperatingState / QueuePolicy
Branch ──< TableConfig ──< TableToken
StockLocation ──< StockAdjustment ──< InventoryLedger
SourceRecord ──< OperationalTask / Notification
```

## Required fields

### Ingredient

`id`, `name`, `purchase_unit`, `stock_unit`, `recipe_unit`, `purchase_to_stock_rate`, `recipe_to_stock_rate`, `standard_price`, `low_stock_threshold`, `status`.

### MenuItem / Recipe

`menu_item_id`, `pos_item_code?`, `recipe_version`, `ingredient_id`, `qty_per_unit`, `recipe_unit`, `status`, `effective_from`.

### PurchaseOrder / Receipt

`id`, `supplier_id`, `warehouse_id`, `status`, `order_date`, `expected_delivery`, `idempotency_key?`, line quantity/price, received quantity, discrepancy.

### Stock

`location_type`, `location_id`, `ingredient_id`, `qty_on_hand`, `stock_unit`, `updated_at` plus append-only ledger event.

### Request

`branch_id`, `status`, `urgency`, `needed_by`, `requested_by`, `approved_by?`, `rejected_reason?`, requested/shipped quantity.

### DailyCount / Wastage

`branch_id`, `count_date`, `ingredient_id`, `opening_qty`, `received_qty`, `sold_qty_theory?`, `closing_qty_actual`, `variance_qty`, `variance_status`; wastage line includes `qty`, `reason`, `standard_price_snapshot`, `value`.

### FOH Guest / Queue / Request

- `GuestSession`: `id`, `locale`, `consent/notification_preference`, `expires_at`, `created_at`; không chứa PII mặc định.
- `QueueEntry`: `id`, `location_id`, `session_id`, `party_size`, `time_budget_min/max`, `status`, `estimated_wait_min/max`, `as_of`, `created_at`, `called_at?`, `seated_at?`.
- `TableSession`: `id`, `table_id`, `signed_token_hash`, `status`, `expires_at`.
- `FOHRequest`: `id`, `table_session_id`, `type` (`ADD_ON`/`ASSISTANCE`), `lines`, `note`, `allergen_note?`, `status`, `idempotency_key`, `acknowledged_by?`, `routed_to?`, timestamps.

FOH request does not directly close a bill, process payment or mutate stock; it becomes an operational signal after staff acknowledgement.

### Operational configuration and controls

- `BranchConfig`: `branch_id`, `timezone`, `currency`, `service_hours`, `status`, `effective_from`.
- `WarehouseLocation`: `id`, `branch_id?`, `location_type`, `status`, `scope`.
- `TableConfig`: `id`, `branch_id`, `label`, `capacity`, `accessibility_tags`, `status`.
- `QueuePolicy`: `branch_id`, `party_size_min/max`, `capacity`, `wait_ttl`, `time_budget_options`, `effective_from`.
- `TableToken`: `table_id`, `token_hash`, `issued_at`, `expires_at`, `revoked_at?`; raw token không lưu DB.
- `OperationalTask`: `source_type/id`, `branch_id`, `priority`, `owner_id?`, `due_at?`, `status`, `resolution_note`.
- `Notification`: `event_key`, `recipient/session`, `channel`, `status`, `attempt_count`, `expires_at`, `sent_at?`.
- `StockAdjustment`: `location_id`, `ingredient_id`, `qty_delta`, `reason`, `source_event_id?`, `approval_status`, `posted_event_id?`.

## Invariants

- FK references must exist and be active when creating a new transaction.
- Stock mutation and ledger event are atomic.
- Money precision is explicit (VND integer minor unit or decimal policy; choose one before migration).
- Historical record uses snapshot/version where business meaning can change.
- Queue estimates are historical/operational projections, not a promise about a specific guest departure.
- Guest can leave queue and expired QR tokens cannot access a table session.
- Operating-state and queue-policy changes are effective-dated and audited; history is not rewritten.
- Posted ledger events are immutable; corrections reference the original event through a compensating event.
- Notification failure never changes the source business status; delivery and retry are separately observable.
