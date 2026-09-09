# ADR-0002: Bổ sung FOH Lite QR vào MVP

## Status

Accepted

## Context

Luminex có tầm nhìn FOH → BOH nhưng các source product vision/idea brief ưu tiên BOH inventory & wastage. Người dùng bổ sung hai pain point thực tế của nhà hàng ở trung tâm/phố đi bộ: khách không biết tình trạng bàn/thời gian chờ; khách đã ngồi muốn gọi thêm nhưng nhân viên đang phục vụ nhiều bàn.

## Decision

MVP bổ sung FOH Lite gồm:

1. Front-door QR: availability, estimated wait range, party size, time budget, join/leave queue, multilingual no-login flow.
2. Table QR: table confirmation, menu/add-on request, assistance request, request status và staff acknowledgement.

Không đưa full reservation, table map, customer billing, payment, KDS hoặc autonomous service prediction vào MVP.

## UX and hospitality constraints

- QR bổ trợ, không thay thế staff.
- Không bắt tải app/login trước khi biết tình trạng.
- Wait dùng range + timestamp + confidence; không hứa thời điểm rời bàn của khách cụ thể.
- Guest luôn có leave/cancel và staff fallback.
- Form mobile-first, ngôn ngữ phù hợp tourist, touch target ≥44px, visible labels, status không chỉ bằng màu.

## Consequences

### Positive

- Giải quyết hai moment có tần suất cao mà không mở rộng thành full restaurant suite.
- Tạo dữ liệu demand/service request để kết nối POS/recipe/BOH sau này.
- Guest có cảm giác chủ động; staff giảm câu hỏi lặp lại và request bị bỏ sót.

### Negative

- Cần thêm Queue, GuestSession, TableSession, FOHRequest và staff console.
- Wait estimate ban đầu có thể thiếu dữ liệu nên phải hiển thị limitation.
- Cần kiểm soát token, rate limit, spam và privacy của guest flow.

## Revisit when

Sau pilot có dữ liệu scan, queue conversion, abandonment, add-on acknowledgement và CSAT; khi đó quyết định có mở rộng reservation/POS/KDS hay không.
