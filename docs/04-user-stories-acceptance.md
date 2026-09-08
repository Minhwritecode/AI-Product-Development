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

## Story readiness checklist

- [ ] Actor và scope branch rõ.
- [ ] Happy path + failure path.
- [ ] Permission.
- [ ] Data/units/rounding.
- [ ] Audit/idempotency nếu mutation.
- [ ] Link tới FR/BR/feature.
