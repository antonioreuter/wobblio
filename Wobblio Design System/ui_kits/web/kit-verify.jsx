/* Wobblio auth — Email verification code (OTP) screen */
const { Button: VfBtn, WobblioLogo: VfLogo } = window.WobblioDesignSystem_6a8d64;
const VI = window.WobblioIcons;
const OTP_LEN = 6;

function Verify({ email = 'you@example.com', onVerified, onBack }) {
  // Demo: a code is "emailed". Stored so we can show an error on mismatch + a dev hint.
  const [sentCode, setSentCode] = React.useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [digits, setDigits] = React.useState(Array(OTP_LEN).fill(''));
  const [status, setStatus] = React.useState('idle'); // idle | verifying | error
  const [seconds, setSeconds] = React.useState(30);
  const refs = React.useRef([]);

  React.useEffect(() => { refs.current[0] && refs.current[0].focus(); }, []);
  React.useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const code = digits.join('');
  const complete = code.length === OTP_LEN && digits.every((d) => d !== '');

  const setDigit = (i, val) => {
    const v = val.replace(/\D/g, '');
    setStatus('idle');
    setDigits((prev) => {
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
      setDigits((cur) => {
        if (cur.join('') === sentCode) { onVerified && onVerified(); }
        else { setStatus('error'); }
        return cur;
      });
    }, 800);
  }, [sentCode, onVerified]);

  const submit = (e) => {
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

  return (
    <div className="auth-screen">
      <div className="auth-card glass">
        <div className="auth-brand"><VfLogo size={30} withWordmark/></div>
        <div className="verify-icon"><VI.mailCheck size={26}/></div>
        <h1 className="auth-title">Check your email</h1>
        <p className="auth-sub">
          Enter the 6-digit code we sent to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> to finish setting up your account.
        </p>

        <form onSubmit={submit} className="auth-form" noValidate>
          <div className={`otp-row ${status === 'error' ? 'otp-error' : ''}`} onPaste={(e) => { e.preventDefault(); setDigit(0, (e.clipboardData.getData('text') || '').trim()); }}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (refs.current[i] = el)}
                className={`otp-input ${d ? 'filled' : ''}`}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={d}
                aria-label={`Digit ${i + 1}`}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
              />
            ))}
          </div>

          {status === 'error' && <span className="field-error" style={{ textAlign: 'center' }}>That code isn’t right. Check your email and try again.</span>}

          <VfBtn type="submit" variant="primary" disabled={!complete || status === 'verifying'}
                 style={{ width: '100%' }}
                 iconLeft={status === 'verifying' ? null : <VI.check/>}>
            {status === 'verifying' ? 'Verifying…' : 'Verify & continue'}
          </VfBtn>
        </form>

        <p className="auth-foot">
          Didn’t get it?{' '}
          {seconds > 0
            ? <span style={{ color: 'var(--text-muted)' }}>Resend code in {seconds}s</span>
            : <a href="#" className="auth-link strong" onClick={(e) => { e.preventDefault(); resend(); }}>Resend code</a>}
        </p>
        <p className="auth-foot" style={{ marginTop: 8 }}>
          Wrong address? <a href="#" className="auth-link strong" onClick={(e) => { e.preventDefault(); onBack && onBack(); }}>Go back</a>
        </p>

        <p className="verify-hint">Demo code: <code>{sentCode}</code></p>
      </div>

      <p className="auth-legal">
        <VI.shieldCheck size={14}/> Protected by row-level security · GDPR-compliant · EU-hosted
      </p>
    </div>
  );
}

window.WobblioVerify = Verify;
