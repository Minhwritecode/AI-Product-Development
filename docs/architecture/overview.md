# Architecture Overview

## Context

```text
Guest Browser / Staff Browser (React/Vite)
        │ REST/JSON + JWT
        ▼
Nginx (optional reverse proxy)
        │
        ▼
Backend API (Node.js/TypeScript)
   ┌────┼──────────────┐
   ▼    ▼              ▼
PostgreSQL Redis     AI Adapter
   │    │              │
   └────┴──────┬───────┘
                ▼
        FOH Queue/Request Edge
                │
         External LLM (optional)
```

## Responsibilities

- Frontend: forms, table/dashboard, permission-aware UI, AI review flow.
- Guest frontend: no-login QR flows, privacy-safe status, multilingual copy, staff fallback.
- Backend: auth, RBAC, branch scope, validation, business rules, transactions, audit, AI orchestration.
- PostgreSQL: source of truth for operational data and audit.
- Redis: cache dashboard aggregates/rate limit/session support when enabled.
- AI adapter: provider abstraction, structured output validation, redaction, timeout/fallback.
- Nginx: reverse proxy in production-like deployment; optional in local dev.
- FOH Queue/Request Edge: validates signed QR/table token, rate-limits guest requests and exposes only session-scoped data.

## Module boundaries and ownership

Backend module structure is organized by business capability, not by screen:

```text
platform: auth/access, branch scope, config, audit, idempotency, shifts
foh: reservations, walk-in/queue, floor/tables, seating, service-sessions,
     menu/pricing, orders, kitchen-tickets, bar-tickets, serving, cleaning
finance: bills, discounts, payments, refunds, receipts, end-of-day reconciliation
boh: master-data, purchasing, receiving, inventory, stock-requests,
     daily-count, wastage, dashboard, corrections
cross-cutting: notifications, tasks, ai, integrations/quarantine, reporting
```

Each module owns its route schema, command/service, repository/query and tests.
Route handlers only parse input, authorize, call the service and map the API
response; they do not calculate stock, decide state transitions or call the LLM.
The frontend feature folder mirrors the business capability but never becomes
the source of truth for role, branch scope, quantity or state.

### Source-of-truth boundaries

| Data | Owner | Consumer rule |
|---|---|---|
| User, role, branch membership | PostgreSQL platform tables | Every protected request is re-authorized on the backend |
| Ingredient/unit/recipe/supplier/branch | PostgreSQL master-data tables | Transactions reference active records and canonical units |
| PO, receipt, stock request | PostgreSQL command records | Status changes use named commands and audit |
| Current stock | PostgreSQL projection + append-only ledger | Projection must reconcile to ledger; Redis is never authoritative |
| Reservation/queue/table/session/order/ticket | PostgreSQL operational records | Guest/staff reads are session, station and branch scoped |
| Bill/payment/refund/receipt | PostgreSQL financial records + provider reference | Commands/webhooks are idempotent; paid history is compensating-event only |
| Dashboard aggregates | Query/read model, optionally Redis cache | Every response has scope and `as_of`; drill-down uses source records |
| Notification/task | PostgreSQL operational side effects | Delivery failure does not change source business status |
| AI suggestion | Ephemeral/draft projection until approval | AI cannot call mutation endpoints or direct database |

### Required write path

```text
HTTP command
  → schema validation
  → authenticated actor + branch-scope check
  → domain state/idempotency check
  → PostgreSQL transaction
       command record + projection mutation + append-only ledger (if stock)
       + audit event
  → response with request_id/source status
  → asynchronous notification/task side effect
```

Any failure before commit returns an explicit error and leaves no partial stock
mutation. Notification/AI failure after commit is observable recovery work and
does not roll back the business record.

### FOH/BOH integration boundary

- `FOHRequest` is an operational signal until staff acknowledges/routes it; an
  accepted add-on becomes an order round through the same order contract.
- `Order`/`Ticket`/`Bill`/`Payment` are separate stateful domains linked by
  source IDs; closing one cannot silently rewrite another.
- `MenuItem`/`RecipeVersion`/`pos_item_code` link sales to theoretical usage;
  an unmapped external event goes to quarantine and cannot affect inventory.
- Kitchen, Bar and Cashier are production domains with least-privilege views;
  payroll/accounting remain outside the production core.
- The implementation order is defined in
  [Scope & Roadmap](../07-scope-and-roadmap.md); architecture work must follow
  those dependency boundaries.

## Security boundaries

1. Client không được quyết định authorization hoặc canonical quantity.
2. Backend re-check role/branch scope trên mỗi mutation/read sensitive.
3. AI chỉ nhận authorized projection, không nhận direct DB credentials.
4. Secrets chỉ từ environment/secret manager, không commit.
5. Guest QR token không chứa PII; queue/table session chỉ được đọc trong phạm vi token và policy.

## Deployment baseline

Docker Compose cho local: PostgreSQL + Redis + backend + frontend. Production
core requires managed PostgreSQL backup/restore, TLS/reverse proxy, secret
management, background job runner, structured logs/metrics and documented
rollback. Multi-region replication, HA/DR và CDN nâng cao là enterprise roadmap.

## Failure handling

- DB down: mutation fail closed, UI báo retry; không giả vờ thành công.
- Redis down: dashboard fallback query DB nếu an toàn.
- LLM timeout: giữ draft/input, cho phép retry/manual entry.
- Duplicate command/payment/webhook: idempotency key/reference trả result cũ.
- Partial error: transaction rollback toàn bộ receipt/shipment/order/bill command.
- Payment provider timeout: giữ `PENDING`, tạo reconciliation task, không báo `PAID`.
- Ticket printer/notification/AI failure: source order/request vẫn tồn tại, task
  retry/fallback độc lập.

## Observability baseline

- `/health` kiểm tra process.
- `/ready` kiểm tra dependency cần thiết.
- JSON log có `request_id`, `actor_id`, `action`, `entity_id`, `duration_ms`.
- Metrics production: reservation conversion/no-show, queue wait/abandonment,
  table turnover/cleaning, order-to-station delay, ticket lateness, serve time,
  payment failure/refund, receipt/stock discrepancy, wastage variance, AI latency.
