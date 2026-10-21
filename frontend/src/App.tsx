import { FormEvent, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { MasterDataPanel } from './components/MasterDataPanel';
import { StaffOperationsPanel } from './components/StaffOperationsPanel';
import { createApiClient, type Area, type Branch, type RestaurantTable, type SetupOverview } from './lib/api';

const api = createApiClient(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api');

const sessionStorageKey = 'luminex.session';

type View = 'setup' | 'people' | 'master';

const ThreeScene = lazy(() => import('./components/OperationsScene').then((module) => ({ default: module.OperationsScene })));

function OperationsScene() {
  return <Suspense fallback={<div className="scene-fallback" aria-hidden="true" />}><ThreeScene /></Suspense>;
}

function Icon({ name }: { name: 'grid' | 'layers' | 'box' | 'chart' | 'plus' | 'logout' | 'arrow' | 'check' | 'alert' }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    box: <><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" /><path d="m4 7 8 4 8-4M12 11v10" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-7" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5M12 17h.01" /></>
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true" className="icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Login({ onLogin }: { onLogin: (token: string, overview: SetupOverview) => void }) {
  const [email, setEmail] = useState('admin@luminex.local'); const [password, setPassword] = useState('luminex-demo'); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError('');

 try { const session = await api.login(email, password); const overview = await api.overview(session.token); localStorage.setItem(sessionStorageKey, JSON.stringify(session)); onLogin(session.token, overview); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể đăng nhập.'); } finally { setLoading(false); } }

  return <main className="auth-page"><div className="auth-glow" /><section className="auth-card" aria-labelledby="login-title"><div className="brand-mark"><span className="brand-orb">L</span><span>Luminex</span></div><p className="eyebrow">Restaurant operations OS</p><h1 id="login-title">Vận hành rõ ràng,<br /><em>phục vụ tinh tế.</em></h1><p className="auth-copy">Đăng nhập vào command center để cấu hình nhà hàng và kết nối FOH với BOH.</p><form onSubmit={submit} className="login-form"><label>Email vận hành<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required /></label><label>Mật khẩu<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>{error && <p className="form-error" role="alert"><Icon name="alert" />{error}</p>}<button className="button button-primary button-wide" disabled={loading}>{loading ? 'Đang xác thực…' : 'Vào command center'} <Icon name="arrow" /></button></form>{import.meta.env.DEV && <p className="demo-hint">Local fixture · admin@luminex.local / luminex-demo</p>}</section></main>;
}

function MetricCard({ label, value, detail, tone = 'neutral', icon }: { label: string; value: string | number; detail: string; tone?: string; icon: 'grid' | 'layers' | 'box' | 'chart' }) { return <article className={`metric-card ${tone}`}><div className="metric-icon"><Icon name={icon} /></div><div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div></article>; }

function TableChip({ table }: { table: RestaurantTable }) { return <span className={`table-chip table-${table.status.toLowerCase()}`} title={`${table.label} · ${table.capacity} chỗ`}><span>{table.label}</span><small>{table.capacity}p</small></span>; }

function AreaCard({ area, onAddTable }: { area: Area; onAddTable: (area: Area) => void }) { const ready = area.tables.filter((table) => table.status === 'READY').length;

 return <article className="area-card"><div className="area-heading"><div><span className="micro-label">KHU VỰC {String(area.sortOrder).padStart(2, '0')}</span><h3>{area.name}</h3></div><button className="icon-button" onClick={() => onAddTable(area)} aria-label={`Thêm bàn vào ${area.name}`}><Icon name="plus" /></button></div><div className="area-meta"><span><i className="status-dot status-ready" />{ready}/{area.tables.length} bàn sẵn sàng</span><span>{area.tables.reduce((total, table) => total + table.capacity, 0)} chỗ</span></div><div className="table-list">{area.tables.map((table) => <TableChip key={table.id} table={table} />)}{area.tables.length === 0 && <span className="empty-inline">Chưa có bàn · thêm bàn đầu tiên</span>}</div></article>; }

function Sidebar({ view, onView, onLogout }: { view: View; onView: (view: View) => void; onLogout: () => void }) { return <aside className="sidebar"><div className="brand-lockup"><span className="brand-orb">L</span><div><strong>Luminex</strong><small>Operations OS</small></div></div><div className="sidebar-label">Workspace</div><nav className="side-nav" aria-label="Điều hướng chính"><button className={`nav-item ${view === 'setup' ? 'active' : ''}`} onClick={() => onView('setup')}><Icon name="grid" />Command center{view === 'setup' && <span className="nav-active-dot" />}</button><button className={`nav-item ${view === 'people' ? 'active' : ''}`} onClick={() => onView('people')}><Icon name="layers" />People & shifts{view === 'people' && <span className="nav-active-dot" />}</button><button className={`nav-item ${view === 'master' ? 'active' : ''}`} onClick={() => onView('master')}><Icon name="box" />Master data{view === 'master' && <span className="nav-active-dot" />}</button><button className="nav-item" disabled aria-label="Reports — roadmap"><Icon name="chart" />Reports<span className="coming-soon">Roadmap</span></button></nav><div className="sidebar-bottom"><div className="support-card"><span className="support-pulse" /><div><strong>Platform healthy</strong><small>Core services online</small></div></div><button className="nav-item logout" onClick={onLogout}><Icon name="logout" />Đăng xuất</button></div></aside>; }

function ChecklistItem({ done, label, detail, action }: { done: boolean; label: string; detail: string; action?: () => void }) { return <div className="check-item"><span className={`check-icon ${done ? 'done' : ''}`}>{done ? <Icon name="check" /> : <span />}</span><div><strong>{label}</strong><small>{detail}</small></div>{action && !done && <button className="text-button" onClick={action}>Setup <Icon name="arrow" /></button>}</div>; }

function SetupModal({ modal, onClose, onCreateArea, onCreateTable }: { modal: { type: 'area' | 'table'; area?: Area }; onClose: () => void; onCreateArea: (name: string) => Promise<void>; onCreateTable: (area: Area, label: string, capacity: number) => Promise<void> }) {
  const [name, setName] = useState(''); const [capacity, setCapacity] = useState(2); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState(''); const isArea = modal.type === 'area';

  async function submit(event: FormEvent) { event.preventDefault(); setSubmitting(true); setError('');

 try { if (isArea) await onCreateArea(name); else if (modal.area) await onCreateTable(modal.area, name, capacity); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể lưu cấu hình.'); } finally { setSubmitting(false); } }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={onClose} aria-label="Đóng">×</button><span className="micro-label">SETUP ACTION</span><h2 id="modal-title">{isArea ? 'Thêm khu vực mới' : `Thêm bàn vào ${modal.area?.name}`}</h2><p>{isArea ? 'Ví dụ: Main floor, Rooftop hoặc Private room.' : 'Gán bàn vào floor area để FOH quản lý readiness.'}</p><form onSubmit={submit}>{isArea ? <label>Tên khu vực<input autoFocus value={name} onChange={(event) => setName(event.target.value)} required minLength={2} placeholder="Main floor" /></label> : <><label>Nhãn bàn<input autoFocus value={name} onChange={(event) => setName(event.target.value)} required placeholder="T04" /></label><label>Sức chứa<input type="number" min="1" max="30" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} required /></label></>}{error && <p className="form-error" role="alert"><Icon name="alert" />{error}</p>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Hủy</button><button className="button button-primary" disabled={submitting}>{submitting ? 'Đang lưu…' : 'Lưu cấu hình'}<Icon name="arrow" /></button></div></form></section></div>; }

function App() {
  const [token, setToken] = useState<string | null>(null); const [overview, setOverview] = useState<SetupOverview | null>(null); const [selectedBranchId, setSelectedBranchId] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [modal, setModal] = useState<{ type: 'area' | 'table'; area?: Area } | null>(null); const [view, setView] = useState<View>('setup');
  useEffect(() => { const saved = localStorage.getItem(sessionStorageKey);

 if (!saved) { setLoading(false);

 return; }

 try {
   // SAFETY: localStorage is written by this app's login flow; a failed API call removes any stale or malformed value.
   const session = JSON.parse(saved) as { token: string };
   api.overview(session.token).then((data) => { setToken(session.token); setOverview(data); setSelectedBranchId(data.branches[0]?.id ?? ''); }).catch(() => localStorage.removeItem(sessionStorageKey)).finally(() => setLoading(false));
 } catch { localStorage.removeItem(sessionStorageKey); setLoading(false); } }, []);
  const branch = useMemo<Branch | null>(() => overview?.branches.find((candidate) => candidate.id === selectedBranchId) ?? overview?.branches[0] ?? null, [overview, selectedBranchId]); const allTables = branch?.areas.flatMap((area) => area.tables) ?? []; const readyTables = allTables.filter((table) => table.status === 'READY').length; const completion = branch ? Math.round(([branch.name, branch.timezone, branch.areas.length > 0, allTables.length > 0].filter(Boolean).length / 4) * 100) : 0;

  async function refresh(nextToken = token) { if (!nextToken) return; const data = await api.overview(nextToken); setOverview(data); setSelectedBranchId((current) => data.branches.some((item) => item.id === current) ? current : data.branches[0]?.id ?? ''); }

  async function logout() { if (token) await api.logout(token).catch(() => undefined); localStorage.removeItem(sessionStorageKey); setToken(null); setOverview(null); }

  async function createArea(name: string) { if (!token || !branch) return; await api.createArea(token, branch.id, { name }); await refresh(); setModal(null); setNotice(`Đã thêm khu vực “${name}”.`); }

  async function createTable(area: Area, label: string, capacity: number) { if (!token) return; await api.createTable(token, area.id, { label, capacity }); await refresh(); setModal(null); setNotice(`Đã thêm bàn ${label} vào ${area.name}.`); }

  if (loading) return <div className="loading-screen"><span className="spinner" />Đang mở command center…</div>;

 if (!token || !overview) return <Login onLogin={(nextToken, data) => { setToken(nextToken); setOverview(data); setSelectedBranchId(data.branches[0]?.id ?? ''); }} />;

 if (!branch) return <div className="loading-screen">Chưa có branch trong scope hiện tại.</div>;

  return <div className="app-shell"><Sidebar view={view} onView={setView} onLogout={logout} /><main className="main-content"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><Icon name="arrow" /><strong>{view === 'setup' ? 'Setup & access' : view === 'people' ? 'People & shifts' : 'Master data'}</strong></div><div className="topbar-actions"><label className="branch-select"><span>Branch</span><select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)}>{overview.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="avatar" title="Linh Nguyễn">LN</div></div></header>{notice && <div className="notice" role="status"><Icon name="check" />{notice}<button onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button></div>}{error && <div className="notice notice-error" role="alert"><Icon name="alert" />{error}<button onClick={() => setError('')} aria-label="Đóng lỗi">×</button></div>}{view === 'people' ? <StaffOperationsPanel token={token} branchId={branch.id} onNotice={setNotice} onError={setError} /> : view === 'master' ? <MasterDataPanel token={token} branchId={branch.id} onNotice={setNotice} onError={setError} /> : <><section className="hero-panel"><OperationsScene /><div className="hero-copy"><div className="eyebrow"><span className="live-dot" />Platform foundation · Week 01–02</div><h1>Cấu hình vận hành,<br /><em>rõ từng ca.</em></h1><p>Thiết lập nền tảng để FOH phục vụ mượt hơn và BOH kiểm soát dữ liệu chính xác hơn.</p><div className="hero-actions"><button className="button button-primary" onClick={() => document.getElementById('setup-checklist')?.scrollIntoView({ behavior: 'smooth' })}>Tiếp tục setup <Icon name="arrow" /></button><span className="hero-note"><Icon name="check" /> API contract active</span></div></div><div className="hero-aside"><span className="micro-label">SETUP PROGRESS</span><strong>{completion}%</strong><div className="progress-track"><span style={{ width: `${completion}%` }} /></div><small>Platform readiness</small></div></section><section className="metrics-grid" aria-label="Tổng quan vận hành"><MetricCard label="Branches" value={overview.branches.length} detail="Trong workspace" icon="layers" tone="teal" /><MetricCard label="Areas" value={branch.areas.length} detail="Khu vực active" icon="grid" /><MetricCard label="Tables ready" value={`${readyTables}/${allTables.length}`} detail="Sẵn sàng phục vụ" icon="box" tone="gold" /><MetricCard label="Setup status" value={`${completion}%`} detail="Đạt chuẩn nền tảng" icon="chart" tone="coral" /></section><section className="content-grid" id="setup-checklist"><div className="checklist-panel panel"><div className="section-heading"><div><span className="micro-label">NEXT BEST ACTION</span><h2>Setup checklist</h2></div><span className="completion-pill"><Icon name="check" />{completion}% complete</span></div><p className="section-lede">Hoàn thiện dữ liệu nền trước khi bật các luồng FOH và BOH.</p><div className="checklist"><ChecklistItem done label="Restaurant profile" detail={overview.restaurant.name} /><ChecklistItem done label="Branch policy" detail={`${branch.timezone} · ${branch.currency}`} /><ChecklistItem done={Boolean(branch.areas.length)} label="Floor areas" detail={`${branch.areas.length} khu vực đã cấu hình`} action={() => setModal({ type: 'area' })} /><ChecklistItem done={allTables.length > 0} label="Tables & readiness" detail={`${readyTables}/${allTables.length} bàn sẵn sàng`} action={() => branch.areas[0] && setModal({ type: 'table', area: branch.areas[0] })} /></div></div><div className="insight-panel panel"><div className="insight-orb"><OperationsScene /></div><div><span className="micro-label">OPERATIONS PRINCIPLE</span><h2>Một nguồn sự thật<br />cho mỗi quyết định.</h2><p>Branch scope, role và audit được kiểm tra ở backend trước mỗi thay đổi vận hành.</p><span className="insight-tag">Human-approved by design</span></div></div></section><section className="areas-section"><div className="section-heading"><div><span className="micro-label">FLOOR PLAN · {branch.code}</span><h2>Areas & tables</h2></div><button className="button button-secondary" onClick={() => setModal({ type: 'area' })}><Icon name="plus" />Thêm khu vực</button></div><p className="section-lede">Cấu hình bàn là nền tảng cho seating, table QR và readiness của FOH.</p><div className="areas-grid">{branch.areas.map((area) => <AreaCard key={area.id} area={area} onAddTable={(selected) => setModal({ type: 'table', area: selected })} />)}{!branch.areas.length && <div className="empty-state"><Icon name="layers" /><strong>Chưa có khu vực</strong><span>Thêm khu vực đầu tiên để bắt đầu setup floor plan.</span></div>}</div></section></>}{modal && <SetupModal modal={modal} onClose={() => setModal(null)} onCreateArea={createArea} onCreateTable={createTable} />}</main></div>;
}

export default App;
