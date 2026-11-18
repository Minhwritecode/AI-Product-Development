import { useEffect, useMemo, useState } from 'react';
import type { createApiClient, GuestTableMenu } from '../lib/api';

type Props = { api: ReturnType<typeof createApiClient>; token: string };

export function GuestTableMenu({ api, token }: Props) {
  const [menu, setMenu] = useState<GuestTableMenu | null>(null);
  const [selected, setSelected] = useState<Record<string, { quantity: number; note: string }>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void api.guestTableMenu(token)
      .then(setMenu)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Không thể mở menu tại bàn.'))
      .finally(() => setLoading(false));
  }, [api, token]);

  const items = useMemo(() => menu?.items.filter((item) => selected[item.id]) ?? [], [menu, selected]);

  async function submit() {
    if (!confirmed || !items.length) return;
    setSubmitting(true);
    setError('');

    try {
      await api.submitGuestTableRequest(token, items.map((item) => ({ menuItemId: item.id, quantity: selected[item.id].quantity, guestNote: selected[item.id].note || undefined })));
      setNotice('Yêu cầu đã gửi đến nhân viên. Nhân viên sẽ xác nhận trước khi tạo order.');
      setSelected({});
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể gửi yêu cầu.'); }
    finally { setSubmitting(false); }
  }

  function toggleItem(itemId: string, checked: boolean) {
    setSelected((current) => {
      if (checked) return { ...current, [itemId]: { quantity: 1, note: '' } };

      return Object.fromEntries(Object.entries(current).filter(([id]) => id !== itemId));
    });
  }

  return <main className="guest-page"><section className="guest-card guest-menu-card" aria-labelledby="table-menu-title">
    <header className="guest-header"><span className="guest-brand">LUMINEX · TABLE QR</span></header>
    {loading ? <div className="guest-loading" aria-live="polite"><span className="spinner" />Đang tải menu…</div> : error && !menu ? <div className="guest-error-box"><p className="guest-error" role="alert">{error}</p><p className="guest-fallback">Mã QR không hợp lệ hoặc phiên phục vụ đã kết thúc. Vui lòng quét lại mã tại bàn hoặc liên hệ nhân viên để được hỗ trợ.</p></div> : menu && <>
      <span className="micro-label">TABLE {menu.tableLabel}</span>
      <h1 id="table-menu-title">Gọi thêm món,<br /><em>đúng tại bàn.</em></h1>
      <p className="guest-copy">Vui lòng xác nhận bạn đang ngồi tại bàn {menu.tableLabel}. Nhân viên sẽ kiểm tra và xác nhận yêu cầu.</p>
      <label className="guest-checkbox"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Tôi đang ở đúng bàn {menu.tableLabel}</label>
      <div className="table-menu-list">{menu.items.map((item) => <article key={item.id} className="table-menu-item"><label><input type="checkbox" checked={Boolean(selected[item.id])} onChange={(event) => toggleItem(item.id, event.target.checked)} /><span><strong>{item.name}</strong><small>{item.description || item.stationCode}{item.allergenCodes.length ? ` · Dị ứng: ${item.allergenCodes.join(', ')}` : ''}</small></span><b>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: item.currency, maximumFractionDigits: 0 }).format(item.price)}</b></label>{selected[item.id] && <div className="table-menu-controls"><label>Số lượng<input type="number" min="1" max="20" value={selected[item.id].quantity} onChange={(event) => setSelected((current) => ({ ...current, [item.id]: { ...current[item.id], quantity: Math.max(1, Number(event.target.value)) } }))} /></label><label>Ghi chú / dị ứng<input value={selected[item.id].note} maxLength={200} onChange={(event) => setSelected((current) => ({ ...current, [item.id]: { ...current[item.id], note: event.target.value } }))} placeholder="Ví dụ: không đậu phộng" /></label></div>}</article>)}</div>
      {error && <p className="guest-error" role="alert">{error}</p>}{notice && <p className="guest-note" role="status">{notice}</p>}
      <button className="guest-primary" disabled={!confirmed || !items.length || submitting} onClick={() => void submit()}>{submitting ? 'Đang gửi…' : `Gửi yêu cầu (${items.length})`}<span aria-hidden="true">→</span></button>
      <p className="guest-footer-note">Cần hỗ trợ khác hoặc không muốn dùng QR? Vui lòng báo trực tiếp với nhân viên phục vụ.</p>
    </>}
  </section></main>;
}
