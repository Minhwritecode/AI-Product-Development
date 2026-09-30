# Luminex — Project Agent Instructions

## 1. Phạm vi dự án

Luminex là hệ thống quản trị vận hành nhà hàng nối FOH (Front of House) và BOH
(Back of House). Mọi thay đổi phải phục vụ vận hành nhà hàng thực tế, đặc biệt
là nhà hàng ở khu trung tâm đông khách du lịch, có lưu lượng cao và nhiều ca
phục vụ đồng thời.

MVP hiện tại gồm:

- BOH Core: master data, purchasing, goods receipt, tồn kho theo chi nhánh,
  daily count, wastage, dashboard và audit.
- FOH Lite QR: front-door QR để xem tình trạng bàn/ước lượng chờ và table QR
  để gọi thêm món hoặc yêu cầu hỗ trợ.
- AI chỉ là lớp hỗ trợ phân tích/gợi ý; mọi thay đổi nghiệp vụ cần con người
  xem xét và phê duyệt.

Không tự mở rộng MVP thành hệ thống đặt bàn đầy đủ, thanh toán, billing,
KDS/BDS hoặc dự báo thời điểm rời bàn nếu PRD chưa thay đổi rõ ràng.

## 2. Nguồn sự thật và phạm vi tài liệu

Trước khi phân tích hoặc sửa code, đọc các tài liệu liên quan trong `docs/`.
Ưu tiên theo thứ tự:

1. `docs/02-prd.md` — phạm vi, requirement ID và acceptance criteria.
2. `docs/03-requirements-analysis.md` — quy tắc, ràng buộc và edge case.
3. `docs/04-user-stories-acceptance.md` — hành vi người dùng và tiêu chí nghiệm thu.
4. `docs/05-feature-specifications.md` — đặc tả theo feature.
5. `docs/09-unified-product-vision.md` và tài liệu FOH/BOH liên quan.

`docs/` chỉ chứa nội dung sản phẩm Luminex: discovery, PRD, requirements,
user stories, feature specs, architecture, research và design reference. Không
đưa hướng dẫn thao tác Codex, Git, Stitch, skill hoặc lịch sử làm việc vào đó.

`docs/uiux/stitch/` là thiết kế tham chiếu dựng sẵn, gồm HTML và ảnh; không
được coi là runtime frontend và không thay thế requirement trong PRD.

### Cơ chế áp dụng hướng dẫn

- `AGENTS.md` ở root áp dụng cho toàn repo. Nếu một khu vực cần ngoại lệ,
  dùng `AGENTS.override.md` hoặc một `AGENTS.md` gần thư mục đó; không chép
  lại toàn bộ file root.
- Giữ file hướng dẫn ngắn, rõ và dưới giới hạn mặc định 32 KiB của Codex.
  Quy tắc quan trọng phải được viết thành hành vi cần làm, điều kiện ngoại lệ
  và cách kiểm tra.
- Khi sửa hướng dẫn, chạy Codex ở phiên mới để nạp lại instruction chain;
  không giả định session đang mở đã thấy thay đổi.

## 3. Quy tắc nghiệp vụ FOH

- Front-door QR phải cho khách xem trạng thái vận hành, estimated wait dạng
  range kèm `as_of` và confidence; không hứa thời điểm chính xác khách khác
  sẽ rời bàn.
- Khách phải xem được availability mà không cần tải app, đăng nhập hoặc cung
  cấp contact nếu không cần notification.
- Flow phải hỗ trợ language, party size, time budget và trạng thái mở/đóng,
  đầy chỗ hoặc tạm ngưng nhận queue rõ ràng.
- Join/leave queue là hành động có chủ đích, không dark pattern; retry không
  được tạo queue entry trùng. Không có contact thì phải có cách gọi khách thay
  thế được cấu hình bởi nhà hàng.
- Table QR phải xác nhận đúng branch/table trước khi gửi yêu cầu. QR token có
  chữ ký, không chứa PII và có thể rotate/revoke.
- Add-on request và assistance request phải có trạng thái từ gửi đến hoàn tất,
  hiển thị acknowledgement của staff. QR request chưa được staff acknowledge
  không được xem là order chính thức.
- Mọi flow QR phải có fallback cho nhân viên, loading/empty/stale/error/retry,
  accessibility và trạng thái khi dịch vụ tạm thời không khả dụng.
- Không xử lý payment, refund hoặc billing trong QR MVP.

## 4. Quy tắc nghiệp vụ BOH

- Master data là nguồn chuẩn cho item, unit, recipe, supplier, branch và
  conversion. Không suy diễn đơn vị hoặc âm thầm đổi đơn vị.
- Goods receipt ở trạng thái draft không làm thay đổi tồn kho. Chỉ thao tác
  confirm hợp lệ mới tạo stock transaction, inventory ledger và audit event
  trong cùng một transaction.
- Receipt, shipment, stock request và các mutation có side effect phải có
  idempotency key; retry không được nhân đôi tồn kho hoặc giao dịch.
- Inventory ledger là append-only. Điều chỉnh phải tạo correction/reconciliation
  event có lý do, người thực hiện, timestamp và liên kết bản ghi gốc; không
  hard-delete operational records.
- Phân biệt tồn kho theo warehouse/branch, hàng đang in-transit và hàng đã
  nhận. Không tự động coi dữ liệu thiếu là zero.
- Daily count phải lưu counted quantity, unit, thời điểm, người đếm và variance
  so với số hệ thống; nếu `sold_qty_theory` chưa có thì phải hiển thị là chưa
  xác định, không dựng số giả.
- Wastage cần quantity, unit, reason, value snapshot, branch, người ghi và
  timestamp. Không cho ghi wastage thiếu reason hoặc tự sửa lịch sử mà không
  có correction.
- Dashboard phải drill-down được từ variance/wastage về receipt, stock
  transaction, count hoặc correction tương ứng.

## 5. AI, dữ liệu và quyền hạn

- AI chỉ nhận projection dữ liệu đã được authorize; không truy cập database
  trực tiếp và không được tự ghi recipe, PO, stock, wastage, queue hay request.
- Mọi AI suggestion phải có nguồn dữ liệu, confidence/uncertainty phù hợp,
  trạng thái pending approval và audit người duyệt/chỉnh sửa/từ chối.
- Backend là nơi quyết định authentication, authorization và branch scope;
  không tin role hoặc branch ID do frontend gửi lên.
- Không đưa PII, secret, QR token thô hoặc dữ liệu nhạy cảm vào log, prompt,
  URL, screenshot hoặc dữ liệu test nếu không cần.
- Timestamp lưu UTC; UI hiển thị theo timezone được cấu hình của branch.

## 6. Quy tắc UI/UX

- Mobile-first cho khách; body text tối thiểu 16px và touch target tối thiểu
  44×44px.
- Mỗi trạng thái có một primary CTA rõ ràng, label nhìn thấy được, helper
  text và inline validation; không dùng màu làm tín hiệu duy nhất.
- Phải thiết kế loading, empty, stale, error, retry, success và permission
  state cho flow quan trọng.
- Status động của queue/request dùng `aria-live` phù hợp; hỗ trợ keyboard,
  focus visible, reduced motion và tương phản đủ.
- Ưu tiên Vietnamese/English, progressive disclosure và copy dễ hiểu cho
  khách du lịch; không dùng thuật ngữ vận hành nội bộ trên guest UI.
- Mọi control nhìn thấy phải có outcome thật hoặc disabled state có lý do.
  Không thêm card, metric, gradient hoặc animation chỉ để trang trông đầy hơn.
- Khi triển khai từ Stitch, lấy cấu trúc và trạng thái hữu ích làm tham chiếu;
  không copy mù quáng layout nếu mâu thuẫn với pain point, accessibility hoặc
  requirement hiện hành.

## 7. Quy tắc kỹ thuật

- Giữ boundary rõ giữa frontend, backend, AI service và database.
- Các write path cần kiểm tra validation, authorization, transaction boundary,
  idempotency, rollback, audit và error/recovery path.
- API/state transition phải dùng enum/trạng thái rõ ràng; không dùng string
  rời rạc làm mất khả năng trace.
- Không đặt business rule quan trọng trong component UI hoặc chỉ ở frontend.
- Ưu tiên thay đổi nhỏ, dễ review; không refactor lan rộng khi task không yêu cầu.
- Khi thêm migration hoặc schema, nêu rõ dữ liệu cũ, rollback, lock và tác động
  đến branch scope.

## 8. Cách làm việc và giao việc

- Đọc diff và trạng thái worktree trước khi sửa. Giữ nguyên thay đổi có sẵn của
  người dùng; chỉ stage file thuộc task hiện tại.
- Gắn thay đổi với requirement/user-story ID khi có thể. Nếu phát hiện mâu
  thuẫn giữa docs, ghi rõ giả định và câu hỏi mở thay vì tự bịa policy.
- Agent viết code chỉ sở hữu một vùng file/feature tại một thời điểm. Có thể
  chạy nhiều agent read-only song song; tránh hai agent cùng sửa một file.
- Subagent phải trả về: phạm vi đã đọc, file đã đổi, hành vi, kiểm thử đã chạy,
  rủi ro còn lại và việc cần người duyệt.
- Không commit, merge, push hoặc tạo PR nếu người dùng chưa yêu cầu rõ trong
  task hiện tại. Không dùng `git reset --hard`, `git checkout --` hoặc lệnh
  xóa diện rộng.
- Branch nên phản ánh một nhóm thay đổi có thể review độc lập: `docs/`, `fe/`,
  `be/`, `test/`, `infra/`; chỉ merge vào `main` sau khi đã review và kiểm tra.

## 9. Code review rules

Review phải ưu tiên rủi ro hành vi và nghiệp vụ, không biến thành nhận xét
formatting thuần túy:

- Block nếu write path có thể tạo duplicate, bỏ qua branch authorization,
  thiếu transaction/rollback, thiếu audit hoặc làm ledger sai.
- Block nếu guest có thể gửi request nhầm bàn, bị kẹt không có fallback, hoặc
  UI trình bày estimated wait như một cam kết chính xác.
- Block nếu AI suggestion có thể ghi dữ liệu vận hành mà không có approval,
  hoặc prompt/tool dùng dữ liệu ngoài authorized projection.
- Block nếu acceptance criteria quan trọng không có test hoặc không thể kiểm
  chứng bằng một flow thực tế.
- Với UI, kiểm tra loading/empty/error/success/permission, keyboard/focus,
  mobile layout và outcome của từng control; phân biệt lỗi cụ thể với sở thích.
- Mỗi finding phải có file/line hoặc đường đi hành vi, mức độ, tác động và
  safe path/fix tối thiểu. Không báo “full compliance” chỉ từ static review.

## 10. Kiểm tra trước khi bàn giao

Chọn lệnh phù hợp với thay đổi, tối thiểu:

```bash
npm run lint
npm run typecheck
npm test
git diff --check
```

Với thay đổi build/runtime, chạy thêm:

```bash
npm run build
```

Review thủ công phải kiểm tra: FOH fallback và trạng thái lỗi; BOH transaction,
idempotency, ledger và audit; branch authorization; accessibility; không đưa
roadmap vào MVP; và traceability từ PRD đến implementation/test.

## 11. Codex runtime, subagent và rules

- Toàn bộ agent TOML upstream được lưu project-scoped trong `.codex/agents/`.
  Chỉ chọn agent có phạm vi hẹp phù hợp task; không spawn hàng loạt nếu công
  việc không độc lập vì mỗi agent tiêu tốn thêm token và thời gian.
- Dùng subagent song song cho exploration, test, triage và review read-only.
  Với write-heavy work, chia ownership theo vùng file/feature, chờ kết quả,
  rồi main agent tổng hợp trước khi merge.
- Mỗi custom agent phải có `name`, `description` và
  `developer_instructions`; `name` trong TOML là source of truth. Model,
  reasoning effort và sandbox chỉ là default của agent, có thể bị explicit
  spawn hoặc runtime của parent override.
- Fast mode là thiết lập runtime cá nhân của Codex (`/fast on|off|status`),
  có thể tăng tốc nhưng dùng hạn mức/chi phí cao hơn; không tự bật hoặc ghi
  đè config cá nhân từ task của repo.
- Quy tắc phê duyệt lệnh của Codex là lớp cấu hình riêng trong các file
  `.rules`; không nhúng approval policy vào tài liệu sản phẩm hoặc dùng
  `AGENTS.md` để tự cấp quyền cho lệnh nguy hiểm. Project-local rules chỉ
  hoạt động khi lớp `.codex/` của project được trust.
- Nếu tạo `.rules`, dùng `prefix_rule` với `pattern`, `decision`,
  `justification`, `match` và `not_match` phù hợp; kiểm tra bằng
  `codex execpolicy check` và ưu tiên `prompt`/`forbidden` cho thao tác nguy cơ
  cao. Hiện repo không tự thêm approval rules để tránh đổi quyền ngoài ý muốn.
- `AGENTS.md` này là hướng dẫn cộng tác và nghiệp vụ của repo; không thay thế
  PRD, acceptance criteria hoặc quyền hạn được enforce ở backend.
