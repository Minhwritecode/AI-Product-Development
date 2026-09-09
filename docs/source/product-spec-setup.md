# Product Spec — F&B Inventory & Wastage Management (AI-assisted)

## 1. Sản phẩm là gì
Web Application quản lý tồn kho & hao hụt nguyên liệu cho chuỗi F&B nhiều chi nhánh, có 2 tính năng AI hỗ trợ.

## 2. Người dùng & vai trò
| Role | Làm gì |
|---|---|
| Purchasing Manager | Đặt hàng NCC (PO) |
| Warehouse Admin | Nhận hàng, quản lý tồn kho tổng |
| Branch Manager | Xin chuyển hàng, kiểm kê cuối ngày |
| Owner | Xem Dashboard tổng quan |

## 3. 6 Module chức năng
1. **Master Data** — nguyên liệu (kèm quy đổi đơn vị: purchase_unit → stock_unit → recipe_unit), công thức món (Recipe/BOM), chi nhánh, nhà cung cấp
2. **Purchase Order** — đặt hàng NCC, trạng thái Draft → Sent → Delivered
3. **Goods Receipt** — nhận hàng, đối chiếu đặt vs nhận, phát hiện chênh lệch
4. **Branch Stock Request** — chi nhánh xin hàng từ kho tổng, có duyệt, closed-loop cảnh báo về Purchasing khi thiếu hàng liên tục
5. **Daily Count & Wastage** — kiểm kê cuối ngày, tự tính hao hụt (Recipe × số bill bán) ra số tiền cụ thể
6. **Dashboard + AI**:
   - AI Onboarding: parse text tự do (VD: "30g trà, 200ml sữa") → tự điền Recipe Line, người dùng duyệt trước khi lưu
   - AI Copilot: hỏi đáp tiếng Việt về dữ liệu vận hành ("chi nhánh nào hao hụt nhiều nhất?")

## 4. Entity chính (database schema gợi ý)
```
Ingredient (id, name, purchase_unit, stock_unit, conversion_rate, recipe_unit_rate, standard_price)
MenuItem (id, name, pos_item_code)
RecipeLine (id, menu_item_id FK, ingredient_id FK, qty_per_unit, recipe_unit)
Supplier (id, name, contact, lead_time_days)
PurchaseOrder (id, supplier_id FK, status, order_date, expected_delivery)
POLine (id, po_id FK, ingredient_id FK, qty_ordered, unit_price)
Branch (id, name, address, manager_id)
WarehouseStock (id, ingredient_id FK, qty_on_hand, low_stock_threshold)
BranchStock (id, branch_id FK, ingredient_id FK, qty_on_hand)
StockTransferRequest (id, branch_id FK, status, urgency_level)
TransferLine (id, request_id FK, ingredient_id FK, qty_requested, qty_shipped)
DailyCount (id, branch_id FK, ingredient_id FK, date, opening_qty, received_qty, sold_qty_theory, closing_qty_actual, variance_qty, variance_value)
WastageReport (id, count_id FK, reason, qty_wasted)
User (id, name, email, password_hash, role)
```

## 5. Kiến trúc hệ thống
```
Browser (React) → Nginx (reverse proxy) → Backend API (Node/Python)
                                              ├── PostgreSQL (data chính, SQL vì có nhiều quan hệ FK chặt)
                                              ├── Redis (cache: Dashboard report, tránh query lại DB)
                                              └── AI Service (gọi LLM API ngoài: OpenAI/Gemini/Claude)
```

| Khái niệm | Áp dụng trong sản phẩm |
|---|---|
| Client-server | Browser = client, Backend API = server |
| Request/Response | Frontend gọi REST API, backend trả JSON |
| Frontend | React (hoặc Next.js) |
| Backend | Node.js (Express/NestJS) hoặc Python (FastAPI) |
| API | REST, có thể thêm GraphQL nếu muốn nâng độ khó |
| Database | PostgreSQL (SQL) — vì dữ liệu có quan hệ chặt (FK giữa PO↔Supplier↔Ingredient) |
| SQL vs NoSQL | Chọn SQL — nghiệp vụ cần transaction chính xác (trừ/cộng tồn kho không được sai) |
| Server/Hosting | Docker container, deploy thử trên VPS (DigitalOcean/Render) hoặc localhost cho demo |
| Authentication | JWT token, login bằng email/password |
| Authorization | Role-based (Purchasing/Warehouse/Branch/Owner) — middleware check role trước khi vào route |
| Cache | Redis cho Dashboard/Report (dữ liệu tổng hợp không cần real-time tuyệt đối) |
| Load balancer | Nginx (dù 1 server, vẫn nên có để thể hiện hiểu kiến trúc scale) |
| CDN | Không bắt buộc cho đồ án — có thể nhắc trong phần "hướng mở rộng" |
| Single point of failure | Nhắc trong báo cáo: DB là SPOF hiện tại, hướng khắc phục = replication (không cần làm thật) |
| Backup | Cron job pg_dump định kỳ (làm demo đơn giản, không cần enterprise-grade) |
| Uptime | Không cần đo thật, chỉ cần biết khái niệm để trả lời khi hội đồng hỏi |

## 6. Phạm vi AI — giữ khiêm tốn
- AI **gợi ý**, người dùng **luôn duyệt lại** trước khi lưu — không tự động hoá hoàn toàn
- AI Copilot chỉ trả lời câu hỏi về data trong hệ thống (không phải chatbot mở)

---

# Setup Guide — Dựng môi trường Dev

## Bước 1: Cấu trúc thư mục
```
fnb-inventory/
├── frontend/          # React app
├── backend/           # Node.js hoặc Python API
├── ai-service/        # (optional tách riêng) gọi LLM API
├── docker-compose.yml
└── .env
```

## Bước 2: docker-compose.yml (khung tối thiểu)
```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]

  backend:
    build: ./backend
    ports: ["5000:5000"]
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/fnb_db
      - REDIS_URL=redis://redis:6379
    depends_on: [postgres, redis]

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_DB=fnb_db
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes: ["pgdata:/var/lib/postgresql/data"]
    ports: ["5432:5432"]

  redis:
    image: redis:7
    ports: ["6379:6379"]

  nginx:
    image: nginx:latest
    ports: ["80:80"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf"]
    depends_on: [frontend, backend]

volumes:
  pgdata:
```

## Bước 3: Thứ tự dựng thực tế (khuyên dùng)
1. **Backend + Postgres trước** — viết API CRUD cho Ingredient, Supplier, PurchaseOrder trước, test bằng Postman
2. **Frontend nối vào Backend** — dựng UI từng module theo đúng thứ tự Entity phụ thuộc (giống cách bạn học ở Cleeksy: Master Data → PO → Warehouse → Branch → Daily Count)
3. **Auth/Authorization** — thêm JWT + role check sau khi CRUD chạy ổn, đừng làm auth trước khi có gì để bảo vệ
4. **Redis cache** — thêm sau cùng, chỉ cho Dashboard/Report (phần nặng query)
5. **AI feature** — làm cuối cùng, vì phụ thuộc dữ liệu đã có (Recipe, Daily Count) để test

## Bước 4: Lệnh chạy
```bash
docker-compose up --build      # build và chạy toàn bộ
docker-compose down            # tắt
docker-compose logs -f backend # xem log riêng 1 service
```

## Bước 5: Biến môi trường cần có (.env)
```
DATABASE_URL=postgresql://user:pass@postgres:5432/fnb_db
REDIS_URL=redis://redis:6379
JWT_SECRET=your_secret_key
LLM_API_KEY=your_openai_or_gemini_key
```
