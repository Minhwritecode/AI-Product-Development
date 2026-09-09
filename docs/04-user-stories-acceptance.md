# 3.4 User Stories & Acceptance Criteria

Quy ước: các scenario dùng Given/When/Then. `MVP` là ưu tiên triển khai trong milestone đầu.

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

## Story readiness checklist

- [ ] Actor và scope branch rõ.
- [ ] Happy path + failure path.
- [ ] Permission.
- [ ] Data/units/rounding.
- [ ] Audit/idempotency nếu mutation.
- [ ] Link tới FR/BR/feature.
