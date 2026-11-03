import { useEffect, useState } from 'react';
import type { DashboardReport } from '../lib/api';

type Props = { token: string; branchId: string; api: { dashboardSummary: (token: string, branchId: string) => Promise<DashboardReport> }; onError: (message: string) => void };

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

function metricValue(metric: DashboardReport['summary']['lowStockCount']): string { return metric.unit === 'VND' ? money.format(metric.value) : String(metric.value); }

export function BohDashboardPanel({ token, branchId, api, onError }: Props) {
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    try {
      setReport(await api.dashboardSummary(token, branchId));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Không thể tải dashboard BOH.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [branchId, token]);

  if (loading && !report) return <section className="workspace-loading" aria-live="polite"><span className="spinner" />Đang tổng hợp dữ liệu tồn kho…</section>;

  if (!report) return <section className="empty-state"><strong>Chưa có dữ liệu dashboard</strong><span>Kiểm tra branch scope hoặc thử tải lại.</span><button className="button button-secondary" onClick={() => void load()}>Thử lại</button></section>;

  return <section className="operations-view dashboard-view" aria-labelledby="dashboard-title">
    <header className="view-header"><div><span className="micro-label">BOH CONTROL TOWER · {report.freshness}</span><h1 id="dashboard-title">Inventory signals,<br /><em>đúng lúc.</em></h1><p>Theo dõi tồn thấp, chênh lệch ledger và hao hụt theo source record. Không coi dữ liệu lý thuyết thiếu là bằng 0.</p></div><div className="view-summary"><span className="live-status"><i />{loading ? 'Đang cập nhật' : 'Live projection'}</span><strong>{new Date(report.asOf).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong><span>as_of · {report.branchIds.length} branch</span><button className="text-button" onClick={() => void load()} disabled={loading}>Tải lại</button></div></header>
    <div className="operations-metrics dashboard-metrics" aria-label="BOH KPI">
      <article className="ops-stat ops-stat-alert"><span>Tồn dưới ngưỡng</span><strong>{metricValue(report.summary.lowStockCount)}</strong><small>{report.lowStock.filter((item) => item.status === 'OUT').length} mặt hàng hết tồn</small></article>
      <article className="ops-stat"><span>PO đang mở</span><strong>{metricValue(report.summary.openPurchaseOrders)}</strong><small>Draft · Sent · Partial receipt</small></article>
      <article className="ops-stat"><span>Stock request chờ xử lý</span><strong>{metricValue(report.summary.pendingStockRequests)}</strong><small>Approval · transit</small></article>
      <article className="ops-stat"><span>Hao hụt đã ghi nhận</span><strong>{metricValue(report.summary.wastageValue)}</strong><small>{report.summary.wastageValue.sourceCount} record có reason/value</small></article>
    </div>
    <div className="workspace-grid dashboard-grid">
      <section className="panel data-panel"><div className="section-heading"><div><span className="micro-label">ACTION QUEUE</span><h2>Tồn thấp cần xem</h2></div><span className="completion-pill">{report.lowStock.length} signals</span></div><p className="section-lede">Mỗi signal giữ location, unit và reorder point để BOH drill-down.</p>{report.lowStock.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Ingredient</th><th>Location</th><th>Hiện có</th><th>Ngưỡng</th><th>Trạng thái</th></tr></thead><tbody>{report.lowStock.map((item) => <tr key={`${item.locationId}:${item.ingredientId}`}><td><strong>{item.ingredientId}</strong></td><td>{item.locationId}</td><td>{item.quantity} {item.unit}</td><td>{item.reorderPoint} {item.unit}</td><td><span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status === 'OUT' ? 'Hết tồn' : 'Dưới ngưỡng'}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>Không có tồn thấp</strong><span>Ngưỡng đang được đọc từ policy của location.</span></div>}</section>
      <section className="panel data-panel"><div className="section-heading"><div><span className="micro-label">TRACEABILITY</span><h2>Reconciliation</h2></div><span className="completion-pill">{report.discrepancies.filter((item) => item.status === 'MISMATCH').length} mismatch</span></div><p className="section-lede">Projection so với append-only inventory ledger.</p><div className="reconciliation-list">{report.discrepancies.slice(0, 6).map((item) => <div className="reconciliation-row" key={`${item.locationId}:${item.ingredientId}`}><div><strong>{item.ingredientId}</strong><small>{item.locationId} · {item.unit}</small></div><span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status === 'MATCHED' ? 'Khớp' : `${item.varianceQuantity > 0 ? '+' : ''}${item.varianceQuantity}`}</span></div>)}{!report.discrepancies.length && <div className="empty-state"><strong>Chưa có projection</strong><span>Không tự suy diễn dữ liệu thiếu.</span></div>}</div></section>
    </div>
    <section className="panel data-panel audit-panel"><div className="section-heading"><div><span className="micro-label">AUDIT TRAIL</span><h2>Quyết định gần đây</h2></div><span className="state-text">Source: PostgreSQL projection</span></div><div className="audit-list">{report.audit.slice(0, 8).map((entry) => <div className="audit-row" key={entry.id}><span className="audit-marker" /><div><strong>{entry.action}</strong><small>{entry.entityType} · {entry.entityId} · {entry.requestId}</small></div><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div>)}{!report.audit.length && <p className="state-text">Chưa có audit event trong branch scope hiện tại.</p>}</div></section>
  </section>;
}
