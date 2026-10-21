# Cloud Database & Runtime Configuration

## Quyết định triển khai

Luminex dùng managed PostgreSQL làm database chính. Đây là lựa chọn bắt buộc
cho production core vì purchasing, goods receipt, stock ledger, count, wastage,
billing và reconciliation cần foreign key, transaction, `SELECT ... FOR UPDATE`,
append-only history và idempotency.

MongoDB hoặc Firebase không phải database thay thế trong scope hiện tại. Đổi
sang một trong hai sẽ phá vỡ migration/SQL repository và yêu cầu thiết kế lại
write path, ledger, audit và state transition. Chỉ xem xét chúng cho integration
phụ sau khi có ADR riêng; không dùng làm source of truth cho inventory hoặc finance.

## Provider policy

Có thể dùng Supabase Postgres, Neon Postgres, Cloud SQL for PostgreSQL, Amazon
RDS for PostgreSQL hoặc dịch vụ managed PostgreSQL tương đương. Provider phải
cung cấp TLS, backup/restore, connection pooling phù hợp, app database role riêng
và audit/monitoring.

Với backend chạy container lâu dài, dùng connection string direct hoặc session
pooler theo hướng dẫn của provider. Không dùng transaction pooler nếu driver,
prepared statement hoặc migration workflow của provider không hỗ trợ. Connection
string phải được lấy từ dashboard/secret manager, không tự ghép hostname.

## Required environment

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@MANAGED_POSTGRES_HOST:5432/luminex?sslmode=require
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true
REDIS_URL=rediss://:PASSWORD@MANAGED_REDIS_HOST:6380
JWT_SECRET=<unique-secret-at-least-32-characters>
LUMINEX_SEED_ON_START=false
```

`DATABASE_URL` và `JWT_SECRET` phải được inject từ secret manager hoặc CI/CD
secret. `REDIS_URL` phải trỏ tới managed Redis khi cache/rate-limit/session
adapter được bật. Không đưa giá trị thật vào `.env.example`, Docker image,
repository hoặc log. Chỉ đặt `DATABASE_SSL_REJECT_UNAUTHORIZED=false` khi provider
yêu cầu theo tài liệu chính thức và có ticket bảo mật ghi nhận.

## Provisioning sequence

1. Tạo database cloud riêng cho development/staging và production; không dùng
   chung credential.
2. Tạo app role chỉ có quyền trên schema Luminex cần thiết. Migration job có
   credential riêng, không dùng app role để thay đổi schema production.
3. Cấu hình TLS, backup retention, point-in-time recovery và alert cho storage,
   connection saturation, failed backup và replication lag nếu provider hỗ trợ.
4. Inject environment vào deploy platform, chạy migration từ database rỗng,
   kiểm tra `/ready`, rồi mới chạy seed ở môi trường cần fixture.
5. Tắt seed ở production. Demo credential trong repository chỉ dành cho fixture.

## Commands

```bash
cp .env.example .env
make cloud-config-check
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
make app-up
```

Test suite hiện tại dùng memory repositories và không cần database local. Integration
tests có database phải trỏ vào database cloud tạm thời/ephemeral do CI cung cấp;
không dùng volume PostgreSQL local để giả lập production.

## Release checks

- Migration từ database rỗng thành công.
- `/health` trả process status; `/ready` chỉ ready khi PostgreSQL reachable.
- Goods receipt/shipment/payment retry không tạo duplicate.
- Backup restore được kiểm thử ngoài production.
- Connection string không xuất hiện trong log, error response hoặc frontend bundle.
- Database role, branch scope và audit vẫn được kiểm tra ở backend.
