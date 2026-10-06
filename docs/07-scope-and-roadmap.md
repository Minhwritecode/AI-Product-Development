# Full Restaurant Operations — Scope & Implementation Plan

## 1. Production target

Luminex production core phải vận hành được một nhà hàng nhiều chi nhánh từ lúc
khách đặt/chờ bàn tới khi thanh toán, bàn được vệ sinh, ca được đối soát và
nguyên liệu được truy vết:

```text
Setup/RBAC/Shift
  → Reservation hoặc Walk-in/QR Queue
  → Table Ready → Seating → Service Session
  → Menu/Modifier → Order Round → Kitchen/Bar Ticket
  → Prepare → Serve → Add-on/Additional Round
  → Bill → Discount/Split → Payment/Refund/Receipt
  → Cleaning → Table Ready → End-of-Day Reconciliation

BOH: Master → PO → Receipt → Warehouse Stock
  → Branch Request/Shipment → Count → Wastage/Variance → Dashboard/Report

Order + Recipe + Sales Mapping → Theoretical Usage → FOH/BOH Decision Support
```

### Production core included

- Restaurant, branch, area, table, service hours, locale, currency và configuration.
- User, role, permission, branch membership, shift, assignment, task và audit.
- Reservation, walk-in, front-door QR, queue, call, no-show, cancel/reschedule.
- Floor/table status, seating, transfer, merge, cleaning và table readiness.
- Menu category/item, price/version, modifier, allergen, availability, recipe/station.
- Service session, multi-round order, notes, add-on, order cancellation và routing.
- Kitchen/Bar station tickets, delay/shortage/reject, hand-over và serving status.
- Bill, tax/service charge, discount approval, split bill, payment, refund, receipt.
- End-of-day reconciliation theo branch/shift/payment method.
- BOH master, purchasing, receipt, ledger/stock, branch request, count, wastage.
- Dashboard/report cho occupancy, service, revenue, payment, stock và wastage.
- QR guest flow, notification/task lifecycle, AI suggestion/read-only có approval.

### Explicitly outside production core

- Payroll, benefits, HR compliance và attendance-to-payroll calculation.
- General ledger, tax filing, accounting consolidation và supplier self-service portal.
- Autonomous AI, auto-PO không duyệt, exact table-turnover promise và automated compensation.
- Multi-region HA/DR, enterprise SSO/SCIM, fraud platform và data warehouse.

## 2. Dependency order

1. Platform: API contract, auth, branch scope, migration, audit, idempotency.
2. Configuration/master: restaurant, branch, table, staff, unit, menu, recipe, station.
3. BOH source of truth: PO, receipt, stock, branch request, count, wastage.
4. FOH availability: reservation, walk-in, queue, table readiness, seating.
5. Service execution: session, order, Kitchen/Bar ticket, serving, add-on.
6. Financial close: bill, discount, split, payment, refund, receipt, end-of-day.
7. Visibility/control: task, notification, reporting, integrations, AI.
8. Production hardening: security, performance, recovery, backup, UAT and release.

Không xây screen độc lập trước khi backend command, state machine, permission,
data contract, fixture và failure/recovery path của capability đó được chốt.

## 3. Implementation plan theo tuần

Mỗi tuần phải tạo một vertical slice có migration/domain/API/UI/test và acceptance
evidence. Các tính năng trong cùng tuần chỉ được làm song song khi không sửa cùng
boundary và không tạo hai nguồn sự thật.

### Tuần 1 — Platform foundation

**Scope:** Fastify module loader, `/api/v1` envelope, error codes, request ID,
config/env, PostgreSQL connection, migration runner, seed/fixture, test harness.

**Acceptance:** migration chạy từ DB rỗng; health/readiness phân biệt process và
dependency; error response ổn định; frontend API client và route shell hoạt động.

### Tuần 2 — Auth, RBAC, branch scope và restaurant setup

**Scope:** User, Role, Permission, BranchMembership, Restaurant, Branch, Area,
Table, service hours, timezone, currency, locale, session revocation.

**Acceptance:** Admin cấu hình được nhà hàng/branch/area/table; backend chặn
cross-branch và station/financial scope; mọi permission change có audit.

### Tuần 3 — Staff, shift, assignment và operational tasks

**Scope:** StaffProfile, Shift, ShiftAssignment, StationAssignment, task owner,
handover, escalation và notification event foundation.

**Acceptance:** Manager phân công Host/Server/Kitchen/Bar/Cashier theo branch;
task đúng role/station; conflict và handover có trạng thái, owner, timestamp.

### Tuần 4 — BOH master data và menu/recipe foundation

**Scope:** Ingredient, unit/conversion, Supplier, MenuCategory, MenuItem,
MenuVersion, Modifier, Allergen, RecipeVersion, StationAssignment.

**Acceptance:** canonical stock unit, conversion > 0, price/effective time,
availability, recipe version và station mapping đều validate; order history không
đổi khi master version đổi.

### Tuần 5 — Purchasing, goods receipt và warehouse ledger

**Scope:** PO/lines, supplier delivery, receipt discrepancy, confirmed receipt,
warehouse stock projection, append-only ledger và idempotency.

**Acceptance:** Draft → Sent → Delivered policy rõ; receipt draft không mutate;
confirm atomically update receipt/stock/ledger/audit; retry không double-add.

### Tuần 6 — Branch stock, transfer và count/wastage

**Scope:** StockRequest, approval/rejection, shipment/in-transit/acceptance,
BranchStock, DailyCount, Wastage, variance, standard-price snapshot.

**Acceptance:** warehouse không trừ trước approval; branch acceptance đúng state;
missing theoretical sold là incomplete; wastage reason/value/source/actor đầy đủ.

Full correction/reversal, period lock và approval nâng cao dùng contract đã chuẩn
bị nhưng triển khai sau khi flow count/wastage cơ bản ổn định.

### Tuần 7 — BOH dashboard, audit viewer và reconciliation baseline

**Scope:** stock/low-stock, PO/receipt discrepancy, request, variance/wastage,
branch comparison, `as_of`, freshness, source drill-down, audit query.

**Acceptance:** Owner/Manager xem đúng scope; mọi KPI drill-down về source record;
cache không làm sai dữ liệu; incomplete theory không trình bày thành zero.

### Tuần 8 — Reservation, walk-in và front-door QR queue

**Scope:** Reservation state, availability, holds, arrival/no-show, WalkIn/Queue,
party/time budget, QR language, join/leave/call/expire, notification option.

**Acceptance:** reservation không overlap policy; Host và QR dùng chung queue;
guest không cần app/login; wait range + timestamp + fallback; duplicate join không tạo entry.

### Tuần 9 — Floor, table readiness, seating và cleaning

**Scope:** Table state, table hold, service session creation, accessibility,
transfer/merge, cleaning task, readiness check và priority khi có guest waiting.

**Acceptance:** không seat table dirty/blocked; seating mở session; paid session
tạo cleaning; chỉ confirmed clean mới trở thành READY; transfer/merge giữ history.

### Tuần 10 — Menu experience và service session/order entry

**Scope:** Staff menu, guest table QR menu, order draft, round, modifier,
allergen, note, course/serve-together policy, add-on request.

**Acceptance:** Server chỉ order session được phép; draft sửa được; table QR xác
nhận đúng bàn; add-on bắt đầu `SUBMITTED`, có idempotency và staff fallback.

### Tuần 11 — Kitchen và Bar station execution

**Scope:** Ticket snapshot, food/beverage routing, station board, accept,
preparing, ready, delay, shortage, reject, ticket hand-over.

**Acceptance:** Kitchen/Bar chỉ thấy station scope; notes/modifiers không mất;
delay/reject cần reason; ticket không sửa bill/payment/stock trực tiếp.

### Tuần 12 — Serving, additional rounds và hospitality status

**Scope:** Server ready queue, pickup/serve timestamps, additional order rounds,
guest status, staff acknowledge/route/complete, notification/task updates.

**Acceptance:** không duplicate served line; prepared/pickup/serve traceable;
serve-together không mất item; guest thấy status nhưng không nhận promise giả.

### Tuần 13 — Billing, tax, service charge, discount và split bill

**Scope:** Bill snapshot, item/price/tax/service charge, discount policy/approval,
split by item/guest/equal/custom, void command.

**Acceptance:** tổng bill con bằng bill gốc; discount threshold enforce; paid bill
không sửa trực tiếp; void/adjustment có reason, permission và audit.

### Tuần 14 — Payments, refunds, receipts và end-of-day

**Scope:** Payment adapter, cash/card/transfer/e-wallet, pending/failed/success,
webhook idempotency, refund, receipt, branch/shift reconciliation và close.

**Acceptance:** provider timeout không báo paid giả; retry/webhook không double-post;
refund có original reference; close phân biệt unpaid/void/refund/payment difference.

### Tuần 15 — Reporting, integration boundary và AI

**Scope:** occupancy/no-show/table turnover, service/ticket delay, revenue/payment,
stock/wastage, recipe usage mapping, POS/import contract, quarantine/replay contract,
AI authorized projection, recipe suggestion và read-only copilot.

**Acceptance:** reports có branch/timezone/as_of/source; unmapped external event
không mutate stock; AI không direct DB/mutation; suggestion có confidence/warning/approval.

### Tuần 16 — Production hardening và release readiness

**Scope:** security review, rate limit, PII/token/payment redaction, performance,
background retry, backup/restore, observability, migration rollback, accessibility,
browser/device matrix, failure drills và end-to-end UAT.

**Acceptance:** full guest/FOH/BOH/billing journeys pass; cross-branch isolation;
duplicate/retry/timeout/DB failure recovery; kitchen/bar/payment privacy; backup
restore verified; release checklist và runbook hoàn thành.

## 4. Production release gates

- Reservation, queue, seating, cleaning, order, Kitchen, Bar, serving, bill,
  payment, receipt và end-of-day đều có state machine và recovery path.
- Mọi financial/inventory mutation có authorization, idempotency, transaction,
  audit, source reference và reconciliation.
- Không có table seat khi chưa ready; không có order route sai station; không có
  payment success giả; không có duplicate payment/stock/order khi retry.
- Kitchen/Bar/Cashier thấy đúng dữ liệu role; guest không lộ PII/session/payment.
- UI có loading/empty/stale/error/retry/permission/fallback; browser verification
  hoàn tất cho guest mobile và staff tablet/desktop.
- Migration, seed, backup/restore, logs, health/readiness, alert và runbook sẵn sàng.
- PRD, requirements, stories, feature specs, architecture, API/data model và
  test evidence trace cùng một production capability ID.

## 5. Decisions required before pilot

- Reservation hold/grace/no-show/overbooking và table assignment policy.
- Cleaning checklist/SLA, service course và serve-together behavior.
- Menu/price/modifier/allergen versioning và local tax/service-charge rules.
- Payment providers, webhook trust, settlement, refund authority và receipt channel.
- Shift/attendance scope, business-day timezone và branch close authority.
- Inventory valuation, POS/sales mapping, missing-sales behavior và accounting export.
- Backup retention, recovery target, deployment environment và alert ownership.

## 6. Definition of Ready / Done

### Ready

Story có actor, pain point, business outcome, precondition, input/output, role/
branch scope, state transition, data contract, failure/recovery path, dependency,
fixture và UI state nếu có giao diện.

### Done

Code, migration, API contract, UI states, audit, tests, browser evidence, docs,
runbook và traceability cập nhật; không có secret; không có mutation thiếu
transaction/idempotency; không có role vượt scope; không có roadmap capability
được trình bày như production live.
