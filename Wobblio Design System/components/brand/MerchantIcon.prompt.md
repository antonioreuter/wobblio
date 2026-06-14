Merchant badge — replaces emoji with a rounded square in the retailer's brand color plus a Lucide glyph. Used wherever a store appears (tables, list rows, drawers).

```jsx
<MerchantIcon merchant="Jumbo Oostpoort" />
<MerchantIcon merchant="AH To Go" size={36} />
```

Matching is `startsWith` on a lowercased name, so "Jumbo Oostpoort" → Jumbo config. Unknown merchants fall back to a neutral receipt icon. Never use food emoji for merchants — always this badge.
