# Luminex — Project Agent Instructions

## 1. Phạm vi sản phẩm

Luminex là hệ thống quản trị vận hành nhà hàng nối FOH (Front of House) và BOH
(Back of House), ưu tiên nhà hàng đông khách du lịch ở khu trung tâm/phố đi bộ.
Mọi thay đổi phải giải quyết pain point vận hành cụ thể, có actor, branch scope,
state transition và tiêu chí kiểm chứng.

Production core hiện tại gồm:

- Nền tảng: restaurant/branch setup, auth/RBAC, branch scope, staff, shift,
  operational task và audit.
- FOH: reservation, walk-in/waitlist, front-door QR, floor/table/readiness,
  seating, service session, menu/pricing, order, kitchen/bar ticket, serving,
  add-on, cleaning và hospitality status.
- Finance vận hành: bill, tax/service charge, discount theo quyền, split bill,
  payment, refund, receipt và end-of-day reconciliation.
- BOH: master data, purchasing, goods receipt, warehouse/branch stock, stock
  request/transfer, daily count, wastage, dashboard và reconciliation.
- Liên kết FOH → BOH: menu/recipe version, station routing, theoretical usage,
  availability signal, integration quarantine và traceability.
- AI hỗ trợ suggestion/read-only; human approval bắt buộc trước mọi mutation.

Ngoài production core là payroll/HR compliance, GL/accounting consolidation,
supplier portal, autonomous AI/forecasting, dự đoán chính xác thời điểm khách
rời bàn, multi-region HA/DR, enterprise SSO/SCIM và fraud platform. Không coi
những ranh giới này là lý do để bỏ qua các capability vận hành nhà hàng đã nêu.

## 2. Nguồn sự thật

Trước khi phân tích hoặc sửa code, đọc tài liệu liên quan trong `docs/` theo thứ tự:

1. `docs/02-prd.md` — production scope, requirement ID và release acceptance gates.
2. `docs/03-requirements-analysis.md` — actor, dependency, business rule và failure path.
3. `docs/04-user-stories-acceptance.md` — user behavior và acceptance criteria.
4. `docs/05-feature-specifications.md` — API, state machine, data và UI state.
5. `docs/06-foh-boh-pain-points.md` — pain point và role/capability boundary.
6. `docs/07-scope-and-roadmap.md` — dependency order và production implementation plan.
7. `docs/architecture/` — system, data model và API contract.

Các file `docs/source/` là nguồn đầu vào đã lưu, không tự nâng nội dung source
thành requirement nếu chưa được chuẩn hóa ở PRD/spec. `docs/uiux/stitch/` là
HTML/ảnh/design reference, không phải runtime frontend và không định nghĩa rule.
`docs/` chỉ chứa nội dung Luminex; không thêm lịch sử thao tác Codex, Git,
Stitch, skill hoặc prompt vào tài liệu sản phẩm.

## 3. Kiến trúc bắt buộc

### Runtime boundaries

```text
Guest/Staff Browser (React/Vite)
        │ REST/JSON + session/JWT
        ▼
Backend API (Fastify/TypeScript)
  ├── PostgreSQL: source of truth, commands, projections, audit/ledger
  ├── Redis: cache/rate-limit/session support only, never business source
  ├── AI adapter: authorized projection → structured suggestion/read-only answer
  └── Integration/quarantine: future POS/import events, no unvalidated mutation
```

- `frontend/`: route, feature UI, API client và presentation state; không quyết
  định authorization, branch scope, canonical quantity hoặc business transition.
- `backend/`: auth/access, restaurant/branch setup, staff/shifts/tasks,
  reservations, walk-in/queue, floor/tables/seating/cleaning, menu/pricing,
  sessions/orders, kitchen/bar tickets, serving, billing/payments/refunds,
  end-of-day, master-data, purchasing, receiving, inventory, stock-requests,
  daily-count, wastage, dashboard, notifications, audit, corrections, AI và
  integrations.
- Mỗi backend module tách route/schema, service/domain, repository/query và test.
  Route chỉ parse/authorize/gọi service/map response; không chứa business rule.
- `ai-service/`: adapter/provider boundary; không nhận DB credential và không
  được gọi mutation endpoint.
- `db/`: migration, seed và test fixture; migration phải chạy được từ DB rỗng.
- `nginx/`: reverse proxy tùy chọn; không đưa logic nghiệp vụ vào proxy.

### Data ownership

- PostgreSQL là source of truth cho User, Role, Restaurant, Branch, Area, Table,
  Staff, Shift, Reservation, QueueEntry, master data, Menu, Recipe, PO, receipt,
  request, stock, ledger, count, wastage, ServiceSession, Order, Ticket, Bill,
  Payment, Refund, Receipt, task, notification và audit.
- Current stock là projection phải reconcile được với append-only inventory ledger.
- Posted ledger/operational record không hard-delete và không sửa trực tiếp;
  correction dùng compensating event liên kết record gốc.
- Redis chỉ cache aggregate, rate-limit hoặc session support khi fallback an toàn.
- AI chỉ đọc authorized projection; output là draft/suggestion cho tới khi user
  review/approve.
- POS/import event chưa map, sai schema hoặc retry bất thường phải vào quarantine,
  không tự trừ stock hoặc thay đổi theoretical usage.

### Required write path

```text
HTTP command
 → schema validation
 → authenticated actor + branch-scope check
 → state/idempotency check
 → PostgreSQL transaction
    command record + projection mutation + ledger (nếu stock) + audit event
 → response có request_id/source status
 → notification/task side effect bất đồng bộ
```

Mutation thất bại trước commit phải fail rõ và rollback toàn bộ. Notification
hoặc AI failure sau commit là side effect cần retry/observability, không rollback
business record.

### API contract

- Base path `/api/v1`; response dùng `{ data, meta: { requestId }, error }`.
- State change dùng named command (`/send`, `/confirm`, `/approve`, `/ship`,
  `/acknowledge`), không cho client PATCH status tùy ý.
- Dùng `401` unauthenticated, `403` out of permission, `404` not found/in-scope,
  `409` state/idempotency conflict, `422` validation.
- Quantity luôn đi cùng unit và normalize về canonical stock unit; tiền dùng
  decimal/VND policy, không dùng binary float; API timestamp là UTC.
- `Idempotency-Key` bắt buộc cho reservation/waitlist commands, queue join,
  FOH request, order send, goods receipt, shipment, payment/webhook, refund,
  correction và import command có side effect.

## 4. Quy tắc nghiệp vụ FOH

- Front-door QR hiển thị `OPEN/PAUSED/FULL/CLOSED`, availability, estimated wait
  dạng range, `as_of`, confidence/limitation và recovery action. Không hứa giờ
  khách cụ thể rời bàn.
- Guest chọn Vietnamese/English, party size và time budget; không cần app/login/
  contact trước khi xem hoặc join. Contact chỉ yêu cầu khi opt-in notification.
- Join/leave queue là hành động rõ ràng, không dark pattern; retry cùng key không
  tạo entry thứ hai; không có contact vẫn phải có queue code/staff fallback.
- Host chỉ call/seat/cancel/expire theo state machine, branch scope và policy;
  manual override bắt buộc reason, actor, timestamp và audit.
- Reservation, walk-in, queue, table readiness và seating phải liên kết được với
  đúng branch/table/session; không seat hai active session vào cùng một table.
- Server chỉ gửi order sau khi xác nhận session/table, modifier và station route;
  void/discount/transfer/merge phải theo quyền và tạo audit.
- Kitchen/Bar nhận ticket theo station, không tự đổi order hoặc bill; mọi delay,
  reject, shortage và hand-off phải có actor, reason và timestamp.
- Cashier chỉ ghi nhận payment/refund qua billing domain; webhook/retry không được
  tạo payment hoặc refund trùng, bill đã paid không bị sửa trực tiếp.
- Table QR dùng signed token không PII, có expiry/rotation/revocation; token lỗi
  trả response generic, không lộ table/session khác. Guest xác nhận đúng bàn trước submit.
- `FOHRequest` bắt đầu `SUBMITTED`, sau đó staff acknowledge/route/reject/complete.
  Add-on/ordering request chỉ trở thành order round sau khi staff acknowledge và
  backend xác nhận session/table/menu; request thô không close bill, không payment
  và không mutate stock.
- Mọi QR state có staff fallback, loading/empty/stale/error/retry, privacy-safe
  status và accessibility. QR bổ trợ hospitality, không thay thế nhân viên.

## 5. Quy tắc nghiệp vụ BOH

- Master data là nguồn chuẩn cho ingredient, unit, conversion, supplier, branch,
  menu và recipe. Conversion phải > 0; record đã tham chiếu không hard-delete.
- Draft PO/receipt không mutate stock. Goods receipt confirm phải atomic giữa
  receipt, warehouse stock, ledger và audit; retry không double-add.
- Stock request phải `Requested → Approved/Rejected → Shipped → Closed`; shipment
  không vượt available stock, không tạo stock âm ở MVP, approval không đồng nghĩa received.
- Hàng `IN_TRANSIT`, `RECEIVED`, `DAMAGED`, `REJECTED`, `BACKORDERED` phải tách rõ
  khi feature đã hỗ trợ; không coi dữ liệu thiếu là zero.
- Daily count lưu opening, received, theoretical sold nếu có, closing actual và
  variance. Thiếu theoretical sold phải là `NOT_AVAILABLE/INCOMPLETE_THEORY`.
- Wastage bắt buộc quantity > 0, reason, standard price snapshot, value, branch,
  actor và timestamp; không dùng số âm để thay cho variance.
- Correction/adjustment/reversal tạo compensating ledger event và reconciliation;
  không sửa/xóa event gốc.
- Dashboard có branch scope, timezone, `as_of`, freshness và drill-down source record.
- FOH order/sales chỉ tạo theoretical usage khi mapping menu → recipe/version hợp lệ;
  thiếu mapping phải hiển thị exception, không tự trừ tồn.

## 6. Vai trò và quyền

- Admin: config branch/warehouse/table/queue, user/role/membership, token và audit.
- Owner/Operations: cross-branch dashboard, drill-down, exception/correction approval
  theo policy; không sửa trực tiếp ledger.
- Purchasing Manager: supplier và PO; không tự xác nhận receipt/stock.
- Warehouse Admin: master data, goods receipt, warehouse stock, approve/reject/ship.
- Branch Manager: branch stock, stock request, daily count, wastage và variance.
- Host/FOH Lead: queue và FOH request acknowledgement/routing trong branch scope.
- Server: mở session, tạo/gửi order, theo dõi ticket, serve, add-on, request
  payment và transfer/merge theo branch policy; không sửa paid bill ngoài quyền.
- Guest: chỉ session/queue/table token hiện tại; không thấy PII hay session bàn khác.
- Kitchen/Bar: xử lý station ticket theo food/beverage station; Cashier: bill,
  discount, split, payment, refund, receipt và end-of-day theo quyền.
- AI không phải role; AI thừa hưởng quyền user nhưng không vượt quyền và không mutate.

## 7. UI/UX và accessibility

- Guest mobile-first; staff console tablet/desktop-first; body text ≥16px,
  touch target ≥44×44px, test ở 320px.
- Một primary CTA mỗi trạng thái; visible labels, helper text, inline validation,
  keyboard/focus visible, readable contrast, reduced motion và `aria-live` phù hợp.
- Có loading, empty, stale, error, timeout, retry, success và permission state.
- Status luôn có text/icon, không dùng màu làm tín hiệu duy nhất. Không thêm card,
  metric, gradient hoặc animation không phục vụ task.
- Vietnamese/English là baseline guest; progressive disclosure cho option nâng cao.
- UI chỉ phản ánh rule từ PRD/spec; không tự tạo policy mới từ prototype Stitch.

## 8. Cách làm việc

- Đọc `git status` và diff trước khi sửa; giữ thay đổi sẵn có của người dùng,
  chỉ stage file thuộc task hiện tại.
- Gắn thay đổi với requirement/user-story/feature ID. Khi docs mâu thuẫn, ghi
  assumption/open decision; không tự bịa policy.
- Dùng [Scope & Roadmap](docs/07-scope-and-roadmap.md) để chọn slice tiếp theo.
  Không xây feature phụ thuộc trước command, state, permission, fixture và API contract.
- Một write agent sở hữu một vùng file/feature. Read-only exploration/review có
  thể song song; write-heavy agents không sửa cùng file.
- Subagent phải trả về scope đã đọc, file đã đổi, behavior, test, residual risk
  và cần người duyệt.
- Không commit/merge/push/PR nếu chưa được yêu cầu rõ trong task. Không dùng
  `git reset --hard`, `git checkout --` hoặc xóa diện rộng.

## 9. Code review rules

- Block nếu write path thiếu validation, authorization, branch scope, transaction,
  idempotency, rollback, audit hoặc tạo duplicate/negative stock.
- Block nếu guest gửi nhầm bàn, queue không leave được, QR thiếu fallback hoặc
  wait range bị trình bày thành cam kết exact.
- Block nếu table/session bị double-seat, order/ticket bị gửi sai station, bill
  đã paid bị sửa, payment/refund bị duplicate hoặc end-of-day không reconcile được.
- Block nếu AI có thể ghi/approve recipe, PO, stock, wastage, queue hoặc payment.
- Block nếu acceptance criteria chính không có test hoặc không thể replay bằng fixture.
- Với UI, kiểm tra state matrix, responsive, keyboard/focus, accessibility và
  outcome của từng control; chỉ báo finding có file/line hoặc flow evidence.
- Không tuyên bố full compliance từ static review; nêu rõ phần cần browser/runtime check.

## 10. Kiểm tra trước khi bàn giao

Chọn lệnh phù hợp với thay đổi, tối thiểu:

```bash
npm run lint
npm run typecheck
npm test
git diff --check
```

Thay đổi build/runtime chạy thêm `npm run build`. Với DB chạy migration từ
database rỗng, seed fixture và integration transaction tests. Với UI story,
kiểm tra browser ở guest mobile và staff tablet/desktop, bao gồm error/stale/
fallback state.

## 11. Codex configuration

- `AGENTS.md` root áp dụng toàn repo. Nested `AGENTS.override.md`/`AGENTS.md`
  chỉ thêm scope-specific rule; giữ instruction chain ngắn và dưới giới hạn mặc định.
- Custom project subagents nằm trong `.codex/agents/`; mỗi TOML cần `name`,
  `description`, `developer_instructions`. Model/reasoning/sandbox là default,
  có thể bị explicit spawn hoặc parent runtime override.
- Toàn bộ agent collection upstream có trong `.codex/agents/`; chỉ spawn agent
  phù hợp và chia việc độc lập vì mỗi subagent tăng token/time cost.
- Fast mode (`/fast on|off|status`) là runtime setting của người dùng; không tự
  bật hoặc thay đổi config cá nhân từ task repo.
- Command approval là lớp riêng trong `.rules`, không đưa approval policy vào
  `AGENTS.md`. Project-local rules chỉ load khi `.codex/` được trust; nếu tạo
  rules phải dùng `prefix_rule`, test bằng `codex execpolicy check` và ưu tiên
  `prompt`/`forbidden` cho thao tác nguy cơ cao.
