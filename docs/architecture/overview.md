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

## Security boundaries

1. Client không được quyết định authorization hoặc canonical quantity.
2. Backend re-check role/branch scope trên mỗi mutation/read sensitive.
3. AI chỉ nhận authorized projection, không nhận direct DB credentials.
4. Secrets chỉ từ environment/secret manager, không commit.
5. Guest QR token không chứa PII; queue/table session chỉ được đọc trong phạm vi token và policy.

## Deployment baseline

Docker Compose cho local: PostgreSQL + Redis + backend + frontend. Production chưa chốt; database replication, HA, CDN, DR là roadmap.

## Failure handling

- DB down: mutation fail closed, UI báo retry; không giả vờ thành công.
- Redis down: dashboard fallback query DB nếu an toàn.
- LLM timeout: giữ draft/input, cho phép retry/manual entry.
- Duplicate request: idempotency key cho stock mutation/import.
- Partial error: transaction rollback toàn bộ receipt/shipment.

## Observability baseline

- `/health` kiểm tra process.
- `/ready` kiểm tra dependency cần thiết.
- JSON log có `request_id`, `actor_id`, `action`, `entity_id`, `duration_ms`.
- Metrics tương lai: receipt success, stock mutation failure, AI latency, dashboard latency.
