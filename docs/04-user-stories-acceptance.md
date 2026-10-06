# 3.4 User Stories & Acceptance Criteria

Quy ước: các scenario dùng Given/When/Then. Các story BOH/FOH Lite cũ được giữ
để trace; nhóm `US-PROD-*` là baseline cho full restaurant production core.

## Master Data

### US-MD-01 — Ingredient chuẩn hóa (MVP)

Là Warehouse Admin, tôi muốn tạo ingredient cùng purchase/stock/recipe unit và conversion để tồn kho và recipe dùng cùng một chuẩn.

**Acceptance criteria**

- Given tên, unit hợp lệ và conversion dương, when tôi lưu, then ingredient được tạo với stock unit canonical.
- Given conversion bằng 0/âm hoặc unit trống, when tôi lưu, then hệ thống từ chối và chỉ rõ field lỗi.
- Given ingredient đã được dùng trong PO/count, when tôi muốn xóa, then hệ thống chặn hard-delete và hướng dẫn deactivate.

### US-MD-02 — Recipe/BOM (MVP)

Là Warehouse Admin, tôi muốn gắn recipe line vào menu item để tính usage lý thuyết khi có sales.

**Acceptance criteria**

- Given menu item và ingredient tồn tại, when thêm line quantity > 0, then line được lưu với recipe unit.
- Given ingredient không tồn tại hoặc quantity ≤ 0, then không thể publish recipe.
- Given recipe đã published, then lịch sử version/updated-by được hiển thị.

### US-MD-03 — Supplier/Branch (MVP)

Là Admin/Purchasing Manager, tôi muốn quản lý supplier và branch để PO/stock request tham chiếu đúng nơi.

**Acceptance criteria**

- Supplier/branch cần tên và status active/inactive.
- Record inactive không xuất hiện trong form tạo transaction mới.
- Mọi thay đổi master data có audit actor/time/changes.

## Purchasing & Receiving

### US-PO-01 — Tạo draft PO (MVP)

Là Purchasing Manager, tôi muốn tạo PO với supplier, ingredient, quantity, unit price và expected delivery.

**Acceptance criteria**

- Có thể save Draft khi line hợp lệ.
- Không cho quantity/price âm hoặc supplier inactive.
- Tổng tiền được tính bằng decimal và hiển thị VND.

### US-PO-02 — Gửi PO (MVP)

Là Purchasing Manager, tôi muốn gửi PO để warehouse biết đơn đã sẵn sàng nhận.

**Acceptance criteria**

- Draft có ít nhất một line mới được chuyển Sent.
- PO Sent không sửa tự do; thay đổi cần policy/version hoặc cancel.
- Event status change được audit.

### US-GR-01 — Nhận hàng (MVP)

Là Warehouse Admin, tôi muốn ghi received quantity và discrepancy so với PO.

**Acceptance criteria**

- Chỉ PO Sent/được phép receive mới chọn được.
- Hệ thống hiển thị ordered, received, discrepancy theo line.
- Quantity âm bị từ chối; shortage/over-delivery có note.

### US-GR-02 — Cập nhật stock sau receipt (MVP)

Là Warehouse Admin, tôi muốn goods receipt confirmed làm tăng warehouse stock đúng một lần.

**Acceptance criteria**

- Given receipt chưa confirm, stock không đổi.
- Given confirm thành công, stock tăng theo stock unit sau conversion.
- Given retry cùng request/idempotency key, stock không tăng lần hai.

## Stock request

### US-BR-01 — Branch gửi request (MVP)

Là Branch Manager, tôi muốn xin ingredient từ kho tổng với urgency để tránh thiếu hàng.

**Acceptance criteria**

- Chỉ branch được gán mới tạo request cho branch đó.
- Request có ingredient, requested quantity, urgency và needed date.
- Submit tạo trạng thái Requested và không làm giảm stock.

### US-BR-02 — Warehouse duyệt request (MVP)

Là Warehouse Admin, tôi muốn approve/reject request và ghi lý do để quy trình có trách nhiệm.

**Acceptance criteria**

- Requested có thể Approved hoặc Rejected.
- Rejected bắt buộc có reason.
- Approved hiển thị shipped quantity form và người duyệt.

### US-BR-03 — Ship request (MVP)

Là Warehouse Admin, tôi muốn ghi quantity đã ship và cập nhật branch/warehouse stock.

**Acceptance criteria**

- Không ship request chưa Approved.
- Không ship vượt available stock.
- Confirm shipment trừ warehouse và cộng branch trong cùng transaction.

## Daily count & wastage

### US-DC-01 — Daily count (MVP)

Là Branch Manager, tôi muốn nhập opening, received, sold theory và closing cho từng ingredient.

**Acceptance criteria**

- Count thuộc đúng branch/date và không trùng record active cùng ingredient.
- UI preview `opening + received - sold - closing` trước submit.
- Nếu sold theory chưa có, UI hiện “chưa có dữ liệu POS” thay vì mặc định 0.

### US-WA-01 — Ghi wastage (MVP)

Là Branch Manager, tôi muốn ghi quantity và reason để giải thích loss.

**Acceptance criteria**

- Wastage quantity > 0 và reason bắt buộc.
- Reason nằm trong danh mục configurable hoặc có note “Other”.
- Value được tính từ standard price snapshot.

### US-WA-02 — Review variance (SHOULD)

Là Owner/Manager, tôi muốn xem variance theo branch/ingredient để tìm bất thường.

**Acceptance criteria**

- Có filter date/branch/ingredient.
- Click variance mở record count/wastage nguồn.
- Không hiển thị branch ngoài quyền user.

## Dashboard

### US-DB-01 — Operational overview (MVP)

Là Owner, tôi muốn xem stock, low-stock, open PO, pending request và wastage value trên một màn hình.

**Acceptance criteria**

- KPI hiển thị thời điểm cập nhật và filter scope.
- KPI có empty state và error state.
- KPI link tới detail records.

### US-DB-02 — Branch comparison (MVP)

Là Owner, tôi muốn so sánh wastage theo branch/ingredient để quyết định kiểm tra.

**Acceptance criteria**

- Chart/table có quantity và value.
- Có sort descending và date range.
- Dữ liệu khớp query/detail record.

## AI assistance

### US-AI-01 — AI onboarding (SHOULD)

Là người dùng được cấp quyền, tôi muốn nhập “30g trà, 200ml sữa” và nhận recipe suggestion.

**Acceptance criteria**

- Output có ingredient, quantity, unit và confidence/warning.
- Unknown ingredient/unit được đánh dấu, không tự map mơ hồ.
- Timeout/malformed output có fallback message và retry.

### US-AI-02 — Duyệt suggestion (MVP)

Là người dùng, tôi muốn sửa và duyệt suggestion trước khi lưu recipe.

**Acceptance criteria**

- Có thể edit/delete/add line.
- Chưa approve thì DB recipe không đổi.
- Save chỉ thành công nếu backend validate lại mọi line.

### US-AI-03 — AI Copilot read-only (SHOULD)

Là Owner/Manager, tôi muốn hỏi “branch nào hao hụt nhiều nhất?” dựa trên data được phép xem.

**Acceptance criteria**

- Câu trả lời nêu phạm vi thời gian và nguồn số liệu.
- Không trả record ngoài authorization scope.
- Nếu không đủ data, trả lời rõ missing data; không bịa số.

## Security & audit

### US-AU-01 — Login/RBAC (MVP)

Là user, tôi muốn đăng nhập và chỉ thấy feature/data phù hợp role.

**Acceptance criteria**

- Sai credential không tiết lộ user tồn tại hay không.
- Endpoint bị cấm trả 403 và UI ẩn action không được phép.
- Password không lưu plaintext.

### US-AU-02 — Audit mutation (MVP)

Là Owner/Admin, tôi muốn biết ai đã thay đổi PO, receipt, stock, request, count hoặc wastage.

**Acceptance criteria**

- Audit có actor, action, entity, before/after hoặc metadata, timestamp, request ID.
- Audit không bị xóa bởi user thường.
- Detail screen có link tới audit history.

## FOH → BOH integration foundation

### US-INT-01 — POS sales mapping (FUTURE)

Là Product/Integration Owner, tôi muốn map POS item code với menu item/version để tính theoretical usage.

**Acceptance criteria**

- Mapping versioned và có trạng thái active.
- Sales chưa map không làm sai usage; được report như unmapped.
- Import có idempotency theo external event ID.

### US-INT-02 — Ingredient unavailable signal (FUTURE)

Là FOH/Kitchen lead, tôi muốn biết món bị ảnh hưởng khi ingredient unavailable để tránh nhận order không thể làm.

**Acceptance criteria**

- Signal dựa trên published recipe và stock policy.
- Không tự disable menu item trong MVP; chỉ cảnh báo tích hợp.
- Có source và timestamp của signal.

## FOH Lite — Front-door QR

### US-FOH-01 — Xem tình trạng bàn không cần app (MVP)

Là khách du lịch/khách vãng lai, tôi muốn scan QR trước nhà hàng và biết nhà hàng còn nhận khách hay phải chờ bao lâu mà không cần đăng nhập.

**Acceptance criteria**

- Trang mở được trên mobile và cho chọn Vietnamese/English.
- Availability có text rõ, estimated range, timestamp và limitation nếu dữ liệu stale.
- Không bắt tải app, tạo account hoặc nhập contact trước khi xem kết quả.

### US-FOH-02 — Chọn theo time budget (MVP)

Là khách đang có lịch trình, tôi muốn nhập nhóm của mình và khoảng thời gian có thể chờ để quyết định có nên xếp hàng.

**Acceptance criteria**

- Party size và time budget là các input dễ chạm, label rõ.
- Nếu estimated wait vượt time budget, UI đưa CTA xem menu, rời flow hoặc hỏi nhân viên.
- Không hiển thị thời điểm rời bàn của khách cụ thể như cam kết.

### US-FOH-03 — Join/leave queue (MVP)

Là khách, tôi muốn vào và rời hàng chờ rõ ràng để giữ quyền chủ động.

**Acceptance criteria**

- Join tạo queue code và estimated range.
- Phone/email chỉ bắt buộc nếu tôi chọn notification.
- Success screen có CTA `Rời hàng chờ`; thao tác rời có confirmation nhẹ và không bị ẩn.

### US-FOH-04 — Staff quản lý queue (MVP)

Là Host/Manager, tôi muốn thấy queue và mark called/seated/cancel để khách nhận trạng thái đúng.

**Acceptance criteria**

- Queue item hiển thị party size, time budget, created time và accessibility note nếu có.
- Staff action được audit và không lộ phone/email ngoài quyền.
- Stale/overdue item có trạng thái riêng, không tự coi là seated.

## FOH Lite — Table QR

### US-FOH-05 — Xác nhận đúng bàn (MVP)

Là khách đang ngồi, tôi muốn scan QR và biết mình đang thao tác cho đúng bàn/session.

**Acceptance criteria**

- Landing screen hiển thị table label thân thiện và CTA xác nhận.
- Token sai/hết hạn hiển thị recovery: scan lại hoặc gọi nhân viên.
- Khách không xem được session/PII của bàn khác.

### US-FOH-06 — Gọi thêm món (MVP)

Là khách, tôi muốn chọn món thêm, note và gửi yêu cầu mà không cần gọi lớn nhân viên.

**Acceptance criteria**

- Menu có category, quantity, note và allergen field nếu dữ liệu hỗ trợ.
- Confirmation hiển thị bàn, món, quantity và estimated range.
- Submit thành công tạo trạng thái `Đã gửi/Chờ xác nhận`, không tự coi là đã phục vụ.

### US-FOH-07 — Theo dõi và hủy request trùng (MVP)

Là khách, tôi muốn biết request đã được tiếp nhận và tránh gửi trùng khi mạng chậm.

**Acceptance criteria**

- UI có loading/disabled state và idempotency cho retry.
- Status gồm tối thiểu `Đã nhận`, `Đang chuẩn bị`, `Đã phục vụ`, `Từ chối/Cần nhân viên`.
- Request có thể hủy trong thời gian policy cho phép; sau đó liên hệ nhân viên.

### US-FOH-08 — Staff acknowledge và route (MVP)

Là Server/Manager, tôi muốn xác nhận và chuyển tiếp QR request để hospitality vẫn do nhân viên kiểm soát.

**Acceptance criteria**

- Staff thấy table, item, quantity, note, created time và requested action.
- Có thể accept/reject/route với reason khi reject.
- Status change thông báo lại cho guest và ghi audit.

### US-FOH-09 — Staff fallback và accessibility (MVP)

Là khách không muốn/không thể dùng QR, tôi muốn vẫn nhận được hỗ trợ như bình thường.

**Acceptance criteria**

- Standy/table UI có CTA hoặc copy `Hỏi nhân viên`.
- Form dùng visible labels, 44px touch target, body text ≥16px, status không chỉ dùng màu.
- Không ép khách tải app, tạo tài khoản hoặc cung cấp dữ liệu không cần thiết.

## Operational configuration & access

### US-OP-01 — Cấu hình địa điểm và operating state (MVP)

Là Admin/Manager, tôi muốn cấu hình branch, warehouse, table capacity, service hours và trạng thái nhận khách để các flow hiển thị đúng.

**Acceptance criteria**

- Branch/warehouse/table có timezone, status và scope hợp lệ; table label/capacity không trống hoặc âm.
- Manager có thể chuyển `OPEN/PAUSED/FULL/CLOSED`; `PAUSED/FULL/CLOSED` hiển thị lý do hoặc hướng dẫn staff.
- Cập nhật không làm thay đổi lịch sử queue estimate; có actor, reason và timestamp trong audit.

### US-OP-02 — Queue policy và QR token (MVP)

Là Admin, tôi muốn cấu hình queue policy và thu hồi/đổi table QR token để kiểm soát dữ liệu guest.

**Acceptance criteria**

- Policy validate party-size range, queue capacity, wait TTL, time-budget options và service hours.
- Token rotate/revoke làm token cũ không truy cập được session; lỗi token không tiết lộ thông tin bàn.
- Policy/token thay đổi có effective time và audit.

### US-OP-03 — Quản trị user và branch scope (MVP)

Là Admin, tôi muốn tạo/deactivate user, gán role và branch membership để quyền truy cập không bị mở rộng ngoài phạm vi.

**Acceptance criteria**

- User inactive không đăng nhập/không tạo mutation mới; session bị revoke theo policy.
- Branch user không đọc/sửa dữ liệu branch khác dù đổi `branch_id` trên request.
- Mọi thay đổi role/membership có before/after và actor trong audit.

## Notifications & operational controls

### US-NF-01 — Queue/request notification (MVP)

Là guest/staff, tôi muốn biết notification đã được gửi hay thất bại và vẫn có đường fallback.

**Acceptance criteria**

- Chỉ gửi khi guest opt-in; delivery có `PENDING/SENT/FAILED/EXPIRED`, channel và timestamp.
- Retry cùng event không gửi trùng vượt policy; failure không đổi trạng thái queue/request.
- UI luôn giữ queue code/request status và CTA `Hỏi nhân viên` khi notification lỗi.

### US-NF-02 — Staff task inbox (SHOULD)

Là Host/Manager/Warehouse Admin, tôi muốn thấy task chưa xử lý theo owner/due time để request và exception không bị bỏ quên.

**Acceptance criteria**

- Task có source record, priority, owner, due time và trạng thái.
- Có thể claim/route/resolve; thao tác có audit và không vượt branch scope.
- Task overdue được đánh dấu, không tự động coi là hoàn thành.

## Controlled correction & reconciliation

### US-CTL-01 — Stock adjustment/reversal (SHOULD)

Là Warehouse Admin, tôi muốn sửa discrepancy bằng adjustment có lý do mà không sửa lịch sử gốc.

**Acceptance criteria**

- Adjustment yêu cầu ingredient/location, quantity, reason, source record và note/evidence nếu policy yêu cầu.
- Ledger gốc immutable; correction tạo compensating event và audit.
- Không cho kết quả âm nếu policy MVP không cho âm; idempotency retry không tạo event thứ hai.

### US-CTL-02 — Partial receipt và transfer acceptance (SHOULD)

Là Warehouse/Branch Manager, tôi muốn phân biệt hàng nhận đủ, thiếu, hỏng, đang chuyển và branch đã nhận.

**Acceptance criteria**

- Một PO/request có thể có nhiều receipt/shipment theo policy; tổng quantity được kiểm soát.
- Damaged/rejected/backordered/in-transit có quantity và reason riêng.
- Branch acceptance mới chuyển shipment từ `IN_TRANSIT` sang `RECEIVED`; discrepancy mở task/review.

### US-CTL-03 — Count/wastage approval và khóa kỳ (SHOULD)

Là Owner/Manager, tôi muốn duyệt và khóa count/wastage sau khi review.

**Acceptance criteria**

- Record có `DRAFT/SUBMITTED/APPROVED/REJECTED/LOCKED` theo policy.
- Reject bắt buộc reason; record locked chỉ sửa bằng correction event.
- Dashboard phân biệt submitted chưa duyệt và số liệu đã approved.

## Import/export & integration operations

### US-INT-03 — Import/export có kiểm soát (SHOULD)

Là Admin/Owner, tôi muốn nạp dữ liệu theo template và xuất báo cáo theo quyền để giảm nhập liệu thủ công.

**Acceptance criteria**

- Import có preview, schema/unit validation, row-level error và không ghi một phần ngoài transaction policy.
- Export giữ filter/scope, timezone, `as_of` và source record.
- POS batch lỗi/unmapped vào quarantine; replay cùng external event ID không duplicate.

## Story readiness checklist

- [ ] Actor và scope branch rõ.
- [ ] Happy path + failure path.
- [ ] Permission.
- [ ] Data/units/rounding.
- [ ] Audit/idempotency nếu mutation.
- [ ] Link tới FR/BR/feature.

## Full Restaurant Operations — Production Stories

Các story dưới đây mở rộng từ FOH Lite/BOH Core thành production core. Story có
UI phải được kiểm tra trên browser ở mobile guest và tablet/desktop staff.

### US-PROD-001 — Cấu hình nhà hàng và quyền truy cập

**Description:** Là Admin, tôi muốn cấu hình branch, area, table, service hours,
role và membership để mọi workflow dùng cùng một nguồn cấu hình.

**Acceptance criteria**

- [ ] Branch, area, table capacity, accessibility tag, timezone và service hours được validate.
- [ ] User chỉ nhận role/branch membership hợp lệ; thay đổi có audit.
- [ ] Backend từ chối request dùng branch/role không thuộc actor.
- [ ] Typecheck/lint và integration authorization test pass.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-002 — Tạo và quản lý reservation

**Description:** Là Guest/Host, tôi muốn tạo và quản lý reservation để nhà hàng
chuẩn bị bàn và giảm nhầm lịch.

**Acceptance criteria**

- [ ] Hệ thống kiểm tra service hours, capacity, table hold, blocked table và overlap.
- [ ] Reservation đi đúng `DRAFT → PENDING → CONFIRMED → ARRIVED/NO_SHOW/CANCELLED`.
- [ ] Host có thể tìm theo code/name/contact trong branch scope và mark arrived.
- [ ] Cancel/reschedule/no-show ghi actor, reason và timestamp.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-003 — Walk-in và waitlist hợp nhất

**Description:** Là Host, tôi muốn quản lý walk-in cùng queue từ front-door QR để
không có hai danh sách chờ mâu thuẫn.

**Acceptance criteria**

- [ ] Walk-in và QR queue dùng chung party size, time budget, priority và estimate model.
- [ ] Host có thể call, seat, leave, cancel, expire theo state machine.
- [ ] Queue code/notification/fallback không lộ PII ngoài scope.
- [ ] Retry join không tạo duplicate queue entry.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-004 — Table readiness và seating

**Description:** Là Host/Manager, tôi muốn chỉ assign bàn đã sẵn sàng để khách
không bị đưa vào bàn bẩn, đang sửa hoặc chưa được kiểm tra.

**Acceptance criteria**

- [ ] Table state phân biệt reserved, ready, in use, waiting cleaning, cleaning, blocked.
- [ ] Seating tạo service session và lưu party/table/actor snapshot.
- [ ] Paid session tự tạo cleaning task; chỉ task completed mới cho phép READY.
- [ ] Transfer/merge giữ order/bill/source history.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-005 — Quản lý menu, modifier và station

**Description:** Là Admin/Manager, tôi muốn quản lý menu version, giá, modifier,
allergen và station để order được định tuyến đúng.

**Acceptance criteria**

- [ ] Menu item có effective time, availability, price, modifier và station.
- [ ] Published version không bị sửa làm thay đổi order lịch sử.
- [ ] Allergen là field riêng; unavailable item không thể gửi order mới.
- [ ] Recipe version liên kết đúng menu item và ingredient active.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-006 — Server tạo và gửi order theo round

**Description:** Là Server, tôi muốn tạo order draft, ghi chú và gửi theo round
để Kitchen/Bar nhận đúng yêu cầu của khách.

**Acceptance criteria**

- [ ] Server chọn được session/table được assign, item, quantity, modifier, note và course policy.
- [ ] Draft có thể sửa; send tạo snapshot và freeze line theo policy.
- [ ] Food route Kitchen, beverage route Bar; additional order là round mới.
- [ ] Cancel sau send cần permission/reason và không xóa lịch sử.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-007 — Kitchen xử lý food ticket

**Description:** Là Kitchen Staff, tôi muốn xem và cập nhật food ticket để món
được chuẩn bị đúng thứ tự và đúng ghi chú.

**Acceptance criteria**

- [ ] Kitchen chỉ thấy food ticket thuộc station/branch được cấp quyền.
- [ ] Ticket đi `NEW → ACCEPTED → PREPARING → READY → PICKED_UP → SERVED`.
- [ ] Delay/shortage/reject bắt buộc reason và tạo thông báo cho Server/Manager.
- [ ] Kitchen không xem/sửa payment hoặc bill data.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-008 — Bar xử lý beverage ticket

**Description:** Là Bar Staff, tôi muốn xử lý beverage ticket độc lập để đồ uống
không bị lẫn với food flow.

**Acceptance criteria**

- [ ] Bar chỉ thấy beverage ticket và required table/order context.
- [ ] Ticket có trạng thái preparing/completed/delayed/rejected và timestamp.
- [ ] Modifier như less ice/temperature được giữ trong ticket snapshot.
- [ ] Delay/unavailable có recovery path tới Server/guest.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-009 — Server nhận và phục vụ món

**Description:** Là Server, tôi muốn thấy món ready, nhận món và mark served để
đo được thời gian phục vụ.

**Acceptance criteria**

- [ ] Server thấy ready item theo assignment và priority.
- [ ] `prepared_at`, `picked_up_at`, `served_at` được ghi đúng actor.
- [ ] Serve-together/course policy không làm mất item đang ready.
- [ ] Serve item xuất hiện đúng bill/session và không tạo duplicate line.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-010 — Billing và discount có kiểm soát

**Description:** Là Server/Cashier, tôi muốn tạo bill đúng từ order để khách
kiểm tra tổng tiền trước khi thanh toán.

**Acceptance criteria**

- [ ] Bill snapshot item price, tax, service charge, discount và source order line.
- [ ] Discount vượt threshold yêu cầu Manager approval và reason.
- [ ] Bill chỉ chứa line hợp lệ; total được tính bằng decimal policy.
- [ ] Bill review có audit và không tự đổi khi menu master thay đổi.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-011 — Split bill

**Description:** Là Cashier, tôi muốn chia bill theo item/guest/equal/custom để
nhóm khách có thể thanh toán riêng.

**Acceptance criteria**

- [ ] Tổng các bill con bằng bill gốc, không orphan hoặc duplicate line.
- [ ] Bill còn unpaid nếu một phần chưa thanh toán.
- [ ] Split/reassign line ghi actor, before/after và reason nếu cần.
- [ ] Invalid custom amount bị chặn trước khi save.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-012 — Payment, refund và receipt

**Description:** Là Cashier, tôi muốn nhận payment và xử lý refund có kiểm soát
để doanh thu và trạng thái bill đáng tin.

**Acceptance criteria**

- [ ] Cash/card/transfer/e-wallet dùng payment adapter và external reference.
- [ ] Retry/webhook cùng reference không double-post.
- [ ] Timeout giữ payment pending, không báo paid giả.
- [ ] Refund/void yêu cầu quyền, reason, original payment và compensating audit event.
- [ ] Receipt chỉ gửi channel được cấu hình/consent.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-013 — End-of-day reconciliation

**Description:** Là Manager/Cashier, tôi muốn close business day sau khi đối soát
để phát hiện unpaid, refund và cash difference.

**Acceptance criteria**

- [ ] Report phân biệt unpaid, voided, refunded và payment method totals.
- [ ] Cash/card/transfer/e-wallet discrepancy có owner và resolution note.
- [ ] Branch/shift đã close không nhận mutation không được phép.
- [ ] Close command idempotent và audit đầy đủ.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-014 — Staff shift và task assignment

**Description:** Là Manager, tôi muốn phân công shift/station/task để request và
ticket luôn có owner chịu trách nhiệm.

**Acceptance criteria**

- [ ] Shift có branch, role, start/end, assignment và conflict validation.
- [ ] Task chỉ route tới staff đúng role/branch/station.
- [ ] Handover lưu claimed, resolved, escalation và resolution note.
- [ ] Attendance event không được diễn giải thành payroll.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-015 — Operational reporting

**Description:** Là Owner/Manager, tôi muốn xem occupancy, service time, revenue,
payment, stock và wastage trong cùng branch scope để ra quyết định.

**Acceptance criteria**

- [ ] Report có date/business timezone, branch filter, `as_of`, freshness và source link.
- [ ] Có occupancy/no-show/queue, ticket delay, serving time, revenue/payment,
  stock/variance/wastage views phù hợp role.
- [ ] Cached aggregate khớp source query và có stale state.
- [ ] Export giữ permission scope và không lộ payment/PII ngoài policy.
- [ ] Verify in browser using dev-browser skill.

### US-PROD-016 — Full production recovery

**Description:** Là Operator, tôi muốn hệ thống xử lý lỗi/retry/reconciliation
để một sự cố không làm mất order, payment, stock hoặc audit history.

**Acceptance criteria**

- [ ] Mỗi command có stable error code, request ID và recovery action.
- [ ] DB/provider timeout không tạo success giả hoặc duplicate mutation.
- [ ] Notification/print/receipt/AI failure được retry hoặc staff fallback độc lập.
- [ ] Backup/restore, migration-from-empty, permission isolation và critical path integration tests pass.
- [ ] Typecheck/lint/test/build pass.
