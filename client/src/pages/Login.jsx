import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, UserPlus, Store } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/PasswordSecurity';
import { PORTAL_URL } from '../lib/apps';


export default function Login() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // `scope` tells the API this is the shopper app, so a merchant/rider/admin
      // is refused at the source instead of logging in and being bounced.
      const account = await login(API, form.email.trim(), form.password, { scope: 'customer' });
      if (account?.role && account.role !== 'customer') {
        logout();
        setError('Could not sign you in.');
        setSubmitting(false);
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Login</h1>
      <p className="muted">Shopper accounts only.</p>
      <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Password<PasswordField value={form.password} autoComplete="current-password" onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="cta-btn" disabled={submitting}>
        {submitting ? 'Logging in…' : <>Login <ArrowRight size={17} className="cta-arrow" aria-hidden="true" /></>}
      </button>
      <p className="muted"><UserPlus size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true" />New customer? <Link to="/register">Register here</Link></p>
      <p className="muted"><Store size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true" />Merchant, rider or operations? <a href={PORTAL_URL} target="_blank" rel="noreferrer">Sign in on the partner portal</a></p>
    </form>
  );
}
