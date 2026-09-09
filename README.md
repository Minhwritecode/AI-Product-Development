# Luminex – Hệ thống quản trị vận hành nhà hàng thông minh

Luminex là nền tảng quản trị vận hành nhà hàng từ Front-of-House (FOH) đến Back-of-House (BOH). Mục tiêu của MVP là tạo một nguồn dữ liệu đáng tin cậy cho tồn kho nguyên liệu và hao hụt ở mô hình F&B nhiều chi nhánh, đồng thời chuẩn bị nền tảng tích hợp dữ liệu FOH/POS về sau.

## Trạng thái dự án

- Giai đoạn: Product Discovery → Product Definition.
- MVP: BOH Inventory, Purchasing, Goods Receipt, Branch Stock, Daily Count, Wastage, Dashboard và AI Assistance; cộng thêm FOH Lite QR.
- FOH Lite: QR trước cửa để xem tình trạng bàn/xếp hàng và QR tại bàn để gọi thêm/hỗ trợ; chưa triển khai full reservation, billing, KDS.
- AI: chỉ gợi ý/giải thích; mọi thay đổi dữ liệu phải được người dùng xem và duyệt.

## Đọc tài liệu theo thứ tự

1. [Product Discovery](docs/01-product-discovery.md)
2. [PRD](docs/02-prd.md)
3. [Phân tích yêu cầu](docs/03-requirements-analysis.md)
4. [User Stories & Acceptance Criteria](docs/04-user-stories-acceptance.md)
5. [Feature Specifications](docs/05-feature-specifications.md)
6. [Kiến trúc hệ thống](docs/architecture/overview.md)
7. [Hướng dẫn setup](docs/setup/local-development.md)
8. [Unified Product Vision](docs/09-unified-product-vision.md)
9. [FOH QR Guest Experience](docs/10-foh-qr-guest-experience.md)

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
- Scope discipline: chỉ mở rộng sang FOH khi có quyết định sản phẩm và nguồn dữ liệu tích hợp rõ ràng.

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
