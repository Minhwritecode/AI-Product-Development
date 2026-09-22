# UI/UX Alignment Review — Stitch vs FOH/BOH Baseline

## 1. Kết luận

Hai bộ Stitch có chất lượng visual tốt và đã thể hiện đúng nhiều pain point: queue transparency, table request, stock trace, daily count, wastage evidence và role-based operations. Tuy nhiên đây vẫn là prototype reference, chưa hoàn toàn sẵn sàng để xem như MVP UI.

Mức đánh giá:

- **Visual direction:** phù hợp Luminex và hospitality-grade operations.
- **FOH clarity:** tốt ở front-door QR và table QR, cần khóa lại copy/state trước implementation.
- **BOH clarity:** tốt ở inventory/wastage density, cần tách rõ dữ liệu thật, dữ liệu thiếu và dữ liệu roadmap.
- **Scope alignment:** chưa đạt vì một số màn hình hiển thị payment, POS/KDS live, sold theory hoặc AI action như đã production-ready.
- **Accessibility/interaction:** có nền tảng tốt nhưng phải kiểm tra HTML thật bằng browser/keyboard/screen reader trước khi code hóa.

## 2. Quy tắc review áp dụng

- Mobile-first cho guest QR; tablet/desktop-first cho staff console.
- Body text tối thiểu 16px cho guest, touch target tối thiểu 44×44px.
- Không dùng màu là tín hiệu duy nhất; badge phải có text/icon.
- Mọi mutation có loading, disabled, success/error, retry và confirmation phù hợp.
- Mọi trạng thái queue/request/notification có timestamp, freshness và recovery action.
- Không hiển thị dữ liệu POS/KDS/payment như có thật nếu integration chưa tồn tại.
- Prototype HTML/ảnh không phải implementation; không chỉnh trực tiếp để “giả” thành sản phẩm.

## 3. Điểm đã khớp tốt

### FOH

- Front-door screen có language switch, party size, time budget, range wait, queue count và staff fallback.
- Table QR có table identity, menu category, add-on cart, request status và copy staff acknowledgement.
- Host console phù hợp với nhu cầu queue ownership và điều phối tại cửa.
- Màu xanh/amber/coral tạo hierarchy rõ cho trạng thái vận hành, nếu luôn đi kèm text/icon.

### BOH

- Dashboard đặt wastage, low stock, PO discrepancy và branch comparison ở vị trí dễ thấy.
- Goods receipt và daily count thể hiện ordered/received/actual/reason/evidence, đúng hướng traceability.
- Wastage analytics có root-cause breakdown và drill-down ledger.
- AI recipe screen có cấu trúc suggestion/warning/review phù hợp human-in-the-loop.

## 4. Các lệch cần xử lý trước khi implementation

| Mức | Khu vực | Quan sát từ prototype | Rủi ro | Quy tắc cần áp dụng |
|---|---|---|---|---|
| Critical | Table QR | Có “Kiểm hóa đơn / Tạm tính & Pay” | Gợi ý payment trong MVP ngoài scope | Ẩn/đổi thành `Xem yêu cầu` hoặc gắn rõ roadmap |
| Critical | Table QR | Copy gửi trực tiếp tới Bar/Kitchen | Bỏ qua staff acknowledgement và KDS ngoài MVP | Copy phải là “Gửi yêu cầu để nhân viên xác nhận” |
| Critical | Dashboard | “KDS & POS Live Connected”, FOH capacity live | Tạo ấn tượng integration đã sẵn sàng | Gắn `ROADMAP/DEMO DATA` hoặc bỏ khỏi MVP view |
| Critical | Daily Count | Thiếu POS nhưng hiển thị theoretical theo recipe | Vi phạm `sold_qty_theory = unavailable` | Hiển thị `NOT_AVAILABLE` và không tính variance chính thức |
| Critical | Wastage | Một card hiển thị giá trị hao hụt âm | Nhầm wastage value với variance quantity | Wastage value luôn dương; variance tách riêng |
| High | AI panels | Có “trigger”, recommended ticket/email action | AI dễ bị hiểu là autonomous action | Chỉ show suggestion + source + confidence + approval |
| High | FOH QR | Wait range có vẻ chính xác nhưng thiếu freshness ở vài trạng thái | Guest hiểu là promise | Luôn show `as_of`, confidence, stale badge và limitation |
| High | Guest contact | Phone/SMS option dễ nổi bật hơn lựa chọn không contact | Dark pattern/PII thu thập quá sớm | Contact optional, explain purpose/retention trước opt-in |
| High | Staff console | Một số icon-only button nhỏ | Khó dùng trên tablet/keyboard | Min 44×44px, aria-label, visible focus |
| Medium | Console nav | Prototype có nhiều module roadmap trong một sidebar | Tăng cognitive load, scope mơ hồ | MVP nav tách BOH Core/FOH Lite; roadmap nhóm riêng |
| Medium | Data tables | Label code 11–13px dùng cho thông tin quan trọng | Khó đọc ở môi trường bếp/kho | Body/critical data ≥16px, monospace chỉ cho mã/số |
| Medium | HTML prototype | Nhiều link `href="#"`, CDN Tailwind, demo buttons | Không phản ánh navigation/state thật | Khi code hóa phải thay bằng route/action/testable state |

## 5. Screen-by-screen review

| Screen | Kết luận scope | Cần giữ | Cần bổ sung/chỉnh trước build |
|---|---|---|---|
| 01 Dashboard hao hụt | BOH MVP | Branch comparison, low-stock, discrepancy | `as_of`, freshness, source links; không giả POS/KDS live |
| 02 Goods Receipt | BOH MVP | Ordered/received/discrepancy | Partial receipt, accepted/damaged/rejected, idempotency/loading |
| 03 Daily Count/Wastage | BOH MVP | Formula, evidence, reason | `NOT_AVAILABLE` khi thiếu theory; tách variance và wastage value |
| 04 AI Recipe/BOM | BOH MVP có approval | Suggestion/confidence/warning | Không save trước approval; show source/unknown mapping |
| 05 Front-door QR | FOH Lite MVP | Language, party, time budget, wait range | Stale/queue full/network error; leave queue và contact privacy |
| 06 Table QR | FOH Lite MVP | Table trust, add-on, assistance, status | Bỏ payment/KDS implication; staff fallback và cancellation policy |
| 07 Host Console | FOH Lite MVP | Queue/request ownership | State guard, reason for override, overdue/failed task |
| 08 Floor Plan | Roadmap | Table readiness context | Không đưa vào MVP nav; cần cleaning/ready state contract |
| 09 KDS/BDS | Roadmap | FOH–BOH boundary visualization | Không claim live integration; cần POS/KDS contract trước build |
| 10 Split Bill | Roadmap | Future cashier context | Giữ ngoài MVP; payment/refund/security requirements chưa khóa |
| 11 Stock Transfer | BOH MVP/M2 | Transfer trace | `IN_TRANSIT` vs `RECEIVED`, branch acceptance, discrepancy |
| 12 Purchasing PO | BOH MVP | PO lifecycle | Approval/partial receipt decision, supplier discrepancy owner |
| 13 Central Warehouse | BOH MVP | Low-stock and location scope | Canonical unit, negative stock guard, ledger drill-down |
| 14 Master Data/BOM | BOH MVP | Ingredient/recipe editing | Version/effective time, no hard delete, conversion evidence |
| 15 Wastage Analytics | BOH MVP/M2 | Root-cause and evidence | Approved vs submitted, positive value semantics, missing theory |
| 16 QR Admin | Platform MVP | Token/policy control | Rotate/revoke/TTL/effective time, audit and branch scope |
| 17 POS Audit Log | Roadmap/integration | Quarantine/audit concept | Không hiển thị như live POS; replay/external event ID |
| 18 RBAC | Platform MVP | Role/membership model | Backend enforcement, before/after audit, session revoke |
| 19 Reservation | Roadmap | Future prep context | Không trộn với FOH Lite queue; reservation contract riêng |
| 20 Guest 360/CRM | Roadmap | Future guest context | Không thu PII trong MVP; consent/retention trước khi build |

## 6. FOH acceptance checklist

- [ ] Guest xem được availability mà không login/app/contact bắt buộc.
- [ ] Language, party size và time budget xuất hiện trước CTA join.
- [ ] Wait luôn là range + `as_of` + confidence/limitation.
- [ ] Queue join/leave, queue full, stale, expired và network error đều có next action.
- [ ] Table label/token được xác nhận trước submit.
- [ ] Add-on/assistance bắt đầu ở `SUBMITTED`; staff acknowledge trước route/prepare.
- [ ] Không có payment/billing promise trong FOH Lite.
- [ ] Có staff fallback nhìn thấy trên mọi màn hình.
- [ ] Request status dùng text/icon/aria-live, không dùng màu đơn độc.
- [ ] Browser test ở 320px, 375px, 768px và desktop; không horizontal scroll.

## 7. BOH acceptance checklist

- [ ] Mọi quantity có unit và conversion preview.
- [ ] Receipt draft không mutate stock; confirm atomic với ledger/audit.
- [ ] Transfer phân biệt warehouse, in-transit và branch received.
- [ ] Daily count thể hiện rõ theoretical unavailable, không silent zero.
- [ ] Wastage reason bắt buộc, value snapshot dương, evidence theo policy.
- [ ] Dashboard có freshness/as-of/scope và drill-down source record.
- [ ] Submitted/approved/locked phân biệt bằng text và permission.
- [ ] AI chỉ suggest, có confidence/source/limitation và approval gate.
- [ ] Table density vẫn đọc được ở tablet/bếp/kho, keyboard/focus hoạt động.
- [ ] Error có nguyên nhân và đường khôi phục, không chỉ toast mơ hồ.

## 8. Handoff rule

Mỗi màn hình khi chuyển thành code phải có:

1. Screen ID và MVP/roadmap status.
2. Actor/branch scope.
3. API/data contract và state machine.
4. Loading/empty/stale/error/retry state.
5. Accessibility and responsive test evidence.
6. Traceability tới BRD, PRD/FR, user story và feature spec.

Nếu prototype và docs khác nhau, giữ prototype là visual reference và sửa implementation theo business baseline; không âm thầm sửa rule trong HTML prototype.
