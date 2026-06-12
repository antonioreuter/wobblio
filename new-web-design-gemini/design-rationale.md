# Wobblio "Obsidian Aurora" Web Design Rationale

This document outlines the core concepts, visual tokens, and architectural styling rules designed for the new Wobblio user experience.

---

## 1. Core Visual Concept: "Obsidian Aurora"

The "Obsidian Aurora" concept departs from generic, flat SaaS dashboards and the physical "ledger paper" metaphor. Instead, it positions Wobblio as a **deliberate, high-end, responsive instrument** for managing household finance. 

The interface leverages:
*   **Depth and Glassmorphism:** Semi-transparent cards (`rgba(17, 22, 39, 0.72)`) floating over a dark base with large, soft radial background glow gradients (Indigo, Teal, and Coral).
*   **Tactility:** Cards utilize thin borders (`rgba(255, 255, 255, 0.08)`) and sharp shadows rather than heavy border lines.
*   **Dynamic States:** Micro-animations (laser-line parsing scanner, layout shifts, glow pulsing) keep the user engaged and reduce perceived waiting times.

---

## 2. Token System

### Color Palette (Obsidian Dark - Default)

| Token Name | Hex Value | Semantic / UI Role |
| :--- | :--- | :--- |
| **Deep Space** | `#090C15` | Main document background |
| **Obsidian Glass** | `rgba(17, 22, 39, 0.72)` | Panel surfaces and card backgrounds |
| **Electric Indigo** | `#6366F1` | Brand accents, focus rings, primary action buttons |
| **Aurora Teal** | `#0D9488` | Safe states, confirmed parses, under-budget signs |
| **Sunset Coral** | `#F43F5E` | Critical action warnings, budget alerts (>85% limit) |
| **Warm Amber** | `#F59E0B` | Needs review, low confidence parse flags |
| **Star White** | `#F8FAFC` | Headings, primary numeric readouts, label text |
| **Slate Space** | `#94A3B8` | Muted labels, secondary descriptions, metadata |

### Color Palette (Solar Light - Toggle)

When the user toggles Light Mode, the interface transitions to a warm, high-contrast light theme:
*   **Solar Glass Background:** `#F1F5F9`
*   **Glass Surface:** `rgba(255, 255, 255, 0.75)`
*   **Deep Ink Text:** `#0F172A`
*   **Soft Slate Labels:** `#64748B`
*   **Electric Indigo / Aurora Teal / Sunset Coral:** Tuned for light mode accessibility.

---

## 3. Typography

Wobblio uses a modern typography pairing:
1.  **Outfit (Google Font):** A geometric sans-serif that balances precise spacing with rounded terminal warmness. Applied to main titles, metrics labels, and large financial totals.
2.  **Inter:** A clean, neutral typeface optimized for readability in dense lists and complex control parameters.
3.  **Tabular Numbers:** Explicitly utilizes `font-variant-numeric: tabular-nums` and right-aligned currency displays in all ledger lists to ensure columns of numbers stack perfectly for comparison.

---

## 4. Key Interactive Flows & Rebranding Strategy

*   **Multi-Purpose Rebranding Strategy:** Copy has been refocused from a supermarket-only tool to a global, multi-purpose receipt scanner and expense manager. Phrasing like "Stop overpaying at the supermarket" is replaced with broader expense optimization ("Stop overpaying on everyday purchases") to cover dining out, travel expenses, fuel, services, and retail.
*   **6-Persona Marketing Grid:** The landing page features a 3-column, 6-card grid that aligns directly with the marketing personas from Section 13.1 of the Wobblio specification:
    1.  *Budget Traveler (P1):* Focuses on currency stabilization and instant foreign transaction rate calculations.
    2.  *Household CFO (P2):* Emphasizes shared quota pooling and household category budgets.
    3.  *Student (P3):* Targets local store comparison and simple splits.
    4.  *Inflation Hunter (P4):* Focuses on personal price indexing and tracking item cost inflation.
    5.  *Friend Group (P5):* Promotes proportional split-bills with WhatsApp export integration.
    6.  *Border Shopper / Expat (P6):* Targets regional price checks to optimize travel costs between bordering countries.
*   **Sandbox Controls & RLS Bypass Simulation:** Inside the workspace top bar, developers and testers can toggle PostgreSQL Row-Level Security (RLS) enforcement. Disabling RLS displays a prominent security warning banner mimicking a multi-tenant isolation failure, demonstrating that backend operations safeguard sensitive information (`usr_9a4f210e`).
*   **Interactive Checklist Builder (Lists Tab):** Allows adding items via autocomplete searching against a mock product vocabulary. Features increment/decrement steppers, item removal, and checkbox toggling. Calculates total basket costs in real-time across three local stores (Albert Heijn XL, Jumbo Oostpoort, Dirk van den Broek) and sorts them dynamically to find the cheapest retailer, detailing estimated savings.
*   **Dynamic SVG Historical Trends (Reports Tab):** Provides a visual dashboard comparing unit prices. The SVG chart draws dynamic grid lines, axes, and multi-colored trend lines per store. Snaps a vertical guidelines crosshair to the nearest date coordinate and displays a tooltip card detailing prices from cheapest to most expensive with a victory icon.
*   **GDPR & Privacy Options (Settings Tab):**
    *   *Price Contribution Toggle:* Toggles anonymous priceobservation sharing with the community price index.
    *   *Article 20 Data Export:* Simulates compiling and downloading a comprehensive JSON/ZIP package of account data.
    *   *Article 17 Account Purge:* Simulates erasure verification with a warning message and redirects the user to the landing page.
