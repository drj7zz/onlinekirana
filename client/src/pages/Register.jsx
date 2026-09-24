import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { PasswordField, StrengthMeter, checkPassword } from '../components/PasswordSecurity';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [asMerchant, setAsMerchant] = useState(params.get('partner') === '1');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', line: '', ward: '', shopName: '' });
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
        ...(asMerchant && { role: 'merchant', shopName: form.shopName }),
      });
      navigate(asMerchant ? '/partners' : '/');
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) setFieldErrors(data.errors);
      else setError(data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Create account</h1>
      <label style={{ flexDirection: 'row', alignItems: 'center', gap: '.5rem' }}>
        <input type="checkbox" checked={asMerchant} onChange={(e) => setAsMerchant(e.target.checked)} style={{ width: 'auto' }} />
        Register as a merchant partner (sell on OnlineKirana)
      </label>
      {asMerchant && <label>Shop name<input required value={form.shopName} onChange={set('shopName')} /></label>}
      <label>Full name<input required value={form.name} onChange={set('name')} /></label>
      <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={set('email')} /></label>
      {fieldErrors.email && <p className="error">{fieldErrors.email}</p>}
      <label>Password<PasswordField value={form.password} onChange={set('password')} /></label>
      <StrengthMeter password={form.password} name={form.name} email={form.email} />
      <label>Phone<input autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="98XXXXXXXX" /></label>
      {fieldErrors.phone && <p className="error">{fieldErrors.phone}</p>}
      <label>Address — street / tole<input value={form.line} onChange={set('line')} /></label>
      <label>Ward No.<input value={form.ward} onChange={set('ward')} /></label>
      {error && <p className="error">{error}</p>}
      {fieldErrors.name && <p className="error">{fieldErrors.name}</p>}
      <button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : asMerchant ? 'Apply as partner' : 'Register'}</button>
      {asMerchant && <p className="muted">New partner shops are reviewed before going live.</p>}
      <p className="muted">Already have an account? <Link to="/login">Login</Link></p>
    </form>
  );
}
