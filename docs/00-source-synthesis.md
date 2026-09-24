# Product Source Synthesis

## 1. Mục đích

Tài liệu này hợp nhất các nguồn nghiệp vụ thành baseline cho Luminex. Các quyết định đã được chuẩn hóa trong PRD, Requirements Analysis, User Stories và Feature Specifications là cơ sở để triển khai.

## 2. Nguồn nghiệp vụ

| Nguồn | Nội dung sử dụng trong Luminex |
|---|---|
| `product-spec-setup.md` | Module, role, entity, kiến trúc và thứ tự phát triển nền tảng |
| `fnb-inventory-wastage-product-vision.md` | Vision, BOH MVP, success signals, roadmap và AI guardrail |
| `fnb-inventory-wastage-idea-brief.md` | Problem, persona, outcome, scope, risk và discovery question |
| `restaurant-management-system-specification.md` | Bối cảnh FOH, table/service workflow, quyền hạn, audit và future integration |

Các nguồn gốc được lưu trong [docs/source/](source/README.md) để giữ lại context nghiệp vụ.

## 3. Product baseline

Luminex có tầm nhìn end-to-end FOH → BOH, với MVP gồm:

- **BOH Core:** master data, purchasing, goods receipt, warehouse/branch stock, stock request, daily count, wastage, dashboard và AI assistance có human approval.
- **FOH Lite:** front-door QR để xem availability/estimated wait và join/leave queue; table QR để add-on/assistance request có staff acknowledgement.
- **Integration boundary:** recipe version, menu item, branch và POS sales mapping được chuẩn bị cho milestone sau; dữ liệu chưa mapping không được tự mutate stock.

Full reservation, table assignment, ordering/POS, KDS/BDS, billing/payment, payroll và accounting không thuộc MVP.

## 4. Pain point được chuẩn hóa

### FOH

- Khách trước cửa không biết còn bàn, queue dài bao nhiêu hoặc wait có phù hợp lịch trình.
- Khách quốc tế cần Vietnamese/English và không muốn tải app hoặc tạo account trước khi quyết định chờ.
- Khách đã ngồi phải chờ nhân viên để gọi thêm món hoặc hỗ trợ trong giờ cao điểm.
- QR request có nguy cơ gửi nhầm bàn, duplicate, tạo kỳ vọng “đã order” hoặc bỏ qua hospitality nếu không có staff acknowledgement.
- Guest không dùng QR vẫn phải có staff fallback.

### BOH

- PO, receiving, transfer, stock, count và wastage rời rạc làm tồn không đáng tin.
- Unit conversion sai làm sai quantity và cost.
- Hàng thiếu/hỏng/đang chuyển không được phân biệt, khó truy trách nhiệm.
- Wastage thiếu reason, evidence và value nên không biết mất tiền ở đâu.
- POS/sold theory có thể chưa có; dữ liệu thiếu phải được đánh dấu, không suy đoán.
- AI cần rút ngắn nhập liệu nhưng không được tự thay đổi master, recipe, stock, PO hoặc wastage.

## 5. Quyết định phạm vi

| Quyết định | Baseline |
|---|---|
| Product direction | BOH-first, FOH Lite QR trong MVP |
| Stock source of truth | Append-only inventory ledger và transaction-safe projection |
| Wastage valuation | Standard price snapshot tại thời điểm ghi nhận trong MVP |
| Missing sales theory | `NOT_AVAILABLE`/`INCOMPLETE_THEORY`, không mặc định bằng zero |
| Guest wait display | Range + `as_of` + confidence, không hiển thị giờ rời bàn cụ thể |
| QR add-on | `SUBMITTED` → staff acknowledge → route/prepare/serve |
| AI | Read/suggest only; human approval trước mutation |
| Authorization | Backend kiểm tra role và branch scope |

## 6. Khoảng trống cần giải quyết trong product scope

- Branch/warehouse/table/queue configuration và operating state.
- User, role, branch membership, token lifecycle và audit.
- Notification delivery, staff task ownership và retry.
- Controlled correction, approval, period lock và reconciliation.
- Partial receipt, in-transit shipment, branch acceptance và discrepancy.
- Import/export, POS quarantine, replay và mapping reconciliation.

Các năng lực này chỉ được đưa vào milestone tương ứng trong [Scope & Roadmap](07-scope-and-roadmap.md), không tự mở rộng thành full FOH suite.

## 7. Open discovery decisions

- Estimated wait dùng rule, historical service duration hay kết hợp cả hai?
- Ai duyệt PO, daily count, wastage và correction; SLA là bao nhiêu?
- Branch có khác nhau về count cadence, queue capacity, service hours và unit policy không?
- Standard price hay actual purchase cost là nguồn valuation ở các milestone sau?
- POS/sales export có format, tần suất và external event ID như thế nào?
- Notification provider, contact retention và staff fallback được chốt ra sao?
