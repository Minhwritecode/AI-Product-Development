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

## F-12 Operational Configuration & Access

### Mục tiêu

Cung cấp nguồn cấu hình chính thức cho branch/warehouse/table/queue và quyền truy cập, để F-04, F-10 và F-11 không phụ thuộc vào dữ liệu hard-code.

### Core resources

`BranchConfig`, `WarehouseLocation`, `TableConfig`, `QueuePolicy`, `OperatingState`, `User`, `Role`, `BranchMembership`, `TableToken`.

### API

```text
GET/PATCH /api/v1/branches/:id/config
GET/POST  /api/v1/warehouses
GET/POST  /api/v1/branches/:id/tables
PATCH     /api/v1/branches/:id/operating-state
GET/PATCH /api/v1/branches/:id/queue-policy
POST      /api/v1/tables/:id/token/rotate
POST      /api/v1/tables/:id/token/revoke
GET/POST  /api/v1/users
POST      /api/v1/users/:id/deactivate
PUT       /api/v1/users/:id/memberships
```

### Rules

- Branch/table/warehouse phải active mới được dùng cho transaction mới.
- `OPEN`, `PAUSED`, `FULL`, `CLOSED` là explicit command; manual override cần reason và audit.
- Queue policy có effective time, TTL và capacity; không sửa ngược estimate đã phát hành.
- Token được lưu dạng hash/rotation metadata, không chứa PII; token revoked/expired trả lỗi generic.
- User/role/membership mutation chỉ Admin được thực hiện; mọi endpoint vẫn re-check scope ở backend.

## F-13 Notifications & Operational Task Inbox

### Mục tiêu

Biến notification và yêu cầu vận hành thành side effect có quan sát được, có owner và có đường retry/fallback.

### Data model

`Notification(id, recipient/session, channel, event_type, status, attempt_count, next_attempt_at, sent_at, expires_at)`.

`OperationalTask(id, source_type, source_id, branch_id, priority, owner_id, due_at, status, resolution_note)`.

### API

```text
GET  /api/v1/notifications/:id
POST /api/v1/notifications/:id/retry
GET  /api/v1/operational-tasks?status=&owner_id=&branch_id=
POST /api/v1/operational-tasks/:id/claim
POST /api/v1/operational-tasks/:id/route
POST /api/v1/operational-tasks/:id/resolve
```

### Rules

- Notification failure không rollback queue/request; retry bounded và idempotent theo event key.
- Guest notification chỉ gửi sau consent; contact data có retention/expiry policy.
- Task được tạo từ QR/queue/exception theo policy, không tự coi là resolved khi quá hạn.
- Staff chỉ đọc/claim task trong branch scope; route/reject cần audit.

## F-14 Stock Correction, Approval & Reconciliation

### Mục tiêu

Cho phép sửa sai có kiểm soát mà vẫn bảo toàn ledger, audit và khả năng đối soát.

### State and commands

```text
Adjustment: DRAFT → SUBMITTED → APPROVED → POSTED
                         └──────→ REJECTED
Count/Wastage: SUBMITTED → APPROVED/REJECTED → LOCKED
Shipment: APPROVED → IN_TRANSIT → RECEIVED | DISCREPANCY
```

```text
POST /api/v1/stock-adjustments
POST /api/v1/stock-adjustments/:id/submit
POST /api/v1/stock-adjustments/:id/approve
POST /api/v1/stock-adjustments/:id/reject
POST /api/v1/stock-adjustments/:id/post
POST /api/v1/stock-requests/:id/receive
GET  /api/v1/reconciliation/inventory?from=&to=&location_id=
```

### Rules

- Ledger event đã posted là immutable; adjustment/reversal tạo compensating event liên kết `source_event_id`.
- Adjustment phải có reason, actor, source record; vượt threshold cần approver khác người tạo.
- Partial receipt/shipment tách accepted, damaged, rejected, in-transit và backordered quantity.
- Reconciliation hiển thị opening + ledger events + closing, unresolved discrepancy, owner và last action.

## F-15 Import, Export & Integration Reliability

### Mục tiêu

Đưa dữ liệu thực tế vào hệ thống và xử lý lỗi tích hợp mà không làm sai tồn hoặc theoretical usage.

### API

```text
POST /api/v1/imports/:resource/preview
POST /api/v1/imports/:resource/commit
GET  /api/v1/imports/:id/errors
GET  /api/v1/exports/:resource
GET  /api/v1/integrations/pos/batches/:id
POST /api/v1/integrations/pos/batches/:id/replay
GET  /api/v1/integrations/reconciliation?batch_id=
```

### Rules

- Preview bắt buộc kiểm tra schema, unit, reference, duplicate và branch scope trước commit.
- Commit có row-level error report và transaction policy rõ; không silently bỏ dòng lỗi.
- Unmapped/invalid POS event vào quarantine; replay theo external event ID và không duplicate ledger/usage.
- Export giữ filter, authorization scope, timezone, `as_of` và liên kết source record.

## Cross-cutting UI requirements

- Responsive cho desktop/tablet ở warehouse/branch.
- Table form hỗ trợ keyboard và clear error state.
- Confirmation cho stock mutation và AI approval.
- Hiển thị status badge, actor, timestamp, source record.
- Không dùng màu làm tín hiệu duy nhất; low stock/wastage cần text/icon.
- FOH QR có staff fallback, privacy-safe status và accessible form; QR là lựa chọn bổ trợ cho hospitality, không phải rào cản.
- Admin/manager screens phải có operating state, policy effective time, actor/reason và audit link.
- Inbox phải phân biệt unread/overdue/failed; retry action hiển thị lần thử cuối và lý do lỗi.
- Correction/reconciliation screens phải hiển thị record gốc, compensating event, before/after và quyền approve.

## Production feature specifications

Các feature F-16 trở đi mở rộng Luminex từ BOH Core + FOH Lite thành full
restaurant operations production. Chúng dùng chung auth, branch scope, audit,
idempotency và API conventions ở phần đầu file.

## F-16 Reservation, Walk-in & Queue

### State machine

```text
Reservation: DRAFT → PENDING → CONFIRMED → ARRIVED → SEATED → COMPLETED
                         └→ CANCELLED / NO_SHOW
WalkIn/Queue: WAITING → CALLED → SEATED → COMPLETED
                    └→ LEFT / EXPIRED / CANCELLED
```

### API

```text
GET  /api/v1/availability?branch_id=&date=&party_size=
POST /api/v1/reservations
POST /api/v1/reservations/:id/confirm
POST /api/v1/reservations/:id/arrive
POST /api/v1/reservations/:id/cancel
POST /api/v1/reservations/:id/no-show
POST /api/v1/queues
POST /api/v1/queues/:id/call
POST /api/v1/queues/:id/leave
```

### Rules

- Availability tính theo service hours, table capacity, holds, blocked tables và
  policy; không assign table dirty/maintenance.
- Reservation contact/PII chỉ hiện đúng scope; no-show/cancel/reschedule cần
  policy và audit.
- Front-door QR và Host walk-in dùng chung queue policy/read model.
- Wait là range + `as_of`; không cam kết table turnover của khách cụ thể.

## F-17 Floor, Table, Seating & Cleaning

### Table states

```text
AVAILABLE → HELD/RESERVED → READY → IN_USE → PAYMENT_PENDING
           → WAITING_CLEANING → CLEANING → READY
```

### API

```text
GET  /api/v1/branches/:branch_id/tables
POST /api/v1/service-sessions
POST /api/v1/service-sessions/:id/seat
POST /api/v1/service-sessions/:id/transfer
POST /api/v1/service-sessions/:id/merge
POST /api/v1/tables/:id/cleaning-tasks
POST /api/v1/cleaning-tasks/:id/claim
POST /api/v1/cleaning-tasks/:id/complete
```

### Rules

- Seating tạo `ServiceSession` và actor/table/party snapshot.
- Transfer/merge giữ source history, order/bill links và không clone financial
  record.
- Paid session tạo cleaning task; table chỉ `READY` sau staff confirmation.
- Cleaning priority được nâng khi có waiting guest nhưng không bypass vệ sinh.

## F-18 Menu, Price, Modifier & Station Catalog

### Core model

`MenuCategory`, `MenuItem`, `MenuVersion`, `ModifierGroup`, `ModifierOption`,
`Allergen`, `RecipeVersion`, `StationAssignment`, `AvailabilityWindow`.

### API

```text
GET/POST /api/v1/menu/categories
GET/POST /api/v1/menu/items
PATCH    /api/v1/menu/items/:id
POST     /api/v1/menu/items/:id/publish
POST     /api/v1/menu/items/:id/unpublish
GET/PUT  /api/v1/menu/items/:id/modifiers
GET/PUT  /api/v1/menu/items/:id/station
```

### Rules

- Published menu/price/modifier có effective time; order lưu snapshot.
- Item unavailable không thể gửi mới; item đã gửi vẫn giữ lịch sử và cần
  staff-recovery nếu kitchen/bar không thể làm.
- Allergen là field riêng, không phụ thuộc note tự do.
- Recipe đổi version không được tính lại sales lịch sử.

## F-19 Service Session & Order Entry

### State machine

```text
ServiceSession: OPEN → ACTIVE → PAYMENT_REQUESTED → CLOSED
Order: DRAFT → SENT → IN_PROGRESS → PARTIALLY_SERVED → SERVED → CLOSED
       └→ CANCELLED (authorized reason)
```

### API

```text
GET  /api/v1/service-sessions/:id
POST /api/v1/service-sessions/:id/orders
PATCH /api/v1/orders/:id
POST /api/v1/orders/:id/send
POST /api/v1/order-lines/:id/cancel
POST /api/v1/service-sessions/:id/payment-request
```

### Rules

- Server chỉ đọc/ghi session được assign hoặc branch scope theo policy.
- Draft order có round, quantity, modifier, item/allergen note và course policy.
- `send` tạo ticket snapshot; sau send không sửa im lặng, thay đổi phải command
  có reason và audit.
- Guest table QR add-on đi qua cùng order/request boundary nhưng bắt đầu ở
  `SUBMITTED`, cần staff acknowledge trước khi thành operational order.

## F-20 Kitchen & Bar Station Tickets

### State machine

```text
NEW → ACCEPTED → PREPARING → READY → PICKED_UP → SERVED
 └→ DELAYED / REJECTED (reason)
```

### API

```text
GET  /api/v1/stations/:station/tickets?status=
POST /api/v1/tickets/:id/accept
POST /api/v1/tickets/:id/start
POST /api/v1/tickets/:id/delay
POST /api/v1/tickets/:id/complete
POST /api/v1/tickets/:id/reject
POST /api/v1/tickets/:id/pick-up
```

### Rules

- Kitchen chỉ thấy food ticket; Bar chỉ thấy beverage ticket; Server thấy task
  handoff cần thiết; payment data không được leak.
- Delay/reject cần reason và tạo task/notification cho Server/Manager.
- Station không tự sửa order price, payment hoặc inventory ledger.
- Multi-station item được biểu diễn bằng ticket components, không tạo duplicate order.

## F-21 Serving & Additional Orders

### Mục tiêu

Theo dõi từ station hoàn tất tới server nhận và phục vụ, đồng thời giữ các round
order riêng để đo delay và hiểu trải nghiệm khách.

### Rules

- Ghi `prepared_at`, `picked_up_at`, `served_at`, `delay_reason` và actor.
- `serve together`/course policy giữ item chờ hợp lệ; không đánh mất ticket đã ready.
- Additional order tạo round mới trong cùng session/bill và route lại theo station.
- Guest/Server nhận status guest-safe; không hứa thời gian nếu chưa có estimate.

## F-22 Billing, Discount & Split Bill

### State machine

```text
Bill: OPEN → REVIEW → PARTIALLY_PAID → PAID
      └→ VOIDED / REFUND_PENDING
```

### API

```text
POST /api/v1/service-sessions/:id/bills
GET  /api/v1/bills/:id
POST /api/v1/bills/:id/review
POST /api/v1/bills/:id/apply-discount
POST /api/v1/bills/:id/split
POST /api/v1/bills/:id/void
```

### Rules

- Bill snapshot item price, tax, service charge, discount và source order line.
- Split theo item/guest/equal/custom phải bảo toàn tổng và không tạo orphan line.
- Discount vượt threshold cần Manager approval; paid bill không PATCH trực tiếp.
- Void/refund là compensating financial event, có original reference, reason và audit.

## F-23 Payments, Refunds, Receipts & End-of-Day

### Payment lifecycle

```text
INITIATED → PENDING → SUCCEEDED
                    └→ FAILED / CANCELLED / REFUNDED
```

### API

```text
POST /api/v1/bills/:id/payments
POST /api/v1/payments/:id/cancel
POST /api/v1/payments/:id/refund
POST /api/v1/payments/webhooks/:provider
GET  /api/v1/branches/:id/end-of-day/reconciliation
POST /api/v1/branches/:id/end-of-day/close
```

### Rules

- Cash/card/transfer/e-wallet dùng provider adapter và external reference.
- Webhook/retry cùng reference không double-post; timeout giữ `PENDING` để reconcile.
- Payment details/token không ghi log; receipt chỉ gửi channel đã consent/config.
- Branch close yêu cầu reconcile unpaid/void/refund và payment totals; close không
  xóa hoặc sửa lịch sử.

## F-24 Staff, Shift & Operational Assignment

### Core model

`StaffProfile`, `RoleAssignment`, `Shift`, `ShiftAssignment`, `AttendanceEvent`,
`StationAssignment`, `OperationalTask`.

### Rules

- Shift/assignment là operational scope, không thay thế payroll.
- Host/Server/Kitchen/Bar/Cashier chỉ nhận task phù hợp branch, role, station và shift.
- Handover giữ owner, accepted_at, resolved_at, escalation và reason.
- Attendance chỉ lưu event được phép; không suy ra lương hoặc compliance payroll.

## F-25 Full Operational Reporting & Integration

### Reports

- Occupancy/utilization, reservation/no-show, queue abandonment, table turnover.
- Order-to-kitchen/bar delay, serving time, item availability và cancellation.
- Revenue, discount, payment method, refund, cash/card/transfer reconciliation.
- Purchase/receipt/stock/count/wastage, theoretical-vs-actual khi recipe mapping đủ.
- Audit, branch comparison, staff task SLA và source drill-down.

### Rules

- Report response có branch scope, date/business timezone, `as_of`, source links và
  freshness; cached aggregate không thay thế source query.
- External POS/accounting import có schema validation, external event ID,
  quarantine/replay và reconciliation trước khi tác động inventory/financial data.
- Export áp dụng cùng quyền với màn hình; PII/payment data có field-level policy.
