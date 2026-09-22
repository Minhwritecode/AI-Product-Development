# BRD — Luminex FOH → BOH Operating Control

## 1. Mục đích và cách dùng

Business Requirements Document này chuyển pain point vận hành thành yêu cầu kinh doanh có owner, đầu vào, đầu ra, ngoại lệ, kiểm soát và tiêu chí nghiệm thu. BRD là tầng business baseline; PRD, requirements analysis, feature specifications và user stories phải triển khai đúng các ràng buộc ở đây.

Tài liệu áp dụng cho hai vùng:

- **FOH Lite:** trải nghiệm khách trước cửa và tại bàn bằng QR, cùng console điều phối của host/server.
- **BOH Core:** purchasing, goods receipt, warehouse/branch stock, daily count, wastage, dashboard và AI hỗ trợ có phê duyệt.

Các màn hình Stitch trong [UI/UX references](uiux/README.md) là prototype tham chiếu. Chúng không thay thế BRD và không phải source of truth cho business rule.

## 2. Thứ tự ưu tiên nguồn

Khi có mâu thuẫn, áp dụng theo thứ tự:

1. Quyết định đã được owner phê duyệt và ghi vào decision log.
2. BRD này cho business rule và boundary.
3. PRD cho scope, goal và acceptance gate.
4. Requirements analysis cho priority, dependency và risk.
5. Feature specifications cho API, state machine và data behavior.
6. User stories cho ticket-level acceptance.
7. Stitch prototype cho layout, content direction và interaction reference.

Prototype, ảnh chụp và HTML không được tự mở rộng scope hoặc tự biến thành yêu cầu triển khai.

## 3. Bối cảnh kinh doanh

Nhà hàng ở trung tâm thành phố/phố đi bộ có hai áp lực đồng thời:

- **FOH:** lượng khách walk-in và khách du lịch tăng đột biến; khách không biết có bàn hay phải chờ bao lâu; khách đã ngồi phải gọi nhân viên nhiều lần để gọi thêm món; staff phải giữ hospitality trong khi phục vụ nhiều bàn.
- **BOH:** nguyên liệu đi qua nhiều bước mua, nhận, lưu kho, chuyển kho, kiểm kê và ghi hao hụt; dữ liệu rời rạc làm owner không biết chênh lệch đến từ receiving, conversion, branch, recipe, thao tác hay waste.

Nếu chỉ tối ưu FOH, nhà hàng có thể phục vụ nhanh hơn nhưng không giải thích được cost và hao hụt. Nếu chỉ tối ưu BOH, hệ thống có số liệu tồn nhưng không giảm được bất định của khách và tải lặp lại cho staff. Luminex nối hai vùng bằng dữ liệu có traceability, nhưng giữ ranh giới rõ: QR request không phải payment/order chính thức trước khi staff acknowledge, và FOH sales/POS chỉ là integration boundary trong milestone sau.

## 4. Mục tiêu kinh doanh và chỉ số

| Mục tiêu | Chỉ số | Mức mục tiêu ban đầu | Nguồn đo |
|---|---|---:|---|
| Giảm bất định trước cửa | Guest hiểu availability/wait | ≥90% trong ≤30 giây | QR event + usability test |
| Giảm câu hỏi lặp lại của host | Câu hỏi “còn bàn/bao lâu” trên mỗi ca | giảm so với baseline pilot | staff tally |
| Giảm thời gian nhận yêu cầu tại bàn | Time-to-acknowledge QR request | p95 theo SLA branch | request event log |
| Giữ quyền kiểm soát hospitality | Request có staff acknowledgement trước routing | 100% | state transition audit |
| Tăng độ tin cậy tồn | Receipt/transfer/count trace tới ledger | 100% mutation | audit + ledger |
| Làm rõ hao hụt | Wastage có reason, quantity và value | ≥95% record | wastage report |
| Giảm discrepancy không giải thích | Unexplained variance theo branch | giảm theo baseline pilot | reconciliation |
| Ngăn lỗi retry | Duplicate stock mutation | 0 trong test và production alert | idempotency log |
| Giữ AI an toàn | AI suggestion được review trước mutation | 100% | approval audit |

Các ngưỡng trên là target để pilot; owner có thể điều chỉnh nhưng phải ghi lại giá trị, thời điểm hiệu lực và lý do.

## 5. Vai trò và trách nhiệm

| Vai trò | Quyết định/chịu trách nhiệm | Không được tự làm |
|---|---|---|
| Guest | Xem status, chọn party/time budget, join/leave queue, tạo request | Không xem dữ liệu bàn khác, không thanh toán qua QR MVP |
| Host | Điều phối queue, gọi/seated/cancel/expire, hỗ trợ guest | Không sửa ledger hoặc approve stock ngoài scope |
| Server/FOH lead | Acknowledge, route, reject, complete table request | Không coi request submitted là đã phục vụ |
| Branch Manager | Stock request, daily count, wastage, branch exception | Không đọc/sửa branch khác |
| Warehouse Admin | PO receiving, warehouse stock, shipment | Không tự approve correction vượt quyền |
| Purchasing Manager | Tạo/sửa/gửi PO, xử lý supplier discrepancy | Không ghi nhận hàng chưa thực nhận |
| Owner/Operations Manager | Dashboard, policy, approve exception, lock period | Không bỏ qua audit/approval bằng UI override |
| Admin | User, role, branch membership, token/policy configuration | Không bypass backend scope bằng frontend claim |
| AI service | Parse/summarize authorized projection, đưa warning/confidence | Không gọi mutation, tự approve, tự trừ stock |

## 6. Pain point và yêu cầu nghiệp vụ FOH

### 6.1 Trước cửa: không biết có nên chờ

**Pain point:** khách thấy đông nhưng không biết nhà hàng còn chỗ, wait khoảng bao lâu, queue có phù hợp thời gian của họ hay không. Khách quốc tế có thể không đọc được bảng tiếng Việt, không muốn tải app hoặc nhập số điện thoại trước khi quyết định.

**Rủi ro kinh doanh:** khách rời đi vì bất định; host trả lời cùng một câu hỏi nhiều lần; khách join queue rồi bỏ vì wait vượt time budget; nhà hàng tạo kỳ vọng sai nếu hiển thị thời điểm bàn cụ thể.

**BRD-FOH-001 — Public availability:** hệ thống phải cho guest xem trạng thái `OPEN/PAUSED/FULL/CLOSED`, số nhóm đang chờ, khoảng wait, `as_of`, confidence và limitation bằng QR trước cửa.

**BRD-FOH-002 — Decision context:** trước khi join queue, guest phải chọn language, party size và time budget. Guest được xem kết quả mà không login, không tải app và không nhập contact bắt buộc.

**BRD-FOH-003 — Privacy-safe estimate:** hệ thống chỉ hiển thị range và dữ liệu tổng hợp; không hiển thị thời điểm rời bàn hoặc thông tin nhận diện của nhóm khác.

**BRD-FOH-004 — Queue control:** guest có thể join/leave; host chỉ được call/seat/cancel/expire theo state machine. Override phải có role, reason, actor và timestamp.

**BRD-FOH-005 — Stale/recovery:** nếu dữ liệu quá TTL, queue full, branch paused hoặc wait vượt time budget, UI phải giải thích nguyên nhân và cung cấp hành động tiếp theo: xem menu, rời queue hoặc hỏi staff.

**BRD-FOH-006 — Notification choice:** contact chỉ được yêu cầu sau khi guest opt-in; nếu notification thất bại, queue code và trạng thái vẫn truy cập được, không tự đổi trạng thái business.

### 6.2 Tại bàn: gọi thêm nhưng không làm mất hospitality

**Pain point:** server phục vụ nhiều bàn nên khách phải gọi lớn hoặc chờ lâu để gọi thêm món/đá/khăn/nhân viên. Một QR thiếu xác nhận bàn có thể gửi nhầm yêu cầu; một QR biến thành order trực tiếp có thể làm staff mất quyền kiểm soát, tạo nhầm món hoặc hứa sai thời gian.

**Rủi ro kinh doanh:** duplicate request, gửi nhầm bàn, item hết hàng, khách tưởng đã order chính thức, staff không biết ai chịu trách nhiệm, hoặc khách không dùng QR bị bỏ quên.

**BRD-FOH-007 — Table trust:** table QR phải dùng signed token, không chứa PII, có rotation/revocation và hiển thị table label thân thiện để guest xác nhận trước khi submit.

**BRD-FOH-008 — Request types:** guest được tạo `ADD_ON` hoặc `ASSISTANCE`; add-on có item, quantity, note/allergen field và availability; assistance có category/urgency rõ.

**BRD-FOH-009 — Staff gate:** request bắt đầu ở `SUBMITTED`; chỉ sau staff acknowledge mới được route/prepare. Confirmation copy phải nói “Nhân viên đã nhận yêu cầu”, không nói “đã đặt món” hoặc “sẽ ra ngay”.

**BRD-FOH-010 — Duplicate/recovery:** retry cùng idempotency key trả lại request cũ. Guest thấy trạng thái, timestamp, timeout recovery, CTA gọi staff và chỉ được cancel trong policy window.

**BRD-FOH-011 — Hospitality fallback:** mọi screen QR phải có hành động hỏi/gọi staff rõ ràng; khách lớn tuổi, không có smartphone hoặc không muốn scan vẫn được phục vụ qua quy trình thủ công.

### 6.3 Console FOH

**BRD-FOH-012 — Operational ownership:** host/server phải thấy task chưa acknowledge, overdue, failed notification và request theo branch scope; task phải có owner, due time, priority và resolution note.

**BRD-FOH-013 — No hidden automation:** hệ thống không tự mark `SERVED` chỉ vì hết timer; quá hạn phải chuyển sang `NEEDS_STAFF`/exception để nhân viên xử lý.

## 7. Pain point và yêu cầu nghiệp vụ BOH

### 7.1 Master data và unit conversion

**Pain point:** cùng một nguyên liệu có thể mua theo thùng, lưu theo kg/litre và dùng trong recipe theo g/ml; nếu không có canonical unit, số lượng và cost bị sai ngay từ đầu.

**BRD-BOH-001 — Canonical item:** ingredient, supplier, branch, warehouse, menu item và recipe phải có mã ổn định, trạng thái active/inactive và owner.

**BRD-BOH-002 — Conversion:** mọi conversion rate phải dương, có source/evidence và được preview trước khi lưu. Stock mutation chỉ dùng canonical stock unit; không cho sửa/hard-delete item đã có transaction.

**BRD-BOH-003 — Recipe version:** recipe có version/effective time; thay recipe không được tính lại lịch sử nếu không có migration/decision rõ.

### 7.2 Purchasing và goods receipt

**Pain point:** PO, phiếu giao và tồn thực tế không khớp; hàng thiếu/hỏng/nhận nhiều không được phân loại nên không biết supplier hay warehouse chịu trách nhiệm.

**BRD-BOH-004 — PO lifecycle:** PO phải có supplier, warehouse/branch, line quantity/unit price, expected delivery, creator và state transition có quyền.

**BRD-BOH-005 — Receipt evidence:** goods receipt bắt buộc đối chiếu ordered, previously received, current received, accepted/damaged/rejected/backordered và discrepancy note.

**BRD-BOH-006 — Atomic posting:** receipt draft không thay đổi stock; confirm receipt ghi receipt, stock projection, append-only ledger và audit trong cùng transaction. Retry không double-add.

**BRD-BOH-007 — Exception ownership:** discrepancy phải tạo exception/task có owner, due time và resolution; không tự coi PO delivered là đã nhận đủ.

### 7.3 Warehouse, branch request và stock transfer

**Pain point:** branch xin hàng qua chat/giấy, không biết request đang ở đâu; warehouse trừ hàng nhưng branch chưa nhận; hàng đang chuyển bị tính nhầm vào tồn.

**BRD-BOH-008 — Request trace:** stock request phải có branch, ingredient, requested quantity, urgency, needed-by, requester và state.

**BRD-BOH-009 — Shipment states:** phân biệt `REQUESTED`, `APPROVED`, `IN_TRANSIT`, `RECEIVED`, `DISCREPANCY`, `REJECTED`, `CANCELLED`; chỉ `RECEIVED` mới tăng branch stock.

**BRD-BOH-010 — Atomic transfer:** ship phải decrement warehouse, tạo in-transit ledger/event và audit trong transaction; retry không double-decrement. Branch acceptance có quantity thực nhận và discrepancy reason.

**BRD-BOH-011 — Negative stock guard:** MVP không cho stock âm; nếu không đủ, hệ thống phải báo shortage và không partial-mutate ngoài policy.

### 7.4 Daily count và wastage

**Pain point:** count cuối ngày không đồng nhất; wastage chỉ ghi “mất” không ghi lý do/giá trị; POS chưa có nên theoretical sold dễ bị hiểu nhầm là zero hoặc bị suy đoán.

**BRD-BOH-012 — Count cadence:** daily count gắn branch, date/shift, counter, opening, received, theoretical sold nếu có, closing actual và status.

**BRD-BOH-013 — Formula transparency:** hiển thị `opening + received - theoretical sold - closing = variance`; khi theoretical sold unavailable, kết quả phải là `INCOMPLETE_THEORY`, không được trình bày như variance chính xác.

**BRD-BOH-014 — Wastage evidence:** wastage quantity > 0, reason bắt buộc, value dùng standard price snapshot, có note/evidence theo policy, actor và liên kết count.

**BRD-BOH-015 — Approval/lock:** count/wastage có `DRAFT → SUBMITTED → APPROVED/REJECTED → LOCKED`; reject phải có reason; record locked chỉ sửa bằng correction event.

**BRD-BOH-016 — Sign clarity:** `wastage_value` là giá trị hao hụt dương; `variance_qty` mới thể hiện âm/dương. UI không dùng một số âm để diễn đạt đồng thời hai khái niệm.

### 7.5 Dashboard và AI

**BRD-BOH-017 — Source-linked dashboard:** KPI phải có `as_of`, timezone, branch scope, freshness và drill-down tới source record.

**BRD-BOH-018 — Dashboard truth:** khi chưa có POS/sales mapping, dashboard phải hiển thị `NOT_AVAILABLE`/`INCOMPLETE_THEORY`, không dựng số sold/theoretical usage như dữ liệu thật.

**BRD-BOH-019 — AI boundary:** AI chỉ nhận authorized projection, trả suggestion/answer kèm confidence, sources, limitation và `requiresApproval`; không có quyền gọi mutation.

**BRD-BOH-020 — Human approval:** recipe/BOM suggestion phải được edit/add/delete và approve bởi authorized user; chưa approve không ghi master/stock/PO/wastage.

## 8. Yêu cầu xuyên suốt

### 8.1 Security và branch scope

- Authorization phải được kiểm tra ở backend; không tin `branch_id` hoặc role gửi từ frontend.
- Guest endpoint chỉ trả session-scoped data; lỗi token generic, không lộ table/session tồn tại.
- Token QR không chứa PII, lưu hash/metadata, có expiry/revoke/rotate.
- Public QR rate-limit theo session/token/IP policy.

### 8.2 Audit và data integrity

- Mọi state transition, approval, override, correction, token/policy change và notification retry có actor, timestamp UTC, request ID, before/after hoặc source record.
- Posted ledger immutable; sửa sai bằng compensating event liên kết event gốc.
- Idempotency bắt buộc cho queue join, add-on request, goods receipt, shipment, correction, import/replay.
- Không hard-delete operational record; deactivation/void phải giữ lịch sử.

### 8.3 UX và hospitality

- Guest flow mobile-first, Vietnamese/English, body text tối thiểu 16px, touch target tối thiểu 44×44px.
- Mỗi state có một primary CTA; trạng thái có text/icon, không dựa vào màu duy nhất.
- Có loading, empty, stale, error, retry, offline/degraded và staff fallback.
- `aria-live` cho queue/request status; focus và keyboard phải dùng được trên staff console.
- Không dark pattern: leave queue, cancel policy, privacy và estimated wait phải nhìn thấy trước khi commit.

## 9. Trạng thái chuẩn

| Domain | States | Ghi chú |
|---|---|---|
| Operating state | `OPEN`, `PAUSED`, `FULL`, `CLOSED` | Có reason/effective time |
| Queue | `WAITING`, `CALLED`, `SEATED`, `LEFT`, `EXPIRED`, `CANCELLED` | Không tự seat khi hết timer |
| FOH request | `SUBMITTED`, `ACKNOWLEDGED`, `ROUTED`, `PREPARING`, `SERVED`, `REJECTED`, `NEEDS_STAFF` | Staff gate trước routing |
| PO | `DRAFT`, `SENT`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED` | `RECEIVED` không mặc định đủ quantity |
| Shipment | `REQUESTED`, `APPROVED`, `IN_TRANSIT`, `RECEIVED`, `DISCREPANCY`, `REJECTED`, `CANCELLED` | Branch nhận mới tăng branch stock |
| Count/wastage | `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `LOCKED` | Reopen bằng correction |
| Notification | `PENDING`, `SENT`, `FAILED`, `EXPIRED` | Delivery là side effect |
| Import/POS | `RECEIVED`, `VALIDATED`, `QUARANTINED`, `REPLAYED`, `RECONCILED` | Không mutate khi quarantine |

Mọi command phải từ chối state transition không hợp lệ bằng error code ổn định; không cho client set state tùy ý.

## 10. Out of scope và guardrail

- Full reservation, seating/table map, customer account, billing/payment/refund/e-receipt không thuộc FOH Lite MVP.
- KDS/BDS, kitchen execution, split bill, loyalty/CRM, POS live sync và forecast là roadmap/reference, không được hiển thị như đã sẵn sàng trong MVP.
- Không dự đoán chính xác thời điểm một guest cụ thể rời bàn.
- Không coi QR add-on là order/payment chính thức trước staff acknowledgement.
- Không cho AI tự quyết định queue, stock, PO, wastage, payment hoặc compensation.
- Không suy ra sold quantity từ dữ liệu không được mapping/version; thiếu dữ liệu phải hiện rõ.

## 11. Business acceptance gates

Business owner chỉ chấp nhận pilot khi:

1. Mỗi flow FOH/BOH có owner, role, input, output, state, exception và audit.
2. Guest có thể xem availability, join/leave queue và request staff fallback không cần app/account.
3. Không request nào được route/prepare nếu chưa acknowledge, và retry không duplicate.
4. Receipt/ship/count/wastage trace tới ledger/source record; negative stock và invalid unit bị chặn.
5. Wastage report tách rõ quantity, reason, positive value, variance và data freshness.
6. Branch scope, token lifecycle, notification failure và correction path đã có test.
7. AI suggestion luôn có review/approval gate và authorized data projection.
8. Prototype UI đã được gắn trạng thái MVP/roadmap và không còn copy gây hiểu nhầm về POS/KDS/payment.
9. Mọi requirement có link tới PRD, requirements analysis, user story, feature spec và test case.

## 12. Traceability map

| BRD area | Existing baseline | Prototype reference |
|---|---|---|
| FOH availability/queue | PRD-US-001–004, PRD-FR-001–012, F-10 | Screen 05, 07, 16 |
| FOH table request | PRD-US-005–009, PRD-FR-013–020, F-11/F-13 | Screen 06, 07 |
| Master data/BOM | PRD-US-010/016, PRD-FR-021–022, F-01/F-08 | Screen 04, 14 |
| PO/receipt | PRD-US-010, PRD-FR-023–030, F-02/F-03 | Screen 02, 12 |
| Stock/transfer | PRD-US-011/012, PRD-FR-031–032, F-04/F-05 | Screen 11, 13 |
| Count/wastage | PRD-US-013/014, PRD-FR-033–035, F-06/F-07 | Screen 01, 03, 15 |
| RBAC/audit/config | PRD-US-017–020, PRD-FR-036–050, F-12–F-15 | Screen 16–18 |
| Future FOH | Scope & Roadmap, FOH pain-point map | Screen 08–10, 19–20 |

## 13. Các quyết định cần chốt trước khi build production

- Branch pilot, service hours, queue capacity và wait estimation algorithm.
- Notification provider, contact retention và staff call fallback.
- PO approval/partial receipt policy và người chịu trách nhiệm discrepancy.
- Count cadence, approval SLA, lock/reopen policy.
- Standard price snapshot policy và tiền tệ/rounding.
- Canonical units/conversion catalog và recipe version migration.
- API auth/session model, token TTL/rotation và rate-limit thresholds.
- Pilot threshold cho target metrics ở mục 4.
