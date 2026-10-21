import { type CSSProperties } from 'react';

export interface LuminexLogoProps {
  size?: number;
  variant?: 'mark' | 'horizontal' | 'lockup';
  showSubtitle?: boolean;
  subtitle?: string;
  className?: string;
  style?: CSSProperties;
}

export function LuminexMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`luminex-mark-svg ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Back-of-House (BOH) Vertical Pillar: Precision Cyan/Teal */}
        <linearGradient id="lx-boh" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="55%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>

        {/* Front-of-House (FOH) Horizontal Cloche Arch: Warm Amber / Hospitality Gold */}
        <linearGradient id="lx-foh" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="60%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#fef08a" />
        </linearGradient>

        {/* Nexus Luminary Glow */}
        <radialGradient id="lx-spark" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#99f6e4" />
          <stop offset="80%" stopColor="#2dd4bf" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </radialGradient>

        <filter id="lx-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Ambient background glow */}
      <circle cx="21" cy="29" r="11" fill="url(#lx-spark)" opacity="0.35" className="luminex-ambient-spark" />

      {/* Back-of-House (BOH) Pillar: Ledger, Inventory, Kitchen Foundation */}
      <path
        d="M14 9 C14 7.6 15.1 6.5 16.5 6.5 L21.5 6.5 C22.9 6.5 24 7.6 24 9 L24 28 C24 29.7 22.7 31 21 31 L16.5 31 C15.1 31 14 29.9 14 28.5 Z"
        fill="url(#lx-boh)"
      />

      {/* Front-of-House (FOH) Dining Dome: Hospitality, Seating, Guest Flow */}
      <path
        d="M16 30 C16 26.5 19 23.5 22.5 23.5 L35.5 23.5 C38.5 23.5 41 26 41 29 C41 34.5 36.5 39 31 39 L19 39 C17.3 39 16 37.7 16 36 Z"
        fill="url(#lx-foh)"
      />

      {/* Nexus Convergence Point */}
      <path
        d="M14 26 L24 26 L24 37 C24 38.1 23.1 39 22 39 L16.5 39 C15.1 39 14 37.9 14 36.5 Z"
        fill="#0f766e"
        opacity="0.95"
      />

      {/* The Luminary Spark: Synchronizing FOH & BOH */}
      <g filter="url(#lx-glow)" className="luminex-spark-star">
        <path d="M21 21 Q21 29 29 29 Q21 29 21 37 Q21 29 13 29 Q21 29 21 21 Z" fill="#ffffff" />
        <circle cx="21" cy="29" r="1.4" fill="#fef08a" />
      </g>

      {/* Service accent bell / cloche touch */}
      <circle cx="38" cy="26" r="1.8" fill="#fef08a" className="luminex-cloche-accent" />
    </svg>
  );
}

export function LuminexLogo({
  size = 36,
  variant = 'lockup',
  showSubtitle = true,
  subtitle = 'Operations OS',
  className = '',
  style
}: LuminexLogoProps) {
  if (variant === 'mark') {
    return (
      <span className={`luminex-logo-badge ${className}`} style={{ width: size, height: size, ...style }} role="img" aria-label="Luminex logo">
        <LuminexMark size={size} />
      </span>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`luminex-logo-horizontal ${className}`} style={style} role="img" aria-label="Luminex Restaurant Operations OS">
        <span className="luminex-logo-badge" style={{ width: size, height: size }}>
          <LuminexMark size={size} />
        </span>
        <span className="luminex-brand-name">
          Lumin<span className="luminex-accent-e">e</span>x
        </span>
      </div>
    );
  }

  // Default 'lockup'
  return (
    <div className={`luminex-brand-lockup ${className}`} style={style} role="img" aria-label="Luminex Restaurant Operations OS">
      <span className="luminex-logo-badge" style={{ width: size, height: size }}>
        <LuminexMark size={size} />
      </span>
      <div className="luminex-text-group">
        <strong className="luminex-brand-title">
          Lumin<span className="luminex-accent-e">e</span>x
        </strong>
        {showSubtitle && <small className="luminex-brand-subtitle">{subtitle}</small>}
      </div>
    </div>
  );
}
