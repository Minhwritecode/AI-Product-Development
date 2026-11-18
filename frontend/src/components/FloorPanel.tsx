import { useCallback, useEffect, useState } from 'react';
import type { createApiClient, FloorBoard, FloorTable, MasterDataOverview, SessionOrder } from '../lib/api';

type Props = { api: ReturnType<typeof createApiClient>; token: string; branchId: string };

const statusLabel: Record<FloorTable['status'], string> = {
  READY: 'Sẵn sàng', HELD: 'Đang giữ bàn', BLOCKED: 'Tạm khóa', MAINTENANCE: 'Bảo trì', INACTIVE: 'Ngưng dùng',
  IN_USE: 'Đang phục vụ', WAITING_CLEANING: 'Chờ vệ sinh', CLEANING: 'Đang vệ sinh'
};

export function FloorPanel({ api, token, branchId }: Props) {
  const [board, setBoard] = useState<FloorBoard | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [menu, setMenu] = useState<MasterDataOverview | null>(null);
  const [draft, setDraft] = useState<SessionOrder | null>(null);
  const [qrLink, setQrLink] = useState('');
  const [holdMinutes, setHoldMinutes] = useState(10);
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try { const [nextBoard, nextMenu] = await Promise.all([api.floorBoard(token, branchId), api.masterData(token, branchId)]); setBoard(nextBoard); setMenu(nextMenu); setStale(false); setError(''); }
    catch (caught) { setStale(true); setError(caught instanceof Error ? caught.message : 'Không tải được trạng thái bàn.'); }
  }, [api, token, branchId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 12000);

    return () => window.clearInterval(timer);
  }, [refresh]);

  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id);

    try { await action(); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể hoàn tất thao tác.'); }
    finally { setBusyId(''); }
  }

  async function addRound(sessionId: string, itemId: string) {
    try {
      if (draft?.status === 'DRAFT' && draft.serviceSessionId === sessionId) {
        const lines = draft.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity + (line.menuItemId === itemId ? 1 : 0), modifierOptionIds: line.modifierOptionIds, allergenNote: line.allergenNote, guestNote: line.guestNote }));

        if (!lines.some((line) => line.menuItemId === itemId)) lines.push({ menuItemId: itemId, quantity: 1, modifierOptionIds: undefined, allergenNote: undefined, guestNote: undefined });

        setDraft(await api.updateOrderDraft(token, draft.id, { coursePolicy: draft.coursePolicy, lines }));

        return;
      }

      const next = await api.createOrderDraft(token, sessionId, { branchId, coursePolicy: 'AS_READY', lines: [{ menuItemId: itemId, quantity: 1 }] });
      setDraft(next);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tạo order draft.'); }
  }

  async function setCoursePolicy(coursePolicy: SessionOrder['coursePolicy']) {
    if (!draft || draft.status !== 'DRAFT') return;

    try {
      setDraft(await api.updateOrderDraft(token, draft.id, { coursePolicy, lines: draft.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity, modifierOptionIds: line.modifierOptionIds, allergenNote: line.allergenNote, guestNote: line.guestNote })) }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể cập nhật order draft.'); }
  }

  function changeCoursePolicy(value: string) {
    if (value === 'AS_READY' || value === 'SERVE_TOGETHER') void setCoursePolicy(value);
  }

  async function issueQr(tableId: string) {
    try { const issued = await api.issueTableQr(token, tableId); setQrLink(`${window.location.origin}/guest/table?token=${encodeURIComponent(issued.token)}`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tạo QR cho bàn.'); }
  }

  return <section className="floor-panel panel" aria-labelledby="floor-title">
    <div className="section-heading"><div><span className="micro-label">FOH · FLOOR</span><h1 id="floor-title">Bàn &amp; vệ sinh</h1></div><button className="button button-secondary" onClick={() => void refresh()}>Cập nhật</button></div>
    <p className="section-lede" aria-live="polite">{stale ? 'Dữ liệu có thể đã cũ. Vui lòng thử lại.' : board ? `Cập nhật lúc ${new Date(board.asOf).toLocaleTimeString('vi-VN')}` : 'Đang tải trạng thái bàn…'}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="floor-inputs"><label className="floor-party">Số khách bàn mới<input type="number" min="1" max="30" value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} /></label><label className="floor-party">Giữ bàn (phút)<input type="number" min="1" max="30" value={holdMinutes} onChange={(event) => setHoldMinutes(Number(event.target.value))} /></label></div>
    <div className="floor-grid">{board?.tables.map((table) => {
      const session = board.sessions.find((item) => item.tableId === table.id);
      const cleaning = board.cleaningTasks.find((item) => item.tableId === table.id);

      return <article className="floor-table" key={table.id}>
        <div><strong>{table.label}</strong><span>{statusLabel[table.status]}</span></div>
        <p>{table.capacity} chỗ{table.accessibilityTags.length ? ` · ${table.accessibilityTags.join(', ')}` : ''}</p>
        {table.status === 'READY' && <><button disabled={busyId === table.id || partySize < 1 || partySize > table.capacity} onClick={() => void run(table.id, async () => { await api.seatTable(token, { branchId, tableId: table.id, partySize, sourceType: 'WALK_IN' }); })}>Xếp khách walk-in</button><button disabled={busyId === table.id || partySize < 1 || partySize > table.capacity || holdMinutes < 1 || holdMinutes > 30} onClick={() => void run(table.id, async () => { await api.holdTable(token, { branchId, tableId: table.id, partySize, minutes: holdMinutes }); })}>Giữ bàn {holdMinutes} phút</button></>}
        {table.status === 'HELD' && <button disabled={busyId === table.id || partySize < 1 || partySize > table.capacity} onClick={() => void run(table.id, async () => { await api.seatTable(token, { branchId, tableId: table.id, partySize, sourceType: 'WALK_IN' }); })}>Xếp khách (bàn đang giữ)</button>}
        <button disabled={busyId === table.id} onClick={() => void issueQr(table.id)}>Tạo link QR bàn</button>
        {session && <button disabled={busyId === table.id} onClick={() => void run(table.id, async () => { await api.vacateSession(token, session.id); })}>Khách rời bàn</button>}
        {session && <label className="floor-party">Chuyển sang bàn<select value={transferTargets[session.id] ?? ''} onChange={(event) => setTransferTargets((current) => ({ ...current, [session.id]: event.target.value }))}><option value="">Chọn bàn trống</option>{board.tables.filter((candidate) => candidate.status === 'READY' && candidate.capacity >= session.partySize).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label} · {candidate.capacity} chỗ</option>)}</select><button disabled={!transferTargets[session.id] || busyId === table.id} onClick={() => void run(table.id, async () => { await api.transferSession(token, session.id, transferTargets[session.id]); })}>Chuyển bàn</button></label>}
        {session && menu?.menuItems.filter((item) => item.status === 'PUBLISHED').slice(0, 3).map((item) => <button key={item.id} disabled={busyId === table.id} onClick={() => void addRound(session.id, item.id)}>Thêm {item.name}</button>)}
        {cleaning?.status === 'OPEN' && <button disabled={busyId === table.id} onClick={() => void run(table.id, async () => { await api.claimCleaning(token, cleaning.id); })}>Nhận vệ sinh{cleaning.priority === 'HIGH' ? ' · ưu tiên cao' : ''}</button>}
        {cleaning?.status === 'CLAIMED' && <button disabled={busyId === table.id} onClick={() => void run(table.id, async () => { await api.completeCleaning(token, cleaning.id); })}>Xác nhận đã sạch</button>}
      </article>;
    })}</div>
    {board?.tables.length === 0 && <p>Chưa có bàn trong chi nhánh này.</p>}
    {draft && <aside className="floor-draft" aria-live="polite"><strong>Order round {draft.roundNumber} · {draft.status}</strong><span>{draft.lines.map((line) => `${line.quantity}× ${line.itemName}`).join(' · ')}</span>{draft.status === 'DRAFT' && <><label className="floor-party">Course<select value={draft.coursePolicy} onChange={(event) => changeCoursePolicy(event.target.value)}><option value="AS_READY">Ra món khi sẵn sàng</option><option value="SERVE_TOGETHER">Ra cùng lúc</option></select></label><button onClick={() => void api.sendOrder(token, draft.id).then(setDraft).catch((caught) => setError(caught instanceof Error ? caught.message : 'Không thể gửi order.'))}>Gửi order đến station</button></>}</aside>}
    {qrLink && <aside className="floor-draft"><strong>Link QR bàn</strong><a href={qrLink} target="_blank" rel="noreferrer">Mở trải nghiệm guest table QR</a></aside>}
  </section>;
}
