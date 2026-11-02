import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ShoppingBasket, Store } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { PasswordField, StrengthMeter, checkPassword } from '../components/PasswordSecurity';
import { PORTAL_URL } from '../lib/apps';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let initializedGoogleClientId = null;
let googleCredentialHandler = null;
const initialForm = (profile = {}) => ({
  name: profile.name || '',
  email: profile.email || '',
  password: '',
  phone: '',
  line: '',
  ward: '',
});

function GoogleIdentityButton({ onCredential }) {
  const buttonRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const button = buttonRef.current;
    if (!GOOGLE_CLIENT_ID || !button) return undefined;
    let active = true;
    let renderedWidth = 0;
    googleCredentialHandler = onCredential;
    const renderButton = () => {
      if (!active || !window.google?.accounts?.id) return;
      const width = Math.min(400, Math.floor(button.clientWidth || 340));
      if (width < 180 || width === renderedWidth) return;
      if (initializedGoogleClientId !== GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => {
            if (credential) googleCredentialHandler?.(credential);
          },
          auto_select: false,
        });
        initializedGoogleClientId = GOOGLE_CLIENT_ID;
      }
      button.replaceChildren();
      renderedWidth = width;
      window.google.accounts.id.renderButton(button, {
        type: 'standard',
        theme: document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width,
        logo_alignment: 'left',
        locale: 'en',
      });
      setStatus('ready');
    };

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(renderButton);
    if (resizeObserver) resizeObserver.observe(button);
    else window.addEventListener('resize', renderButton);
    let script = document.querySelector('script[data-google-identity]');
    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleIdentity = 'true';
        document.head.appendChild(script);
      }
      const handleLoad = () => renderButton();
      const handleError = () => active && setStatus('error');
      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);
      if (window.google?.accounts?.id) renderButton();
      return () => {
        active = false;
        resizeObserver?.disconnect();
        window.removeEventListener('resize', renderButton);
        if (googleCredentialHandler === onCredential) googleCredentialHandler = null;
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
        button.replaceChildren();
      };
    }

    return () => {
      active = false;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', renderButton);
      if (googleCredentialHandler === onCredential) googleCredentialHandler = null;
      button.replaceChildren();
    };
  }, [onCredential]);

  return (
    <div className="google-signin">
      {status === 'loading' && <p className="muted" role="status">Loading Google sign-in…</p>}
      {status === 'error' && <p className="error" role="alert">Google sign-in could not load. Check your connection and try again.</p>}
      <div ref={buttonRef} className="google-signin-button" />
    </div>
  );
}

export default function CustomerAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, completeSession } = useAuth();
  const isRegister = location.pathname === '/register';
  const googleHandoff = location.state?.googleCredential
    ? location.state
    : null;
  const [form, setForm] = useState(() => initialForm(googleHandoff?.profile));
  const [googleCredential, setGoogleCredential] = useState(googleHandoff?.googleCredential || '');
  const hasGoogleRegistration = isRegister && Boolean(googleCredential);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const onGoogleCredential = useCallback(async (credential) => {
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      const { data } = await API.post('/auth/google', { credential });
      if (data.registrationRequired) {
        setGoogleCredential(credential);
        setForm((current) => ({
          ...current,
          name: data.profile?.name || current.name,
          email: data.profile?.email || current.email,
        }));
        navigate('/register', { state: { googleCredential: credential, profile: data.profile } });
        return;
      }
      completeSession(data);
      navigate('/');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [completeSession, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const passwordErrors = form.password
      ? checkPassword(form.password, form.name, form.email)
      : googleCredential ? [] : ['Password is required'];
    if (passwordErrors.length) {
      setFieldErrors({ password: `Needs: ${passwordErrors.join(', ')}` });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(API, {
          name: form.name,
          email: form.email,
          password: form.password || undefined,
          googleCredential: googleCredential || undefined,
          phone: form.phone,
          address: { line: form.line, ward: form.ward },
        });
      } else {
        await login(API, form.email.trim(), form.password, { scope: 'customer' });
      }
      navigate('/');
    } catch (requestError) {
      const data = requestError.response?.data;
      if (data?.errors) setFieldErrors(data.errors);
      else setError(data?.message || (isRegister ? 'Registration failed' : 'Login failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="customer-auth">
      <div className="customer-auth-card">
        <aside className="customer-auth-aside">
          <div className="customer-auth-brand"><ShoppingBasket size={24} aria-hidden="true" /> OnlineKirana</div>
          <p className="customer-auth-kicker">Fresh groceries, closer to home</p>
          <h1>Good food starts with a simpler shop.</h1>
          <p>Sign in or create your shopper account to order from local shops in Birgunj.</p>
        </aside>

        <div className="customer-auth-main">
          <div className="customer-auth-tabs" aria-label="Account options">
            <Link to="/login" className={!isRegister ? 'is-active' : ''} aria-current={!isRegister ? 'page' : undefined}>Sign in</Link>
            <Link to="/register" className={isRegister ? 'is-active' : ''} aria-current={isRegister ? 'page' : undefined}>Create account</Link>
          </div>
          <h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2>
          <p className="muted">{isRegister ? 'Shopper accounts only. Your details help local shops deliver to you.' : 'Sign in to continue shopping.'}</p>

          <form className="customer-auth-form" onSubmit={submit}>
            {isRegister && (
              <>
                <label>Full name
                  <input required autoComplete="name" value={form.name} onChange={set('name')} />
                </label>
                {fieldErrors.name && <p className="error">{fieldErrors.name}</p>}
              </>
            )}
            <label>Email
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
                readOnly={hasGoogleRegistration}
              />
            </label>
            {fieldErrors.email && <p className="error">{fieldErrors.email}</p>}

            <label>Password
              <PasswordField
                value={form.password}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required={!hasGoogleRegistration}
                onChange={set('password')}
              />
            </label>
            {isRegister && form.password && <StrengthMeter password={form.password} name={form.name} email={form.email} />}
            {fieldErrors.password && <p className="error">{fieldErrors.password}</p>}
            {isRegister && (
              <>
                {hasGoogleRegistration && <p className="customer-auth-note">Google verified your email. Add your delivery details to finish creating your account.</p>}
                <label>Phone (for orders)
                  <input required autoComplete="tel" inputMode="numeric" placeholder="98XXXXXXXX" value={form.phone} onChange={set('phone')} />
                </label>
                {fieldErrors.phone && <p className="error">{fieldErrors.phone}</p>}
                <label>Address — street / tole
                  <input required autoComplete="street-address" placeholder="e.g. Ghantaghar, Raniganj" value={form.line} onChange={set('line')} />
                </label>
                {fieldErrors.address && <p className="error">{fieldErrors.address}</p>}
                <label>Ward No. (Birgunj)
                  <input required inputMode="numeric" placeholder="e.g. 10" value={form.ward} onChange={set('ward')} />
                </label>
                {hasGoogleRegistration && <p className="muted">Setting a password is optional now; you can also add one later from your profile.</p>}
              </>
            )}

            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="cta-btn customer-auth-submit" disabled={submitting}>
              {submitting ? 'Please wait…' : <>{isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={17} aria-hidden="true" /></>}
            </button>
          </form>

          <div className="customer-auth-divider"><span>or continue with</span></div>
          {GOOGLE_CLIENT_ID
            ? <GoogleIdentityButton onCredential={onGoogleCredential} />
            : <p className="customer-auth-note">Google sign-in is unavailable until it is configured.</p>}

          <p className="customer-auth-partner">
            <Store size={14} aria-hidden="true" />
            Merchant, rider or operations? <a href={PORTAL_URL} target="_blank" rel="noreferrer">Use the partner portal</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
