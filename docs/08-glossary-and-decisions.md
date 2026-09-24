# Glossary & Decision Log

## Glossary

| Thuật ngữ | Định nghĩa |
|---|---|
| FOH | Front-of-House: reservation, seating, order, serving, billing và tương tác khách |
| BOH | Back-of-House: purchasing, warehouse, branch stock, count, wastage |
| Ingredient | Nguyên liệu được tồn kho và/hoặc dùng trong recipe |
| Purchase unit | Đơn vị khi mua, ví dụ carton/kg |
| Stock unit | Đơn vị canonical khi lưu tồn, ví dụ ml/g |
| Recipe unit | Đơn vị trong recipe, có thể quy đổi về stock unit |
| Goods receipt | Ghi nhận hàng thực nhận từ supplier |
| Stock request | Yêu cầu branch xin hàng từ warehouse |
| Daily count | Kiểm kê tồn thực tế theo branch/date/ingredient |
| Wastage | Phần nguyên liệu mất/loại bỏ có quantity, reason và value |
| Theoretical sold | Lượng bán theo sales/POS × recipe; có thể chưa có trong MVP |
| Standard price | Giá chuẩn dùng valuation cơ bản |
| Human approval | Người dùng xem/sửa/duyệt trước khi AI result được lưu |
| FOH Lite | Lớp FOH giới hạn trong MVP: front-door QR và table QR |
| Front-door QR | QR trước cửa để xem availability, estimated wait và queue |
| Table QR | QR gắn tại bàn để xem menu, gọi thêm hoặc request assistance |
| Time budget | Khoảng thời gian khách có thể chờ trước khi quyết định join queue |
| Guest session | Session không cần account, gắn với queue hoặc signed table token |
| Staff fallback | Đường chuyển sang nhân viên khi khách không dùng/không thể dùng QR |
| Operating state | Trạng thái nhận khách của branch: `OPEN`, `PAUSED`, `FULL`, `CLOSED` |
| Queue policy | Cấu hình party-size, capacity, wait TTL, time budget và cách estimate queue |
| Operational task | Việc cần staff xử lý, gắn với queue/request/exception và có owner/due time |
| Compensating event | Ledger event điều chỉnh/reverse liên kết với event gốc mà không sửa lịch sử |
| Quarantine | Vùng giữ event/import lỗi hoặc chưa map để review/replay, không mutate nghiệp vụ |

## Decisions

| ID | Quyết định | Lý do | Trạng thái |
|---|---|---|---|
| D-001 | BOH-first MVP, FOH là context/integration boundary | Giảm scope nhưng không mất tầm nhìn end-to-end | Accepted |
| D-002 | PostgreSQL làm DB chính | Quan hệ FK/transaction stock chặt | Accepted |
| D-003 | Redis chỉ cho cache/aggregate, không là source of truth | Tránh mất dữ liệu nghiệp vụ | Accepted |
| D-004 | AI không có quyền mutation | Giảm rủi ro recipe/stock sai | Accepted |
| D-005 | Standard price snapshot cho wastage value | Lịch sử không đổi khi master price thay đổi | Accepted for MVP |
| D-006 | VND + Vietnamese UI mặc định | Phù hợp context nguồn; mở rộng sau | Accepted |
| D-007 | TypeScript + React + Node skeleton | Một ngôn ngữ xuyên suốt, onboarding đơn giản | Proposed |
| D-008 | Nginx optional local production-like proxy | Thể hiện boundary scale; không cần trong dev cơ bản | Proposed |
| D-009 | Bổ sung FOH Lite QR vào MVP, không mở full FOH suite | Giải quyết hai pain point có tần suất cao mà vẫn kiểm soát scope | Accepted |
| D-010 | Wait hiển thị range + timestamp, không cam kết thời điểm rời bàn cụ thể | Tránh false precision, bảo vệ privacy và kỳ vọng khách | Accepted |
| D-011 | QR request phải được staff acknowledge/route | Giữ hospitality, chống request mồ côi và không tự tạo payment/stock mutation | Accepted |
| D-012 | Operating state và queue policy là cấu hình có hiệu lực theo thời gian | QR cần nguồn dữ liệu chính thức; override phải giải thích được | Accepted |
| D-013 | Notification là side effect độc lập với business status | Kênh gửi có thể lỗi; không được làm mất queue/request | Accepted |
| D-014 | Ledger immutable; correction dùng compensating event | Giữ audit, reconciliation và lịch sử đáng tin | Accepted for Milestone 2 |
| D-015 | Import/integration lỗi đi qua quarantine và replay idempotent | Ngăn dữ liệu chưa map hoặc retry làm sai stock | Accepted for Milestone 3 |

## Open decision template

```text
Decision ID:
Question:
Options:
Evidence:
Decision:
Owner:
Due date:
Impact on PRD/spec:
```
