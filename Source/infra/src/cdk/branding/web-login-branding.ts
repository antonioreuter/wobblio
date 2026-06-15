// Wobblio-branded Cognito Managed Login (v2) style for the web app client.
// Maps the webapp's "Obsidian Aurora" design tokens onto the Managed Login
// settings schema so the hosted sign-in page matches the app while keeping
// credentials on the Cognito origin. Colors are 8-digit RGBA hex.
//
// Source of truth: Source/webapp/src/styles/ds/tokens/colors.css + spacing.css.
// NOTE: the brand/primary accent is Electric Indigo (--brand), NOT teal — teal
// (#0D9488) is --success. Indigo differs by theme: #4F46E5 light, #6366F1 dark.

// ── Brand (indigo) ──
const BRAND_LIGHT = '4f46e5ff';        // --brand (light)  indigo-600
const BRAND_LIGHT_HOVER = '3730a3ff';  // --brand-hover (light)  indigo-700
const BRAND_DARK = '6366f1ff';         // --brand (dark)  indigo-500
const BRAND_DARK_HOVER = '4f46e5ff';   // --brand-hover (dark)  indigo-600
const WHITE = 'ffffffff';

// ── Surfaces ──
const PAGE_BG_LIGHT = 'eaeef5ff';      // --bg-color (light)
const PAGE_BG_DARK = '161a24ff';       // --bg-color (dark) Obsidian
const CARD_LIGHT = 'ffffffff';         // glass-bg (light) ≈ white
const CARD_DARK = '0d111eff';          // glass-bg (dark) base
const BORDER_LIGHT = 'e6e8ecff';       // glass-border (light) hairline
const BORDER_DARK = '2b2f38ff';        // glass-border (dark) subtle

// ── Text ──
const TEXT_LIGHT = '0f172aff';         // --text-primary (light)
const SUBTEXT_LIGHT = '475569ff';      // --text-secondary (light)
const MUTED = '64748bff';              // --text-muted (both)
const TEXT_DARK = 'f8fafcff';          // --text-primary (dark)
const SUBTEXT_DARK = '94a3b8ff';       // --text-secondary (dark)

// Partial settings document — only the values that differ from Cognito defaults.
// Stored with useCognitoProvidedValues=false and merged with defaults at serve.
export const WOBBLIO_LOGIN_SETTINGS = {
  categories: {
    global: { colorSchemeMode: 'DYNAMIC' }, // follow the browser, like the webapp `dark:` variant
  },
  components: {
    primaryButton: {
      lightMode: {
        defaults: { backgroundColor: BRAND_LIGHT, textColor: WHITE },
        hover: { backgroundColor: BRAND_LIGHT_HOVER, textColor: WHITE },
        active: { backgroundColor: BRAND_LIGHT_HOVER, textColor: WHITE },
      },
      darkMode: {
        defaults: { backgroundColor: BRAND_DARK, textColor: WHITE },
        hover: { backgroundColor: BRAND_DARK_HOVER, textColor: WHITE },
        active: { backgroundColor: BRAND_DARK_HOVER, textColor: WHITE },
      },
    },
    form: {
      borderRadius: 16, // --radius-xl (glass cards)
      lightMode: { backgroundColor: CARD_LIGHT, borderColor: BORDER_LIGHT },
      darkMode: { backgroundColor: CARD_DARK, borderColor: BORDER_DARK },
      logo: { enabled: true, location: 'CENTER', position: 'TOP', formInclusion: 'IN' },
    },
    pageBackground: {
      // Plain background (no gradient) — design ethos: the UI recedes.
      image: { enabled: false },
      lightMode: { color: PAGE_BG_LIGHT },
      darkMode: { color: PAGE_BG_DARK },
    },
    pageText: {
      lightMode: { bodyColor: SUBTEXT_LIGHT, headingColor: TEXT_LIGHT, descriptionColor: SUBTEXT_LIGHT },
      darkMode: { bodyColor: SUBTEXT_DARK, headingColor: TEXT_DARK, descriptionColor: SUBTEXT_DARK },
    },
  },
  componentClasses: {
    buttons: { borderRadius: 12 }, // --radius-lg (buttons)
    input: {
      borderRadius: 8, // --radius-md (inputs)
      lightMode: { defaults: { backgroundColor: CARD_LIGHT, borderColor: 'cbd5e1ff' }, placeholderColor: MUTED },
      darkMode: { defaults: { backgroundColor: CARD_DARK, borderColor: BORDER_DARK }, placeholderColor: SUBTEXT_DARK },
    },
    link: {
      lightMode: { defaults: { textColor: BRAND_LIGHT }, hover: { textColor: BRAND_LIGHT_HOVER } },
      darkMode: { defaults: { textColor: BRAND_DARK }, hover: { textColor: BRAND_DARK_HOVER } },
    },
    focusState: {
      lightMode: { borderColor: BRAND_LIGHT },
      darkMode: { borderColor: BRAND_DARK },
    },
  },
};

// Standalone logo lockup (gradient wobble mark + wordmark) for the form logo.
// Gradient mark is indigo→teal (#6366F1→#0D9488), matching WobblioLogo.tsx.
// `wobblColor` = the non-brand wordmark; `ioColor` = the brand-accent "io".
function logoSvg(wobblColor: string, ioColor: string): string {
  // viewBox kept at a ≤4:1 width:height ratio (Cognito Managed Login LOGO
  // constraint); content is vertically centered in the taller box.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 175 50" fill="none">` +
    `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">` +
    `<stop offset="0%" stop-color="#6366F1"/><stop offset="100%" stop-color="#0D9488"/>` +
    `</linearGradient></defs>` +
    `<g transform="translate(0,9)" stroke="url(#g)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M 6 22 C 10 22, 14 6, 20 6 C 24 6, 26 18, 32 14 L 42 14"/>` +
    `<path d="M 6 22 C 10 22, 15 26, 20 20 C 23 16, 26 12, 30 16 C 33 19, 36 24, 42 24"/>` +
    `</g>` +
    `<text x="56" y="34" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800" letter-spacing="-0.5">` +
    `<tspan fill="#${wobblColor}">wobbl</tspan><tspan fill="#${ioColor}">io</tspan></text>` +
    `</svg>`;
}

function b64(svg: string): string {
  return Buffer.from(svg, 'utf-8').toString('base64');
}

// Light/dark form-logo assets. Cognito serves the matching one per color mode.
// Wordmark + brand-accent "io" follow the theme's --text-primary and --brand.
export const WOBBLIO_LOGIN_ASSETS = [
  { category: 'FORM_LOGO', colorMode: 'LIGHT', extension: 'SVG', bytes: b64(logoSvg('0F172A', '4F46E5')) },
  { category: 'FORM_LOGO', colorMode: 'DARK', extension: 'SVG', bytes: b64(logoSvg('F8FAFC', '6366F1')) },
];
