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

## Invariants

- FK references must exist and be active when creating a new transaction.
- Stock mutation and ledger event are atomic.
- Money precision is explicit (VND integer minor unit or decimal policy; choose one before migration).
- Historical record uses snapshot/version where business meaning can change.
