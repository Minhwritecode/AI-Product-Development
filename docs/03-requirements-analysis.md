# 3.3 Phân tích yêu cầu

## 1. Phương pháp

Yêu cầu được phân rã theo capability, actor, business rule, data dependency và mức ưu tiên. `MUST` là điều kiện để core workflow chạy; `SHOULD` làm tăng chất lượng vận hành; `COULD` để milestone sau; `WON'T` không thuộc MVP.

## 2. Requirement catalogue

| ID | Requirement | Priority | Actor | Depends on |
|---|---|---:|---|---|
| FR-MD-01 | CRUD ingredient + unit/conversion | MUST | Admin/Warehouse | — |
| FR-MD-02 | CRUD supplier | MUST | Purchasing | — |
| FR-MD-03 | CRUD branch | MUST | Admin | User |
| FR-MD-04 | Menu item + recipe line | MUST | Admin/Warehouse | Ingredient |
| FR-PO-01 | Create/edit draft PO | MUST | Purchasing | Supplier, Ingredient |
| FR-PO-02 | Send PO và status | MUST | Purchasing | PO |
| FR-GR-01 | Record goods receipt | MUST | Warehouse | PO |
| FR-GR-02 | Compare ordered/received | MUST | Warehouse | Receipt |
| FR-GR-03 | Increase stock after confirm | MUST | System | Receipt, Stock |
| FR-ST-01 | View warehouse/branch stock | MUST | All scoped roles | Ingredient, Branch |
| FR-ST-02 | Transaction-safe stock mutation | MUST | System | PostgreSQL |
| FR-BR-01 | Create branch request | MUST | Branch Manager | Branch, Ingredient |
| FR-BR-02 | Approve/reject request | MUST | Warehouse | Request |
| FR-BR-03 | Ship and close request | MUST | Warehouse | Approval, Stock |
| FR-DC-01 | Submit daily count | MUST | Branch Manager | Branch Stock |
| FR-DC-02 | Calculate variance | MUST | System | Daily Count |
| FR-WA-01 | Record wastage reason/quantity | MUST | Branch Manager | Daily Count |
| FR-WA-02 | Calculate wastage value | MUST | System | Standard Price |
| FR-DB-01 | Stock and low-stock dashboard | MUST | Owner/Manager | Stock |
| FR-DB-02 | Wastage/variance dashboard | MUST | Owner/Manager | Count, Wastage |
| FR-AI-01 | Parse recipe text to suggestion | SHOULD | Authorized user | Ingredient, LLM |
| FR-AI-02 | Review/edit/approve AI result | MUST | Authorized user | AI suggestion |
| FR-AI-03 | Authorized data Q&A | SHOULD | Authorized user | Dashboard data |
| FR-AU-01 | Login and RBAC | MUST | All | User |
| FR-AU-02 | Branch/data scope | MUST | All | Role, Branch |
| FR-AU-03 | Audit log | MUST | System | Mutation events |
| FR-FOH-01 | Front-door QR availability/queue view | MUST | Guest/Staff | Table status, queue |
| FR-FOH-02 | Join/leave queue with time budget | MUST | Guest/Host | Queue policy |
| FR-FOH-03 | Multilingual, no-login guest entry | MUST | Guest | Content/localization |
| FR-FOH-04 | Signed table QR session | MUST | Guest/Staff | Table/session |
| FR-FOH-05 | Add-on order request + assistance | MUST | Guest | Menu, table session |
| FR-FOH-06 | Staff acknowledge/route QR request | MUST | Host/Server/Manager | Request status |
| FR-FOH-07 | Guest privacy and staff fallback | MUST | System/Staff | Auth/session policy |
| FR-OP-01 | Configure branch, warehouse/location, table, service state and queue policy | MUST | Admin/Manager | Branch, Table, Queue |
| FR-OP-02 | Manage user, role, branch membership and session lifecycle | MUST | Admin | User, Role, Branch |
| FR-OP-03 | Rotate/revoke table token and expose privacy-safe guest session | MUST | Admin/System | TableSession |
| FR-NF-01 | Guest/staff notification preference, delivery status and retry | MUST | Guest/Staff/System | Queue, FOHRequest |
| FR-NF-02 | Staff task inbox, owner, due time and escalation status | SHOULD | Host/Manager/Warehouse | Notification, Request |
| FR-CTL-01 | Controlled stock adjustment, reversal/void and reconciliation | SHOULD | Warehouse/Manager | InventoryLedger, Audit |
| FR-CTL-02 | Partial receipt/transfer, damaged/rejected and branch acceptance | SHOULD | Warehouse/Branch | PO, StockRequest |
| FR-CTL-03 | Count/wastage approval, period lock and controlled reopen | SHOULD | Owner/Manager | DailyCount, Wastage |
| FR-INT-01 | Validated CSV import/export with error report | SHOULD | Admin/Owner | Master Data, Ledger |
| FR-INT-02 | POS batch quarantine, replay and reconciliation | COULD | Integration Owner | Sales event, Mapping |

## 3. Business rules

| ID | Rule |
|---|---|
| BR-01 | Không lưu ingredient nếu conversion rate ≤ 0. |
| BR-02 | `stock_qty` luôn được lưu ở stock unit canonical. |
| BR-03 | Goods receipt chỉ được confirm một lần cho cùng idempotency key. |
| BR-04 | Stock không được âm trừ khi policy explicitly cho phép; MVP không cho âm. |
| BR-05 | Request phải ở `Approved` trước khi shipment được confirm. |
| BR-06 | Shipment quantity ≤ available warehouse stock. |
| BR-07 | Branch user chỉ tạo/xem request/count/wastage của branch được gán. |
| BR-08 | `variance_qty = opening + received - theoretical_sold - closing`. |
| BR-09 | Nếu theoretical sold unavailable, variance được flag chứ không coi là zero một cách im lặng. |
| BR-10 | Wastage value dùng standard price snapshot tại thời điểm record. |
| BR-11 | Operational record không hard-delete sau khi đã dùng trong transaction. |
| BR-12 | AI output là suggestion và không mutate DB trước approval. |
| BR-13 | Câu hỏi AI phải lọc theo quyền hiện tại của user. |
| BR-14 | FOH data/POS integration không được coi là source-of-truth nếu chưa có mapping/version. |
| BR-15 | Front-door QR hiển thị estimated wait dạng range + `as_of`; không hiển thị thời điểm rời bàn của khách cụ thể như cam kết. |
| BR-16 | Join queue cần party size và time budget; contact chỉ bắt buộc cho notification. |
| BR-17 | Queue status phải có leave/cancel rõ ràng và không dùng dark pattern. |
| BR-18 | Table QR phải dùng signed token, xác nhận đúng bàn và không lộ PII của khách khác. |
| BR-19 | Add-on/assistance request chỉ trở thành operational request sau khi staff acknowledge/route. |
| BR-20 | QR flow luôn có staff fallback cho khách lớn tuổi, accessibility needs hoặc không muốn dùng điện thoại. |
| BR-21 | Queue/service state chỉ được thay đổi qua command có quyền; manual override bắt buộc reason và audit. |
| BR-22 | Guest session/table token có expiry; token failure trả response generic và không làm lộ table/session data. |
| BR-23 | Notification là side effect có thể fail, không quyết định business status; retry phải idempotent và bounded. |
| BR-24 | Correction không sửa/xóa ledger event gốc; phải tạo compensating event liên kết record nguồn. |
| BR-25 | Partial receipt/transfer phải tách accepted, damaged/rejected, in-transit và backordered quantity. |
| BR-26 | Import lỗi hoặc POS event chưa map phải vào quarantine, không tự mutate stock/theoretical usage. |

## 4. Use-case analysis

### UC-01: Receive goods

1. Warehouse chọn PO ở trạng thái Sent.
2. Nhập received quantity từng line.
3. Hệ thống validate quantity/unit và tính discrepancy.
4. User confirm receipt.
5. Transaction ghi receipt, cập nhật warehouse stock, tạo audit event.
6. UI hiển thị receipt result và discrepancy.

Failure paths: PO không tồn tại, đã closed, quantity âm, duplicate submission, DB transaction fail.

### UC-02: Fulfil branch request

1. Branch Manager submit request.
2. Warehouse review requested quantity và current stock.
3. Approve/reject; reject cần reason.
4. Nhập shipped quantity.
5. Confirm shipment; trừ warehouse, cộng branch/in-transit theo transaction.
6. Close request khi đủ bước.

Failure paths: unauthorized branch, insufficient stock, request rejected/closed, duplicate shipment.

### UC-03: Submit daily count and wastage

1. Branch Manager chọn branch/date.
2. Nhập opening, received, theoretical sold nếu có, closing.
3. Hệ thống tính variance và hiển thị trước khi submit.
4. User thêm wastage quantity/reason.
5. Hệ thống chụp standard price và tính value.
6. Submit; dashboard đọc record đã lưu.

Failure paths: duplicate date/ingredient, unit mismatch, missing reason, negative quantities.

### UC-04: AI recipe onboarding

1. User nhập free text.
2. AI service trả structured suggestion + warnings/confidence.
3. User sửa/loại/thêm line.
4. User approve từng line hoặc toàn bộ.
5. Backend validate lại và save recipe.

Failure paths: timeout, malformed output, unknown ingredient, low confidence, user cancel.

### UC-05: Front-door availability and queue

1. Guest scan standy QR và chọn language.
2. Guest nhập party size, time budget và optional accessibility need.
3. Hệ thống trả availability/estimated wait range/queue state với timestamp.
4. Guest join queue hoặc rời flow; nếu join thì nhận queue code và notification option.
5. Host thấy queue item, gọi/mark seated/cancel theo policy.

Failure paths: stale availability, queue full, network error, wait vượt time budget, duplicate join.

### UC-06: Table QR add-on request

1. Guest scan signed table QR.
2. Hệ thống hiển thị đúng table/session context và menu.
3. Guest chọn item, quantity, note/allergen và submit.
4. Staff acknowledge, accept/reject/route; guest thấy status.
5. Khi hoàn tất, staff mark served hoặc cần hỗ trợ thêm.

Failure paths: invalid/expired token, wrong table confirmation, item unavailable, duplicate submit, timeout, staff reject.

### UC-07: Configure operating state and queue policy

1. Admin tạo/cập nhật branch, warehouse/location, table capacity, service hours và queue policy.
2. Manager mở/pauses/closes queue theo operating state; nếu override estimate phải nhập reason.
3. Hệ thống validate conflict về timezone, capacity, token và quyền branch.
4. Mọi thay đổi được audit và cập nhật cache/status read model.

Failure paths: unauthorized branch, invalid policy, overlapping service hours, revoked token, stale cache.

### UC-08: Correct and reconcile inventory

1. Warehouse/Manager chọn discrepancy từ ledger/count/receipt/transfer.
2. User tạo adjustment hoặc reversal với quantity, reason, source record và evidence nếu policy yêu cầu.
3. Người có quyền approve; transaction ghi compensating ledger event và audit.
4. Reconciliation report hiển thị before/after, unresolved difference và owner.

Failure paths: correction vượt policy, approval conflict, duplicate idempotency key, negative stock hoặc source đã locked.

## 5. Dependency graph

```text
Auth/User/Role
  └── Branch scope
       ├── Master Data: Ingredient, Supplier, Branch, Menu/Recipe
       ├── Purchase Order ──> Goods Receipt ──> Warehouse Stock
       └── Warehouse Stock ──> Branch Request ──> Branch Stock
                                      └──────────> Daily Count ──> Wastage
                                                                    └─> Dashboard
Master Data + Recipe ──> AI Onboarding
All authorized data ──> AI Copilot
FOH/POS sales ──(future)─> sold_qty_theory
Front-door QR ──> Queue/Guest Session ──> Host/FOH Console
Table QR ──> Add-on/Assistance Request ──> Staff Acknowledge ──> BOH/POS boundary
Branch/Queue/Table config ──> FOH status + token policy + notification/task routing
Inventory correction ──> Compensating ledger ──> Reconciliation/Audit
```

## 6. MoSCoW decision

### Must

Master data, PO, goods receipt, warehouse/branch stock, request workflow, daily count, wastage, dashboard basics, auth/RBAC, audit, validation, transaction integrity.

### Should

AI onboarding, AI Copilot read-only, dashboard cache, CSV export, task inbox, notification retry, stock correction/reconciliation, partial receipt, count/wastage approval.

### Could

POS sync, expiry/batch/lot, supplier performance, scheduled reports, advanced alerts, POS quarantine/replay.

### Won’t for MVP

FOH transaction screens, customer payment, KDS/bar, payroll, accounting, supplier portal, autonomous AI, forecasting, enterprise HA.

## 7. Traceability matrix

| Product goal | PRD section | Stories | Feature spec |
|---|---|---|---|
| Central inventory source | 6.1, 6.4 | US-MD-01..04, US-ST-01..03 | F-01, F-04 |
| Trace purchasing to receipt | 6.2, 6.3 | US-PO-01..04, US-GR-01..03 | F-02, F-03 |
| Control branch loss | 6.5, 6.6 | US-BR-01..04, US-DC-01..04 | F-05, F-06 |
| Business visibility | 6.7 | US-DB-01..03 | F-07 |
| Safe AI assistance | 6.8 | US-AI-01..04 | F-08 |
| FOH → BOH foundation | goals, data principles | US-INT-01..02 | F-09 |
| Guest-facing hospitality | 6.9, 6.10 | US-FOH-01..08 | F-10, F-11 |
| Reliable FOH operation | 6.11, 6.12 | US-OP-01..03, US-NF-01..02 | F-12, F-13 |
| Controlled correction and scale | 6.13, 6.14 | US-CTL-01..03, US-INT-03 | F-14, F-15 |

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Sai unit conversion | High | canonical stock unit, validation, conversion test fixtures |
| Missing sales data | High | nullable/flagged theoretical sold; no silent zero |
| Low adoption | High | fast forms, mobile/tablet-friendly UI, pilot with one branch |
| Incorrect AI output | Medium/High | schema validation, confidence/warnings, approval gate |
| Scope creep FOH | High | ADR BOH-first, integration contract riêng |
| Duplicate stock mutation | Critical | DB transaction + idempotency + audit |

## 9. Definition of Ready / Done

### Ready

Story có actor, business value, precondition, acceptance criteria, data fields, permission scope và dependency.

### Done

Code + migration + API contract + UI state + tests + audit + docs được cập nhật; acceptance criteria pass; không có secret trong commit.
