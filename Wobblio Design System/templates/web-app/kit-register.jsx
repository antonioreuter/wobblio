/* Wobblio auth — Create account screen (matches kit-login.jsx) */
const { Button: RgBtn, Input: RgInput, Checkbox: RgCheck, WobblioLogo: RgLogo } = window.WobblioDesignSystem_6a8d64;
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
const STRENGTH = [
  { label: '', tone: '' },
  { label: 'Weak', tone: 'danger' },
  { label: 'Fair', tone: 'warning' },
  { label: 'Good', tone: 'warning' },
  { label: 'Strong', tone: 'success' },
];

// Country → display currency. Drives the read-only currency field.
const COUNTRIES = [
  { code: 'NL', name: 'Netherlands',    currency: 'EUR', symbol: '€' },
  { code: 'BE', name: 'Belgium',        currency: 'EUR', symbol: '€' },
  { code: 'DE', name: 'Germany',        currency: 'EUR', symbol: '€' },
  { code: 'PT', name: 'Portugal',       currency: 'EUR', symbol: '€' },
  { code: 'FR', name: 'France',         currency: 'EUR', symbol: '€' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£' },
  { code: 'US', name: 'United States',  currency: 'USD', symbol: '$' },
  { code: 'CH', name: 'Switzerland',    currency: 'CHF', symbol: 'Fr' },
  { code: 'SE', name: 'Sweden',         currency: 'SEK', symbol: 'kr' },
  { code: 'DK', name: 'Denmark',        currency: 'DKK', symbol: 'kr' },
  { code: 'BR', name: 'Brazil',         currency: 'BRL', symbol: 'R$' },
];
const LANGUAGES = ['English', 'Nederlands', 'Deutsch', 'Português', 'Français', 'Español'];

// Labeled <select> styled to match the DS Input.
function AuthSelect({ label, icon, value, onChange, children }) {
  return (
    <div className="auth-field">
      <label className="auth-field-label">{label}</label>
      <div className="auth-control-wrap">
        {icon && <span className="lead-icon">{icon}</span>}
        <select className="auth-select" value={value} onChange={onChange}>{children}</select>
        <span className="chevron"><RI.chevronDown/></span>
      </div>
    </div>
  );
}

// Read-only derived display (e.g. currency from country).
function AuthStatic({ label, icon, value, hint }) {
  return (
    <div className="auth-field">
      <label className="auth-field-label">{label}</label>
      <div className="auth-control-wrap">
        {icon && <span className="lead-icon">{icon}</span>}
        <div className="auth-static" aria-readonly="true">
          <span>{value}</span>
          {hint && <span className="auto-tag">Auto</span>}
        </div>
      </div>
    </div>
  );
}

function Register({ onSignUp, onBack, fields = {} }) {
  const f = {
    confirmPassword: fields.confirmPassword !== false,
    birthdate: fields.birthdate !== false,
    country: fields.country !== false,
    language: fields.language !== false,
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
  const selected = COUNTRIES.find((c) => c.code === country) || COUNTRIES[0];
  const mismatch = f.confirmPassword && confirm.length > 0 && confirm !== pw;
  const blocked = !agreed || mismatch;

  const submit = (e) => {
    e.preventDefault();
    if (loading || blocked) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); onSignUp && onSignUp(email || 'you@example.com'); }, 900);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card glass">
        <div className="auth-brand"><RgLogo size={30} withWordmark/></div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Start tracking your household in minutes.</p>

        <form onSubmit={submit} className="auth-form" noValidate>
          <RgInput label="Full name" type="text" name="name" autoComplete="name"
                   icon={<RI.user/>} placeholder="Antonio Reuter" required/>
          <RgInput label="Email" type="email" name="email" autoComplete="email"
                   icon={<RI.mail/>} placeholder="you@example.com" required
                   value={email} onChange={(e) => setEmail(e.target.value)}/>

          <div className="pw-field">
            <RgInput label="Password" type="password" name="password" autoComplete="new-password"
                     icon={<RI.lock2/>} placeholder="At least 8 characters" required
                     value={pw} onChange={(e) => setPw(e.target.value)}/>
            <div className="pw-meter" aria-hidden="true">
              <div className="pw-track">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={`pw-seg ${i <= score ? 'on tone-' + meter.tone : ''}`}/>
                ))}
              </div>
              {meter.label && <span className="pw-label" style={{ color: `var(--${meter.tone})` }}>{meter.label}</span>}
            </div>
          </div>

          {f.confirmPassword && (
            <div className="pw-field">
              <RgInput label="Confirm password" type="password" name="confirmPassword" autoComplete="new-password"
                       icon={<RI.lock2/>} placeholder="Re-enter your password" required
                       flagged={mismatch}
                       value={confirm} onChange={(e) => setConfirm(e.target.value)}/>
              {mismatch && <span className="field-error">Passwords don’t match.</span>}
            </div>
          )}

          {f.birthdate && (
            <RgInput label="Date of birth" type="date" name="birthdate"
                     icon={<RI.calendar/>} required/>
          )}

          {f.country && (
            <div className="auth-grid-2">
              <AuthSelect label="Country" icon={<RI.globe/>} value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </AuthSelect>
              <AuthStatic label="Display currency" icon={<RI.wallet2/>}
                          value={`${selected.currency} · ${selected.symbol}`} hint/>
            </div>
          )}

          {f.language && (
            <AuthSelect label="Preferred language" icon={<RI.languages/>} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </AuthSelect>
          )}

          <label className="auth-consent">
            <RgCheck checked={agreed} onChange={(e) => setAgreed(e.target.checked)}/>
            <span>
              I agree to the <a href="#" className="auth-link strong" onClick={(e) => e.preventDefault()}>Terms</a> and{' '}
              <a href="#" className="auth-link strong" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
            </span>
          </label>

          <RgBtn type="submit" variant="primary" disabled={loading || blocked}
                 style={{ width: '100%' }}
                 iconLeft={loading ? null : <RI.user/>}>
            {loading ? 'Creating account…' : 'Create account'}
          </RgBtn>
        </form>

        <p className="auth-foot">
          Already have an account? <a href="#" className="auth-link strong" onClick={(e) => { e.preventDefault(); onBack && onBack(); }}>Sign in</a>
        </p>
      </div>

      <p className="auth-legal">
        <RI.shieldCheck size={14}/> Protected by row-level security · GDPR-compliant · EU-hosted
      </p>
    </div>
  );
}

window.WobblioRegister = Register;
