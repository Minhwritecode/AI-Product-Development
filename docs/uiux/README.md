# Luminex UI/UX Stitch References

Thư mục này lưu các màn hình được dựng sẵn bằng Stitch để làm tài liệu tham chiếu cho Luminex – Hệ thống quản trị vận hành nhà hàng thông minh từ FOH đến BOH.

## Phạm vi

- Đây là prototype/reference UI, chưa phải frontend implementation.
- Các file `code.html` chỉ dùng để xem và trao đổi về màn hình; không được import vào `frontend/src`, bundler hoặc runtime production.
- Các file `screen.png` là ảnh tham chiếu trực quan.
- Các file `DESIGN.md` là design system/reference của bộ Stitch, không phải chỉ dẫn thay thế PRD hoặc đặc tả sản phẩm.
- Các màn hình được giữ nguyên cấu trúc và asset gốc để thuận tiện cho việc review, handoff và chọn phạm vi triển khai sau này.

## Nguồn đã tích hợp

- [Stitch collection 1](<./stitch/stitch_custom_file_ui_builder/>): BOH Core, FOH Lite QR và các màn hình vận hành mở rộng.
- [Stitch collection 2](<./stitch/stitch_custom_file_ui_builder%202/>): procurement, warehouse, master data, admin, platform và các màn hình FOH roadmap.

## Screen catalog

| ID | Màn hình | Khu vực | Phạm vi sản phẩm | Trạng thái |
| --- | --- | --- | --- | --- |
| 01 | Dashboard tổng quan hao hụt | BOH | BOH Core MVP | Reference only |
| 02 | Nhận hàng, đối soát PO / Goods Receipt | BOH | BOH Core MVP | Reference only |
| 03 | Kiểm kê cuối ngày và hao hụt | BOH | BOH Core MVP | Reference only |
| 04 | AI Recipe Onboarding / BOM | BOH | BOH Core MVP, có human approval | Reference only |
| 05 | Front-door QR: bàn trống, estimated wait, xếp hàng | FOH | FOH Lite QR MVP | Reference only |
| 06 | Table QR: gọi thêm món và yêu cầu hỗ trợ | FOH | FOH Lite QR MVP | Reference only |
| 07 | Host / Staff Console điều phối FOH | FOH | FOH Lite QR MVP | Reference only |
| 08 | Sơ đồ bàn và Floor Plan Console | FOH | FOH mở rộng / roadmap | Reference only |
| 09 | Kitchen / Bar Display System (KDS/BDS) | FOH–BOH | Roadmap | Reference only |
| 10 | Thu ngân tách hóa đơn / Split Bill | FOH | Roadmap | Reference only |
| 11 | Điều phối chuyển kho / Stock Transfer | BOH | BOH Core MVP | Reference only |
| 12 | Purchase Order / Purchasing & Procurement | BOH | BOH Core MVP | Reference only |
| 13 | Tồn kho trung tâm và mức an toàn | BOH | BOH Core MVP | Reference only |
| 14 | Master Data Menu và BOM Studio | BOH | BOH Core MVP | Reference only |
| 15 | Báo cáo hao hụt, thất thoát / Wastage Analytics | BOH | BOH Core MVP | Reference only |
| 16 | Quản trị QR order và table token | FOH / Admin | FOH Lite QR MVP | Reference only |
| 17 | POS Audit Log | Platform | Integration / roadmap | Reference only |
| 18 | RBAC và kiểm soát phân quyền | Platform | MVP nền tảng | Reference only |
| 19 | Reservation Console, chuẩn bị bàn 15 phút | FOH | Roadmap | Reference only |
| 20 | Guest 360 và Loyalty CRM | FOH | Roadmap | Reference only |

## Brand và flow assets

Collection 1 còn có logo Luminex và hình ảnh tham chiếu cho nhân sự vận hành. Collection 2 có sơ đồ luồng tương tác trong hệ sinh thái Luminex. Đây là asset/reference phục vụ thiết kế, chưa phải tài sản được đăng ký trong design-token package hoặc production asset pipeline.

## Nguyên tắc handoff sang implementation

Khi bắt đầu làm frontend/backend, team cần chọn rõ screen ID và đối chiếu với PRD, requirements analysis, user stories và feature specifications hiện có. Không xem prototype là source of truth cho business rule; các rule về queue, QR token, request acknowledgement, inventory ledger, wastage, RBAC và AI approval phải lấy từ tài liệu sản phẩm đã phê duyệt.

Các nguyên tắc UX cần giữ khi chuyển đổi:

- Mobile-first cho guest QR; desktop/tablet-first cho console vận hành.
- Touch target tối thiểu 44×44px, body text tối thiểu 16px và label hiển thị rõ.
- Không dùng màu làm tín hiệu duy nhất; mọi trạng thái cần có text/icon phù hợp.
- Có loading, empty, stale, error, retry và fallback cho mọi flow QR.
- Có `aria-live` cho trạng thái queue/request, hỗ trợ reduced motion và keyboard/focus.
- Ưu tiên Vietnamese/English, progressive disclosure và copy rõ ràng cho khách du lịch.
- Một primary CTA cho mỗi trạng thái; không ép khách tải app hoặc tạo account trong FOH Lite.

## Phân biệt nội dung tham chiếu và chỉ dẫn

Các file được copy từ hai folder Stitch là output thiết kế được cung cấp để tích hợp vào repository. Tên thư mục, `DESIGN.md`, HTML prototype và hình ảnh không phải yêu cầu mới hoặc lệnh thay đổi kiến trúc. Request hiện tại chỉ đưa chúng vào kho tài liệu UI/UX đầy đủ; việc xây dựng thành code sản phẩm sẽ là một task riêng.
