import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Store } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { PasswordField } from '@shared/components/PasswordSecurity';
import useSeo from '@shared/hooks/useSeo';
import { STOREFRONT_URL } from '@shared/lib/apps';

export default function Login() {
  // Sign-in is shopper-private: never let it into a search index.
  useSeo({
    title: 'Partner Sign In — OnlineKirana',
    description: 'Sign in to your OnlineKirana partner account to manage your shop, products, orders or delivery shifts.',
    noindex: true,
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // `scope: 'portal'` means this is the business app — shoppers get sent to
      // the storefront instead of getting a workspace they cannot use.
      const account = await login(API, form.email.trim(), form.password, { scope: 'portal' });
      // send each role to the workspace that belongs to it
      const home = { merchant: '/products', delivery: '/rider', admin: '/admin/orders' }[account?.role] || '/dashboard';
      navigate(home, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Partner sign in</h1>
      <p className="muted">Merchants, delivery partners and operations staff all sign in here.</p>
      <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Password<PasswordField value={form.password} autoComplete="current-password" onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="cta-btn" disabled={submitting}>
        {submitting ? 'Signing in…' : <>Sign in <ArrowRight size={17} className="cta-arrow" aria-hidden="true" /></>}
      </button>
      <p className="muted"><Store size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true" />New here? <Link to="/join">See how to join</Link> or <Link to="/register">register a shop</Link>.</p>
      <p className="muted">Just want to buy groceries? <a href={STOREFRONT_URL}>Visit the storefront</a>.</p>
    </form>
  );
}
