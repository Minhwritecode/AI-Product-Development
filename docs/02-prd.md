# 3.2 Product Requirements Document (PRD)

## 1. Thông tin tài liệu

| Trường | Giá trị |
|---|---|
| Product | Luminex |
| Version | 0.2 Production core baseline |
| Owner | Product/Engineering team |
| Status | Draft for validation |
| Primary scope | Full Restaurant Operations: FOH + BOH |
| Future boundary | Payroll/accounting suite, forecasting/autonomous AI, enterprise HA/DR |

## 2. Product goals

1. Quản lý trọn vẹn vận hành nhà hàng từ reservation/walk-in tới seating, order,
   kitchen/bar, serving, billing/payment, closing và báo cáo.
2. Tạo một nguồn dữ liệu tập trung cho restaurant, branch, table, menu, staff,
   supplier, ingredient, recipe, order, bill, payment, stock và wastage.
3. Trace được purchase → receipt → stock → branch request → count/wastage và
   liên kết với order/sales/recipe khi tính theoretical usage.
4. Giảm thời gian chờ và sai sót FOH bằng queue, table readiness, routing station,
   staff task và table QR nhưng vẫn giữ quyền kiểm soát của nhân viên.
5. Đảm bảo billing/payment, discount, refund, split bill và end-of-day có audit,
   idempotency, reconciliation và phân quyền rõ.
6. AI chỉ rút ngắn nhập liệu và phân tích trong phạm vi dữ liệu được cấp quyền,
   luôn có human review trước mutation.

## 3. Non-goals / out of scope của production core

- Payroll, benefits, HR và chấm công tích hợp payroll.
- General ledger, tax filing, accounting consolidation và procurement portal.
- Supplier self-service portal và marketplace.
- Autonomous AI decisions, unreviewed auto-PO, exact table-turnover prediction
  và automated guest compensation.
- Multi-region HA/DR, enterprise SSO/SCIM, advanced fraud platform và data warehouse.

QR là một entry point trong full FOH flow, không phải toàn bộ FOH. Full production
phải hỗ trợ cả khách dùng QR và khách được nhân viên phục vụ thủ công.

## 4. Personas và quyền chính

| Role | Read | Write/Action | Approval |
|---|---|---|---|
| Purchasing Manager | Master data, PO, receipt status, dashboard | Supplier, PO | Theo policy, TBD |
| Warehouse Admin | Ingredient, PO, warehouse/branch stock, request | Receipt, transfer shipment, master stock data | Approve/reject stock request |
| Branch Manager | Branch stock, own requests/counts/wastage | Request, daily count, wastage | Có thể submit; approval TBD |
| Owner | Toàn cảnh dashboard/report | Không sửa operational record mặc định | Read-only |
| Admin | Toàn hệ thống | User, role, configuration | Override có audit |
| Host / FOH Lead | Queue, operating state, FOH request trong branch | Call/seat/cancel/expire queue; acknowledge/route/reject/complete request | Override cần reason/audit |
| Server | Bàn được phân công, service session, order, ticket và bill theo policy | Mở session, tạo/gửi order, add-on, transfer/merge, serve, request payment | Không sửa bill đã paid hoặc vượt discount permission |
| Kitchen Staff | Food ticket của station, notes, delay/shortage context | Accept/prepare/complete/hand-over/reject item có reason | Không xem payment/revenue ngoài dữ liệu cần cho ticket |
| Bar Staff | Beverage ticket của station, notes, delay/shortage context | Accept/prepare/complete/hand-over/reject item có reason | Không xem payment/revenue ngoài dữ liệu cần cho ticket |
| Cashier | Unpaid bills, table/session, payment/reconciliation scope | Apply authorized discount, split bill, accept/refund payment theo policy | Refund/high-value discount cần approval |
| Guest | Chỉ session/queue/table token hiện tại | Join/leave queue, add-on draft, assistance request | Không có approval |

AI không phải role. AI thực thi dưới quyền hiện tại của user và không được vượt quyền.

## 5. Core workflow

```text
Restaurant/Branch/Table/Staff setup
  → Reservation hoặc Walk-in/Front-door Queue
  → Table readiness → Seating → Service Session
  → Menu/Modifier → Order Draft → Send to Kitchen/Bar
  → Prepare → Complete → Serve → Additional Order
  → Payment request → Bill/Discount/Split → Payment/Refund
  → Paid → Cleaning → Table Ready → End-of-Day Reconciliation

BOH:
Master Data → Purchase Order → Goods Receipt → Warehouse Stock
  → Branch Stock Request → Shipment/Acceptance → Daily Count
  → Wastage/Variance → Dashboard/Report → Audit/Reconciliation

FOH/POS sales → MenuItem + RecipeVersion → Theoretical Usage (khi mapping hợp lệ)
```

## 6. Functional requirements

### 6.1 Master Data

- Quản lý ingredient, purchase/stock/recipe unit, conversion rate, standard price, low-stock threshold.
- Quản lý menu item và recipe lines.
- Quản lý supplier và lead time cơ bản.
- Quản lý branch và manager.
- Ngăn lưu conversion rate không dương, tên trống hoặc reference không tồn tại.

### 6.2 Purchase Order

- Tạo/sửa PO ở `Draft`.
- Chọn supplier, ingredient, ordered quantity, unit price, expected delivery.
- Chuyển `Draft → Sent`; chỉ role phù hợp mới được gửi.
- Chuyển `Sent → Delivered` khi đã nhận đủ/đủ điều kiện theo policy.
- Hiển thị ordered vs received và discrepancy.

### 6.3 Goods Receipt

- Chọn PO hợp lệ và nhập received quantity theo line.
- Tính discrepancy = received − ordered.
- Ghi chú shortage/over-delivery.
- Chỉ sau khi receipt được xác nhận, warehouse stock mới tăng.
- Idempotency: retry request không được cộng stock hai lần.

### 6.4 Warehouse/Branch Stock

- Hiển thị on-hand, reserved/in-transit nếu có, threshold và last updated.
- Warehouse stock tăng khi goods receipt confirmed.
- Warehouse stock giảm và branch stock tăng khi shipment confirmed.
- Mọi mutation phải có transaction và audit entry.

### 6.5 Branch Stock Request

- Branch Manager tạo request cho branch mình, chọn urgency.
- Warehouse approve/reject; có reason khi reject.
- Warehouse ghi shipped quantity, có thể nhỏ hơn requested theo policy.
- Đóng request khi hoàn thành shipment/confirmation.
- Cảnh báo repeated shortage/overdue ở milestone sau; MVP lưu dữ liệu đủ để mở rộng.

### 6.6 Daily Count & Wastage

- Branch Manager nhập opening, received, theoretical sold nếu có, actual closing.
- Công thức: `variance_qty = opening_qty + received_qty - sold_qty_theory - closing_qty_actual`.
- Nếu thiếu theoretical sold, hệ thống ghi rõ `NOT_AVAILABLE`, không tự suy đoán.
- Wastage có quantity, reason, standard price snapshot và value.
- Wastage value = `wasted_qty × standard_price_at_record_time`.

### 6.7 Dashboard

- KPI: current stock, low-stock items, open PO, receipt discrepancy, pending requests, wastage quantity/value.
- Filter theo date range, branch, ingredient, supplier.
- Drill-down từ KPI tới record nguồn.
- Owner xem cross-branch; Branch Manager chỉ xem phạm vi được cấp.

### 6.8 AI Assistance

- AI Onboarding nhận free text và trả về structured recipe suggestion: ingredient, quantity, unit, confidence, warning.
- User được edit/approve từng line; chỉ save sau approval.
- AI Copilot trả lời câu hỏi trên dữ liệu được authorized, kèm thời điểm/phạm vi dữ liệu.
- AI không tạo PO, approve request, mutate stock, confirm wastage hoặc sửa recipe trực tiếp.
- Khi không đủ dữ liệu, AI phải nói “không đủ dữ liệu” và nêu missing field.

### 6.9 FOH Front-door QR

- QR standy mở web mobile-first, không bắt buộc app/login.
- Guest chọn ngôn ngữ, party size và time budget trước khi thấy CTA join queue.
- Hiển thị `available now`, estimated wait range, queue status, timestamp và confidence/limitation.
- Guest có thể join/leave queue; phone/email chỉ bắt buộc nếu chọn nhận notification.
- Khi queue vượt time budget, hệ thống phải đưa lựa chọn rời queue/xem menu/hỏi nhân viên, không giấu thông tin.

### 6.10 FOH Table QR

- Mỗi bàn dùng signed table token; landing screen xác nhận đúng bàn.
- Guest xem menu, tạo add-on request, note/allergen và request assistance.
- Request có trạng thái và timestamp; staff xác nhận/rout trước khi coi là operational order.
- QR không xử lý payment/refund và không thay thế staff fallback.

### 6.11 Operational Configuration & Access

- Admin cấu hình branch, warehouse/stock location, timezone, currency, service hours, table label/capacity và trạng thái nhận khách.
- Admin cấu hình queue policy: party-size range, time-budget options, estimated-wait TTL, queue capacity và notification channels.
- Admin tạo/deactivate user, gán role và branch membership; thay đổi quyền có audit.
- Host/Manager có thể pause/resume queue hoặc đặt `OPEN`, `PAUSED`, `FULL`, `CLOSED` với reason; không được sửa trực tiếp dữ liệu estimate lịch sử.
- Table QR token có thể rotate/revoke; token hết hạn hoặc bị revoke không được truy cập session cũ.

### 6.12 Notifications & Operational Tasks

- Guest chỉ nhận notification khi đã opt-in; mỗi delivery có status `PENDING/SENT/FAILED/EXPIRED` và không retry vô hạn.
- Staff có inbox/task list cho queue cần gọi, QR request chưa acknowledge, stock request overdue và exception có quyền xem.
- Mỗi task có owner/route, SLA hoặc due time nếu policy yêu cầu, trạng thái và escalation reason.
- Notification failure không làm thay đổi business status; guest luôn thấy queue code/request status để dùng staff fallback.

### 6.13 Corrections, Approvals & Reconciliation

- Milestone 2 bổ sung stock adjustment, reversal/void có reason, count/wastage approval, branch receipt confirmation và reconciliation report giữa ledger với current stock.
- Không cho sửa trực tiếp ledger hoặc record đã dùng để tính báo cáo; correction tạo event mới liên kết record gốc.
- Hệ thống phải phân biệt `IN_TRANSIT`, `RECEIVED`, `REJECTED`, `DAMAGED` và `BACKORDERED` khi mở partial receipt/transfer.

### 6.14 Import, Export & Integration Operations

- Milestone 2/3 hỗ trợ CSV template có preview/validation cho ingredient, supplier, menu/recipe và opening stock; dòng lỗi được trả lại theo row.
- Dashboard và ledger có export theo scope/quyền, kèm filter, `as_of` và source record.
- POS import có quarantine cho event chưa map hoặc lỗi schema, replay an toàn theo external event ID và reconciliation report theo batch.

## 7. Non-functional requirements

| Nhóm | Yêu cầu MVP |
|---|---|
| Security | JWT/session, password hash, RBAC, branch scope, secret không commit |
| Integrity | PostgreSQL transaction cho stock mutation; immutable audit event |
| Performance | P95 read API < 500ms với dataset pilot; dashboard có cache khi cần |
| Availability | Local/Docker demo; DB là SPOF được ghi nhận |
| Observability | Structured log, request ID, health/readiness endpoint |
| Backup | Có hướng dẫn `pg_dump`; chưa phải HA enterprise |
| Accessibility | Form labels, keyboard navigation, readable contrast ở UI MVP |
| Localization | Tiếng Việt là chính; VND là currency mặc định |
| Privacy | Không gửi dữ liệu vượt scope tới LLM; API key trong env |
| Guest UX | Mobile-first, tối thiểu 44px touch target, 16px body, Vietnamese/English, có staff fallback |
| Operations | Branch/warehouse/table/queue config, session expiry, rate limit, notification retry và task ownership phải được cấu hình/quan sát được |
| Data quality | Mọi correction tạo ledger/audit event mới; export/import có validation, quarantine và reconciliation |

## 8. Data principles

- Tất cả quantity có unit rõ; quy đổi về stock unit trước khi tính tồn.
- Price dùng decimal, không dùng floating point cho giá trị tiền.
- Timestamp lưu UTC; UI hiển thị timezone cấu hình.
- Không hard-delete operational record; dùng status/void với audit.
- Snapshot `standard_price` vào wastage record để lịch sử không đổi khi master price cập nhật.

## 9. Historical MVP acceptance gates

MVP chỉ được coi là đủ khi:

1. Một user có thể đi hết BOH workflow chính bằng dữ liệu demo; guest có thể đi hết hai FOH QR flow.
2. Goods receipt không confirmed thì stock không tăng.
3. Stock request không approved thì không được ship.
4. Shipment không đủ stock thì không làm quantity âm.
5. Daily count/wastage hiển thị quantity, reason và value có thể truy vết.
6. Dashboard lọc đúng scope quyền.
7. AI suggestion chưa approve không ghi DB.
8. Có audit trail cho các mutation chính.
9. Guest không nhìn thấy PII/chi tiết khách khác và không thể gửi request cho sai bàn.
10. Staff có thể xem, xác nhận, từ chối hoặc chuyển tiếp QR request với reason/status.
11. Admin có thể cấu hình operating state/queue policy và thu hồi token; mọi override có actor, reason, timestamp.
12. Notification failure không làm mất queue/request; task quá hạn có owner và trạng thái xử lý.

## 10. Open decisions

- Partial goods receipt và PO approval: quyết định trước pilot.
- Daily count/wastage approval: owner và SLA cần xác nhận.
- Actual purchase cost vs standard price: MVP dùng standard price, milestone 2 xem xét actual cost.
- POS integration contract: chưa khóa trong MVP; xem architecture data model.

## 11. FOH → BOH Delivery Specification

Phần này giữ lại yêu cầu delivery ban đầu cho FOH Lite và BOH Core. Các mã
`PRD-US-*` và `PRD-FR-*` trong phần này được dùng để trace tới requirements,
user stories, feature specifications và test cases; production capability hiện
hành nằm ở section 12 và dùng mã `PRD-PROD-*`.

### 11.1 Introduction / Overview

Luminex kết nối hai khu vực vận hành của nhà hàng:

- **FOH — Front of House:** khách xem tình trạng bàn bằng front-door QR, chọn theo time budget, tham gia/rời queue; khi đã ngồi, khách dùng table QR để xem menu, gọi thêm món hoặc request assistance. Staff acknowledgement giữ quyền kiểm soát và duy trì hospitality.
- **BOH — Back of House:** đội vận hành quản lý master data, purchasing, goods receipt, warehouse/branch stock, daily count, wastage, dashboard và AI assistance có human approval.

Mục tiêu của addendum là chuyển các pain point FOH và BOH thành các đơn vị có thể triển khai, kiểm thử và nghiệm thu. FOH Lite là lớp entry-point ban đầu; full reservation, table assignment, billing, payment, KDS và bar operations được đặc tả đầy đủ ở section 12.

### 11.2 Goals

- Khách hiểu tình trạng bàn hoặc estimated wait trong tối đa 30 giây.
- Khách có thể xem availability mà không cần tải app, tạo account hoặc nhập contact bắt buộc.
- Khách có thể join và leave queue rõ ràng, dựa trên party size và time budget của chính họ.
- Add-on request tại bàn có trạng thái từ gửi → acknowledge/route → chuẩn bị → hoàn tất hoặc recovery.
- Giảm số câu hỏi lặp lại của staff về tình trạng bàn, thời gian chờ và yêu cầu gọi thêm.
- BOH trace được stock từ purchase order → goods receipt → warehouse/branch stock → daily count → wastage.
- Retry queue join, add-on request, goods receipt hoặc shipment không tạo duplicate mutation.
- AI không tự ghi recipe, stock, purchase order hoặc wastage khi chưa được user review và approve.
- Guest data, table token, branch scope và operational records được bảo vệ theo role và session.

### 11.3 User Stories

Các story UI phải được kiểm tra trên mobile, tablet và desktop, bao gồm responsive layout, keyboard/focus, readable contrast, loading/error state và staff fallback khi phù hợp.

#### FOH guest access

### PRD-US-001: Xem availability bằng front-door QR

**Description:** As a guest, I want to scan the front-door QR and see table availability so that I can decide whether to enter or wait.

**Acceptance Criteria:**

- [ ] QR mở được trang mobile-first với Vietnamese và English.
- [ ] Trang hiển thị `available now`, `estimated wait`, `queue status`, `as_of` và limitation nếu dữ liệu stale.
- [ ] Guest không cần đăng nhập hoặc tải app để xem kết quả.

### PRD-US-002: Chọn language, party size và time budget

**Description:** As a guest, I want to select language, party size and time budget so that the queue decision matches my schedule.

**Acceptance Criteria:**

- [ ] Language selector xuất hiện trước nội dung dài.
- [ ] Party size dùng input dễ chạm, có label rõ và không cho giá trị không hợp lệ.
- [ ] Time budget có các khoảng `≤15 phút`, `15–30 phút`, `30–60 phút`, `Không chắc`.

### PRD-US-003: Join và leave queue

**Description:** As a guest, I want to join or leave the queue clearly so that I remain in control of my waiting decision.

**Acceptance Criteria:**

- [ ] Join tạo queue code và estimated wait range.
- [ ] Retry cùng idempotency key không tạo queue entry thứ hai.
- [ ] Guest nhìn thấy CTA `Rời hàng chờ` và có thể rời queue mà không cần liên hệ staff.
- [ ] Nếu guest chọn notification, phone/email mới được yêu cầu; nếu không thì không bắt buộc.

### PRD-US-004: Host quản lý queue

**Description:** As a host, I want to manage queue entries so that guests receive accurate seating status.

**Acceptance Criteria:**

- [ ] Host thấy party size, time budget, created time, status và accessibility note nếu guest cung cấp.
- [ ] Host có thể call, seat, cancel hoặc mark expired theo state machine hợp lệ.
- [ ] Override status cần reason và tạo audit event.
- [ ] Queue entry stale/overdue không tự động chuyển thành seated.

### PRD-US-005: Xác nhận đúng table QR

**Description:** As a seated guest, I want to confirm the table shown by the QR flow so that I do not send a request to another table.

**Acceptance Criteria:**

- [ ] Landing page hiển thị table label thân thiện trước khi guest gửi request.
- [ ] Token sai, hết hạn hoặc revoked hiển thị recovery path mà không lộ session data.
- [ ] Guest không xem được order, PII hoặc request của bàn khác.

### PRD-US-006: Tạo add-on request

**Description:** As a seated guest, I want to select additional items and notes so that I can order more without calling across the room.

**Acceptance Criteria:**

- [ ] Menu có category, quantity, note và allergen field nếu dữ liệu hỗ trợ.
- [ ] Confirmation hiển thị table, item, quantity và estimated preparation range.
- [ ] Submit tạo trạng thái `SUBMITTED` hoặc `Đã gửi`, không tự coi là đã phục vụ.
- [ ] Item unavailable được báo rõ và có alternative hoặc staff help.

### PRD-US-007: Theo dõi và cancel request

**Description:** As a guest, I want to see the status of my request and cancel when allowed so that I know whether staff received it.

**Acceptance Criteria:**

- [ ] Status hiển thị tối thiểu `Đã nhận`, `Đang chuẩn bị`, `Đã phục vụ`, `Từ chối/Cần nhân viên`.
- [ ] Request có timestamp và message recovery khi timeout.
- [ ] Guest chỉ cancel được trong policy window; request đã route/prepare phải chuyển sang staff help.

### PRD-US-008: Staff acknowledge, route hoặc reject request

**Description:** As a server or manager, I want to acknowledge and route QR requests so that hospitality remains staff-controlled and traceable.

**Acceptance Criteria:**

- [ ] Staff thấy table, item, quantity, note, created time và requested action.
- [ ] Staff có thể acknowledge, route, reject hoặc mark complete theo trạng thái hợp lệ.
- [ ] Reject bắt buộc có reason; mọi state change có actor và timestamp.

### PRD-US-009: Staff fallback và accessibility

**Description:** As a guest who cannot or does not want to use QR, I want a visible staff fallback so that hospitality remains available.

**Acceptance Criteria:**

- [ ] Front-door và table QR flow đều có CTA `Hỏi nhân viên`.
- [ ] Form có visible labels, body text tối thiểu 16px, touch target tối thiểu 44×44px.
- [ ] Status không chỉ dựa vào màu; có text/icon và `aria-live` khi phù hợp.

#### BOH operations

### PRD-US-010: Warehouse tạo goods receipt

**Description:** As a warehouse admin, I want to record received quantities against a purchase order so that actual delivery is traceable.

**Acceptance Criteria:**

- [ ] Chỉ PO ở trạng thái có thể receive mới được chọn.
- [ ] UI hiển thị ordered, previously received, current receipt, total received và discrepancy.
- [ ] Quantity âm bị từ chối; shortage/over-delivery cần note.

### PRD-US-011: Cập nhật stock transaction-safe

**Description:** As the system, I want goods receipt and shipment mutations to be atomic so that inventory quantities remain correct.

**Acceptance Criteria:**

- [ ] Receipt chưa confirm không làm tăng stock.
- [ ] Confirm receipt cập nhật stock và ledger trong cùng transaction.
- [ ] Retry cùng idempotency key không double-add hoặc double-decrement.
- [ ] Transaction failure rollback toàn bộ mutation và tạo structured error.
- [ ] Typecheck/lint passes.

### PRD-US-012: Branch tạo stock request

**Description:** As a branch manager, I want to request ingredients from the warehouse so that branch shortages are visible and traceable.

**Acceptance Criteria:**

- [ ] Branch manager chỉ tạo request cho branch được gán.
- [ ] Request gồm ingredient, quantity, urgency và needed date.
- [ ] Submit chuyển state sang `Requested` và không trừ warehouse stock.

### PRD-US-013: Branch submit daily count

**Description:** As a branch manager, I want to submit a daily count so that actual stock can be compared with expected usage.

**Acceptance Criteria:**

- [ ] Count thuộc đúng branch/date/ingredient và không duplicate active record.
- [ ] UI preview công thức `opening + received - sold - closing` trước submit.
- [ ] Thiếu `sold_qty_theory` được hiển thị là unavailable, không tự mặc định bằng zero.

### PRD-US-014: Ghi wastage quantity, reason và value

**Description:** As a branch manager, I want to record wastage with a reason and value so that losses can be explained.

**Acceptance Criteria:**

- [ ] Wastage quantity phải lớn hơn zero và reason là bắt buộc.
- [ ] Value dùng standard price snapshot tại thời điểm record.
- [ ] Record liên kết được với branch, ingredient, daily count và actor.

### PRD-US-015: Owner xem dashboard và drill-down

**Description:** As an owner, I want to view stock, discrepancy and wastage dashboards so that I can identify operational problems by branch and ingredient.

**Acceptance Criteria:**

- [ ] Dashboard có stock, low-stock, open PO, pending request, variance và wastage value.
- [ ] Filter theo date range, branch và ingredient hoạt động đúng scope.
- [ ] KPI có `as_of` và drill-down tới source record.

### PRD-US-016: AI recipe suggestion có approval

**Description:** As an authorized user, I want AI to parse recipe text into suggestions so that recipe entry is faster without losing human control.

**Acceptance Criteria:**

- [ ] Output có ingredient, quantity, unit, confidence và warning.
- [ ] Unknown ingredient/unit bị đánh dấu và không tự map mơ hồ.
- [ ] User có thể edit/delete/add line trước khi approve.
- [ ] Chưa approve thì database recipe không thay đổi.

#### Platform and operational control

### PRD-US-017: Admin cấu hình operating state và queue policy

**Description:** As an admin or manager, I want to configure branch operating state and queue policy so that guest-facing availability reflects real operational capacity.

**Acceptance Criteria:**

- [ ] Admin cấu hình branch, service hours, queue capacity, party-size range và estimated-wait TTL.
- [ ] Host/manager có thể đặt `OPEN`, `PAUSED`, `FULL` hoặc `CLOSED` với reason.
- [ ] Table QR token có thể rotate/revoke; token revoked không truy cập session cũ.
- [ ] Thay đổi policy/state có actor, timestamp và audit event.

### PRD-US-018: Notification và task inbox

**Description:** As a staff member, I want an operational task inbox and reliable guest notifications so that no queue or request is silently lost.

**Acceptance Criteria:**

- [ ] Staff thấy queue cần gọi, QR request chưa acknowledge, overdue stock request và exception trong phạm vi quyền.
- [ ] Notification delivery có `PENDING`, `SENT`, `FAILED`, `EXPIRED`.
- [ ] Notification failure không thay đổi business status; guest vẫn xem được queue/request status.

### PRD-US-019: Correction và reconciliation

**Description:** As an authorized manager, I want controlled corrections and reconciliation reports so that inventory errors can be fixed without erasing history.

**Acceptance Criteria:**

- [ ] Stock adjustment, reversal hoặc void yêu cầu reason và permission phù hợp.
- [ ] Correction tạo event mới liên kết record gốc, không sửa trực tiếp append-only ledger.
- [ ] Report đối chiếu được current stock với ledger và nêu discrepancy.
- [ ] Typecheck/lint passes.

### PRD-US-020: Import/export và POS quarantine

**Description:** As an operations owner, I want validated import/export and quarantined POS events so that external data can be corrected and replayed safely.

**Acceptance Criteria:**

- [ ] Import có template, preview, row-level validation và error download.
- [ ] POS event chưa map hoặc sai schema vào quarantine, không tự trừ stock.
- [ ] Replay dùng external event ID/idempotency và không tạo duplicate.
- [ ] Export có filter, permission scope, `as_of` và source record.

### 11.4 Functional Requirements

#### FOH guest QR requirements

- **PRD-FR-001:** System MUST expose a mobile-first front-door QR landing page for each configured location.
- **PRD-FR-002:** System MUST support Vietnamese and English before presenting long guest-facing instructions.
- **PRD-FR-003:** System MUST accept party size and time budget before allowing queue join.
- **PRD-FR-004:** System MUST return availability as a state plus estimated wait range, `as_of`, confidence and limitation metadata.
- **PRD-FR-005:** System MUST show a recovery action when status data is stale, unavailable, queue is full or wait exceeds the guest time budget.
- **PRD-FR-006:** System MUST create at most one queue entry per guest session and idempotency key.
- **PRD-FR-007:** System MUST allow a guest to leave the queue without hiding or disabling the leave action.
- **PRD-FR-008:** System MUST request phone/email only when the guest opts into notification.
- **PRD-FR-009:** System MUST not expose the exact departure time or personally identifiable information of another guest.
- **PRD-FR-010:** System MUST provide a visible staff fallback for every front-door QR state.

#### Staff queue and table request requirements

- **PRD-FR-011:** Host or manager MUST be able to call, seat, cancel or expire a queue entry only through valid state transitions.
- **PRD-FR-012:** Queue override MUST require an authorized role and a reason.
- **PRD-FR-013:** Table QR MUST use a signed token that does not contain PII.
- **PRD-FR-014:** System MUST reject expired, revoked or invalid table tokens without leaking session details.
- **PRD-FR-015:** Guest MUST confirm the table context before submitting an add-on or assistance request.
- **PRD-FR-016:** System MUST expose category, item, quantity, note and allergen fields according to published menu data.
- **PRD-FR-017:** Add-on requests MUST start in `SUBMITTED` and require staff acknowledgement before becoming an operational request.
- **PRD-FR-018:** Staff MUST be able to acknowledge, route, reject and complete a request within the configured permission scope.
- **PRD-FR-019:** Rejected requests MUST include a guest-safe reason and an alternative recovery action.
- **PRD-FR-020:** QR request retry with the same idempotency key MUST return the original request instead of creating a duplicate.

#### BOH inventory and wastage requirements

- **PRD-FR-021:** Ingredient, supplier, branch, menu item and recipe records MUST validate required fields and active references.
- **PRD-FR-022:** Unit conversion rates MUST be positive and all stock mutations MUST be normalized to canonical stock unit.
- **PRD-FR-023:** Purchasing Manager MUST be able to create and edit a draft PO with supplier, line quantity, price and expected delivery.
- **PRD-FR-024:** Only an authorized role MAY transition a PO from `Draft` to `Sent` or `Sent` to an allowed delivery state.
- **PRD-FR-025:** Goods receipt MUST compare ordered, previously received, current received and discrepancy quantities.
- **PRD-FR-026:** Goods receipt confirmation MUST be atomic with the warehouse stock and inventory ledger update.
- **PRD-FR-027:** Goods receipt confirmation MUST be idempotent and MUST NOT double-add stock on retry.
- **PRD-FR-028:** Branch Manager MUST be able to create a stock request only for an assigned branch.
- **PRD-FR-029:** Warehouse MUST approve or reject a stock request; rejection MUST include a reason.
- **PRD-FR-030:** Shipment MUST be blocked unless the request is approved and available warehouse stock is sufficient.
- **PRD-FR-031:** Shipment confirmation MUST atomically decrement warehouse stock, increment branch stock and append a ledger event.
- **PRD-FR-032:** System MUST reject negative quantities and MUST not allow stock below zero in MVP.
- **PRD-FR-033:** Branch daily count MUST store opening, received, theoretical sold when available and actual closing quantities.
- **PRD-FR-034:** System MUST calculate variance using the documented formula and mark the result incomplete when theoretical sold is unavailable.
- **PRD-FR-035:** Wastage MUST store quantity, reason, standard price snapshot, value, branch, ingredient, actor and source count.

#### AI, security and data governance requirements

- **PRD-FR-036:** AI recipe onboarding MUST return schema-validated suggestions with confidence and warnings.
- **PRD-FR-037:** AI output MUST remain a draft until an authorized user approves it; AI MUST NOT directly call mutation endpoints.
- **PRD-FR-038:** AI Copilot MUST query only an authorized data projection and MUST return source scope, `as_of` and limitations.
- **PRD-FR-039:** Backend MUST enforce authentication, RBAC and branch scope on every protected read and mutation.
- **PRD-FR-040:** Every queue, request, PO, receipt, shipment, count, wastage, correction and configuration transition MUST create an audit event.
- **PRD-FR-041:** Operational records and inventory ledger MUST not be hard-deleted after being used by a transaction or report.
- **PRD-FR-042:** API MUST store timestamps in UTC and MUST avoid sending passwords, tokens, unnecessary PII or payment details to an LLM.

#### Configuration, notification and integration requirements

- **PRD-FR-043:** Admin MUST configure branch operating state, service hours, queue capacity, party-size range, time-budget options and wait-estimate TTL.
- **PRD-FR-044:** Table QR token rotation/revocation MUST invalidate the affected token according to the configured expiry policy.
- **PRD-FR-045:** Notification delivery MUST expose `PENDING`, `SENT`, `FAILED` and `EXPIRED`, with bounded retry and audit metadata.
- **PRD-FR-046:** Staff task inbox MUST show owner, route, status, due/SLA time and escalation reason for actionable exceptions.
- **PRD-FR-047:** Stock correction, reversal and void MUST create a new linked event and MUST NOT rewrite the original ledger event.
- **PRD-FR-048:** Import MUST provide template, preview, row-level validation and quarantine for invalid records.
- **PRD-FR-049:** POS/import events MUST support external event ID idempotency, replay and reconciliation without duplicate stock mutation.
- **PRD-FR-050:** Export MUST enforce permission scope and include filters, `as_of` timestamp and source record references.

### 11.5 Non-goals / Scope Boundaries

Phần này bổ sung và làm rõ, không thay thế mục 3 ở trên:

- FOH Lite QR không phải full reservation, table map hoặc seating engine.
- QR MVP không xử lý billing, payment, refund hoặc customer receipt.
- System không tự động dự đoán và trình bày thời điểm một khách cụ thể sẽ rời bàn như một cam kết.
- AI không tự quyết định queue, stock, wastage, PO, payment hoặc guest compensation.
- QR request không được coi là order chính thức trước khi staff acknowledge/route.
- Guest không bị bắt tải app, tạo account hoặc cung cấp contact nếu không chọn notification.
- Không triển khai full KDS, Bar Display, kitchen execution, payroll hoặc accounting trong addendum này.

### 11.6 Design Considerations

- UI guest phải mobile-first, body text tối thiểu 16px và touch target tối thiểu 44×44px.
- Mỗi form phải có visible label, helper text khi cần, inline validation và error recovery gần field.
- Mỗi trạng thái chỉ có một primary CTA; các đường lui như `Rời hàng chờ`, `Hỏi nhân viên` hoặc `Thử lại` phải luôn nhìn thấy.
- Không dùng màu làm tín hiệu duy nhất; status phải có text/icon và `aria-live` cho thay đổi queue/request quan trọng.
- Có loading, empty, stale, timeout, network error và retry state.
- Có reduced-motion support và không làm mất keyboard focus.
- Vietnamese/English là baseline; ngôn ngữ thêm được thiết kế bằng progressive disclosure.
- Không dùng dark pattern để giữ guest trong queue hoặc giấu thời gian chờ.
- Wait time dùng range, timestamp và confidence; không tạo false precision.
- QR luôn có staff fallback để công nghệ bổ trợ, không thay thế hospitality.

### 11.7 Technical Considerations

#### Interfaces and data types

- `GuestSession`: session không cần account, locale, notification preference, expiry và consent metadata; không lưu PII mặc định.
- `QueueEntry`: location, session, party size, time budget, status, estimated wait range, `as_of`, created/called/seated timestamps.
- `TableSession`: table ID, signed token hash, status và expiry.
- `FOHRequest`: table session, type (`ADD_ON`/`ASSISTANCE`), lines, note, allergen note, status, idempotency key và staff timestamps.
- `NotificationDelivery`: request/queue target, channel, status, attempts, last error và expiry.
- `OperationalTask`: type, owner, route, due/SLA, status, escalation reason và linked entity.

#### Integrity and security constraints

- Signed table QR token phải hỗ trợ expiry, rotation và revocation; token không được encode PII.
- Queue join, add-on request, goods receipt và stock shipment phải hỗ trợ idempotency.
- PostgreSQL transaction phải bao phủ stock mutation và append-only inventory ledger event.
- Audit event phải được ghi cho mọi state transition, correction, approval và configuration override.
- Backend là nơi duy nhất quyết định authorization và branch scope; frontend chỉ phản ánh quyền.
- Notification failure không được tự thay đổi queue/request/business status.
- POS/import item chưa map hoặc event lỗi phải vào quarantine, không tự trừ stock.
- AI chỉ nhận authorized projection và không được truy cập trực tiếp database.
- Timestamp lưu UTC; UI hiển thị timezone theo cấu hình branch.
- Operational record không hard-delete; correction tạo event mới liên kết record gốc.

### 11.8 Success Metrics

#### FOH metrics

- Availability view completion rate.
- Queue join conversion.
- Queue abandonment rate.
- Queue status comprehension rate qua usability test ngắn.
- Add-on request time-to-acknowledge.
- Duplicate request rate.
- Staff fallback rate.
- QR error rate.
- Percentage of guests who can complete the first availability decision within 30 seconds.

#### BOH metrics

- Receipt discrepancy resolution time.
- Daily count completion rate.
- Percentage of wastage records có reason và value.
- Unexplained variance rate.
- Stock mutation duplicate rate.
- Percentage of stock movements traceable to a source record.
- AI suggestion edit/approval rate.
- Dashboard question response time.
- Notification delivery success rate.
- Overdue operational task rate.

Metrics phải được phân tích theo branch, role, time range và phiên bản policy khi dữ liệu đủ; không dùng một con số tổng hợp để che khuất sự khác biệt giữa các branch.

### 11.9 Open Questions

Các open question cũ ở mục 10 vẫn giữ nguyên. Các câu hỏi bổ sung cần được chốt trước pilot:

- Estimated wait được tính bằng rule cố định, historical service duration hay kết hợp cả hai?
- Queue có cho phép nhiều nhóm dùng cùng nickname không, và cách tránh nhầm khi gọi khách là gì?
- Khi khách không có notification contact, staff sẽ gọi khách bằng queue code hay phương thức khác?
- Add-on request có được phép sau khi bill đã request payment không?
- Role nào được acknowledge, route hoặc reject QR request?
- Service hours và queue capacity có khác nhau theo branch hoặc theo ngày/khung giờ không?
- Table QR token rotate theo ngày, theo session hay theo configuration change?
- Menu/add-on lấy từ menu service nào và version nào được coi là active?
- Khi POS chưa có, `sold_qty_theory` hiển thị như thế nào trên dashboard và export?
- Notification provider nào được dùng trong MVP và chính sách chi phí/consent là gì?
- Có cần export queue/request analytics cho Operations Manager trong MVP không?

### 11.10 Traceability and Delivery Checklist

- [ ] `PRD-US-001`–`PRD-US-020` được map tới feature hoặc ticket implementation.
- [ ] `PRD-FR-001`–`PRD-FR-050` không trùng ID với requirement hiện có.
- [ ] Mọi UI story có responsive, accessibility và state verification.
- [ ] Mọi stock/queue/request mutation có idempotency và audit test.
- [ ] Traceability được kiểm tra với [Requirements Analysis](03-requirements-analysis.md), [User Stories & Acceptance](04-user-stories-acceptance.md) và [Feature Specifications](05-feature-specifications.md).
- [ ] Typecheck, lint, unit/integration test và acceptance test pass trước khi release.
- [ ] Tài liệu, API contract, data model và migration được cập nhật đồng bộ khi behavior thay đổi.

### 11.11 Business-level FOH → BOH clarification

Phần này làm rõ business context ngay trong PRD để team không triển khai đúng API nhưng sai nỗi đau thực tế. Đây vẫn là PRD baseline, không phải một tài liệu BRD tách rời.

#### FOH: giảm bất định nhưng vẫn giữ hospitality

| Pain point | PRD requirement | Điều kiện không được vi phạm |
|---|---|---|
| Khách đứng trước cửa không biết còn bàn hay phải chờ bao lâu | Front-door QR hiển thị `OPEN/PAUSED/FULL/CLOSED`, queue size, estimated wait range, `as_of`, confidence và limitation | Không hiển thị giờ rời bàn của khách khác; không biến estimate thành lời hứa |
| Khách du lịch không đọc được nội dung hoặc không muốn tải app | Chọn Vietnamese/English và xem availability không cần login/app/contact bắt buộc | Không ép tạo account hoặc nhập số điện thoại trước khi khách quyết định chờ |
| Khách có time budget khác nhau | Bắt buộc party size và time budget trước CTA join queue | Nếu wait vượt budget phải có lựa chọn rời queue, xem menu hoặc hỏi staff |
| Guest join rồi đổi ý | Có CTA `Rời hàng chờ` rõ ràng, không dark pattern, retry idempotent | Leave không được ẩn sau nhiều bước; trạng thái phải được xác nhận |
| Nhân viên trả lời lặp lại câu hỏi queue | Host console có created time, party size, time budget, status, priority và owner | Host chỉ call/seat/cancel/expire theo state machine và branch scope |
| Khách gửi nhầm yêu cầu cho bàn khác | Table QR dùng signed token và hiển thị table label để xác nhận trước submit | Token sai/hết hạn/revoked không được lộ session hoặc dữ liệu bàn |
| Khách gọi thêm món khi server đang bận | Table QR hỗ trợ `ADD_ON` và `ASSISTANCE` với category, quantity, note/allergen và status | QR request bắt đầu ở `SUBMITTED`; chưa staff acknowledge thì chưa phải order vận hành |
| Khách tưởng đã được phục vụ ngay | Confirmation dùng “Nhân viên đã nhận yêu cầu”, hiển thị timestamp/time range nếu có | Không hứa “sẽ ra ngay”, không tự mark `SERVED` khi timer hết |
| Notification không gửi được | Delivery có `PENDING/SENT/FAILED/EXPIRED`, retry bounded và queue/request status vẫn xem được | Delivery failure không rollback hoặc tự đổi business status |
| Khách không dùng được QR | Mọi QR state có CTA hỏi/gọi staff và quy trình thủ công tương đương | QR là lựa chọn bổ trợ, không phải rào cản hospitality |

#### BOH: biến nguyên liệu và hao hụt thành dữ liệu có trách nhiệm

| Pain point | PRD requirement | Điều kiện không được vi phạm |
|---|---|---|
| Ingredient cùng lúc dùng thùng/kg/litre/g/ml | Master data có purchase/stock/recipe unit và conversion rate dương | Mọi stock mutation normalize về canonical stock unit |
| PO, phiếu giao và hàng thực nhận không khớp | Goods receipt hiển thị ordered, previously received, current received, accepted/damaged/rejected/backordered và discrepancy | Draft receipt không mutate stock; confirm phải atomic |
| Receipt retry làm tăng tồn hai lần | Receipt dùng `Idempotency-Key`, transaction và append-only ledger | Retry trả kết quả cũ, không tạo ledger event thứ hai |
| Branch xin hàng qua chat/giấy | Stock request có branch, ingredient, quantity, urgency, needed-by, requester và state | Branch chỉ thấy/sửa scope của mình; request chưa approval không trừ warehouse |
| Hàng đang chuyển bị tính nhầm là đã nhận | Shipment tách `APPROVED/IN_TRANSIT/RECEIVED/DISCREPANCY` | Chỉ branch acceptance mới tăng branch stock |
| Count cuối ngày không phản ánh dữ liệu thực | Daily count lưu opening, received, theoretical sold nếu có và closing actual | Thiếu `sold_qty_theory` phải là `NOT_AVAILABLE/INCOMPLETE_THEORY`, không silent zero |
| Wastage chỉ ghi “mất” và không biết mất bao nhiêu tiền | Wastage bắt buộc quantity > 0, reason, standard price snapshot, value, actor và evidence theo policy | `wastage_value` luôn là giá trị dương; không dùng số âm để thay cho variance |
| Sửa sai làm mất lịch sử | Count/wastage có submit/approve/reject/lock; correction tạo compensating event | Ledger posted immutable, không hard-delete hoặc sửa trực tiếp record gốc |
| Owner không biết số liệu mới tới đâu | Dashboard luôn có branch scope, timezone, `as_of`, freshness và drill-down source record | Không trình bày POS/KDS/sold data roadmap như dữ liệu live |
| AI nhập nhanh nhưng có thể làm bẩn master/stock | AI trả suggestion, confidence, warning, sources và requires approval | AI không tự ghi recipe, PO, stock, wastage hoặc tự approve |

#### Acceptance gates bổ sung cho PRD

- [ ] Mỗi FOH/BOH flow có actor, owner, branch scope, input, output, state transition và failure/recovery path.
- [ ] Mọi mutation có permission, idempotency, audit event và error code ổn định.
- [ ] Mọi dữ liệu thiếu hoặc stale được hiển thị rõ; không suy đoán thành số 0 hoặc trạng thái thành công.
- [ ] FOH guest không bị yêu cầu app/account/contact nếu không cần cho hành động họ đang chọn.
- [ ] BOH transaction có source record, canonical unit, snapshot giá trị và khả năng reconcile với ledger.
- [ ] AI và notification chỉ là side effect có quan sát; không được tự thay đổi business status ngoài policy.
- [ ] Prototype UI chỉ được xem là đạt khi đã đối chiếu với screen ID, PRD scope, loading/empty/stale/error state và accessibility checklist.

## 12. Full Restaurant Operations Production Scope

> Phần này là baseline hiện hành cho mục tiêu full restaurant management
> production. Các câu ở phần trước mô tả BOH-first/FOH Lite MVP được giữ để
> trace lịch sử, nhưng khi có mâu thuẫn thì phần 12 và các feature production
> bên dưới được ưu tiên cho việc lập kế hoạch code.

### 12.1 Production domains

| Domain | Actors | Production capability | Source of truth |
|---|---|---|---|
| Restaurant setup & access | Admin, Owner, Manager | Restaurant/branch/area/table, service hours, languages, currency, roles, permissions, branch membership | PostgreSQL config + audit |
| Reservation & arrival | Guest, Host, Manager | Availability, reservation, confirmation, arrival, no-show, cancel/reschedule, special notes | Reservation + table hold |
| Walk-in & queue | Guest, Host | Front-door QR, party/time budget, waitlist, call, expire, leave, staff fallback | Queue state + policy |
| Floor & table operations | Host, Server, Manager, Cleaner | Table status, seating, transfer, merge, cleaning task, readiness, accessibility | Table/service session |
| Menu & pricing | Admin, Manager | Categories, items, modifier, allergen, station, availability, price, version/effective time | Menu version |
| Order & service session | Server, Guest, Manager | Draft order, rounds, notes, add-on, send, cancel item, station routing, course/service policy | Service session/order |
| Kitchen & bar | Kitchen Staff, Bar Staff, Server | Station ticket, accept, preparing, complete, delay, shortage, reject with reason, hand-over | Ticket/item event |
| Billing & payment | Server, Cashier, Manager, Guest | Bill, tax/service charge, discount, split, payment, refund, receipt, reconciliation | Bill/payment ledger |
| Staff operations | Admin, Manager, Host, Server, Kitchen, Bar, Cashier | Shift, assignment, task, handover, attendance event, permission scope | Staff/shift/task records |
| BOH inventory | Purchasing, Warehouse, Branch, Owner | Master, PO, receipt, transfer, count, wastage, variance, correction, dashboard | Inventory ledger |
| Reporting & controls | Owner, Manager, Auditor | Revenue, occupancy, service time, ticket delay, payment, stock/wastage, audit/export | Read models + source links |

### 12.2 Required production state machines

```text
Reservation: DRAFT → PENDING → CONFIRMED → ARRIVED → SEATED → COMPLETED
                         └→ CANCELLED / NO_SHOW

Table: AVAILABLE → HELD/RESERVED → READY → IN_USE → PAYMENT_PENDING
       → WAITING_CLEANING → CLEANING → READY

ServiceSession: OPEN → ACTIVE → PAYMENT_REQUESTED → CLOSED

Order: DRAFT → SENT → IN_PROGRESS → PARTIALLY_SERVED → SERVED → CLOSED
       └→ CANCELLED (policy/reason)

TicketItem: NEW → ACCEPTED → PREPARING → READY → PICKED_UP → SERVED
                 └→ DELAYED / REJECTED (reason)

Bill: OPEN → REVIEW → PARTIALLY_PAID → PAID
      └→ VOIDED / REFUND_PENDING → REFUNDED (authorized command)

Payment: INITIATED → PENDING → SUCCEEDED
                     └→ FAILED / CANCELLED / REFUNDED

CleaningTask: OPEN → CLAIMED → CLEANING → READY_FOR_CHECK → COMPLETED
              └→ BLOCKED (reason)
```

Transitions are named commands, permission checked, idempotent where they can
be retried, and audited. Clients cannot set an arbitrary status.

### 12.3 Production functional requirements

#### Setup, access and staff

- **PRD-PROD-FR-001:** Admin MUST configure restaurant, branch, area, table,
  capacity, accessibility tags, service hours, timezone, currency and locale.
- **PRD-PROD-FR-002:** Admin MUST manage role, permission, branch membership,
  staff status and session revocation; backend MUST enforce every scope.
- **PRD-PROD-FR-003:** Manager MUST create shifts and staff assignments for
  Host, Server, Kitchen, Bar and Cashier; overlap/conflict must be visible.
- **PRD-PROD-FR-004:** Every staff action MUST carry actor, branch, shift/session,
  request ID and timestamp where applicable.

#### Reservation, walk-in and table operations

- **PRD-PROD-FR-005:** Guest or Host MUST create a reservation using date/time,
  party size, contact policy, seating preference and special note.
- **PRD-PROD-FR-006:** System MUST validate opening hours, blocked/maintenance
  tables, capacity, existing holds and reservation policy before confirmation.
- **PRD-PROD-FR-007:** Host MUST confirm arrival, mark no-show, cancel/reschedule
  and assign a suitable table without exposing unrelated guest data.
- **PRD-PROD-FR-008:** Walk-in MUST support queue code, party size, wait start,
  preference, estimated range, call, leave, expire and staff fallback.
- **PRD-PROD-FR-009:** Table status MUST prevent seating into dirty, blocked,
  maintenance or unconfirmed cleaning states.
- **PRD-PROD-FR-010:** Manager/Host MUST transfer or merge an active service
  session with complete order/bill history and audit.
- **PRD-PROD-FR-011:** Closing a paid session MUST create a cleaning task and
  table becomes available only after staff confirms cleaning complete.

#### Menu, order, kitchen, bar and serving

- **PRD-PROD-FR-012:** Admin/Manager MUST version menu item, price, modifier,
  allergen, availability, preparation station and effective time.
- **PRD-PROD-FR-013:** Server MUST open a service session and create draft orders
  with rounds, quantity, item note, allergen note and service/serve-together policy.
- **PRD-PROD-FR-014:** Sending an order MUST freeze the submitted snapshot and
  route food to Kitchen and beverage to Bar using station configuration.
- **PRD-PROD-FR-015:** Server/Manager MUST be able to cancel or modify only
  allowed draft/sent items; changes after preparation require reason/permission.
- **PRD-PROD-FR-016:** Kitchen and Bar MUST see only their station tickets and
  required table/order context, not payment data outside their scope.
- **PRD-PROD-FR-017:** Station staff MUST accept, prepare, complete, delay or
  reject a ticket item with reason; delay/shortage creates an operational signal.
- **PRD-PROD-FR-018:** Server MUST see ready items, pick up and mark served;
  system MUST record preparation, pickup and serving timestamps.
- **PRD-PROD-FR-019:** Additional orders MUST preserve round/session history and
  route through the same station and inventory contract.
- **PRD-PROD-FR-020:** Item unavailable MUST be visible before send when known;
  staff may reject with guest-safe alternative without silently deleting intent.

#### Billing, payment and end-of-day

- **PRD-PROD-FR-021:** Server/Cashier MUST create a bill from served/open order
  lines with price snapshots, tax, service charge, discount and adjustment audit.
- **PRD-PROD-FR-022:** Discount/promotion MUST enforce amount/role limits and
  require Manager approval above configured threshold.
- **PRD-PROD-FR-023:** Bill MUST support split by item, guest, equal amount or
  custom amount while total allocated amount equals bill total.
- **PRD-PROD-FR-024:** Payment MUST support configured cash, card, transfer and
  e-wallet methods through a provider abstraction with idempotent reference.
- **PRD-PROD-FR-025:** Payment webhook/retry MUST not double-post; bill can become
  `PAID` only after a verified successful payment or authorized manual policy.
- **PRD-PROD-FR-026:** Refund/void MUST require permission, reason, original
  payment reference and compensating financial/audit event.
- **PRD-PROD-FR-027:** System MUST issue print/e-receipt according to configured
  channel and protect payment/guest PII.
- **PRD-PROD-FR-028:** End-of-day MUST reconcile unpaid, voided, refunded bills
  and payment method totals before shift/branch close.

#### BOH, inventory and FOH integration

- **PRD-PROD-FR-029:** Recipe version and station/menu mapping MUST link served
  sales to theoretical ingredient usage when sales data is valid.
- **PRD-PROD-FR-030:** Every receipt, transfer, count, wastage, correction and
  served sales event MUST be traceable to branch, actor, source and timestamp.
- **PRD-PROD-FR-031:** Stock mutation MUST remain transaction-safe, canonical-unit,
  non-negative in MVP policy and idempotent.
- **PRD-PROD-FR-032:** Missing/unmapped sales MUST be labeled incomplete and MUST
  not silently become zero or mutate inventory.
- **PRD-PROD-FR-033:** Owner/Manager report MUST connect occupancy, service time,
  ticket delay, revenue, stock usage, variance and wastage by branch/date.

#### Reliability, privacy and production operations

- **PRD-PROD-FR-034:** Every command MUST expose stable error code, recovery path,
  idempotency behavior and audit event.
- **PRD-PROD-FR-035:** Public QR/reservation/payment endpoints MUST use rate limit,
  CSRF/session protection appropriate to auth mode and generic token failures.
- **PRD-PROD-FR-036:** Payment details, passwords, raw tokens and unnecessary PII
  MUST not enter logs, analytics, AI prompts or exports.
- **PRD-PROD-FR-037:** System MUST expose health/readiness, structured logs,
  request ID, job retry state, backup/restore procedure and operator alerts.
- **PRD-PROD-FR-038:** Export MUST preserve permission scope, timezone, `as_of`
  and source references; import/replay MUST be validated and idempotent.

### 12.4 Production acceptance gates

- Guest can complete reservation, walk-in queue, seating, table QR/add-on,
  payment and receipt while a staff-only fallback remains available.
- Host cannot seat a dirty/blocked table; cleaning turnaround and readiness are
  observable and audited.
- A server can create, send, track and serve multi-round orders routed separately
  to Kitchen and Bar.
- Kitchen/Bar cannot see unauthorized payment/revenue data and cannot mutate bill.
- Cashier can split, partially pay, complete, void/refund according to permission;
  retry/webhook does not double-post.
- Every paid session reaches cleaning and end-of-day reconciliation without
  losing order, payment, inventory or audit history.
- BOH stock/wastage remains traceable from purchase/receipt/transfer/count and,
  when mapped, from menu order/recipe sales.
- Cross-branch isolation, audit completeness, migration/backup/restore, API
  contract, browser accessibility, load/error/recovery and security tests pass.

### 12.5 Decisions required before production pilot

- Reservation capacity/hold/grace/no-show policy and overbooking policy.
- Table readiness checklist, cleaning SLA and staff assignment rules.
- Menu price/version/effective-time policy and modifier/allergen governance.
- Station routing and course/serve-together behavior.
- Tax/service charge/discount/promotion/refund authority and local compliance.
- Payment providers, webhook trust, settlement/reconciliation and receipt channel.
- Shift/attendance scope and whether attendance is operational only or integrated.
- Sales-to-recipe mapping, missing sales behavior and inventory valuation policy.
- Backup retention, recovery target, alert ownership and production deployment target.
