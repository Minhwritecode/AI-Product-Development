<p align="center">
  <img src="docs/assets/luminex-logo.svg" alt="Luminex Operations OS" width="320" />
</p>

# Luminex – Hệ thống quản trị vận hành nhà hàng thông minh

Luminex là nền tảng quản trị vận hành nhà hàng kết nối Front-of-House (FOH) đến Back-of-House (BOH). Mục tiêu production core là nối liền hành trình reservation/walk-in → seating → order → kitchen/bar → serving → billing/payment → closing với purchasing, stock, count và wastage cho mô hình F&B nhiều chi nhánh. Xem chi tiết nhận diện thương hiệu tại [Brand Identity](docs/uiux/brand-identity.md).

## Trạng thái dự án

- Giai đoạn: Weeks 1–2 đã có vertical slice; Weeks 3–4 đang hoàn thiện nền tảng staff/task và BOH master data. Weeks 5–16 chưa phải production live.
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

## Chạy nhanh với hạ tầng cloud

```bash
cp .env.example .env
make cloud-config-check
make app-up
```

Docker Compose chỉ chạy backend/frontend và kết nối tới managed PostgreSQL + Redis qua biến môi trường; repository không dựng database local. Xem [hướng dẫn cloud](docs/setup/cloud-database.md) và [hướng dẫn phát triển](docs/setup/local-development.md).

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
make cloud-config-check # kiểm tra Compose đã nhận cloud credentials
make app-up     # build và chạy backend + frontend, dùng cloud PostgreSQL + Redis
make app-down   # dừng toàn bộ Compose stack
```

## License

Chưa quyết định. Không sử dụng dữ liệu nhà hàng thật trong repository này.
