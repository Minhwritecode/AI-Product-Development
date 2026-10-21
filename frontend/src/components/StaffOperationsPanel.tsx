import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/client';
import type { OperationalTask, StaffProfile, StaffWorkspace, StationAssignment } from '../lib/api';

type Props = { token: string; branchId: string; onNotice: (message: string) => void; onError: (message: string) => void };

type TaskCommand = 'claim' | 'route' | 'resolve' | 'escalate' | 'handover';

function formatTime(value: string) { return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

function roleLabel(role: string) { return ({ HOST: 'Host', SERVER: 'Server', KITCHEN: 'Kitchen', BAR: 'Bar', CASHIER: 'Cashier', MANAGER: 'Manager' }[role] ?? role); }

function TaskActions({ task, staff, stationAssignments, busy, activeCommand, onOpenCommand, onCommand }: { task: OperationalTask; staff: StaffProfile[]; stationAssignments: StationAssignment[]; busy: boolean; activeCommand: TaskCommand | null; onOpenCommand: (command: TaskCommand | null) => void; onCommand: (command: TaskCommand, body?: { note?: string; ownerId?: string; stationCode?: string }) => void }) {
  const [note, setNote] = useState('');
  const [ownerId, setOwnerId] = useState(staff.find((member) => member.id !== task.ownerId && member.status === 'ACTIVE')?.id ?? '');
  const [stationCode, setStationCode] = useState(task.stationCode ?? '');
  const eligibleStaff = staff.filter((member) => member.status === 'ACTIVE' && (!task.requiredRole || member.roleCodes.includes(task.requiredRole)));
  const eligibleStations = stationAssignments.filter((assignment) => assignment.staffId === ownerId && assignment.status === 'ACTIVE');

  if (task.status === 'RESOLVED' || task.status === 'CANCELLED') return <span className="state-text">Đã đóng</span>;

  const submit = (event: FormEvent) => { event.preventDefault();

 if (!note.trim() || (activeCommand === 'handover' && (!ownerId || !stationCode))) return; onCommand(activeCommand ?? 'resolve', { note: note.trim(), ownerId: activeCommand === 'handover' ? ownerId : undefined, stationCode: activeCommand === 'handover' ? stationCode : undefined }); setNote(''); onOpenCommand(null); };

  return <div className="task-actions">
    <div className="task-action-buttons"><button className="text-button" disabled={busy} onClick={() => onCommand(task.status === 'OPEN' || task.status === 'ESCALATED' ? 'claim' : 'route')}>{task.status === 'OPEN' || task.status === 'ESCALATED' ? 'Nhận việc' : 'Đang xử lý'}</button><button className="text-button" disabled={busy} onClick={() => onOpenCommand(activeCommand === 'handover' ? null : 'handover')}>Bàn giao</button><button className="text-button" disabled={busy} onClick={() => onOpenCommand(activeCommand === 'resolve' ? null : 'resolve')}>Hoàn tất</button></div>
    {activeCommand && <form className="task-command-form" onSubmit={submit} aria-label={activeCommand === 'handover' ? 'Bàn giao task' : 'Hoàn tất task'}>{activeCommand === 'handover' && <><label>Người nhận<select value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setStationCode(''); }} required><option value="">Chọn người nhận</option>{eligibleStaff.map((member) => <option key={member.id} value={member.id}>{member.displayName} · {member.roleCodes.map(roleLabel).join(', ')}</option>)}</select></label><label>Station bàn giao<select value={stationCode} onChange={(event) => setStationCode(event.target.value)} required><option value="">Chọn station</option>{eligibleStations.map((assignment) => <option key={assignment.id} value={assignment.stationCode}>{assignment.stationCode}</option>)}</select></label></>}<label>{activeCommand === 'handover' ? 'Lý do bàn giao' : 'Ghi chú hoàn tất'}<input value={note} onChange={(event) => setNote(event.target.value)} placeholder={activeCommand === 'handover' ? 'Ví dụ: chuyển sang ca floor' : 'Mô tả kết quả đã xử lý'} required maxLength={500} /></label><div className="task-command-actions"><button className="text-button" type="button" onClick={() => onOpenCommand(null)}>Hủy</button><button className="button button-primary" type="submit" disabled={busy || !note.trim() || (activeCommand === 'handover' && (!ownerId || !stationCode))}>Xác nhận</button></div></form>}
  </div>;
}

export function StaffOperationsPanel({ token, branchId, onNotice, onError }: Props) {
  const [workspace, setWorkspace] = useState<StaffWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [activeCommand, setActiveCommand] = useState<{ taskId: string; command: TaskCommand } | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('SERVER');
  const [staffStation, setStaffStation] = useState('FLOOR');
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [shiftLabel, setShiftLabel] = useState('');
  const [shiftStartsAt, setShiftStartsAt] = useState('2026-10-21T07:00');
  const [shiftEndsAt, setShiftEndsAt] = useState('2026-10-21T15:00');

  async function load() { setLoading(true);

 try { setWorkspace(await api.operationsWorkspace(token, branchId)); } catch (error) { onError(error instanceof Error ? error.message : 'Không tải được workspace nhân sự.'); } finally { setLoading(false); } }

  useEffect(() => { void load(); }, [token, branchId]);
  const openTasks = useMemo(() => workspace?.tasks.filter((task) => task.status !== 'RESOLVED' && task.status !== 'CANCELLED') ?? [], [workspace]);
  const escalated = openTasks.filter((task) => task.status === 'ESCALATED').length;

  async function commandTask(task: OperationalTask, command: TaskCommand, body: { note?: string; ownerId?: string; stationCode?: string } = {}) { setBusyTask(task.id);

 try { await api.commandTask(token, task.id, command, body); await load(); onNotice(command === 'handover' ? 'Task đã được bàn giao và tạo notification event.' : command === 'resolve' ? 'Task đã được ghi nhận hoàn tất.' : 'Task đã cập nhật trạng thái.'); } catch (error) { onError(error instanceof Error ? error.message : 'Không thể cập nhật task.'); } finally { setBusyTask(null); } }

  async function createTask(event: FormEvent) { event.preventDefault();

 if (!taskTitle.trim()) return;

 try { await api.createTask(token, { branchId, title: taskTitle.trim(), sourceType: 'MANUAL', priority: 'NORMAL' }); setTaskTitle(''); setShowTaskForm(false); await load(); onNotice('Task thủ công đã được tạo.'); } catch (error) { onError(error instanceof Error ? error.message : 'Không thể tạo task.'); } }

  async function createStaff(event: FormEvent) { event.preventDefault();

    if (!staffName.trim() || !staffEmail.trim()) return;

    try { await api.createStaff(token, { branchId, displayName: staffName.trim(), email: staffEmail.trim(), roleCodes: [staffRole], stationAssignments: [{ roleCode: staffRole, stationCode: staffStation.trim() }] }); setStaffName(''); setStaffEmail(''); setShowStaffForm(false); await load(); onNotice('Nhân sự và station assignment đã được tạo.'); } catch (error) { onError(error instanceof Error ? error.message : 'Không thể tạo staff profile.'); }
  }

  async function createShift(event: FormEvent) { event.preventDefault();

    if (!shiftLabel.trim()) return;

    try { await api.createShift(token, { branchId, label: shiftLabel.trim(), startsAt: new Date(shiftStartsAt).toISOString(), endsAt: new Date(shiftEndsAt).toISOString() }); setShiftLabel(''); setShowShiftForm(false); await load(); onNotice('Shift đã được tạo với policy chống overlap.'); } catch (error) { onError(error instanceof Error ? error.message : 'Không thể tạo shift.'); }
  }

  if (loading) return <section className="workspace-loading" aria-live="polite"><span className="spinner" />Đang tải people & shifts…</section>;

  if (!workspace) return <section className="empty-state"><strong>Chưa có workspace nhân sự</strong><span>Kiểm tra branch scope hoặc thử tải lại.</span></section>;

  return <section className="operations-view" aria-labelledby="people-title">
    <div className="view-header"><div><span className="micro-label">WEEK 03 · STAFF CONTROL</span><h1 id="people-title">People & shifts</h1><p>Phân công đúng vai trò, station và owner để task không rơi giữa FOH và BOH.</p></div><div className="button-row"><button className="button button-secondary" onClick={() => setShowStaffForm((value) => !value)}>Thêm nhân sự</button><button className="button button-secondary" onClick={() => setShowShiftForm((value) => !value)}>Tạo ca</button><button className="button button-primary" onClick={() => setShowTaskForm((value) => !value)}>Tạo task thủ công</button></div></div>
    {showStaffForm && <form className="inline-form panel" onSubmit={createStaff}><label>Họ tên<input autoFocus value={staffName} onChange={(event) => setStaffName(event.target.value)} required minLength={2} /></label><label>Email<input type="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} required /></label><label>Role<select value={staffRole} onChange={(event) => setStaffRole(event.target.value)}><option>HOST</option><option>SERVER</option><option>KITCHEN</option><option>BAR</option><option>CASHIER</option></select></label><label>Station<input value={staffStation} onChange={(event) => setStaffStation(event.target.value)} required /></label><button className="button button-primary">Lưu staff + station</button></form>}
    {showShiftForm && <form className="inline-form panel" onSubmit={createShift}><label>Tên ca<input value={shiftLabel} onChange={(event) => setShiftLabel(event.target.value)} placeholder="Ví dụ: Dinner FOH" required /></label><label>Bắt đầu<input type="datetime-local" value={shiftStartsAt} onChange={(event) => setShiftStartsAt(event.target.value)} required /></label><label>Kết thúc<input type="datetime-local" value={shiftEndsAt} onChange={(event) => setShiftEndsAt(event.target.value)} required /></label><button className="button button-primary">Lưu shift</button></form>}
    {showTaskForm && <form className="inline-form panel" onSubmit={createTask}><label>Tên task<input autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Ví dụ: kiểm tra khu vực chờ" required /></label><button className="button button-primary">Tạo task</button></form>}
    <div className="operations-metrics"><div className="ops-stat"><span>Nhân sự active</span><strong>{workspace.staff.filter((staff) => staff.status === 'ACTIVE').length}</strong><small>Trong branch hiện tại</small></div><div className="ops-stat"><span>Ca đang mở</span><strong>{workspace.shifts.filter((shift) => shift.status === 'OPEN').length}</strong><small>{workspace.shifts[0] ? `${workspace.shifts[0].label} · ${formatTime(workspace.shifts[0].startsAt)}` : 'Chưa có ca'}</small></div><div className="ops-stat"><span>Task đang mở</span><strong>{openTasks.length}</strong><small>Owner và deadline cần rõ</small></div><div className={`ops-stat ${escalated > 0 ? 'ops-stat-alert' : ''}`}><span>Escalated</span><strong>{escalated}</strong><small>{escalated ? 'Cần handover ngay' : 'Không có task quá hạn'}</small></div></div>
    <div className="workspace-grid"><section className="panel data-panel"><div className="section-heading"><div><span className="micro-label">STAFF ROSTER</span><h2>Đội ngũ theo station</h2></div><span className="data-count">{workspace.staff.length} người</span></div><div className="staff-list">{workspace.staff.map((staff) => <article className="staff-row" key={staff.id}><div className="staff-avatar">{staff.displayName.split(' ').map((part) => part[0]).slice(-2).join('')}</div><div className="staff-main"><strong>{staff.displayName}</strong><span>{staff.email}</span></div><div className="staff-tags">{staff.roleCodes.map((role) => <span className="tag tag-role" key={role}>{roleLabel(role)}</span>)}{workspace.stationAssignments.filter((assignment) => assignment.staffId === staff.id && assignment.status === 'ACTIVE').map((assignment) => <span className="tag" key={assignment.id}>{assignment.stationCode.replace('_', ' ')}</span>)}</div><span className="availability"><i />{staff.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></article>)}</div></section><section className="panel data-panel"><div className="section-heading"><div><span className="micro-label">SHIFT COVERAGE</span><h2>Ca & assignment</h2></div><span className="data-count">{workspace.shifts.length} ca</span></div>{workspace.shifts.map((shift) => <article className="shift-card" key={shift.id}><div className="shift-line"><div><strong>{shift.label}</strong><span>{formatTime(shift.startsAt)} — {formatTime(shift.endsAt)}</span></div><span className={`status-badge status-${shift.status.toLowerCase()}`}>{shift.status}</span></div><div className="assignment-list">{shift.assignments.map((assignment) => <div className="assignment-row" key={assignment.id}><span>{roleLabel(assignment.roleCode)}</span><strong>{workspace.staff.find((staff) => staff.id === assignment.staffId)?.displayName ?? assignment.staffId}</strong><small>{assignment.stationCode ?? 'General'} · {assignment.status}</small></div>)}</div></article>)}</section></div>
    <section className="panel data-panel task-panel"><div className="section-heading"><div><span className="micro-label">TASK INBOX · {openTasks.length} OPEN</span><h2>Operational handover</h2></div><span className="live-status"><i />Live state</span></div><div className="task-list" aria-live="polite">{workspace.tasks.map((task) => <article className={`task-row task-${task.priority.toLowerCase()}`} key={task.id}><div className="task-priority" aria-label={`Priority ${task.priority}`}><span>{task.priority}</span></div><div className="task-copy"><strong>{task.title}</strong><span>{task.sourceType.replace('_', ' ')}{task.stationCode ? ` · ${task.stationCode}` : ''}{task.dueAt ? ` · Due ${formatTime(task.dueAt)}` : ''}{task.ownerId ? ` · Owner ${workspace.staff.find((staff) => staff.id === task.ownerId)?.displayName ?? task.ownerId}` : ''}</span></div><span className={`status-badge status-${task.status.toLowerCase()}`}>{task.status.replace('_', ' ')}</span><TaskActions task={task} staff={workspace.staff} stationAssignments={workspace.stationAssignments} busy={busyTask === task.id} activeCommand={activeCommand?.taskId === task.id ? activeCommand.command : null} onOpenCommand={(command) => setActiveCommand(command ? { taskId: task.id, command } : null)} onCommand={(command, body) => void commandTask(task, command, body)} /></article>)}{workspace.tasks.length === 0 && <div className="empty-state"><strong>Inbox đang trống</strong><span>Không có task cần handover trong branch này.</span></div>}</div></section>
  </section>;
}
