---
name: Modern F&B Operating System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#404944'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#707974'
  outline-variant: '#bfc9c3'
  surface-tint: '#2b6954'
  primary: '#003527'
  on-primary: '#ffffff'
  primary-container: '#064e3b'
  on-primary-container: '#80bea6'
  inverse-primary: '#95d3ba'
  secondary: '#904d00'
  on-secondary: '#ffffff'
  secondary-container: '#fe932c'
  on-secondary-container: '#663500'
  tertiary: '#00314e'
  on-tertiary: '#ffffff'
  tertiary-container: '#004870'
  on-tertiary-container: '#5db9ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b0f0d6'
  primary-fixed-dim: '#95d3ba'
  on-primary-fixed: '#002117'
  on-primary-fixed-variant: '#0b513d'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-numeric:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
  label-ui:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-mobile: 0.75rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style
This design system establishes a high-precision, hospitality-grade operational environment designed for multi-unit food and beverage enterprises. The aesthetic blends the authoritative utility of modern enterprise SaaS with the tactile elegance of premium hospitality. It avoids generic tech-sterile conventions, introducing an atmosphere that feels disciplined, organic, and clean—bridging front-of-house (FOH) guest-facing tablet experiences and back-of-house (BOH) high-density kitchen/management displays.

Visual attributes rely on:
- **Calm, High-Precision Contrast**: Purpose-driven contrast ensures instant readability under intense kitchen lighting or dim dining room ambiences.
- **Architectural Clarity**: Modular, grid-focused content blocks prevent visual noise during peak rush periods.
- **Micro-tactile Feedback**: Interactive states mimic physical buttons and status switches to minimize input errors in rapid-touch operational environments.

## Colors
The palette balances natural culinary vitality with operational clarity:
- **Primary (`#064E3B`) - Deep Emerald**: Represents operational hygiene, fresh ingredients, and institutional stability. Used for primary navigation, critical confirmative actions, active floor plan selections, and system branding.
- **Secondary (`#D97706`) - Golden Amber**: Encapsulates hospitality warmth, kitchen ticket prioritization, order alerts, active table timers, and actionable state flags.
- **Tertiary (`#0284C7`) - Clear Cyan/Blue**: Dedicated to logistics, digital delivery integration statuses (Grab, ShopeeFood), and audit log references.
- **Neutral (`#0F172A`) - Deep Slate**: Provides crisp, high-legibility typographic hierarchy without the harshness of pure black. Paired with background surface tones `#F8FAFC` (Canvas), `#FFFFFF` (Card base), and `#F1F5F9` (Subtle boundary shading).
- **Status Semantics**: Success (`#16A34A`), Urgent Warning / Alert (`#DC2626`), In-Prep (`#D97706`), Completed / Settled (`#064E3B`).

## Typography
Typographic rules prioritize immediate legibility across varied distances—from arm's length hand-held POS terminals to elevated Kitchen Display Systems (KDS). 
- **Plus Jakarta Sans** provides geometric rhythm with humanized terminals, maintaining clarity across dense revenue grids and table configurations.
- **JetBrains Mono** is deployed for numeric order codes, SKU tracking, currency displays (VND/USD), kitchen elapsed timers, and batch inventory figures to ensure strict vertical tabular alignment without numerical jitter.
- Mobile downscaling preserves strict spatial budgets without clipping modifiers or dish special instructions.

## Layout & Spacing
The layout model employs an adaptive 12-column system for desktop administration, converting to a modular flex-grid for POS and Kitchen Displays, and a single/dual-column pane layout for mobile terminals.

- **Desktop (≥1280px)**: 12-column grid, 24px gutters, and 32px canvas margins. Multi-column operations permit dual sidebars: global navigation on the left, real-time ticket activity rails on the right.
- **Tablet / POS Display (768px – 1279px)**: 8-column layout with 16px gutters. Optimized for split screens (60% order catalog/table matrix, 40% active cart receipt).
- **Mobile Handheld (≤767px)**: 4-column layout with 12px gutters and margins. All interactive touch points enforce a minimum tap clearance bounding box of 44x44px to prevent miss-taps during service surges.

## Elevation & Depth
Depth in this design system is created through tonal layering accented by low-opacity, emerald-tinted ambient shadows. Avoid heavy dropshadows that generate visual clutter on multi-ticket displays.

- **Level 0 (Canvas Base)**: `#F8FAFC` flat surface.
- **Level 1 (Card & Module Layer)**: Pure `#FFFFFF` surfaces bounded by a hairline border `1px solid rgba(15, 23, 42, 0.08)`. Subtle ambient shadow: `0 1px 3px 0 rgba(6, 78, 59, 0.04), 0 1px 2px -1px rgba(6, 78, 59, 0.02)`.
- **Level 2 (Popovers, Overlays, Active Drag Tables)**: Lifted surface elevated by `0 8px 16px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(6, 78, 59, 0.03)` with a slightly crisp border `1px solid rgba(15, 23, 42, 0.12)`.
- **Level 3 (Modal Alerts, Kitchen Urgent Drawers)**: High-priority focus layer with shadow `0 20px 25px -5px rgba(15, 23, 42, 0.14), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`.
- **Active State Highlights**: Kitchen urgent and table warning cards use an inset ambient amber glow rather than standard blur shadows: `box-shadow: inset 0 0 0 1.5px #D97706, 0 4px 12px rgba(217, 119, 6, 0.12)`.

## Shapes
A unified roundedness level of `2` (8px base radius) is maintained. This geometry balances soft modern hospitality feel with the structured space-saving needs of dense administrative charts:
- **Standard Controls & Buttons**: `0.5rem` (8px).
- **Cards, Kitchen Tickets & Containers (`rounded-lg`)**: `1rem` (16px).
- **Modals, Sheets, and Drawer Headers (`rounded-xl`)**: `1.5rem` (24px).
- **Status Pills, Table Count Badges & Micro Chips**: Full pill shape (`9999px`) to immediately separate metadata tags from actionable rectangular inputs.

## Components

- **Buttons**:
  - *Primary*: Deep Emerald (`#064E3B`) fill, pure white text, 8px radius, height 44px (touch standard) or 36px (dense desktop tables). Hover state shifts to `#022C22`.
  - *Secondary / Hospitality Accent*: Amber surface tint (`#FEF3C7`) with text and icon in `#B45309`.
  - *Outlined*: 1px border `rgba(15, 23, 42, 0.16)`, transparent background, hover brings subtle `#F1F5F9` wash.
  - *Kitchen Actions*: Specialized double-tap/long-press buttons prevent accidental ticket dismissals.

- **Chips & Status Tags**:
  - Height 24px (desktop) / 28px (touch). 
  - Kitchen Status: "Chờ chế biến" (`#FEF3C7` bg, `#92400E` text), "Đang nấu" (`#E0F2FE` bg, `#0369A1` text), "Sẵn sàng phục vụ" (`#D1FAE5` bg, `#065F46` text).
  - Code/Table Pills: JetBrains Mono text, uppercase, `rounded-full`, paired with a 6px status dot.

- **Input Fields**:
  - Surface white (`#FFFFFF`), border 1px solid `#CBD5E1`.
  - Focus state: Outline replaced with clean 2px `#064E3B` border and subtle outer ring `rgba(6, 78, 59, 0.12)`.
  - Touch target height: 48px on handheld devices, 38px on desktop data grids.

- **Cards & Kitchen Tickets**:
  - Modular cards with high-contrast headers. 
  - KDS Order Card: Clear dividing line separating order header (Table number in display text, JetBrains Mono elapsed timer) from itemized modifier rows. Modifiers receive indented bullet marks and bold count indicators.

- **Lists & Data Tables**:
  - High-density zebra lines or subtle border dividers (`#F1F5F9`).
  - Row height: 44px minimum for desktop inventory tables, 56px for mobile/tablet order list lines.
  - Numeric alignment: Currency and inventory counts right-aligned using `JetBrains Mono`.

- **Table Map Elements (FOH Floor Management)**:
  - Tables represented as geometric modules with corner occupancy badges.
  - Empty: `#FFFFFF` with `#CBD5E1` dash border.
  - Occupied: `#ECFDF5` background with `#064E3B` structural outline.
  - Bill Printed / Awaiting Settlement: Amber pulse indicator (`#D97706`).