# Wobblio Web UI Kit

A high-fidelity recreation of the Wobblio web product in the **Obsidian Aurora** dark-first glass aesthetic. Composes the design-system primitives (`Button`, `Badge`, `Card`, `MetricCard`, `ProgressBar`, `MerchantIcon`, `Avatar`, `WobblioLogo`) into real screens.

## Files
| File | Purpose |
|---|---|
| `index.html` | Full interactive kit — toggle **Home** (marketing) ↔ **Workspace** (dashboard) in the header; light/dark theme toggle. |
| `kit-landing.jsx` | Hero (interactive scan mockup), trust strip, features, 4 use-case tiles, pricing. |
| `kit-workspace.jsx` | App shell: 9-item rail, top bar with search + theme toggle + user/plan chip, dashboard pane (metrics, spending-by-category bar chart, recent-invoices ledger with share/delete + refresh, upload zone, category budgets). |
| `kit-icons.jsx` | Lucide-style inline icon set (`window.WobblioIcons`). |
| `kit.css` | Kit-only layout (consumes design-system tokens; declares no new colors). |

## Interactions
- **Scan mockup** — click the hero dropzone to simulate AI parsing → parsed line items.
- **Theme** — header / top-bar toggle flips `data-theme` between `dark` and `light` (Solar Light).
- **Invoices** — delete a row (trash icon) or refresh to restore the seed list.
- **Rail** — switch active workspace module.

## Notes
This is a cosmetic recreation, not production code. Screens map to the source `Source/webapp` Next.js app and the `new-web-design-gemini` prototype. Mobile screens (Flutter capture app) are in the product backlog and intentionally omitted.
