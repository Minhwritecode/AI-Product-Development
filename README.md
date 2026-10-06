# Luminex – Hệ thống quản trị vận hành nhà hàng thông minh

Luminex là nền tảng quản trị vận hành nhà hàng từ Front-of-House (FOH) đến Back-of-House (BOH). Mục tiêu production core là nối liền hành trình reservation/walk-in → seating → order → kitchen/bar → serving → billing/payment → closing với purchasing, stock, count và wastage cho mô hình F&B nhiều chi nhánh.

## Trạng thái dự án

- Giai đoạn: Product Definition hoàn tất; chuẩn bị implementation production core.
- Phạm vi production core: restaurant/branch setup, RBAC, staff/shift, reservation, walk-in/queue, floor/table/seating/cleaning, menu/order, kitchen/bar tickets, serving, billing/payment/refund/receipt/EOD và BOH inventory/purchasing/count/wastage/dashboard.
- FOH QR là entry point bổ trợ cho full FOH, không thay thế flow phục vụ trực tiếp của Host, Server, Kitchen, Bar và Cashier.
- AI: chỉ gợi ý/giải thích; mọi thay đổi dữ liệu phải được người dùng xem và duyệt.

## Đọc tài liệu theo thứ tự

1. [Product Discovery](docs/01-product-discovery.md)
2. [PRD](docs/02-prd.md)
3. [Phân tích yêu cầu](docs/03-requirements-analysis.md)
4. [User Stories & Acceptance Criteria](docs/04-user-stories-acceptance.md)
5. [Feature Specifications](docs/05-feature-specifications.md)
6. [FOH/BOH Pain Points & Role Matrix](docs/06-foh-boh-pain-points.md)
7. [Implementation Roadmap](docs/07-scope-and-roadmap.md)
8. [Kiến trúc hệ thống](docs/architecture/overview.md)
9. [Hướng dẫn setup](docs/setup/local-development.md)
10. [Unified Product Vision](docs/09-unified-product-vision.md)
11. [FOH QR Guest Experience](docs/10-foh-qr-guest-experience.md)

Danh mục tài liệu nằm tại [docs/README.md](docs/README.md). Nguồn và cách xử lý mâu thuẫn được ghi tại [docs/00-source-synthesis.md](docs/00-source-synthesis.md).

## Chạy nhanh môi trường nền

```bash
cp .env.example .env
make infra-up
```

Các service nền: PostgreSQL, Redis. Frontend/backend hiện là skeleton để đội phát triển bổ sung theo PRD; xem [docs/setup/local-development.md](docs/setup/local-development.md) để chạy toàn bộ.

## Nguyên tắc dự án

- Traceability: mọi yêu cầu quan trọng có mã và liên kết tới user story/feature.
- Transaction-first: nghiệp vụ cộng/trừ tồn kho phải an toàn và có audit log.
- Role-based access: người dùng chỉ thấy dữ liệu và thao tác phù hợp vai trò/chi nhánh.
- Human-in-the-loop: AI không tự phê duyệt, tự sửa tồn kho, tự gửi PO hay tự xác nhận hao hụt.
- Scope discipline: hoàn thiện production core theo [Scope & Roadmap](docs/07-scope-and-roadmap.md); không mở rộng sang payroll/HR compliance, GL/accounting consolidation, supplier portal, autonomous AI hoặc enterprise platform khi chưa có product decision riêng.

## Lệnh phát triển chính

```bash
make help       # xem các lệnh
make install    # cài dependency workspace
make dev        # chạy frontend + backend
make test       # chạy kiểm thử
make infra-up   # chạy PostgreSQL + Redis
make infra-down # dừng hạ tầng
```

## License

Chưa quyết định. Không sử dụng dữ liệu nhà hàng thật trong repository này.
