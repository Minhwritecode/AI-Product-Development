import { FormEvent, useEffect, useState } from 'react';
import type { FrontDoorStatus, QueueEntry } from '../lib/api';

type Props = { api: { frontDoorStatus: (branchId: string) => Promise<FrontDoorStatus>; joinQueue: (input: { branchId: string; partySize: number; timeBudgetMinutes: number; language: 'vi' | 'en'; nickname?: string; notificationOptIn?: boolean }, idempotencyKey: string) => Promise<QueueEntry>; leaveQueue: (queueId: string, accessToken: string, idempotencyKey: string) => Promise<QueueEntry> }; branchId: string };

const savedQueueKey = 'luminex.guest.queue';

export function GuestFrontDoor({ api, branchId }: Props) {
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [partySize, setPartySize] = useState(2);
  const [timeBudgetMinutes, setTimeBudgetMinutes] = useState(45);
  const [nickname, setNickname] = useState('');
  const [status, setStatus] = useState<FrontDoorStatus | null>(null);
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      setStatus(await api.frontDoorStatus(branchId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể đọc tình trạng nhà hàng.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();

    const saved = sessionStorage.getItem(savedQueueKey);

    if (saved) {
      try {
        // SAFETY: sessionStorage is written by this component; malformed JSON is caught and removed.
        setEntry(JSON.parse(saved) as QueueEntry);
      } catch {
        sessionStorage.removeItem(savedQueueKey);
      }
    }
  }, [branchId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const next = await api.joinQueue({ branchId, partySize, timeBudgetMinutes, language, nickname: nickname.trim() || undefined }, `guest-${crypto.randomUUID()}`);
      setEntry(next);
      sessionStorage.setItem(savedQueueKey, JSON.stringify(next));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể vào hàng chờ.');
    } finally {
      setSubmitting(false);
    }
  }

  async function leave() {
    if (!entry) return;

    setSubmitting(true);
    setError('');

    try {
      const next = await api.leaveQueue(entry.id, entry.accessToken, `leave-${crypto.randomUUID()}`);
      setEntry(next);
      sessionStorage.removeItem(savedQueueKey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể rời hàng chờ.');
    } finally {
      setSubmitting(false);
    }
  }

  const isVi = language === 'vi';
  const closed = status && status.operatingState !== 'OPEN';

  return <main className="guest-page"><div className="guest-orb" aria-hidden="true" /><section className="guest-card" aria-labelledby="guest-title"><header className="guest-header"><span className="guest-brand">LUMINEX</span><div className="language-toggle" role="group" aria-label="Language"><button className={isVi ? 'active' : ''} onClick={() => setLanguage('vi')}>VI</button><button className={!isVi ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button></div></header>{entry ? <section className="guest-result" aria-live="polite"><span className="micro-label">{isVi ? 'MÃ HÀNG CHỜ' : 'QUEUE CODE'}</span><strong className="queue-code">{entry.queueCode}</strong><p>{entry.status === 'LEFT' ? (isVi ? 'Bạn đã rời hàng chờ.' : 'You left the queue.') : entry.status === 'CALLED' ? (isVi ? 'Đến lượt bạn. Vui lòng gặp Host.' : 'Your table is ready. Please see the Host.') : (isVi ? 'Đã ghi nhận. Giữ màn hình này để theo dõi.' : 'You are in line. Keep this screen to follow your status.')}</p><div className="guest-status-card"><span className={`status-badge status-${entry.status.toLowerCase()}`}>{entry.status}</span><span>{entry.partySize} {isVi ? 'khách' : 'guests'} · {entry.timeBudgetMinutes} min budget</span></div>{['WAITING', 'CALLED'].includes(entry.status) && <button className="guest-secondary" onClick={() => void leave()} disabled={submitting}>{submitting ? '…' : isVi ? 'Rời hàng chờ' : 'Leave the queue'}</button>}<button className="guest-text-button" onClick={() => void refresh()}>{isVi ? 'Cập nhật tình trạng' : 'Refresh status'}</button></section> : <><span className="micro-label">FRONT-DOOR QR · {isVi ? 'CHÀO MỪNG' : 'WELCOME'}</span><h1 id="guest-title">{isVi ? 'Biết trước,<br /><em>chờ đúng lúc.</em>' : 'Know before you wait,<br /><em>arrive with ease.</em>'}</h1><p className="guest-copy">{isVi ? 'Xem tình trạng bàn theo thời gian thực. Không cần tải app hay tạo tài khoản.' : 'See the live table situation. No app or account required.'}</p>{loading ? <div className="guest-loading" aria-live="polite"><span className="spinner" />{isVi ? 'Đang kiểm tra bàn…' : 'Checking tables…'}</div> : <><div className="guest-availability" aria-live="polite"><div><span className="status-dot status-ready" />{status?.operatingState === 'OPEN' ? (isVi ? 'Đang nhận khách' : 'Accepting guests') : status?.operatingState}</div><strong>{status?.availableTables ?? 0}</strong><span>{isVi ? 'bàn sẵn sàng' : 'tables ready'} · as of {status ? new Date(status.asOf).toLocaleTimeString(isVi ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div><form className="guest-form" onSubmit={submit}><label>{isVi ? 'Ngôn ngữ phục vụ' : 'Service language'}<div className="guest-choice-row"><button type="button" className={isVi ? 'selected' : ''} onClick={() => setLanguage('vi')}>Tiếng Việt</button><button type="button" className={!isVi ? 'selected' : ''} onClick={() => setLanguage('en')}>English</button></div></label><div className="guest-form-grid"><label>{isVi ? 'Số khách' : 'Party size'}<input type="number" min="1" max="20" value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} /></label><label>{isVi ? 'Bạn có thể chờ' : 'I can wait'}<select value={timeBudgetMinutes} onChange={(event) => setTimeBudgetMinutes(Number(event.target.value))}><option value={30}>30 phút</option><option value={45}>45 phút</option><option value={60}>60 phút</option><option value={90}>90 phút</option></select></label></div><label>{isVi ? 'Tên gọi (không bắt buộc)' : 'Name (optional)'}<input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={60} placeholder={isVi ? 'Ví dụ: Minh' : 'e.g. Alex'} /></label>{error && <p className="guest-error" role="alert">{error}</p>}<button className="guest-primary" disabled={submitting || Boolean(closed)}>{submitting ? (isVi ? 'Đang ghi nhận…' : 'Joining…') : closed ? (isVi ? 'Hiện chưa nhận khách' : 'Not accepting guests') : (isVi ? 'Xem lựa chọn chờ' : 'See my wait options')}<span aria-hidden="true">→</span></button></form><p className="guest-note">{status?.estimatedWait.min === 0 ? (isVi ? 'Có bàn hiện tại; Host sẽ xác nhận chỗ phù hợp.' : 'Tables may be available; the Host confirms the best fit.') : `${isVi ? 'Thời gian chờ dự kiến' : 'Estimated wait'}: ${status?.estimatedWait.min}–${status?.estimatedWait.max} ${isVi ? 'phút' : 'min'} · ${status?.confidence.toLowerCase()} confidence.`}</p></>}</>}</section></main>;
}
