# Unified Product Vision — Luminex FOH → BOH

## Vision statement

Luminex là hệ thống quản trị vận hành nhà hàng thông minh, kết nối trải nghiệm khách ở FOH với dữ liệu vận hành và kiểm soát nguyên vật liệu ở BOH.

Luminex giúp:

- Khách biết trước khả năng được phục vụ khi nhà hàng đông.
- Khách đang ngồi có thể gọi thêm nhanh và lịch sự mà không phải tìm nhân viên.
- FOH giảm áp lực các yêu cầu lặp lại nhưng vẫn giữ hospitality và quyền kiểm soát của nhân viên.
- BOH biết đã mua gì, nhận gì, chuyển gì, còn gì và hao hụt ở đâu.
- Owner/Manager nhìn thấy mối liên hệ giữa traffic, order, stock, wastage và chất lượng phục vụ.

## Product rooms

```text
FOH Lite — Guest Access & Table Service
  Front-door QR: bàn/chờ/queue transparency
  Table QR: menu + add-on order + assistance

Operations control plane
  Branch/warehouse/table config + operating state
  Queue policy + access scope + notification/task lifecycle

BOH Core — Inventory & Wastage Control
  Master Data → PO → Goods Receipt → Stock
  → Branch Request → Daily Count → Wastage → Dashboard + AI

Integration layer
  FOH/POS sales → MenuItem + Recipe version → theoretical usage
```

## MVP boundary

### Included

1. BOH inventory & wastage workflow from the original idea/vision.
2. FOH front-door QR for live availability, estimated wait, queue join and multilingual guidance.
3. FOH table QR for add-on ordering, request assistance and order status.
4. Staff console for accepting/confirming QR requests and routing them to the appropriate station/work queue.
5. Role-based data, audit, human approval for AI and clear service-status feedback.
6. Minimal operations control plane for branch/table/queue configuration, token lifecycle and notification fallback.

### Not included in this MVP

- Full online reservation engine.
- Full table map/seat assignment engine.
- Customer billing, payment, refund or receipt.
- Full kitchen/bar display system.
- Autonomous table turnover prediction presented as fact.
- AI deciding wait times, stock movements or order approvals without rule/data validation.

## North-star experience

```text
Guest scans before entering
  → chooses language and party size
  → sees “bàn hiện có / thời gian chờ ước tính / queue status”
  → joins queue only if the wait fits their time budget
  → gets a clear status and can leave without penalty
  → scans table QR after seating
  → browses menu and submits add-on request
  → sees “đã nhận / đang chuẩn bị / đã phục vụ”

FOH request becomes operational signal
  → staff confirms/routs it
  → BOH stock and wastage remain traceable
```

## Behavioral principles

- Reduce uncertainty before asking for commitment.
- Show time as a range with a last-updated timestamp, not false precision.
- Give the guest control: join, leave, change party details, ask for help.
- Prefer no-login, low-friction entry for tourists.
- Use progressive disclosure: language/party size first, phone only when notification is requested.
- Never use dark patterns such as hiding queue status, forcing app download or making “leave queue” hard to find.
- Preserve hospitality: QR complements staff; it must never feel like the guest is being abandoned.
- Show system confidence/limitations when availability or wait data is incomplete.

## Business value chain

```text
Better FOH transparency
  → fewer abandoned/uncertain arrivals
  → smoother seating and add-on requests
  → better demand signal
  → better purchasing and branch replenishment
  → fewer stockouts and unexplained wastage
  → better guest experience and ingredient cost control
```

## Success signals

### FOH

- Guests can understand availability and estimated wait in under 30 seconds.
- Queue abandonment is measurable and not caused by hidden information.
- Add-on requests have a visible accepted/in-progress/completed status.
- Staff spend less time answering “còn bàn không?” and “khi nào có thể gọi thêm?”.
- QR requests never bypass staff authorization or create an untracked order.
- Operating-state overrides, token revocations and notification failures are visible and auditable.

### BOH

- Current stock, receipt discrepancy and wastage value are traceable.
- Demand spikes from busy locations are visible without silently changing stock.
- Wastage includes quantity, reason and value.
- AI suggestions require human approval.
- Stock corrections and future integrations preserve immutable history and expose unresolved discrepancies.

### Product guardrail

The MVP should be evaluated as one FOH → BOH loop, but each module must remain useful when the other side is temporarily unavailable. If POS/sales data is missing, Luminex must label theoretical usage as incomplete rather than inventing it.
