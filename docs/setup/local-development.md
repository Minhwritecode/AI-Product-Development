# Development Setup

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop / Docker Engine với Compose v2
- Git

Kiểm tra:

```bash
node --version
npm --version
docker --version
docker compose version
```

## First setup

```bash
cp .env.example .env
npm install
make cloud-config-check
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
npm run dev
```

Frontend: `http://localhost:3000`
Backend health: `http://localhost:5000/health`

## Development order

Implementation follows the dependency plan in [Scope & Roadmap](../07-scope-and-roadmap.md):

1. Platform foundation: API contract, config, migration runner, auth boundary and fixtures.
2. Restaurant operations foundation: restaurant/branch/table setup, RBAC, staff, shifts and tasks.
3. BOH source of truth: master data, menu/recipe, PO, goods receipt, warehouse ledger/stock.
4. Branch control: stock request, shipment, branch stock, daily count, wastage, dashboard and reconciliation.
5. FOH demand flow: reservation, walk-in/queue, floor/table readiness, seating and cleaning.
6. Service execution: menu, service session, order rounds, kitchen/bar tickets, serving and QR add-on.
7. Finance operations: bill, tax/service charge, discount, split, payment, refund, receipt and end-of-day.
8. Production controls: reporting, POS/import quarantine, authorized AI projection, audit, observability and release hardening.

Do not start a dependent screen before its backend command, state transition,
permission scope, error contract and test fixture exist.

## Environment policy

- `.env` chỉ chứa connection string tới cloud development/staging; không commit.
- Không chạy PostgreSQL local và không dùng database local làm source of truth.
- `DATABASE_URL` phải là managed PostgreSQL; `DATABASE_SSL=true` là mặc định.
- `REDIS_URL` ưu tiên managed Redis; Redis chỉ là cache/rate-limit/session support.
- `LLM_PROVIDER=mock` dùng để phát triển không gọi provider thật.
- API key thật chỉ được nạp từ secret manager/CI secret.

## Docker

Docker Compose chỉ chạy backend/frontend; backend kết nối cloud PostgreSQL/Redis
đã cấu hình trong `.env`. Backend tự chạy migration idempotent trước khi start;
seed chỉ chạy khi `LUMINEX_SEED_ON_START=true` và không được bật ở production:

```bash
make app-up
# hoặc: docker compose up -d --build
make logs
make app-down
```

## Database workflow

Migration chạy theo thứ tự từ database cloud rỗng; seed chỉ dành cho development
hoặc staging:

```bash
npm run db:migrate
npm run db:seed
```

## Troubleshooting

- Port đã dùng: đổi `FRONTEND_PORT` hoặc `BACKEND_PORT` trong `.env`.
- DB connection fail: kiểm tra `DATABASE_URL`, TLS option, provider allowlist và `/ready`.
- Dashboard stale: kiểm tra managed Redis health hoặc fallback query DB.
- AI fail: đổi `LLM_PROVIDER=mock`; kiểm tra schema/output trước khi thử provider thật.

Chi tiết provider, secret và backup nằm tại [Cloud Database & Runtime Configuration](cloud-database.md).
