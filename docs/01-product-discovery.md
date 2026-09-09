# 3.1 Product Discovery

## Product vision

Luminex giúp doanh nghiệp F&B nhiều chi nhánh biến dòng vận hành từ FOH đến BOH thành dữ liệu có thể truy vết: bán gì, cần bao nhiêu, đã mua bao nhiêu, đã nhận bao nhiêu, chuyển đi đâu, còn lại bao nhiêu và thất thoát ở đâu.

Trong bối cảnh nhà hàng ở trung tâm thành phố/phố đi bộ có nhiều khách quốc tế, discovery bổ sung hai moment FOH có tần suất cao: khách đứng trước cửa cần biết có nên chờ; khách đã ngồi cần gọi thêm mà không phải tìm nhân viên.

## Problem framing

### Problem statement

Doanh nghiệp F&B hiện thiếu một nguồn dữ liệu tập trung và nhất quán để theo dõi nguyên liệu từ purchasing → receiving → warehouse → branch → count → wastage. Spreadsheet, giấy tờ và công cụ rời rạc khiến tồn kho không đáng tin, thiếu hàng khó giải thích, và chủ/manager không biết hao hụt đang đến từ branch, ingredient hay quy trình nào.

### Desired outcome

- Purchasing biết PO nào đã đặt/đã nhận và chênh lệch bao nhiêu.
- Warehouse biết tồn trung tâm và các yêu cầu chuyển hàng.
- Branch biết tồn hiện tại, thực hiện count và ghi rõ lý do wastage.
- Owner/Manager so sánh branch và giá trị thất thoát bằng một dashboard.
- FOH có luồng bán hàng/table/order rõ ràng để dữ liệu lý thuyết được tích hợp về BOH ở milestone sau.

## User and job map

| Người dùng | Job to be done | Khoảnh khắc đau nhất |
|---|---|---|
| Purchasing Manager | Đặt đúng lượng, đúng thời điểm và theo dõi delivery | PO, file giao hàng và tồn kho không khớp |
| Warehouse Admin | Nhận hàng, cập nhật stock và cấp hàng cho branch | Chênh lệch nhận hàng/transfer không có dấu vết |
| Branch Manager | Đảm bảo đủ nguyên liệu và giải thích variance | Xin hàng qua chat/giấy; count và wastage không nhất quán |
| Owner | Biết tiền đang mất ở đâu | Không có số liệu branch/ingredient đáng tin để so sánh |
| FOH Host/Server/Cashier | Phục vụ nhanh, đúng bàn, đúng bill | Chờ bàn, order/billing chậm và dữ liệu sales không nối vào usage |
| Kitchen/Bar staff | Chuẩn bị đúng ticket và báo thiếu nguyên liệu | Không biết item unavailable/shortage sớm |

## Pain points theo FOH và BOH

### FOH pain points

- Reservation/walk-in/table assignment khó đồng bộ với table readiness.
- Bàn vừa thanh toán chưa thể dùng ngay vì còn cleaning; nếu có khách chờ thì cần ưu tiên và đo thời gian.
- Server phải theo dõi order, item notes, chuyển bàn/merge/split; Kitchen và Bar cần nhận đúng station.
- Delay, unavailable item hoặc thiếu nguyên liệu được phát hiện muộn; FOH phải báo bằng lời/chat.
- Billing, split bill, discount, payment và refund cần quyền hạn rõ; dữ liệu sales dễ bị tách khỏi inventory.
- Owner thiếu liên kết giữa occupancy, best-selling item, service time và ingredient usage.

### BOH pain points

- Không biết current stock đáng tin do purchase/receipt/transfer/count ở nhiều file.
- Ordered quantity khác received quantity nhưng không có quy trình ghi nhận chênh lệch.
- Branch request không trace được từ request → approval → shipped → closed.
- Unit conversion carton/kg/litre/g/ml sai làm sai tồn và cost.
- Wastage không có quantity, reason và value nên không biết mất tiền ở đâu.
- Thiếu POS/recipe data khiến theoretical usage không tính được hoặc tính thủ công.
- AI có thể nhập nhanh nhưng nếu tự ghi dữ liệu sẽ tạo rủi ro kiểm soát.

### FOH QR pain points và cơ hội

- Khách đến lúc cao điểm không biết còn bàn, queue dài bao nhiêu hoặc wait có phù hợp time budget.
- Khách du lịch cần ngôn ngữ rõ, không muốn tải app/đăng ký trước khi biết tình hình.
- Việc hiển thị thời gian rời bàn của khách hiện tại quá chính xác hoặc mang tính cá nhân sẽ gây mất privacy và tạo kỳ vọng sai; cần range + timestamp + confidence.
- Khách đang ngồi muốn gọi thêm nhưng nhân viên đang phục vụ nhiều bàn; gọi lớn hoặc chờ lâu làm giảm cảm nhận hospitality.
- QR tại bàn cần có xác nhận đúng bàn, trạng thái request, đường lui sang nhân viên và không biến thành kênh đặt món không kiểm soát.
- Khách lớn tuổi hoặc không quen công nghệ vẫn phải được phục vụ bình thường; QR là lựa chọn bổ trợ.

## Opportunity framing

```text
Unreliable operational data
├── Chuẩn hóa master data + unit conversion
├── Traceable purchase → receipt → stock → transfer workflow
├── Daily count + wastage reason/value
├── Dashboard có drill-down về record nguồn
└── AI hỗ trợ nhập recipe và hỏi dữ liệu, luôn cần human approval
```

## Value proposition

“Luminex giúp đội vận hành F&B nhìn thấy một dòng nguyên liệu duy nhất từ lúc đặt mua đến lúc sử dụng và hao hụt, để mỗi chênh lệch đều có số lượng, giá trị, nguyên nhân và người chịu trách nhiệm.”

## Assumptions

- Người dùng có thể cung cấp daily count ở cấp ingredient/branch.
- Ingredient có thể chuẩn hóa theo purchase unit, stock unit và recipe unit.
- Standard price đủ cho valuation cơ bản trong MVP.
- Các branch có quy trình đủ tương đồng để dùng cùng workflow.
- Sales data có thể chưa có trong MVP; khi thiếu, `sold_qty_theory` phải được để trống/đánh dấu unavailable.
- Adoption cần được hỗ trợ bằng thao tác đơn giản và dữ liệu có thể truy vết.

## Product hypotheses

| ID | Giả thuyết | Tín hiệu xác thực |
|---|---|---|
| H1 | Một workflow tập trung giảm thời gian đối chiếu spreadsheet | Thời gian tạo PO/receipt/count giảm sau 2 tuần pilot |
| H2 | Bắt buộc ghi reason/value làm giảm unexplained variance | Tỷ lệ record có reason tăng; variance không giải thích giảm |
| H3 | Branch request có status rõ giúp giảm thiếu hàng | Tỷ lệ request overdue và request qua kênh ngoài giảm |
| H4 | AI onboarding hữu ích nếu user sửa được suggestion trước khi lưu | Thời gian tạo recipe và tỷ lệ accept/edit được đo |
| H5 | Dashboard có drill-down giúp owner ra quyết định nhanh hơn | Thời gian trả lời 3 câu hỏi vận hành mẫu giảm |
| H6 | Front-door QR minh bạch queue làm giảm câu hỏi lặp lại và queue abandonment do bất ngờ | Scan → availability → join/leave; khảo sát hiểu wait và tỷ lệ rời queue |
| H7 | Table QR add-on có trạng thái rõ làm giảm thời gian tiếp nhận order thêm nhưng không làm giảm CSAT | Time-to-ack, duplicate request, staff confirmation và guest feedback |

## Discovery plan

### Phỏng vấn

- 2 Purchasing Managers: PO, supplier, delivery discrepancy.
- 2 Warehouse Admins: receiving, transfer, stock adjustment.
- 3 Branch Managers: request, count, wastage, adoption.
- 1 Owner/Operations Manager: reporting và decision-making.
- 1 FOH lead + 1 Kitchen/Bar lead: item availability và POS/recipe integration.

### Artifact cần thu thập

- Mẫu PO, phiếu nhập, phiếu chuyển, count sheet, waste log.
- Danh sách unit/conversion hiện dùng.
- Menu/recipe/POS export nếu có.
- Ví dụ 5 discrepancy gần nhất.

### Discovery questions

- “Lần gần nhất anh/chị không biết vì sao tồn bị lệch là khi nào?”
- “Thông tin nào phải có trước khi duyệt/đóng một request?”
- “Nếu thiếu ingredient khi đang bán món, FOH biết bằng cách nào?”
- “Ai có quyền sửa số liệu và cần lưu bằng chứng gì?”

## Success signals

### Product

- Hoàn thành được core workflow từ ingredient tới dashboard.
- Không có stock mutation ngoài goods receipt, transfer, count/adjustment được cấp quyền.
- AI suggestion chưa approve không làm thay đổi dữ liệu.

### FOH Lite

- Khách hiểu tình trạng bàn/estimated wait trong vòng 30 giây.
- Front-door QR hỗ trợ ít nhất Vietnamese/English, không bắt buộc tải app.
- Guest có thể rời queue và chuyển sang staff fallback dễ dàng.
- Add-on request có trạng thái `đã nhận → đang xác nhận/chuẩn bị → đã phục vụ`.
- Staff vẫn là người xác nhận request; QR không tạo promise về thời gian phục vụ ngoài dữ liệu có căn cứ.

### Business

- Giảm thời gian tổng hợp spreadsheet.
- Tăng tỷ lệ daily count đúng hạn.
- Tăng tỷ lệ wastage có reason/value.
- Giảm unexplained variance và request không trace được.

## Discovery exit criteria

Discovery đủ để bắt đầu build khi đã xác nhận: role/permission, branch model, unit policy, goods receipt policy, daily count cadence, wastage reason list, standard price rule, POS data availability và owner của từng quy trình.
