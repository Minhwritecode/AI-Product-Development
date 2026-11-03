import { useEffect, useMemo, useState } from 'react';
import type { QueueEntry, Reservation } from '../lib/api';

type QueueApi = {
  fohQueue: (token: string, branchId: string) => Promise<QueueEntry[]>;
  commandQueue: (token: string, queueId: string, command: 'call' | 'seat' | 'cancel' | 'expire', reason?: string) => Promise<QueueEntry>;
  reservations: (token: string, branchId: string, date?: string) => Promise<Reservation[]>;
  commandReservation: (token: string, reservationId: string, command: 'confirm' | 'arrive' | 'no-show') => Promise<Reservation>;
};

type Props = { token: string; branchId: string; api: QueueApi; onError: (message: string) => void };

const reservationStatus: Record<Reservation['status'], { label: string; tone: string }> = {
  HELD: { label: 'Đang giữ chỗ', tone: 'planned' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'active' },
  ARRIVED: { label: 'Đã đến', tone: 'open' },
  CANCELLED: { label: 'Đã hủy', tone: 'cancelled' },
  NO_SHOW: { label: 'No-show', tone: 'expired' },
  EXPIRED: { label: 'Hết hạn hold', tone: 'expired' }
};

function Freshness({ stale, updatedAt, onRetry, loading }: { stale: boolean; updatedAt: string | null; onRetry: () => void; loading: boolean }) {
  return <div className="freshness-line" role="status"><span className={stale ? 'freshness-stale' : 'freshness-fresh'}>{stale ? 'Dữ liệu có thể đã cũ' : 'Đang theo dõi tự động'}</span><span>{updatedAt ? `Cập nhật ${new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Chưa cập nhật'}</span><button className="text-button" onClick={onRetry} disabled={loading}>Thử lại</button></div>;
}

function QueueRow({ entry, pendingId, cancelTarget, setCancelTarget, onCommand }: { entry: QueueEntry; pendingId: string | null; cancelTarget: string | null; setCancelTarget: (id: string | null) => void; onCommand: (id: string, action: 'call' | 'seat' | 'cancel', reason?: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const busy = pendingId === entry.id;

  return <article className="foh-queue-row">
    <div className="queue-token"><strong>{entry.queueCode}</strong><small>{entry.partySize} khách · {entry.language.toUpperCase()}</small></div>
    <div className="queue-meta"><span className={`status-badge status-${entry.status.toLowerCase()}`}><span aria-hidden="true">{entry.status === 'CALLED' ? '●' : '○'}</span>{entry.status === 'WAITING' ? 'Đang chờ' : 'Đã gọi'}</span><small>{entry.timeBudgetMinutes} phút budget</small></div>
    <div className="task-actions">
      {entry.status === 'WAITING' && <button className="button button-primary" onClick={() => void onCommand(entry.id, 'call')} disabled={busy}>{busy ? 'Đang xử lý…' : 'Gọi khách'}</button>}
      {entry.status === 'CALLED' && <button className="button button-primary" onClick={() => void onCommand(entry.id, 'seat')} disabled={busy}>{busy ? 'Đang xử lý…' : 'Đã xếp bàn'}</button>}
      <button className="button button-secondary" onClick={() => setCancelTarget(cancelTarget === entry.id ? null : entry.id)} disabled={busy}>Hủy</button>
    </div>
    {cancelTarget === entry.id && <div className="inline-confirm"><label>Lý do hủy<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: khách đã rời khu vực" autoFocus /></label><div className="button-row"><button className="button button-secondary" onClick={() => setCancelTarget(null)}>Không hủy</button><button className="button button-danger" disabled={!reason.trim() || busy} onClick={() => void onCommand(entry.id, 'cancel', reason.trim())}>{busy ? 'Đang hủy…' : 'Xác nhận hủy'}</button></div></div>}
  </article>;
}

function ReservationPanel({ token, branchId, api, onError }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const date = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function load() {
    setLoading(true);

    try {
      setReservations(await api.reservations(token, branchId, date));
      setStale(false);
      setUpdatedAt(new Date().toISOString());
    } catch (error) {
      setStale(true);
      onError(error instanceof Error ? error.message : 'Không thể tải reservation.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 12000);

    return () => window.clearInterval(interval);
  }, [branchId, token, date]);

  async function command(id: string, action: 'confirm' | 'arrive' | 'no-show') {
    setPendingId(id);

    try {
      const updated = await api.commandReservation(token, id, action);
      setReservations((current) => current.map((item) => item.id === id ? updated : item));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Không thể cập nhật reservation.');
    } finally {
      setPendingId(null);
    }
  }

  return <section className="panel data-panel reservation-panel">
    <div className="section-heading"><div><span className="micro-label">RESERVATION DESK · {date}</span><h2>Arrival & no-show</h2></div><span className="completion-pill">{reservations.length} hôm nay</span></div>
    <Freshness stale={stale} updatedAt={updatedAt} onRetry={() => void load()} loading={loading} />
    <div className="reservation-list">
      {reservations.map((item) => <ReservationRow key={item.id} item={item} busy={pendingId === item.id} onCommand={command} />)}
      {!reservations.length && <div className="empty-state"><strong>Chưa có reservation hôm nay</strong><span>Danh sách tự cập nhật mỗi 12 giây.</span></div>}
    </div>
  </section>;
}

function ReservationRow({ item, busy, onCommand }: { item: Reservation; busy: boolean; onCommand: (id: string, action: 'confirm' | 'arrive' | 'no-show') => Promise<void> }) {
  const status = reservationStatus[item.status];
  const canArrive = ['HELD', 'CONFIRMED'].includes(item.status);
  const canNoShow = item.status === 'CONFIRMED';

  return <article className="reservation-row"><div><strong>{item.nickname || 'Khách chưa đặt tên'}</strong><small>{new Date(item.reservedFor).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {item.partySize} khách · {item.durationMinutes} phút</small></div><span className={`status-badge status-${status.tone}`}><span aria-hidden="true">{item.status === 'ARRIVED' ? '✓' : item.status === 'NO_SHOW' ? '!' : '○'}</span>{status.label}</span><div className="button-row">{canArrive && <button className="button button-primary" disabled={busy} onClick={() => void onCommand(item.id, 'arrive')}>{busy ? '…' : 'Đã đến'}</button>}{canNoShow && <button className="button button-secondary" disabled={busy} onClick={() => void onCommand(item.id, 'no-show')}>No-show</button>}</div></article>;
}

export function FohQueuePanel({ token, branchId, api, onError }: Props) {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);

    try {
      setEntries(await api.fohQueue(token, branchId));
      setStale(false);
      setUpdatedAt(new Date().toISOString());
    } catch (error) {
      setStale(true);
      onError(error instanceof Error ? error.message : 'Không thể tải hàng chờ.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 12000);

    return () => window.clearInterval(interval);
  }, [branchId, token]);

  async function command(id: string, action: 'call' | 'seat' | 'cancel', reason?: string) {
    setPendingId(id);

    try {
      const updated = await api.commandQueue(token, id, action, reason);
      setEntries((current) => current.map((entry) => entry.id === id ? updated : entry));
      setCancelTarget(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Không thể cập nhật hàng chờ.');
    } finally {
      setPendingId(null);
    }
  }

  const active = entries.filter((entry) => ['WAITING', 'CALLED'].includes(entry.status));

  return <section className="operations-view foh-queue-view" aria-labelledby="foh-queue-title"><header className="view-header"><div><span className="micro-label">FOH HOST DESK · FRONT-DOOR QR</span><h1 id="foh-queue-title">Một hàng chờ,<br /><em>một nhịp phục vụ.</em></h1><p>Guest QR và Host console dùng chung queue state; mỗi chuyển trạng thái có actor và audit ở backend.</p></div><div className="view-summary"><span className="live-status"><i />{loading ? 'Đang cập nhật' : 'Tự động theo dõi'}</span><strong>{active.length}</strong><span>khách đang chờ</span></div></header><Freshness stale={stale} updatedAt={updatedAt} onRetry={() => void load()} loading={loading} /><section className="panel data-panel"><div className="section-heading"><div><span className="micro-label">HOST ACTIONS</span><h2>Danh sách hàng chờ</h2></div><span className="completion-pill" aria-live="polite">{active.length} active</span></div><div className="foh-queue-list">{active.map((entry) => <QueueRow key={entry.id} entry={entry} pendingId={pendingId} cancelTarget={cancelTarget} setCancelTarget={setCancelTarget} onCommand={command} />)}{!active.length && <div className="empty-state"><strong>Hàng chờ đang trống</strong><span>Front-door QR sẽ cập nhật vào cùng queue này.</span></div>}</div></section><ReservationPanel token={token} branchId={branchId} api={api} onError={onError} /></section>;
}
