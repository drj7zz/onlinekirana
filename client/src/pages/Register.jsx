import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { PasswordField, StrengthMeter, checkPassword } from '../components/PasswordSecurity';
import { PORTAL_URL } from '../lib/apps';


export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', line: '', ward: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const clientPwErrors = checkPassword(form.password, form.name, form.email);
    if (clientPwErrors.length) {
      setFieldErrors({ password: ['Needs: ' + clientPwErrors.join(', ')] });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register(API, {
        name: form.name, email: form.email, password: form.password, phone: form.phone,
        address: { line: form.line, ward: form.ward },
      });
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) setFieldErrors(data.errors);
      else setError(data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <form className="form narrow compact-form" onSubmit={submit}>
      <h1>Create account</h1>
      <p className="muted">All fields below are required. Shoppers only — to run a shop or deliver,{' '}
        <a href={PORTAL_URL} target="_blank" rel="noreferrer">use the partner portal</a>.
      </p>
      {/* First two fields live side by side to keep the form short; at narrow
          widths the CSS stacks them again. */}
      <div className="field-row">
        <label>Full name<input required value={form.name} onChange={set('name')} /></label>
        <label>Phone (default for orders)<input required autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="98XXXXXXXX" inputMode="numeric" /></label>
      </div>
      {fieldErrors.name && <p className="error">{fieldErrors.name}</p>}
      {fieldErrors.phone && <p className="error">{fieldErrors.phone}</p>}
      <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={set('email')} /></label>
      {fieldErrors.email && <p className="error">{fieldErrors.email}</p>}
      <label>Password<PasswordField value={form.password} onChange={set('password')} /></label>
      <StrengthMeter password={form.password} name={form.name} email={form.email} />
      <div className="field-row">
        <label>Address — street / tole (default for orders)<input required value={form.line} onChange={set('line')} placeholder="e.g. Ghantaghar, Raniganj" /></label>
        <label>Ward No. (Birgunj)<input required value={form.ward} onChange={set('ward')} placeholder="e.g. 10" /></label>
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Register'}</button>
      <p className="muted">Already have an account? <Link to="/login">Login</Link></p>
    </form>
  );
}
