# Luminex UI/UX Reference

Bộ màn hình tham chiếu cho Luminex FOH → BOH, dùng để thống nhất information architecture, interaction pattern, content hierarchy và visual language trước khi triển khai frontend.

## Product design principles

- Guest flow mobile-first; staff console tablet/desktop-first.
- Vietnamese/English là hai ngôn ngữ ưu tiên cho guest-facing flow.
- Body text tối thiểu 16px ở guest flow; touch target tối thiểu 44×44px.
- Một primary CTA cho mỗi trạng thái; thao tác destructive cần confirmation và recovery.
- Status luôn có text/icon, không dùng màu làm tín hiệu duy nhất.
- Queue/request luôn có timestamp, freshness, loading, empty, stale, error và retry state.
- Table QR luôn xác nhận đúng bàn, có staff fallback và không hứa thời gian phục vụ khi chưa có dữ liệu.
- BOH console luôn hiển thị branch scope, unit, actor, timestamp, source record và approval state.
- AI chỉ hiển thị suggestion, confidence, warning và nguồn dữ liệu; mutation cần human approval.

## Screen catalog

| ID | Màn hình | Khu vực | Phạm vi sản phẩm |
| --- | --- | --- | --- |
| 01 | Dashboard tổng quan hao hụt | BOH | BOH Core MVP |
| 02 | Nhận hàng và đối soát PO | BOH | BOH Core MVP |
| 03 | Kiểm kê cuối ngày và hao hụt | BOH | BOH Core MVP |
| 04 | AI Recipe Onboarding / BOM | BOH | BOH Core MVP, human approval |
| 05 | Front-door QR: availability và queue | FOH | FOH Lite QR MVP |
| 06 | Table QR: add-on và assistance | FOH | FOH Lite QR MVP |
| 07 | Host/Staff Console điều phối FOH | FOH | FOH Lite QR MVP |
| 08 | Floor Plan Console | FOH | Roadmap |
| 09 | Kitchen/Bar Display System | FOH–BOH | Roadmap |
| 10 | Split Bill Console | FOH | Roadmap |
| 11 | Stock Transfer | BOH | BOH Core MVP |
| 12 | Purchasing và Procurement | BOH | BOH Core MVP |
| 13 | Central Warehouse Stock | BOH | BOH Core MVP |
| 14 | Menu và BOM Studio | BOH | BOH Core MVP |
| 15 | Wastage Analytics | BOH | BOH Core MVP/Milestone 2 |
| 16 | QR Order và Table Token Admin | FOH/Admin | FOH Lite QR MVP |
| 17 | POS Audit Log | Platform | Integration roadmap |
| 18 | RBAC và Access Control | Platform | MVP nền tảng |
| 19 | Reservation Console | FOH | Roadmap |
| 20 | Guest 360 và Loyalty CRM | FOH | Roadmap |

## Scope mapping

- **FOH Lite MVP:** screen 05–07 và phần guest/staff data contract liên quan.
- **BOH Core MVP:** screen 01–04, 11–15 và các role/configuration flow cần thiết.
- **Platform foundation:** screen 16 và 18, cùng token, authorization, audit và branch scope.
- **Roadmap:** screen 08–10, 17, 19–20; không được hiển thị như capability đã live trong MVP.

## Product handoff rules

Mỗi màn hình khi triển khai phải đối chiếu với [PRD](../02-prd.md), [Requirements Analysis](../03-requirements-analysis.md), [User Stories](../04-user-stories-acceptance.md) và [Feature Specifications](../05-feature-specifications.md). Business rules về queue, QR token, request acknowledgement, inventory ledger, wastage, RBAC và AI approval lấy từ các tài liệu đó; màn hình chỉ thể hiện và dẫn dắt hành vi, không tự định nghĩa rule mới.
