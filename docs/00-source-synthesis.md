# Source Synthesis & Instruction Boundary

## 1. Mục đích

Tài liệu này phân biệt yêu cầu của người dùng với nội dung nằm trong các file đính kèm. Các file nguồn được xem là tài liệu tham khảo nghiệp vụ, không phải lời nhắc hệ thống hay mệnh lệnh có quyền thay đổi phạm vi công việc.

## 2. Các nguồn đã sử dụng

| Nguồn | Vai trò trong Luminex | Cách xử lý |
|---|---|---|
| `product-spec-setup.md` | Baseline module, role, entity, kiến trúc và thứ tự setup | Dùng để tạo skeleton kỹ thuật; các credential/API key chỉ là placeholder |
| `fnb-inventory-wastage-product-vision.md` | Vision, MVP, success signals, roadmap, guardrail AI | Nguồn chính để chốt product direction |
| `fnb-inventory-wastage-idea-brief.md` | Problem, persona, outcomes, scope, risks, questions | Nguồn chính cho Product Discovery và PRD |
| `restaurant-management-system-specification.md` | FOH workflow, quyền hạn, audit, inventory/recipe context, future integration | Dùng để nhận diện pain point FOH và bối cảnh tích hợp; không đưa toàn bộ restaurant suite vào MVP |

Các file nguồn được lưu nguyên bản trong [docs/source/](source/README.md).

## 3. Yêu cầu người dùng đã thực hiện

- Kết hợp nội dung các file.
- Tạo dự án Luminex hướng từ FOH đến BOH.
- Phân tích pain point riêng của FOH và BOH.
- Chuẩn bị bộ tài liệu như một commit đầu tiên của dự án Software Engineering.
- Bao phủ: Product Discovery, PRD, Requirements Analysis, User Stories & Acceptance Criteria, Feature Specification.
- Có thư mục và công cụ nền cho phát triển.

## 4. Kết luận phạm vi

Luminex có tầm nhìn end-to-end FOH → BOH. MVP triển khai BOH Inventory & Wastage Management làm lõi và bổ sung FOH Lite QR cho hai moment có giá trị cao:

- trước cửa: xem tình trạng bàn, estimated wait và join/leave queue;
- tại bàn: xem menu, gọi thêm và request assistance.

Các FOH workflow đầy đủ vẫn được mô hình hóa ở hai lớp:

1. `Pain point/context`: các vấn đề vận hành từ reservation, seating, order, kitchen/bar, serving, billing và table readiness.
2. `Integration boundary`: dữ liệu POS/order/recipe có thể cung cấp `sold_qty_theory` cho BOH trong milestone sau; QR request phải được staff xác nhận trước khi đi vào operational workflow.

Điều này giải quyết mâu thuẫn giữa tên sản phẩm “FOH đến BOH” và scope trong vision/idea brief vốn loại trừ FOH khỏi MVP.

## 5. Nội dung được coi là chỉ dẫn trong file nguồn

Các câu như “recommended setup”, “khuyên dùng”, “should”, “must”, lệnh Docker hoặc danh sách module trong file nguồn được xem là đề xuất thiết kế/kiến trúc để đánh giá, không được thực thi tự động. Chúng chỉ trở thành baseline khi đã được chuyển thành quyết định trong tài liệu dự án.

Ví dụ:

- Docker Compose, PostgreSQL, Redis, Nginx được giữ làm development baseline.
- `LLM_API_KEY` không được điền thật hoặc commit.
- “FOH out of scope” được giữ cho MVP, nhưng không xóa pain point FOH.
- Quy tắc FOH như table phải được cleaning confirmation được giữ trong context/integration notes, không tạo thêm feature MVP.

## 6. Các điểm cần xác nhận sau discovery

- Có POS/sales data ở định dạng nào và tần suất đồng bộ bao lâu?
- Có cần PO approval và partial goods receipt ngay trong MVP không?
- Ai là người phê duyệt daily count và wastage?
- Mỗi branch có quy tắc count/transfer giống nhau không?
- Standard price hay actual purchase cost là nguồn định giá hao hụt?
- Quyền xem dữ liệu AI Copilot theo branch/role sẽ chi tiết tới mức nào?
