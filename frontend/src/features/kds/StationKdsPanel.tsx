import { useCallback, useEffect, useState } from 'react';
import type { createApiClient, StationCode, StationTicket, TicketStatus } from '../../lib/api';

type Props = {
  api: ReturnType<typeof createApiClient>;
  token: string;
  branchId: string;
};

const statusLabels: Record<TicketStatus, { label: string; tone: string }> = {
  NEW: { label: 'Đơn mới', tone: 'new' },
  ACCEPTED: { label: 'Đã nhận', tone: 'accepted' },
  PREPARING: { label: 'Đang chế biến', tone: 'preparing' },
  READY: { label: 'Chờ bưng món', tone: 'ready' },
  PICKED_UP: { label: 'Đang bưng', tone: 'pickup' },
  SERVED: { label: 'Đã phục vụ', tone: 'served' },
  DELAYED: { label: 'Bị trễ', tone: 'delayed' },
  REJECTED: { label: 'Từ chối', tone: 'rejected' },
  CANCELLED: { label: 'Đã hủy', tone: 'cancelled' }
};

type ElapsedDisplay = {
  text: string;
  alertLevel: 'normal' | 'warning' | 'urgent';
};

function formatElapsedMinutes(createdAt: string): ElapsedDisplay {
  const diffMinutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);

  if (diffMinutes < 1) return { text: '< 1 phút', alertLevel: 'normal' };

  if (diffMinutes < 10) return { text: `${diffMinutes} phút`, alertLevel: 'normal' };

  if (diffMinutes < 20) return { text: `${diffMinutes} phút`, alertLevel: 'warning' };

  return { text: `${diffMinutes} phút (QUÁ GIỜ)`, alertLevel: 'urgent' };
}

export function StationKdsPanel({ api, token, branchId }: Props) {
  const [station, setStation] = useState<StationCode>('KITCHEN');
  const [tickets, setTickets] = useState<StationTicket[]>([]);
  const [filter, setFilter] = useState<'ACTIVE' | 'NEW' | 'PREPARING' | 'READY' | 'DELAYED_REJECTED'>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [reasonModal, setReasonModal] = useState<{ ticketId: string; command: 'delay' | 'reject'; title: string } | null>(null);
  const [reasonInput, setReasonInput] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await api.stationTickets(token, station, branchId);
      setTickets(data);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được danh sách vé trạm.');
    } finally {
      setLoading(false);
    }
  }, [api, token, station, branchId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10000);

    return () => window.clearInterval(interval);
  }, [refresh]);

  async function handleCommand(ticketId: string, command: 'accept' | 'start' | 'ready' | 'delay' | 'reject' | 'pick-up' | 'serve', reason?: string) {
    setBusyId(ticketId);
    setError('');

    try {
      const updated = await api.commandTicket(token, ticketId, command, reason);
      setTickets((current) => current.map((item) => (item.id === ticketId ? updated : item)));

      if (reasonModal) {
        setReasonModal(null);
        setReasonInput('');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Thao tác không thành công.');
    } finally {
      setBusyId('');
    }
  }

  const activeTickets = tickets.filter((t) => ['NEW', 'ACCEPTED', 'PREPARING'].includes(t.status));
  const newTickets = tickets.filter((t) => t.status === 'NEW');
  const preparingTickets = tickets.filter((t) => ['ACCEPTED', 'PREPARING'].includes(t.status));
  const readyTickets = tickets.filter((t) => t.status === 'READY');
  const exceptionTickets = tickets.filter((t) => ['DELAYED', 'REJECTED'].includes(t.status));

  const displayedTickets = tickets.filter((t) => {
    if (filter === 'ACTIVE') return ['NEW', 'ACCEPTED', 'PREPARING', 'DELAYED'].includes(t.status);

    if (filter === 'NEW') return t.status === 'NEW';

    if (filter === 'PREPARING') return ['ACCEPTED', 'PREPARING'].includes(t.status);

    if (filter === 'READY') return t.status === 'READY';

    if (filter === 'DELAYED_REJECTED') return ['DELAYED', 'REJECTED'].includes(t.status);

    return true;
  });

  return (
    <section className="operations-view kds-view" aria-labelledby="kds-title">
      <header className="view-header">
        <div>
          <span className="micro-label">KDS · KITCHEN &amp; BAR DISPLAY SYSTEM</span>
          <h1 id="kds-title">Màn hình điều phối trạm</h1>
          <p>Tự động phân luồng đồ ăn sang Bếp và đồ uống sang Quầy Bar. Đo lường SLA chế biến theo thời gian thực.</p>
        </div>
        <div className="view-summary">
          <span className="live-status"><i />{loading ? 'Đang cập nhật' : 'Tự động đồng bộ (10s)'}</span>
          <strong>{activeTickets.length}</strong>
          <span>đơn đang làm</span>
        </div>
      </header>

      {/* Switcher Bếp / Bar */}
      <div className="kds-station-switcher" role="tablist" aria-label="Chọn trạm">
        <button
          type="button"
          role="tab"
          aria-selected={station === 'KITCHEN'}
          className={`kds-station-btn ${station === 'KITCHEN' ? 'active' : ''}`}
          onClick={() => setStation('KITCHEN')}
        >
          🍳 Bếp (Kitchen)
          {station === 'KITCHEN' && <span className="kds-count-pill">{activeTickets.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={station === 'BAR'}
          className={`kds-station-btn ${station === 'BAR' ? 'active' : ''}`}
          onClick={() => setStation('BAR')}
        >
          🍸 Quầy Bar (Beverages)
          {station === 'BAR' && <span className="kds-count-pill">{activeTickets.length}</span>}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="kds-filter-bar">
        <div className="button-row">
          <button
            type="button"
            className={`button ${filter === 'ACTIVE' ? 'button-primary' : 'button-secondary'}`}
            onClick={() => setFilter('ACTIVE')}
          >
            Đang hoạt động ({activeTickets.length + exceptionTickets.filter((t) => t.status === 'DELAYED').length})
          </button>
          <button
            type="button"
            className={`button ${filter === 'NEW' ? 'button-primary' : 'button-secondary'}`}
            onClick={() => setFilter('NEW')}
          >
            Đơn mới ({newTickets.length})
          </button>
          <button
            type="button"
            className={`button ${filter === 'PREPARING' ? 'button-primary' : 'button-secondary'}`}
            onClick={() => setFilter('PREPARING')}
          >
            Đang nấu/pha ({preparingTickets.length})
          </button>
          <button
            type="button"
            className={`button ${filter === 'READY' ? 'button-primary' : 'button-secondary'}`}
            onClick={() => setFilter('READY')}
          >
            Chờ bưng ({readyTickets.length})
          </button>
          <button
            type="button"
            className={`button ${filter === 'DELAYED_REJECTED' ? 'button-primary' : 'button-secondary'}`}
            onClick={() => setFilter('DELAYED_REJECTED')}
          >
            Báo trễ / Lỗi ({exceptionTickets.length})
          </button>
        </div>
        <button type="button" className="button button-secondary" onClick={() => void refresh()}>
          Làm mới
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* Grid of KDS Ticket Cards */}
      <div className="kds-grid" aria-live="polite">
        {displayedTickets.map((ticket) => {
          const timer = formatElapsedMinutes(ticket.createdAt);
          const isBusy = busyId === ticket.id;

          return (
            <article key={ticket.id} className={`kds-card kds-status-${statusLabels[ticket.status].tone}`}>
              <header className="kds-card-header">
                <div>
                  <strong className="kds-table-badge">{ticket.tableLabel}</strong>
                  <span className="kds-round-badge">Round {ticket.roundNumber}</span>
                </div>
                <div className="kds-card-meta">
                  <span className={`kds-timer kds-timer-${timer.alertLevel}`}>⏱ {timer.text}</span>
                  <span className={`status-badge status-${statusLabels[ticket.status].tone}`}>
                    {statusLabels[ticket.status].label}
                  </span>
                </div>
              </header>

              {/* Course policy indicator */}
              <div className="kds-course-bar">
                {ticket.coursePolicy === 'SERVE_TOGETHER' ? (
                  <span className="kds-course-badge kds-course-together">⚠️ Ra cùng lúc (Serve Together)</span>
                ) : (
                  <span className="kds-course-badge kds-course-ready">✓ Ra khi sẵn sàng (As Ready)</span>
                )}
              </div>

              {/* Lines / Items */}
              <ul className="kds-item-list">
                {ticket.lines.map((line, idx) => (
                  <li key={`${line.menuItemId}-${idx}`} className="kds-item-row">
                    <div className="kds-item-main">
                      <strong className="kds-item-qty">{line.quantity}×</strong>
                      <span className="kds-item-name">{line.itemName}</span>
                    </div>

                    {/* Allergen Warning Banner */}
                    {line.allergenNote && (
                      <div className="kds-allergen-alert" role="alert">
                        <strong>⚠️ CẢNH BÁO DỊ ỨNG:</strong> {line.allergenNote}
                      </div>
                    )}

                    {/* Guest Note */}
                    {line.guestNote && (
                      <p className="kds-guest-note">
                        <em>Ghi chú:</em> {line.guestNote}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {/* Exception Reasons */}
              {ticket.status === 'DELAYED' && ticket.delayReason && (
                <div className="kds-exception-box kds-box-delay">
                  <strong>Bị trễ:</strong> {ticket.delayReason}
                </div>
              )}
              {ticket.status === 'REJECTED' && ticket.rejectReason && (
                <div className="kds-exception-box kds-box-reject">
                  <strong>Đã từ chối:</strong> {ticket.rejectReason}
                </div>
              )}

              {/* Action Buttons */}
              <footer className="kds-card-actions">
                {ticket.status === 'NEW' && (
                  <button
                    type="button"
                    className="button button-primary kds-action-btn"
                    disabled={isBusy}
                    onClick={() => void handleCommand(ticket.id, 'accept')}
                  >
                    {isBusy ? 'Đang nhận…' : 'Nhận vé (Accept)'}
                  </button>
                )}

                {ticket.status === 'ACCEPTED' && (
                  <button
                    type="button"
                    className="button button-primary kds-action-btn kds-btn-start"
                    disabled={isBusy}
                    onClick={() => void handleCommand(ticket.id, 'start')}
                  >
                    {isBusy ? 'Đang cập nhật…' : 'Bắt đầu nấu (Start)'}
                  </button>
                )}

                {ticket.status === 'PREPARING' && (
                  <button
                    type="button"
                    className="button button-primary kds-action-btn kds-btn-ready"
                    disabled={isBusy}
                    onClick={() => void handleCommand(ticket.id, 'ready')}
                  >
                    {isBusy ? 'Đang xử lý…' : 'Hoàn tất ra món (Ready)'}
                  </button>
                )}

                {ticket.status === 'DELAYED' && (
                  <>
                    <button
                      type="button"
                      className="button button-primary kds-action-btn"
                      disabled={isBusy}
                      onClick={() => void handleCommand(ticket.id, 'start')}
                    >
                      Tiếp tục nấu
                    </button>
                    <button
                      type="button"
                      className="button button-primary kds-action-btn kds-btn-ready"
                      disabled={isBusy}
                      onClick={() => void handleCommand(ticket.id, 'ready')}
                    >
                      Hoàn tất ra món (Ready)
                    </button>
                  </>
                )}

                {/* Delay & Reject options */}
                {['NEW', 'ACCEPTED', 'PREPARING', 'DELAYED'].includes(ticket.status) && (
                  <div className="kds-secondary-actions">
                    {['NEW', 'ACCEPTED', 'PREPARING'].includes(ticket.status) && (
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={isBusy}
                        onClick={() => setReasonModal({ ticketId: ticket.id, command: 'delay', title: 'Báo trễ món' })}
                      >
                        Báo trễ
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-secondary kds-btn-danger"
                      disabled={isBusy}
                      onClick={() => setReasonModal({ ticketId: ticket.id, command: 'reject', title: 'Từ chối làm món' })}
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </footer>
            </article>
          );
        })}
      </div>

      {!displayedTickets.length && (
        <div className="empty-state">
          <strong>Không có vé trạm nào</strong>
          <span>Các order được gửi sẽ xuất hiện tức thì tại đây.</span>
        </div>
      )}

      {/* Modal nhập lý do trễ hoặc từ chối */}
      {reasonModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>{reasonModal.title}</h3>
            <p>Vui lòng ghi rõ lý do để tạo tín hiệu nghiệp vụ đến Server và Quản lý.</p>
            <label className="input-field">
              <span>Lý do</span>
              <input
                autoFocus
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder={reasonModal.command === 'delay' ? 'Ví dụ: Hết gas, đông khách đột xuất' : 'Ví dụ: Hết nguyên liệu tươi'}
                maxLength={200}
              />
            </label>
            <div className="button-row">
              <button
                type="button"
                className="button button-primary"
                disabled={!reasonInput.trim() || Boolean(busyId)}
                onClick={() => void handleCommand(reasonModal.ticketId, reasonModal.command, reasonInput)}
              >
                Xác nhận
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setReasonModal(null);
                  setReasonInput('');
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
