/* Wobblio auth — Sign in screen (faithful to Source/webapp (auth)/login) */
const { Card: LgCard, Button: LgBtn, Input: LgInput, Checkbox: LgCheck, WobblioLogo: LgLogo } = window.WobblioDesignSystem_6a8d64;
const LI = window.WobblioIcons;

function Login({ onSignIn, onRegister }) {
  const [loading, setLoading] = React.useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); onSignIn && onSignIn(); }, 850);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card glass">
        <div className="auth-brand"><LgLogo size={30} withWordmark/></div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to your household workspace.</p>

        <form onSubmit={submit} className="auth-form" noValidate>
          <LgInput label="Email" type="email" name="email" autoComplete="email"
                   icon={<LI.mail/>} placeholder="you@example.com" required/>
          <LgInput label="Password" type="password" name="password" autoComplete="current-password"
                   icon={<LI.lock2/>} placeholder="Enter your password" required/>

          <div className="auth-row">
            <LgCheck defaultChecked label="Remember me"/>
            <a href="#" className="auth-link" onClick={(e) => e.preventDefault()}>Forgot your password?</a>
          </div>

          <LgBtn type="submit" variant="primary" disabled={loading}
                 style={{ width: '100%' }}
                 iconLeft={loading ? null : <LI.logout/>}>
            {loading ? 'Signing in…' : 'Sign in'}
          </LgBtn>
        </form>

        <p className="auth-foot">
          Don&apos;t have an account? <a href="#" className="auth-link strong" onClick={(e) => { e.preventDefault(); onRegister && onRegister(); }}>Create one</a>
        </p>
      </div>

      <p className="auth-legal">
        <LI.shieldCheck size={14}/> Protected by row-level security · GDPR-compliant · EU-hosted
      </p>
    </div>
  );
}

window.WobblioLogin = Login;
