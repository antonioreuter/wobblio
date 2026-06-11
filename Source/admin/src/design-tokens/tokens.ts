export const tokens = {
  colors: {
    brand: '#0d9488',
    brandHover: '#0f766e',
    brandLight: '#ccfbf1',

    light: {
      background: '#ffffff',
      surface: '#f8fafc',
      surfaceContainer: '#f1f5f9',
      surfaceContainerHigh: '#e2e8f0',
      text: '#0f172a',
      muted: '#64748b',
      outline: '#cbd5e1',
      outlineVariant: '#e2e8f0',
    },

    dark: {
      background: '#0b0f19',
      surface: '#111827',
      surfaceContainer: '#1e293b',
      text: '#f1f5f9',
      muted: '#94a3b8',
      outline: '#334155',
    },

    semantic: {
      success: '#16a34a',
      successLight: '#dcfce7',
      warning: '#d97706',
      warningLight: '#fef3c7',
      error: '#dc2626',
      errorLight: '#fee2e2',
    },
  },

  typography: {
    scale: {
      display: { size: 30, lineHeight: 36, weight: 700 },
      h1: { size: 24, lineHeight: 32, weight: 600 },
      h2: { size: 20, lineHeight: 28, weight: 600 },
      body: { size: 16, lineHeight: 24, weight: 400 },
      secondary: { size: 14, lineHeight: 20, weight: 400 },
      caption: { size: 12, lineHeight: 16, weight: 500 },
    },
    family: 'Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif',
  },

  spacing: {
    base: 4,
    containerPadding: 24,
    gutter: 16,
    marginDesktop: 32,
    marginMobile: 16,
  },

  radii: {
    card: 12,
    btn: 8,
    chip: 9999,
  },

  stroke: {
    icon: 1.5,
    border: 1,
  },

  icons: [
    'ReceiptText',
    'ShoppingCart',
    'TrendingUp',
    'TrendingDown',
    'BarChart3',
    'PieChart',
    'Home',
    'List',
    'Settings',
    'User',
    'Bell',
    'Search',
    'ChevronRight',
    'ChevronDown',
    'ChevronLeft',
    'Check',
    'AlertTriangle',
    'Info',
    'X',
    'Plus',
    'Scan',
    'Upload',
    'Eye',
    'Edit2',
    'Trash2',
    'Star',
    'Zap',
    'LayoutDashboard',
    'FileText',
    'Users',
    'Wallet',
    'CreditCard',
    'Shield',
    'Activity',
    'RefreshCw',
    'Download',
    'ExternalLink',
  ],
} as const

export type ColorMode = 'light' | 'dark'
export type SemanticColor = 'success' | 'warning' | 'error'
