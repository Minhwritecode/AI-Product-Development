# 3.2 Product Requirements Document (PRD)

## 1. Thông tin tài liệu

| Trường | Giá trị |
|---|---|
| Product | Luminex |
| Version | 0.1 MVP baseline |
| Owner | Product/Engineering team |
| Status | Draft for validation |
| Primary scope | BOH Inventory & Wastage Management + FOH Lite QR |
| Future boundary | Full FOH/POS integration |

## 2. Product goals

1. Tạo một nguồn dữ liệu tập trung cho ingredient, supplier, branch và recipe.
2. Trace được purchase order → goods receipt → warehouse stock → branch request → branch stock → daily count → wastage.
3. Cho phép owner/manager xem stock, discrepancy và wastage theo branch/ingredient.
4. Giảm thời gian nhập recipe bằng AI onboarding nhưng giữ human approval.
5. Chuẩn bị mô hình dữ liệu để nhận sales/POS từ FOH và tính theoretical usage.
6. Giảm bất định ở cửa vào và giảm độ trễ order thêm tại bàn bằng QR, nhưng vẫn giữ hospitality và staff control.

## 3. Non-goals / out of scope trong MVP

- Full reservation engine, table map/seat assignment và customer account.
- Customer ordering, server assignment, serving workflow.
- Kitchen Display System, Bar tickets, cooking status.
- Customer billing, payment, refund, e-receipt.
- Payroll, attendance, shift scheduling.
- General ledger, tax filing, full accounting.
- Supplier self-service portal.
- Autonomous AI decisions, demand forecasting, auto-PO.
- Enterprise HA, multi-region DR, fraud detection.

FOH Lite QR là ngoại lệ có chủ đích: chỉ xử lý availability/queue transparency trước cửa và add-on/assistance request tại bàn. Đây không phải full FOH restaurant suite.

## 4. Personas và quyền chính

| Role | Read | Write/Action | Approval |
|---|---|---|---|
| Purchasing Manager | Master data, PO, receipt status, dashboard | Supplier, PO | Theo policy, TBD |
| Warehouse Admin | Ingredient, PO, warehouse/branch stock, request | Receipt, transfer shipment, master stock data | Approve/reject stock request |
| Branch Manager | Branch stock, own requests/counts/wastage | Request, daily count, wastage | Có thể submit; approval TBD |
| Owner | Toàn cảnh dashboard/report | Không sửa operational record mặc định | Read-only |
| Admin | Toàn hệ thống | User, role, configuration | Override có audit |
| Guest | Chỉ session/queue/table token hiện tại | Join/leave queue, add-on draft, assistance request | Không có approval |

AI không phải role. AI thực thi dưới quyền hiện tại của user và không được vượt quyền.

## 5. Core workflow

```text
Master Data
  → Purchase Order: Draft → Sent → Delivered
  → Goods Receipt: receive + compare + update warehouse stock
  → Branch Stock Request: Requested → Approved/Rejected → Shipped → Closed
  → Daily Count: opening + received + theoretical sold + closing
  → Wastage: reason + quantity + value
  → Dashboard + AI assistance
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

## 8. Data principles

- Tất cả quantity có unit rõ; quy đổi về stock unit trước khi tính tồn.
- Price dùng decimal, không dùng floating point cho giá trị tiền.
- Timestamp lưu UTC; UI hiển thị timezone cấu hình.
- Không hard-delete operational record; dùng status/void với audit.
- Snapshot `standard_price` vào wastage record để lịch sử không đổi khi master price cập nhật.

## 9. MVP acceptance gates

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

## 10. Open decisions

- Partial goods receipt và PO approval: quyết định trước pilot.
- Daily count/wastage approval: owner và SLA cần xác nhận.
- Actual purchase cost vs standard price: MVP dùng standard price, milestone 2 xem xét actual cost.
- POS integration contract: chưa khóa trong MVP; xem architecture data model.
