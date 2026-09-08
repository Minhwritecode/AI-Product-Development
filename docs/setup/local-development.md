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

1. Backend + PostgreSQL: Ingredient, Supplier, Branch, PO.
2. Goods Receipt + transaction-safe stock.
3. Branch request + branch stock.
4. Daily count + wastage.
5. Auth/RBAC hardening and audit viewer.
6. Dashboard/report.
7. AI adapter after fixture data and core validation are stable.

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
