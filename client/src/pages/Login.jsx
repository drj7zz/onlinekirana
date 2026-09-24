import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, UserPlus, Store } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/PasswordSecurity';

export default function Login() {
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
      await login(API, form.email.trim(), form.password);
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
      <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Password<PasswordField value={form.password} autoComplete="current-password" onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="cta-btn" disabled={submitting}>
        {submitting ? 'Logging in…' : <>Login <ArrowRight size={17} className="cta-arrow" aria-hidden="true" /></>}
      </button>
      <p className="muted"><UserPlus size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true" />New customer? <Link to="/register">Register here</Link></p>
      <p className="muted"><Store size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true" />Want to sell? <Link to="/register?partner=1">Become a partner</Link></p>
    </form>
  );
}
