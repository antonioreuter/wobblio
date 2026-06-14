Primary action button — use for any clickable action; `primary` for the main CTA, `outline` for secondary, `text` for low-emphasis inline actions.

```jsx
<Button variant="primary" iconRight={<ArrowIcon/>}>Start Ingesting Free</Button>
<Button variant="outline">Explore Use Cases</Button>
<Button variant="text">Cancel</Button>
```

Variants: `primary` (indigo fill + glow), `outline` (glass border), `text` (muted, no fill).
Sizes: `md` (default), `lg` (hero). Pass `iconLeft` / `iconRight` for Lucide icon nodes. `disabled` dims to 0.5.
