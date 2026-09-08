# ADR-0001: BOH-first MVP trong tầm nhìn FOH → BOH

## Status

Accepted

## Context

Tài liệu legacy mô tả một restaurant management suite rộng: reservation, seating, order, Kitchen/Bar, billing, payment, inventory và reports. Các tài liệu product vision/idea mới xác định một sản phẩm BOH inventory & wastage với 6 module và loại FOH/customer operation khỏi MVP.

## Decision

Luminex giữ tầm nhìn FOH → BOH nhưng triển khai BOH-first MVP. FOH pain point và entity cần cho integration được ghi nhận; full FOH workflows là milestone/product decision riêng.

## Consequences

### Positive

- MVP có thể hoàn thành core business value về stock/wastage.
- Tránh xây đồng thời reservation, order, KDS, billing, payment và inventory.
- Có thể thiết kế recipe/POS boundary sớm mà chưa phụ thuộc vào full FOH implementation.

### Negative

- Chưa trả lời trực tiếp mọi pain point của FOH trong phiên bản đầu.
- `sold_qty_theory` có thể thiếu nếu chưa có POS integration.
- Cần quản lý kỳ vọng rằng “FOH đến BOH” là product vision, không phải toàn bộ MVP.

## Revisit when

Sau pilot BOH có đủ evidence về missing sales data, item availability và operational dependency để ưu tiên milestone FOH/integration.
