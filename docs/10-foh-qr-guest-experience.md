# FOH Lite — QR Guest Experience Specification

## 1. Problem

Nhà hàng ở khu trung tâm/phố đi bộ thường có traffic du lịch cao. Khi đông, khách đứng trước cửa không biết còn bàn không, phải chờ bao lâu, hoặc thời gian chờ có phù hợp với lịch trình của họ hay không. Khi đã ngồi, khách muốn gọi thêm nhưng nhân viên đang phục vụ nhiều bàn nên yêu cầu bị chậm hoặc khách phải gọi lớn/tìm mắt nhân viên.

## 2. Target segments

| Segment | Context | Need | UX response |
|---|---|---|---|
| Tourist có lịch trình ngắn | Không biết khu vực, không muốn tải app | Biết wait có đáng không | Language-first, no login, wait range, leave queue |
| Nhóm gia đình/bạn bè | Party size lớn, có trẻ em/hành lý | Biết khả năng xếp bàn phù hợp | Party size, accessibility/preference, queue expectation |
| Khách địa phương/repeat | Đã quen quy trình | Gọi thêm nhanh | Table QR, reorder/add-on, minimal fields |
| Khách lớn tuổi/ít quen công nghệ | Khó đọc QR/form phức tạp | Được phục vụ không áp lực | Font lớn, CTA rõ, staff fallback, không ép QR |
| Khách cần hỗ trợ tiếp cận | Cần lối đi/bàn phù hợp | Được ghi nhận yêu cầu | Optional accessibility note, không yêu cầu giải thích dài |

## 3. Front-door QR flow

### Entry

Standy cần có:

- QR ở độ cao dễ quét, tương phản cao, có URL ngắn dự phòng.
- Copy song ngữ tối thiểu: “Scan to see table availability / Xem tình trạng bàn”.
- Dòng trấn an: “Không cần tải app / No app required”.
- Dòng cập nhật: “Cập nhật lần cuối … / Last updated …”.
- Nhân viên có thể hỗ trợ khách không dùng QR.

### Step 1 — Language and intent

Chỉ hỏi một lựa chọn chính: `Tiếng Việt / English`; các ngôn ngữ khác là progressive disclosure. Sau đó hiển thị hai CTA: `Xem tình trạng bàn` và `Tôi đã đến, muốn xếp hàng`.

### Step 2 — Party and time budget

Form tối thiểu:

- Số khách: stepper, touch target ≥ 44px.
- Có cần bàn tiếp cận/ghế trẻ em không? optional.
- “Bạn có thể chờ khoảng bao lâu?”: `≤15 phút`, `15–30 phút`, `30–60 phút`, `Không chắc`.

Không yêu cầu tên/số điện thoại trước khi khách biết tình trạng. Đây là cách giảm cognitive load và tăng cảm giác kiểm soát.

### Step 3 — Availability result

Hiển thị bằng text rõ, không chỉ màu:

- `Có thể nhận khách ngay`.
- `Ước tính chờ 20–35 phút`.
- `Đang đông — hiện chưa thể ước tính chính xác`.
- `Tạm ngưng nhận hàng chờ`.

Mỗi kết quả có:

- Timestamp cập nhật.
- Số nhóm đang chờ hoặc một mô tả định tính phù hợp privacy.
- Confidence label nếu dữ liệu chưa đủ.
- CTA `Vào hàng chờ`, `Xem menu trong lúc chờ`, `Hỏi nhân viên`.

Không hiển thị “thời gian khách hiện tại sẽ rời đi” như một cam kết cá nhân. Thay vào đó dùng range dựa trên historical/operational estimate và nói rõ đây là ước tính.

### Step 4 — Join queue

Fields:

- Party size và preference đã prefill.
- Tên gọi ngắn hoặc nickname optional.
- Số điện thoại/email chỉ bắt buộc nếu khách chọn nhận thông báo.
- Checkbox xác nhận muốn được gọi khi bàn sẵn sàng.

Success screen cần có queue code, vị trí/nhóm chờ ở mức privacy-safe, estimate range, last updated và CTA `Rời hàng chờ`.

### States and recovery

- `No data`: xin lỗi + staff fallback + thử lại.
- `Stale data`: giữ kết quả cuối cùng nhưng gắn timestamp rõ.
- `Wait exceeds time budget`: gợi ý xem menu/địa điểm khác/leave queue; không giữ khách bằng thông tin mơ hồ.
- `Queue full`: nói rõ lý do và cho phép hỏi nhân viên.
- `Network error`: hiển thị QR/URL staff fallback và không tạo queue giả.

## 4. Table QR flow

### Entry and trust

Mỗi bàn có QR token riêng, signed và không chứa PII. Landing screen phải xác nhận: `Bàn A12 · Tầng 1` hoặc tên bàn phù hợp, cùng nút `Đây không phải bàn của tôi`.

### Primary actions

Một màn hình có tối đa một CTA chính tại từng bước:

1. `Xem menu`.
2. `Gọi thêm`.
3. `Cần nhân viên hỗ trợ`.

Không biến QR thành menu bắt buộc; staff vẫn hỗ trợ khách không muốn dùng điện thoại.

### Add-on ordering

- Menu theo category, có ảnh/mô tả/allergen nếu có dữ liệu.
- Search rõ ràng; “gọi lại món” chỉ hiện khi hệ thống biết item trước đó của session.
- Cart hiển thị quantity, note, estimated preparation range.
- Note là optional, không thay thế allergy disclosure; allergy cần một field riêng có warning.
- Submit cần confirmation: món, quantity, note, bàn, estimated range.
- Sau submit: `Đã nhận yêu cầu → Đang xác nhận → Đang chuẩn bị → Đã phục vụ`.

### Staff assistance

Các quick actions:

- Gọi nhân viên.
- Xin thêm nước/khăn.
- Báo vấn đề món ăn.
- Xin thanh toán — chỉ tạo request, không thực hiện payment trong FOH Lite.

Request có cooldown để tránh gửi trùng và có cancel trong thời gian ngắn.

## 5. Behavioral rationale

| Principle | Design choice | Expected effect |
|---|---|---|
| Uncertainty reduction | Hiển thị range, timestamp, data confidence | Giảm bực bội khi chờ |
| Perceived control | Cho time budget, leave queue, retry, staff fallback | Khách cảm thấy chủ động |
| Cognitive load | Một câu hỏi mỗi bước, prefill, no-login | Khách du lịch hoàn thành nhanh |
| Social comfort | Không bắt khách gọi lớn; QR discreet | Giữ cảm giác lịch sự |
| Trust | Xác nhận bàn và trạng thái request | Giảm sợ gửi nhầm/không ai nhận |
| Hospitality | QR luôn có đường lui sang nhân viên | Công nghệ bổ trợ, không thay thế chăm sóc |

## 6. Accessibility and responsive rules

- Mobile-first, body text tối thiểu 16px.
- Touch target tối thiểu 44×44px, khoảng cách tối thiểu 8px.
- Visible labels, inline error, semantic input type, `aria-live` cho trạng thái queue/order.
- Không dùng màu làm tín hiệu duy nhất; status luôn có text/icon.
- Hỗ trợ keyboard/screen reader và reduced motion.
- Không horizontal scroll; test ở 320px width.
- Hiển thị progress/loading khi request quá 300ms; timeout có retry rõ ràng.

## 7. Analytics events

`front_qr_scan`, `language_selected`, `availability_viewed`, `wait_budget_selected`, `queue_joined`, `queue_left`, `queue_called`, `table_qr_opened`, `menu_viewed`, `addon_cart_started`, `addon_submitted`, `addon_confirmed_by_staff`, `assistance_requested`, `qr_error`.

Không thu thập dữ liệu cá nhân ngoài mục đích thông báo và vận hành queue.

## 8. Operational controls and privacy lifecycle

- Branch phải có operating state rõ: `OPEN`, `PAUSED`, `FULL`, `CLOSED`; `PAUSED/FULL/CLOSED` luôn kèm next action cho guest.
- Queue policy phải khai báo capacity, party-size range, wait estimate TTL, time-budget options và service hours; policy có effective time.
- Host/Manager có thể override state/estimate nhưng phải nhập reason; guest chỉ thấy kết quả privacy-safe, không thấy dữ liệu khách khác.
- Guest session và notification contact có expiry/retention; guest có thể leave queue và chấm dứt session theo policy.
- QR/table endpoint cần rate limit, idempotency cho submit và response generic cho token sai/hết hạn; không tạo queue/request giả khi timeout.
- Notification là best-effort: nếu gửi thất bại, guest vẫn dùng queue code/request status và CTA hỏi nhân viên.

### Bổ sung analytics vận hành

`queue_state_changed`, `queue_estimate_refreshed`, `queue_notification_sent`, `queue_notification_failed`, `queue_staff_override`, `qr_request_acknowledged`, `qr_request_routed`, `qr_request_rejected`, `qr_request_completed`, `staff_fallback_used`.

Mỗi event vận hành cần `event_id`, `occurred_at`, `branch_id`, `source_id`, `actor_type` và outcome; không ghi raw phone/email vào analytics.
