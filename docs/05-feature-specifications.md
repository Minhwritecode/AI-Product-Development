# 3.5 Feature Specifications

## Quy ước chung

- ID feature dùng trong tickets, API và tests.
- Mọi API cần auth, RBAC, request ID và schema validation.
- Mọi quantity được convert về canonical stock unit trước khi mutation.
- Money dùng decimal/VND; không dùng floating point.
- Status transition phải là explicit command, không cho client sửa status tùy ý.

## F-01 Master Data

### Mục tiêu

Chuẩn hóa ingredient, unit conversion, menu item, recipe, supplier và branch.

### UI states

- List: search, filter active/inactive, pagination.
- Create/Edit: inline conversion preview, validation lỗi từng field.
- Recipe editor: line quantity/unit, estimated stock usage preview, version status.
- Empty/loading/error states bắt buộc.

### API surface

```text
GET    /api/v1/ingredients
POST   /api/v1/ingredients
PATCH  /api/v1/ingredients/:id
POST   /api/v1/ingredients/:id/deactivate
GET    /api/v1/suppliers
POST   /api/v1/suppliers
GET    /api/v1/branches
POST   /api/v1/branches
GET    /api/v1/menu-items/:id/recipe
PUT    /api/v1/menu-items/:id/recipe
```

### Acceptance notes

`conversion_rate > 0`; unit code thuộc catalog; ingredient referenced by transaction không hard-delete; recipe publish cần ingredient active.

## F-02 Purchase Order

### Mục tiêu

Tạo và theo dõi PO từ Draft đến Sent/Delivered.

### State machine

```text
Draft --send--> Sent --mark-delivered--> Delivered
Draft --cancel--> Cancelled
Sent  --cancel (policy)--> Cancelled
```

### Fields

`po_number`, `supplier_id`, `branch/warehouse_id`, `status`, `order_date`, `expected_delivery`, `currency`, `lines[]`, `notes`, `created_by`.

### API

```text
GET  /api/v1/purchase-orders?status=&supplier_id=
POST /api/v1/purchase-orders
GET  /api/v1/purchase-orders/:id
PATCH /api/v1/purchase-orders/:id
POST /api/v1/purchase-orders/:id/send
POST /api/v1/purchase-orders/:id/cancel
```

### Rules

- Draft mới được sửa.
- PO number unique theo tenant/branch policy.
- Unit price và quantity không âm; line ingredient active.
- Delivered không đồng nghĩa đã nhận đủ nếu partial receipt được bật; MVP cần chốt policy trước pilot.

## F-03 Goods Receipt

### Mục tiêu

Ghi nhận hàng thực nhận và tạo warehouse stock mutation an toàn.

### UI

PO detail hiển thị bảng `ordered / previously received / current receipt / total received / discrepancy`. Có field note, document reference, confirm modal.

### API

```text
POST /api/v1/purchase-orders/:id/receipts
GET  /api/v1/goods-receipts/:id
POST /api/v1/goods-receipts/:id/confirm
```

### Transaction

```text
BEGIN
  validate PO/status/idempotency
  insert goods_receipt + receipt_lines
  update warehouse_stock using canonical_qty
  append inventory_ledger event
  append audit_log
COMMIT
```

Rollback toàn bộ nếu bất kỳ line nào lỗi.

## F-04 Warehouse & Branch Stock

### Mục tiêu

Cho phép đọc tồn và bảo vệ mọi mutation.

### Read model

`stock_location`, `ingredient_id`, `qty_on_hand`, `stock_unit`, `low_stock_threshold`, `updated_at`.

### API

```text
GET /api/v1/stocks/warehouse?ingredient_id=
GET /api/v1/stocks/branches/:branchId
GET /api/v1/inventory-ledger?ingredient_id=&from=&to=
```

### Rules

- Không quantity âm ở MVP.
- Read không bypass branch scope.
- Ledger append-only; current stock có thể là projection nhưng phải reconcile được.

## F-05 Branch Stock Request

### State machine

```text
Requested → Approved → Shipped → Closed
    └──────────────→ Rejected
```

### API

```text
GET  /api/v1/stock-requests
POST /api/v1/stock-requests
POST /api/v1/stock-requests/:id/approve
POST /api/v1/stock-requests/:id/reject
POST /api/v1/stock-requests/:id/ship
POST /api/v1/stock-requests/:id/close
```

### Rules

- Branch Manager chỉ request branch mình.
- Rejection reason bắt buộc.
- Shipment ≤ available warehouse stock và ≤ policy max.
- Ship là transaction: decrement warehouse, increment branch, add ledger, audit.

## F-06 Daily Count & Wastage

### Input model

```text
count_date
branch_id
ingredient_id
opening_qty
received_qty
sold_qty_theory nullable
closing_qty_actual
variance_qty computed
wastage_lines[{qty, reason, note}]
```

### Formula

```text
variance_qty = opening_qty
             + received_qty
             - sold_qty_theory
             - closing_qty_actual
```

Nếu `sold_qty_theory` null, `variance_status = INCOMPLETE_THEORY` và không được diễn giải như variance chính xác.

### API

```text
GET  /api/v1/daily-counts?branch_id=&date=
POST /api/v1/daily-counts
POST /api/v1/daily-counts/:id/submit
POST /api/v1/daily-counts/:id/wastage
GET  /api/v1/wastage?branch_id=&ingredient_id=&from=&to=
```

### Rules

- Quantity không âm.
- Wastage reason required; standard price snapshot khi save.
- Duplicate active count cùng branch/date/ingredient bị chặn hoặc explicit revision.

## F-07 Dashboard

### KPI

1. Total warehouse stock value (nếu price available).
2. Low-stock ingredients.
3. Open/sent PO và receipt discrepancy.
4. Pending stock requests.
5. Wastage quantity/value theo date/branch/ingredient.

### API

```text
GET /api/v1/dashboard/summary?from=&to=&branch_id=
GET /api/v1/dashboard/wastage-breakdown?from=&to=&group_by=branch|ingredient
GET /api/v1/dashboard/low-stock?branch_id=
```

### Rules

- Dashboard result phải kèm `as_of`.
- Cache chỉ áp dụng read aggregate; mutation invalidate key liên quan.
- Drill-down dùng query API chính, không dựa độc quyền vào cache.

## F-08 AI Assistance

### AI Onboarding contract

Input:

```json
{
  "menuItemId": "menu_123",
  "text": "30g trà, 200ml sữa"
}
```

Output:

```json
{
  "suggestions": [
    {"ingredientName": "trà", "quantity": 30, "unit": "g", "confidence": 0.93},
    {"ingredientName": "sữa", "quantity": 200, "unit": "ml", "confidence": 0.91}
  ],
  "warnings": [],
  "requiresApproval": true
}
```

Pipeline: prompt/schema → parse → map to active ingredient/unit → warnings → UI review → backend revalidate → save.

### AI Copilot contract

```text
POST /api/v1/ai/copilot/query
{ question, date_range?, branch_id? }
```

Backend tạo authorized data view trước khi gọi model; model không được tự query DB. Response có `answer`, `metrics`, `sources`, `as_of`, `limitations`.

### Safety

- Không gửi password, token, payment detail hoặc raw PII.
- Log prompt metadata, không log secret.
- Unknown/low-confidence phải surfaced.
- Không có tool/function cho AI gọi mutation endpoint.

## F-09 FOH → BOH Integration Boundary

### MVP

Chỉ chuẩn bị entity/key: `MenuItem.pos_item_code`, recipe version, branch, sales event placeholder.

### Future contract

```text
POST /api/v1/integrations/pos/sales-import
Idempotency-Key: <external-batch-id>
```

Mapping cần `external_item_code`, `menu_item_id`, `recipe_version_id`, `sold_at`, `quantity`, `branch_id`. Unmapped item được quarantine/report, không tự trừ stock.

## F-10 Front-door QR Availability & Queue

### Goal

Giảm bất định cho khách trước cửa nhà hàng đông, đặc biệt khách du lịch không có account/app và có time budget rõ.

### Flow

```text
Scan standy QR
  → Choose language
  → Party size + time budget
  → Availability/wait range + as_of
  → View menu / Join queue / Ask staff
  → Queue code + notification option
  → Called / Seated / Left / Expired
```

### APIs

```text
GET  /api/v1/guest/front-door/status?location_id=
POST /api/v1/guest/queues
GET  /api/v1/guest/queues/:id
POST /api/v1/guest/queues/:id/leave
POST /api/v1/foh/queues/:id/call
POST /api/v1/foh/queues/:id/seat
POST /api/v1/foh/queues/:id/cancel
```

### Response contract

```json
{
  "status": "WAITING",
  "estimatedWait": {"min": 20, "max": 35, "unit": "minutes"},
  "queueSize": 6,
  "asOf": "2026-09-09T04:30:00Z",
  "confidence": "MEDIUM",
  "limitations": ["estimate uses recent service duration"]
}
```

### Product rules

- Estimate is a range, not a promise; never expose exact departure of another guest.
- If data stale beyond configured TTL, show stale state and staff fallback.
- Queue join requires party size/time budget; contact is conditional on notifications.
- Duplicate join/retry uses idempotency key.
- Guest can leave queue; no dark pattern or forced account creation.
- Host console can override status only with reason and audit.

### UX details

- Mobile-first, language choice before long copy.
- One primary CTA per state; secondary actions remain visible.
- Body text ≥16px, touch target ≥44px, visible labels and accessible status announcement.
- Empty/error/queue-full/stale states must provide next action.

## F-11 Table QR Add-on & Assistance

### Goal

Cho phép guest gọi thêm hoặc cần hỗ trợ mà không phải chờ tìm nhân viên, trong khi staff vẫn xác nhận và điều phối request.

### Flow

```text
Scan signed table QR
  → Confirm table/session
  → View menu / Add-on / Assistance
  → Review cart + note/allergen
  → Submit with idempotency key
  → Staff acknowledge → route → prepare → serve/recover
```

### APIs

```text
GET  /api/v1/guest/table-sessions/:token
GET  /api/v1/guest/table-sessions/:id/menu
POST /api/v1/guest/table-sessions/:id/add-on-requests
POST /api/v1/guest/table-sessions/:id/assistance-requests
GET  /api/v1/guest/requests/:id
POST /api/v1/foh/requests/:id/acknowledge
POST /api/v1/foh/requests/:id/route
POST /api/v1/foh/requests/:id/reject
POST /api/v1/foh/requests/:id/complete
```

### Request state machine

```text
SUBMITTED → ACKNOWLEDGED → ROUTED → PREPARING → SERVED
     └──────────────→ REJECTED / NEEDS_STAFF
```

### Security and integrity

- Token signed, short-lived/rotatable, không encode PII.
- Wrong/expired token không lộ menu/session data nhạy cảm.
- Backend re-check table/session and item availability.
- Retry same idempotency key returns same request, không tạo duplicate.
- Request không tạo payment, bill close hoặc stock mutation trực tiếp.
- Khi item unavailable, guest nhận message + alternative/staff help; không silently remove item.

### Hospitality details

- Confirmation copy phải nói “Nhân viên đã nhận yêu cầu” thay vì hứa “sẽ ra ngay”.
- Hiển thị time range và timestamp nếu có estimate.
- Có quick action gọi nhân viên, kể cả trong khi request đang pending.
- Không yêu cầu khách mô tả allergy trong một note tự do duy nhất; dùng field riêng + warning.

## Cross-cutting UI requirements

- Responsive cho desktop/tablet ở warehouse/branch.
- Table form hỗ trợ keyboard và clear error state.
- Confirmation cho stock mutation và AI approval.
- Hiển thị status badge, actor, timestamp, source record.
- Không dùng màu làm tín hiệu duy nhất; low stock/wastage cần text/icon.
- FOH QR có staff fallback, privacy-safe status và accessible form; QR là lựa chọn bổ trợ cho hospitality, không phải rào cản.
