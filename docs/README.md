# Luminex Documentation

## Tài liệu sản phẩm

| Mã | Tài liệu | Mục đích |
|---|---|---|
| 00 | [Source Synthesis](00-source-synthesis.md) | Nguồn, phạm vi sử dụng và xử lý mâu thuẫn |
| 01 | [Product Discovery](01-product-discovery.md) | Vấn đề, người dùng, pain point FOH/BOH, giả thuyết và cơ hội |
| 02 | [PRD](02-prd.md) | Mục tiêu, scope MVP, yêu cầu chức năng/phi chức năng |
| 03 | [Requirements Analysis](03-requirements-analysis.md) | Phân rã, ưu tiên, phụ thuộc, rủi ro và traceability |
| 04 | [User Stories & Acceptance](04-user-stories-acceptance.md) | User story và tiêu chí nghiệm thu theo vai trò |
| 05 | [Feature Specifications](05-feature-specifications.md) | Đặc tả hành vi, dữ liệu, UI và API theo tính năng |
| 06 | [FOH/BOH Pain Points](06-foh-boh-pain-points.md) | Bản đồ pain point và ranh giới tích hợp |
| 07 | [Scope & Roadmap](07-scope-and-roadmap.md) | MVP, các milestone sau và quyết định out-of-scope |
| 08 | [Glossary & Decisions](08-glossary-and-decisions.md) | Thuật ngữ và quyết định sản phẩm |
| 09 | [Unified Product Vision](09-unified-product-vision.md) | Hợp nhất FOH Lite và BOH Core |
| 10 | [FOH QR Guest Experience](10-foh-qr-guest-experience.md) | Đặc tả QR trước cửa và tại bàn |
## Tài liệu kỹ thuật

- [Architecture Overview](architecture/overview.md)
- [Data Model](architecture/data-model.md)
- [API Conventions](architecture/api-conventions.md)
- [Local Development Setup](setup/local-development.md)
- [Testing Strategy](setup/testing-strategy.md)
- [ADR-0001: BOH-first MVP](adr/0001-boh-first-mvp.md)
- [ADR-0002: FOH Lite QR edge](adr/0002-foh-lite-qr-edge.md)

## UI/UX reference

- [Luminex UI/UX Reference](uiux/README.md) — 20 màn hình FOH/BOH, scope mapping và nguyên tắc UX sản phẩm.

## Nguồn đầu vào

Các bản spec, idea brief và product vision đã được đưa vào [docs/source/](source/README.md) để repository tự chứa đủ context của dự án.

## Nguyên tắc đọc

Các tài liệu nguồn là đầu vào để phân tích. Chỉ các quyết định đã được chuẩn hóa trong PRD, requirements analysis và feature specifications mới là baseline triển khai. Những điểm chưa xác nhận được đánh dấu `TBD` hoặc nằm trong decision log.
