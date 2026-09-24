# Scope & Roadmap

## Milestone 1 — Full BOH Inventory & Wastage MVP + FOH Lite QR

### Included

- Master Data.
- Purchase Order.
- Goods Receipt.
- Warehouse and Branch Stock.
- Branch Stock Request.
- Daily Count and Wastage.
- Dashboard.
- Auth/RBAC/Audit.
- AI Onboarding và AI Copilot ở chế độ suggestion/read-only nếu discovery xác nhận đủ data.
- Operational configuration tối thiểu: branch/warehouse/table, operating state, queue policy, user/branch scope và token rotation.
- Front-door QR: availability, wait range, time budget, join/leave queue.
- Table QR: add-on request, assistance request, staff acknowledgement/status.
- Notification lifecycle tối thiểu cho queue/request: opt-in, delivery status, bounded retry và staff fallback.

### Exit

Một user demo đi được toàn bộ BOH workflow; guest đi được hai QR journey; mutation được transaction/audit; dashboard trace được về record nguồn; AI chưa duyệt không thay đổi data.

## Milestone 2 — Operational Accuracy & Controls

- PO approval.
- Partial/damaged/rejected receipt.
- Stock adjustment có reason.
- Stock history, expiry, batch/lot.
- Daily Count/Wastage approval.
- Basic audit viewer và exception alerts.
- Queue/service-duration calibration dựa trên dữ liệu thực tế, không hứa hẹn thời gian tuyệt đối.
- Partial/damaged/rejected receipt và shipment; in-transit, branch acceptance, backorder.
- Stock adjustment/reversal, count/wastage approval, period lock và reconciliation report.
- Staff task inbox, overdue/escalation và exception ownership.

## Milestone 3 — POS & Recipe Integration

- Import POS sales.
- POS item-code mapping.
- Recipe versioning.
- Theoretical usage và variance tự động.
- Cảnh báo variance vượt threshold.
- Liên kết add-on sales từ FOH với recipe version và theoretical usage.
- POS batch quarantine, replay, import reconciliation và data-quality report.

## Milestone 4 — Full FOH operational visibility

- Item availability signal từ BOH tới FOH.
- Kitchen/Bar shortage feedback.
- Linking sales/service delays với ingredient availability.
- Reservation, walk-in, table assignment, Kitchen/Bar và billing chỉ thêm khi có product decision riêng.

## Milestone 5+ — Advanced purchasing, AI và enterprise

- Supplier performance, lead time, price history, reorder points.
- Advanced dashboard, scheduled reports, role-aware natural language.
- Accounting/supplier/POS integrations.
- CSV master-data/opening-stock import, dashboard/ledger export và report template.
- Multi-warehouse, multi-language, forecasting, HA/DR.

## Out-of-scope guardrail

Nếu một request không giúp quản lý ingredient, purchasing, receipt, stock, branch count, wastage hoặc dữ liệu tích hợp trực tiếp cho các luồng đó, request cần qua scope decision trước khi vào backlog.
