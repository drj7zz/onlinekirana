import { useState } from 'react';
import { Eye, EyeOff, CircleCheck } from 'lucide-react';

// Mirrors the server rules in server/middleware/validate.js
export function checkPassword(pw, name = '', email = '') {
  const errors = [];
  if ((pw || '').length < 8) errors.push('at least 8 characters');
  if (!/[a-z]/.test(pw)) errors.push('one lowercase letter');
  if (!/[A-Z]/.test(pw)) errors.push('one uppercase letter');
  if (!/\d/.test(pw)) errors.push('one number');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('one symbol (e.g. ! @ # ?)');
  const lower = (pw || '').toLowerCase();
  if (['password', '123456', 'qwerty', 'abc123', 'admin123', 'iloveyou', 'welcome', 'kirana', 'birgunj'].some((c) => lower.includes(c))) errors.push('too common');
  if (name && name.trim().length > 2 && lower.includes(name.trim().toLowerCase().split(' ')[0])) errors.push('must not contain your name');
  if (email && lower.includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length > 3) errors.push('must not contain your email');
  return errors;
}

export const strengthScore = (pw) => {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 5);
};

export function PasswordField({ value, onChange, name = 'password', autoComplete = 'new-password', placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        minLength={8}
        style={{ width: '100%', paddingRight: '3.2rem' }}
      />
      <button type="button" className="muted-btn" onClick={() => setShow(!show)}
        style={{ position: 'absolute', right: 4, top: 0, padding: '8px 10px', background: 'transparent', color: '#1b5e20', border: 'none', cursor: 'pointer' }}>
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function StrengthMeter({ password, name, email }) {
  const score = strengthScore(password);
  const errors = checkPassword(password, name, email);
  if (!password) return null;
  const labels = ['Very weak', 'Weak', 'Okay', 'Good', 'Strong', 'Excellent'];
  const colors = ['#c62828', '#e65100', '#f9a825', '#9e9d24', '#2e7d32', '#1b5e20'];
  return (
    <div style={{ marginTop: '.3rem' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i < score ? colors[score] : '#ddd' }} />
        ))}
      </div>
      <p className="muted" style={{ marginTop: '.2rem' }}>
        {errors.length === 0 ? <><CircleCheck size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true" />{labels[score]} password</> : `Needs: ${errors.join(', ')}`}
      </p>
    </div>
  );
}
