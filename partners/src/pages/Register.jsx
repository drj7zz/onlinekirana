import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Bike, ShieldCheck } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { PasswordField, StrengthMeter, checkPassword } from '@shared/components/PasswordSecurity';
import useSeo from '@shared/hooks/useSeo';

/**
 * One sign-up form for both kinds of partner. A shopkeeper and a rider need the
 * same things — a name, an email, a phone and a password — and differ only in
 * the last couple of fields, so asking twice would be silly. Operations staff
 * are invite-only and have no public path here.
 *
 * Both roles land as `pending` and are approved from the portal, so nobody can
 * self-grant a working account.
 */
const ROLES = [
  { key: 'merchant', icon: Store, title: 'I have a shop', blurb: 'Sell groceries on OnlineKirana' },
  { key: 'delivery', icon: Bike, title: 'I want to deliver', blurb: 'Earn per trip on your own shift' },
];

export default function Register() {
  useSeo({
    title: 'Register as a Partner — OnlineKirana Birgunj',
    description:
      'Create your OnlineKirana partner account as a shopkeeper or a delivery rider. No shop licence, PAN or VAT card — just your name, email, phone and a password.',
  });
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('merchant');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', shopName: '', line: '', ward: '', riderArea: '', riderVehicle: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setForm({ ... form, [k]: e. target. value });
  const isRider = role === 'delivery';

  const submit = async (e) => {
    e. preventDefault();
    setError('');
    const clientPwErrors = checkPassword(form. password, form. name, form. email);
    if (clientPwErrors. length) {
      setFieldErrors({ password: ['Needs: ' + clientPwErrors. join(', ')] });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const account = await register(API, {
        name: form. name,
        email: form. email,
        password: form. password,
        phone: form. phone,
        role,
        // Only the fields that belong to the chosen role are sent, so a rider
        // never leaves a stray shopName behind.
        ...(isRider
          ? { riderArea: form. riderArea, riderVehicle: form. riderVehicle }
          : { shopName: form. shopName, address: { line: form. line, ward: form. ward } }),
      });

      // A new partner cannot work yet — send them to a page that says so rather
      // than to an empty workspace.
      const needsApproval = isRider
        ? account?. riderStatus === 'pending'
        : account?. merchantStatus === 'pending';
      navigate(needsApproval ? '/pending' : (isRider ? '/rider' : '/dashboard'), { replace: true });
    } catch (err) {
      const data = err. response?. data;
      if (data?. errors) setFieldErrors(data. errors);
      else setError(data?. message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Join OnlineKirana</h1>
      <p className="muted">No documents needed — just your name, email, phone and a password.</p>

      {/* which kind of partner */}
      <div className="filters" style={{ marginBottom: '.4rem' }}>
        {ROLES. map((r) => (
          <button
            type="button"
            key={r. key}
            className={role === r. key ? '' : 'muted-btn'}
            onClick={() => { setRole(r. key); setFieldErrors({}); setError(''); }}
            aria-pressed={role === r. key}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}
          >
            <r. icon size={15} aria-hidden="true" /> {r. title}
          </button>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {ROLES. find((r) => r. key === role). blurb}.
      </p>

      {!isRider && (
        <label>Shop name<input required value={form. shopName} onChange={set('shopName')} /></label>
      )}
      <label>Full name<input required value={form. name} onChange={set('name')} /></label>
      <label>Email<input type="email" required autoComplete="email" value={form. email} onChange={set('email')} /></label>
      {fieldErrors. email && <p className="error">{fieldErrors. email}</p>}
      <label>Password<PasswordField value={form. password} onChange={set('password')} /></label>
      <StrengthMeter password={form. password} name={form. name} email={form. email} />
      <label>
        Phone
        <input required={isRider} autoComplete="tel" value={form. phone} onChange={set('phone')} placeholder="98XXXXXXXX" />
        {isRider && <span className="muted">Customers and shops use this to reach you during a delivery.</span>}
      </label>
      {fieldErrors. phone && <p className="error">{fieldErrors. phone}</p>}

      {isRider ? (
        <>
          <label>
            Which wards do you cover?
            <input value={form. riderArea} onChange={set('riderArea')} placeholder="e. g. Ward 1–5" />
          </label>
          <label>
            How do you travel?
            <select value={form. riderVehicle} onChange={set('riderVehicle')}>
              <option value="">Choose…</option>
              <option>Bike</option>
              <option>Cycle</option>
              <option>Scooter</option>
              <option>On foot</option>
              <option>Other</option>
            </select>
          </label>
        </>
      ) : (
        <>
          <label>Shop address — street / tole<input value={form. line} onChange={set('line')} /></label>
          <label>Ward No. (Birgunj)<input value={form. ward} onChange={set('ward')} /></label>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {fieldErrors. name && <p className="error">{fieldErrors. name}</p>}
      {fieldErrors. shopName && <p className="error">{fieldErrors. shopName}</p>}

      <button type="submit" className="cta-btn" disabled={submitting}>
        {submitting ? 'Submitting…' : isRider ? 'Apply to deliver' : 'Apply as a partner'}
      </button>
      <p className="muted">Already have an account? <Link to="/login">Sign in</Link></p>
      <p className="muted">
        <ShieldCheck size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true" />
        Operations staff are added by an admin — <Link to="/join">see how to join</Link>.
      </p>
    </form>
  );
}
