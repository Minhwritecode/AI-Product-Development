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
CommandIdempotency ──< AuditLog
Restaurant ──< Branch ──< Area ──< Table
Guest ──< Reservation / QueueEntry
Table ──< ServiceSession ──< Order ──< OrderLine
OrderLine ──< StationTicket ──< TicketEvent
ServiceSession ──< Bill ──< BillLine ──< Payment ──< Refund
Staff ──< ShiftAssignment / AttendanceEvent / OperationalTask
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

### Restaurant, reservation and table

- `Restaurant`: `id`, `name`, `default_currency`, `default_locale`, `status`.
- `Area`: `id`, `branch_id`, `name`, `sort_order`, `status`.
- `Table`: `id`, `area_id`, `label`, `capacity`, `accessibility_tags`, `status`.
- `Reservation`: `id`, `branch_id`, `code`, `party_size`, `scheduled_start/end`,
  `status`, `contact_ref?`, `preference?`, `no_show_at?`, actor/timestamps.
- `ServiceSession`: `id`, `branch_id`, `table_id`, `reservation_id?`, `party_size`,
  `status`, `opened_at`, `payment_requested_at?`, `closed_at?`.

### Menu, order, station and serving

- `MenuVersion`: `id`, `branch_id?`, `effective_from/to`, `status`, `published_by`.
- `MenuItem`: `id`, `menu_version_id`, `category_id`, `name`, `price`, `station`,
  `pos_item_code?`, `availability`, `allergen_refs`.
- `ModifierSelection`: `order_line_id`, `modifier_id`, `option_id`, `price_delta`.
- `Order`: `id`, `service_session_id`, `round_no`, `status`, `source`, `created_by`,
  `sent_at?`, `served_at?`, `cancel_reason?`.
- `OrderLine`: `id`, `order_id`, `menu_item_id`, `menu_snapshot`, `qty`, `notes`,
  `allergen_note?`, `course`, `status`, `recipe_version_id?`.
- `StationTicket`: `id`, `order_line_id`, `station`, `status`, `priority`,
  `prepared_at?`, `picked_up_at?`, `served_at?`, `delay_reason?`, `reject_reason?`.
- `TicketEvent`: append-only status event with actor, timestamp and request ID.

### Bill, payment and staff operations

- `Bill`: `id`, `service_session_id`, `status`, price/tax/service-charge snapshots,
  `total`, `currency`, `opened_at`, `paid_at?`, `void_reason?`.
- `BillLine`: `id`, `bill_id`, `order_line_id?`, item/price/discount/tax snapshot,
  `allocated_amount`, `status`.
- `Payment`: `id`, `bill_id`, `method`, `status`, `amount`, `provider_ref?`,
  `idempotency_key`, `initiated_at`, `settled_at?`.
- `Refund`: `id`, `payment_id`, `amount`, `status`, `reason`, `provider_ref?`,
  `approved_by?`, timestamps.
- `Staff`: `id`, `user_id`, `branch_id`, `employment_status`, `station?`.
- `ShiftAssignment`: `shift_id`, `staff_id`, `role`, `station?`, `start/end`.
- `AttendanceEvent`: `staff_id`, `shift_id`, `type`, `occurred_at`, `source`;
  operational record only, không phải payroll calculation.

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
- `OperatingState`: `branch_id`, `state` (`OPEN/PAUSED/FULL/CLOSED`), `reason`, `effective_from`, `changed_by`.
- `TableToken`: `table_id`, `token_hash`, `issued_at`, `expires_at`, `revoked_at?`; raw token không lưu DB.
- `OperationalTask`: `source_type/id`, `branch_id`, `priority`, `owner_id?`, `due_at?`, `status`, `resolution_note`.
- `Notification`: `event_key`, `recipient/session`, `channel`, `status`, `attempt_count`, `expires_at`, `sent_at?`.
- `StockAdjustment`: `location_id`, `ingredient_id`, `qty_delta`, `reason`, `source_event_id?`, `approval_status`, `posted_event_id?`.
- `CommandIdempotency`: `actor_id`, `scope`, `endpoint`, `idempotency_key`, `request_hash`, `response_snapshot`, `created_at`, `expires_at`.

### Supporting records

- `AuditLog`: `id`, `branch_id?`, `actor_type/id`, `action`, `entity_type/id`,
  `request_id`, `before_snapshot?`, `after_snapshot?`, `reason?`, `occurred_at`.
- `SourceRecord`: `source_type`, `source_id`, `branch_id?`, `as_of`, `status`;
  dùng để liên kết dashboard/task/notification về bản ghi nghiệp vụ gốc.
- `ExternalEvent`: `provider`, `external_event_id`, `batch_id`, `payload_hash`,
  `mapping_status`, `quarantine_reason?`, `replayed_at?`; chỉ kích hoạt khi
  POS/import integration được mở ở milestone sau.

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
- Operating state, queue policy, membership and token lifecycle changes are
  effective-dated, branch-scoped and audited; a new configuration does not
  rewrite previously issued queue estimates or operational history.
- Idempotency keys are unique within their actor/endpoint or documented command
  scope; a reused key with a different request hash is a conflict, not a retry.
- `FOHRequest` is never a stock source event. Stock can change only through an
  authorized BOH command or a validated future integration event.
