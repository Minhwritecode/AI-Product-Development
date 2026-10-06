# Local Development Setup

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
make infra-up
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

- `.env` local only; không commit.
- `LLM_PROVIDER=mock` dùng để phát triển không gọi provider thật.
- API key thật chỉ được nạp từ secret manager/CI secret.

## Docker

```bash
docker compose up -d postgres redis
docker compose logs -f postgres
docker compose down
```

Để chạy app qua Compose sau khi skeleton đã có implementation:

```bash
docker compose up --build
```

## Database workflow (planned)

Các lệnh sẽ được nối vào migration tool khi schema được implement:

```bash
npm run db:migrate
npm run db:seed
npm run db:test-reset
```

## Troubleshooting

- Port đã dùng: đổi `FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT`, `REDIS_PORT` trong `.env`.
- DB connection fail: kiểm tra `docker compose ps` và `DATABASE_URL`.
- Dashboard stale: clear Redis volume/cache sau khi xác nhận đây là môi trường local.
- AI fail: đổi `LLM_PROVIDER=mock`; kiểm tra schema/output trước khi thử provider thật.
