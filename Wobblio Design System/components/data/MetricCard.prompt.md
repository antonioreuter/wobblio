KPI tile — headline number with an overline label and a colored delta. The dashboard's top row.

```jsx
<MetricCard label="Total Tracked Spend" value="€642.30" delta="↓ €86.12 below projection" tone="success" />
<MetricCard label="Needs Check" value="3 items" delta="1 receipt needs verification" tone="warning" />
```

Tone colors the delta only (`success` teal, `warning` amber, `danger` coral). Values always render in Outfit with tabular numerals so columns align.
