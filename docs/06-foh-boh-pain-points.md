# FOH / BOH Pain Points & Integration Map

## 1. Vì sao cần nhìn cả FOH và BOH

FOH tạo ra nhu cầu, trạng thái phục vụ và sales; BOH chịu trách nhiệm biến tín hiệu đó thành purchase, stock và wastage control. Production core phải nối hai phía nhưng vẫn giữ boundary: FOH sở hữu guest/table/order/bill/payment, BOH sở hữu ingredient/receipt/stock/count/wastage; dữ liệu thiếu hoặc chưa map phải trở thành exception có thể xử lý, không được suy diễn.

## 2. Bản đồ pain point

| Vùng | Pain point | Hệ quả | Cách Luminex xử lý |
|---|---|---|---|
| FOH | Table/reservation/walk-in không đồng bộ | Chờ lâu, sử dụng bàn sai | Reservation, queue, floor/table state, seating và cleaning task có source/audit |
| FOH | Order chưa routing đúng Kitchen/Bar | Chậm phục vụ, sai item | Menu station mapping và ticket state theo Kitchen/Bar |
| FOH | Item unavailable do thiếu ingredient biết muộn | Nhận order không thể làm | Availability signal và exception khi menu/recipe/stock chưa đủ |
| FOH | Billing/payment/discount phân quyền phức tạp | Sai doanh thu, khó audit | Bill, split, discount, payment/refund và EOD có permission/idempotency |
| FOH | Sales không nối với recipe | Không có theoretical usage | Mapping menu/recipe version; event chưa map vào quarantine |
| BOH | PO/receipt/stock ở nhiều file | Tồn không đáng tin | F-01–F-04 |
| BOH | Transfer request không trace | Branch thiếu hàng, trách nhiệm mờ | F-05 |
| BOH | Count/wastage không có reason/value | Không biết tiền thất thoát | F-06/F-07 |
| BOH | Unit conversion sai | Sai quantity/cost | F-01 canonical units |
| BOH | AI nhập nhanh nhưng dễ sai | Ô nhiễm master/recipe | F-08 approval gate |

## 3. Luồng dữ liệu mục tiêu

```text
FOH reservation/order/billing (future)
                │ sales event + POS item code
                ▼
          MenuItem + Recipe version
                │ theoretical usage
                ▼
BOH: Count → Variance → Wastage → Dashboard

BOH: Supplier → PO → Receipt → Warehouse → Branch Request → Branch Stock
```

## 4. Ranh giới trách nhiệm

- FOH/POS là source của event bán hàng và trạng thái phục vụ.
- Luminex BOH là source của ingredient master, receipt, stock movement, count và wastage.
- Recipe version là điểm nối; phải versioned để sales lịch sử không bị tính lại sai khi recipe đổi.
- Integration không được tự tạo stock mutation ngoài contract đã phê duyệt.

## 5. Cách đo khi mở rộng FOH

- Order-to-kitchen routing success rate.
- Item unavailable được phát hiện trước khi nhận order.
- Table cleaning turnaround time.
- Sales event import success/idempotency rate.
- Tỷ lệ sales line map được tới recipe version.
- Chênh lệch theoretical vs actual usage theo branch.

## 6. Ma trận vai trò và tính năng

Ma trận này phân biệt rõ tính năng Luminex triển khai trong production core với các vai trò
chỉ được giữ ở ranh giới tích hợp. Một vai trò không được suy ra quyền từ tên
hiển thị trên frontend; backend phải kiểm tra role và branch scope.

| Vị trí | Pain point chính | Tính năng trong Luminex production core | Không thuộc core scope / ranh giới |
|---|---|---|---|
| Admin nhà hàng | Cấu hình phân tán, khó kiểm soát quyền và QR | Branch/warehouse/table config, operating state, queue policy, user/role/branch membership, token rotate/revoke, audit | Không tự duyệt mọi nghiệp vụ thay cho owner nếu policy yêu cầu approver khác |
| Owner / Operations Manager | Không biết branch nào lệch tồn, hao hụt hoặc queue đang quá tải | Cross-branch dashboard, drill-down source record, review exception; approval correction khi milestone cho phép | Không sửa trực tiếp ledger hoặc dữ liệu lịch sử |
| Purchasing Manager | PO, delivery và received quantity không khớp | Supplier, draft PO, gửi PO, theo dõi expected/received/discrepancy | Không xác nhận stock nếu chưa qua goods receipt |
| Warehouse Admin | Nhận hàng và cấp hàng không trace được, unit dễ sai | Master ingredient/unit, goods receipt, warehouse stock, approve/reject/ship stock request, ledger view | Không sửa trực tiếp posted ledger; không xem/sửa branch ngoài scope |
| Branch Manager | Không biết tồn thật, xin hàng qua kênh ngoài, khó giải thích hao hụt | Xem branch stock, tạo stock request, daily count, ghi wastage reason/value, xem variance | Không duyệt request của chính mình nếu policy yêu cầu tách quyền |
| Host / FOH Lead | Khách không biết còn bàn, queue/reservation bị gọi sai hoặc request bị bỏ sót | Reservation, walk-in/queue, availability, call/seat/cancel/expire, table assignment, acknowledge/route/reject/complete QR request, staff fallback | Không quyết định payment/refund ngoài quyền |
| Server | Đang phục vụ nhiều bàn nên chậm nhận yêu cầu, dễ sai round/bàn | Mở service session, tạo/gửi order, nhận add-on, theo dõi ticket, serve, request payment, transfer/merge theo quyền | Không sửa paid bill hoặc vượt discount/refund permission |
| Guest | Không biết nên chờ bao lâu; gọi thêm khó trong giờ cao điểm | Front-door QR availability, party size, time budget, join/leave queue; table QR menu, add-on, assistance và status | Không bắt login/app/contact; không thấy PII khách khác; request chưa staff acknowledge chưa phải order |
| Kitchen Staff | Food ticket, notes, delay và thiếu nguyên liệu khó theo dõi | Station ticket: accept/prepare/complete/delay/reject, hand-over và shortage signal | Không xem payment/revenue ngoài context cần cho ticket |
| Bar Staff | Beverage ticket dễ lẫn với food và modifier dễ mất | Beverage station ticket, modifier, prepare/complete/delay/reject và hand-over | Không xem payment/revenue ngoài context cần cho ticket |
| Cashier | Billing, split bill và payment dễ lệch hoặc thiếu audit | Bill review, tax/service charge, discount theo quyền, split, payment, refund, receipt và end-of-day reconciliation | Không sửa menu/recipe hoặc posted financial event trực tiếp |
| AI assistant | Nhập liệu và truy vấn mất thời gian nhưng tự động hóa có rủi ro | Recipe suggestion/read-only Q&A trong quyền của user, confidence, warning, source và approval | Không phải business role; không tự mutate hoặc approve dữ liệu |

### Quy tắc giao tiếp giữa vai trò

- Guest → Host/Server: queue hoặc FOH request, có session/table scope và trạng thái.
- Host/Server → Kitchen/Bar/Cashier: truyền order/ticket/payment request theo
  permission; không bỏ qua state machine hoặc audit.
- FOH order/sales → BOH: chỉ tạo theoretical usage khi menu/recipe mapping hợp lệ;
  không tự tạo stock mutation từ dữ liệu thiếu.
- Purchasing → Warehouse: PO và goods receipt; receipt confirmed mới tăng stock.
- Warehouse → Branch: stock request approved → shipment → branch acceptance;
  mỗi bước có owner và audit.
- Branch → Owner/Operations: count, wastage và variance có source record;
  dashboard không thay thế bản ghi nghiệp vụ.
