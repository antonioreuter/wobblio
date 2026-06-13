Budget meter — horizontal fill that auto-colors with spend pressure and marks the 85% over-budget line.

```jsx
<ProgressBar value={76} />              {/* teal */}
<ProgressBar value={88} />              {/* auto coral — over threshold */}
<ProgressBar value={51} tone="success" showThreshold={false} />
```

Auto tone: ≥85% coral, ≥75% amber, else teal. The faint vertical tick at 85% is the budget-protection threshold; hide it with `showThreshold={false}` for non-budget uses.
