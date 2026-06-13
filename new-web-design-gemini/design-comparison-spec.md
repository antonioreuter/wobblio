# Layout and Sizing Specification: Invoice Comparator vs. Wobblio

This document provides a detailed comparative analysis between the design system, layout structures, and visual spacing guidelines of the **Invoice Comparator** and the current **Wobblio** web application.

> [!IMPORTANT]
> **Design Decision**: Wobblio's current **Sidebar Navigation Rail** (80px) and **Header/TopBar** layouts will be preserved. Visual updates and layout alignments will focus entirely on content cards, inner page layouts, typography, border-radii, and internal workspace spacing.

---

## 📐 Workspace Content Layout Comparison

| Layout Element | Invoice Comparator Design | Wobblio Current Design |
| :--- | :--- | :--- |
| **Workspace Shell** | Flexbox-based (`.main-content`) with fluid workspace container and local scrollbars. | Flexbox-based (`.app-workspace-body`) with main page content wrapper (`.app-workspace-content`). |
| **Base Grid Rhythm** | **8px base grid** governed by 4px increments. | Standard Tailwind spacing scale. |
| **Workspace Paddings** | Card/container internal padding: **24px**. Desktop outer margins: **32px**. Mobile outer margins: **16px**. | Card internal padding: **24px**. Page content padding: **24px** (desktop) scaling down to **80px** bottom padding on mobile. |
| **Workspace Grid Gap** | Grid gap of **24px** or **28px** between cards. | Grid gap of **28px** between metric cards. |
| **Table Layouts** | Borderless rows with 1px dividers, header cells using muted `#64748B` text in small label styles. | Borderless rows with 1px dividers. Header cells use `var(--glass-border)` boundaries. |

---

## 🎨 Color Palette & Themes

The two projects use different surface strategies and accent systems:

### 1. Invoice Comparator Themes
- **Light Theme (Default)**:
  - Background: `#f8fafc` (Slate Light Canvas)
  - Secondary/Cards: `#ffffff`
  - Border Color: `#e2e8f0`
  - Primary Accent: `#3b82f6` (Soft Blue)
  - Text: `#1e293b` (Primary), `#475569` (Secondary), `#64748b` (Muted)
- **Dark Theme**:
  - Background: `#0b0f19` (Deep Obsidian Blue)
  - Secondary/Cards: `#131b2e` (Obsidian glass)
  - Border Color: `rgba(255, 255, 255, 0.08)`
  - Primary Accent: `#14b8a6` (Teal)
  - Text: `#f8fafc` (Primary), `#cbd5e1` (Secondary)

### 2. Wobblio Themes
- **Light Theme**:
  - Background: `#f1f5f9` (Solar Slate)
  - Surface: `rgba(255, 255, 255, 0.75)` (Light Glass)
  - Primary Accent: `#0d9488` (Teal)
  - Text: `#0f172a` (Primary), `#64748b` (Muted)
- **Dark Theme**:
  - Background: `#090c15` (Deep Space / Obsidian)
  - Surface: `rgba(17, 22, 39, 0.72)` (Obsidian Glass with background Aurora Blobs)
  - Primary Accent: `#6366f1` (Electric Indigo) or `#0d9488` (Aurora Teal)
  - Text: `#f8fafc` (Primary), `#94a3b8` (Muted)

---

## 🔠 Typography & Sizing

Both systems leverage **Inter** (for body and UI metadata) and **Outfit** (for headers and numeric displays) but utilize different typography scales:

```
Invoice Comparator Typography:
├── Display Large: 48px (Line Height: 60px) - Bold (700)
├── Headline Large: 32px (Line Height: 40px) - Bold (700)
├── Headline Medium: 24px (Line Height: 32px) - Semibold (600)
├── Headline Small: 20px (Line Height: 28px) - Semibold (600)
├── Body Large: 18px (Line Height: 28px) - Regular (400)
├── Body Medium: 16px (Line Height: 24px) - Regular (400)
└── Labels: 12px/14px (Line Height: 16px/20px) - Semibold (600)

Wobblio Typography:
├── Display: 30px (Line Height: 36px) - Outfit Display Font
├── H1 / Headline: 24px (Line Height: 32px) - Bold
├── H2: 20px (Line Height: 28px) - Semibold
├── Body: 16px (Line Height: 24px) - Regular
├── Secondary: 14px (Line Height: 20px) - Medium
└── Caption: 12px (Line Height: 16px) - Regular
```

> [!NOTE]
> The Invoice Comparator uses a much larger typographical display scale (48px for display size, compared to Wobblio's 30px) which gives it a more spacious, premium look for key metrics and headlines.

---

## 🧱 Shape Language & Border Radii

- **Invoice Comparator**:
  - Cards, Modals & Primary Buttons: `rounded-xl` / `--radius-lg` (**16px** in CSS, **12px** in spec)
  - Inputs & Secondary Buttons: `rounded-md` / `--radius-md` (**10px** in CSS, **8px** in spec)
  - Badges & Chips: `rounded-sm` / `--radius-sm` (**6px** in CSS)
- **Wobblio**:
  - Cards & Panels: `--radius-card` (**12px**)
  - Buttons: `--radius-btn` (**8px**)
  - Chips & Badges: `--radius-chip` (**9999px** - pill style)

---

## 💡 Key Design & Layout Recommendations for Wobblio Update

> [!TIP]
> Since the sidebar and header are remaining unchanged, visual consistency can be enhanced inside the main content canvas by adopting the following updates:

1. **Card Visual Polish**: Increase Wobblio card border-radii from **12px** to **16px** (`rounded-xl` equivalent) and add the subtle ambient shadow styling (`0 1px 2px 0 rgba(15, 23, 42, 0.05)`) to improve depth.
2. **Typography Scaling**: Increase key dashboard display headers and numeric metrics values to **48px** using the **Outfit** typography.
3. **Form Fields Alignment**: Soften input fields and secondary buttons by increasing the rounding from **8px** to **10px** to match the mid-level shape language.
4. **Data Grid Layout**: Update tables and grids to feature borderless rows with 1px light separators and style header cells with muted text in small label font sizes.
