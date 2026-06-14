/* @ds-bundle: {"format":3,"namespace":"WobblioDesignSystem_6a8d64","components":[{"name":"Avatar","sourcePath":"components/brand/Avatar.jsx"},{"name":"MerchantIcon","sourcePath":"components/brand/MerchantIcon.jsx"},{"name":"WobblioLogo","sourcePath":"components/brand/WobblioLogo.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"MetricCard","sourcePath":"components/data/MetricCard.jsx"},{"name":"ProgressBar","sourcePath":"components/data/ProgressBar.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"}],"sourceHashes":{"Workspace.jsx":"99c9be174b4a","components/brand/Avatar.jsx":"43ea72e881e9","components/brand/MerchantIcon.jsx":"c91e9d9df033","components/brand/WobblioLogo.jsx":"69428566aa9f","components/core/Badge.jsx":"34edb4cdc9ce","components/core/Button.jsx":"83564c1cd855","components/core/Card.jsx":"2343dc00fc77","components/core/Tag.jsx":"d77335bb5ae3","components/data/MetricCard.jsx":"3786e007b284","components/data/ProgressBar.jsx":"ee2c5ec64847","components/forms/Checkbox.jsx":"eb5f22c653de","components/forms/Input.jsx":"840abb22b837","components/forms/Switch.jsx":"418ae30ab47e","kit-icons.jsx":"170a3ac90bf5","kit-login.jsx":"18d14d0d8e90","kit-workspace.jsx":"55b3b7065eff","ui_kits/web/kit-icons.jsx":"0d6e6d7697a4","ui_kits/web/kit-landing.jsx":"7a10a2a940e8","ui_kits/web/kit-login.jsx":"64499381eccb","ui_kits/web/kit-register.jsx":"a6b86c38a08f","ui_kits/web/kit-verify.jsx":"3cc95556d724","ui_kits/web/kit-workspace.jsx":"82684573a641","ui_kits/web/tweaks-panel.jsx":"6591467622ed"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.WobblioDesignSystem_6a8d64 = window.WobblioDesignSystem_6a8d64 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// Workspace.jsx
try { (() => {
/* Wobblio workspace — dashboard shell */
const {
  Card: WkCard,
  Badge: WkBadge,
  Tag: WkTag,
  Button: WkBtn,
  Avatar: WkAvatar,
  WobblioLogo: WkLogo,
  MerchantIcon: WkMerchant,
  MetricCard: WkMetric,
  ProgressBar: WkBar
} = window.WobblioDesignSystem_6a8d64;
const WI = window.WobblioIcons;
const RAIL = [['grid', 'Dashboard'], ['receiptText', 'Invoices'], ['checkSquare', 'Awaiting Check'], ['trend', 'Price Trends'], ['cart', 'Shopping Lists'], ['wallet', 'Budgets'], ['users', 'Household'], ['settings', 'Settings'], ['terminal', 'Console']];
const INVOICES = [{
  merchant: 'Jumbo Oostpoort',
  date: '12 Jun 2026',
  status: ['success', 'Processed'],
  tags: ['dinner', 'weekly'],
  total: '€28.74'
}, {
  merchant: 'AH To Go',
  date: '11 Jun 2026',
  status: ['warning', 'Needs Review'],
  tags: ['commute'],
  total: '€12.15'
}, {
  merchant: 'Tokomania',
  date: '09 Jun 2026',
  status: ['primary', 'Auto Parsed'],
  tags: ['pantry'],
  total: '€34.20'
}, {
  merchant: 'Dirk van den Broek',
  date: '07 Jun 2026',
  status: ['success', 'Processed'],
  tags: ['weekly'],
  total: '€41.06'
}];
const SPEND = [['Groceries', 248.6, 150], ['Bar & Restaurants', 162.4, 98], ['Transport', 98.2, 59], ['Drugstore', 74.8, 45], ['Others', 58.3, 35]];
function SpendChart() {
  return /*#__PURE__*/React.createElement(WkCard, {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-header",
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "panel-title"
  }, "Spending by Category"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, "June 2026")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-secondary)',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 20,
      color: 'var(--text-primary)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "\u20AC642.30"), " total spent this month"), /*#__PURE__*/React.createElement("div", {
    className: "spend-chart"
  }, SPEND.map(([label, val, h]) => /*#__PURE__*/React.createElement("div", {
    className: "spend-col",
    key: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "spend-val"
  }, "\u20AC", Math.round(val)), /*#__PURE__*/React.createElement("div", {
    className: "spend-bar",
    style: {
      height: h
    },
    title: `${label}: €${val.toFixed(2)}`
  }), /*#__PURE__*/React.createElement("div", {
    className: "spend-label"
  }, label)))));
}
function Workspace({
  theme,
  onToggleTheme
}) {
  const [active, setActive] = React.useState(0);
  const [rls, setRls] = React.useState(true);
  const [bannerOpen, setBannerOpen] = React.useState(false);
  const toggleRls = () => {
    const next = !rls;
    setRls(next);
    setBannerOpen(!next);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "workspace"
  }, /*#__PURE__*/React.createElement("div", {
    className: "app-shell",
    "data-comment-anchor": "cb4d26320b-div-63-7"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "app-rail"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rail-logo"
  }, /*#__PURE__*/React.createElement(WkLogo, {
    size: 30
  })), /*#__PURE__*/React.createElement("nav", {
    className: "rail-menu"
  }, RAIL.map(([icon, label], i) => {
    const Ico = WI[icon];
    return /*#__PURE__*/React.createElement("button", {
      key: label,
      title: label,
      className: `rail-btn ${i === active ? 'active' : ''}`,
      onClick: () => setActive(i)
    }, /*#__PURE__*/React.createElement(Ico, {
      size: 20
    }));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "app-body"
  }, /*#__PURE__*/React.createElement("header", {
    className: "app-topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-wrap"
  }, /*#__PURE__*/React.createElement(WI.search, null), /*#__PURE__*/React.createElement("input", {
    className: "app-search",
    placeholder: "Search merchant, tag, or item\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    className: "topbar-right"
  }, /*#__PURE__*/React.createElement("button", {
    className: "dev-btn",
    title: "Reload seed data"
  }, /*#__PURE__*/React.createElement(WI.reload, null), " Reload Seeds"), /*#__PURE__*/React.createElement("button", {
    className: `dev-btn ${rls ? 'rls-on' : 'rls-off'}`,
    onClick: toggleRls,
    title: "Toggle PostgreSQL RLS"
  }, /*#__PURE__*/React.createElement(WI.shield, {
    size: 13
  }), " ", rls ? 'RLS: Enforced' : 'RLS: Bypassed'), /*#__PURE__*/React.createElement("span", {
    className: "quota"
  }, "7 of 10 scans used"), /*#__PURE__*/React.createElement("button", {
    className: "icon-toggle",
    onClick: onToggleTheme,
    title: "Toggle theme"
  }, theme === 'dark' ? /*#__PURE__*/React.createElement(WI.sun, null) : /*#__PURE__*/React.createElement(WI.moon, null)), /*#__PURE__*/React.createElement(WkAvatar, {
    initials: "AR"
  }))), bannerOpen && /*#__PURE__*/React.createElement("div", {
    className: "rls-banner"
  }, /*#__PURE__*/React.createElement(WI.alert, null), /*#__PURE__*/React.createElement("span", {
    className: "msg"
  }, /*#__PURE__*/React.createElement("strong", null, "PostgreSQL tenant separation bypass warning:"), " Query attempted to access data from user ", /*#__PURE__*/React.createElement("code", null, "usr_9a4f210e"), ". Operation blocked by RLS policies."), /*#__PURE__*/React.createElement("button", {
    onClick: () => setBannerOpen(false),
    "aria-label": "Dismiss"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "pane"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "pane-title"
  }, "Your Everyday Savings"), /*#__PURE__*/React.createElement("p", {
    className: "pane-subtitle"
  }, "Overview of your household expenses and price trends."), /*#__PURE__*/React.createElement("div", {
    className: "metrics-row"
  }, /*#__PURE__*/React.createElement(WkMetric, {
    label: "Total Tracked Spend",
    value: "\u20AC642.30",
    delta: "\u2193 \u20AC86.12 below projection",
    tone: "success"
  }), /*#__PURE__*/React.createElement(WkMetric, {
    label: "Retail Deals Found",
    value: "\u20AC24.80",
    delta: "4 brand switches matching preferences",
    tone: "success"
  }), /*#__PURE__*/React.createElement(WkMetric, {
    label: "Needs Check",
    value: "3 items",
    delta: "1 receipt needs verification",
    tone: "warning"
  })), /*#__PURE__*/React.createElement("div", {
    className: "dash-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement(SpendChart, null), /*#__PURE__*/React.createElement(WkCard, {
    className: "panel",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-header",
    style: {
      padding: '20px 24px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "panel-title"
  }, "Recent Invoices"), /*#__PURE__*/React.createElement(WkBtn, {
    variant: "outline",
    style: {
      padding: '6px 14px',
      fontSize: 12.5
    }
  }, "Bulk Categorize")), /*#__PURE__*/React.createElement("table", {
    className: "app-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Merchant"), /*#__PURE__*/React.createElement("th", null, "Date"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "Tags"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Total"))), /*#__PURE__*/React.createElement("tbody", null, INVOICES.map(inv => /*#__PURE__*/React.createElement("tr", {
    key: inv.merchant
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "merchant-cell"
  }, /*#__PURE__*/React.createElement(WkMerchant, {
    merchant: inv.merchant
  }), " ", inv.merchant)), /*#__PURE__*/React.createElement("td", null, inv.date), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(WkBadge, {
    tone: inv.status[0]
  }, inv.status[1])), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "tag-row"
  }, inv.tags.map(t => /*#__PURE__*/React.createElement(WkTag, {
    key: t
  }, t)))), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, inv.total))))))), /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement(WkCard, {
    className: "upload-dropzone",
    style: {
      padding: '28px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "upload-icon"
  }, /*#__PURE__*/React.createElement(WI.upload, {
    size: 26
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 15,
      marginBottom: 4,
      color: 'var(--text-primary)'
    }
  }, "Upload New Receipt"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, "Drag and drop a receipt (PNG, JPG, PDF), or ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--brand)',
      textDecoration: 'underline'
    }
  }, "browse files")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--text-muted)',
      marginTop: 6
    }
  }, "Location metadata removed \xB7 compressed client-side.")), /*#__PURE__*/React.createElement(WkCard, {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-header",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "panel-title"
  }, "Category Budgets")), /*#__PURE__*/React.createElement("div", {
    className: "budget-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "budget-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "name"
  }, "Fresh Food"), /*#__PURE__*/React.createElement("span", {
    className: "pct",
    style: {
      color: 'var(--warning)'
    }
  }, "76%")), /*#__PURE__*/React.createElement(WkBar, {
    value: 76
  })), /*#__PURE__*/React.createElement("div", {
    className: "budget-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "budget-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "name"
  }, "Dining Out"), /*#__PURE__*/React.createElement("span", {
    className: "pct",
    style: {
      color: 'var(--danger)'
    }
  }, "88%")), /*#__PURE__*/React.createElement(WkBar, {
    value: 88
  })), /*#__PURE__*/React.createElement("div", {
    className: "budget-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "budget-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "name"
  }, "Utilities / Fuel"), /*#__PURE__*/React.createElement("span", {
    className: "pct",
    style: {
      color: 'var(--success)'
    }
  }, "51%")), /*#__PURE__*/React.createElement(WkBar, {
    value: 51
  })))))))));
}
window.WobblioWorkspace = Workspace;
})(); } catch (e) { __ds_ns.__errors.push({ path: "Workspace.jsx", error: String((e && e.message) || e) }); }

// components/brand/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * User avatar — gradient circle with initials.
 */
function Avatar({
  initials = '',
  size = 36,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'var(--gradient-avatar)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: size * 0.36,
      color: '#fff',
      flexShrink: 0,
      ...style
    }
  }, rest), initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/brand/MerchantIcon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ICONS = {
  'shopping-bag': 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0',
  'shopping-cart': 'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6 M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  'tag': 'M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82ZM7 7h.01',
  'coins': 'M9 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M16.71 13.88A6 6 0 1 1 9 19',
  'coffee': 'M17 8h1a4 4 0 1 1 0 8h-1 M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM6 1v3M10 1v3M14 1v3',
  'flame': 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z',
  'utensils-crossed': 'm16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8 M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7M2.1 21.8 6.4 17.5M19 5l-7 7',
  'receipt': 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z M16 8h-6M16 12h-6'
};
const MERCHANTS = {
  'albert heijn': {
    color: 'var(--merchant-ah)',
    fg: '#fff',
    icon: 'shopping-bag',
    initials: 'AH'
  },
  'ah to go': {
    color: 'var(--merchant-ah)',
    fg: '#fff',
    icon: 'coffee',
    initials: 'AH'
  },
  'jumbo': {
    color: 'var(--merchant-jumbo)',
    fg: '#0f172a',
    icon: 'shopping-cart',
    initials: 'J'
  },
  'dirk': {
    color: 'var(--merchant-dirk)',
    fg: '#fff',
    icon: 'tag',
    initials: 'D'
  },
  'lidl': {
    color: 'var(--merchant-lidl)',
    fg: '#fff',
    icon: 'coins',
    initials: 'L'
  },
  'tokomania': {
    color: 'var(--merchant-tokomania)',
    fg: '#fff',
    icon: 'flame',
    initials: 'TK'
  },
  'restaurante cantinho': {
    color: 'var(--merchant-cantinho)',
    fg: '#fff',
    icon: 'utensils-crossed',
    initials: 'RC'
  }
};

/**
 * Colored merchant badge — maps a store name to its brand color + Lucide glyph.
 */
function MerchantIcon({
  merchant = '',
  size = 28,
  style,
  ...rest
}) {
  const norm = merchant.toLowerCase().trim();
  const key = Object.keys(MERCHANTS).find(k => norm.startsWith(k));
  const cfg = key ? MERCHANTS[key] : {
    color: 'var(--text-muted)',
    fg: '#fff',
    icon: 'receipt',
    initials: '?'
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    title: merchant,
    style: {
      width: size,
      height: size,
      borderRadius: 'var(--radius-md)',
      background: cfg.color,
      color: cfg.fg,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      width: '55%',
      height: '55%'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: ICONS[cfg.icon]
  })));
}
Object.assign(__ds_scope, { MerchantIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/MerchantIcon.jsx", error: String((e && e.message) || e) }); }

// components/brand/WobblioLogo.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Wobblio double-loop crossover wave mark. Indigo→teal gradient stroke.
 * Pair with the wordmark via `withWordmark`.
 */
function WobblioLogo({
  size = 32,
  withWordmark = false,
  style,
  ...rest
}) {
  const gradId = React.useId ? React.useId() : `wob-${Math.random().toString(36).slice(2)}`;
  const mark = /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 48 32",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      width: size,
      height: size * 32 / 48,
      display: 'block'
    },
    "aria-label": "Wobblio"
  }, rest), /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: gradId,
    x1: "0%",
    y1: "0%",
    x2: "100%",
    y2: "0%"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#6366F1"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#0D9488"
  }))), /*#__PURE__*/React.createElement("path", {
    d: "M 6 22 C 10 22, 14 6, 20 6 C 24 6, 26 18, 32 14 L 42 14",
    stroke: `url(#${gradId})`,
    strokeWidth: 3.5
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 6 22 C 10 22, 15 26, 20 20 C 23 16, 26 12, 30 16 C 33 19, 36 24, 42 24",
    stroke: `url(#${gradId})`,
    strokeWidth: 3.5
  }));
  if (!withWordmark) return mark;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      ...style
    }
  }, mark, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: size * 0.62,
      fontWeight: 800,
      letterSpacing: '-0.5px',
      color: 'var(--text-primary)'
    }
  }, "wobbl", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--brand)'
    }
  }, "io")));
}
Object.assign(__ds_scope, { WobblioLogo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/WobblioLogo.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Status pill. Uppercase, tracked, tinted by tone.
 */
function Badge({
  children,
  tone = 'primary',
  className = '',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `badge badge--${tone} ${className}`.trim(),
    style: style
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Wobblio primary action button. Maps to the `.btn` system in base.css.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  style,
  ...rest
}) {
  const classes = ['btn', `btn--${variant}`, size === 'lg' ? 'btn--lg' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: classes,
    disabled: disabled,
    onClick: onClick,
    style: style
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Glassmorphic surface card. Optional `interactive` adds lift on hover.
 */
function Card({
  children,
  interactive = false,
  className = '',
  style,
  ...rest
}) {
  const classes = ['glass', interactive ? 'glass-interactive' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", _extends({
    className: classes,
    style: {
      padding: 'var(--space-6)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Subtle metadata tag (e.g. "weekly", "dinner") used in table cells.
 */
function Tag({
  children,
  removable = false,
  onRemove,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '11px',
      fontFamily: 'var(--font-body)',
      background: 'var(--glass-highlight)',
      border: '1px solid var(--glass-border)',
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)',
      color: 'var(--text-secondary)',
      ...style
    }
  }, rest), children, removable && /*#__PURE__*/React.createElement("button", {
    onClick: onRemove,
    "aria-label": "Remove tag",
    style: {
      background: 'none',
      border: 0,
      color: 'inherit',
      cursor: 'pointer',
      padding: 0,
      fontWeight: 700,
      lineHeight: 1
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/data/MetricCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dashboard metric tile — overline label, large tabular value, tinted delta.
 */
function MetricCard({
  label,
  value,
  delta,
  tone = 'neutral',
  style,
  ...rest
}) {
  const toneColor = {
    neutral: 'var(--text-secondary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)'
  }[tone];
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "glass",
    style: {
      padding: 'var(--space-5)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '12px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      color: 'var(--text-muted)',
      marginBottom: '6px'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '32px',
      fontWeight: 800,
      color: 'var(--text-primary)',
      lineHeight: 1.1,
      fontVariantNumeric: 'tabular-nums',
      marginBottom: delta ? '4px' : 0
    }
  }, value), delta && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      color: toneColor
    }
  }, delta));
}
Object.assign(__ds_scope, { MetricCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MetricCard.jsx", error: String((e && e.message) || e) }); }

// components/data/ProgressBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Budget progress bar. Auto-colors by spend ratio unless `tone` is forced.
 * Renders the 85% over-budget threshold marker.
 */
function ProgressBar({
  value = 0,
  tone,
  showThreshold = true,
  style,
  ...rest
}) {
  const pct = Math.max(0, Math.min(100, value));
  const auto = pct >= 85 ? 'danger' : pct >= 75 ? 'warning' : 'success';
  const fillColor = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)'
  }[tone || auto];
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      width: '100%',
      height: '8px',
      background: 'var(--glass-border)',
      borderRadius: 'var(--radius-pill)',
      overflow: 'hidden',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${pct}%`,
      background: fillColor,
      borderRadius: 'var(--radius-pill)',
      transition: 'width 0.8s var(--ease-out)'
    }
  }), showThreshold && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '85%',
      top: 0,
      bottom: 0,
      width: '1.5px',
      background: 'rgba(255,255,255,0.3)',
      zIndex: 2
    }
  }));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Square checkbox with brand fill + check glyph. Pairs with a label.
 */
function Checkbox({
  checked,
  defaultChecked,
  onChange,
  label,
  id,
  disabled = false,
  ...rest
}) {
  const isOn = checked ?? defaultChecked;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '12px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    id: id,
    checked: checked,
    defaultChecked: defaultChecked,
    onChange: onChange,
    disabled: disabled,
    style: {
      display: 'none'
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    style: {
      width: '20px',
      height: '20px',
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${isOn ? 'var(--brand)' : 'var(--glass-border)'}`,
      background: isOn ? 'var(--brand)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: '11px',
      fontWeight: 700,
      flexShrink: 0,
      transition: 'all var(--transition-fast)'
    }
  }, isOn ? '✓' : ''), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '14px',
      color: 'var(--text-primary)'
    }
  }, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Text field with optional label, leading icon, and low-confidence "flagged" state.
 */
function Input({
  label,
  icon,
  flagged = false,
  id,
  style,
  ...rest
}) {
  const inputId = id || (label ? `in-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      color: flagged ? 'var(--warning)' : 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '14px',
      display: 'flex',
      color: 'var(--text-muted)',
      pointerEvents: 'none'
    }
  }, icon), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    style: {
      width: '100%',
      height: 'var(--control-height)',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${flagged ? 'var(--warning)' : 'var(--glass-border)'}`,
      background: flagged ? 'rgba(245,158,11,0.04)' : 'var(--glass-highlight)',
      boxShadow: flagged ? 'inset 4px 0 0 var(--warning)' : 'none',
      color: 'var(--text-primary)',
      padding: icon ? '0 14px 0 42px' : '0 14px',
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      outline: 'none',
      transition: 'all var(--transition-fast)',
      ...style
    },
    onFocus: e => {
      if (!flagged) {
        e.target.style.borderColor = 'var(--brand)';
        e.target.style.boxShadow = '0 0 0 3px var(--brand-glow)';
      }
    },
    onBlur: e => {
      if (!flagged) {
        e.target.style.borderColor = 'var(--glass-border)';
        e.target.style.boxShadow = 'none';
      }
    }
  }, rest))));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * iOS-style toggle switch. Checked = teal (success).
 */
function Switch({
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  id,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-block',
      position: 'relative',
      width: '46px',
      height: '24px',
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    id: id,
    checked: checked,
    defaultChecked: defaultChecked,
    onChange: onChange,
    disabled: disabled,
    style: {
      opacity: 0,
      width: 0,
      height: 0,
      position: 'absolute'
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    "data-switch-track": true,
    style: {
      position: 'absolute',
      inset: 0,
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: checked ?? defaultChecked ? 'var(--success)' : 'var(--text-muted)',
      borderRadius: '34px',
      transition: '0.3s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      height: '18px',
      width: '18px',
      left: '3px',
      bottom: '3px',
      background: '#fff',
      borderRadius: '50%',
      transition: '0.3s',
      transform: checked ?? defaultChecked ? 'translateX(22px)' : 'none'
    }
  })));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// kit-icons.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Lucide-style inline icons for the Wobblio web kit */
const Ic = p => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...p
});
const Icon = ({
  d,
  size = 20,
  children,
  ...rest
}) => /*#__PURE__*/React.createElement("svg", _extends({}, Ic(rest), {
  width: size,
  height: size
}), d ? /*#__PURE__*/React.createElement("path", {
  d: d
}) : children);
const Icons = {
  arrow: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16,
    d: "M5 12h14M12 5l7 7-7 7"
  }, p)),
  camera: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "13",
    r: "4"
  })),
  trend: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
    points: "23 6 13.5 15.5 8.5 10.5 1 18"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 6 23 6 23 12"
  })),
  box: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "3.27 6.96 12 12.01 20.73 6.96"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "22.08",
    x2: "12",
    y2: "12"
  })),
  shield: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20,
    d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
  }, p)),
  shieldCheck: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "9 11 11 13 15 9"
  })),
  calendar: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "2",
    x2: "16",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "2",
    x2: "8",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "10",
    x2: "21",
    y2: "10"
  })),
  lock: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "11",
    width: "18",
    height: "11",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 11V7a5 5 0 0 1 10 0v4"
  })),
  upload: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
  })),
  users: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M23 21v-2a4 4 0 0 0-3-3.87"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 3.13a4 4 0 0 1 0 7.75"
  })),
  globe: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    y1: "12",
    x2: "22",
    y2: "12"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
  })),
  split: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"
  })),
  grad: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M22 10v6M2 10l10-5 10 5-10 5z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"
  })),
  check: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16,
    strokeWidth: 3
  }, p), /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })),
  search: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 18
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65"
  })),
  sun: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"
  })),
  moon: p => /*#__PURE__*/React.createElement(Icon, _extends({}, p, {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })),
  grid: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "9",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "5",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "12",
    width: "7",
    height: "9",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "16",
    width: "7",
    height: "5",
    rx: "1"
  })),
  receiptText: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    "data-comment-anchor": "7122dbb773-path-26-44"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "14 2 14 8 20 8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "13",
    x2: "8",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "17",
    x2: "8",
    y2: "17"
  })),
  checkSquare: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "14 2 14 8 20 8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m9 15 2 2 4-4"
  })),
  cart: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "6",
    x2: "21",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "12",
    x2: "21",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "18",
    x2: "21",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "6",
    x2: "3.01",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "12",
    x2: "3.01",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "18",
    x2: "3.01",
    y2: "18"
  })),
  wallet: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h14v4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 6v12a2 2 0 0 0 2 2h14v-4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 12a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4v-6h-4z"
  })),
  settings: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
  })),
  terminal: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("polyline", {
    points: "4 17 10 11 4 5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "19",
    x2: "20",
    y2: "19"
  })),
  clock: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 8v4l3 3"
  })),
  alert: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "9",
    x2: "12",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12.01",
    y2: "17"
  })),
  reload: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 13
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"
  })),
  crown: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 12
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "m5 16-3-8 5.5 5L12 4l4.5 9L22 8l-3 8H5Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 20h14"
  })),
  share: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 15
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "5",
    r: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "19",
    r: "3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8.59",
    y1: "13.51",
    x2: "15.42",
    y2: "17.49"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "15.41",
    y1: "6.51",
    x2: "8.59",
    y2: "10.49"
  })),
  trash: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 15
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"
  }))
};
window.WobblioIcons = Icons;
})(); } catch (e) { __ds_ns.__errors.push({ path: "kit-icons.jsx", error: String((e && e.message) || e) }); }

// kit-login.jsx
try { (() => {
/* Wobblio auth — Sign in screen (faithful to Source/webapp (auth)/login) */
const {
  Card: LgCard,
  Button: LgBtn,
  Input: LgInput,
  Checkbox: LgCheck,
  WobblioLogo: LgLogo
} = window.WobblioDesignSystem_6a8d64;
const LI = window.WobblioIcons;
function Login({
  onSignIn
}) {
  const [loading, setLoading] = React.useState(false);
  const submit = e => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSignIn && onSignIn();
    }, 850);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "auth-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-card glass"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-brand"
  }, /*#__PURE__*/React.createElement(LgLogo, {
    size: 30,
    withWordmark: true
  })), /*#__PURE__*/React.createElement("h1", {
    className: "auth-title"
  }, "Welcome back"), /*#__PURE__*/React.createElement("p", {
    className: "auth-sub"
  }, "Sign in to your household workspace."), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    className: "auth-form",
    noValidate: true
  }, /*#__PURE__*/React.createElement(LgInput, {
    label: "Email",
    type: "email",
    name: "email",
    autoComplete: "email",
    icon: /*#__PURE__*/React.createElement(LI.mail, null),
    defaultValue: "antonio@wobblio.app",
    required: true
  }), /*#__PURE__*/React.createElement(LgInput, {
    label: "Password",
    type: "password",
    name: "password",
    autoComplete: "current-password",
    icon: /*#__PURE__*/React.createElement(LI.lock2, null),
    defaultValue: "household2026",
    required: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "auth-row"
  }, /*#__PURE__*/React.createElement(LgCheck, {
    defaultChecked: true,
    label: "Remember me"
  }), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "auth-link",
    onClick: e => e.preventDefault()
  }, "Forgot your password?")), /*#__PURE__*/React.createElement(LgBtn, {
    type: "submit",
    variant: "primary",
    disabled: loading,
    style: {
      width: '100%'
    },
    iconLeft: loading ? null : /*#__PURE__*/React.createElement(LI.logout, null)
  }, loading ? 'Signing in…' : 'Sign in')), /*#__PURE__*/React.createElement("div", {
    className: "auth-divider",
    "data-comment-anchor": "cc4a007ab3-div-40-9"
  }, /*#__PURE__*/React.createElement("span", null, "or")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "sso-btn",
    onClick: submit
  }, /*#__PURE__*/React.createElement(LI.fingerprint, null), " Continue with single sign-on"), /*#__PURE__*/React.createElement("p", {
    className: "auth-foot"
  }, "Don't have an account? ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "auth-link strong",
    onClick: e => e.preventDefault()
  }, "Create one"))), /*#__PURE__*/React.createElement("p", {
    className: "auth-legal"
  }, /*#__PURE__*/React.createElement(LI.shieldCheck, {
    size: 14
  }), " Protected by row-level security \xB7 GDPR-compliant \xB7 EU-hosted"));
}
window.WobblioLogin = Login;
})(); } catch (e) { __ds_ns.__errors.push({ path: "kit-login.jsx", error: String((e && e.message) || e) }); }

// kit-workspace.jsx
try { (() => {
/* Wobblio workspace — dashboard shell */
const {
  Card: WkCard,
  Badge: WkBadge,
  Tag: WkTag,
  Button: WkBtn,
  Avatar: WkAvatar,
  WobblioLogo: WkLogo,
  MerchantIcon: WkMerchant,
  MetricCard: WkMetric,
  ProgressBar: WkBar
} = window.WobblioDesignSystem_6a8d64;
const WI = window.WobblioIcons;
const RAIL = [['grid', 'Dashboard'], ['receiptText', 'Invoices'], ['checkSquare', 'Awaiting Check'], ['trend', 'Price Trends'], ['cart', 'Shopping Lists'], ['wallet', 'Budgets'], ['users', 'Household'], ['settings', 'Settings'], ['terminal', 'Console']];
const SEED_INVOICES = [{
  id: 1,
  merchant: 'Jumbo Oostpoort',
  date: '12 Jun 2026',
  status: ['success', 'Processed'],
  tags: ['dinner', 'weekly'],
  total: '€28.74'
}, {
  id: 2,
  merchant: 'AH To Go',
  date: '11 Jun 2026',
  status: ['warning', 'Needs Review'],
  tags: ['commute'],
  total: '€12.15'
}, {
  id: 3,
  merchant: 'Tokomania',
  date: '09 Jun 2026',
  status: ['primary', 'Auto Parsed'],
  tags: ['pantry'],
  total: '€34.20'
}, {
  id: 4,
  merchant: 'Dirk van den Broek',
  date: '07 Jun 2026',
  status: ['success', 'Processed'],
  tags: ['weekly'],
  total: '€41.06'
}];
const SPEND = [['Groceries', 248.6, 150], ['Bar & Restaurants', 162.4, 98], ['Transport', 98.2, 59], ['Drugstore', 74.8, 45], ['Others', 58.3, 35]];

// Budgets share the same expense taxonomy as the spend chart.
const BUDGETS = [{
  name: 'Groceries',
  pct: 76,
  tone: 'warning'
}, {
  name: 'Bar & Restaurants',
  pct: 104,
  tone: 'danger'
}, {
  name: 'Transport',
  pct: 51,
  tone: 'success'
}];
const OVER_BUDGET = BUDGETS.filter(b => b.pct >= 100).length;
function SpendChart() {
  return /*#__PURE__*/React.createElement(WkCard, {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-header",
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "panel-title"
  }, "Spending by Category"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, "June 2026")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-secondary)',
      marginBottom: 20
    }
  }, "How your ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--text-primary)'
    }
  }, "\u20AC642.30"), " broke down across expense types."), /*#__PURE__*/React.createElement("div", {
    className: "spend-chart"
  }, SPEND.map(([label, val, h]) => /*#__PURE__*/React.createElement("div", {
    className: "spend-col",
    key: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "spend-val"
  }, "\u20AC", Math.round(val)), /*#__PURE__*/React.createElement("div", {
    className: "spend-bar",
    style: {
      height: h
    },
    title: `${label}: €${val.toFixed(2)}`
  }), /*#__PURE__*/React.createElement("div", {
    className: "spend-label"
  }, label)))));
}
function Workspace({
  theme,
  onToggleTheme
}) {
  const [active, setActive] = React.useState(0);
  const [invoices, setInvoices] = React.useState(SEED_INVOICES);
  const [refreshing, setRefreshing] = React.useState(false);
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => {
      setInvoices(SEED_INVOICES);
      setRefreshing(false);
    }, 900);
  };
  const removeInvoice = id => setInvoices(list => list.filter(x => x.id !== id));
  return /*#__PURE__*/React.createElement("div", {
    className: "workspace"
  }, /*#__PURE__*/React.createElement("div", {
    className: "app-shell"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "app-rail"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rail-logo"
  }, /*#__PURE__*/React.createElement(WkLogo, {
    size: 30
  })), /*#__PURE__*/React.createElement("nav", {
    className: "rail-menu"
  }, RAIL.map(([icon, label], i) => {
    const Ico = WI[icon];
    return /*#__PURE__*/React.createElement("button", {
      key: label,
      title: label,
      className: `rail-btn ${i === active ? 'active' : ''}`,
      onClick: () => setActive(i)
    }, /*#__PURE__*/React.createElement(Ico, {
      size: 20
    }));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "app-body"
  }, /*#__PURE__*/React.createElement("header", {
    className: "app-topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-wrap"
  }, /*#__PURE__*/React.createElement(WI.search, null), /*#__PURE__*/React.createElement("input", {
    className: "app-search",
    placeholder: "Search merchant, tag, or item\u2026",
    "data-comment-anchor": "d0d11ce5e8-input-89-15"
  })), /*#__PURE__*/React.createElement("div", {
    className: "topbar-right"
  }, /*#__PURE__*/React.createElement("button", {
    className: "icon-toggle",
    onClick: onToggleTheme,
    title: "Toggle theme"
  }, theme === 'dark' ? /*#__PURE__*/React.createElement(WI.sun, null) : /*#__PURE__*/React.createElement(WI.moon, null)), /*#__PURE__*/React.createElement("div", {
    className: "user-chip"
  }, /*#__PURE__*/React.createElement(WkAvatar, {
    initials: "AR"
  }), /*#__PURE__*/React.createElement("div", {
    className: "user-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "user-name"
  }, "Antonio R."), /*#__PURE__*/React.createElement("span", {
    className: "user-plan"
  }, /*#__PURE__*/React.createElement(WI.crown, null), " Premium"))))), /*#__PURE__*/React.createElement("div", {
    className: "pane"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "pane-title"
  }, "Your Everyday Savings"), /*#__PURE__*/React.createElement("p", {
    className: "pane-subtitle"
  }, "Overview of your household expenses and price trends."), /*#__PURE__*/React.createElement("div", {
    className: "metrics-row"
  }, /*#__PURE__*/React.createElement(WkMetric, {
    label: "Spent This Month",
    value: "\u20AC642.30",
    delta: "\u2193 11.8% vs \u20AC728.42 last month",
    tone: "success"
  }), /*#__PURE__*/React.createElement(WkMetric, {
    label: "Retail Deals Found",
    value: "\u20AC24.80",
    delta: "4 brand switches matching preferences",
    tone: "success"
  }), /*#__PURE__*/React.createElement(WkMetric, {
    label: "Needs Check",
    value: "3 items",
    delta: "1 receipt needs verification",
    tone: "warning"
  })), /*#__PURE__*/React.createElement("div", {
    className: "dash-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement(SpendChart, null), /*#__PURE__*/React.createElement(WkCard, {
    className: "panel",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-header",
    style: {
      padding: '20px 24px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "panel-title"
  }, "Recent Invoices"), /*#__PURE__*/React.createElement(WkBtn, {
    variant: "outline",
    style: {
      padding: '6px 14px',
      fontSize: 12.5
    },
    onClick: refresh,
    iconLeft: /*#__PURE__*/React.createElement("span", {
      className: refreshing ? 'spin' : '',
      style: {
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement(WI.reload, null))
  }, refreshing ? 'Refreshing…' : 'Refresh')), /*#__PURE__*/React.createElement("table", {
    className: "app-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Merchant"), /*#__PURE__*/React.createElement("th", null, "Date"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "Tags"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Total"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, invoices.map(inv => /*#__PURE__*/React.createElement("tr", {
    key: inv.id
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "merchant-cell"
  }, /*#__PURE__*/React.createElement(WkMerchant, {
    merchant: inv.merchant
  }), " ", inv.merchant)), /*#__PURE__*/React.createElement("td", null, inv.date), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(WkBadge, {
    tone: inv.status[0]
  }, inv.status[1])), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "tag-row"
  }, inv.tags.map(t => /*#__PURE__*/React.createElement(WkTag, {
    key: t
  }, t)))), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, inv.total), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "row-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "row-action",
    title: "Share invoice"
  }, /*#__PURE__*/React.createElement(WI.share, null)), /*#__PURE__*/React.createElement("button", {
    className: "row-action danger",
    title: "Delete invoice",
    onClick: () => removeInvoice(inv.id)
  }, /*#__PURE__*/React.createElement(WI.trash, null)))))), invoices.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 6,
    style: {
      textAlign: 'center',
      color: 'var(--text-muted)',
      padding: '28px'
    }
  }, "No invoices \u2014 hit Refresh to restore.")))))), /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement(WkCard, {
    className: "upload-dropzone",
    style: {
      padding: '28px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "upload-icon"
  }, /*#__PURE__*/React.createElement(WI.upload, {
    size: 26
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 15,
      marginBottom: 4,
      color: 'var(--text-primary)'
    }
  }, "Upload New Receipt"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, "Drag and drop a receipt (PNG, JPG, PDF), or ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--brand)',
      textDecoration: 'underline'
    }
  }, "browse files")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--text-muted)',
      marginTop: 6
    }
  }, "Location metadata removed \xB7 compressed client-side.")), /*#__PURE__*/React.createElement(WkCard, {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-header",
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "panel-title"
  }, "Category Budgets")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-secondary)',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--text-primary)'
    }
  }, BUDGETS.length, " budgets"), " tracked \xB7", ' ', /*#__PURE__*/React.createElement("strong", {
    style: {
      color: OVER_BUDGET ? 'var(--danger)' : 'var(--success)'
    }
  }, OVER_BUDGET, " over budget")), BUDGETS.map(b => /*#__PURE__*/React.createElement("div", {
    className: "budget-item",
    key: b.name
  }, /*#__PURE__*/React.createElement("div", {
    className: "budget-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "name"
  }, b.name), /*#__PURE__*/React.createElement("span", {
    className: "pct",
    style: {
      color: `var(--${b.tone === 'danger' ? 'danger' : b.tone === 'warning' ? 'warning' : 'success'})`
    }
  }, b.pct, "%")), /*#__PURE__*/React.createElement(WkBar, {
    value: b.pct
  }))))))))));
}
window.WobblioWorkspace = Workspace;
})(); } catch (e) { __ds_ns.__errors.push({ path: "kit-workspace.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/kit-icons.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Lucide-style inline icons for the Wobblio web kit */
const Ic = p => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...p
});
const Icon = ({
  d,
  size = 20,
  children,
  ...rest
}) => /*#__PURE__*/React.createElement("svg", _extends({}, Ic(rest), {
  width: size,
  height: size
}), d ? /*#__PURE__*/React.createElement("path", {
  d: d
}) : children);
const Icons = {
  arrow: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16,
    d: "M5 12h14M12 5l7 7-7 7"
  }, p)),
  camera: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "13",
    r: "4"
  })),
  trend: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
    points: "23 6 13.5 15.5 8.5 10.5 1 18"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 6 23 6 23 12"
  })),
  box: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "3.27 6.96 12 12.01 20.73 6.96"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "22.08",
    x2: "12",
    y2: "12"
  })),
  shield: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20,
    d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
  }, p)),
  shieldCheck: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "9 11 11 13 15 9"
  })),
  calendar: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "2",
    x2: "16",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "2",
    x2: "8",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "10",
    x2: "21",
    y2: "10"
  })),
  lock: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "11",
    width: "18",
    height: "11",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 11V7a5 5 0 0 1 10 0v4"
  })),
  upload: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
  })),
  users: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M23 21v-2a4 4 0 0 0-3-3.87"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 3.13a4 4 0 0 1 0 7.75"
  })),
  user: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "7",
    r: "4"
  })),
  home: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "9 22 9 12 15 12 15 22"
  })),
  chevronDown: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16
  }, p), /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  })),
  thumbsUp: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M7 10v12"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
  })),
  thumbsDown: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M17 14V2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
  })),
  tag: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 7h.01"
  })),
  check2: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M22 11.08V12a10 10 0 1 1-5.93-9.14"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "22 4 12 14.01 9 11.01"
  })),
  alertTri: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "9",
    x2: "12",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12.01",
    y2: "17"
  })),
  copy: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 15
  }, p), /*#__PURE__*/React.createElement("rect", {
    x: "9",
    y: "9",
    width: "13",
    height: "13",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
  })),
  whatsapp: p => /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    width: p && p.size || 18,
    height: p && p.size || 18
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.41-.56-.42l-.48-.01c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"
  })),
  languages: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"
  })),
  wallet2: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M21 12V7H5a2 2 0 0 1 0-4h14v4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 5v14a2 2 0 0 0 2 2h16v-5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 12a2 2 0 0 0 0 4h4v-4z"
  })),
  globe: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    y1: "12",
    x2: "22",
    y2: "12"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
  })),
  split: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"
  })),
  grad: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M22 10v6M2 10l10-5 10 5-10 5z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"
  })),
  check: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16,
    strokeWidth: 3
  }, p), /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })),
  search: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 18
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65"
  })),
  sun: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"
  })),
  moon: p => /*#__PURE__*/React.createElement(Icon, _extends({}, p, {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })),
  grid: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "9",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "5",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "12",
    width: "7",
    height: "9",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "16",
    width: "7",
    height: "5",
    rx: "1"
  })),
  receiptText: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "14 2 14 8 20 8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "13",
    x2: "8",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "17",
    x2: "8",
    y2: "17"
  })),
  checkSquare: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "14 2 14 8 20 8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m9 15 2 2 4-4"
  })),
  cart: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "6",
    x2: "21",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "12",
    x2: "21",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "18",
    x2: "21",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "6",
    x2: "3.01",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "12",
    x2: "3.01",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "18",
    x2: "3.01",
    y2: "18"
  })),
  wallet: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h14v4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 6v12a2 2 0 0 0 2 2h14v-4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 12a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4v-6h-4z"
  })),
  settings: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
  })),
  terminal: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 20
  }, p), /*#__PURE__*/React.createElement("polyline", {
    points: "4 17 10 11 4 5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "19",
    x2: "20",
    y2: "19"
  })),
  clock: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 8v4l3 3"
  })),
  alert: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "9",
    x2: "12",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12.01",
    y2: "17"
  })),
  reload: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 13
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"
  })),
  crown: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 12
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "m5 16-3-8 5.5 5L12 4l4.5 9L22 8l-3 8H5Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 20h14"
  })),
  share: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 15
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "5",
    r: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "19",
    r: "3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8.59",
    y1: "13.51",
    x2: "15.42",
    y2: "17.49"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "15.41",
    y1: "6.51",
    x2: "8.59",
    y2: "10.49"
  })),
  trash: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 15
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"
  })),
  logout: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "16 17 21 12 16 7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "12",
    x2: "9",
    y2: "12"
  })),
  lock2: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16
  }, p), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "11",
    width: "18",
    height: "11",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 11V7a5 5 0 0 1 10 0v4"
  })),
  mail: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 16
  }, p), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "4",
    width: "20",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m22 7-10 5L2 7"
  })),
  mailCheck: p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
    d: "M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m2 7 10 5 10-5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m16 19 2 2 4-4"
  })),
  fingerprint: p => /*#__PURE__*/React.createElement(Icon, _extends({
    size: 18
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 13.12c0 2.38 0 6.38-1 8.88"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17.29 21.02c.12-.6.43-2.3.5-3.02"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 12a10 10 0 0 1 18-6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 16h.01"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21.8 16c.2-2 .131-5.354 0-6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.65 22c.21-.66.45-1.32.57-2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 6.8a6 6 0 0 1 9 5.2v2"
  }))
};
window.WobblioIcons = Icons;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/kit-icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/kit-landing.jsx
try { (() => {
/* Wobblio marketing landing screen */
const {
  Button: WBtn,
  Badge: WBadge,
  Card: WCard
} = window.WobblioDesignSystem_6a8d64;
const I = window.WobblioIcons;
function HeroMockup() {
  const [state, setState] = React.useState('idle'); // idle | scanning | done
  const items = [['Organic Whole Milk 1L', '€3.89'], ['Free Range Eggs (12)', '€4.25'], ['Sourdough Bread 800g', '€2.99']];
  const run = () => {
    if (state === 'scanning') return;
    setState('scanning');
    setTimeout(() => setState('done'), 1500);
  };
  return /*#__PURE__*/React.createElement(WCard, {
    className: "interactive-mockup"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mockup-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "mockup-store-name"
  }, "Lidl \u2014 Lisbon Norte"), /*#__PURE__*/React.createElement("span", {
    className: "mockup-date"
  }, "25 May 2026")), /*#__PURE__*/React.createElement(WBadge, {
    tone: state === 'done' ? 'success' : 'warning'
  }, state === 'done' ? 'Processed' : 'Scanning')), state !== 'done' ? /*#__PURE__*/React.createElement("div", {
    className: "upload-dropzone",
    onClick: run
  }, /*#__PURE__*/React.createElement("div", {
    className: "upload-icon"
  }, /*#__PURE__*/React.createElement(I.upload, {
    size: 32
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text-primary)',
      marginBottom: 4
    }
  }, state === 'scanning' ? 'Reading receipt…' : 'Click to scan a receipt'), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, state === 'scanning' ? 'AI extracting line items' : 'Simulate AI parsing instantly')) : /*#__PURE__*/React.createElement("div", {
    className: "mockup-item-list"
  }, items.map(([n, p]) => /*#__PURE__*/React.createElement("div", {
    className: "mockup-item",
    key: n
  }, /*#__PURE__*/React.createElement("span", {
    className: "mockup-item-name"
  }, n), /*#__PURE__*/React.createElement("span", {
    className: "mockup-item-price"
  }, p)))), /*#__PURE__*/React.createElement("div", {
    className: "mockup-footer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mockup-total-label"
  }, "Total"), /*#__PURE__*/React.createElement("span", {
    className: "mockup-total-value"
  }, "\u20AC11.13")));
}
const FEATURES = [{
  icon: 'camera',
  title: 'AI Ingestion',
  desc: 'Drag and drop receipt photos. AI extracts merchant names, product descriptions, quantities, and prices in seconds.'
}, {
  icon: 'trend',
  title: 'Price Trends',
  desc: 'Interactive charts show how your everyday items fluctuate across local chains over time.'
}, {
  icon: 'box',
  title: 'List Optimizer',
  desc: 'Build a list and compare store prices — get the cheapest local store recommendations instantly.'
}];
const USE_CASES = [{
  icon: 'users',
  title: 'One family, one picture of the money',
  hook: '"Alerts before the budget breaks — not a post-mortem after."',
  desc: 'Share uploads across household members. Track combined totals and trigger warnings before you overspend.'
}, {
  icon: 'trend',
  title: 'Inflation is personal',
  hook: '"See exactly which store raised which price — and shop around with proof."',
  desc: 'Map price details across brands and chains. Watch charts creep up and find where items are cheapest.'
}, {
  icon: 'split',
  title: 'One photo. Tap who had what',
  hook: '"Fair split — including the tip — in your group chat in 30 seconds."',
  desc: 'Split restaurant bills proportionally. Allocates service and tip automatically, then exports to WhatsApp.'
}, {
  icon: 'globe',
  title: 'Three countries, one budget',
  hook: '"Every receipt converted on the day you paid — not when your bank felt like it."',
  desc: 'Scan foreign receipts on the go. Converts currencies on the transaction date, with zero bank lag.'
}];
function Landing({
  onStart,
  onLogin
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("section", {
    className: "hero-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-content"
  }, /*#__PURE__*/React.createElement(WBadge, {
    tone: "primary"
  }, "Smart Expense Ingestion"), /*#__PURE__*/React.createElement("h1", {
    className: "hero-title"
  }, "Scan your receipts. Outsmart inflation."), /*#__PURE__*/React.createElement("p", {
    className: "hero-description"
  }, "Wobblio reads any receipt with AI \u2014 automatic expense tracking, real local price comparison, and shopping lists that know the cheapest store. No bank access. Ever."), /*#__PURE__*/React.createElement("div", {
    className: "hero-actions"
  }, /*#__PURE__*/React.createElement(WBtn, {
    variant: "primary",
    size: "lg",
    iconRight: /*#__PURE__*/React.createElement(I.arrow, null),
    onClick: onStart
  }, "Start Ingesting Free")), /*#__PURE__*/React.createElement("div", {
    className: "landing-stats-grid"
  }, [['OCR Scan Speed', '< 8 sec'], ['Privacy Level', '100% Private'], ['GDPR Status', 'Fully Ready']].map(([l, v]) => /*#__PURE__*/React.createElement(WCard, {
    className: "landing-stat-card",
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    className: "landing-stat-label"
  }, l), /*#__PURE__*/React.createElement("div", {
    className: "landing-stat-value"
  }, v))))), /*#__PURE__*/React.createElement("div", {
    className: "hero-visual"
  }, /*#__PURE__*/React.createElement(HeroMockup, null))), /*#__PURE__*/React.createElement("section", {
    className: "trust-strip"
  }, /*#__PURE__*/React.createElement("div", {
    className: "trust-strip-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "trust-item"
  }, /*#__PURE__*/React.createElement(I.shieldCheck, null), " No bank connection required"), /*#__PURE__*/React.createElement("div", {
    className: "trust-item"
  }, /*#__PURE__*/React.createElement(I.calendar, null), " GDPR-compliant, EU-hosted, delete anytime"), /*#__PURE__*/React.createElement("div", {
    className: "trust-item"
  }, /*#__PURE__*/React.createElement(I.lock, null), " Only anonymized prices are ever shared"))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement(WBadge, {
    tone: "primary"
  }, "Capabilities"), /*#__PURE__*/React.createElement("h2", {
    className: "section-title"
  }, "Designed for household intelligence"), /*#__PURE__*/React.createElement("p", {
    className: "section-subtitle"
  }, "From AI extraction to price trends \u2014 the entire flow runs automatically.")), /*#__PURE__*/React.createElement("div", {
    className: "features-grid"
  }, FEATURES.map(f => {
    const Ico = I[f.icon];
    return /*#__PURE__*/React.createElement(WCard, {
      interactive: true,
      className: "feature-card",
      key: f.title
    }, /*#__PURE__*/React.createElement("div", {
      className: "feature-icon"
    }, /*#__PURE__*/React.createElement(Ico, {
      size: 24
    })), /*#__PURE__*/React.createElement("div", {
      className: "feature-title"
    }, f.title), /*#__PURE__*/React.createElement("div", {
      className: "feature-desc"
    }, f.desc));
  }))), /*#__PURE__*/React.createElement("section", {
    className: "section",
    style: {
      paddingTop: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement(WBadge, {
    tone: "primary"
  }, "Use Cases"), /*#__PURE__*/React.createElement("h2", {
    className: "section-title"
  }, "Built for how you actually spend"), /*#__PURE__*/React.createElement("p", {
    className: "section-subtitle"
  }, "Wobblio adapts to your lifestyle \u2014 household, travel, or local savings hunting.")), /*#__PURE__*/React.createElement("div", {
    className: "use-cases-grid"
  }, USE_CASES.map(u => {
    const Ico = I[u.icon];
    return /*#__PURE__*/React.createElement(WCard, {
      interactive: true,
      className: "use-case-card",
      key: u.title
    }, /*#__PURE__*/React.createElement("div", {
      className: "use-case-icon"
    }, /*#__PURE__*/React.createElement(Ico, {
      size: 22
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "use-case-title"
    }, u.title), /*#__PURE__*/React.createElement("span", {
      className: "use-case-hook"
    }, u.hook), /*#__PURE__*/React.createElement("div", {
      className: "use-case-desc"
    }, u.desc)));
  }))), /*#__PURE__*/React.createElement("section", {
    className: "section",
    style: {
      paddingTop: 0,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement(WBadge, {
    tone: "primary"
  }, "Pricing"), /*#__PURE__*/React.createElement("h2", {
    className: "section-title"
  }, "Ready to start saving?")), /*#__PURE__*/React.createElement("div", {
    className: "pricing-grid"
  }, /*#__PURE__*/React.createElement(WCard, {
    className: "pricing-card"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pricing-title"
  }, "Standard"), /*#__PURE__*/React.createElement("p", {
    className: "pricing-desc"
  }, "Perfect for basic receipt tracking."), /*#__PURE__*/React.createElement("div", {
    className: "pricing-price"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pricing-currency"
  }, "\u20AC"), /*#__PURE__*/React.createElement("span", {
    className: "pricing-amount"
  }, "0"), /*#__PURE__*/React.createElement("span", {
    className: "pricing-period"
  }, "/mo")), /*#__PURE__*/React.createElement("ul", {
    className: "pricing-features"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(I.check, null), " 10 scans per month"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(I.check, null), " Standard AI ingestion"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(I.check, null), " Single-user workspace")), /*#__PURE__*/React.createElement(WBtn, {
    variant: "outline",
    onClick: onStart
  }, "Get Started")), /*#__PURE__*/React.createElement(WCard, {
    className: "pricing-card premium"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pricing-title"
  }, "Household Pro"), /*#__PURE__*/React.createElement("p", {
    className: "pricing-desc"
  }, "Complete sync for active families."), /*#__PURE__*/React.createElement("div", {
    className: "pricing-price"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pricing-currency"
  }, "\u20AC"), /*#__PURE__*/React.createElement("span", {
    className: "pricing-amount"
  }, "8"), /*#__PURE__*/React.createElement("span", {
    className: "pricing-period"
  }, "/mo")), /*#__PURE__*/React.createElement("ul", {
    className: "pricing-features"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(I.check, null), " Unlimited scans"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(I.check, null), " Shared household pool"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(I.check, null), " List optimizer & store comparisons"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement(I.check, null), " WhatsApp reports & exports")), /*#__PURE__*/React.createElement(WBtn, {
    variant: "primary",
    onClick: onStart
  }, "Upgrade Now")))));
}
window.WobblioLanding = Landing;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/kit-landing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/kit-login.jsx
try { (() => {
/* Wobblio auth — Sign in screen (faithful to Source/webapp (auth)/login) */
const {
  Card: LgCard,
  Button: LgBtn,
  Input: LgInput,
  Checkbox: LgCheck,
  WobblioLogo: LgLogo
} = window.WobblioDesignSystem_6a8d64;
const LI = window.WobblioIcons;
function Login({
  onSignIn,
  onRegister
}) {
  const [loading, setLoading] = React.useState(false);
  const submit = e => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSignIn && onSignIn();
    }, 850);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "auth-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-card glass"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-brand"
  }, /*#__PURE__*/React.createElement(LgLogo, {
    size: 30,
    withWordmark: true
  })), /*#__PURE__*/React.createElement("h1", {
    className: "auth-title"
  }, "Welcome back"), /*#__PURE__*/React.createElement("p", {
    className: "auth-sub"
  }, "Sign in to your household workspace."), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    className: "auth-form",
    noValidate: true
  }, /*#__PURE__*/React.createElement(LgInput, {
    label: "Email",
    type: "email",
    name: "email",
    autoComplete: "email",
    icon: /*#__PURE__*/React.createElement(LI.mail, null),
    placeholder: "you@example.com",
    required: true
  }), /*#__PURE__*/React.createElement(LgInput, {
    label: "Password",
    type: "password",
    name: "password",
    autoComplete: "current-password",
    icon: /*#__PURE__*/React.createElement(LI.lock2, null),
    placeholder: "Enter your password",
    required: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "auth-row"
  }, /*#__PURE__*/React.createElement(LgCheck, {
    defaultChecked: true,
    label: "Remember me"
  }), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "auth-link",
    onClick: e => e.preventDefault()
  }, "Forgot your password?")), /*#__PURE__*/React.createElement(LgBtn, {
    type: "submit",
    variant: "primary",
    disabled: loading,
    style: {
      width: '100%'
    },
    iconLeft: loading ? null : /*#__PURE__*/React.createElement(LI.logout, null)
  }, loading ? 'Signing in…' : 'Sign in')), /*#__PURE__*/React.createElement("p", {
    className: "auth-foot"
  }, "Don't have an account? ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "auth-link strong",
    onClick: e => {
      e.preventDefault();
      onRegister && onRegister();
    }
  }, "Create one"))), /*#__PURE__*/React.createElement("p", {
    className: "auth-legal"
  }, /*#__PURE__*/React.createElement(LI.shieldCheck, {
    size: 14
  }), " Protected by row-level security \xB7 GDPR-compliant \xB7 EU-hosted"));
}
window.WobblioLogin = Login;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/kit-login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/kit-register.jsx
try { (() => {
/* Wobblio auth — Create account screen (matches kit-login.jsx) */
const {
  Button: RgBtn,
  Input: RgInput,
  Checkbox: RgCheck,
  WobblioLogo: RgLogo
} = window.WobblioDesignSystem_6a8d64;
const RI = window.WobblioIcons;

// Lightweight password strength scoring (0–4).
function scorePassword(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[0-9]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const STRENGTH = [{
  label: '',
  tone: ''
}, {
  label: 'Weak',
  tone: 'danger'
}, {
  label: 'Fair',
  tone: 'warning'
}, {
  label: 'Good',
  tone: 'warning'
}, {
  label: 'Strong',
  tone: 'success'
}];

// Country → display currency. Drives the read-only currency field.
const COUNTRIES = [{
  code: 'NL',
  name: 'Netherlands',
  currency: 'EUR',
  symbol: '€'
}, {
  code: 'BE',
  name: 'Belgium',
  currency: 'EUR',
  symbol: '€'
}, {
  code: 'DE',
  name: 'Germany',
  currency: 'EUR',
  symbol: '€'
}, {
  code: 'PT',
  name: 'Portugal',
  currency: 'EUR',
  symbol: '€'
}, {
  code: 'FR',
  name: 'France',
  currency: 'EUR',
  symbol: '€'
}, {
  code: 'GB',
  name: 'United Kingdom',
  currency: 'GBP',
  symbol: '£'
}, {
  code: 'US',
  name: 'United States',
  currency: 'USD',
  symbol: '$'
}, {
  code: 'CH',
  name: 'Switzerland',
  currency: 'CHF',
  symbol: 'Fr'
}, {
  code: 'SE',
  name: 'Sweden',
  currency: 'SEK',
  symbol: 'kr'
}, {
  code: 'DK',
  name: 'Denmark',
  currency: 'DKK',
  symbol: 'kr'
}, {
  code: 'BR',
  name: 'Brazil',
  currency: 'BRL',
  symbol: 'R$'
}];
const LANGUAGES = ['English', 'Nederlands', 'Deutsch', 'Português', 'Français', 'Español'];

// Labeled <select> styled to match the DS Input.
function AuthSelect({
  label,
  icon,
  value,
  onChange,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "auth-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "auth-field-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "auth-control-wrap"
  }, icon && /*#__PURE__*/React.createElement("span", {
    className: "lead-icon"
  }, icon), /*#__PURE__*/React.createElement("select", {
    className: "auth-select",
    value: value,
    onChange: onChange
  }, children), /*#__PURE__*/React.createElement("span", {
    className: "chevron"
  }, /*#__PURE__*/React.createElement(RI.chevronDown, null))));
}

// Read-only derived display (e.g. currency from country).
function AuthStatic({
  label,
  icon,
  value,
  hint
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "auth-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "auth-field-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "auth-control-wrap"
  }, icon && /*#__PURE__*/React.createElement("span", {
    className: "lead-icon"
  }, icon), /*#__PURE__*/React.createElement("div", {
    className: "auth-static",
    "aria-readonly": "true"
  }, /*#__PURE__*/React.createElement("span", null, value), hint && /*#__PURE__*/React.createElement("span", {
    className: "auto-tag"
  }, "Auto"))));
}
function Register({
  onSignUp,
  onBack,
  fields = {}
}) {
  const f = {
    confirmPassword: fields.confirmPassword !== false,
    birthdate: fields.birthdate !== false,
    country: fields.country !== false,
    language: fields.language !== false
  };
  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [country, setCountry] = React.useState('NL');
  const [language, setLanguage] = React.useState('English');
  const [agreed, setAgreed] = React.useState(false);
  const score = scorePassword(pw);
  const meter = STRENGTH[score];
  const selected = COUNTRIES.find(c => c.code === country) || COUNTRIES[0];
  const mismatch = f.confirmPassword && confirm.length > 0 && confirm !== pw;
  const blocked = !agreed || mismatch;
  const submit = e => {
    e.preventDefault();
    if (loading || blocked) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSignUp && onSignUp(email || 'you@example.com');
    }, 900);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "auth-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-card glass"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-brand"
  }, /*#__PURE__*/React.createElement(RgLogo, {
    size: 30,
    withWordmark: true
  })), /*#__PURE__*/React.createElement("h1", {
    className: "auth-title"
  }, "Create your account"), /*#__PURE__*/React.createElement("p", {
    className: "auth-sub"
  }, "Start tracking your household in minutes."), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    className: "auth-form",
    noValidate: true
  }, /*#__PURE__*/React.createElement(RgInput, {
    label: "Full name",
    type: "text",
    name: "name",
    autoComplete: "name",
    icon: /*#__PURE__*/React.createElement(RI.user, null),
    placeholder: "Antonio Reuter",
    required: true
  }), /*#__PURE__*/React.createElement(RgInput, {
    label: "Email",
    type: "email",
    name: "email",
    autoComplete: "email",
    icon: /*#__PURE__*/React.createElement(RI.mail, null),
    placeholder: "you@example.com",
    required: true,
    value: email,
    onChange: e => setEmail(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "pw-field"
  }, /*#__PURE__*/React.createElement(RgInput, {
    label: "Password",
    type: "password",
    name: "password",
    autoComplete: "new-password",
    icon: /*#__PURE__*/React.createElement(RI.lock2, null),
    placeholder: "At least 8 characters",
    required: true,
    value: pw,
    onChange: e => setPw(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "pw-meter",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-track"
  }, [1, 2, 3, 4].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: `pw-seg ${i <= score ? 'on tone-' + meter.tone : ''}`
  }))), meter.label && /*#__PURE__*/React.createElement("span", {
    className: "pw-label",
    style: {
      color: `var(--${meter.tone})`
    }
  }, meter.label))), f.confirmPassword && /*#__PURE__*/React.createElement("div", {
    className: "pw-field"
  }, /*#__PURE__*/React.createElement(RgInput, {
    label: "Confirm password",
    type: "password",
    name: "confirmPassword",
    autoComplete: "new-password",
    icon: /*#__PURE__*/React.createElement(RI.lock2, null),
    placeholder: "Re-enter your password",
    required: true,
    flagged: mismatch,
    value: confirm,
    onChange: e => setConfirm(e.target.value)
  }), mismatch && /*#__PURE__*/React.createElement("span", {
    className: "field-error"
  }, "Passwords don\u2019t match.")), f.birthdate && /*#__PURE__*/React.createElement(RgInput, {
    label: "Date of birth",
    type: "date",
    name: "birthdate",
    icon: /*#__PURE__*/React.createElement(RI.calendar, null),
    required: true
  }), f.country && /*#__PURE__*/React.createElement("div", {
    className: "auth-grid-2"
  }, /*#__PURE__*/React.createElement(AuthSelect, {
    label: "Country",
    icon: /*#__PURE__*/React.createElement(RI.globe, null),
    value: country,
    onChange: e => setCountry(e.target.value)
  }, COUNTRIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.code,
    value: c.code
  }, c.name))), /*#__PURE__*/React.createElement(AuthStatic, {
    label: "Display currency",
    icon: /*#__PURE__*/React.createElement(RI.wallet2, null),
    value: `${selected.currency} · ${selected.symbol}`,
    hint: true
  })), f.language && /*#__PURE__*/React.createElement(AuthSelect, {
    label: "Preferred language",
    icon: /*#__PURE__*/React.createElement(RI.languages, null),
    value: language,
    onChange: e => setLanguage(e.target.value)
  }, LANGUAGES.map(l => /*#__PURE__*/React.createElement("option", {
    key: l,
    value: l
  }, l))), /*#__PURE__*/React.createElement("label", {
    className: "auth-consent"
  }, /*#__PURE__*/React.createElement(RgCheck, {
    checked: agreed,
    onChange: e => setAgreed(e.target.checked)
  }), /*#__PURE__*/React.createElement("span", null, "I agree to the ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "auth-link strong",
    onClick: e => e.preventDefault()
  }, "Terms"), " and", ' ', /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "auth-link strong",
    onClick: e => e.preventDefault()
  }, "Privacy Policy"), ".")), /*#__PURE__*/React.createElement(RgBtn, {
    type: "submit",
    variant: "primary",
    disabled: loading || blocked,
    style: {
      width: '100%'
    },
    iconLeft: loading ? null : /*#__PURE__*/React.createElement(RI.user, null)
  }, loading ? 'Creating account…' : 'Create account')), /*#__PURE__*/React.createElement("p", {
    className: "auth-foot"
  }, "Already have an account? ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "auth-link strong",
    onClick: e => {
      e.preventDefault();
      onBack && onBack();
    }
  }, "Sign in"))), /*#__PURE__*/React.createElement("p", {
    className: "auth-legal"
  }, /*#__PURE__*/React.createElement(RI.shieldCheck, {
    size: 14
  }), " Protected by row-level security \xB7 GDPR-compliant \xB7 EU-hosted"));
}
window.WobblioRegister = Register;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/kit-register.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/kit-verify.jsx
try { (() => {
/* Wobblio auth — Email verification code (OTP) screen */
const {
  Button: VfBtn,
  WobblioLogo: VfLogo
} = window.WobblioDesignSystem_6a8d64;
const VI = window.WobblioIcons;
const OTP_LEN = 6;
function Verify({
  email = 'you@example.com',
  onVerified,
  onBack
}) {
  // Demo: a code is "emailed". Stored so we can show an error on mismatch + a dev hint.
  const [sentCode, setSentCode] = React.useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [digits, setDigits] = React.useState(Array(OTP_LEN).fill(''));
  const [status, setStatus] = React.useState('idle'); // idle | verifying | error
  const [seconds, setSeconds] = React.useState(30);
  const refs = React.useRef([]);
  React.useEffect(() => {
    refs.current[0] && refs.current[0].focus();
  }, []);
  React.useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);
  const code = digits.join('');
  const complete = code.length === OTP_LEN && digits.every(d => d !== '');
  const setDigit = (i, val) => {
    const v = val.replace(/\D/g, '');
    setStatus('idle');
    setDigits(prev => {
      const next = [...prev];
      if (v.length > 1) {
        // paste / multi-char: distribute from this index
        for (let k = 0; k < v.length && i + k < OTP_LEN; k++) next[i + k] = v[k];
        const last = Math.min(i + v.length, OTP_LEN - 1);
        setTimeout(() => refs.current[last] && refs.current[last].focus(), 0);
      } else {
        next[i] = v;
        if (v && i < OTP_LEN - 1) setTimeout(() => refs.current[i + 1] && refs.current[i + 1].focus(), 0);
      }
      return next;
    });
  };
  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1] && refs.current[i - 1].focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1].focus();
    } else if (e.key === 'ArrowRight' && i < OTP_LEN - 1) {
      refs.current[i + 1].focus();
    }
  };
  const runVerify = React.useCallback(() => {
    setStatus('verifying');
    setTimeout(() => {
      setDigits(cur => {
        if (cur.join('') === sentCode) {
          onVerified && onVerified();
        } else {
          setStatus('error');
        }
        return cur;
      });
    }, 800);
  }, [sentCode, onVerified]);
  const submit = e => {
    e.preventDefault();
    if (!complete || status === 'verifying') return;
    runVerify();
  };

  // Auto-submit once all six digits are entered.
  React.useEffect(() => {
    if (complete && status === 'idle') runVerify();
  }, [complete, status, runVerify]);
  const resend = () => {
    if (seconds > 0) return;
    setSentCode(String(Math.floor(100000 + Math.random() * 900000)));
    setDigits(Array(OTP_LEN).fill(''));
    setStatus('idle');
    setSeconds(30);
    refs.current[0] && refs.current[0].focus();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "auth-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-card glass"
  }, /*#__PURE__*/React.createElement("div", {
    className: "auth-brand"
  }, /*#__PURE__*/React.createElement(VfLogo, {
    size: 30,
    withWordmark: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "verify-icon"
  }, /*#__PURE__*/React.createElement(VI.mailCheck, {
    size: 26
  })), /*#__PURE__*/React.createElement("h1", {
    className: "auth-title"
  }, "Check your email"), /*#__PURE__*/React.createElement("p", {
    className: "auth-sub"
  }, "Enter the 6-digit code we sent to ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--text-primary)'
    }
  }, email), " to finish setting up your account."), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    className: "auth-form",
    noValidate: true
  }, /*#__PURE__*/React.createElement("div", {
    className: `otp-row ${status === 'error' ? 'otp-error' : ''}`,
    onPaste: e => {
      e.preventDefault();
      setDigit(0, (e.clipboardData.getData('text') || '').trim());
    }
  }, digits.map((d, i) => /*#__PURE__*/React.createElement("input", {
    key: i,
    ref: el => refs.current[i] = el,
    className: `otp-input ${d ? 'filled' : ''}`,
    inputMode: "numeric",
    autoComplete: i === 0 ? 'one-time-code' : 'off',
    maxLength: 1,
    value: d,
    "aria-label": `Digit ${i + 1}`,
    onChange: e => setDigit(i, e.target.value),
    onKeyDown: e => onKeyDown(i, e)
  }))), status === 'error' && /*#__PURE__*/React.createElement("span", {
    className: "field-error",
    style: {
      textAlign: 'center'
    }
  }, "That code isn\u2019t right. Check your email and try again."), /*#__PURE__*/React.createElement(VfBtn, {
    type: "submit",
    variant: "primary",
    disabled: !complete || status === 'verifying',
    style: {
      width: '100%'
    },
    iconLeft: status === 'verifying' ? null : /*#__PURE__*/React.createElement(VI.check, null)
  }, status === 'verifying' ? 'Verifying…' : 'Verify & continue')), /*#__PURE__*/React.createElement("p", {
    className: "auth-foot"
  }, "Didn\u2019t get it?", ' ', seconds > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)'
    }
  }, "Resend code in ", seconds, "s") : /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "auth-link strong",
    onClick: e => {
      e.preventDefault();
      resend();
    }
  }, "Resend code")), /*#__PURE__*/React.createElement("p", {
    className: "auth-foot",
    style: {
      marginTop: 8
    }
  }, "Wrong address? ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "auth-link strong",
    onClick: e => {
      e.preventDefault();
      onBack && onBack();
    }
  }, "Go back")), /*#__PURE__*/React.createElement("p", {
    className: "verify-hint"
  }, "Demo code: ", /*#__PURE__*/React.createElement("code", null, sentCode))), /*#__PURE__*/React.createElement("p", {
    className: "auth-legal"
  }, /*#__PURE__*/React.createElement(VI.shieldCheck, {
    size: 14
  }), " Protected by row-level security \xB7 GDPR-compliant \xB7 EU-hosted"));
}
window.WobblioVerify = Verify;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/kit-verify.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/kit-workspace.jsx
try { (() => {
/* Wobblio workspace — dashboard + invoices */
const {
  Card: WkCard,
  Badge: WkBadge,
  Tag: WkTag,
  Button: WkBtn,
  Avatar: WkAvatar,
  WobblioLogo: WkLogo,
  MerchantIcon: WkMerchant,
  MetricCard: WkMetric,
  ProgressBar: WkBar
} = window.WobblioDesignSystem_6a8d64;
const WI = window.WobblioIcons;
const RAIL = [['grid', 'Dashboard'], ['receiptText', 'Invoices'], ['checkSquare', 'Awaiting Check'], ['trend', 'Price Trends'], ['cart', 'Shopping Lists'], ['wallet', 'Budgets'], ['users', 'Household'], ['settings', 'Settings'], ['terminal', 'Console']];
const CATEGORIES = ['Groceries', 'Bar & Restaurants', 'Transport', 'Drugstore', 'Others'];
const MERCHANTS = ['Albert Heijn', 'AH To Go', 'Jumbo Oostpoort', 'Dirk van den Broek', 'Lidl', 'Tokomania', 'Restaurante Cantinho'];
const STATUSES = [['success', 'Processed'], ['warning', 'Needs Review'], ['primary', 'Auto Parsed']];
const TODAY = new Date('2026-06-13');

// Full ledger, generated deterministically so "Load more" has real depth.
const TAG_POOL = ['dinner', 'weekly', 'commute', 'pantry', 'treat', 'household', 'fuel', 'organic'];
const ALL_TAGS = TAG_POOL;
function buildInvoices() {
  const out = [];
  let day = 1;
  for (let k = 0; k < 42; k++) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - day);
    const tags = [...new Set([TAG_POOL[k % TAG_POOL.length], TAG_POOL[(k * 2 + 1) % TAG_POOL.length]])];
    out.push({
      id: k + 1,
      merchant: MERCHANTS[k * 3 % MERCHANTS.length],
      category: CATEGORIES[k % CATEGORIES.length],
      dateISO: d.toISOString().slice(0, 10),
      status: STATUSES[k % STATUSES.length],
      tags,
      total: Math.round((8 + k * 7.37 % 72) * 100) / 100
    });
    day += 1 + k % 3;
  }
  return out;
}
const INVOICE_DB = buildInvoices();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = iso => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const eur = n => '€' + n.toFixed(2);
const daysAgo = n => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d;
};
const SPEND = [['Groceries', 248.6, 150], ['Bar & Restaurants', 162.4, 98], ['Transport', 98.2, 59], ['Drugstore', 74.8, 45], ['Others', 58.3, 35]];
const BUDGETS = [{
  name: 'Groceries',
  pct: 76
}, {
  name: 'Bar & Restaurants',
  pct: 104
}, {
  name: 'Transport',
  pct: 51
}, {
  name: 'Drugstore',
  pct: 88
}];
const budgetColor = pct => pct >= 100 ? 'danger' : pct >= 85 ? 'warning' : 'success';
const BUDGET_TOTAL = BUDGETS.length;
const BUDGET_NEAR = BUDGETS.filter(b => b.pct >= 85 && b.pct < 100).length;
const OVER_BUDGET = BUDGETS.filter(b => b.pct >= 100).length;
const INVOICES_THIS_WEEK = 9;
const WEEKLY_LIMIT = 15;

/* ---- Shared invoice table (used by Dashboard + Invoices) ---- */
function InvoiceTable({
  invoices,
  onRemove,
  onOpen,
  onRequestDelete,
  onShare,
  loading,
  skeletonRows = 5
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "table-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    className: "app-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Merchant"), /*#__PURE__*/React.createElement("th", {
    className: "col-cat"
  }, "Category"), /*#__PURE__*/React.createElement("th", null, "Date"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "col-tags"
  }, "Tags"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Total"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, loading && Array.from({
    length: skeletonRows
  }).map((_, i) => /*#__PURE__*/React.createElement("tr", {
    key: `sk-${i}`,
    className: "skeleton-row"
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "merchant-cell"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sk sk-avatar"
  }), " ", /*#__PURE__*/React.createElement("span", {
    className: "sk sk-line",
    style: {
      width: 120
    }
  }))), /*#__PURE__*/React.createElement("td", {
    className: "col-cat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sk sk-line",
    style: {
      width: 80
    }
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "sk sk-line",
    style: {
      width: 78
    }
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "sk sk-pill"
  })), /*#__PURE__*/React.createElement("td", {
    className: "col-tags"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sk sk-line",
    style: {
      width: 60
    }
  })), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sk sk-line",
    style: {
      width: 52,
      marginLeft: 'auto'
    }
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "sk sk-line",
    style: {
      width: 48,
      marginLeft: 'auto'
    }
  })))), !loading && invoices.map(inv => /*#__PURE__*/React.createElement("tr", {
    key: inv.id,
    onClick: () => onOpen && onOpen(inv)
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "merchant-cell"
  }, /*#__PURE__*/React.createElement("span", {
    className: "m-icon"
  }, /*#__PURE__*/React.createElement(WkMerchant, {
    merchant: inv.merchant
  })), " ", /*#__PURE__*/React.createElement("span", {
    className: "m-name"
  }, inv.merchant))), /*#__PURE__*/React.createElement("td", {
    className: "col-cat"
  }, inv.category), /*#__PURE__*/React.createElement("td", null, fmtDate(inv.dateISO)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(WkBadge, {
    tone: inv.status[0]
  }, inv.status[1])), /*#__PURE__*/React.createElement("td", {
    className: "col-tags"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tag-row"
  }, inv.tags.map(t => /*#__PURE__*/React.createElement(WkTag, {
    key: t
  }, t)))), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, eur(inv.total)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "row-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "row-action",
    title: "Share invoice",
    onClick: e => {
      e.stopPropagation();
      onShare && onShare(inv);
    }
  }, /*#__PURE__*/React.createElement(WI.share, null)), /*#__PURE__*/React.createElement("button", {
    className: "row-action danger",
    title: "Delete invoice",
    onClick: e => {
      e.stopPropagation();
      onRequestDelete(inv);
    }
  }, /*#__PURE__*/React.createElement(WI.trash, null)))))), !loading && invoices.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 7
  }, /*#__PURE__*/React.createElement("div", {
    className: "table-empty"
  }, /*#__PURE__*/React.createElement(WI.receiptText, {
    size: 26
  }), /*#__PURE__*/React.createElement("span", null, "No invoices match your selected filters.")))))));
}

/* ---- Styled filter select ---- */
function FilterSelect({
  label,
  icon,
  value,
  onChange,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "filter-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "filter-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "filter-wrap"
  }, icon && /*#__PURE__*/React.createElement("span", {
    className: "lead-icon"
  }, icon), /*#__PURE__*/React.createElement("select", {
    className: "filter-select",
    value: value,
    onChange: onChange
  }, children), /*#__PURE__*/React.createElement("span", {
    className: "chevron"
  }, /*#__PURE__*/React.createElement(WI.chevronDown, null))));
}

/* ---- Dashboard pane ---- */
function SpendChart() {
  return /*#__PURE__*/React.createElement(WkCard, {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-header",
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "panel-title"
  }, "Spending by Category"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, "June 2026")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-secondary)',
      marginBottom: 20
    }
  }, "How your ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--text-primary)'
    }
  }, "\u20AC642.30"), " broke down across expense types."), /*#__PURE__*/React.createElement("div", {
    className: "spend-chart"
  }, SPEND.map(([label, val, h]) => /*#__PURE__*/React.createElement("div", {
    className: "spend-col",
    key: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "spend-val"
  }, "\u20AC", Math.round(val)), /*#__PURE__*/React.createElement("div", {
    className: "spend-bar",
    style: {
      height: h
    },
    title: `${label}: €${val.toFixed(2)}`
  }), /*#__PURE__*/React.createElement("div", {
    className: "spend-label"
  }, label)))));
}
function DashboardPane({
  invoices,
  onRemove,
  onOpen,
  onRequestDelete,
  onShare,
  onScan,
  onViewAll,
  loading,
  refreshing,
  onRefresh
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "pane"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "pane-title"
  }, "Your Everyday Savings"), /*#__PURE__*/React.createElement("p", {
    className: "pane-subtitle"
  }, "Overview of your household expenses and price trends."), /*#__PURE__*/React.createElement("div", {
    className: "metrics-row"
  }, loading ? [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
    className: "glass",
    style: {
      padding: 'var(--space-5)'
    },
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "sk sk-line",
    style: {
      width: 90,
      height: 11
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "sk sk-line",
    style: {
      width: 120,
      height: 26,
      margin: '12px 0 8px'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "sk sk-line",
    style: {
      width: 140,
      height: 10
    }
  }))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(WkMetric, {
    label: "Spent This Month",
    value: "\u20AC642.30",
    delta: "\u2193 11.8% vs \u20AC728.42 last month",
    tone: "success"
  }), /*#__PURE__*/React.createElement(WkMetric, {
    label: "Needs Check",
    value: "3 items",
    delta: "1 receipt needs verification",
    tone: "warning"
  }), /*#__PURE__*/React.createElement(WkMetric, {
    label: "Processed This Month",
    value: "24",
    delta: "receipts scanned in June",
    tone: "neutral"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dash-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement(SpendChart, null), /*#__PURE__*/React.createElement(WkCard, {
    className: "panel",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-header",
    style: {
      padding: '20px 24px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "panel-title"
  }, "Recent Invoices"), /*#__PURE__*/React.createElement("div", {
    className: "panel-actions"
  }, /*#__PURE__*/React.createElement(WkBtn, {
    variant: "outline",
    className: "refresh-btn",
    style: {
      padding: '6px 14px',
      fontSize: 12.5
    },
    onClick: onRefresh,
    iconLeft: /*#__PURE__*/React.createElement("span", {
      className: `refresh-ico ${refreshing ? 'spin' : ''}`,
      style: {
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement(WI.reload, null))
  }, refreshing ? 'Refreshing…' : 'Refresh'), /*#__PURE__*/React.createElement(WkBtn, {
    variant: "primary",
    style: {
      padding: '6px 14px',
      fontSize: 12.5
    },
    onClick: onViewAll,
    iconRight: /*#__PURE__*/React.createElement(WI.arrow, null)
  }, "View all"))), /*#__PURE__*/React.createElement(InvoiceTable, {
    invoices: invoices.slice(0, 4),
    loading: loading,
    skeletonRows: 4,
    onRemove: onRemove,
    onOpen: onOpen,
    onRequestDelete: onRequestDelete,
    onShare: onShare
  }))), /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement(WkCard, {
    className: "upload-dropzone",
    style: {
      padding: '28px 20px',
      cursor: 'pointer'
    },
    onClick: onScan
  }, /*#__PURE__*/React.createElement("div", {
    className: "upload-icon"
  }, /*#__PURE__*/React.createElement(WI.upload, {
    size: 26
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 15,
      marginBottom: 4,
      color: 'var(--text-primary)'
    }
  }, "Upload New Receipt"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, "Drag and drop a receipt (PNG, JPG, PDF), or ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--brand)',
      textDecoration: 'underline'
    }
  }, "browse files")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--text-muted)',
      marginTop: 6
    }
  }, "Location metadata removed \xB7 compressed client-side.")), /*#__PURE__*/React.createElement(WkCard, {
    className: "panel budget-tones"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-header",
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "panel-title"
  }, "Category Budgets")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-secondary)',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--text-primary)'
    }
  }, BUDGETS.length, " budgets"), " tracked \xB7", ' ', /*#__PURE__*/React.createElement("strong", {
    style: {
      color: OVER_BUDGET ? 'var(--danger)' : 'var(--success)'
    }
  }, OVER_BUDGET, " over budget")), BUDGETS.map(b => /*#__PURE__*/React.createElement("div", {
    className: "budget-item",
    key: b.name
  }, /*#__PURE__*/React.createElement("div", {
    className: "budget-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "name"
  }, b.name), /*#__PURE__*/React.createElement("span", {
    className: "pct",
    style: {
      color: `var(--${budgetColor(b.pct)})`
    }
  }, b.pct, "%")), /*#__PURE__*/React.createElement(WkBar, {
    value: b.pct,
    tone: budgetColor(b.pct)
  })))))));
}

/* ---- Invoices pane ---- */
const PRESETS = [['30d', 'Last 30 days'], ['month', 'This month'], ['90d', 'Last 3 months'], ['custom', 'Custom range']];
const BLANK = {
  category: 'all',
  merchant: 'all',
  preset: '90d',
  status: 'all',
  from: '',
  to: '',
  tags: []
};
const PAGE_SIZE = 8;
function InvoicesPane({
  invoices,
  onRemove,
  onOpen,
  onRequestDelete,
  onShare,
  loading
}) {
  const [draft, setDraft] = React.useState(BLANK);
  const [searching, setSearching] = React.useState(false);
  const [visible, setVisible] = React.useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const set = patch => setDraft(d => ({
    ...d,
    ...patch
  }));
  const toggleTag = t => setDraft(d => ({
    ...d,
    tags: d.tags.includes(t) ? d.tags.filter(x => x !== t) : [...d.tags, t]
  }));

  // 3-month cap on custom range.
  const rangeDays = draft.from && draft.to ? Math.round((new Date(draft.to) - new Date(draft.from)) / 86400000) : 0;
  const rangeInvalid = draft.preset === 'custom' && draft.from && draft.to && (rangeDays < 0 || rangeDays > 92);
  const inPreset = iso => {
    const d = new Date(iso);
    if (draft.preset === '30d') return d >= daysAgo(30);
    if (draft.preset === 'month') return d.getUTCMonth() === TODAY.getUTCMonth() && d.getUTCFullYear() === TODAY.getUTCFullYear();
    if (draft.preset === '90d') return d >= daysAgo(92);
    if (draft.preset === 'custom') {
      if (rangeInvalid || !draft.from || !draft.to) return true;
      return d >= new Date(draft.from) && d <= new Date(draft.to);
    }
    return true;
  };
  const filtered = invoices.filter(inv => (draft.category === 'all' || inv.category === draft.category) && (draft.merchant === 'all' || inv.merchant === draft.merchant) && (draft.status === 'all' || inv.status[1] === draft.status) && (draft.tags.length === 0 || draft.tags.some(t => inv.tags.includes(t))) && inPreset(inv.dateISO));
  const activeCount = (draft.category !== 'all') + (draft.merchant !== 'all') + (draft.status !== 'all') + (draft.preset !== '90d') + (draft.tags.length > 0);
  const search = () => {
    setSearching(true);
    setTimeout(() => setSearching(false), 550);
  };

  // Reset paging whenever the filter set changes.
  React.useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [draft]);
  const shown = filtered.slice(0, visible);
  const remaining = filtered.length - shown.length;
  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setVisible(v => v + PAGE_SIZE);
      setLoadingMore(false);
    }, 500);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "pane"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "pane-title"
  }, "Invoices"), /*#__PURE__*/React.createElement("p", {
    className: "pane-subtitle"
  }, "View, filter and manage all your scanned receipts."), /*#__PURE__*/React.createElement(WkCard, {
    className: "panel filter-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "filter-head"
  }, /*#__PURE__*/React.createElement(WI.search, {
    size: 15
  }), " ", /*#__PURE__*/React.createElement("span", null, "Filter invoices")), /*#__PURE__*/React.createElement("div", {
    className: "filter-grid"
  }, /*#__PURE__*/React.createElement(FilterSelect, {
    label: "Expense category",
    icon: /*#__PURE__*/React.createElement(WI.box, {
      size: 15
    }),
    value: draft.category,
    onChange: e => set({
      category: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All categories"), CATEGORIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c))), /*#__PURE__*/React.createElement(FilterSelect, {
    label: "Merchant",
    icon: /*#__PURE__*/React.createElement(WI.cart, {
      size: 15
    }),
    value: draft.merchant,
    onChange: e => set({
      merchant: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All merchants"), MERCHANTS.map(m => /*#__PURE__*/React.createElement("option", {
    key: m,
    value: m
  }, m))), /*#__PURE__*/React.createElement(FilterSelect, {
    label: "Date range",
    icon: /*#__PURE__*/React.createElement(WI.calendar, {
      size: 15
    }),
    value: draft.preset,
    onChange: e => set({
      preset: e.target.value
    })
  }, PRESETS.map(([v, l]) => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, l))), /*#__PURE__*/React.createElement(FilterSelect, {
    label: "Status",
    icon: /*#__PURE__*/React.createElement(WI.shield, {
      size: 15
    }),
    value: draft.status,
    onChange: e => set({
      status: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Any status"), STATUSES.map(([, l]) => /*#__PURE__*/React.createElement("option", {
    key: l,
    value: l
  }, l)))), draft.preset === 'custom' && /*#__PURE__*/React.createElement("div", {
    className: "filter-grid filter-dates"
  }, /*#__PURE__*/React.createElement("div", {
    className: "filter-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "filter-label"
  }, "From"), /*#__PURE__*/React.createElement("div", {
    className: "filter-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lead-icon"
  }, /*#__PURE__*/React.createElement(WI.calendar, {
    size: 15
  })), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "filter-select",
    value: draft.from,
    max: draft.to || undefined,
    onChange: e => set({
      from: e.target.value
    })
  }))), /*#__PURE__*/React.createElement("div", {
    className: "filter-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "filter-label"
  }, "To"), /*#__PURE__*/React.createElement("div", {
    className: "filter-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lead-icon"
  }, /*#__PURE__*/React.createElement(WI.calendar, {
    size: 15
  })), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "filter-select",
    value: draft.to,
    min: draft.from || undefined,
    onChange: e => set({
      to: e.target.value
    })
  })))), /*#__PURE__*/React.createElement("div", {
    className: "filter-field",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "filter-label"
  }, "Tags"), /*#__PURE__*/React.createElement("div", {
    className: "filter-tags"
  }, ALL_TAGS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    type: "button",
    className: `filter-chip ${draft.tags.includes(t) ? 'on' : ''}`,
    onClick: () => toggleTag(t)
  }, t)))), /*#__PURE__*/React.createElement("div", {
    className: "filter-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: `filter-hint ${rangeInvalid ? 'invalid' : ''}`
  }, /*#__PURE__*/React.createElement(WI.clock, {
    size: 13
  }), rangeInvalid ? 'Range can’t exceed 3 months.' : 'Maximum range: 3 months.'), /*#__PURE__*/React.createElement("div", {
    className: "filter-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn--text",
    style: {
      padding: '8px 14px'
    },
    onClick: () => setDraft(BLANK)
  }, /*#__PURE__*/React.createElement(WI.trash, {
    size: 14
  }), " Clear filters"), /*#__PURE__*/React.createElement(WkBtn, {
    variant: "primary",
    disabled: rangeInvalid,
    style: {
      padding: '9px 20px',
      fontSize: 13
    },
    onClick: search,
    iconLeft: searching ? null : /*#__PURE__*/React.createElement(WI.search, {
      size: 15
    })
  }, searching ? 'Searching…' : 'Search')))), /*#__PURE__*/React.createElement(WkCard, {
    className: "panel",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-header",
    style: {
      padding: '20px 24px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "panel-title"
  }, "All invoices ", /*#__PURE__*/React.createElement("span", {
    className: "count-pill"
  }, filtered.length)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-muted)'
    }
  }, "Showing ", shown.length, " of ", filtered.length)), /*#__PURE__*/React.createElement(InvoiceTable, {
    invoices: shown,
    loading: loading,
    skeletonRows: 8,
    onRemove: onRemove,
    onOpen: onOpen,
    onRequestDelete: onRequestDelete,
    onShare: onShare
  }), remaining > 0 && /*#__PURE__*/React.createElement("div", {
    className: "load-more"
  }, /*#__PURE__*/React.createElement("button", {
    className: "load-more-btn",
    onClick: loadMore,
    disabled: loadingMore
  }, loadingMore ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "spin",
    style: {
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(WI.reload, null)), " Loading\u2026") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(WI.chevronDown, {
    size: 15
  }), " Load ", Math.min(PAGE_SIZE, remaining), " more"))), /*#__PURE__*/React.createElement("div", {
    className: "table-foot"
  }, /*#__PURE__*/React.createElement(WI.shieldCheck, {
    size: 14
  }), " Your data is private and secure.")));
}

/* ---- Price Trends pane ---- */
const MERCHANT_SHORT = {
  'Albert Heijn': 'AH',
  'AH To Go': 'AH To Go',
  'Jumbo Oostpoort': 'Jumbo',
  'Dirk van den Broek': 'Dirk',
  'Lidl': 'Lidl',
  'Tokomania': 'Tokomania',
  'Restaurante Cantinho': 'Cantinho'
};
// Each product is sold by several merchants — one line per product × merchant.
const TREND_PRODUCTS = [{
  id: 'milk',
  name: 'Organic Whole Milk 1L',
  short: 'Milk',
  stores: [['Albert Heijn', 1.29], ['Jumbo Oostpoort', 1.19], ['Lidl', 1.05]]
}, {
  id: 'coffee',
  name: 'Arabica Coffee 1kg',
  short: 'Coffee',
  stores: [['Albert Heijn', 9.49], ['Jumbo Oostpoort', 8.99], ['Dirk van den Broek', 8.45]]
}, {
  id: 'eggs',
  name: 'Free-Range Eggs (12)',
  short: 'Eggs',
  stores: [['Albert Heijn', 3.59], ['Jumbo Oostpoort', 3.39]]
}, {
  id: 'bread',
  name: 'Sourdough Bread 800g',
  short: 'Bread',
  stores: [['Jumbo Oostpoort', 2.79], ['Lidl', 2.45]]
}, {
  id: 'bananas',
  name: 'Bananas 1kg',
  short: 'Bananas',
  stores: [['Albert Heijn', 1.79], ['Lidl', 1.49]]
}, {
  id: 'chicken',
  name: 'Chicken Breast 500g',
  short: 'Chicken',
  stores: [['Albert Heijn', 4.49], ['Dirk van den Broek', 3.95]]
}, {
  id: 'oil',
  name: 'Olive Oil 500ml',
  short: 'Olive Oil',
  stores: [['Jumbo Oostpoort', 6.49], ['Lidl', 5.79]]
}, {
  id: 'cheese',
  name: 'Gouda Cheese 400g',
  short: 'Gouda',
  stores: [['Albert Heijn', 4.15], ['Jumbo Oostpoort', 3.95], ['Dirk van den Broek', 3.79]]
}];
const SERIES_COLORS = ['#6366f1', '#0d9488', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9', '#22c55e', '#ec4899', '#eab308'];
const MAX_PRODUCTS = 3;

// 26 weekly sample dates ending today — enough history for any preset within 3 months.
const TREND_WEEKS = (() => {
  const out = [];
  for (let i = 25; i >= 0; i--) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - i * 7);
    out.push(d);
  }
  return out;
})();
const weeklySeries = (base, seed) => TREND_WEEKS.map((d, i) => {
  const drift = 1 + (0.01 + seed % 3 * 0.008) * (i / 25);
  const wave = Math.sin((i + seed) * 0.5) * base * 0.015;
  return Math.round((base * drift + wave) * 100) / 100;
});
// Precompute a full series per product|merchant line.
const TREND_DATA = {};
TREND_PRODUCTS.forEach((pr, p) => pr.stores.forEach(([m, price], s) => {
  TREND_DATA[`${pr.id}|${m}`] = weeklySeries(price, p * 3 + s);
}));
function LineChart({
  series,
  months
}) {
  const [hover, setHover] = React.useState(null);
  const W = 760,
    H = 320,
    padL = 46,
    padR = 18,
    padT = 18,
    padB = 36;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const n = months.length;
  const all = series.flatMap(s => s.data);
  const lo = Math.min(...all),
    hi = Math.max(...all);
  const yMin = Math.max(0, lo - (hi - lo) * 0.15 - 0.05),
    yMax = hi + (hi - lo) * 0.15 + 0.05;
  const x = i => padL + (n === 1 ? plotW / 2 : i / (n - 1) * plotW);
  const y = v => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;
  const ticks = 4;
  const gridVals = Array.from({
    length: ticks + 1
  }, (_, k) => yMin + (yMax - yMin) * k / ticks);
  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * W;
    let i = Math.round((px - padL) / plotW * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover(i);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "chart-wrap"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    className: "chart-svg",
    role: "img",
    "aria-label": "Price timeline"
  }, gridVals.map((v, k) => /*#__PURE__*/React.createElement("g", {
    key: k
  }, /*#__PURE__*/React.createElement("line", {
    x1: padL,
    y1: y(v),
    x2: W - padR,
    y2: y(v),
    className: "chart-grid"
  }), /*#__PURE__*/React.createElement("text", {
    x: padL - 8,
    y: y(v) + 4,
    className: "chart-ylabel"
  }, "\u20AC", v.toFixed(2)))), months.map((m, i) => (i % 2 === 0 || i === n - 1) && /*#__PURE__*/React.createElement("text", {
    key: i,
    x: x(i),
    y: H - 12,
    className: "chart-xlabel"
  }, m)), series.map(s => /*#__PURE__*/React.createElement("polyline", {
    key: s.id,
    fill: "none",
    stroke: s.color,
    strokeWidth: "2.5",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    points: s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  })), hover != null && /*#__PURE__*/React.createElement("line", {
    x1: x(hover),
    y1: padT,
    x2: x(hover),
    y2: padT + plotH,
    className: "chart-cross"
  }), hover != null && series.map(s => /*#__PURE__*/React.createElement("circle", {
    key: s.id,
    cx: x(hover),
    cy: y(s.data[hover]),
    r: "4",
    fill: "var(--bg-color)",
    stroke: s.color,
    strokeWidth: "2.5"
  })), /*#__PURE__*/React.createElement("rect", {
    x: padL,
    y: padT,
    width: plotW,
    height: plotH,
    fill: "transparent",
    onMouseMove: onMove,
    onMouseLeave: () => setHover(null)
  })), hover != null && /*#__PURE__*/React.createElement("div", {
    className: "chart-tip",
    style: {
      left: `${x(hover) / W * 100}%`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "chart-tip-head"
  }, months[hover]), series.map(s => /*#__PURE__*/React.createElement("div", {
    className: "chart-tip-row",
    key: s.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: s.color
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "nm"
  }, s.name), /*#__PURE__*/React.createElement("span", {
    className: "vl"
  }, "\u20AC", s.data[hover].toFixed(2))))));
}

/* Typeahead product search — types to filter; we never load a full combobox. */
function ProductSearch({
  onAdd,
  disabled,
  exclude
}) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const query = q.trim().toLowerCase();
  const matches = query ? TREND_PRODUCTS.filter(p => !exclude.includes(p.id) && (p.name.toLowerCase().includes(query) || p.short.toLowerCase().includes(query))).slice(0, 8) : [];
  const pick = p => {
    onAdd(p.id);
    setQ('');
    setOpen(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "filter-field typeahead-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "filter-label"
  }, "Find a product"), /*#__PURE__*/React.createElement("div", {
    className: "filter-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lead-icon"
  }, /*#__PURE__*/React.createElement(WI.search, {
    size: 15
  })), /*#__PURE__*/React.createElement("input", {
    className: "filter-select ta-input",
    type: "text",
    disabled: disabled,
    placeholder: disabled ? `Maximum of ${MAX_PRODUCTS} products` : 'Type a product name…',
    value: q,
    onChange: e => {
      setQ(e.target.value);
      setOpen(true);
    },
    onFocus: () => setOpen(true),
    onBlur: () => setTimeout(() => setOpen(false), 150),
    onKeyDown: e => {
      if (e.key === 'Enter' && matches[0]) {
        e.preventDefault();
        pick(matches[0]);
      }
    }
  })), open && !disabled && query && /*#__PURE__*/React.createElement("div", {
    className: "typeahead"
  }, matches.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "typeahead-empty"
  }, "No products match \u201C", q, "\u201D.") : matches.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    type: "button",
    className: "typeahead-opt",
    onMouseDown: e => {
      e.preventDefault();
      pick(p);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ta-name"
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "ta-stores"
  }, p.stores.length, " stores")))));
}
function PriceTrendsPane() {
  const [selected, setSelected] = React.useState(['milk']);
  const [preset, setPreset] = React.useState('90d');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const atMax = selected.length >= MAX_PRODUCTS;

  // One line per product × merchant (no line cap).
  const lines = [];
  selected.forEach(id => {
    const pr = TREND_PRODUCTS.find(p => p.id === id);
    pr.stores.forEach(([m]) => lines.push({
      id: `${id}|${m}`,
      product: pr.short,
      merchant: MERCHANT_SHORT[m] || m,
      name: `${pr.short} · ${MERCHANT_SHORT[m] || m}`,
      full: TREND_DATA[`${id}|${m}`]
    }));
  });

  // 3-month cap on a custom range.
  const rangeDays = from && to ? Math.round((new Date(to) - new Date(from)) / 86400000) : 0;
  const rangeInvalid = preset === 'custom' && from && to && (rangeDays < 0 || rangeDays > 92);
  const inRange = d => {
    if (preset === '30d') return d >= daysAgo(30);
    if (preset === 'month') return d.getUTCMonth() === TODAY.getUTCMonth() && d.getUTCFullYear() === TODAY.getUTCFullYear();
    if (preset === 'custom' && !rangeInvalid && from && to) return d >= new Date(from) && d <= new Date(to);
    return d >= daysAgo(92);
  };
  const idx = TREND_WEEKS.map((d, i) => [d, i]).filter(([d]) => inRange(d)).map(([, i]) => i);
  const labels = idx.map(i => {
    const d = TREND_WEEKS[i];
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  });
  const series = lines.map((ln, i) => ({
    ...ln,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    data: idx.map(j => ln.full[j])
  }));
  const rangeLabel = PRESETS.find(([v]) => v === preset)[1];
  const add = id => {
    if (!atMax && !selected.includes(id)) setSelected(s => [...s, id]);
  };
  const removeProduct = id => setSelected(s => s.filter(x => x !== id));
  const clear = () => {
    setSelected([]);
    setPreset('90d');
    setFrom('');
    setTo('');
  };
  const search = () => {
    setSearching(true);
    setTimeout(() => setSearching(false), 550);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "pane"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "pane-title"
  }, "Price Trends"), /*#__PURE__*/React.createElement("p", {
    className: "pane-subtitle"
  }, "Compare an item across local stores over time \u2014 one line per store. Track up to ", MAX_PRODUCTS, " products."), /*#__PURE__*/React.createElement(WkCard, {
    className: "panel filter-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "filter-head"
  }, /*#__PURE__*/React.createElement(WI.trend, {
    size: 15
  }), " ", /*#__PURE__*/React.createElement("span", null, "Filter price trends")), /*#__PURE__*/React.createElement("div", {
    className: "filter-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "span-2"
  }, /*#__PURE__*/React.createElement(ProductSearch, {
    onAdd: add,
    disabled: atMax,
    exclude: selected
  })), /*#__PURE__*/React.createElement(FilterSelect, {
    label: "Date range",
    icon: /*#__PURE__*/React.createElement(WI.calendar, {
      size: 15
    }),
    value: preset,
    onChange: e => setPreset(e.target.value)
  }, PRESETS.map(([v, l]) => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, l)))), preset === 'custom' && /*#__PURE__*/React.createElement("div", {
    className: "filter-grid filter-dates"
  }, /*#__PURE__*/React.createElement("div", {
    className: "filter-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "filter-label"
  }, "From"), /*#__PURE__*/React.createElement("div", {
    className: "filter-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lead-icon"
  }, /*#__PURE__*/React.createElement(WI.calendar, {
    size: 15
  })), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "filter-select",
    value: from,
    max: to || undefined,
    onChange: e => setFrom(e.target.value)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "filter-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "filter-label"
  }, "To"), /*#__PURE__*/React.createElement("div", {
    className: "filter-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lead-icon"
  }, /*#__PURE__*/React.createElement(WI.calendar, {
    size: 15
  })), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "filter-select",
    value: to,
    min: from || undefined,
    onChange: e => setTo(e.target.value)
  })))), /*#__PURE__*/React.createElement("div", {
    className: "filter-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "filter-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "filter-label"
  }, "Selected products (", selected.length, "/", MAX_PRODUCTS, ")"), /*#__PURE__*/React.createElement("div", {
    className: "trend-picker"
  }, selected.length === 0 && /*#__PURE__*/React.createElement("span", {
    className: "trend-empty-hint"
  }, "Search above to add up to ", MAX_PRODUCTS, " products."), selected.map(id => {
    const pr = TREND_PRODUCTS.find(p => p.id === id);
    return /*#__PURE__*/React.createElement("span", {
      className: "trend-chip",
      key: id
    }, pr.short, " ", /*#__PURE__*/React.createElement("span", {
      className: "trend-stores"
    }, pr.stores.length, " stores"), /*#__PURE__*/React.createElement("button", {
      className: "trend-x",
      "aria-label": `Remove ${pr.name}`,
      onClick: () => removeProduct(id)
    }, "\u2715"));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "filter-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: `filter-hint ${rangeInvalid ? 'invalid' : ''}`
  }, /*#__PURE__*/React.createElement(WI.clock, {
    size: 13
  }), rangeInvalid ? 'Range can’t exceed 3 months.' : `${lines.length} lines · max range 3 months`), /*#__PURE__*/React.createElement("div", {
    className: "filter-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn--text",
    style: {
      padding: '8px 14px'
    },
    onClick: clear
  }, /*#__PURE__*/React.createElement(WI.trash, {
    size: 14
  }), " Clear filters"), /*#__PURE__*/React.createElement(WkBtn, {
    variant: "primary",
    disabled: rangeInvalid,
    style: {
      padding: '9px 20px',
      fontSize: 13
    },
    onClick: search,
    iconLeft: searching ? null : /*#__PURE__*/React.createElement(WI.search, {
      size: 15
    })
  }, searching ? 'Searching…' : 'Search')))), /*#__PURE__*/React.createElement(WkCard, {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-header",
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "panel-title"
  }, "Price per unit"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, rangeInvalid ? 'Last 3 months' : rangeLabel)), series.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "table-empty"
  }, /*#__PURE__*/React.createElement(WI.trend, {
    size: 26
  }), /*#__PURE__*/React.createElement("span", null, "Add a product above to start comparing prices across stores.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(LineChart, {
    series: series,
    months: labels
  }), /*#__PURE__*/React.createElement("div", {
    className: "trend-legend"
  }, series.map(s => {
    const d = (s.data[s.data.length - 1] - s.data[0]) / s.data[0] * 100;
    return /*#__PURE__*/React.createElement("div", {
      className: "legend-item",
      key: s.id
    }, /*#__PURE__*/React.createElement("span", {
      className: "dot",
      style: {
        background: s.color
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "legend-meta"
    }, /*#__PURE__*/React.createElement("span", {
      className: "legend-name"
    }, s.product, " \xB7 ", /*#__PURE__*/React.createElement("strong", null, s.merchant)), /*#__PURE__*/React.createElement("span", {
      className: "legend-now"
    }, "\u20AC", s.data[s.data.length - 1].toFixed(2), /*#__PURE__*/React.createElement("span", {
      className: "legend-delta",
      style: {
        color: d > 0 ? 'var(--danger)' : 'var(--success)'
      }
    }, d > 0 ? '▲' : '▼', " ", Math.abs(d).toFixed(1), "%"))));
  })))));
}

/* ---- Invoice detail drawer ---- */
const ITEM_CATALOG = {
  'Groceries': ['Whole Milk 1L', 'Free-Range Eggs', 'Sourdough Loaf', 'Bananas 1kg', 'Gouda 400g', 'Tomatoes 500g', 'Chicken Breast', 'Orange Juice 1L'],
  'Bar & Restaurants': ['Main course', 'Side dish', 'House wine', 'Espresso', 'Dessert', 'Cover & service'],
  'Transport': ['Fuel — 95 unleaded', 'Parking', 'Transit ticket', 'Car wash'],
  'Drugstore': ['Shampoo', 'Toothpaste', 'Vitamins', 'Hand soap', 'Plasters'],
  'Others': ['Household goods', 'Stationery', 'Batteries', 'Gift card']
};
function buildLineItems(inv) {
  const pool = ITEM_CATALOG[inv.category] || ITEM_CATALOG.Others;
  const n = 3 + inv.id % 3;
  const weights = [];
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    const w = 1 + (inv.id * 3 + i * 7) % 5;
    weights.push(w);
    wsum += w;
  }
  let remaining = Math.round(inv.total * 100);
  const items = [];
  for (let i = 0; i < n; i++) {
    let cents = i === n - 1 ? remaining : Math.round(inv.total * 100 * weights[i] / wsum);
    cents = Math.max(1, Math.min(cents, remaining - (n - 1 - i)));
    remaining -= cents;
    const qty = (inv.id + i) % 3 === 0 ? 2 : 1;
    items.push({
      name: pool[(inv.id + i) % pool.length],
      qty,
      lineTotal: cents / 100
    });
  }
  if (remaining !== 0 && items.length) items[items.length - 1].lineTotal += remaining / 100;
  return items.map(it => ({
    ...it,
    unit: it.lineTotal / it.qty
  }));
}
function InvoiceDrawer({
  invoice,
  onClose,
  onRequestDelete,
  onShare
}) {
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const [feedback, setFeedback] = React.useState(null); // 'up' | 'down'
  const [pop, setPop] = React.useState(null);
  const giveFeedback = v => {
    setFeedback(v);
    setPop(v);
    setTimeout(() => setPop(null), 420);
  };
  const items = buildLineItems(invoice);
  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
  const vat = Math.round(subtotal * 0.09 * 100) / 100; // illustrative 9% included

  return /*#__PURE__*/React.createElement("div", {
    className: "drawer-overlay",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("aside", {
    className: "invoice-drawer",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "drawer-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "drawer-merchant"
  }, /*#__PURE__*/React.createElement(WkMerchant, {
    merchant: invoice.merchant,
    size: 40
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "drawer-title"
  }, invoice.merchant))), /*#__PURE__*/React.createElement("button", {
    className: "drawer-close",
    "aria-label": "Close",
    onClick: onClose
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "drawer-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "drawer-details"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dd-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dd-label"
  }, /*#__PURE__*/React.createElement(WI.box, {
    size: 14
  }), " Category"), /*#__PURE__*/React.createElement("span", {
    className: "dd-val"
  }, invoice.category)), /*#__PURE__*/React.createElement("div", {
    className: "dd-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dd-label"
  }, /*#__PURE__*/React.createElement(WI.calendar, {
    size: 14
  }), " Date"), /*#__PURE__*/React.createElement("span", {
    className: "dd-val"
  }, fmtDate(invoice.dateISO))), /*#__PURE__*/React.createElement("div", {
    className: "dd-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dd-label"
  }, /*#__PURE__*/React.createElement(WI.shield, {
    size: 14
  }), " Status"), /*#__PURE__*/React.createElement(WkBadge, {
    tone: invoice.status[0]
  }, invoice.status[1])), /*#__PURE__*/React.createElement("div", {
    className: "dd-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dd-label"
  }, /*#__PURE__*/React.createElement(WI.tag, {
    size: 14
  }), " Tags"), /*#__PURE__*/React.createElement("div", {
    className: "tag-row"
  }, invoice.tags.map(t => /*#__PURE__*/React.createElement(WkTag, {
    key: t
  }, t))))), /*#__PURE__*/React.createElement("div", {
    className: "drawer-receipt"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-head"
  }, /*#__PURE__*/React.createElement("span", null, "Item"), /*#__PURE__*/React.createElement("span", null, "Qty"), /*#__PURE__*/React.createElement("span", null, "Amount")), items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    className: "receipt-row",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "ri-name"
  }, it.name), /*#__PURE__*/React.createElement("span", {
    className: "ri-qty"
  }, "\xD7", it.qty), /*#__PURE__*/React.createElement("span", {
    className: "ri-amt"
  }, eur(it.lineTotal)))), /*#__PURE__*/React.createElement("div", {
    className: "receipt-totals"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", null, "Subtotal"), /*#__PURE__*/React.createElement("span", null, eur(subtotal - vat))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", null, "VAT (9%)"), /*#__PURE__*/React.createElement("span", null, eur(vat))), /*#__PURE__*/React.createElement("div", {
    className: "receipt-grand"
  }, /*#__PURE__*/React.createElement("span", null, "Total"), /*#__PURE__*/React.createElement("span", null, eur(invoice.total))))), /*#__PURE__*/React.createElement("div", {
    className: "drawer-note"
  }, /*#__PURE__*/React.createElement(WI.shieldCheck, {
    size: 14
  }), " Parsed automatically \xB7 location metadata removed."), /*#__PURE__*/React.createElement("div", {
    className: "drawer-feedback"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-copy"
  }, /*#__PURE__*/React.createElement("span", {
    className: "fb-q"
  }, feedback ? 'Thanks — your feedback trains the scanner.' : 'Did we capture this receipt correctly?'), !feedback && /*#__PURE__*/React.createElement("span", {
    className: "fb-hint"
  }, "A quick rating helps us improve AI accuracy for everyone.")), /*#__PURE__*/React.createElement("div", {
    className: "fb-btns"
  }, /*#__PURE__*/React.createElement("button", {
    className: `fb-btn up ${feedback === 'up' ? 'on' : ''} ${pop === 'up' ? 'pop' : ''}`,
    "aria-label": "Accurate",
    onClick: () => giveFeedback('up')
  }, /*#__PURE__*/React.createElement(WI.thumbsUp, {
    size: 17
  })), /*#__PURE__*/React.createElement("button", {
    className: `fb-btn down ${feedback === 'down' ? 'on' : ''} ${pop === 'down' ? 'pop' : ''}`,
    "aria-label": "Inaccurate",
    onClick: () => giveFeedback('down')
  }, /*#__PURE__*/React.createElement(WI.thumbsDown, {
    size: 17
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "drawer-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn--outline",
    style: {
      flex: 1
    },
    onClick: () => onShare && onShare(invoice)
  }, /*#__PURE__*/React.createElement(WI.share, {
    size: 15
  }), " Share"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--outline drawer-del",
    onClick: () => onRequestDelete(invoice)
  }, /*#__PURE__*/React.createElement(WI.trash, {
    size: 15
  }), " Delete"))));
}

/* ---- Confirm dialog + toast ---- */
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  invoice,
  onConfirm,
  onCancel
}) {
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-overlay",
    onClick: onCancel
  }, /*#__PURE__*/React.createElement("div", {
    className: "confirm-card",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("button", {
    className: "dialog-close",
    "aria-label": "Close",
    onClick: onCancel
  }, "\u2715"), /*#__PURE__*/React.createElement("div", {
    className: "confirm-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "confirm-icon"
  }, /*#__PURE__*/React.createElement(WI.alertTri, {
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    className: "confirm-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "confirm-title"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: "confirm-msg"
  }, message))), invoice && /*#__PURE__*/React.createElement("div", {
    className: "confirm-preview"
  }, /*#__PURE__*/React.createElement(WkMerchant, {
    merchant: invoice.merchant,
    size: 36
  }), /*#__PURE__*/React.createElement("div", {
    className: "cp-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cp-name"
  }, invoice.merchant), /*#__PURE__*/React.createElement("span", {
    className: "cp-sub"
  }, fmtDate(invoice.dateISO), " \xB7 ", invoice.category)), /*#__PURE__*/React.createElement("span", {
    className: "cp-amt"
  }, eur(invoice.total))), /*#__PURE__*/React.createElement("div", {
    className: "confirm-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn--outline",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    className: "btn confirm-danger",
    onClick: onConfirm
  }, /*#__PURE__*/React.createElement(WI.trash, {
    size: 15
  }), " ", confirmLabel))));
}
function ShareDialog({
  invoice,
  onClose,
  onCopy
}) {
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const link = `https://wobbl.io/r/${String(invoice.id).slice(-6)}`;
  const waText = encodeURIComponent(`Here's our ${invoice.merchant} receipt (${eur(invoice.total)}) on Wobblio: ${link}`);
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-overlay",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "confirm-card share-card",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("button", {
    className: "dialog-close",
    "aria-label": "Close",
    onClick: onClose
  }, "\u2715"), /*#__PURE__*/React.createElement("div", {
    className: "confirm-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "share-icon"
  }, /*#__PURE__*/React.createElement(WI.share, {
    size: 19
  })), /*#__PURE__*/React.createElement("div", {
    className: "confirm-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "confirm-title"
  }, "Share this receipt"), /*#__PURE__*/React.createElement("p", {
    className: "confirm-msg"
  }, "Send the ", invoice.merchant, " receipt (", eur(invoice.total), ") to your household. Anyone with the link gets a read-only view \u2014 share it straight to WhatsApp or copy it below."))), /*#__PURE__*/React.createElement("div", {
    className: "share-link"
  }, /*#__PURE__*/React.createElement("input", {
    className: "share-input",
    readOnly: true,
    value: link,
    onFocus: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--outline share-copy",
    onClick: () => onCopy(link)
  }, /*#__PURE__*/React.createElement(WI.copy, {
    size: 15
  }), " Copy")), /*#__PURE__*/React.createElement("a", {
    className: "btn whatsapp-btn",
    href: `https://wa.me/?text=${waText}`,
    target: "_blank",
    rel: "noopener noreferrer"
  }, /*#__PURE__*/React.createElement(WI.whatsapp, {
    size: 18
  }), " Share on WhatsApp")));
}
function Toast({
  toast,
  onClose
}) {
  if (!toast) return null;
  const processing = toast.tone === 'processing';
  const Icon = processing ? WI.reload : toast.tone === 'danger' ? WI.trash : WI.check2;
  return /*#__PURE__*/React.createElement("div", {
    className: `toast toast--${toast.tone}`,
    role: "status"
  }, /*#__PURE__*/React.createElement("span", {
    className: `toast-icon ${processing ? 'spin' : ''}`
  }, /*#__PURE__*/React.createElement(Icon, {
    size: 17
  })), /*#__PURE__*/React.createElement("span", {
    className: "toast-msg"
  }, toast.msg), !processing && /*#__PURE__*/React.createElement("button", {
    className: "toast-close",
    "aria-label": "Dismiss",
    onClick: onClose
  }, "\u2715"));
}

/* ---- Shell ---- */
function Workspace({
  theme,
  onToggleTheme,
  onSignOut
}) {
  const [active, setActive] = React.useState(0);
  const [invoices, setInvoices] = React.useState(INVOICE_DB);
  const [refreshing, setRefreshing] = React.useState(false);
  const [openInvoice, setOpenInvoice] = React.useState(null);
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  const [shareTarget, setShareTarget] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const toastTimer = React.useRef(null);

  // Simulate asynchronous load of workspace data on mount.
  React.useEffect(() => {
    setLoading(true);
    const id = setTimeout(() => {
      setInvoices(INVOICE_DB);
      setLoading(false);
    }, 1100);
    return () => clearTimeout(id);
  }, []);
  const showToast = (msg, tone = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({
      msg,
      tone
    });
    const ms = tone === 'processing' ? 1600 : 6000;
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => {
      setInvoices(INVOICE_DB);
      setRefreshing(false);
    }, 900);
  };
  const removeInvoice = id => setInvoices(list => list.filter(x => x.id !== id));
  const shareInvoice = inv => setShareTarget(inv);
  const copyLink = link => {
    try {
      navigator.clipboard && navigator.clipboard.writeText(link);
    } catch (e) {}
    showToast('Link copied — paste it anywhere to share.', 'success');
  };
  const doDelete = () => {
    const inv = confirmDelete;
    removeInvoice(inv.id);
    if (openInvoice && openInvoice.id === inv.id) setOpenInvoice(null);
    setConfirmDelete(null);
    showToast(`${inv.merchant} invoice deleted.`, 'danger');
  };
  const scanReceipt = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,application/pdf';
    input.onchange = () => {
      if (!input.files || !input.files.length) return;
      showToast('Processing your receipt — this can take a few seconds…', 'processing');
      setTimeout(() => {
        const next = {
          id: Date.now(),
          merchant: 'Albert Heijn',
          category: 'Groceries',
          dateISO: TODAY.toISOString().slice(0, 10),
          status: ['primary', 'Auto Parsed'],
          tags: ['weekly'],
          total: Math.round((10 + Math.random() * 40) * 100) / 100
        };
        setInvoices(list => [next, ...list]);
        showToast('Receipt scanned — added to your invoices.', 'success');
      }, 1700);
    };
    input.click();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "workspace"
  }, /*#__PURE__*/React.createElement("div", {
    className: "app-shell",
    "data-surface": "calm"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "app-rail"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rail-logo"
  }, /*#__PURE__*/React.createElement(WkLogo, {
    size: 30
  })), /*#__PURE__*/React.createElement("nav", {
    className: "rail-menu"
  }, RAIL.map(([icon, label], i) => {
    const Ico = WI[icon];
    return /*#__PURE__*/React.createElement("button", {
      key: label,
      "data-tip": label,
      className: `rail-btn has-tip ${i === active ? 'active' : ''}`,
      onClick: () => setActive(i)
    }, /*#__PURE__*/React.createElement(Ico, {
      size: 20
    }));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "app-body"
  }, /*#__PURE__*/React.createElement("header", {
    className: "app-topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "topbar-title"
  }, RAIL[active][1]), /*#__PURE__*/React.createElement("div", {
    className: "topbar-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "usage-chip",
    title: "Invoices processed this week"
  }, /*#__PURE__*/React.createElement("span", {
    className: "usage-icon"
  }, /*#__PURE__*/React.createElement(WI.receiptText, {
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    className: "usage-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "usage-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "usage-label"
  }, "Invoices this week"), /*#__PURE__*/React.createElement("span", {
    className: "usage-count"
  }, /*#__PURE__*/React.createElement("strong", null, INVOICES_THIS_WEEK), " / ", WEEKLY_LIMIT)), /*#__PURE__*/React.createElement("div", {
    className: "usage-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "usage-fill",
    style: {
      width: `${Math.min(100, INVOICES_THIS_WEEK / WEEKLY_LIMIT * 100)}%`
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "user-chip"
  }, /*#__PURE__*/React.createElement(WkAvatar, {
    initials: "AR",
    title: "Antonio R."
  }), /*#__PURE__*/React.createElement("div", {
    className: "user-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "user-plan"
  }, /*#__PURE__*/React.createElement(WI.crown, null), " Premium"))), /*#__PURE__*/React.createElement("button", {
    className: "signout-btn has-tip has-tip--bottom",
    "data-tip": "Sign out",
    onClick: onSignOut
  }, /*#__PURE__*/React.createElement(WI.logout, null)))), active === 1 ? /*#__PURE__*/React.createElement(InvoicesPane, {
    invoices: invoices,
    loading: loading,
    onRemove: removeInvoice,
    onOpen: setOpenInvoice,
    onRequestDelete: setConfirmDelete,
    onShare: shareInvoice
  }) : active === 3 ? /*#__PURE__*/React.createElement(PriceTrendsPane, null) : /*#__PURE__*/React.createElement(DashboardPane, {
    invoices: invoices,
    loading: loading,
    onRemove: removeInvoice,
    onOpen: setOpenInvoice,
    onRequestDelete: setConfirmDelete,
    onShare: shareInvoice,
    onScan: scanReceipt,
    onViewAll: () => setActive(1),
    refreshing: refreshing,
    onRefresh: refresh
  }), /*#__PURE__*/React.createElement(Toast, {
    toast: toast,
    onClose: () => {
      clearTimeout(toastTimer.current);
      setToast(null);
    }
  }))), openInvoice && /*#__PURE__*/React.createElement(InvoiceDrawer, {
    invoice: openInvoice,
    onClose: () => setOpenInvoice(null),
    onRequestDelete: setConfirmDelete,
    onShare: shareInvoice
  }), shareTarget && /*#__PURE__*/React.createElement(ShareDialog, {
    invoice: shareTarget,
    onClose: () => setShareTarget(null),
    onCopy: copyLink
  }), confirmDelete && /*#__PURE__*/React.createElement(ConfirmDialog, {
    title: "Delete this invoice?",
    message: `The receipt from ${confirmDelete.merchant} (${eur(confirmDelete.total)}) will be permanently removed. This can’t be undone.`,
    confirmLabel: "Delete invoice",
    invoice: confirmDelete,
    onConfirm: doDelete,
    onCancel: () => setConfirmDelete(null)
  }));
}
window.WobblioWorkspace = Workspace;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/kit-workspace.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/tweaks-panel.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/tweaks-panel.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.MerchantIcon = __ds_scope.MerchantIcon;

__ds_ns.WobblioLogo = __ds_scope.WobblioLogo;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.MetricCard = __ds_scope.MetricCard;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Switch = __ds_scope.Switch;

})();
