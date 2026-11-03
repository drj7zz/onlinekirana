import { useState } from 'react';
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
 */

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
  const { login } = useAuth();
  const isRegister = location.pathname === '/register';
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };
  const isRider = form.role === 'delivery';

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const passwordErrors = form.password
      ? checkPassword(form.password, form.name, form.email)
      : ['Password is required'];
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
          password: form.password,
          phone: form.phone,
          role: form.role,
          ...(isRider
            ? { riderArea: form.riderArea, riderVehicle: form.riderVehicle }
            : { shopName: form.shopName, address: { line: form.line, ward: form.ward } }),
        }).then(() => {
          // New partner accounts are signed in immediately — the account goes
          // straight to admin review on the Approvals desk.
          navigate('/', { replace: true });
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
            <button type="submit" className="cta-btn customer-auth-submit" disabled={submitting}>
              {submitting ? 'Please wait…' : <>{isRegister ? (isRider ? 'Apply to deliver' : 'Apply as a partner') : 'Sign in'} <ArrowRight size={17} aria-hidden="true" /></>}
            </button>
          </form>

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
