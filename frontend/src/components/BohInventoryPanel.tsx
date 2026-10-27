import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { BohWorkspace, MasterDataOverview, createApiClient } from '../lib/api';

type Api = ReturnType<typeof createApiClient>;

type Props = {
  api: Api;
  token: string;
  branchId: string;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

type Tab = 'procurement' | 'stock' | 'control';

const commandKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const money = (value: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
}).format(value);

export function BohInventoryPanel({ api, token, branchId, onNotice, onError }: Props) {
  const [data, setData] = useState<BohWorkspace | null>(null);
  const [master, setMaster] = useState<MasterDataOverview | null>(null);
  const [tab, setTab] = useState<Tab>('procurement');
  const [busy, setBusy] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [wastageQuantity, setWastageQuantity] = useState(1);
  const [reason, setReason] = useState('Bổ sung tồn kho trước giờ cao điểm');
  const [wastageReason, setWastageReason] = useState('Hư hỏng trong sơ chế');
  const [countClosing, setCountClosing] = useState(7);

  async function load() {
    setBusy(true);

    try {
      const [nextData, nextMaster] = await Promise.all([
        api.bohWorkspace(token, branchId),
        api.masterData(token, branchId)
      ]);

      setData(nextData);
      setMaster(nextMaster);
      setSupplierId((current) => current || nextMaster.suppliers[0]?.id || '');
      setIngredientId((current) => current || nextMaster.ingredients[0]?.id || '');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Không thể tải workspace BOH.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [branchId, token]);

  const ingredient = useMemo(() => master?.ingredients.find((item) => item.id === ingredientId), [master, ingredientId]);
  const receivablePo = data?.purchaseOrders.find((po) => po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED');
  const pendingRequests = data?.stockRequests.filter((request) => request.status === 'REQUESTED').length ?? 0;
  const varianceQuantity = data?.dailyCounts.reduce((sum, count) => sum + count.lines.reduce((lineSum, line) => lineSum + Math.abs(line.varianceQuantity), 0), 0) ?? 0;

  async function run(action: () => Promise<object>, success: string) {
    setBusy(true);

    try {
      await action();
      await load();
      onNotice(success);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Thao tác BOH không thành công.');
    } finally {
      setBusy(false);
    }
  }

  function selectIngredient() {
    return (
      <select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)}>
        {master?.ingredients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    );
  }

  async function createPurchaseOrder(event: FormEvent) {
    event.preventDefault();

    if (!ingredient || !supplierId) return;

    await run(
      () => api.createPurchaseOrder(token, { branchId, supplierId, lines: [{ ingredientId: ingredient.id, orderedQuantity: quantity, unit: ingredient.purchaseUnit }] }, commandKey('po')),
      'Đã tạo PO nháp, chưa làm tăng tồn kho.'
    );
  }

  async function confirmReceipt(event: FormEvent) {
    event.preventDefault();

    if (!ingredient || !receivablePo) return;

    await run(
      () => api.confirmGoodsReceipt(token, { branchId, purchaseOrderId: receivablePo.id, lines: [{ ingredientId: receivablePo.lines[0]?.ingredientId ?? ingredient.id, acceptedQuantity: quantity, damagedQuantity: 0, rejectedQuantity: 0, unit: receivablePo.lines[0]?.unit ?? ingredient.purchaseUnit }] }, commandKey('receipt')),
      'Đã confirm goods receipt và ghi warehouse ledger atomic.'
    );
  }

  async function createStockRequest(event: FormEvent) {
    event.preventDefault();

    if (!ingredient) return;

    await run(
      () => api.createStockRequest(token, { fromLocationId: 'location_warehouse', toLocationId: 'location_branch_central', reason, lines: [{ ingredientId: ingredient.id, requestedQuantity: quantity, unit: ingredient.purchaseUnit }] }, commandKey('request')),
      'Đã gửi yêu cầu chuyển kho để chờ duyệt.'
    );
  }

  async function createCount(event: FormEvent) {
    event.preventDefault();

    if (!ingredient) return;

    await run(
      () => api.createDailyCount(token, { branchId, businessDate: new Date().toISOString().slice(0, 10), lines: [{ ingredientId: ingredient.id, openingQuantity: 8, receivedQuantity: 0, closingQuantity: countClosing, unit: ingredient.stockUnit }] }, commandKey('count')),
      'Đã lưu daily count nháp; lý thuyết thiếu được đánh dấu incomplete.'
    );
  }

  async function createWastage(event: FormEvent) {
    event.preventDefault();

    if (!ingredient) return;

    await run(
      () => api.createWastage(token, { branchId, ingredientId: ingredient.id, quantity: wastageQuantity, unit: ingredient.stockUnit, reason: wastageReason }, commandKey('wastage')),
      `Đã ghi hao hụt trị giá ${money(wastageQuantity * ingredient.standardCost)}.`
    );
  }

  if (!data || !master) {
    return <section className="operations-view workspace-loading" aria-live="polite"><span className="spinner" />Đang chuẩn bị kho…</section>;
  }

  return (
    <section className="operations-view" aria-labelledby="boh-title">
      <header className="view-header">
        <div>
          <span className="micro-label">BOH CONTROL · WEEKS 05–06</span>
          <h1 id="boh-title">Từ nhập hàng đến<br /><em>tồn kho có dấu vết.</em></h1>
          <p>PO, receipt, chuyển kho, kiểm kê và hao hụt chạy qua command có idempotency, ledger và audit.</p>
        </div>
        <div className="view-summary"><strong>{data.stockBalances.filter((item) => item.locationKind === 'BRANCH').length}</strong><span>stock lines tại branch</span></div>
      </header>

      <div className="operations-metrics" aria-label="BOH summary">
        <article className="ops-stat"><span>PO đang theo dõi</span><strong>{data.purchaseOrders.length}</strong><small>Draft không mutate stock</small></article>
        <article className="ops-stat"><span>Yêu cầu chờ duyệt</span><strong>{pendingRequests}</strong><small>Branch scope enforced</small></article>
        <article className="ops-stat"><span>Ledger events</span><strong>{data.ledger.length}</strong><small>Append-only source</small></article>
        <article className="ops-stat ops-stat-alert"><span>Variance quantity</span><strong>{varianceQuantity}</strong><small>Incomplete theory không coi là zero</small></article>
      </div>

      <div className="master-tabs" role="tablist" aria-label="BOH workflow">
        <button role="tab" aria-selected={tab === 'procurement'} className={`master-tab ${tab === 'procurement' ? 'active' : ''}`} onClick={() => setTab('procurement')}>Purchasing & receipt</button>
        <button role="tab" aria-selected={tab === 'stock'} className={`master-tab ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>Branch stock</button>
        <button role="tab" aria-selected={tab === 'control'} className={`master-tab ${tab === 'control' ? 'active' : ''}`} onClick={() => setTab('control')}>Count & wastage</button>
      </div>

      {tab === 'procurement' && (
        <div className="workspace-grid">
          <section className="panel data-panel">
            <span className="micro-label">NEW COMMAND</span>
            <h2>Tạo purchase order</h2>
            <p className="section-lede">PO nháp không làm tăng stock; chỉ receipt accepted mới ghi ledger.</p>
            <form className="master-form compact-form" onSubmit={createPurchaseOrder}>
              <label>Supplier<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>{master.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
              <label>Ingredient{selectIngredient()}</label>
              <label>Số lượng<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
              <button className="button button-primary" disabled={busy}>Tạo PO</button>
            </form>
            <div className="task-list"><h3 className="micro-label">PURCHASE ORDERS</h3>{data.purchaseOrders.map((po) => <div className="task-row" key={po.id}><span className="task-priority" /><div className="task-copy"><strong>{po.id} · {po.lines.length} line</strong><span>Supplier {po.supplierId} · received {po.lines[0]?.receivedQuantity ?? 0}/{po.lines[0]?.orderedQuantity ?? 0} {po.lines[0]?.unit}</span></div><span className={`status-badge status-${po.status.toLowerCase()}`}>{po.status}</span>{po.status === 'DRAFT' && <button className="button button-secondary" disabled={busy} onClick={() => void run(() => api.commandPurchaseOrder(token, po.id, 'send', commandKey('po-send')), 'PO đã chuyển sang SENT.')}>Gửi supplier</button>}</div>)}</div>
          </section>

          <section className="panel data-panel">
            <span className="micro-label">TRACEABLE RECEIVING</span>
            <h2>Goods receipt</h2>
            <p className="section-lede">Confirm atomic, có discrepancy line và retry-safe ledger.</p>
            <form className="master-form compact-form" onSubmit={confirmReceipt}>
              <label>PO đang nhận<select value={receivablePo?.id ?? ''} disabled={!receivablePo}><option value="">{receivablePo ? `${receivablePo.id} · ${receivablePo.status}` : 'Chưa có PO SENT'}</option></select></label>
              <label>Accepted<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
              <button className="button button-primary" disabled={busy || !receivablePo}>Confirm receipt</button>
            </form>
            {data.receipts.map((receipt) => <div className="shift-card" key={receipt.id}><div className="shift-line"><div><strong>{receipt.id}</strong><span>{receipt.purchaseOrderId} · {receipt.lines[0]?.acceptedQuantity ?? 0} {receipt.lines[0]?.unit} accepted</span></div><span className="status-badge status-published">{receipt.status}</span></div></div>)}
          </section>
        </div>
      )}

      {tab === 'stock' && (
        <div className="workspace-grid">
          <section className="panel data-panel">
            <span className="micro-label">BRANCH CONTROL</span>
            <h2>Tồn kho theo location</h2>
            <p className="section-lede">Warehouse xuất hàng sau approval; branch chỉ nhận stock khi accept transfer.</p>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Location</th><th>Ingredient</th><th>Quantity</th><th>Freshness</th></tr></thead><tbody>{data.stockBalances.map((balance) => <tr key={`${balance.locationId}:${balance.ingredientId}`}><td><strong>{balance.locationLabel}</strong><small>{balance.locationKind}</small></td><td>{master.ingredients.find((item) => item.id === balance.ingredientId)?.name ?? balance.ingredientId}</td><td><strong>{balance.quantity} {balance.unit}</strong></td><td>{new Date(balance.updatedAt).toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div>
          </section>

          <section className="panel data-panel">
            <span className="micro-label">STOCK REQUEST</span>
            <h2>Yêu cầu chuyển kho</h2>
            <p className="section-lede">Requested → Approved → In transit → Closed; approval không phải received.</p>
            <form className="master-form" onSubmit={createStockRequest}>
              <label>Ingredient{selectIngredient()}</label>
              <label>Quantity<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
              <label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
              <button className="button button-primary" disabled={busy}>Gửi request</button>
            </form>
            {data.stockRequests.map((request) => {
              const action = request.status === 'REQUESTED'
                ? { command: 'approve' as const, label: 'Duyệt', success: 'Đã duyệt stock request.' }
                : request.status === 'APPROVED'
                  ? { command: 'ship' as const, label: 'Ship', success: 'Đã xuất kho; branch đang chờ nhận.' }
                  : request.status === 'IN_TRANSIT'
                    ? { command: 'accept' as const, label: 'Accept', success: 'Branch đã nhận stock; request đã đóng.' }
                    : undefined;

              return <div className="task-row" key={request.id}><span className="task-priority" /><div className="task-copy"><strong>{request.id}</strong><span>{request.reason}</span></div><span className={`status-badge status-${request.status.toLowerCase()}`}>{request.status}</span>{action && <button className="button button-secondary" disabled={busy} onClick={() => void run(() => api.commandStockRequest(token, request.id, action.command, commandKey(`request-${action.command}`)), action.success)}>{action.label}</button>}</div>;
            })}
          </section>
        </div>
      )}

      {tab === 'control' && (
        <div className="workspace-grid">
          <section className="panel data-panel">
            <span className="micro-label">DAILY COUNT</span>
            <h2>Kiểm kê cuối ngày</h2>
            <p className="section-lede">Theoretical sold thiếu sẽ hiện rõ là incomplete, không bị trình bày thành 0.</p>
            <form className="master-form compact-form" onSubmit={createCount}>
              <label>Ingredient{selectIngredient()}</label>
              <label>Closing actual<input type="number" min="0" step="0.01" value={countClosing} onChange={(event) => setCountClosing(Number(event.target.value))} /></label>
              <button className="button button-primary" disabled={busy}>Lưu count</button>
            </form>
            {data.dailyCounts.map((count) => <div className="shift-card" key={count.id}><div className="shift-line"><div><strong>{count.businessDate}</strong><span>{count.lines.some((line) => line.theoreticalSoldStatus !== 'AVAILABLE') ? 'Theory incomplete · cần review' : 'Theory available'}</span></div><span className={`status-badge status-${count.status.toLowerCase()}`}>{count.status}</span>{(count.status === 'DRAFT' || count.status === 'REJECTED') && <button className="button button-secondary" disabled={busy} onClick={() => void run(() => api.submitDailyCount(token, count.id, commandKey('count-submit')), 'Daily count đã được submit để review.')}>Submit</button>}</div></div>)}
          </section>

          <section className="panel data-panel">
            <span className="micro-label">WASTAGE TRACE</span>
            <h2>Ghi nhận hao hụt</h2>
            <p className="section-lede">Quantity, reason, standard price snapshot và value bắt buộc trước khi submit.</p>
            <form className="master-form compact-form" onSubmit={createWastage}>
              <label>Ingredient{selectIngredient()}</label>
              <label>Quantity<input type="number" min="0.01" step="0.01" value={wastageQuantity} onChange={(event) => setWastageQuantity(Number(event.target.value))} /></label>
              <label>Reason<input value={wastageReason} onChange={(event) => setWastageReason(event.target.value)} required /></label>
              <button className="button button-primary" disabled={busy}>Ghi hao hụt</button>
            </form>
            {data.wastage.map((item) => <div className="task-row" key={item.id}><span className="task-priority task-high" /><div className="task-copy"><strong>{item.quantity} {item.unit} · {money(item.value)}</strong><span>{item.reason} · {item.status}</span></div>{(item.status === 'DRAFT' || item.status === 'REJECTED') && <button className="button button-secondary" disabled={busy} onClick={() => void run(() => api.submitWastage(token, item.id, commandKey('wastage-submit')), 'Wastage đã được submit để review.')}>Submit</button>}</div>)}
          </section>
        </div>
      )}
    </section>
  );
}
