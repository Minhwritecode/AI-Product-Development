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
```

## 6. MoSCoW decision

### Must

Master data, PO, goods receipt, warehouse/branch stock, request workflow, daily count, wastage, dashboard basics, auth/RBAC, audit, validation, transaction integrity.

### Should

AI onboarding, AI Copilot read-only, dashboard cache, CSV export, partial receipt, approval history.

### Could

POS sync, expiry/batch/lot, stock adjustment, supplier performance, scheduled reports, advanced alerts.

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
