import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ShoppingBasket, Store, Bike, ShieldCheck } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { PasswordField, StrengthMeter, checkPassword } from '@shared/components/PasswordSecurity';
import useSeo from '@shared/hooks/useSeo';
import { STOREFRONT_URL } from '@shared/lib/apps';

/**
 * The partner sign-in / sign-up page, redesigned to match the storefront's
 * `/login` + `/register` split-panel layout (same `.customer-auth*` classes the
 * shopper app uses — they come in through `@shared/styles.css`).
 *
 * What changed vs. the old flat form:
 *  - Brand aside with the portal pitch, and "Sign in / Create account" tabs.
 *  - Role picker on the register side (shop vs. delivery), which swaps in the
 *    shop-name or rider-area fields.
 *  - Google sign-in on BOTH sides — this is the only auth surface where Google
 *    sign-in appears in the portal, since it lives here rather than in a
 *    dedicated page.
 */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let initializedGoogleClientId = null;
let googleCredentialHandler = null;

const initialForm = (profile = {}) => ({
  role: 'merchant',
  name: profile.name || '',
  email: profile.email || '',
  password: '',
  phone: '',
  shopName: '',
  line: '',
  ward: '',
  riderArea: '',
  riderVehicle: '',
});

/** Google Identity button — same behaviour as the storefront's, shared markup. */
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

const ROLES = [
  { key: 'merchant', icon: Store, title: 'I have a shop', blurb: 'Sell groceries on OnlineKirana' },
  { key: 'delivery', icon: Bike, title: 'I want to deliver', blurb: 'Earn per trip on your own shift' },
];

export default function PartnerAuth() {
  // Sign-in is partner-private: never let it into a search index.
  useSeo({
    title: 'Partner Sign In — OnlineKirana',
    description: 'Sign in to your OnlineKirana partner account to manage your shop, products, orders or delivery shifts.',
    noindex: true,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { login, completeSession } = useAuth();
  const isRegister = location.pathname === '/register';
  const googleHandoff = location.state?.googleCredential ? location.state : null;
  const [form, setForm] = useState(() => initialForm(googleHandoff?.profile));
  const [googleCredential, setGoogleCredential] = useState(googleHandoff?.googleCredential || '');
  const hasGoogleRegistration = isRegister && Boolean(googleCredential);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };
  const isRider = form.role === 'delivery';

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
      // Partners sign in through this page too; the role-aware portal home
      // takes over once the session exists.
      completeSession(data);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [completeSession, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setVerificationEmail('');
    const passwordErrors = form.password
      ? checkPassword(form.password, form.name, form.email)
      : googleCredential ? [] : ['Password is required'];
    if (passwordErrors.length) {
      setFieldErrors({ password: ['Needs: ' + passwordErrors.join(', ')] });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (isRegister) {
        // Same payload shape as the old Register page: role-specific fields only.
        await API.post('/auth/register', {
          name: form.name,
          email: form.email,
          password: form.password || undefined,
          phone: form.phone,
          role: form.role,
          ...(isRider
            ? { riderArea: form.riderArea, riderVehicle: form.riderVehicle }
            : { shopName: form.shopName, address: { line: form.line, ward: form.ward } }),
        }).then((account) => {
          if (account?.data?.verificationRequired) {
            navigate(`/verify-email?email=${encodeURIComponent(account.data.email)}`, {
              replace: true,
              state: { email: account.data.email, verificationCode: account.data.verificationCode },
            });
          }
        });
      } else {
        // `scope: 'portal'` — shoppers get sent to the storefront instead.
        await login(API, form.email.trim(), form.password, { scope: 'portal' });
        navigate('/', { replace: true });
      }
    } catch (requestError) {
      const data = requestError.response?.data;
      if (data?.errors) setFieldErrors(data.errors);
      else setError(data?.message || (isRegister ? 'Registration failed' : 'Login failed'));
      if (data?.code === 'EMAIL_NOT_VERIFIED') setVerificationEmail(form.email.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="customer-auth">
      <div className="customer-auth-card">
        <aside className="customer-auth-aside">
          <div className="customer-auth-brand"><ShoppingBasket size={24} aria-hidden="true" /> OnlineKirana</div>
          <p className="customer-auth-kicker">For shops and riders</p>
          <h1>Your shop, online in an afternoon.</h1>
          <p>
            {isRegister
              ? 'Create a partner account to sell on OnlineKirana or deliver around Birgunj. Every application is reviewed before it goes live.'
              : 'Merchants, delivery partners and operations staff all sign in here to run the marketplace.'}
          </p>
        </aside>

        <div className="customer-auth-main">
          <div className="customer-auth-tabs" aria-label="Account options">
            <Link to="/login" className={!isRegister ? 'is-active' : ''} aria-current={!isRegister ? 'page' : undefined}>Sign in</Link>
            <Link to="/register" className={isRegister ? 'is-active' : ''} aria-current={isRegister ? 'page' : undefined}>Register</Link>
          </div>
          <h2>{isRegister ? 'Join OnlineKirana' : 'Partner sign in'}</h2>
          <p className="muted">{isRegister
            ? 'No documents needed — just your name, email, phone and a password.'
            : 'Welcome back. Sign in to continue.'}</p>

          <form className="customer-auth-form" onSubmit={submit}>
            {isRegister && (
              <>
                {/* which kind of partner */}
                <div className="partner-auth-roles" role="group" aria-label="Partner type">
                  {ROLES.map((r) => (
                    <button
                      type="button"
                      key={r.key}
                      className={`partner-auth-role${form.role === r.key ? ' is-active' : ''}`}
                      onClick={() => { setForm((c) => ({ ...c, role: r.key })); setFieldErrors({}); setError(''); }}
                      aria-pressed={form.role === r.key}
                    >
                      <r.icon size={17} aria-hidden="true" />
                      <span><strong>{r.title}</strong><small>{r.blurb}</small></span>
                    </button>
                  ))}
                </div>

                {!isRider && (
                  <label>Shop name
                    <input required value={form.shopName} onChange={set('shopName')} />
                  </label>
                )}
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
                onChange={set('password')}
              />
            </label>
            {isRegister && <StrengthMeter password={form.password} name={form.name} email={form.email} />}
            {fieldErrors.password && <p className="error">{fieldErrors.password}</p>}

            {isRegister && (
              <>
                {hasGoogleRegistration && <p className="customer-auth-note">Google verified your email. Finish the partner details below.</p>}
                <label>Phone
                  <input required autoComplete="tel" inputMode="numeric" placeholder="98XXXXXXXX" value={form.phone} onChange={set('phone')} />
                  <span className="muted">{isRider ? 'Customers and shops use this to reach you during a delivery.' : 'Used for order updates and shop contact.'}</span>
                </label>
                {fieldErrors.phone && <p className="error">{fieldErrors.phone}</p>}
                {isRider ? (
                  <>
                    <label>Which wards do you cover?
                      <input required value={form.riderArea} onChange={set('riderArea')} placeholder="e.g. Ward 1–5" />
                    </label>
                    <label>How do you travel?
                      <select required value={form.riderVehicle} onChange={set('riderVehicle')}>
                        <option value="" disabled>Choose…</option>
                        <option>Bike</option>
                        <option>Cycle</option>
                        <option>Scooter</option>
                        <option>On foot</option>
                        <option>Other</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <div className="partner-auth-row">
                    <label>Shop address — street / tole
                      <input required autoComplete="street-address" placeholder="e.g. Main Road, Raniganj" value={form.line} onChange={set('line')} />
                    </label>
                    <label>Ward No. (Birgunj)
                      <input required inputMode="numeric" placeholder="e.g. 10" value={form.ward} onChange={set('ward')} />
                    </label>
                  </div>
                )}
              </>
            )}

            {error && <p className="error" role="alert">{error}</p>}
            {verificationEmail && (
              <p className="customer-auth-note">
                Your email is not verified yet. <Link to={`/verify-email?email=${encodeURIComponent(verificationEmail)}`}>Enter or request an in-app code</Link>.
              </p>
            )}
            <button type="submit" className="cta-btn customer-auth-submit" disabled={submitting}>
              {submitting ? 'Please wait…' : <>{isRegister ? (isRider ? 'Apply to deliver' : 'Apply as a partner') : 'Sign in'} <ArrowRight size={17} aria-hidden="true" /></>}
            </button>
          </form>

          <div className="customer-auth-divider"><span>or continue with</span></div>
          {GOOGLE_CLIENT_ID
            ? <GoogleIdentityButton onCredential={onGoogleCredential} />
            : <p className="customer-auth-note">Google sign-in is unavailable until it is configured.</p>}

          <p className="customer-auth-partner">
            {isRegister
              ? <><ShieldCheck size={14} aria-hidden="true" /> Already have an account? <Link to="/login">Sign in</Link></>
              : <><Store size={14} aria-hidden="true" /> New here? <Link to="/join">See how to join</Link> or <Link to="/register">register</Link>.</>}
            {' '}Just want to buy groceries? <a href={STOREFRONT_URL()}>Visit the storefront</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
