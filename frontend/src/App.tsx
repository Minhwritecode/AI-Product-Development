import { useEffect, useState } from 'react';

type Health = { status: string; service?: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';

  useEffect(() => {
    fetch(`${apiBase.replace(/\/api$/, '')}/health`)
      .then((response) => {
        // SAFETY: The backend health endpoint is owned by this repository and returns the Health shape.
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch(() => setHealth({ status: 'offline' }));
  }, [apiBase]);

  return (
    <main className="shell">
      <nav className="topbar">
        <span className="brand">Luminex</span>
        <span className="tag">FOH → BOH operations</span>
      </nav>
      <section className="hero">
        <p className="eyebrow">Product foundation · MVP</p>
        <h1>Inventory rõ ràng. Vận hành liền mạch.</h1>
        <p className="lede">
          Skeleton giao diện cho hệ thống kết nối trải nghiệm FOH với tồn kho, mua hàng, hao hụt và dữ liệu vận hành nhà hàng.
        </p>
        <div className="status-card">
          <span className={`dot ${health?.status === 'ok' ? 'online' : ''}`} />
          Backend {health?.status === 'ok' ? 'đang kết nối' : health?.status === 'offline' ? 'chưa kết nối' : 'đang kiểm tra'}
        </div>
      </section>
      <section className="modules" aria-label="MVP modules">
        {[
          'Front-door QR',
          'Table QR + Add-on',
          'Master Data',
          'Purchase Order',
          'Goods Receipt',
          'Branch Stock',
          'Daily Count',
          'Dashboard + AI'
        ].map((module) => (
          <article key={module} className="module-card">
            <span className="module-index">MVP</span>
            <h2>{module}</h2>
            <p>Được đặc tả trong product requirements và feature specifications.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
