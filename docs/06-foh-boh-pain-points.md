# FOH / BOH Pain Points & Integration Map

## 1. Vì sao cần nhìn cả FOH và BOH

FOH tạo ra tín hiệu vận hành và sales; BOH chịu trách nhiệm biến tín hiệu đó thành purchase, stock và wastage control. Nếu chỉ xây BOH mà không hiểu FOH, hệ thống có thể có số lượng tồn nhưng không giải thích được món bán, item unavailable, delay hay lý do nhu cầu tăng. Nếu xây cả hai ngay trong MVP, scope và rủi ro sẽ vượt mục tiêu kiểm soát inventory.

## 2. Bản đồ pain point

| Vùng | Pain point | Hệ quả | Cách Luminex xử lý |
|---|---|---|---|
| FOH | Table/reservation/walk-in không đồng bộ | Chờ lâu, sử dụng bàn sai | Ghi nhận là context; future FOH module |
| FOH | Order chưa routing đúng Kitchen/Bar | Chậm phục vụ, sai item | Future POS/KDS integration |
| FOH | Item unavailable do thiếu ingredient biết muộn | Nhận order không thể làm | Future availability signal |
| FOH | Billing/payment/discount phân quyền phức tạp | Sai doanh thu, khó audit | Ngoài MVP; future FOH boundary |
| FOH | Sales không nối với recipe | Không có theoretical usage | POS sales import + mapping milestone 3 |
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
