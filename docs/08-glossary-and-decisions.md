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
