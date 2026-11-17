import { useCallback, useEffect, useState } from 'react';
import type { createApiClient, FloorBoard, FloorTable } from '../lib/api';

type Props = { api: ReturnType<typeof createApiClient>; token: string; branchId: string };

const statusLabel: Record<FloorTable['status'], string> = {
  READY: 'Sẵn sàng', BLOCKED: 'Tạm khóa', MAINTENANCE: 'Bảo trì', INACTIVE: 'Ngưng dùng',
  IN_USE: 'Đang phục vụ', WAITING_CLEANING: 'Chờ vệ sinh', CLEANING: 'Đang vệ sinh'
};

export function FloorPanel({ api, token, branchId }: Props) {
  const [board, setBoard] = useState<FloorBoard | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  const refresh = useCallback(async () => {
    try { setBoard(await api.floorBoard(token, branchId)); setStale(false); setError(''); }
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

  return <section className="floor-panel panel" aria-labelledby="floor-title">
    <div className="section-heading"><div><span className="micro-label">FOH · FLOOR</span><h1 id="floor-title">Bàn &amp; vệ sinh</h1></div><button className="button button-secondary" onClick={() => void refresh()}>Cập nhật</button></div>
    <p className="section-lede" aria-live="polite">{stale ? 'Dữ liệu có thể đã cũ. Vui lòng thử lại.' : board ? `Cập nhật lúc ${new Date(board.asOf).toLocaleTimeString('vi-VN')}` : 'Đang tải trạng thái bàn…'}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <label className="floor-party">Số khách bàn mới<input type="number" min="1" max="30" value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} /></label>
    <div className="floor-grid">{board?.tables.map((table) => {
      const session = board.sessions.find((item) => item.tableId === table.id);
      const cleaning = board.cleaningTasks.find((item) => item.tableId === table.id);

      return <article className="floor-table" key={table.id}>
        <div><strong>{table.label}</strong><span>{statusLabel[table.status]}</span></div>
        <p>{table.capacity} chỗ{table.accessibilityTags.length ? ` · ${table.accessibilityTags.join(', ')}` : ''}</p>
        {table.status === 'READY' && <button disabled={busyId === table.id || partySize < 1 || partySize > table.capacity} onClick={() => void run(table.id, async () => { await api.seatTable(token, { branchId, tableId: table.id, partySize, sourceType: 'WALK_IN' }); })}>Xếp khách walk-in</button>}
        {session && <button disabled={busyId === table.id} onClick={() => void run(table.id, async () => { await api.vacateSession(token, session.id); })}>Khách rời bàn</button>}
        {cleaning?.status === 'OPEN' && <button disabled={busyId === table.id} onClick={() => void run(table.id, async () => { await api.claimCleaning(token, cleaning.id); })}>Nhận vệ sinh</button>}
        {cleaning?.status === 'CLAIMED' && <button disabled={busyId === table.id} onClick={() => void run(table.id, async () => { await api.completeCleaning(token, cleaning.id); })}>Xác nhận đã sạch</button>}
      </article>;
    })}</div>
    {board?.tables.length === 0 && <p>Chưa có bàn trong chi nhánh này.</p>}
  </section>;
}
