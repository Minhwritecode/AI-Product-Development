import { useEffect, useMemo, useState } from 'react';
import type { Branch, DashboardReport } from '../lib/api';

type Props = { token: string; branchIds: string[]; branches: Branch[]; api: { dashboardSummary: (token: string, branchIds: string[]) => Promise<DashboardReport> }; onError: (message: string) => void };

type Drilldown = { title: string; detail: string; source: string };

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

function metricValue(metric: DashboardReport['summary']['lowStockCount']): string {
  if (metric.unit === 'VND') return money.format(metric.value);

  if (metric.unit === 'NOT_AVAILABLE') return 'N/A';

  return String(metric.value);
}

function sourceDetail(item: DashboardReport['lowStock'][number]): Drilldown {
  return { title: `Tồn thấp · ${item.ingredientId}`, detail: `${item.locationId} còn ${item.quantity} ${item.unit}, ngưỡng ${item.reorderPoint} ${item.unit}.`, source: 'stock_balances + reorder policy' };
}

function DashboardMetricCard({ label, value, detail, tone = '' }: { label: string; value: string; detail: string; tone?: string }) {
  return <article className={`ops-stat ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function BranchFilter({ branches, selectedIds, onChange }: { branches: Branch[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  function toggle(branchId: string) {
    const next = selectedIds.includes(branchId) ? selectedIds.filter((id) => id !== branchId) : [...selectedIds, branchId];
    onChange(next.length ? next : [branchId]);
  }

  return <fieldset className="dashboard-filter"><legend>Branch scope</legend><div className="branch-filter-list">{branches.map((branch) => <label key={branch.id}><input type="checkbox" checked={selectedIds.includes(branch.id)} onChange={() => toggle(branch.id)} />{branch.name}</label>)}</div></fieldset>;
}

function DrilldownCard({ drilldown, onClose }: { drilldown: Drilldown; onClose: () => void }) {
  return <aside className="drilldown-card" aria-live="polite"><div><span className="micro-label">SOURCE DRILL-DOWN</span><h3>{drilldown.title}</h3><p>{drilldown.detail}</p><small>{drilldown.source}</small></div><button className="icon-button" onClick={onClose} aria-label="Đóng drill-down">×</button></aside>;
}

export function BohDashboardPanel({ token, branchIds, branches, api, onError }: Props) {
  const [selectedIds, setSelectedIds] = useState(branchIds);
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [drilldown, setDrilldown] = useState<Drilldown | null>(null);

  useEffect(() => {
    setSelectedIds(branchIds);
  }, [branchIds.join(',')]);

  async function load() {
    setLoading(true);

    try {
      setReport(await api.dashboardSummary(token, selectedIds));
      setStale(false);
    } catch (error) {
      setStale(true);
      onError(error instanceof Error ? error.message : 'Không thể tải dashboard BOH.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [token, selectedIds.join(',')]);

  const branchNames = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches]);

  if (loading && !report) return <section className="workspace-loading" aria-live="polite"><span className="spinner" />Đang tổng hợp dữ liệu tồn kho…</section>;

  if (!report) return <section className="empty-state"><strong>Chưa có dữ liệu dashboard</strong><span>Kiểm tra branch scope hoặc thử tải lại.</span><button className="button button-secondary" onClick={() => void load()}>Thử lại</button></section>;

  return <section className="operations-view dashboard-view" aria-labelledby="dashboard-title">
    <header className="view-header"><div><span className="micro-label">BOH CONTROL TOWER · {report.freshness}</span><h1 id="dashboard-title">Inventory signals,<br /><em>đúng lúc.</em></h1><p>Theo dõi tồn thấp, chênh lệch ledger và hao hụt theo source record. Không coi dữ liệu lý thuyết thiếu là bằng 0.</p></div><div className="view-summary"><span className={report.freshness === 'STALE' || stale ? 'freshness-stale' : 'freshness-fresh'}>{report.freshness === 'STALE' || stale ? 'Dữ liệu cần đối chiếu' : 'Dữ liệu mới'}</span><strong>{new Date(report.asOf).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong><span>source · {report.sourceUpdatedAt ? new Date(report.sourceUpdatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span><button className="text-button" onClick={() => void load()} disabled={loading}>Tải lại</button></div></header>
    <BranchFilter branches={branches} selectedIds={selectedIds} onChange={setSelectedIds} />
    <div className="operations-metrics dashboard-metrics" aria-label="BOH KPI"><DashboardMetricCard label="Tồn dưới ngưỡng" value={metricValue(report.summary.lowStockCount)} detail={`${report.lowStock.filter((item) => item.status === 'OUT').length} mặt hàng hết tồn`} tone="ops-stat-alert" /><DashboardMetricCard label="PO đang mở" value={metricValue(report.summary.openPurchaseOrders)} detail={`${report.summary.openPurchaseOrders.sourceCount} source records`} /><DashboardMetricCard label="Stock request chờ xử lý" value={metricValue(report.summary.pendingStockRequests)} detail={`${report.summary.pendingStockRequests.sourceCount} source records`} /><DashboardMetricCard label="Giá trị tồn" value={metricValue(report.summary.stockValue)} detail="Chưa hiển thị nếu chưa có cost mapping" /></div>
    <section className="panel data-quality-panel"><div><span className="micro-label">DATA QUALITY</span><h2>Độ tin cậy dữ liệu</h2></div><div className="data-quality-grid"><div><strong>{metricValue(report.summary.incompleteTheoryCount)}</strong><span>line thiếu theoretical sold</span></div><div><strong>{report.freshness}</strong><span>freshness của source</span></div><div><strong>{report.summary.incompleteTheoryCount.sourceCount}</strong><span>source count của theory</span></div><div><strong>{report.branchIds.length}</strong><span>branch đang so sánh</span></div></div></section>
    {report.branchSummaries.length > 1 && <section className="panel data-panel branch-comparison"><div className="section-heading"><div><span className="micro-label">BRANCH COMPARISON</span><h2>So sánh theo branch</h2></div><span className="state-text">Cùng một filter scope</span></div><div className="branch-summary-grid">{report.branchSummaries.map((item) => <article key={item.branchId}><strong>{branchNames.get(item.branchId) ?? item.branchId}</strong><span>{item.lowStockCount} tồn thấp · {item.openPurchaseOrders} PO mở</span><small>{item.incompleteTheoryCount} theory incomplete · {item.sourceCount} sources</small></article>)}</div></section>}
    {drilldown && <DrilldownCard drilldown={drilldown} onClose={() => setDrilldown(null)} />}
    <div className="workspace-grid dashboard-grid"><section className="panel data-panel"><div className="section-heading"><div><span className="micro-label">ACTION QUEUE</span><h2>Tồn thấp cần xem</h2></div><span className="completion-pill">{report.lowStock.length} signals</span></div><p className="section-lede">Chọn một dòng để xem location, unit và reorder point.</p>{report.lowStock.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Ingredient</th><th>Location</th><th>Hiện có</th><th>Ngưỡng</th><th>Trạng thái</th></tr></thead><tbody>{report.lowStock.map((item) => <tr key={`${item.locationId}:${item.ingredientId}`}><td><button className="table-link" onClick={() => setDrilldown(sourceDetail(item))}><strong>{item.ingredientId}</strong></button></td><td>{item.locationId}</td><td>{item.quantity} {item.unit}</td><td>{item.reorderPoint} {item.unit}</td><td><span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status === 'OUT' ? 'Hết tồn' : 'Dưới ngưỡng'}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>Không có tồn thấp</strong><span>Ngưỡng đang được đọc từ policy của location.</span></div>}</section>
      <section className="panel data-panel"><div className="section-heading"><div><span className="micro-label">TRACEABILITY</span><h2>Reconciliation</h2></div><span className="completion-pill">{report.discrepancies.filter((item) => item.status === 'MISMATCH').length} mismatch</span></div><p className="section-lede">Projection so với append-only inventory ledger.</p><div className="reconciliation-list">{report.discrepancies.slice(0, 6).map((item) => <button className="reconciliation-row reconciliation-button" key={`${item.locationId}:${item.ingredientId}`} onClick={() => setDrilldown({ title: `Reconciliation · ${item.ingredientId}`, detail: `Projection ${item.projectedQuantity} ${item.unit}; ledger ${item.ledgerQuantity} ${item.unit}; variance ${item.varianceQuantity} ${item.unit}.`, source: 'stock_balances + inventory_ledger' })}><div><strong>{item.ingredientId}</strong><small>{item.locationId} · {item.unit}</small></div><span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status === 'MATCHED' ? 'Khớp' : `${item.varianceQuantity > 0 ? '+' : ''}${item.varianceQuantity}`}</span></button>)}{!report.discrepancies.length && <div className="empty-state"><strong>Chưa có projection</strong><span>Không tự suy diễn dữ liệu thiếu.</span></div>}</div></section>
    </div>
    <section className="panel data-panel audit-panel"><div className="section-heading"><div><span className="micro-label">AUDIT TRAIL</span><h2>Quyết định gần đây</h2></div><span className="state-text">Source: PostgreSQL projection</span></div><div className="audit-list">{report.audit.slice(0, 8).map((entry) => <button className="audit-row audit-button" key={entry.id} onClick={() => setDrilldown({ title: entry.action, detail: `${entry.entityType} · ${entry.entityId}${entry.reason ? ` · ${entry.reason}` : ''}`, source: `audit_logs · ${entry.requestId}` })}><span className="audit-marker" /><div><strong>{entry.action}</strong><small>{entry.entityType} · {entry.entityId} · {entry.requestId}</small></div><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></button>)}{!report.audit.length && <p className="state-text">Chưa có audit event trong branch scope hiện tại.</p>}</div></section>
  </section>;
}
