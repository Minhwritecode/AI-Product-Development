import { FormEvent, useEffect, useState } from 'react';
import type { FrontDoorStatus, QueueEntry } from '../lib/api';

type GuestApi = {
  frontDoorStatus: (branchId: string) => Promise<FrontDoorStatus>;
  joinQueue: (input: { branchId: string; partySize: number; timeBudgetMinutes: number; language: 'vi' | 'en'; nickname?: string; notificationOptIn?: boolean; contact?: string }, idempotencyKey: string) => Promise<QueueEntry>;
  guestQueue: (queueId: string, accessToken: string) => Promise<QueueEntry>;
  leaveQueue: (queueId: string, accessToken: string, idempotencyKey: string) => Promise<QueueEntry>;
};

type Props = { api: GuestApi; branchId: string };

const savedQueueKey = (branchId: string) => `luminex.guest.queue.${branchId}`;

const operatingStateCopy: Record<FrontDoorStatus['operatingState'], { vi: string; en: string; icon: string }> = {
  OPEN: { vi: 'Đang nhận khách', en: 'Accepting guests', icon: '✓' },
  PAUSED: { vi: 'Tạm dừng nhận khách', en: 'Temporarily paused', icon: 'Ⅱ' },
  FULL: { vi: 'Đã đủ chỗ chờ', en: 'Queue is full', icon: '!' },
  CLOSED: { vi: 'Ngoài giờ phục vụ', en: 'Currently closed', icon: '×' }
};

const queueStatusCopy: Record<QueueEntry['status'], { vi: string; en: string }> = {
  WAITING: { vi: 'Đang chờ', en: 'Waiting' },
  CALLED: { vi: 'Đến lượt', en: 'Called' },
  SEATED: { vi: 'Đã xếp bàn', en: 'Seated' },
  LEFT: { vi: 'Đã rời hàng', en: 'Left queue' },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled' },
  EXPIRED: { vi: 'Đã hết hạn', en: 'Expired' }
};

function StatusMark({ state, label }: { state: FrontDoorStatus['operatingState']; label: string }) {
  const copy = operatingStateCopy[state];

  return <span className={`status-mark status-mark-${state.toLowerCase()}`} title={label} aria-label={label}>{copy.icon}</span>;
}

function GuestQueueResult({ entry, isVi, submitting, onLeave, onRefresh, stale, lastUpdatedAt }: { entry: QueueEntry; isVi: boolean; submitting: boolean; onLeave: () => void; onRefresh: () => void; stale: boolean; lastUpdatedAt: string | null }) {
  const copy = queueStatusCopy[entry.status];
  const called = entry.status === 'CALLED';

  return <section className="guest-result" aria-live="polite">
    <span className="micro-label">{isVi ? 'MÃ HÀNG CHỜ' : 'QUEUE CODE'}</span>
    <strong className="queue-code">{entry.queueCode}</strong>
    <p>{called ? (isVi ? 'Đến lượt bạn. Vui lòng gặp Host.' : 'Your table is ready. Please see the Host.') : entry.status === 'LEFT' ? (isVi ? 'Bạn đã rời hàng chờ.' : 'You left the queue.') : (isVi ? 'Đã ghi nhận. Giữ màn hình này để theo dõi.' : 'You are in line. Keep this screen to follow your status.')}</p>
    <div className="guest-status-card">
      <span className={`status-badge status-${entry.status.toLowerCase()}`}><span aria-hidden="true">{called ? '●' : '○'}</span>{isVi ? copy.vi : copy.en}</span>
      <span>{entry.partySize} {isVi ? 'khách' : 'guests'} · {entry.timeBudgetMinutes} {isVi ? 'phút chờ tối đa' : 'min wait budget'}</span>
    </div>
    <div className="guest-refresh-meta" role="status">
      <span className={stale ? 'freshness-stale' : 'freshness-fresh'}>{stale ? (isVi ? 'Dữ liệu có thể đã cũ' : 'Data may be stale') : (isVi ? 'Đã cập nhật' : 'Updated')}</span>
      <span>{lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString(isVi ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
    </div>
    <div className="guest-result-actions">
      {['WAITING', 'CALLED'].includes(entry.status) && <button className="guest-secondary" onClick={onLeave} disabled={submitting}>{submitting ? '…' : isVi ? 'Rời hàng chờ' : 'Leave the queue'}</button>}
      <button className="guest-text-button" onClick={onRefresh} disabled={submitting}>{isVi ? 'Cập nhật lại' : 'Retry update'}</button>
    </div>
  </section>;
}

export function GuestFrontDoor({ api, branchId }: Props) {
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [partySize, setPartySize] = useState(2);
  const [timeBudgetMinutes, setTimeBudgetMinutes] = useState(45);
  const [nickname, setNickname] = useState('');
  const [notificationOptIn, setNotificationOptIn] = useState(false);
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<FrontDoorStatus | null>(null);
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stale, setStale] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function refresh(savedEntry = entry) {
    try {
      const nextStatus = await api.frontDoorStatus(branchId);
      setStatus(nextStatus);

      if (savedEntry) {
        const nextEntry = await api.guestQueue(savedEntry.id, savedEntry.accessToken);
        setEntry(nextEntry);
        sessionStorage.setItem(savedQueueKey(branchId), JSON.stringify(nextEntry));
      }

      setStale(false);
      setLastUpdatedAt(new Date().toISOString());
      setError('');
    } catch (caught) {
      setStale(true);
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật tình trạng.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const key = savedQueueKey(branchId);
    const saved = sessionStorage.getItem(key);
    let savedEntry: QueueEntry | undefined;

    if (saved) {
      try {
        // SAFETY: The value is written by this component, parsed inside a try/catch, and validated against the active branch and required identifiers below.
        savedEntry = JSON.parse(saved) as QueueEntry;

        if (savedEntry.branchId !== branchId || !savedEntry.id || !savedEntry.accessToken) throw new Error('Invalid branch queue session');
        setEntry(savedEntry);
      } catch {
        sessionStorage.removeItem(key);
      }
    }

    void refresh(savedEntry);
    const interval = window.setInterval(() => void refresh(savedEntry), 15000);

    return () => window.clearInterval(interval);
  }, [branchId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    if (notificationOptIn && !contact.trim()) {
      setError(language === 'vi' ? 'Vui lòng nhập số điện thoại hoặc email để nhận thông báo.' : 'Add a phone number or email to receive notifications.');
      setSubmitting(false);

      return;
    }

    try {
      const next = await api.joinQueue({ branchId, partySize, timeBudgetMinutes, language, nickname: nickname.trim() || undefined, notificationOptIn, contact: notificationOptIn ? contact.trim() : undefined }, `guest-${crypto.randomUUID()}`);
      setEntry(next);
      sessionStorage.setItem(savedQueueKey(branchId), JSON.stringify(next));
      await refresh(next);
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
      sessionStorage.removeItem(savedQueueKey(branchId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể rời hàng chờ.');
    } finally {
      setSubmitting(false);
    }
  }

  const isVi = language === 'vi';
  const closed = status && status.operatingState !== 'OPEN';
  const stateCopy = status ? operatingStateCopy[status.operatingState] : null;

  return <main className="guest-page"><div className="guest-orb" aria-hidden="true" /><section className="guest-card" aria-labelledby="guest-title">
    <header className="guest-header"><span className="guest-brand">LUMINEX</span><div className="language-toggle" role="group" aria-label="Language"><button className={isVi ? 'active' : ''} onClick={() => setLanguage('vi')}>VI</button><button className={!isVi ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button></div></header>
    {entry ? <GuestQueueResult entry={entry} isVi={isVi} submitting={submitting} onLeave={() => void leave()} onRefresh={() => void refresh(entry)} stale={stale} lastUpdatedAt={lastUpdatedAt} /> : <>
      <span className="micro-label">FRONT-DOOR QR · {isVi ? 'CHÀO MỪNG' : 'WELCOME'}</span>
      <h1 id="guest-title">{isVi ? <>Biết trước,<br /><em>chờ đúng lúc.</em></> : <>Know before you wait,<br /><em>arrive with ease.</em></>}</h1>
      <p className="guest-copy">{isVi ? 'Xem tình trạng bàn theo thời gian thực. Không cần tải app hay tạo tài khoản.' : 'See the live table situation. No app or account required.'}</p>
      {loading ? <div className="guest-loading" aria-live="polite"><span className="spinner" />{isVi ? 'Đang kiểm tra bàn…' : 'Checking tables…'}</div> : <>
        <div className={`guest-availability state-${status?.operatingState.toLowerCase()}`} aria-live="polite"><div><StatusMark state={status?.operatingState ?? 'CLOSED'} label={stateCopy ? (isVi ? stateCopy.vi : stateCopy.en) : 'Loading'} />{stateCopy ? (isVi ? stateCopy.vi : stateCopy.en) : '—'}</div><strong>{status?.availableTables ?? 0}</strong><span>{isVi ? 'bàn sẵn sàng' : 'tables ready'} · {status ? new Date(status.asOf).toLocaleTimeString(isVi ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
        <div className="guest-refresh-meta" role="status"><span className={stale ? 'freshness-stale' : 'freshness-fresh'}>{stale ? (isVi ? 'Dữ liệu có thể đã cũ' : 'Data may be stale') : (isVi ? 'Trạng thái mới nhất' : 'Latest status')}</span><button className="guest-text-button" onClick={() => void refresh()}>{isVi ? 'Cập nhật lại' : 'Retry'}</button></div>
        <form className="guest-form" onSubmit={submit}>
          <label>{isVi ? 'Ngôn ngữ phục vụ' : 'Service language'}<div className="guest-choice-row"><button type="button" className={isVi ? 'selected' : ''} onClick={() => setLanguage('vi')}>Tiếng Việt</button><button type="button" className={!isVi ? 'selected' : ''} onClick={() => setLanguage('en')}>English</button></div></label>
          <div className="guest-form-grid"><label>{isVi ? 'Số khách' : 'Party size'}<input type="number" min="1" max="20" required value={partySize} aria-invalid={partySize < 1 || partySize > 20} onChange={(event) => setPartySize(Number(event.target.value))} /></label><label>{isVi ? 'Bạn có thể chờ' : 'I can wait'}<select value={timeBudgetMinutes} onChange={(event) => setTimeBudgetMinutes(Number(event.target.value))}><option value={30}>30 phút</option><option value={45}>45 phút</option><option value={60}>60 phút</option><option value={90}>90 phút</option></select></label></div>
          <label>{isVi ? 'Tên gọi (không bắt buộc)' : 'Name (optional)'}<input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={60} placeholder={isVi ? 'Ví dụ: Minh' : 'e.g. Alex'} /></label>
          <label className="guest-checkbox"><input type="checkbox" checked={notificationOptIn} onChange={(event) => setNotificationOptIn(event.target.checked)} />{isVi ? 'Nhận thông báo khi đến lượt (tùy chọn)' : 'Notify me when it is my turn (optional)'}</label>
          {notificationOptIn && <label>{isVi ? 'Số điện thoại hoặc email' : 'Phone number or email'}<input required value={contact} onChange={(event) => setContact(event.target.value)} maxLength={160} placeholder={isVi ? 'Nhập để nhận thông báo' : 'Only needed for notifications'} /><small className="field-help">{isVi ? 'Chỉ dùng cho queue này; không cần tạo tài khoản.' : 'Used only for this queue; no account required.'}</small></label>}
          {error && <p className="guest-error" role="alert">{error}</p>}
          <button className="guest-primary" disabled={submitting || Boolean(closed)}>{submitting ? (isVi ? 'Đang ghi nhận…' : 'Joining…') : closed ? (isVi ? 'Hiện chưa nhận khách' : 'Not accepting guests') : (isVi ? 'Vào hàng chờ' : 'Join the queue')}<span aria-hidden="true">→</span></button>
        </form>
        <p className="guest-note">{status?.estimatedWait.min === 0 ? (isVi ? 'Có bàn hiện tại; Host sẽ xác nhận chỗ phù hợp.' : 'Tables may be available; the Host confirms the best fit.') : `${isVi ? 'Thời gian chờ dự kiến' : 'Estimated wait'}: ${status?.estimatedWait.min}–${status?.estimatedWait.max} ${isVi ? 'phút' : 'min'} · ${status?.confidence.toLowerCase()} confidence.`}</p>
      </>}
    </>}
  </section></main>;
}
