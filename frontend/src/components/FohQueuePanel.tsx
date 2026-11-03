import { useEffect, useState } from 'react';
import type { QueueEntry } from '../lib/api';

type Props = { token: string; branchId: string; api: { fohQueue: (token: string, branchId: string) => Promise<QueueEntry[]>; commandQueue: (token: string, queueId: string, command: 'call' | 'seat' | 'cancel' | 'expire', reason?: string) => Promise<QueueEntry> }; onError: (message: string) => void };

export function FohQueuePanel({ token, branchId, api, onError }: Props) {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    try {
      setEntries(await api.fohQueue(token, branchId));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Không thể tải hàng chờ.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [branchId, token]);

  async function command(id: string, action: 'call' | 'seat' | 'cancel' | 'expire') {
    try {
      const updated = await api.commandQueue(token, id, action, action === 'cancel' ? 'Host hủy tại quầy' : undefined);
      setEntries((current) => current.map((entry) => entry.id === id ? updated : entry));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Không thể cập nhật hàng chờ.');
    }
  }

  const active = entries.filter((entry) => ['WAITING', 'CALLED'].includes(entry.status));

  return <section className="operations-view foh-queue-view" aria-labelledby="foh-queue-title"><header className="view-header"><div><span className="micro-label">FOH HOST DESK · FRONT-DOOR QR</span><h1 id="foh-queue-title">Một hàng chờ,<br /><em>một nhịp phục vụ.</em></h1><p>Guest QR và Host console dùng chung queue state; mỗi chuyển trạng thái có actor và audit ở backend.</p></div><div className="view-summary"><span className="live-status"><i />{loading ? 'Đang tải' : 'Live queue'}</span><strong>{active.length}</strong><span>khách đang chờ</span><button className="text-button" onClick={() => void load()} disabled={loading}>Tải lại</button></div></header><section className="panel data-panel"><div className="section-heading"><div><span className="micro-label">HOST ACTIONS</span><h2>Danh sách hàng chờ</h2></div><span className="completion-pill" aria-live="polite">{active.length} active</span></div><div className="foh-queue-list">{active.map((entry) => <article className="foh-queue-row" key={entry.id}><div className="queue-token"><strong>{entry.queueCode}</strong><small>{entry.partySize} khách · {entry.language.toUpperCase()}</small></div><div className="queue-meta"><span className={`status-badge status-${entry.status.toLowerCase()}`}>{entry.status}</span><small>{entry.timeBudgetMinutes} phút budget</small></div><div className="task-actions">{entry.status === 'WAITING' && <button className="button button-primary" onClick={() => void command(entry.id, 'call')}>Gọi khách</button>}{entry.status === 'CALLED' && <button className="button button-primary" onClick={() => void command(entry.id, 'seat')}>Đã xếp bàn</button>}<button className="button button-secondary" onClick={() => void command(entry.id, 'cancel')}>Hủy</button></div></article>)}{!active.length && <div className="empty-state"><strong>Hàng chờ đang trống</strong><span>Front-door QR sẽ cập nhật vào cùng queue này.</span></div>}</div></section></section>;
}
